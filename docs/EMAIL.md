# Account email delivery

Local development retains SMTP. Render Free blocks SMTP ports 25, 465 and 587.
Use Gmail API over HTTPS there; an app password cannot authorize Gmail API.

## Private setup

1. Enable **Gmail API** in the existing Google Cloud project. Do not start a paid trial
   or change billing for this setup.
2. Configure Google Auth Platform branding/audience and request only
   `https://www.googleapis.com/auth/gmail.send`. This permits sending, not reading mail.
   For External apps in Testing, add the sender as a test user. Gmail-scope refresh tokens
   expire after seven days in Testing. For ongoing use, move to Production and complete
   any Google verification requirements applicable to your use. Publishing and verification
   are separate; an unverified warning or user cap may apply. Do not bypass blocked consent.
3. Create an OAuth client of type **Desktop app**, named **Virtue ClockIn Mail Setup**.
   This is a one-time operator utility, not employee Google sign-in. Download its JSON
   outside the repository, for example Downloads. Keep its contents private.
4. Run from `backend/`:

   ```powershell
   uv sync --group mail-setup
   uv run --group mail-setup python ../scripts/setup-gmail.py --client-json "C:/path/to/client.json" --sender "your-sender@gmail.com"
   ```

5. Sign in and approve send-only access privately. The command uses PKCE/state and a
   temporary loopback callback, with a five-minute timeout. It writes only to Git-ignored
   `tmp/gmail-production.env`, without printing secrets, changing local `.env` or sending mail.
6. Set these values privately in **Render → Environment**, then deploy approved backend code:

   | Variable | Value |
   | --- | --- |
   | `EMAIL_PROVIDER` | `gmail_api` |
   | `GMAIL_CLIENT_ID` | Authorized OAuth client ID |
   | `GMAIL_CLIENT_SECRET` | Private client secret |
   | `GMAIL_REFRESH_TOKEN` | Private offline send authorization |
   | `GMAIL_SENDER` | Address of the Gmail account you authorized |

   Keep credentials out of Netlify browser variables, chat and GitHub. Preserve the exact
   Netlify `APP_BASE_URL` for account links. Remove the private output when no longer needed.
7. Verify an activation/recovery email for a consenting recipient. Gmail acceptance does
   not guarantee inbox placement; check Spam and Gmail Sent. Setup itself sends nothing.

## Behavior

The selected provider must be fully configured. Gmail mode never silently falls back to
SMTP. Existing single-use, 30-minute account links remain unchanged. Access tokens refresh
server-side using private credentials, with bounded network timeouts. Send requests are not
automatically replayed after ambiguous failures. Provider error details, tokens, recipients
and message bodies are not logged or returned. Missing configuration and delivery failures
remain distinct errors.

Revoked consent, testing-token expiration, Gmail quotas, disabled APIs and Google policies
can interrupt delivery. Reauthorize privately when needed; no unlimited sending or indefinite
token validity is promised. Revoke any app password exposed in chat; Gmail API does not use it.

References: [Gmail sending](https://developers.google.com/workspace/gmail/api/guides/sending),
[installed-app OAuth](https://developers.google.com/identity/protocols/oauth2/native-app),
[token expiration](https://developers.google.com/identity/protocols/oauth2#expiration),
[Render Free](https://render.com/docs/free).
