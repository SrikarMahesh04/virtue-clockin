# Testing and verification

Production paths contain no demo seeds or fabricated data. Synthetic fixtures are allowed only in dedicated test schemas.

## Backend

From backend/: `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy app`, `uv run pytest`.

Set TEST_DATABASE_URL to a dedicated PostgreSQL database whose name contains test. Each integration test creates a fresh schema, applies Alembic twice to verify safe reruns and drops that schema afterward. Missing configuration skips PostgreSQL tests explicitly. Never point this variable at the real company database.

Coverage includes full shift totals, partial working intervals and preserved historical calculations, inclusive 20-minute grace boundaries (exactly 20 minutes on time, one second later late), secondary/new shifts, logged saved-record policy updates, retired correction/request/review endpoints, removed request routes and dashboard/calendar fields, historical merged permissions and leave conflicts, liveness versus readiness, PIN leading zeros/lockout, password fallback, CSRF/Origin rejection, recovery replay/session revocation, role restrictions, deactivation, punch ordering/idempotency/network failures, simultaneous punches, retroactive late-flag recalculation, password admin elevation and safe CSV cells.

## Frontend and browser

From frontend/: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

Vitest checks distinct error/empty/success states, text status labels and modal focus/Escape cleanup. Run `pnpm exec playwright install chromium` then `pnpm test:e2e` with TEST_DATABASE_URL set. Ports 3000 and 8000 must be free. The browser test server creates synthetic accounts only in an isolated PostgreSQL schema, runs the actual API, and cleans it on graceful shutdown.

Playwright covers PIN login, verified Punch In/Out, calendar/notifications, all admin routes, real employee creation, CSV download, activation with a leading-zero PIN, unavailable SMTP and keyboard focus. API responses are not mocked.

## Contract and production

Run scripts/export_contract.py --check using backend Python; regenerate and compare frontend types. CI runs backend/frontend/browser gates against a dedicated PostgreSQL service, without Docker deployment dependencies.

Before production, verify real office geolocation/network behavior, trusted proxy spoof protection, actual email delivery, supported browser/desktop behavior, dark-theme contrast, backup restoration, monitoring and privacy/retention requirements. Browser location cannot establish continuous presence or managed-device identity.

## Schedule-derived daily statuses

Calendar/history/report responses also calculate absent (only after shift end), approved leave, weekly off, holiday, scheduled and not-started statuses from actual account, shift, calendar and approved-request data. These rows are labelled schedule-derived, leave punch timestamps blank, and create no synthetic database events. Projections are recalculated from current schedule settings; recorded attendance retains its historical snapshot. Inactive accounts receive no inferred absence without access-history evidence.

Attendance histories, admin records and CSV exports exclude weekly-off placeholder rows before pagination. Calendars retain the weekly-off schedule; actual punches on an off day remain visible as worked attendance. Status dropdown choices are Present, Late and Work from home. Department functionality, public DTO fields and filter parameters are removed; legacy database references remain preserved without active APIs.

Time/date checks include rejection of client punch timestamps, a single server date/time instant, changed browser wall clock, monotonic display time, unavailable/stale synchronisation, leap-day/date validation, ISO form submission with DD-Mmm-YYYY display, and responsive arrow pagination with no single-page controls.

Security & Audit and My Notes are retired from both workspaces and the API. Historical database tables remain untouched; no active note or database audit operations remain. Internal rotating JSON logs live in backend/logs/clockin.log; see backend/logs/README.md. Attendance/report toolbars use independent Start date and End date calendar boxes separated by 'to'.

## Employee-scoped calendar and administrator workspace

Administrators manage workforce records, schedules, attendance, settings and reports; employee attendance pages redirect them to the admin dashboard and employee attendance/punch APIs reject administrator roles. Only the header sign-out is shown for admins. Integration readiness and Microsoft sign-in mentions are removed from the running application and public contracts.

Admin calendar controls occupy the left half and the calendar the right half on desktop. Entries use Date, Holiday/Work from home and Employee (including All employees). One entry exists per date/scope; individual entries take priority over organization-wide entries. Employees can read only their own and All employees entries. Administrators can save or remove entries; changes send in-app notifications.

Work from home dates prohibit Punch In and Punch Out. Attendance/history/reports/CSV and dashboard show Work from home; the status filter includes it. No measured work hours or punch events are invented. Existing punch data remains intact; calendar overlays change effective status/lateness and monthly late flags without rewriting originals. Removing an override restores the underlying records.

Migration 0004 creates calendar_entries, copies existing real holidays, and preserves the full legacy calendar_days table. Special-working-day controls and the old /holidays API are retired. New calendar endpoints are /api/v1/calendar-days and /api/v1/calendar-days/{entry_id}. Apply Alembic upgrade head before starting this API version. Downgrading removes the new table, so back up any newly created calendar entries first.

## Current expected working-hours policy (11-Oct-2026)

Expected working hours equal the same-day assigned shift duration minus a fixed 60 minutes, floored at zero. 08:00 AM–05:00 PM gives 8h 0min; 09:00 AM–04:00 PM gives 6h 0min. This is a fixed expected-hours rule and does not introduce configurable break fields. Actual recorded work duration and the 20-minute late-arrival grace remain separate.

Shift API responses expose expected_working_minutes from the backend. Employee dashboard and calendar show Expected working hours; attendance and CSV use the corresponding expected_minutes in hours/minutes. Calendar holidays and weekly-off days retain zero expected attendance; work-from-home schedules retain the shift expectation without punch tracking. Recorded days retain their original shift times when assignments change.

New records use calculation version 3 and expected_deduction_minutes=60. Existing records can be updated once with `uv run python -m app.cli apply-working-hours-policy --reason "Company expected-hours rule"`. It recomputes expected hours from recorded shift times, retains approved legacy permissions, preserves original punches/actual totals/status/lateness, stores previous_expected_minutes and logs the operation. Repeating the command changes zero already-updated records. Historical actual-hour exclusions remain preserved; expected hours use the fixed one-hour rule.
