# Changelog

## 11-Oct-2026 - Automated test setup removed

- Removed backend, frontend and browser test files, test-only configuration/dependencies/helpers, and the GitHub Actions test workflow at the user's request.
- Updated lockfiles, development scripts and documentation. Application health/readiness checks and runtime behavior remain unchanged. Historical workflow runs are not erased by this change.
- Pinned existing frontend package versions while regenerating its lockfile, and disabled automatic peer installation so removed test runners are not restored. Local lint/type/contract checks and the production build passed; no automated tests were run.

## 11-Oct-2026 - Repository publication cleanup

- Removed the company favicon while retaining the full portal/login logo.
- Removed the unused manual date/time input component, its unused parsing helper/styles, a scratch geolocation note and a temporary PDF rendering. Added ignores for temporary files, private environment variants and certificate keys.
- Kept application source, migrations, generated API contracts, tests, dependency lockfiles, documentation and original wireframe references for reproducible setup.

## 11-Oct-2026 - Employee sequence correction and instant sign-in switching

- Corrected the sole current employee from `2608-002` to `2608-001` at the user's request. Verified that previous employee accounts were already removed; preserved all other database values. The next August 2026 employee ID is `2608-002`.
- Removed the loading overlay and artificial delay only when switching between password and PIN sign-in. Entered email remains in memory; credentials stay empty. Other page navigation retains the one-second animation.

## 11-Oct-2026 - Page loading animation and sign-in email

- Added an accessible cyan loading overlay for page links and sign-in/sign-out redirects. Navigation waits one second, then the overlay remains until the route transition completes. Same-page links and internal form/filter/dialog actions are excluded. Reduced-motion users receive a static loading indicator.
- Password/PIN sign-in switches retain the entered email in memory without persisting it to URLs or browser storage. Password/PIN fields stay empty on switching; the email draft clears after successful sign-in.

## 11-Oct-2026 - Private activation and recovery links

- Removed the Activation / Recovery Token input from account setup and credential reset. Link tokens are handled automatically in component memory and removed from the address bar.
- Missing-link pages explain how to reopen/request a complete link and disable credential submission. Backend single-use/expiry checks are unchanged.

## 11-Oct-2026 - Super Admin, Admin and Employee

- Added Admin as a selectable role, with the same management/settings permissions as Super Admin and individual activation/login credentials. Employee-only attendance remains enforced.
- Added migration 0007 to convert legacy HR roles and invalidate their sessions. Regenerated API/client contracts.
- Added an explicit local operator account-replacement command that deletes existing accounts and linked records atomically and issues activation for a new Super Admin, preserving office configuration, shifts and shared holidays.

## 11-Oct-2026 - Compact desktop login

- Password and PIN login cards adapt their branding and spacing to the viewport height, fitting common desktop screens without page scrollbars, including credential error states.
- Kept form fields and recovery/navigation links accessible; longer activation and reset forms retain their existing layout.

## 11-Oct-2026 - Company branding and UI labels

- Added the supplied full Virtue logo to administrator and employee navigation and account pages; retained the ClockIn product caption.
- Replaced the clock favicon with the supplied compact company mark. Original PNG assets are preserved.
- Standardized headings, navigation, field labels, buttons, and attendance status labels, including Work From Home. Stored values and employee-entered data retain their original casing.

## 11-Oct-2026 - Shift-based expected working hours

- Confirmed expected hours as assigned shift duration minus one hour: 8 AM–5 PM = 8h; 9 AM–4 PM = 6h, floored at zero.
- Added backend-computed expected duration to shift responses and employee dashboard/calendar; labelled actual recorded hours separately.
- Applied the same expected-hours rule to attendance/projections/CSV and added an idempotent operator command for existing records while preserving punches and actual totals.

## 11-Oct-2026 - Employee workspace simplification

- Added current shift name and AM/PM timings to the employee directory, with dated upcoming assignments and no administrator shift.
- Eye icons now show a strike while credentials are hidden and an open eye while visible.
- Removed employee sidebar sign-out; the header retains sign-out.
- Profile now offers recovery email for the signed-in account instead of an inline credential-change form.
- Employee calendar selected-date details show Punch In/Out timestamps; plain weekly offs and other schedule-derived records no longer create attendance dots. Explicit office calendar entries remain marked.
- Employee attendance filters use a compact horizontal date-range/status toolbar.

## 11-Oct-2026 - Credential visibility and PIN autofill

- PIN login starts empty, uses a distinct field name and disables password autofill hints; numeric entry preserves leading zeros.
- Added keyboard-accessible eye buttons to show/hide passwords, PINs and account-link tokens independently in login, activation/recovery, profile and administrative confirmation. Entries remain masked by default.

