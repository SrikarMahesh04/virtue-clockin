# Architecture

One repository, separate frontend/backend runtimes, shared generated OpenAPI contract and PostgreSQL. No Docker or browser database access.

```text
Browser -> Next.js -> typed /api/v1 -> FastAPI modules -> PostgreSQL
                                       | pure attendance rules
                                       | optional SMTP
Operator CLI --------------------------+ bootstrap / private local account links
```

`backend/app/domain.py` owns pure attendance math. API modules use shared authorization/application services and SQLAlchemy transactions. `models.py` describes current storage; `schema_v1.py` freezes the initial migration and must not be changed for later schema evolution. Alembic owns schema changes and immutability triggers.

Frontend routes compose feature screens and shared navigation/auth shells. All JSON calls use generated types. UI states distinguish loading, empty, failed and unavailable dependencies. Backend role/owner checks are authoritative.

Attendance writes serialize on employee rows and daily/idempotency uniqueness. Original attendance events are immutable. Retired audit/note tables remain historical storage only; internal operational events use rotating JSON files. Attendance snapshots capture shift, timezone, calendar classification and office policy.

Cross-layer changes: acceptance criteria -> domain/DTOs/migration -> generated OpenAPI/types -> affected UI -> lint/type/contract/build checks -> docs. Build and Code Checks runs these checks on GitHub without company services or credentials; automated test suites remain removed at the user's request. Compatible migrations precede backend/frontend release.

Initial local ports: frontend 3000, API 8000. No configured database means no readiness. Hosted deployment follows local acceptance and docs/DEPLOYMENT.md. PIN authentication is employee-chosen email/PIN by explicit user decision, replacing earlier device-binding proposals.
