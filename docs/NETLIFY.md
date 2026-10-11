# Netlify frontend and Render backend

## Hosting layout

Netlify builds the Next.js frontend and serves HTTPS. Render hosts FastAPI and a managed PostgreSQL database in the same region. A custom domain is optional: browser API calls use `/api/v1/` on the Netlify address. The Netlify edge function forwards them to the configured HTTPS backend, preserving HttpOnly session cookies and CSRF checks without third-party cookies.

Office network verification uses Netlify's `context.ip`, authenticated to FastAPI with a private proxy secret. Visitor-supplied IP/proxy headers are discarded. When the backend has this secret configured, direct `/api/v1/` requests without it are rejected. `/health` and `/ready` remain accessible for hosting health checks. Never configure the office network using a hosting provider's address.

## Netlify project

Import the GitHub repository, select `main`, and use the root `netlify.toml`. Its base is `frontend`, build command is `pnpm build`, and publish directory is `.next`. Netlify automatically supplies its Next.js adapter. Do not use a static HTML export or upload the source folder with Netlify Drop.

The file sets Node.js 22, pnpm 11.25 and an empty `NEXT_PUBLIC_API_BASE_URL`, selecting the same-origin proxy. Set these private values in Netlify's environment dashboard with **Functions** scope and **Production** context only:

| Variable | Value |
| --- | --- |
| `CLOCKIN_BACKEND_ORIGIN` | Real HTTPS Render API origin, with no path/query/credentials. |
| `CLOCKIN_PROXY_SECRET` | Private random value of at least 32 characters, identical to the backend value. |

Generate the shared secret privately, for example with Python's `secrets.token_urlsafe(48)`; do not commit or paste it into chat. Redeploy after changing edge environment variables. A missing backend/secret produces a truthful API-not-configured response; publishing the frontend alone does not make attendance functional.

Set optional `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` in **Builds / Production** scope. A Maps JavaScript browser key is visible in browser assets by design: restrict it to the exact frontend website and required Google APIs. Backend credentials must never have a `NEXT_PUBLIC_` prefix. See `GOOGLE_MAPS.md`.

## Render services

Create managed PostgreSQL and a native Python web service from the same GitHub repository. Choose a region near the office and keep the database private to the backend. Review the provider's current plan pricing before creating billable services; production backups, persistence and availability must be approved. No resources are created by these repository files.

Web-service root directory: `backend`.

- Build: `python -m pip install uv==0.12.24 && uv sync --frozen --no-dev`
- Start: `bash ../scripts/start-production-backend.sh`
- Health check: `/ready`
- Python version: a supported Python 3.12 release.
- Auto-deploy: Off; release only approved commits manually.

Set these variables privately in Render:

| Variable | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | Managed PostgreSQL internal connection URL, using the `postgresql://` or `postgresql+psycopg://` scheme. Configure TLS as required by the database provider. |
| `FRONTEND_ORIGIN` | Exact published Netlify HTTPS origin, with no trailing slash. |
| `APP_BASE_URL` | The same Netlify HTTPS origin for activation/recovery links. |
| `COOKIE_SECURE` | `true` |
| `CLOCKIN_PROXY_SECRET` | The shared private proxy value. |
| `TRUSTED_PROXY_CIDRS` | Empty; this deployment uses the authenticated edge proxy. |

Add approved SMTP settings privately when email is ready. The start script applies compatible Alembic migrations before starting the API. Back up existing databases before release. Confirm `/ready` returns 200, then bootstrap a real administrator privately with the existing CLI on the backend host. An empty cloud database does not contain local accounts. Transfer any existing data only through an approved encrypted database migration; never through GitHub.

Production JSON logs go to provider stdout and the local rotating log file. Hosting filesystems may be ephemeral; configure provider log retention/drains and database backups according to company policy. No passwords, tokens, proxy secrets or submitted request bodies are logged by the proxy.

## Local development and approved releases

Keep `backend/.env` and `frontend/.env.local` unchanged: local frontend calls the local API, local cookies remain non-secure, and the proxy secret is empty locally. Production values live only in hosting dashboards. Never copy production database credentials into public examples.

For future changes: implement locally → run Build and Code Checks → show the concrete change to the owner → receive approval → push the approved commit to GitHub → deploy the approved backend commit and compatible migrations → publish the matching Netlify build. Unapproved work stays local. GitHub Actions checks code; it does not approve, merge or deploy changes.

For a second publication safeguard, lock the first successful Netlify deploy with **Lock to stop auto publishing**. Later pushes can build a candidate without replacing the live site; publish that candidate only after approval. Deploy previews must use a separate staging backend/database and separate proxy secret, never production secrets or a wildcard production CORS origin. Unconfigured previews show the explicit unavailable state.

After deploying, verify real login/session persistence, password/PIN recovery, role restrictions, office-network and location checks, timestamps, CSV exports, and data persistence after a backend restart. Frontend-only deployment is not production acceptance. Roll back application versions only when compatible with the deployed database schema.

References: [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [edge context and environment](https://docs.netlify.com/build/edge-functions/api/), [Render FastAPI](https://render.com/docs/deploy-fastapi), [Render PostgreSQL](https://render.com/docs/postgresql-creating-connecting), [Netlify publishing controls](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/).
