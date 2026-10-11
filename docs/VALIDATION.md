## 11-Oct-2026: Pre-publication cleanup

- Removed the unused date/time form component, parser and styles, the geolocation scratch note and a temporary PDF preview. Confirmed local environments, logs, tooling, test artifacts and dependencies are excluded from Git; secret-signature scan passed.
- All 76 backend tests passed against isolated PostgreSQL. Ruff lint/format, mypy and OpenAPI drift checks passed. All 45 frontend tests, ESLint and production build/TypeScript passed.
- Chromium verified that login has no favicon metadata and retains the full company logo. Original wireframes, migrations, source, tests, contracts and lockfiles remain included.

## 11-Oct-2026: Employee sequence correction and instant login switches

- All 45 frontend tests passed, including immediate navigation with no timer/overlay in both login-method directions. TypeScript, ESLint and the production build passed.
- Chromium verified retained email, empty credentials and no overlay for both login-method switches; other page navigation and sign-in redirects still show the one-second loader. Browser authentication responses were preview-only.
- Local PostgreSQL inspection confirmed one employee and one Super Admin. Corrected employee ID to `2608-001` and monthly counter to 1 atomically. Full table snapshots excluding those two fields matched before/after. Next allocation verified as `2608-002` and rolled back to avoid consuming the number. No credentials, attendance, assignments or other stored values changed.

## 11-Oct-2026: Page transitions and retained sign-in email

- All 43 frontend tests passed. Navigation tests verify no routing at 999ms, routing at 1000ms, duplicate navigation suppression, redirect support, internal-action exclusion and timer cleanup. TypeScript and ESLint passed.
- Chromium verified password-to-PIN and return navigation, visible loading overlay before route changes, retained email, empty password/PIN fields, and no draft in local/session storage. Also checked successful sign-in redirect and admin sidebar navigation with preview-only sessions; dialog/eye/same-page actions do not show the overlay. No real credentials or company data changed. Spinner screenshot visually inspected.
- Shared navigation covers authentication, administrator and employee links, branding, missing-page links and session/logout redirects. Backend behavior unchanged.

## 11-Oct-2026: Account-link token hidden from forms

- All 39 frontend tests passed; TypeScript and affected-file ESLint passed.
- Chromium verified activation and recovery: no token field or visible token text, fragment removed from address bar, original token and leading-zero PIN included in the submitted API payload, and missing-link state explains recovery and blocks submission. Browser requests were mocked; no real account credentials changed. Reset form screenshot visually inspected.
- Dashboard explanation checked against daily_records and admin_dashboard: Absent After Shift End counts today's office-local projected absence after the assigned shift ends, for active employees without recorded attendance, excluding holidays, weekly offs, WFH and fully excused historical approved leave. Missing Punch Out is counted separately as incomplete.

## 11-Oct-2026: Three roles and authorized account replacement

- Backend full suite: 74 passed; one new reset test initially used duplicate test-client cookies. Cleared the stale cookie in that test; all five role/reset/migration tests then passed, including the corrected case and newly added migration coverage.
- Verified Admin/Super Admin equal settings and all-role account creation/edit permissions, password elevation after PIN login, employee restrictions, self-demotion prevention, single-use activation and separate credentials.
- Verified permanent replacement commits atomically or rolls back completely; old sessions/tokens become invalid, immutable legacy triggers are restored, and office settings/shifts/global calendar persist.
- Frontend 37 tests, TypeScript, ESLint, formatting and production build passed. Browser workflow passed using a real Admin session, settings navigation, all three role options, hidden administrative DOJ, and account creation in an isolated test schema.
- Applied migration 0007 locally. At the user's explicit request, deleted two old accounts and their two linked attendance days; created the requested pending Super Admin with no invented credentials. Configuration fingerprints before/after match. API/frontend restarted on their original network bindings. Activation token is never written into documentation or operational logs.

## 11-Oct-2026: Desktop login layout

- Chromium confirmed both password and PIN forms fit with no document overflow at 1920x1080, 1366x768, 1280x720, and 1024x600, including incorrect-credential errors. All inputs and navigation remain within the viewport; no overflow clipping is used.
- TypeScript and affected-file ESLint passed. Visually inspected the compact PIN login screenshot. Authentication/API behavior unchanged; only layout was adjusted.

## 11-Oct-2026: Company branding and UI capitalization

