# Netlify frontend and Render backend

## Hosting layout

Netlify builds the Next.js frontend and serves HTTPS. Render hosts FastAPI; PostgreSQL can run on Neon separately. A custom domain is optional: browser API calls use `/api/v1/` on the Netlify address. The Netlify edge function forwards them to the configured HTTPS backend, preserving HttpOnly session cookies and CSRF checks without third-party cookies.

## Current zero-cost deployment requirement

Use **Netlify Free**, **Render Free web service**, and **Neon Free PostgreSQL**. Do not create Render Free PostgreSQL: its database expires after 30 days. Do not select a paid trial, upgrade, add-on, persistent disk or paid domain. Keep Render and Neon without a payment method; if a provider requires one or cannot enforce zero spending, stop provisioning that service. Verify the actual account plan in each dashboard, not just the selected service size.

Netlify Free has a hard usage limit and pauses sites instead of charging overages. Render Free services without a payment method suspend or stop builds at applicable limits. Neon Free has finite storage and compute allowances; keep the project on Free and review its current quota behavior in the dashboard. Free quotas and provider policies can change; availability is not guaranteed. Render explicitly describes its Free instances as unsuitable for production applications. This setup is a free hosted evaluation, not an assurance of uninterrupted employee attendance service.

Render Free sleeps after 15 minutes without traffic and can take about a minute to wake. The edge proxy may time out during that wake-up: wait and retry deliberately, checking the current attendance state before submitting another punch. Never automatically replay a credential or punch request. Do not add artificial keep-alive traffic. Database storage must remain on Neon, not the ephemeral backend filesystem.

For this zero-cost deployment, leave Google Maps billing APIs and SMTP settings unset. Browser geolocation and server-side geofence checks do not require a Google Maps API key. Use the existing coordinate setup if the map picker is unavailable. Recovery/activation links use the existing explicit operator workflow until a compatible free email delivery service is configured; the UI must not claim an email was sent. Render Free blocks standard SMTP ports. No existing employee data is transferred by deployment; obtain specific approval for an encrypted migration to the chosen cloud database.

