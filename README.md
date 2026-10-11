# Virtue ClockIn

Local-first employee attendance with a dark charcoal/cyan interface, 16 primary pages, Next.js, FastAPI and PostgreSQL. No Docker, default accounts or fabricated application data.

## Start locally

Prerequisites: Node.js 22+, pnpm 11.25+, Python 3.12+, uv, and PostgreSQL 16+. Ensure their executables are on PATH.

1. Provision your own empty PostgreSQL database and restricted application user. Do not use the isolated test cluster for company data.
2. Copy `backend/.env.example` to `backend/.env`; enter your real `DATABASE_URL` using the `postgresql+psycopg://` scheme. Keep credentials private.
3. In `backend/`, run `uv sync --frozen` and `uv run alembic upgrade head`.
4. Run `uv run python -m app.cli bootstrap --email YOUR_EMAIL --name YOUR_NAME`. Enter your own password and six-digit PIN at the hidden prompts. Bootstrap works only on an empty user table.
5. Start the API: `uv run uvicorn app.main:app --host 127.0.0.1 --port 8000`.
6. In `frontend/`, run `pnpm install --frozen-lockfile`, then `pnpm dev`. Open [local ClockIn](http://localhost:3000).
7. Sign in. Configure your real organization/office in System settings; create shifts and employees; assign effective shifts.
   Office location is selected on Google Maps. Follow [Google Maps setup](docs/GOOGLE_MAPS.md) to enable the picker and address search with your restricted browser key and JavaScript map ID.
8. Without SMTP, issue each real employee's private activation link using `uv run python -m app.cli issue-link --email THEIR_EMAIL`. Links expire in 30 minutes. Employees choose their own password and PIN.

Both **localhost:3000** and **127.0.0.1:3000** work locally. The frontend uses the same loopback hostname for API requests; development/test CORS and CSRF accept both aliases of the configured local origin. Cookies are separate for each hostname, so sign in again when switching between them. Production accepts only the configured origin. Restart the API after environment changes; rebuild/restart the frontend after changing its public API URL.

Windows convenience launchers: run `./scripts/start-backend.ps1` and `./scripts/start-frontend.ps1` in separate terminals after setup.

Phone/LAN access: the launchers expose the application on the computer's private network address and print the phone URL. Open it from the same Wi-Fi; never use localhost on the phone. See [phone access, firewall and HTTPS setup](docs/PHONE_ACCESS.md). Mobile punches require trusted HTTPS and the normal office verification rules.

On Windows where Application Control blocks SQLAlchemy extensions, first set `$env:DISABLE_SQLALCHEMY_CEXT_RUNTIME='1'` to use its supported pure-Python implementation.

## Structure and checks

`frontend/` contains UI/features/tests; `backend/app/` contains API modules, pure domain rules and operator CLI; `backend/alembic/` owns migrations. `contracts/openapi.json` generates frontend API types. `docs/` contains decisions and deployment instructions.

Backend: `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy app`, `uv run pytest`.
Frontend: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

Set `TEST_DATABASE_URL` to a **dedicated PostgreSQL database with test in its name** for integration tests. Each test creates and drops its own schema. Without it, PostgreSQL tests explicitly skip. For browser tests, set the same variable, run `pnpm exec playwright install chromium` and `pnpm test:e2e` in `frontend/`; ports 3000/8000 must be free. Synthetic browser fixtures exist only inside the isolated test schema.

After API changes, run `scripts/export_contract.py` using the backend Python, then `pnpm contracts` in `frontend/`. CI checks drift; never manually edit generated types.

## Boundaries

All shifts use an inclusive 20-minute Punch In grace period: for an 8:00 AM start, 8:20 AM is on time and anything later is late. Net and Expected hours display as `7h 36min` in records and CSV exports. Manual correction, requests and approvals are unavailable; historical records remain intact.

After upgrading an existing database, run `uv run python -m app.cli apply-attendance-policy --reason "Apply approved 20-minute lateness grace"` in backend/ before starting the API. The idempotent command recalculates saved late classifications and monthly counts with internal operational logging, preserving original punch times.

One organization/office; Employee, Admin, Super Administrator. Local email/password and email/six-digit employee-chosen PIN login. Privileged admin access requires recent password confirmation. SMTP is optional; Microsoft SSO, Manager delegation, app-managed MFA, multi-office, payroll and scheduled reminders are deferred and shown unavailable.

See [deployment runbook](docs/DEPLOYMENT.md), [accepted decisions](docs/DECISIONS.md) and [task status](TASKS.md). `Abstract.md` is the unchanged original reference.

## Schedule-derived daily statuses

Calendar/history/report responses also calculate absent (only after shift end), approved leave, weekly off, holiday, scheduled and not-started statuses from actual account, shift, calendar and historical approved-request data. These rows are labelled schedule-derived, leave punch timestamps blank, and create no synthetic database events. Projections are recalculated from current schedule settings; recorded attendance retains its historical snapshot. Inactive accounts receive no inferred absence without access-history evidence.

Attendance histories, admin records and CSV exports exclude weekly-off placeholder rows before pagination. Calendars retain the weekly-off schedule; actual punches on an off day remain visible as worked attendance. Status dropdown choices are Present, Late and Work from home. Department functionality, public DTO fields and filter parameters are removed; legacy database references remain preserved without active APIs.

Dates display as DD-Mmm-YYYY and record navigation uses arrow controls only when required. Visible clocks are synchronised with the backend in the office timezone. Punch timestamps already come from the backend, never from client-supplied dates. The backend host must have trusted OS time synchronisation; a local backend remains dependent on this computer's system clock.

Security & Audit and My Notes are retired from both workspaces and the API. Historical database tables remain untouched; no active note or database audit operations remain. Internal rotating JSON logs live in backend/logs/clockin.log; see backend/logs/README.md. Attendance/report toolbars use independent Start date and End date calendar boxes separated by 'to'.

## Employee-scoped calendar and administrator workspace

Administrators manage workforce records, schedules, attendance, settings and reports; employee attendance pages redirect them to the admin dashboard and employee attendance/punch APIs reject administrator roles. Only the header sign-out is shown for admins. Integration readiness and Microsoft sign-in mentions are removed from the running application and public contracts.

Admin calendar controls occupy the left half and the calendar the right half on desktop. Entries use Date, Holiday/Work from home and Employee (including All employees). One entry exists per date/scope; individual entries take priority over organization-wide entries. Employees can read only their own and All employees entries. Administrators can save or remove entries; changes send in-app notifications.

Work from home dates prohibit Punch In and Punch Out. Attendance/history/reports/CSV and dashboard show Work from home; the status filter includes it. No measured work hours or punch events are invented. Existing punch data remains intact; calendar overlays change effective status/lateness and monthly late flags without rewriting originals. Removing an override restores the underlying records.

Migration 0004 creates calendar_entries, copies existing real holidays, and preserves the full legacy calendar_days table. Special-working-day controls and the old /holidays API are retired. New calendar endpoints are /api/v1/calendar-days and /api/v1/calendar-days/{entry_id}. Apply Alembic upgrade head before starting this API version. Downgrading removes the new table, so back up any newly created calendar entries first.


## 2026 holiday calendar and compact desktop layout (11-Oct-2026)

The administrator calendar uses compact controls and colored date dots, verified without page scrolling at 1280 x 720. Hover or keyboard focus shows the entry name, day type, All day, Office calendar and administrator employee scope. Gold marks holidays, purple marks optional working holidays, and cyan marks Work from home.

The supplied VIRTUE_HOLIDAY LIST.pdf was visually checked and imported through `python -m app.cli import-holidays-2026`: nine All-employees office holidays and five distinct optional working dates. Ugadi (20-Mar-2026) appears in both PDF lists; the user confirmed it remains an office holiday. Names and dates follow the PDF, including Hol and the two subject-to-the-moon notes; no external holiday-date corrections were applied. The PDF's optional two-day allowance is not an automatic leave rule: optional dates remain working days as requested, unless the administrator explicitly schedules an individual Holiday or Work from home override.

Optional holidays allow ordinary verified punches, maintain shift hours and 20-minute late rules, and do not excuse monthly late counts or replace real attendance status. They create no attendance projection when a shift is missing. Individual entries retain priority over All employees. The operator import is idempotent, preserves individual entries, refuses conflicting existing All-employees dates, and logs its committed changes internally. Original punch records remain intact.

Migration 0005 extends the calendar kind constraint. Downgrading requires resolving optional entries first; it deliberately refuses to discard them. The user-authorized local migration and import completed with 14 dates added.


## Simplified calendar and unified attendance (11-Oct-2026)

The calendar is a month grid with only previous/next month arrows and a centered heading. Before selection and after month navigation, the heading shows the month and year (October 2026). Selecting a grid date or using the date input changes it to the full date (21 October 2026). Today and month/week/day controls are removed. Holiday dots, hover/focus details, individual scopes and working optional dates remain supported.

Attendance is the single administrator records page. Its compact filter toolbar includes Export CSV, using the applied date range, employee and status across all matching records, independently of the current record page. Invalid date edits disable export until resolved. The separate Reports & analytics navigation item, screen and report-only charts are removed; /admin/reports returns 404. The existing protected CSV API is retained for compatibility, and employee export permissions are unchanged. No database migration or company-data changes are required for this UI consolidation.


## Current-date calendar opening and readable CSV durations (11-Oct-2026)

The calendar opens on the attendance server's current date in the office timezone, with that date selected and the full-date heading shown immediately (for example, 11 October 2026). Each new page visit fetches the current server date; it is not hardcoded or initialized to the first of the month. Saving a calendar entry preserves the selected date and employee. Previous/next month navigation continues to show the browsed month/year until a date is selected.

Attendance CSV now exports Net Hours and Expected Hours using the table's duration format, such as 7h 36min and 9h 0min. Corrected and Source columns are removed from the CSV. A Work from home entry without punches uses the same untracked net-hours dash as the table. Numeric minute storage, original attendance records, filter behavior and access permissions remain unchanged.


## Monthly Employee IDs and Date of Joining (11-Oct-2026)

New employee accounts require Date of Joining (DOJ). The backend generates YYMM-XXX from that joining date, with a monthly sequence: 2610-001, 2610-002, then 2611-001 for November. No manual ID or sequence-policy input is shown. The directory displays generated ID and DOJ in DD-Mmm-YYYY; edit shows the ID as text. Correcting DOJ or other employee details retains an already-assigned ID. Existing employees retain their legacy IDs and unknown joining dates stay unset until supplied.

Allocation uses a transaction-scoped PostgreSQL advisory lock per prefix, a persistent employee_id_counters row and the existing unique users.employee_code constraint. Existing matching IDs, including inactive employees, reserve their sequence numbers. Deactivation and promotion do not reuse allocated numbers. Concurrent successful hires receive distinct numbers; failed transactions roll back allocation. Once a month reaches 999, creation returns EMPLOYEE_ID_LIMIT rather than changing the three-digit format.

Assignable roles are Employee, Admin and Super Admin. Admin and Super Admin have the same management privileges, including office settings and administrative account management. Migration 0007 renames legacy HR roles to Admin and revokes those legacy sessions. All accounts have individual email/password/PIN credentials. Administrator accounts have no Employee ID or DOJ. The UI hides those fields for administrators, the API rejects administrative DOJ values, and the database requires administrator employee_code to be NULL. Administrators no longer need --employee-code during operator bootstrap. Original employee IDs and attendance references remain intact; UUIDs continue to identify users internally.

Migration 0006 adds nullable users.date_of_joining, makes employee_code nullable, seeds monthly counters from existing formatted IDs, clears administrator IDs and adds the administrator constraint. No joining dates are invented. Downgrading to a version requiring administrator employee IDs is deliberately refused while NULL IDs exist; use a verified backup if rolling back that schema change.

## Employee shift and account actions

Employee management shift assignment asks only for the shift. The server applies it from the current office-local date, or the joining date for a future hire, with no end date. It replaces current/future schedules while retaining prior assignment intervals and existing attendance snapshots. Office timezone configuration is required; no date is taken from the device.

Send Activation Link and Reset Password are separate buttons. Activation applies to active accounts awaiting initial setup; reset applies to active accounts that have already activated. The API enforces the same eligibility and administrator permissions. Both require configured email delivery and show an inline error when unavailable. The local operator issue-link command remains available without SMTP.


## Employee workspace updates

The employee directory shows the effective shift and AM/PM timings using the office date from the server. Future assignments show their start date. Administrator rows do not have shifts.

Employee sign-out is available once in the top header. Profile & Security offers Send recovery link for the signed-in employee's company email; the inline password/PIN change form is removed. Recovery retains the single-use password/PIN reset flow, with an explicit unavailable error when SMTP is not configured.

The employee calendar selected-date panel displays Punch In and Punch Out timestamps, or explicit not-punched messages. It does not display weekly-off/status/hour summaries. Attendance dots require an actual punch; configured holidays, optional working days and work-from-home entries keep their distinct markers. Weekly-off policy and attendance calculations remain unchanged. Employee attendance uses the same compact date-box/status toolbar style as administrator attendance.

## Current expected working-hours policy (11-Oct-2026)

Expected working hours equal the same-day assigned shift duration minus a fixed 60 minutes, floored at zero. 08:00 AM–05:00 PM gives 8h 0min; 09:00 AM–04:00 PM gives 6h 0min. This is a fixed expected-hours rule and does not introduce configurable break fields. Actual recorded work duration and the 20-minute late-arrival grace remain separate.

Shift API responses expose expected_working_minutes from the backend. Employee dashboard and calendar show Expected working hours; attendance and CSV use the corresponding expected_minutes in hours/minutes. Calendar holidays and weekly-off days retain zero expected attendance; work-from-home schedules retain the shift expectation without punch tracking. Recorded days retain their original shift times when assignments change.

New records use calculation version 3 and expected_deduction_minutes=60. Existing records can be updated once with `uv run python -m app.cli apply-working-hours-policy --reason "Company expected-hours rule"`. It recomputes expected hours from recorded shift times, retains approved legacy permissions, preserves original punches/actual totals/status/lateness, stores previous_expected_minutes and logs the operation. Repeating the command changes zero already-updated records. Historical actual-hour exclusions remain preserved; expected hours use the fixed one-hour rule.

## Three-role account management

Choose Employee, Admin or Super Admin when adding an account. Admin and Super Admin share management permissions and recent password reauthentication. Employee accounts alone receive a DOJ and generated Employee ID and can punch attendance. New accounts activate through single-use links and choose their own password and PIN; no credentials are shared between roles.

For an explicitly authorized local account replacement, stop the API and run from backend:

```powershell
uv run python -m app.cli replace-accounts --email "new-super-admin@example.com" --name "Account owner" --reason "Authorized local account replacement" --confirm-delete-existing-accounts
```

This development-only operator command permanently deletes existing accounts, sessions, account links and linked attendance/history, then creates one pending Super Admin and prints a private 30-minute activation link. It runs atomically and preserves organization/office settings, shift definitions, global calendar entries, existing log files and reserved monthly ID counters. It is not a web API. Restart the API and open the link to choose credentials privately. The issue-link command can reissue an expired activation link.
