# Implementation status

## Local application

- [x] Git repository, separate frontend/backend, locked dependencies, configuration examples.
- [x] Dark shared shells and 16 active primary routes, supporting activation/access-denied/not-found states.
- [x] FastAPI liveness/readiness, structured safe errors and request IDs.
- [x] Generated OpenAPI, typed frontend calls and contract drift checks.
- [x] PostgreSQL baseline migration, frozen schema and immutable original-event/audit triggers.
- [x] Operator bootstrap and local single-use account links; no application seeds.
- [x] Password/email and six-digit employee-selected PIN/email login, lockout, sessions, CSRF and password elevation.
- [x] Activation/recovery, optional SMTP, password-authenticated PIN change and session revocation.
- [x] Employee creation/edit/deactivation, role restrictions, shifts and effective assignments.
- [x] Compact horizontal attendance filter strip with independent start/end calendar boxes, 'to', employee and status.
- [x] Office verification, transactional punches, historical snapshots, shift-duration/twenty-minute grace/late calculations; historical correction audits retained.
- [x] Requests and approvals removed from both roles and APIs; historical approved records retained.
- [x] Calendar views, employee/all-employee Holiday and Work from home scheduling, in-app notifications.
- [x] Filtered attendance/CSV including Work from home, true dashboard counters.
- [x] Administrator-only workspace, header sign-out, no admin punch APIs; removed integration-readiness/SSO UI.
- Automated test suites remain removed at the user's request. Build and Code Checks runs lint, type, contract and production-build checks on GitHub without company credentials or a database; see `docs/GITHUB_ACTIONS.md`. Local checks remain available through `scripts/check.ps1`.
- [x] Local setup, accepted decisions and production integration runbook.

## Company configuration / later releases

- [ ] Supply official logo, real database/account details, office/network/timezone and approved shifts/employees.
- [ ] Configure real SMTP and verify company delivery/recovery.
- [ ] Approve production hosting/domain/proxy topology, service objectives, privacy and retention.
- [ ] Security review, monitoring, backup/restore and production smoke validation.
- [ ] Microsoft SSO, Manager delegation, app-managed MFA, multi-office and payroll (deferred).
- [ ] Scheduler-backed reminders and periodic reconciliation/cleanup (deferred, explicitly unavailable).

Every behavior change must update the backend, contract, frontend and relevant documentation together. Production readiness is not implied by completed local implementation.

Security & Audit and My Notes are retired from both workspaces and the API. Historical database tables remain untouched; no active note or database audit operations remain. Internal rotating JSON logs live in backend/logs/clockin.log; see backend/logs/README.md. Attendance/report toolbars use independent Start date and End date calendar boxes separated by 'to'.