Current provider references: [Netlify Free limits](https://www.netlify.com/pricing/), [Render Free restrictions](https://render.com/docs/free), [Neon Free plan](https://neon.com/pricing).

Office network verification uses Netlify's `context.ip`, authenticated to FastAPI with a private proxy secret. Visitor-supplied IP/proxy headers are discarded. When the backend has this secret configured, direct `/api/v1/` requests without it are rejected. `/health` and `/ready` remain accessible for hosting health checks. Never configure the office network using a hosting provider's address.

## Netlify project

Import the GitHub repository, select `main`, and use the root `netlify.toml`. Its base is `frontend`, build command is `pnpm build`, and publish directory is `.next`. The explicit `@netlify/plugin-nextjs` entry ensures App Router output is adapted in this multi-package repository. A successful deployment must include the generated Next.js server function; raw `.next` files alone cannot serve the application. Do not use a static HTML export or upload the source folder with Netlify Drop.

The file sets Node.js 22, pnpm 11.25 and an empty `NEXT_PUBLIC_API_BASE_URL`, selecting the same-origin proxy. Set these private values in Netlify's environment dashboard with **Functions** scope and **Production** context only:

| Variable | Value |
| --- | --- |
| `CLOCKIN_BACKEND_ORIGIN` | Real HTTPS Render API origin, with no path/query/credentials. |
| `CLOCKIN_PROXY_SECRET` | Private random value of at least 32 characters, identical to the backend value. |

Generate the shared secret privately, for example with Python's `secrets.token_urlsafe(48)`; do not commit or paste it into chat. Redeploy after changing edge environment variables. A missing backend/secret produces a truthful API-not-configured response; publishing the frontend alone does not make attendance functional.

If Free does not allow individual scopes, use the available server scopes and keep values restricted to Production. Mark the proxy value as secret. Never prefix either value with `NEXT_PUBLIC_` or include it in source code.

Set optional `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` in **Builds / Production** scope. A Maps JavaScript browser key is visible in browser assets by design: restrict it to the exact frontend website and required Google APIs. Backend credentials must never have a `NEXT_PUBLIC_` prefix. See `GOOGLE_MAPS.md`.

## Render services

### Neon workspace tooling

The root `neon.ts` is the minimal PostgreSQL policy requested for this app: `defineConfig({})`. It does not deploy FastAPI, change application authentication or create Functions, storage buckets or AI services. Root `package.json` and `package-lock.json` contain the official Neon config/env tooling, separate from the frontend pnpm package. Run `npm ci` to restore it and install the official Neon CLI when needed (`npm install -g neon`).

Sign in privately with `neon login`, then link the chosen project with `neon link --project-id <project-id> --branch production -y --no-env-pull --no-config`. Preview with `npm run neon:plan`; apply with `npm run neon:deploy`, which retains `--no-env-pull`. Keep Alembic as the application schema migration system.

Neon overview and PostgreSQL agent skills are installed locally in `.agents/skills/`. The project `.codex/config.toml` registers Neon MCP using OAuth, read-only tools and a pin to the chosen project. This config contains no API key and may require reloading Codex and completing its OAuth prompt before tools appear. CLI sign-in is separate from MCP sign-in. Both these agent directories, `skills-lock.json` and the `.neon` project context are ignored by Git; do not replace an existing developer configuration on another checkout.

Create a native Python **Free** web service from the GitHub repository and a **Free** PostgreSQL project on Neon. Choose nearby regions. Copy Neon's direct PostgreSQL connection URL privately into Render's `DATABASE_URL`, preserving its required TLS parameters (such as `sslmode=require`). Do not put it in Netlify's frontend build variables or GitHub. No resources are created by these repository files.

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
| `DATABASE_URL` | Private Neon PostgreSQL connection URL, using the `postgresql://` or `postgresql+psycopg://` scheme with provider-required TLS parameters. |
| `FRONTEND_ORIGIN` | Exact published Netlify HTTPS origin, with no trailing slash. |
| `APP_BASE_URL` | The same Netlify HTTPS origin for activation/recovery links. |
| `COOKIE_SECURE` | `true` |
| `CLOCKIN_PROXY_SECRET` | The shared private proxy value. |
| `TRUSTED_PROXY_CIDRS` | Empty; this deployment uses the authenticated edge proxy. |

Leave SMTP unset on the current free deployment. The start script applies compatible Alembic migrations before starting the API. Back up existing databases before release. Confirm `/ready` returns 200, then bootstrap a real administrator privately with the existing CLI using a temporary operator environment connected to the cloud database. Render Free has no dashboard shell or one-off jobs; do not place bootstrap credentials in the build/start command or logs. Preserve the local development environment files. An empty cloud database does not contain local accounts. Transfer any existing data only through an approved encrypted database migration; never through GitHub.

Production JSON logs go to provider stdout and the local rotating log file. Hosting filesystems may be ephemeral; configure provider log retention/drains and database backups according to company policy. No passwords, tokens, proxy secrets or submitted request bodies are logged by the proxy.

For a new empty database, `python -m app.cli bootstrap --email <owner-email> --name <owner-name> --activation-link` creates only a pending Super Admin and outputs a private single-use activation link valid for 30 minutes. Run it in a temporary operator process connected to the intended database with the hosted `APP_BASE_URL`; do not modify local `.env` files. The empty-table guard and transaction lock prevent additional bootstrap accounts. Keep output out of shared logs and Git. The owner opens the link and chooses their password and PIN privately. This is separate from `issue-link`, whose production restriction remains in place.

## Local development and approved releases

Keep `backend/.env` and `frontend/.env.local` unchanged: local frontend calls the local API, local cookies remain non-secure, and the proxy secret is empty locally. Production values live only in hosting dashboards. Never copy production database credentials into public examples.

For future changes: implement locally → run Build and Code Checks → show the concrete change to the owner → receive approval → push the approved commit to GitHub → deploy the approved backend commit and compatible migrations → publish the matching Netlify build. Unapproved work stays local. GitHub Actions checks code; it does not approve, merge or deploy changes.

For a second publication safeguard, lock the first successful Netlify deploy with **Lock to stop auto publishing**. Later pushes can build a candidate without replacing the live site; publish that candidate only after approval. Deploy previews must use a separate staging backend/database and separate proxy secret, never production secrets or a wildcard production CORS origin. Unconfigured previews show the explicit unavailable state.

After deploying, verify real login/session persistence, password/PIN recovery, role restrictions, office-network and location checks, timestamps, CSV exports, and data persistence after a backend restart. Frontend-only deployment is not production acceptance. Roll back application versions only when compatible with the deployed database schema.

References: [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [edge context and environment](https://docs.netlify.com/build/edge-functions/api/), [Render FastAPI](https://render.com/docs/deploy-fastapi), [Render PostgreSQL](https://render.com/docs/postgresql-creating-connecting), [Netlify publishing controls](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/).
