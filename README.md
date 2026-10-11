# Virtue ClockIn

A web application for managing employee attendance, shifts and office calendars, with a dark interface for employees and administrators.

## Features

- Role-based access for Super Admin, Admin and Employee.
- Password or PIN sign-in and account recovery.
- Location-verified Punch In and Punch Out.
- Employee management, shift assignments and monthly Employee IDs.
- Holiday and Work From Home calendars.
- Attendance filters and CSV exports.

## Technology

Next.js, TypeScript and Tailwind CSS on the frontend; FastAPI, SQLAlchemy and PostgreSQL on the backend.

## Local setup

Requires Node.js 22+, pnpm 11.25+, Python 3.12+, uv and PostgreSQL 16+. No Docker is required.

1. Copy each application's `.env.example` to its local environment file and supply your own configuration privately.
2. In `backend/`, run `uv sync --frozen`, then `uv run alembic upgrade head`.
3. Create the first administrator with `uv run python -m app.cli bootstrap --email YOUR_EMAIL --name YOUR_NAME`. Choose credentials at the private prompts.
4. Start the backend with `uv run uvicorn app.main:app --host 127.0.0.1 --port 8000`.
5. In `frontend/`, run `pnpm install --frozen-lockfile`, then `pnpm dev`. Open `http://localhost:3000`.

Configure your office and employee accounts after signing in. Maps and email services require your own provider configuration.

## Configuration privacy

Never commit passwords, API keys, database credentials or private environment files. Example configuration contains placeholders only; local configuration, runtime logs and generated build files are excluded from Git. Existing accounts and attendance data are not included in this repository.

See [deployment](docs/DEPLOYMENT.md) for operator guidance. [GitHub Actions](docs/GITHUB_ACTIONS.md) checks builds, code quality and API contracts; automated test suites remain excluded.

Hosting: [Netlify frontend and Render backend setup](docs/NETLIFY.md). Local and production configuration are separate; publish future changes only after owner approval.
