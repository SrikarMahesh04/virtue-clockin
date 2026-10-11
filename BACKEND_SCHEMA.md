# Backend schema and API contract

The authoritative current storage is backend/app/models.py; Alembic freezes the initial schema in app/schema_v1.py. Public DTOs are in app/schemas.py; generated contracts/openapi.json defines exact requests/responses. This document describes implemented storage rather than speculative entities.

## Tables

| Group | Tables and purpose |
|---|---|
| Setup | organizations (timezone and office policy JSON) |
| Identity | users (normalized unique email/code, role, active status, independent Argon2id password/PIN hashes, PIN lockout), sessions (hashed opaque IDs, CSRF, expiry, password elevation), challenges (hashed single-use activation/recovery), rate_limits (persistent fixed windows) |
| Scheduling | shifts (same-day start/end times), shift_assignments (effective intervals), calendar_entries (date, Holiday/Work from home kind, optional employee scope; unique per date/scope) |
| Attendance | attendance_days (unique employee/date, policy snapshot, effective punches and calculations), attendance_events (immutable originals, unique employee-prefixed idempotency key), late_flags (unique employee/month, warning/flag/resolved count) |
| Notifications | notifications (owner/type/read state) |
| Retired storage | time_off_requests (historical calculations), personal_notes, audit_events and calendar_days (historical records only; no active endpoints or writes) |

IDs are UUID strings except hashed session/challenge/rate-limit keys. Event timestamps use UTC-aware storage, office dates use DATE, shift times are local TIME. Public DTOs omit credentials/session secrets. Original attendance events and audits have PostgreSQL triggers rejecting UPDATE/DELETE.

## Integrity

Punch transactions lock the employee row. Daily and idempotency uniqueness prevent duplicate ordinary punches. Shift edits are logged internally and apply to subsequent snapshots; recorded days preserve shift/timezone/calendar/office policy. Manual correction endpoints are retired; previously recorded correction events and before/after audits are retained. Global grace-policy updates recalculate late flags with internal logs and preserve punch timestamps.

Passwords and PINs are separately salted Argon2id hashes; PINs are never numeric database values. Tokens are SHA-256 hashes of random high-entropy secrets. Single-use challenges and session revocation enforce account-reset behavior. New operations no longer write database audit events or personal notes. Internal rotating JSON logs record request metadata and committed action identifiers, excluding submitted values.

Schema evolution requires a new Alembic migration, regenerated contract/types and affected UI/tests. Never change frozen schema_v1.py for a later release. Migrations never seed application records.

Migration 0002 removes retired lunch fields from active shifts and archives their previous values in retired_shift_settings for rollback. Historical attendance snapshots and audit records remain unchanged. New snapshots use calculation_version 2 and count the full punched duration. Recalculation of older recorded days respects their saved exclusions. Apply with `uv run python -m alembic upgrade head` from backend before starting the updated API.

Migration 0003 adds the internal deleted flag. DELETE /api/v1/shifts/{shift_id} retires the shift from available lists and prevents further assignment/use for new attendance days while preserving references and recorded attendance. Inactive shifts are also unavailable for new assignments and snapshots; reactivation restores their availability. An already-open attendance day can still be completed using its saved snapshot.

## Schedule-derived daily statuses

Calendar/history/report responses also calculate absent (only after shift end), approved leave, weekly off, holiday, scheduled and not-started statuses from actual account, shift, calendar and approved-request data. These rows are labelled schedule-derived, leave punch timestamps blank, and create no synthetic database events. Projections are recalculated from current schedule settings; recorded attendance retains its historical snapshot. Inactive accounts receive no inferred absence without access-history evidence.

Request creation/list/review endpoints and their DTOs are removed. The historical time-off table remains for attendance continuity and audit preservation; calendar responses no longer expose requests and dashboard responses omit request counters. No destructive migration is required.

Attendance histories, admin records and CSV exports exclude weekly-off placeholder rows before pagination. Calendars retain the weekly-off schedule; actual punches on an off day remain visible as worked attendance. Status dropdown choices are Present, Late and Work from home. Department functionality, public DTO fields and filter parameters are removed; legacy database references remain preserved without active APIs.

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


## Monthly Employee IDs and Date of Joining (11-Oct-2026)

New employee accounts require Date of Joining (DOJ). The backend generates YYMM-XXX from that joining date, with a monthly sequence: 2610-001, 2610-002, then 2611-001 for November. No manual ID or sequence-policy input is shown. The directory displays generated ID and DOJ in DD-Mmm-YYYY; edit shows the ID as text. Correcting DOJ or other employee details retains an already-assigned ID. Existing employees retain their legacy IDs and unknown joining dates stay unset until supplied.

Allocation uses a transaction-scoped PostgreSQL advisory lock per prefix, a persistent employee_id_counters row and the existing unique users.employee_code constraint. Existing matching IDs, including inactive employees, reserve their sequence numbers. Deactivation and promotion do not reuse allocated numbers. Concurrent successful hires receive distinct numbers; failed transactions roll back allocation. Once a month reaches 999, creation returns EMPLOYEE_ID_LIMIT rather than changing the three-digit format.

Assignable roles are Employee, Admin and Super Admin. Admin and Super Admin have the same management privileges, including office settings and administrative account management. Migration 0007 renames legacy HR roles to Admin and revokes those legacy sessions. All accounts have individual email/password/PIN credentials. Administrator accounts have no Employee ID or DOJ. The UI hides those fields for administrators, the API rejects administrative DOJ values, and the database requires administrator employee_code to be NULL. Administrators no longer need --employee-code during operator bootstrap. Original employee IDs and attendance references remain intact; UUIDs continue to identify users internally.

Migration 0006 adds nullable users.date_of_joining, makes employee_code nullable, seeds monthly counters from existing formatted IDs, clears administrator IDs and adds the administrator constraint. No joining dates are invented. Downgrading to a version requiring administrator employee IDs is deliberately refused while NULL IDs exist; use a verified backup if rolling back that schema change.

## Current expected working-hours policy (11-Oct-2026)

Expected working hours equal the same-day assigned shift duration minus a fixed 60 minutes, floored at zero. 08:00 AM–05:00 PM gives 8h 0min; 09:00 AM–04:00 PM gives 6h 0min. This is a fixed expected-hours rule and does not introduce configurable break fields. Actual recorded work duration and the 20-minute late-arrival grace remain separate.

Shift API responses expose expected_working_minutes from the backend. Employee dashboard and calendar show Expected working hours; attendance and CSV use the corresponding expected_minutes in hours/minutes. Calendar holidays and weekly-off days retain zero expected attendance; work-from-home schedules retain the shift expectation without punch tracking. Recorded days retain their original shift times when assignments change.

New records use calculation version 3 and expected_deduction_minutes=60. Existing records can be updated once with `uv run python -m app.cli apply-working-hours-policy --reason "Company expected-hours rule"`. It recomputes expected hours from recorded shift times, retains approved legacy permissions, preserves original punches/actual totals/status/lateness, stores previous_expected_minutes and logs the operation. Repeating the command changes zero already-updated records. Historical actual-hour exclusions remain preserved; expected hours use the fixed one-hour rule.
