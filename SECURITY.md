# Security and privacy

## Identity

Email plus a ClockIn password or an employee-chosen six-digit PIN. Employees select both during activation. This explicitly supersedes the earlier WebAuthn/device-bound design. PIN login requires no enrolled device and has lower guessing resistance than a strong password.

Passwords and six-digit ASCII PINs use separate salted Argon2id hashes. Passwords must be nonempty, with no minimum length policy; Weak, Medium and Strong feedback is advisory and does not block selection. A 256-character maximum bounds input processing. Leading zeros are preserved. Five failed PIN attempts lock PIN authentication for 15 minutes; password login remains available. Database-backed IP/account throttles also protect login, recovery, reauthentication and punches.

Opaque eight-hour sessions are stored hashed; cookies are HttpOnly, SameSite=Lax and Secure in production. Administrative access requires password confirmation within 15 minutes, even after PIN login. Deactivation and credential changes revoke sessions. Activation/recovery links are random, hashed, single-use and expire in 30 minutes. Issuing another invalidates previous links.

Public recovery gives a neutral acknowledgement when configured. Missing SMTP is explicitly unavailable. Private operator-issued links are local-only; production link printing is disabled. Credentials and tokens are excluded from internal operational logs.

## Authorization and requests

Backend roles: Employee, Admin, Super Administrator. Admin and Super Admin have equal access to account management, shifts, attendance, calendar, exports and office settings. Both can create and manage Employee, Admin and Super Admin accounts. Both must reauthenticate with a password for administrative operations; neither may deactivate or demote their own account. Attendance, calendar and notifications are owner-scoped. Self-deactivation/demotion is forbidden.

Mutations require an exact allowed Origin and a session CSRF token. Login, activation and recovery also validate Origin. CORS permits only the configured frontend. Public API errors omit stack traces and submitted secret values.

## Attendance and internal logging

Server timestamps for ordinary punches. PostgreSQL triggers reject updates/deletes of original attendance events. User-row locking and daily/idempotency uniqueness protect concurrent writes. Security & Audit and My Notes pages/APIs are retired; legacy tables are preserved without active reads/writes. Operational logs are stored in backend/logs/clockin.log, never exposed through an API.

Server-observed IP must match approved CIDRs. Forwarded headers are honored only behind explicit trusted proxies. Geolocation must pass both accuracy and radius checks; distance plus reported uncertainty must fit inside the geofence. Evidence stores verification outcome, accuracy and distance, rather than raw coordinates. No continuous tracking.

Browser location can be spoofed; network access cannot prove continuous presence. Desktop attendance restrictions are UX heuristics, not hardware/device attestation.

## Production gate

HTTPS, secure cookies, tested same-site domains or an explicit same-origin proxy, least-privilege PostgreSQL access, TLS, private SMTP credentials, backups and restore verification. Approve retention and cleanup policies, conduct a security review, add monitoring and incident procedures before production. Microsoft SSO, WebAuthn and app-managed MFA are deferred, not active protections.

Browser clock changes do not control punch timestamps; extra client timestamp fields are rejected. Punch date and time derive from one backend UTC instant. A local backend shares its computer's system clock: an operator who changes that host clock can affect records. Deploy on a separate access-controlled server with trusted OS time synchronisation and monitoring for clock drift. UI server synchronisation does not attest external NTP accuracy; no third-party time API is claimed.

## Employee-scoped calendar and administrator workspace

Administrators manage workforce records, schedules, attendance, settings and reports; employee attendance pages redirect them to the admin dashboard and employee attendance/punch APIs reject administrator roles. Only the header sign-out is shown for admins. Integration readiness and Microsoft sign-in mentions are removed from the running application and public contracts.

Admin calendar controls occupy the left half and the calendar the right half on desktop. Entries use Date, Holiday/Work from home and Employee (including All employees). One entry exists per date/scope; individual entries take priority over organization-wide entries. Employees can read only their own and All employees entries. Administrators can save or remove entries; changes send in-app notifications.

Work from home dates prohibit Punch In and Punch Out. Attendance/history/reports/CSV and dashboard show Work from home; the status filter includes it. No measured work hours or punch events are invented. Existing punch data remains intact; calendar overlays change effective status/lateness and monthly late flags without rewriting originals. Removing an override restores the underlying records.

Migration 0004 creates calendar_entries, copies existing real holidays, and preserves the full legacy calendar_days table. Special-working-day controls and the old /holidays API are retired. New calendar endpoints are /api/v1/calendar-days and /api/v1/calendar-days/{entry_id}. Apply Alembic upgrade head before starting this API version. Downgrading removes the new table, so back up any newly created calendar entries first.

Activation and password-reset administration are separate operations. Activation links require an active, unactivated account; recovery links require an active, activated account. Both preserve single-use link handling, existing role restrictions and recent password confirmation. Failed email delivery rolls back link issuance and is never reported as sent.

Activation and recovery tokens are read automatically from the private link fragment, retained only in component memory for submission, and removed from the address bar. There is no token entry or visibility control. Opening these pages without a link disables submission and explains how to obtain a complete link; users must reopen the original link after a full page reload. Backend expiration and single-use checks remain authoritative.