- Frontend production build, TypeScript, ESLint and all 37 unit tests passed.
- Chromium previews verified the full logo in administrator and employee navigation and the sign-in page, correct page headings, and an HTTP 200 PNG favicon response. Preview sessions were mocked in the browser only; no accounts or company records changed. Visually inspected portal and sign-in screenshots.
- SHA-256 checks confirm both copied PNGs exactly match the supplied originals. Generic clock icon removed. Backend behavior is unchanged.

# Local verification - 2026-10-11

## Current update: expected shift hours minus one hour

- User explicitly selected subtract-one-hour expected hours. Backend checks cover 8 AM–5 PM = 480 minutes, 9 AM–4 PM = 360 minutes, fractional hours and flooring short shifts at zero. Actual durations remain event-based; late grace remains 20 minutes.
- Full backend regression run passed 69 cases; two new test assertions initially selected a historical shift by list position. All five policy tests passed after selecting the assigned shift by ID, completing coverage of all 71 cases. Ruff lint/format, mypy and OpenAPI drift passed.
- 37 frontend unit tests, TypeScript, ESLint, formatting and production build passed. Generated contracts include backend-computed ShiftView.expected_working_minutes.
- Four affected real-browser workflows passed: employee dashboard/calendar/attendance, administrator records and filtered CSV, compact filtering and scoped calendar/WFH. Dashboard and calendar display 8h 0min; CSV keeps actual 7h 36min and expected 8h 0min. Visually inspected the dashboard with separate expected/actual cards.
- Applied the idempotent expected-hours operator command to the local company database: one existing recorded day updated, second run changed zero. Original punches, actual totals, status and lateness preserved; previous expected minutes stored in the snapshot and operation logged. No schema migration required.

## Current update: employee directory and workspace simplification

- 37 frontend tests passed, including hidden-eye strike and visible-eye state. TypeScript, ESLint, formatting and production build passed.
- Four affected browser workflows covered: employee real punches/calendar/profile/filters, directory employee creation/assignment and CSV, employee-scoped calendar/WFH, and unmarked weekly offs. Employee workflow passed after narrowing a test-only alert selector to exclude Next.js route announcements.
- Verified directory shift name/AM-PM timing; one employee sign-out in the header; no profile current-password/new-PIN form; recovery request targets employee@example.com and truthfully returns SMTP-unavailable error. Filters remain below 100px at desktop width with Start/End/Status on one line and working record filtering.
- Employee calendar selected date shows recorded Punch In/Out timestamps in DD-Mmm-YYYY and AM/PM format. Weekly-off schedules have no dot or status summary; explicit office calendar entries remain. Recorded-punch dots are blue with a separate legend, distinct from cyan work-from-home dots. Visually inspected calendar and attendance toolbar screenshots.
- All browser modifications remained in the isolated test schema; no company records or credentials changed. Backend contracts/calculations remain unchanged; no migration required.

## Current update: PIN autofill and credential visibility

- Production build passed. Local API health/readiness and PIN login returned HTTP 200 after restoring the normal application servers; dedicated test database stopped.
- 37 frontend unit tests passed, including empty PIN entry/autofill hints, rejection of nonnumeric saved-password text, preserved leading zeros, independent masking toggles and no accidental form submission. TypeScript, ESLint and formatting passed.
- Browser password/PIN login, session reload and sign-out passed on localhost and 127.0.0.1 with keyboard visibility toggles. Activation with short password and leading-zero PIN passed after disambiguating a test-only input locator from its new eye button. Visually inspected the desktop PIN form.
- Login PIN no longer requests current-password autofill and has password-manager ignore hints. These hints cannot control extensions that explicitly override them. No credentials are stored by the visibility component. Backend authentication and validation remain unchanged.

## Current update: date-free shift assignment and separate account links

- Full backend suite: 66 tests passed, including office-local automatic assignment dates, future DOJ, idempotent assignment, preserved prior assignments/attendance snapshots, separate activation/recovery purposes, account eligibility, role restrictions and transaction rollback when email is unavailable. Ruff lint/format, mypy and OpenAPI drift checks passed.
- Frontend: 34 unit tests, TypeScript, ESLint, formatting and production build passed. Updated generated contracts include EmployeeShiftInput, account_activated and the dedicated activation-link endpoint.
- Affected real-browser employee workflow passed: date inputs absent, shift assignment persisted, new-account activation and activated-account reset buttons enabled appropriately, and missing email errors visible inside the employee panel. Visually inspected both account actions and the simplified shift section.
- No company accounts, assignments or credentials changed during testing; PostgreSQL tests remained isolated. No database migration required. Restored the local API/frontend after verification.

