"""Private operator authorization; never changes local application configuration."""

import argparse
import json
import logging
import os
import subprocess
from pathlib import Path

from email_validator import validate_email
from google_auth_oauthlib.flow import InstalledAppFlow

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tmp" / "gmail-production.env"
SCOPE = "https://www.googleapis.com/auth/gmail.send"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--client-json", required=True, type=Path)
    parser.add_argument("--sender", required=True)
    args = parser.parse_args()
    sender = validate_email(args.sender, check_deliverability=False).normalized
    if OUTPUT.exists():
        raise ValueError("Private output already exists; preserve or remove it before setup")
    ignored = subprocess.run(["git", "check-ignore", "--quiet", str(OUTPUT)], cwd=ROOT, check=False)
    if ignored.returncode != 0:
        raise ValueError("Private output must be ignored by Git")
    client = json.loads(args.client_json.read_text(encoding="utf-8-sig"))
    installed = client.get("installed", {})
    if (
        installed.get("auth_uri") != "https://accounts.google.com/o/oauth2/auth"
        or installed.get("token_uri") != "https://oauth2.googleapis.com/token"
    ):
        raise ValueError("Use an official Google Desktop app OAuth client JSON")
    logging.disable(logging.CRITICAL)
    flow = InstalledAppFlow.from_client_config(
        client, scopes=[SCOPE], autogenerate_code_verifier=True
    )
    print("Authorize your sender account in the browser. No password or code is printed.")
    credentials = flow.run_local_server(
        host="127.0.0.1",
        port=0,
        open_browser=True,
        timeout_seconds=300,
        authorization_prompt_message="",
        success_message="Gmail authorization completed. You may close this tab.",
        prompt="consent",
        login_hint=sender,
    )
    if not credentials.refresh_token:
        raise ValueError("Google did not issue offline authorization")
    if credentials.granted_scopes and SCOPE not in credentials.granted_scopes:
        raise ValueError("Send permission was not granted")
    values = {
        "EMAIL_PROVIDER": "gmail_api",
        "GMAIL_CLIENT_ID": credentials.client_id,
        "GMAIL_CLIENT_SECRET": credentials.client_secret,
        "GMAIL_REFRESH_TOKEN": credentials.refresh_token,
        "GMAIL_SENDER": sender,
    }
    OUTPUT.parent.mkdir(exist_ok=True)
    descriptor = os.open(OUTPUT, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        for key, value in values.items():
            stream.write(f"{key}={json.dumps(value)}\n")
    print(f"Private production settings saved to {OUTPUT}. Do not share or commit them.")
    print("Copy these five values into Render Environment, then deploy the approved code.")
    print("Local .env files are unchanged. No email was sent by this command.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Setup failed ({type(error).__name__}); no credential details printed.")
        raise SystemExit(1) from None