## 11-Oct-2026 - Simplified employee actions

- Removed Effective From/To inputs from employee shift assignment; the server selects the office-local start date and preserves recorded attendance.
- Split Send Activation Link and Reset Password with account eligibility checks and visible delivery errors.

## 11-Oct-2026 - Monthly Employee IDs and DOJ

- Required DOJ for new employees; automatic YYMM-XXX IDs reset by joining month and are allocated safely during concurrent hires.
- Added DOJ and generated ID to the directory; removed manual-ID entry and HR from role selection.
- Administrators have no Employee ID/DOJ; bootstrap no longer takes --employee-code. Existing employee IDs are preserved.


## 11-Oct-2026 - Current-day calendar and readable CSV

- Calendar opens with the server's office-local current date selected and shown in full.
- Attendance CSV omits Corrected/Source and formats Net Hours/Expected Hours as hours and minutes.


## 11-Oct-2026 - Unified attendance and simpler calendar

- Calendar heading shows month/year until a date is selected, then the full date; only previous/next month arrows remain.
- Moved filtered CSV export into the compact Attendance toolbar and removed the separate reports screen/navigation and page charts.


## 11-Oct-2026 - Compact holiday calendar

- Compact desktop calendar with colored dots and accessible all-day Office calendar hover details.
- Imported the supplied 2026 list: nine office holidays, five optional working dates; Ugadi remains an office holiday by user confirmation.
- Optional days support verified punches, normal shift-hour calculations and late counts.


## 2026-10-11 — Employee calendar and admin workspace

- Removed Integration Readiness and Microsoft sign-in mentions from the application/contracts.
- Removed admin workspace switch and duplicate sidebar sign-out; blocked admin employee pages and punch APIs.
- Replaced special working days with employee/all-employee Holiday and Work from home entries, with equal left-controls/right-calendar layout.
- Added no-punch Work from home attendance status, filters, reports, in-app notifications and effective late-count updates while preserving original records.
- Added migration 0004, retaining historical calendar storage and carrying existing holidays forward.


## 2026-10-11 — Direct date filters and feature removal

- Split attendance/report ranges into Start date and End date boxes with independent calendars and a central 'to'.
- Removed My Notes and Security & Audit screens, navigation, APIs and contract fields. Legacy tables remain preserved without active access.
- Replaced database audit writes with private rotating JSON operational logs, excluding credentials and submitted values.


## 0.1.6 - Dates, server clock and record navigation - 2026-10-11

- Standardised displayed dates and date entry as DD-Mmm-YYYY, retaining ISO API/form values and calendar picking. CSV dates and timestamps use the same format with explicit time offsets.
- Replaced device clocks with authenticated server-time synchronisation, monotonic interpolation, periodic/resume refresh and explicit unavailable/stale states.
- Kept punch timestamps server-authoritative and capture date/time from one instant. Documented the host clock trust dependency.
- Replaced record Previous/Next text with labelled arrows, hidden for a single page; pages adapt to viewport height with a lookahead row.

## 0.1.5 - Simplified attendance filters - 2026-10-11

- Limited attendance status choices to Present and Late and boxed the date range to match other filters.
- Removed department controls, employee columns/fields, APIs, schemas and report filter parameters; preserved legacy storage.
- Excluded weekly-off placeholders from attendance history, reports and CSV before pagination, retaining calendar schedules and actual off-day work.

## 0.1.4 - Compact filters and workflow removal - 2026-10-11

- Replaced the admin attendance filter grid with a compact horizontal strip: dropdown date range, employee, department and status.
- Removed requests and approvals from employee/admin navigation, screens, API endpoints, generated contracts, dashboard counters and calendar details.
- Retained historical approved intervals and audit history without creating or changing company records.

## 0.1.3 - Attendance policy and display - 2026-10-10

- Removed manual correction from admin attendance and retired its API; removed new correction requests and approval of historical correction requests. Preserved historical records and audits.
- Display Net and Expected hours as hours and minutes, including employee dashboard/calendar durations.
- Applied an inclusive 20-minute grace period to every shift. Added an audited, idempotent operator command to update saved late classifications and monthly flags without changing punch times.
- Verified exact grace boundaries, secondary shifts, saved-record recalculation, retired correction actions and duration display through backend and browser tests.

## 0.1.2 - Shift management and time display - 2026-10-10

