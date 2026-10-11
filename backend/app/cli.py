"""Operator commands never create demonstration data or shared default credentials."""

import argparse
import getpass

from pydantic import EmailStr, TypeAdapter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import engine
from app.models import User
from app.passwords import password_strength
from app.security import hasher, lock
from app.services import apply_grace_policy, apply_working_hours_policy, log_event, challenge


def main():
    parser = argparse.ArgumentParser(description="Virtue ClockIn secure local operator")
    sub = parser.add_subparsers(dest="command", required=True)
    first = sub.add_parser("bootstrap", help="Create the first real Super Administrator")
    first.add_argument("--email", required=True)
    first.add_argument("--name", required=True)
    reset = sub.add_parser(
        "replace-accounts",
        help="Delete all accounts and linked attendance/history; create a fresh Super Admin",
    )
    reset.add_argument("--email", required=True)
    reset.add_argument("--name", required=True)
    reset.add_argument("--reason", required=True)
    reset.add_argument("--confirm-delete-existing-accounts", action="store_true")
    link = sub.add_parser(
        "issue-link", help="Issue a real account's local activation/recovery link"
    )
    link.add_argument("--email", required=True)
    policy = sub.add_parser(
        "apply-attendance-policy",
        help="Recalculate saved lateness using the current grace period",
    )
    policy.add_argument("--reason", required=True)
    hours = sub.add_parser(
        "apply-working-hours-policy",
        help="Apply the one-hour expected-hours deduction to existing records",
    )
    hours.add_argument("--reason", required=True)
    sub.add_parser(
        "import-holidays-2026", help="Import the supplied Virtue 2026 office/optional holiday list"
    )
    args = parser.parse_args()
    if args.command == "replace-accounts":
        from app.account_reset import replace_accounts

        if settings().app_env != "development":
            parser.error("Account replacement is available only in local development")
        if not args.confirm_delete_existing_accounts:
            parser.error("Pass --confirm-delete-existing-accounts to authorize permanent deletion")
        email = str(TypeAdapter(EmailStr).validate_python(args.email)).lower()
        with Session(engine()) as db:
            try:
                _, token, count = replace_accounts(db, email, args.name, args.reason)
                db.commit()
            except ValueError as exc:
                parser.error(str(exc))
        print(
            f"Deleted {count} accounts and their linked records. New Super Admin awaits activation."
        )
        print(
            f"Private activation link (30 minutes): {settings().app_base_url}/activate#token={token}"
        )
        return
    if args.command == "apply-working-hours-policy":
        with Session(engine()) as db:
            count = apply_working_hours_policy(db, args.reason)
            db.commit()
        print(
            f"Updated expected working hours for {count} recorded days. Punches and actual hours preserved."
        )
        return
    if args.command == "import-holidays-2026":
        from app.company_calendar import import_2026

        with Session(engine()) as db:
            try:
                count = import_2026(db)
                db.commit()
            except ValueError as exc:
                parser.error(str(exc))
        print(f"Imported {count} calendar dates; matching entries preserved.")
        return
    if args.command == "apply-attendance-policy":
        with Session(engine()) as db:
            count = apply_grace_policy(db, args.reason)
            db.commit()
        print(
            f"Applied the current attendance grace policy to {count} recorded days. "
            "Punches preserved."
        )
        return
    email = str(TypeAdapter(EmailStr).validate_python(args.email)).lower()
    with Session(engine()) as db:
        lock(db, "bootstrap")
        if args.command == "bootstrap":
            if db.scalar(select(User)):
                parser.error("Bootstrap is permitted only for an empty user table")
            password = getpass.getpass("New administrator password: ")
            print(f"Password strength: {password_strength(password)} (advisory)")
            confirmation = getpass.getpass("Confirm password: ")
            if not password:
                parser.error("Password is required")
            if len(password) > 256:
                parser.error("Password exceeds the supported maximum of 256 characters")
            if password != confirmation:
                parser.error("Passwords must match")
            pin = getpass.getpass("New six-digit PIN: ")
            if (
                len(pin) != 6
                or not pin.isascii()
                or not pin.isdigit()
                or pin != getpass.getpass("Confirm PIN: ")
            ):
                parser.error("PINs must match and contain exactly six ASCII digits")
            user = User(
                email=email,
                name=args.name,
                role="super_admin",
                password_hash=hasher.hash(password),
                pin_hash=hasher.hash(pin),
            )
            db.add(user)
            db.flush()
            log_event(db, user, "operator.bootstrap", user.id)
            db.commit()
            print("Administrator created. Sign in and configure your organization and office.")
        else:
            if settings().app_env == "production":
                parser.error(
                    "Local link output is disabled in production; configure email delivery"
                )
            existing_user = db.scalar(
                select(User).where(User.email == email, User.active.is_(True))
            )
            if not existing_user:
                parser.error("Active account not found")
            user = existing_user
            purpose = "recovery" if user.password_hash else "activation"
            token = challenge(db, user, purpose)
            log_event(db, user, "operator.link_issued", user.id, reason=purpose)
            db.commit()
            path = "reset-password" if purpose == "recovery" else "activate"
            print(
                f"Private single-use link (expires in 30 minutes): {settings().app_base_url}/{path}#token={token}"
            )


if __name__ == "__main__":
    main()
