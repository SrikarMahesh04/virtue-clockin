# Virtue ClockIn - product requirements

## Accepted scope

Responsive browser attendance for desktop/laptop and phone, for one organization and office. Phone location verification requires trusted HTTPS, browser permission and the same backend attendance policy. Roles: Employee, Admin, Super Administrator. Dark charcoal/cyan wireframes define the visual direction. Local-first implementation, no Docker, no fake application data. Preserve Abstract.md as the original functional reference.

Employees sign in with email/password or email and their own six-digit PIN. They choose both credentials during activation. This replaces the earlier device-bound PIN proposal. Local login uses the two supported methods; Manager delegation is deferred.

## Pages

Authentication: /login, /login/pin, /forgot-password, /reset-password. Supporting activation: /activate.
Employee: /employee/dashboard, /employee/attendance, /employee/calendar, /employee/notifications, /employee/profile.
Admin: /admin/dashboard, /admin/employees, /admin/attendance, /admin/shifts, /admin/calendar, /admin/reports, /admin/settings.

## Acceptance

- Real operator bootstrap; no default account. Admin creates employees and effective shift assignments. Employees choose their own password/PIN through single-use activation.
- Session-cookie authentication, role/resource authorization, throttled login/recovery, PIN lockout and password elevation for admin access.
- One ordinary Punch In/Out per office-local day; server time; concurrent duplicate protection. Both configured geofence and approved network must pass. Missing configuration blocks punches.
- Same-day shifts, effective assignments, preserved historical snapshots and full elapsed Punch In–Out duration without automatic deductions. No invented Punch Out for incomplete days.
- Inclusive twenty-minute grace; fifth monthly unexcused late warns, sixth flags review. No automatic financial sanction. Historical approved permissions retain their effect on recorded attendance.
- Requests and approvals are removed from employee/admin navigation, pages and APIs at this stage. Historical records and audit history are retained.
- Manual correction and new correction requests are unavailable at this stage; existing originals and audit history are retained.
- Employee calendar month/week/day views, employee-specific or all-employee holidays/work-from-home dates, in-app notifications, employee management and filtered CSV reports.
- Empty lists remain empty; failed APIs are never displayed as zero metrics. Unavailable email recovery reports its state truthfully. No external service is simulated.

## Policy and boundaries

Saturday/Sunday default weekly off, configurable during real setup. Shift start/end times are entered by the administrator, not preseeded. Ordinary attendance is a calculation, not proof of continuous presence. Browser/mobile restrictions do not attest company hardware.

No payroll deductions, native mobile attendance, multi-office, Outlook Calendar sync, leave-balance accounting, continuous tracking or managed-device guarantee. Scheduled reminders are deferred until a scheduler is configured. Production hosting, real office values, privacy/retention sign-off and corporate integrations remain operator tasks.

Department management and employee department assignment are removed at this stage. Attendance filters offer Present and Late; weekly-off placeholder rows are hidden from records and exports, while real work remains visible.

Security & Audit and My Notes are retired from both workspaces and the API. Historical database tables remain untouched; no active note or database audit operations remain. Internal rotating JSON logs live in backend/logs/clockin.log; see backend/logs/README.md. Attendance/report toolbars use independent Start date and End date calendar boxes separated by 'to'.
