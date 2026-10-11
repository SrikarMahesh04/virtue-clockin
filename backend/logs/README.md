# Internal application logs

The running API and operator commands write JSON lines to `backend/logs/clockin.log`.
The file is created on the first event. Each line includes a UTC timestamp and event type.
HTTP records include method, route template, status, elapsed milliseconds, and request ID.
Committed changes include action, actor/target identifiers, and request ID.

No request bodies, query strings, passwords, PINs, activation/reset tokens, location
coordinates, or before/after payloads are recorded. Unmatched URLs are logged as
`unmatched` rather than retaining the supplied path. Database failures omit raw SQL.

Files rotate at 5 MB, retaining three backups (`clockin.log.1` through `.3`). These
files are ignored by Git and have no web endpoint. Restrict folder access to operators.
This rotation supports the current single-process local API; configure centralized
logging before running multiple production workers. Automated tests use isolated files.

Security & Audit and My Notes screens/APIs have been retired. Historical tables remain
in the database to avoid deleting existing records; active code does not read or write them.
