import re
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.domain import utc
from app.models import AuthSession, Challenge, User, now
from app.schemas import (
    AuthMethods,
    Credentials,
    EmailInput,
    Login,
    Message,
    PasswordInput,
    PinChange,
    SessionView,
)
from app.security import (
    client_ip,
    current_user,
    digest,
    hasher,
    require_origin,
    revoke,
    session_context,
    throttle,
    verify,
)
from app.services import log_event, challenge, send_link

router = APIRouter(prefix="/api/v1/auth", tags=["identity"])


@router.get("/methods", response_model=AuthMethods)
def methods() -> AuthMethods:
    return AuthMethods(recovery=settings().email_configured)


@router.post("/login", response_model=SessionView)
def login(data: Login, request: Request, response: Response, db: Session = Depends(get_db)):
    require_origin(request)
    throttle(db, "login-ip:" + client_ip(request), 50)
    throttle(db, "login-account:" + data.method + str(data.email).lower(), 30)
    user = db.scalar(select(User).where(User.email == str(data.email).lower()).with_for_update())
    is_pin = data.method == "pin"
    locked = bool(user and is_pin and user.pin_locked_until and utc(user.pin_locked_until) > now())
    encoded = (user.pin_hash if is_pin else user.password_hash) if user else None
    valid = verify(encoded, data.secret)
    valid_pin = not is_pin or re.fullmatch(r"[0-9]{6}", data.secret) is not None
    if not user or not user.active or locked or not valid or not valid_pin:
        if user and user.active and is_pin and not locked:
            user.pin_failures += 1
            if user.pin_failures >= 5:
                user.pin_locked_until = now() + timedelta(minutes=15)
                user.pin_failures = 0
            log_event(db, user, "auth.pin_failed", user.id, request=request)
            db.commit()
        raise HTTPException(401, "INVALID_CREDENTIALS: Unable to sign in with those credentials")
    if is_pin:
        user.pin_failures, user.pin_locked_until = 0, None
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    auth = AuthSession(
        id=digest(token),
        user_id=user.id,
        csrf=csrf,
        expires_at=now() + timedelta(hours=8),
        elevated_until=None if is_pin else now() + timedelta(minutes=15),
    )
    db.add(auth)
    log_event(db, user, "auth.login", user.id, after={"method": data.method}, request=request)
    db.commit()
    response.set_cookie(
        "clockin_session",
        token,
        httponly=True,
        secure=settings().cookie_secure,
        samesite="lax",
        max_age=8 * 3600,
        path="/",
    )
    return {"user": user, "csrf": csrf, "expires_at": auth.expires_at}


@router.get("/session", response_model=SessionView)
def session(context: tuple[User, AuthSession] = Depends(session_context)):
    user, auth = context
    return {"user": user, "csrf": auth.csrf, "expires_at": auth.expires_at}


@router.post("/logout", response_model=Message)
def logout(
    response: Response,
    context: tuple[User, AuthSession] = Depends(session_context),
    db: Session = Depends(get_db),
):
    db.delete(context[1])
    db.commit()
    response.delete_cookie("clockin_session", path="/")
    return {"message": "Signed out"}


@router.post("/reauthenticate", response_model=Message)
def reauthenticate(
    data: PasswordInput,
    request: Request,
    context: tuple[User, AuthSession] = Depends(session_context),
    db: Session = Depends(get_db),
):
    user, auth = context
    throttle(db, "reauth:" + user.id + client_ip(request), 10)
    if not verify(user.password_hash, data.password):
        raise HTTPException(401, "INVALID_CREDENTIALS: Password verification failed")
    auth.elevated_until = now() + timedelta(minutes=15)
    db.commit()
    return {"message": "Administrative access confirmed for 15 minutes"}


@router.post("/activate", response_model=Message)
def activate(data: Credentials, request: Request, db: Session = Depends(get_db)):
    return complete(data, "activation", request, db)


@router.post("/recovery/complete", response_model=Message)
def recovery_complete(data: Credentials, request: Request, db: Session = Depends(get_db)):
    return complete(data, "recovery", request, db)


def complete(data: Credentials, purpose: str, request: Request, db: Session):
    require_origin(request)
    throttle(db, "challenge:" + client_ip(request), 20)
    link = db.scalar(select(Challenge).where(Challenge.id == digest(data.token)).with_for_update())
    if not link or link.purpose != purpose or link.used_at or utc(link.expires_at) <= now():
        raise HTTPException(400, "INVALID_TOKEN: Link is invalid, expired, or already used")
    user = db.scalar(select(User).where(User.id == link.user_id).with_for_update())
    if not user or not user.active or (purpose == "activation" and user.password_hash):
        raise HTTPException(400, "INVALID_TOKEN: Link cannot be used")
    user.password_hash, user.pin_hash = hasher.hash(data.password), hasher.hash(data.pin)
    user.pin_failures, user.pin_locked_until, link.used_at = 0, None, now()
    revoke(db, user.id)
    for pending in db.scalars(
        select(Challenge).where(Challenge.user_id == user.id, Challenge.used_at.is_(None))
    ):
        pending.used_at = now()
    log_event(db, user, "auth." + purpose, user.id, request=request)
    db.commit()
    return {"message": "Password and PIN saved. Sign in to continue."}


@router.post("/recovery/request", response_model=Message)
def recovery_request(data: EmailInput, request: Request, db: Session = Depends(get_db)):
    require_origin(request)
    throttle(db, "recovery-ip:" + client_ip(request), 10)
    throttle(db, "recovery-email:" + str(data.email).lower(), 3)
    if not settings().email_configured:
        raise HTTPException(
            503,
            "INTEGRATION_NOT_CONFIGURED: Email recovery is unavailable. Contact your administrator.",
        )
    user = db.scalar(
        select(User).where(User.email == str(data.email).lower(), User.active.is_(True))
    )
    if user and user.password_hash:
        token = challenge(db, user, "recovery")
        send_link(user.email, token, "recovery")
        log_event(db, user, "auth.recovery_requested", user.id, request=request)
        db.commit()
    return {"message": "If an eligible account exists, recovery instructions have been requested."}


@router.post("/pin", response_model=Message)
def change_pin(
    data: PinChange,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    throttle(db, "pin-change:" + user.id, 10)
    if not verify(user.password_hash, data.password):
        raise HTTPException(401, "INVALID_CREDENTIALS: Password verification failed")
    locked = db.scalar(select(User).where(User.id == user.id).with_for_update())
    assert locked
    user = locked
    user.pin_hash, user.pin_failures, user.pin_locked_until = hasher.hash(data.pin), 0, None
    revoke(db, user.id)
    log_event(db, user, "auth.pin_changed", user.id, request=request)
    db.commit()
    return {"message": "PIN updated. Sign in again."}
