import hashlib
import ipaddress
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.domain import utc
from app.models import AuthSession, RateLimit, User, now

hasher = PasswordHasher()
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def verify(encoded: str | None, value: str) -> bool:
    try:
        return hasher.verify(encoded or DUMMY_HASH, value) and bool(encoded)
    except (VerificationError, InvalidHashError):
        return False


def client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "127.0.0.1"
    trusted = [
        ipaddress.ip_network(v.strip())
        for v in settings().trusted_proxy_cidrs.split(",")
        if v.strip()
    ]
    try:
        if any(ipaddress.ip_address(peer) in net for net in trusted):
            chain = [
                v.strip()
                for v in request.headers.get("x-forwarded-for", "").split(",")
                if v.strip()
            ]
            for hop in reversed(chain):
                address = ipaddress.ip_address(hop)
                if not any(address in net for net in trusted):
                    return str(address)
    except ValueError:
        raise HTTPException(403, "NETWORK_INVALID: Invalid network provenance") from None
    return peer


def throttle(db: Session, key: str, maximum: int = 20) -> None:
    """DB-backed fixed window. Serialize each bucket with a PostgreSQL advisory lock."""
    bucket_id = digest(key)
    lock(db, bucket_id)
    bucket = db.get(RateLimit, bucket_id)
    instant = now()
    if not bucket:
        bucket = RateLimit(id=bucket_id, count=0, resets_at=instant + timedelta(minutes=15))
        db.add(bucket)
    elif utc(bucket.resets_at) <= instant:
        bucket.count = 0
        bucket.resets_at = instant + timedelta(minutes=15)
    bucket.count += 1
    denied = bucket.count > maximum
    db.commit()
    if denied:
        raise HTTPException(429, "RATE_LIMITED: Too many attempts. Try again later.")


def lock(db: Session, value: str) -> None:
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        from sqlalchemy import text

        key = int(digest(value)[:15], 16)
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": key})


def session_context(request: Request, db: Session = Depends(get_db)) -> tuple[User, AuthSession]:
    token = request.cookies.get("clockin_session", "")
    auth = db.get(AuthSession, digest(token)) if token else None
    user = db.get(User, auth.user_id) if auth else None
    if not auth or not user or not user.active or utc(auth.expires_at) <= now():
        raise HTTPException(401, "UNAUTHENTICATED: Sign in to continue")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        require_origin(request)
        if not secrets.compare_digest(request.headers.get("x-csrf-token", ""), auth.csrf):
            raise HTTPException(403, "CSRF_REJECTED: Session verification failed")
    return user, auth


def current_user(context: tuple[User, AuthSession] = Depends(session_context)) -> User:
    return context[0]


def employee_only(user: User = Depends(current_user)) -> User:
    if user.role != "employee":
        raise HTTPException(403, "FORBIDDEN: Attendance is available to employees only")
    return user


def admin(context: tuple[User, AuthSession] = Depends(session_context)) -> User:
    user, auth = context
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(403, "FORBIDDEN: Administrator access required")
    if not auth.elevated_until or utc(auth.elevated_until) <= now():
        raise HTTPException(403, "REAUTH_REQUIRED: Confirm your password to continue")
    return user


def revoke(db: Session, user_id: str) -> None:
    db.execute(delete(AuthSession).where(AuthSession.user_id == user_id))


def require_origin(request: Request) -> None:
    if request.headers.get("origin") not in settings().allowed_frontend_origins:
        raise HTTPException(403, "CSRF_REJECTED: Untrusted request origin")


def locked_user(db: Session, user_id: str) -> User:
    result = db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not result:
        raise HTTPException(404, "NOT_FOUND: Employee not found")
    return result