## Current update: joining dates and monthly generated Employee IDs

- Full backend suite: 63 tests passed, including monthly/year resets, backdated joining months, six simultaneous hires, existing-ID reservation, inactive/promoted ID non-reuse, three-digit exhaustion, forbidden manual IDs/new HR roles, administrator NULL IDs, bootstrap without employee-code and preservation of legacy employee records without fabricated DOJ. Ruff lint/format, mypy and OpenAPI drift passed.
- Frontend: 34 unit tests passed; TypeScript, ESLint, formatting and production build passed. Regenerated OpenAPI and frontend types include nullable employee_code/date_of_joining and the restricted input role list.
- Three affected browser workflows covered: compact attendance and scoped calendar passed; employee creation/editing/navigation/CSV passed after correcting the test-only close-panel locator. Verified generated 2610-001, 11-Oct-2026 DOJ, read-only ID on edit, absence of HR, and hidden ID/DOJ for administrator creation. Visually inspected create form and directory screenshots.
- Applied migration 0006 to the local company database. Existing employee IDs preserved; administrator employee IDs removed as requested; no joining dates, employees or credentials fabricated. Tests remained isolated in PostgreSQL test schemas.
- Completed the interrupted local restart on 11-Oct-2026. API health, migrated database readiness and frontend login returned HTTP 200; the dedicated PostgreSQL test cluster was confirmed stopped.



## Current update: current-date calendar opening and CSV durations

- Eleven affected backend tests passed against isolated PostgreSQL, covering CSV header/duration changes, server-authoritative times, optional-day attendance and scoped calendar/filter behavior. Ruff lint/format and mypy passed; OpenAPI drift check passed (no JSON-contract changes).
- Thirty-four frontend unit tests passed; TypeScript, ESLint, formatting and production build passed.
- Three affected browser workflows are covered: filtered attendance CSV download passed; compact calendar/current-date selection and scoped calendar/WFH passed after fixing an initialization refresh that remounted the calendar during save. Verified server office-local full-date heading, selected current-day cell, month navigation, formatted exported durations and absence of Corrected/Source/Minutes headers.
- The clock initialization remains mounted after saves, preserving the selected employee/date. No company attendance records or settings changed; no migration needed.



## Current update: unified attendance and simplified month navigation

- 34 frontend unit tests passed. TypeScript, ESLint, formatting and production build passed.
- All four affected browser workflows passed against the real API and isolated PostgreSQL: administrator navigation/employee creation/filtered CSV export, compact attendance filters, scoped calendar/WFH, and compact month calendar.
- Verified removed Reports & analytics navigation, /admin/reports HTTP 404, downloaded CSV employee/status filtering, month/year initial headings, selected-date full headings, month navigation resetting the heading, removed Today/view controls, holiday/optional dots and hover/keyboard details.
- Visually inspected the calendar at 1280 x 720 without horizontal/vertical page scroll, and the single-row attendance toolbar with Export CSV at 1440px. No company data changed. Backend behavior and export API remain unchanged.



## Current update: compact calendar and supplied 2026 holidays

- Full backend suite: 57 tests passed. After the final no-shift projection adjustment, all seven calendar tests passed again, including optional punches/hours/lateness, monthly late-flag preservation, scoped overrides, concurrency and idempotent import. Ruff and mypy passed.
- Frontend: 34 unit tests passed with the required local temporary-file access. TypeScript, ESLint and formatting passed. Production build passed; generated OpenAPI/client updated.
- Browser: existing scoped-calendar workflow passed. New compact-calendar workflow passed after reducing toast and short-screen spacing; verified no horizontal/vertical page scroll at 1280 x 720, gold/purple dots, hover and keyboard details including All day / Office calendar. Visually inspected the final screenshot.
- Visually checked the supplied PDF. Applied migration 0005 and imported 14 distinct All-employees dates into the local company database with user authorization: nine holidays and five optional working days, Ugadi holiday precedence confirmed by the user. No credentials, original punches or individual calendar entries changed.
- A second real import added zero dates, confirming idempotence. Restarted the local API/frontend; health, database readiness and login returned HTTP 200. Stopped the dedicated test database.
- Test accounts and browser schedules remained isolated in dedicated PostgreSQL test schemas.


## Current update: employee-scoped calendar and administrator workspace

