# Technical requirements and implementation baseline

## Stack and boundaries

Next.js App Router, React, strict TypeScript, Tailwind and semantic accessible controls. FastAPI/Pydantic, SQLAlchemy 2.0, PostgreSQL, Alembic and Argon2id. pnpm/uv lock dependencies. No Docker. Browser renders API results; only the backend authorizes access, verifies attendance and calculates hours.

Pure interval math is separate from ORM/HTTP. API modules group identity, workforce, attendance and personal workflows, with shared security/application services. Avoid premature distributed services.

## Contracts

REST under `/api/v1`. FastAPI exports `contracts/openapi.json`; openapi-typescript generates `frontend/src/generated/schema.d.ts`; openapi-fetch uses these types. CSV is a credentialed download.

Errors: `{error:{code,message,details},request_id}`; HTTP 401/403/409/422/429/503 distinguish unauthenticated, forbidden, conflict, validation, throttling and unavailable dependencies. Responses are not cached. Attendance records use bounded limit/offset pagination; CSV is capped at 10,000 rows and date ranges at one year.

## Behavior

Local email/password or email/six-digit employee-chosen PIN. No device enrollment. Eight-hour revocable sessions, CSRF checks, 15-minute password elevation for administration, single-use activation/recovery and optional SMTP.

Same-day shifts, effective assignments, logged shift editing/status/deletion and per-day historical snapshots. Edits affect new snapshots; recorded days preserve their saved timings. Inactive/deleted shifts cannot be assigned or start new attendance days. Display times in explicit 12-hour AM/PM format independently of device preferences. Server-time punches, concurrent duplicate protection, incomplete days, full elapsed working duration, inclusive twenty-minute grace, fifth-late warning and sixth-late flag. Historical approved leave/permission data retains its calculation effect; request creation and review APIs are removed. Attendance during full-shift leave creates a reconciliation conflict.

Requests and approvals are unavailable at this stage; no leave-balance accounting or automatic payroll deductions. Calendar entries apply to employee/all-employee schedule projections. Holiday/Work from home entries overlay attendance response classifications; stored punch events and snapshots remain preserved. Removing an entry restores the underlying attendance view. Monthly late counts/flags are refreshed for affected employees.

## Operations

`/health` reports liveness; `/ready` requires a migrated PostgreSQL connection. Operator bootstrap works once on an empty user table. No runtime schema creation or application seeds. Hosting remains undecided until local acceptance; validate final cookie domains, forwarded-IP semantics, pooling, SMTP, migrations, backups and monitoring.

The authenticated /api/v1/time endpoint returns a non-cached server instant and office timezone. Visible clocks interpolate using performance.now(), resynchronise every minute/on resume and report unavailable after two minutes without a valid sample. Punch APIs accept no timestamps; the server captures one instant for the office-local date and original punch event. The host clock is a deployment trust dependency and must be synchronised using the operating system time service.

Security & Audit and My Notes are retired from both workspaces and the API. Historical database tables remain untouched; no active note or database audit operations remain. Internal rotating JSON logs live in backend/logs/clockin.log; see backend/logs/README.md. Attendance/report toolbars use independent Start date and End date calendar boxes separated by 'to'.


## Monthly Employee IDs and Date of Joining (11-Oct-2026)

New employee accounts require Date of Joining (DOJ). The backend generates YYMM-XXX from that joining date, with a monthly sequence: 2610-001, 2610-002, then 2611-001 for November. No manual ID or sequence-policy input is shown. The directory displays generated ID and DOJ in DD-Mmm-YYYY; edit shows the ID as text. Correcting DOJ or other employee details retains an already-assigned ID. Existing employees retain their legacy IDs and unknown joining dates stay unset until supplied.

Allocation uses a transaction-scoped PostgreSQL advisory lock per prefix, a persistent employee_id_counters row and the existing unique users.employee_code constraint. Existing matching IDs, including inactive employees, reserve their sequence numbers. Deactivation and promotion do not reuse allocated numbers. Concurrent successful hires receive distinct numbers; failed transactions roll back allocation. Once a month reaches 999, creation returns EMPLOYEE_ID_LIMIT rather than changing the three-digit format.

Assignable roles are Employee, Admin and Super Admin. Admin and Super Admin have the same management privileges, including office settings and administrative account management. Migration 0007 renames legacy HR roles to Admin and revokes those legacy sessions. All accounts have individual email/password/PIN credentials. Administrator accounts have no Employee ID or DOJ. The UI hides those fields for administrators, the API rejects administrative DOJ values, and the database requires administrator employee_code to be NULL. Administrators no longer need --employee-code during operator bootstrap. Original employee IDs and attendance references remain intact; UUIDs continue to identify users internally.

Migration 0006 adds nullable users.date_of_joining, makes employee_code nullable, seeds monthly counters from existing formatted IDs, clears administrator IDs and adds the administrator constraint. No joining dates are invented. Downgrading to a version requiring administrator employee IDs is deliberately refused while NULL IDs exist; use a verified backup if rolling back that schema change.

## Current expected working-hours policy (11-Oct-2026)

Expected working hours equal the same-day assigned shift duration minus a fixed 60 minutes, floored at zero. 08:00 AM–05:00 PM gives 8h 0min; 09:00 AM–04:00 PM gives 6h 0min. This is a fixed expected-hours rule and does not introduce configurable break fields. Actual recorded work duration and the 20-minute late-arrival grace remain separate.

Shift API responses expose expected_working_minutes from the backend. Employee dashboard and calendar show Expected working hours; attendance and CSV use the corresponding expected_minutes in hours/minutes. Calendar holidays and weekly-off days retain zero expected attendance; work-from-home schedules retain the shift expectation without punch tracking. Recorded days retain their original shift times when assignments change.

New records use calculation version 3 and expected_deduction_minutes=60. Existing records can be updated once with `uv run python -m app.cli apply-working-hours-policy --reason "Company expected-hours rule"`. It recomputes expected hours from recorded shift times, retains approved legacy permissions, preserves original punches/actual totals/status/lateness, stores previous_expected_minutes and logs the operation. Repeating the command changes zero already-updated records. Historical actual-hour exclusions remain preserved; expected hours use the fixed one-hour rule.
