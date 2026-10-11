# Repository working instructions

- Keep local development and production configuration separate. Preserve ignored `backend/.env` and `frontend/.env.local`; production credentials belong only in hosting dashboards.
- For future changes, implement and check locally, present the concrete change for owner review, and push to GitHub or publish to Netlify/Render only when the owner authorizes that release. An explicit request to push/deploy the current change already supplies that authorization.
- Automated test suites are intentionally removed. Use the existing lint, type, contract and build checks; do not restore test frameworks without a request.
- Read `frontend/AGENTS.md` and the installed Next.js documentation before applicable frontend changes.
- Production uses the Netlify edge API proxy and a separately hosted FastAPI/PostgreSQL service. Preserve authenticated visitor-IP forwarding, HttpOnly secure cookies, CSRF checks and exact production origins. See `docs/NETLIFY.md`.
- Never commit credentials, environment files, database exports, employee records, logs, provider state or build artifacts.
- Neon CLI commands must use `--no-env-pull` for link, checkout and deploy. The ignored `.neon` context selects the cloud branch; it must not redirect local development to production. Neon MCP is project-scoped, OAuth-only and read-only.