- Backend: 55 tests passed against isolated PostgreSQL. Coverage includes individual-over-All calendar precedence, Work from home attendance/filter/CSV results, blocked punches, notifications, role restrictions, concurrent calendar saves, migration preservation, and reversible overlays that preserve original punch records and monthly late flags.
- Frontend: 34 unit tests passed. TypeScript, ESLint, formatting, Ruff lint/format, mypy, OpenAPI drift and generated-client checks passed. Production build passed using the direct Node Next.js entry point.
- Browser: eleven existing workflows passed in the full run; the new calendar workflow passed after correcting its employee-selector locator. All twelve workflows are covered. Verified the equal desktop calendar halves, Holiday/Work from home scopes, filters, notifications, hidden employee punch controls on Work from home days, administrator workspace restrictions, header sign-out, and removal of integration-readiness and Microsoft sign-in UI.
- Visually inspected the desktop calendar. Applied migration 0004 to the local application database and restarted the API/frontend. API health, database readiness and the frontend login page returned HTTP 200. Stopped the dedicated test PostgreSQL cluster afterward.
- Test fixtures remained isolated from company data. The migration preserves legacy calendar storage and carries existing holidays into the scoped calendar; it does not create company schedules or change original attendance records.
- Earlier entries below describe prior versions and are superseded where behavior differs.

## Current update: direct date boxes, retired notes/audit, internal logs

- Backend: 50 tests passed against isolated PostgreSQL, including removed note/audit endpoints for both roles, absence from OpenAPI/dashboard/calendar, no new note/audit database rows, file log metadata, excluded secrets/query strings, and rollback suppression.
- Frontend: 34 unit tests passed, including independent native calendars from the date boxes and calendar buttons. TypeScript, ESLint and formatting passed.
- Browser: ten workflows passed in the full run; the remaining compact filter workflow passed after scoping its alert assertion to the toolbar rather than the Next.js route announcer. All eleven workflows are covered. Verified direct start/end boxes, invalid-range feedback with the last valid records retained, date/employee/status filtering, removed navigation/pages, and unchanged attendance/shift/auth/calendar/report operations.
- Ruff lint/format and mypy passed; Ruff is now executable in this session. OpenAPI and generated frontend contracts were regenerated and checked. Production build passed using node node_modules/next/dist/bin/next build; the environment's pnpm fallback launcher failed to start the CSS worker. TypeScript, ESLint and Prettier checks passed.
- Visually inspected the 1440px attendance toolbar: separate Start date / to / End date, Employee and Status fit in one row below 110px total filter height.
- Historical tables remain intact and inaccessible through application APIs. Internal JSON logs rotate at 5 MB with three backups under backend/logs/. No company records, credentials or clock settings were changed for this update.
- Earlier dated entries below describe prior versions and their verification; notes/audit screens and the date-range dropdown are superseded by this update.


Attendance update (2026-10-10): exact 20-minute grace and one-second-over boundaries passed for primary and newly created secondary shifts. Audited saved-record recalculation is idempotent and preserves original punch timestamps and duration totals. Manual correction API returns 404, all retired request list/create/review endpoints return 404, and the browser verifies no correction button plus `7h 36min` and `9h 0min` duration display. Applied the operator policy command to one existing local company attendance record; this was separate from isolated test fixtures.

- Backend: 48 tests passed, including localhost/127.0.0.1 CORS preflights and CSRF/session behavior, rejection of untrusted origins, actual PostgreSQL migrations, short-password bootstrap/activation/recovery, advisory strength, lockout/session behavior, concurrent punches, preservation of historical permission calculations, schedule-derived absence/leave, immutable audits and spoofed forwarded headers. mypy passed. Ruff execution is currently blocked by Windows Application Control; its checks could not be rerun in this session.
- Frontend: 33 Vitest tests passed, including local API hostname resolution, Weak/Medium/Strong feedback and short-password form validation; ESLint, formatting and TypeScript checks passed.
- Chromium: nine desktop end-to-end workflows passed (localhost and 127.0.0.1) against the real API and isolated PostgreSQL schema, with no mocked API responses. Covered administrator password/PIN login, reload persistence and sign-out on both localhost and 127.0.0.1, all primary employee/admin routes, activation with a one-character password and leading-zero PIN, punches, private notes, calendar/notifications, employee creation, CSV, unavailable email, keyboard focus, compact attendance filtering and removal of request pages.
- Production frontend build passed. Generated OpenAPI matches the backend and generated frontend types compile.
- Login and administrator layouts visually inspected. Text contrast: body 15.79:1, muted text 8.69:1, cyan action/dark text 9.04:1. Input boundary contrast against input background: 3.62:1. These token checks do not replace a full accessibility audit.

