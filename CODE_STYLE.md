# Virtue ClockIn — Code Style and Engineering Standards

## General
- Code must reflect true production behavior. No hardcoded test accounts, dummy metrics, fake API success, prefilled employee data or silent fixture fallbacks.
- Each change must include relevant backend, frontend, schema and documentation updates. Keep pull requests focused and reference PRD IDs.
- Prefer explicit, readable modules over generic frameworks; meaningful names; eliminate duplicated policy calculations.
- Validate inputs on both UX boundary and server; server is authoritative.
- Keep secrets out of code and logs. `.env.example` contains names/documented placeholders, no credentials.

## Frontend (Next.js + TypeScript)
- Strict TypeScript; never use `any` without approved documented reason.
- App Router: route files for composition, feature components/hooks for business presentation, shared primitives under components.
- API requests via openapi-fetch and generated types from `contracts/openapi.json`; do not fork hand-written incompatible DTOs.
- Prefer accessible semantic HTML and keyboard interactions; use Tailwind design tokens, avoid scattered literal hex values.
- Distinguish UI states as loading / empty / error / needs configuration / ready. Never display 0 when request failed.
- Forms show validation errors without disclosing sensitive internal behavior.
- Use ESLint, formatter (Prettier) and TypeScript compile checks locally. Automated test suites and their GitHub workflow are currently removed.

## Backend (Python FastAPI)
- Python 3 typing and Pydantic v2 for external DTOs. Ruff lint + format; selected Python static type checker.
- Separate API routers, application services, pure domain rules, SQLAlchemy repository implementations.
- No ORM models exposed directly as public API; no database/session access in domain calculation code.
- Use Alembic for migrations, never uncontrolled runtime schema creation in production.
- Transactions for Punch In/Out and approvals; explicit concurrency-safe conflicts and idempotency semantics.
- Standard structured error shape and request ID; use stable error codes, not error text parsing in frontend.
- UTC persisted timestamps, convert to configured office timezone at relevant policy boundaries.

## Branch/PR convention (proposal)
`feature/<ticket>-short-name`, `fix/<ticket>-short-name`, `docs/<topic>`. Conventional commits recommended (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`). Require review for schema, security and policy changes.

## PR checklist
- [ ] Requirement/acceptance reference documented
- [ ] API schemas and generated client in sync
- [ ] Migration and rollback/compatibility considered
- [ ] No mock data or embedded production secrets
- [ ] AuthZ, audit and privacy implications considered
- [ ] Frontend empty/loading/error states correct
- [ ] Local lint, type, contract and build checks passing
- [ ] Changelog, ENV and relevant docs updated