- Enlarged shift dialogs and positioned time menus independently so scrolling time choices does not add a scrollbar to the dialog.
- New shifts are created Active without a status field; Active/Inactive controls appear only when editing a saved shift.
- Moved shift creation/editing into centered modal dialogs with Close, Cancel and Escape dismissal. Added Create new shift above the table; forms no longer occupy the bottom of the page.
- Replaced native time menus with keyboard-accessible AM/PM dropdowns limited to six visible options; removed adjacent timezone controls.
- Added assigned shift editing, creation with active/inactive status, and confirmed deletion. Recorded attendance and assignment/audit history are preserved; inactive/deleted shifts cannot start new attendance days.
- Forced 12-hour AM/PM clocks and timestamps throughout the UI, including date/time entry forms, independently of device preferences.
- Added migration 0003 and regenerated the OpenAPI/client contract for shift deletion.

## 0.1.1 - Shift timings - 2026-10-10

- Removed scheduled lunch configuration and automatic deductions for newly recorded attendance. Shift APIs and employee/admin screens now show only start and end times.
- Added dark 24-hour half-hour time dropdowns with the shared office timezone, matching the supplied layout references.
- Added migration 0002. Existing shift settings are archived for rollback; recorded attendance snapshots and historical totals are preserved. Newly recorded attendance uses the full elapsed Punch In–Out duration.

## 0.1.0 - Local implementation - 2026-10-09

- Added phone/LAN connections: local API URLs follow the development computer hostname, backend launcher binds to the network and permits explicit LAN origins, and Next.js detects development network hosts. Added scoped firewall/HTTPS instructions. Mobile attendance now depends on secure-context location verification instead of screen size/user-agent blocking.
- Replaced manual office latitude/longitude fields with a Google Maps picker, address search, draggable pin, explicit device-location action and meter-radius preview. Location settings still use the audited API and backend geofence enforcement. Real Google project configuration is required.
- Fixed local frontend/API authentication when opening 127.0.0.1 instead of localhost: share an explicit loopback CORS/CSRF allowlist in development/test and align the local API hostname with the browser for session cookies. Production origin restrictions remain exact.
- Removed the 15-character password minimum from administrator bootstrap, activation and recovery. Added advisory Weak/Medium/Strong feedback; weak passwords remain selectable and confirmation remains required.
- Added Next.js dark UI, FastAPI, PostgreSQL migrations, operator setup and all 20 primary routes.
- Added employee-selected six-digit email/PIN login alongside password login. This supersedes the earlier device-bound PIN proposal recorded below.
- Added CSRF/session controls, PIN lockout, password admin elevation, real workforce/attendance workflows, private notes, requests, calendars, reports and immutable audit history.
- Added generated API types, PostgreSQL concurrency tests, frontend/browser tests and integration/deployment documentation.
- Local-first deployment; Microsoft SSO, Manager delegation, app-managed MFA and scheduled reminders remain deferred. Real company integrations and production review remain outstanding.

## Historical planning record (superseded where stated above)

# Virtue ClockIn — Changelog

All notable specification and implementation changes should be listed here. Dates below document planning decisions only; they do **not** mean code has been implemented.

## [Unreleased] — Planning baseline (2026-10-09)
### Initial abstract baseline
- Web-based desktop/laptop attendance, office location/network validation, single daily Punch In/Out.
- Configurable shifts/lunch deductions; 10-minute arrival grace, six unexcused monthly late arrivals trigger admin flag.
- Leave and hourly permissions, admin correction/audit, holidays, dashboards and CSV export.

### Agreed direction after abstract
- Corporate Microsoft Entra sign-in if organization authorizes; separate local corporate-email/app password alternative.
- Local password recovery through registered corporate email, admin-initiated reset workflow.
- Optional user-selected 4/6-digit quick PIN only with enrolled device-bound cryptographic sign-in.
- Employee live office clock, calendar views, scheduled activities and private date-linked notes.
- Virtue Software Solutions teal/charcoal branding from uploaded office logo.
- 20 primary routes and shared auth, employee, admin and system-state shells.
- Frontend Next.js/React/TypeScript/Tailwind, backend **Python FastAPI** (supersedes earlier NestJS suggestion), PostgreSQL/SQLAlchemy/Alembic.
- Explicitly separate `frontend/` and `backend/` with versioned OpenAPI and generated TS client.
- **No Docker**; Vercel preferred with Netlify frontend alternative and appropriate Python host.
- No mock/seed/prefilled production employee, attendance, integration or reporting records.

### Pending confirmation
- Microsoft tenant consent and MFA policies; hosting support/quotas; networking and geolocation accuracy; PIN implementation; retention and data governance; exact brand color sampling; first admin provisioning.

## Template for future entries
```
## [version] — YYYY-MM-DD
### Added
### Changed
### Fixed
### Security
### Migration / integration notes
```
Every source change touching API or DB contracts should also list migration impact and frontend synchronization status.
