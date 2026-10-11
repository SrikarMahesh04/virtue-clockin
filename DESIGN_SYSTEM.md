# Virtue ClockIn — Design System and Wireframe Specification

**Identity:** Dark charcoal/cyan wireframes WFL 1–6 define the accepted visual direction. The supplied full Virtue logo is used in portal navigation and authentication pages. No company favicon is configured, as requested. The logo retains its proportions and transparency. Colors are implementation tokens, subject to final brand review.

UI headings, navigation, field labels, actions, and status names use initial capitals (for example, **Work From Home**). Body descriptions remain sentence case; names and entered data retain their original spelling.

## Brand tokens
| Role | Proposed token | Use |
|---|---|---|
| Teal | `#20E0DB` | Brand mark, accents, icon highlights |
| Accessible action teal | `#20E0DB` | Primary button/focus candidate; confirm WCAG contrast |
| Primary text | `#EDF5F7` | Headings and body text |
| Muted gray | `#A7BAC3` | Secondary text |
| Background | `#0B1114` | Page backdrop |
| Surface | `#121B20` | Cards/dialogs/forms |
| Border | `#30424C` | Dividers and boundaries |
| Warning | semantic amber | Late / pending |
| Danger | semantic red | Absent / security errors |
| Success | semantic green/teal | Confirmed punches/approved |

Brand teal should not be the sole conveyance of attendance status. Use dark #042C31 text on cyan actions; check small icons, charts and visible control boundaries.

## Layout foundations
- Laptop/desktop first; initial attendance access restricted on mobile per abstract, with clear explanation (admin mobile support to confirm).
- **AuthLayout:** centered logo/form/SSO/PIN/recovery with plain help states.
- **EmployeeLayout:** logo, sidebar, topbar with office clock + alerts + profile; content max width and consistent page title.
- **AdminLayout:** wider sidebar, page-level action toolbar, filters, tables, details drawers, analytics widgets.
- **SystemStateLayout:** initial setup, 403/404, empty/loading/error/integration-required states.
- Choose spacing from a consistent 4/8px rhythm, 8–12px corner radius, consistent text scales, keyboard-focused accessible controls. Confirm typography family with company; system sans-serif initially.

## Pages and wireframe component contracts
| # | Route | Mandatory wireframe regions |
|---|---|---|
| 1 | `/login` | Company branding; email/password; forgot; PIN link |
| 2 | `/login/pin` | Company email; employee-chosen six-digit PIN input; throttled validation; password fallback |
| 3 | `/forgot-password` | Corporate email; request; neutral acknowledgement; sign-in return |
| 4 | `/reset-password` | Token/code verification; new/confirm password; strength feedback; expiry/error |
| 5 | `/employee/dashboard` | Office clock/date; today's shift; hours/status; In/Out except on Work from home dates; calendar link |
| 6 | `/employee/attendance` | Date/status filters; table; totals in hours and minutes |
| 7 | `/employee/calendar` | Month/week/day switch; month grid; date details; schedule/holiday |
| 10 | `/employee/notifications` | All/unread/categories; message list; read action; empty state |
| 11 | `/employee/profile` | Profile; auth method; password where local; password-authenticated PIN change; unavailable integrations |
| 12 | `/admin/dashboard` | Workforce KPI tiles; trend chart; open workdays; late-arrival flags |
| 13 | `/admin/employees` | Search/filters; table; new employee; edit/role/shift/deactivate/reset drawer |
| 14 | `/admin/attendance` | Horizontal toolbar with separate Start date / to / End date calendar boxes plus Employee and Status dropdowns; table with Net/Expected hours in hours and minutes; no manual correction action |
| 16 | `/admin/shifts` | Shift list with Create new shift above the table; centered create/edit dialogs with Close/Cancel; six-row scrolling AM/PM menus; active/inactive; confirmed deletion |
| 17 | `/admin/calendar` | Equal-width desktop halves: options on the left and calendar on the right; Holiday/Work from home; employee dropdown including All employees; date picker; save/remove |
| 18 | `/admin/reports` | Filters; charts; report table; CSV export; empty state |
| 20 | `/admin/settings` | Organization, office geofence, timezone, accuracy and weekly-off settings; no integration readiness panel |

## Shared components
`AppShell`, `SidebarNav`, `PageHeader`, `Clock`, `PunchActionPanel`, `StatCard`, `StatusBadge`, `DataTable`, `FilterBar`, `CalendarGrid`, `DayDetailPanel`, `ConfirmDialog`, `EmptyState`, `LoadingState`, `ErrorState`, `IntegrationRequired`.

## Accessibility and content rules
- Keyboard navigation, focus indicators, proper labels, semantic headings, screen-reader alerts for punch outcome.
- Never display fictitious metrics or example employees in live UI. Empty lists and charts say what is missing; empty != zero if API failed.
- Do not render disabled mock "working" CTAs; unconfigured features explicitly unavailable, with action for authorized admins.
- Calendar day colors supplemented by symbols/text and legend; date and time formatted to organization timezone.
- Display official logo assets in `frontend/public/branding/`; optimize image while preserving proportions.

## Detailed wireframes
The six supplied dark wireframe sheets are original references. Sixteen primary routes remain active; employee/admin request routes are removed. Implement responsive desktop-first layouts, accessible controls, and mutually exclusive populated/empty/loading/error states; illustration placeholders are not application records. Use dark text on cyan buttons for contrast. The topbar and dashboard show server-synchronised office time without a device-time label; unavailable or stale time is reported explicitly.

Dates display as DD-Mmm-YYYY (11-Oct-2026), including record timestamps, assignments, calendar details, filters and entry fields. Record pagination uses labelled left/right icons only when another page exists, with viewport-sized pages and a lookahead row.


## Simplified calendar and unified attendance (11-Oct-2026)

The calendar is a month grid with only previous/next month arrows and a centered heading. Before selection and after month navigation, the heading shows the month and year (October 2026). Selecting a grid date or using the date input changes it to the full date (21 October 2026). Today and month/week/day controls are removed. Holiday dots, hover/focus details, individual scopes and working optional dates remain supported.

Attendance is the single administrator records page. Its compact filter toolbar includes Export CSV, using the applied date range, employee and status across all matching records, independently of the current record page. Invalid date edits disable export until resolved. The separate Reports & analytics navigation item, screen and report-only charts are removed; /admin/reports returns 404. The existing protected CSV API is retained for compatibility, and employee export permissions are unchanged. No database migration or company-data changes are required for this UI consolidation.

## Page transition feedback

Internal page navigation shows a fixed charcoal overlay with a cyan spinner and Loading Page label. Wait one second before navigating, then retain the overlay until the route transition commits. Background content is inert while navigating; assistive technologies receive a status announcement. Reduced-motion preferences disable rotation. Switching between password and PIN sign-in is immediate, retains the entered email, and does not show this overlay. Same-page anchors, filters, editing dialogs, credential visibility and other internal actions do not trigger this overlay.
