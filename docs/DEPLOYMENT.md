# Integration and deployment runbook

## Local acceptance

Follow README: create your own PostgreSQL database, migrate, bootstrap a real administrator, start API/UI, configure the actual office, create employees and assign shifts. Without SMTP, use the local operator link command; employees set their own password/PIN. Do not copy isolated test credentials, zero coordinates or test networks into company settings.

## Hosting decision

Keep frontend and FastAPI separately deployable. Evaluate Vercel for Next.js and either a supported Python runtime or a Docker-free managed Python host. This implementation creates no paid resources or production deployment.

Choose HTTPS same-site application/API domains or an explicit same-origin proxy. Validate cookies, CORS and CSRF on exact final origins. Unrelated hosting domains may break cookie authentication. Verify trusted proxies and how the API sees actual employee office egress IP; never trust arbitrary forwarded headers.

## Company integration checklist

- [ ] Provision managed PostgreSQL, private least-privilege credentials, TLS, pooling, backups and tested restore.
- [ ] Set production origins, COOKIE_SECURE=true, and secret-managed SMTP credentials/sender.
- [ ] Verify email activation/recovery, expiration, replay and provider failure behavior.
- [ ] Enter actual timezone, office coordinates, accuracy/radius and office network CIDRs; verify on office laptops.
- [ ] Enter approved shift timings, weekly offs, holidays and effective employee assignments.
- [ ] Verify the supplied company logo and approve the dark-theme interface; no company favicon is configured.
- [ ] Approve privacy notice, data retention/cleanup, security review, monitoring and incident procedure.
- [ ] Add a scheduler only when implementing scheduled reminders; current UI reports it unavailable.
- [ ] Smoke test with authorized real users: login, office checks, punches, attendance filters, exports and deactivation.

Microsoft SSO, Manager delegation, payroll, multi-office and app-managed MFA are future changes.

## Release

Back up and test migrations in staging. Deploy reviewed compatible Alembic migrations, then run the apply-attendance-policy operator command documented in README before starting the updated API. This idempotent command updates saved late classifications and monthly flags with internal logs while preserving punch times. Deploy API and frontend compiled against the same contract. Verify health/readiness and authorized real attendance flows. Roll back compatible application versions if needed; database restoration/downgrade is an explicit operator task. Do not casually run destructive production downgrades.

## Authoritative attendance time

Before acceptance, configure and verify the backend host's operating-system time synchronisation against the company-approved source; monitor offset/drift and limit clock-change privileges. A separately hosted backend prevents employees' computer clock settings from affecting server punches. An API hosted on the same local computer remains dependent on that computer's clock. This change does not configure or certify NTP. The read-only Windows time-service status check on this workstation was denied; an authorised operator must verify it.

Security & Audit and My Notes have been removed from active pages, navigation, APIs and DTOs. Historical tables remain preserved; no new note/audit database records are written. Operators inspect private rotating JSON logs at backend/logs/clockin.log (5 MB per file, three backups). No log-reading API is exposed.
