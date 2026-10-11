# User flows

## First administrator and office setup

Operator provisions a blank PostgreSQL database -> Alembic migration -> bootstrap command prompts for the real administrator's password/PIN -> login -> configure actual organization/timezone/geofence/network -> create shifts and employees -> assign effective shifts -> issue activation links.

No credentials or office values are preseeded. Desktop attendance remains blocked until verification and assignment prerequisites exist.

## Employee activation and login

Employee opens single-use activation link -> chooses password and own six-digit PIN -> saved as independent hashes -> signs in using email/password or email/PIN. No device enrollment required. Five incorrect PIN attempts lock PIN login for 15 minutes while password login stays available. Administrative access requires recent password confirmation.

## Recovery and PIN change

Configured SMTP: recovery form -> generic acknowledgement -> eligible account receives single-use 30-minute link -> employee sets password and PIN -> sessions and old links revoked. No SMTP: explicit unavailable state; local operator can issue a private link. Profile PIN change requires the current password and revokes all sessions. Administrators can initiate reset, never retrieve credentials.

## Attendance

Dashboard loads real shift and day state -> Punch In requests browser location -> backend validates session, office network, location/accuracy, assignment and duplicate state -> records server time and immutable original event -> recalculates day and monthly flags -> in-app notification. Punch Out completes the same verification and calculates the full elapsed working duration. Missing Punch Out stays incomplete.

## Requests and approvals unavailable

Employee/admin request pages return not found, navigation entries are removed, and request list/create/review APIs return 404. Historical approved intervals and audit records remain preserved; no requests can be created, approved, rejected or cancelled through the application.

## Calendar, notifications and reports

Employee selects month/week/day/date -> schedule, calendar overrides and attendance are returned under owner authorization. Notifications can be filtered and marked read. Admin cannot enter an employee workspace or punch. The calendar uses equal desktop halves: controls left, calendar right. Select a date, Holiday or Work from home, and one employee or All employees, then save. Individual entries override an All employees entry on the same date. Work from home generates a real calendar-backed attendance status without punches or fabricated measured hours. Affected employees receive in-app notices; filter attendance/reports by Work from home. Admin uses separate Start date and End date boxes with 'to' between them, plus employee/status selectors, and exports spreadsheet-safe CSV. Each date box opens its own calendar; valid ordered ranges apply automatically.

## Unavailable dependencies

No database -> protected requests/readiness fail explicitly; liveness remains available. No office configuration -> attendance blocked. No SMTP -> no email-success claim. API outage -> error with retry path, never mock data. SSO and scheduled reminders remain unavailable.


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
