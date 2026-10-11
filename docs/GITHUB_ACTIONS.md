# GitHub Actions

The **Build and Code Checks** workflow runs on pushes to `main`, pull requests, and manual runs from the repository's Actions tab. It uses clean GitHub-hosted machines to catch code and build problems before release.

| Job | What it checks |
| --- | --- |
| Backend and OpenAPI | Locked Python dependency installation, Ruff lint/format, mypy types, and whether the committed OpenAPI matches FastAPI. |
| Frontend Build and API Types | Locked JavaScript dependency installation, ESLint, generated frontend API types, Next.js production build, and TypeScript. |

Both jobs run independently. Each has named steps, error logs and a result table in the run summary. A failed check fails its job; later checks in that job are skipped. A successful run verifies these checks, not every business workflow.

## Privacy and scope

No company database, employee records, local environment files, Maps key, email password or other company secrets are needed. There are no database migrations, application deployments, automated test suites or automatic code changes. GitHub grants read-only repository access to the runner; action versions are pinned to commit IDs. New runs cancel older in-progress runs for the same branch or pull request.

## When a run fails

1. Open **Actions → Build and Code Checks → the failed run**.
2. Select the failed job and expand the first failed step. The summary also identifies failed/skipped checks.
3. Fix the reported source/configuration problem locally. For contract drift, regenerate `contracts/openapi.json` with `scripts/export_contract.py`, run `pnpm contracts` and format `src/generated/schema.d.ts`, then commit both generated files.
4. Push the correction; GitHub starts a new run. For a temporary download or runner failure, use **Re-run failed jobs**. Rerunning unchanged code does not repair a code error.

Run local equivalents with `scripts/check.ps1`. To start manually, use **Actions → Build and Code Checks → Run workflow**. Share the failed step's log when requesting help, after removing any sensitive values that may have been added separately.
