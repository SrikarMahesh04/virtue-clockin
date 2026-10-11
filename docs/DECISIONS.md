# Accepted decisions - 2026-10-10

- Dark charcoal/cyan wireframes supersede the light token proposal. Use the supplied full Virtue logo in both portals and account pages. The company favicon was removed at the user's request before publishing the repository.
- Local development and complete workflows before hosted staging. No Docker.
- One organization/office; Employee, Admin, Super Administrator; Manager deferred.
- Local login first; Microsoft SSO deferred.
- Email plus employee-chosen six-digit PIN, set alongside password during activation. No registered-device requirement. This supersedes the earlier WebAuthn-only design. Hash and throttle PINs; require password confirmation for administration.
- Passwords have no minimum length policy; require a nonempty value (maximum 256 characters). Weak/Medium/Strong feedback is advisory in operator bootstrap and activation/recovery forms. PINs remain exactly six ASCII digits preserving zeros.
- Eight-hour sessions, 15-minute admin password elevation, five failed PIN attempts => 15-minute PIN lockout; 30-minute single-use account links.
- Administrators can edit assigned shift definitions and change their status. New attendance snapshots use the updated timings; recorded days preserve their original snapshots. Deleted shifts are removed from available lists while retaining assignment/audit references.
- Calendar entries apply to new snapshots and current attendance views through a non-destructive overlay; previous punch events remain preserved. Approved-request recalculation and grace-policy updates are logged internally. Manual corrections and new correction requests are unavailable; historical records are preserved.
- Synthetic fixtures are allowed only in isolated test schemas, never production migrations or application startup.

- Current acceptance focuses on desktop browsers. Further phone work is deferred at the user's request; existing network support is retained.
- Shift creation and editing use centered modal dialogs. Create new shift sits above the table. Close/Cancel and Escape dismiss the dialog; focus returns to the triggering control. Escape in an open time menu dismisses that menu first.
- Shifts have start and end times only. Use AM/PM dropdowns in half-hour increments with six visible scrolling options and no adjacent timezone fields. Display clocks and timestamps in 12-hour format independently of device preferences; persist API values in their original machine-readable formats. New attendance records have no scheduled lunch deduction. Existing recorded snapshots retain their original calculation basis for audit consistency.

- Requests and approvals are removed from both roles and API contracts as of 2026-10-11. Retain historical approved intervals, original attendance and immutable audits; do not delete company records to disable the feature.
- Attendance filters use a compact horizontal strip; date fields appear inside a dropdown.

- Departments are unavailable in frontend and public backend APIs/DTOs/filters. Retain legacy storage and audit references without exposing or creating departments. Attendance dropdowns offer Present, Late and Work from home; weekly-off placeholder rows remain calendar-only and do not appear in attendance history or exports.

Security & Audit and My Notes have been removed from active pages, navigation, APIs and DTOs. Historical tables remain preserved; no new note/audit database records are written. Operators inspect private rotating JSON logs at backend/logs/clockin.log (5 MB per file, three backups). No log-reading API is exposed.


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

## Current expected working-hours policy (11-Oct-2026)

Expected working hours equal the same-day assigned shift duration minus a fixed 60 minutes, floored at zero. 08:00 AM–05:00 PM gives 8h 0min; 09:00 AM–04:00 PM gives 6h 0min. This is a fixed expected-hours rule and does not introduce configurable break fields. Actual recorded work duration and the 20-minute late-arrival grace remain separate.

Shift API responses expose expected_working_minutes from the backend. Employee dashboard and calendar show Expected working hours; attendance and CSV use the corresponding expected_minutes in hours/minutes. Calendar holidays and weekly-off days retain zero expected attendance; work-from-home schedules retain the shift expectation without punch tracking. Recorded days retain their original shift times when assignments change.

New records use calculation version 3 and expected_deduction_minutes=60. Existing records can be updated once with `uv run python -m app.cli apply-working-hours-policy --reason "Company expected-hours rule"`. It recomputes expected hours from recorded shift times, retains approved legacy permissions, preserves original punches/actual totals/status/lateness, stores previous_expected_minutes and logs the operation. Repeating the command changes zero already-updated records. Historical actual-hour exclusions remain preserved; expected hours use the fixed one-hour rule.

## 11-Oct-2026: Equal administrative roles and explicit account replacement

The user requested exactly Super Admin, Admin and Employee, with equal management privileges for both administrator roles. Both may grant/manage all three roles and configure the office; recent password authentication remains required. Employee-only punches and resource isolation remain enforced. Administrators have no DOJ or Employee ID.

The user explicitly authorized permanently removing the existing accounts and replacing the Super Admin using the provided real name/email. Replacement clears account-dependent history and tokens atomically; global office configuration, shifts and holidays remain. Credential choice happens through private activation, with no invented password or PIN.

## 11-Oct-2026: Explicit employee sequence correction

The user subsequently requested that the sole retained employee use sequence 001. A guarded local transaction changed `2608-002` to `2608-001` and the August counter from 2 to 1, preserving every other database value. Previous employee accounts were already absent. The allocator's next ID was verified as `2608-002` in a rolled-back transaction. This is a one-time authorized correction; ordinary account deletion continues to reserve past IDs.

Password/PIN sign-in switches bypass page-loading feedback and the one-second delay while retaining the email in memory. Other page transitions keep their existing loading behavior.
