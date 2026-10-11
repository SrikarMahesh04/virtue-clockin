"""Server-only delivery. Never log OAuth credentials, recipients or message bodies."""

import base64
import json
import smtplib
import ssl
from email.message import EmailMessage
from typing import Any
from urllib.request import Request as HttpRequest
from urllib.request import urlopen

from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

from app.core.config import Settings

GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"


class EmailDeliveryError(Exception):
    """A safe error with no provider response, credential or message attached."""


class _TimedRequest(Request):
    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        kwargs["timeout"] = 15
        return super().__call__(*args, **kwargs)


def deliver_email(message: EmailMessage, config: Settings) -> None:
    try:
        if config.email_provider == "gmail_api":
            _send_gmail(message, config)
        else:
            with smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=15) as smtp:
                if config.smtp_starttls:
                    smtp.starttls(context=ssl.create_default_context())
                if config.smtp_username:
                    smtp.login(config.smtp_username, config.smtp_password)
                smtp.send_message(message)
    except (OSError, smtplib.SMTPException, GoogleAuthError, ValueError, KeyError):
        # Do not expose provider errors: they can include credentials or account links.
        raise EmailDeliveryError("Email delivery failed") from None


def _send_gmail(message: EmailMessage, config: Settings) -> None:
    credentials = Credentials(
        token=None,
        refresh_token=config.gmail_refresh_token.get_secret_value(),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=config.gmail_client_id,
        client_secret=config.gmail_client_secret.get_secret_value(),
        scopes=[GMAIL_SEND_SCOPE],
    )
    transport = _TimedRequest()
    try:
        credentials.refresh(transport)
    finally:
        transport.session.close()
    if not credentials.token:
        raise ValueError("Missing access token")
    payload = json.dumps(
        {"raw": base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")}
    ).encode("utf-8")
    request = HttpRequest(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        data=payload,
        headers={
            "Authorization": f"Bearer {credentials.token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    # Deliberately no send retry: an ambiguous timeout must not duplicate mail.
    with urlopen(request, timeout=15) as response:
        result = json.load(response)
    if not isinstance(result, dict) or not result.get("id"):
        raise ValueError("Missing delivery acknowledgement")