Tests use synthetic data only in a dedicated PostgreSQL test schema. Verification does not create or modify company application accounts/settings; operator configuration is kept separate from test fixtures. GitHub CI is configured but has not run on a remote repository.

Microsoft SSO, scheduled reminders, Manager delegation, production security/privacy review, monitoring and real infrastructure/integrations remain the explicit follow-up items in TASKS.md and DEPLOYMENT.md.

Google Maps picker: mocked SDK tests verify pin selection/dragging, radius preview, address-search behavior, permission denial and load failures. Real API/browser checks verify saved coordinates/radius, audit history, both punch geofences and preservation of saved office settings without Maps configuration. Live Google rendering/search remains pending a configured customer billing project, restricted browser key and JavaScript map ID.

Prior phone/LAN verification (further phone work deferred): real API browser tests passed through 192.168.88.8 at a 390×844 viewport, including password/PIN login, reload persistence, sign-out and a clear HTTPS requirement for mobile location. Frontend/API servers bind to LAN interfaces. Windows firewall changes require an Administrator shell and were not applied by this non-administrator session; a local-subnet-only operator script is provided. Physical-phone connectivity and trusted mobile TLS still require checking on the phone. Backend test configuration explicitly disables SMTP to avoid using operator integrations.

Shift update: PostgreSQL upgrade/downgrade preserves archived settings and recorded attendance snapshots. Full-duration and partial-day calculations, historical recalculation, retired-field rejection and AM/PM dropdown submission are verified. The desktop shift form was visually inspected. Shift editing/status/deletion preserve recorded snapshots and assignment/audit references; the custom list shows six scrolling rows. Midnight/noon conversion and minute-precision AM/PM date-time entry are covered.

Shift dialog redesign: the affected browser workflow covers centered create/edit dialogs, Close/Cancel/Escape dismissal, focus return, time-menu Escape handling, and create/edit/status/delete persistence. Frontend unit tests, TypeScript, ESLint and production build are rerun for the redesign.

Dialog sizing: the affected browser workflow also checks at 1280×640 that opening either time menu does not make the dialog scroll. Time menus retain their own six-row scrolling list. The enlarged dialog was visually inspected; 28 frontend tests, TypeScript, ESLint, formatting and production build passed.

Workflow removal (2026-10-11): 45 backend tests and mypy passed. Twenty-eight frontend tests, TypeScript, ESLint, formatting and production build passed. Eight unaffected browser workflows passed; the affected ninth workflow passed after fixing date edits to apply together with Done. Verified compact filter height below 110px at 1440px desktop width, employee/status filtering, date range editing, Escape dismissal, duration display, both removed request pages, removed navigation/counters, and request-free OpenAPI/calendar/dashboard contracts. Visually inspected the desktop screenshot. No company records were modified for this change. Ruff remains blocked by Windows Application Control.

Filter simplification (2026-10-11): 47 backend tests, 28 frontend tests and all nine browser workflows passed. Verified department endpoint retirement, department-free employee creation and response/contracts, Present/Late-only visible dropdown options, boxed date range, and weekly-off exclusion from histories/reports/CSV before pagination. Calendar weekly offs and actual off-day punches remain intact. TypeScript, ESLint, mypy, contract drift, production build and formatting passed; visually inspected the updated desktop layout. Legacy department storage remains preserved, with no active public API or UI.

Dates/time/navigation update (2026-10-11): 48 backend tests and mypy passed; targeted CSV date/offset assertions also passed. Thirty-three frontend tests passed, including formatted/leap-date validation, ISO form submission/reset, monotonic server clock under a forged Date.now(), initial/stale time failures, and single-page arrow hiding. Nine existing browser workflows passed; the new server-clock/pagination workflow passed after correcting accessible date input names. Browser Date was set to 2036 while the clock remained server-authoritative, record pages moved forward/backward, and displayed DD-Mmm-YYYY dates were verified. Production build, TypeScript, ESLint, formatting and OpenAPI drift checks passed. Visually inspected the desktop attendance page. Read-only Windows time-service status was denied, so host NTP synchronisation is unverified and documented as an operator deployment requirement. No company records or clock settings were changed.

- Final readiness check updated to migration 0007; five role/reset tests rerun successfully with readiness assertions. Restored local /health, /ready and activation page return HTTP 200.
