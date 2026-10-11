$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $taskRoot 'backend')
try {
    uv run ruff check .
    if ($LASTEXITCODE) { throw 'Backend lint failed' }
    uv run ruff format --check .
    if ($LASTEXITCODE) { throw 'Backend format check failed' }
    uv run mypy app
    if ($LASTEXITCODE) { throw 'Backend typing failed' }
    uv run pytest -q
    if ($LASTEXITCODE) { throw 'Backend tests failed' }
} finally { Pop-Location }
Push-Location $taskRoot
try {
    uv run --project backend python scripts/export_contract.py --check
    if ($LASTEXITCODE) { throw 'OpenAPI contract is stale' }
} finally { Pop-Location }
Push-Location (Join-Path $taskRoot 'frontend')
try {
    pnpm typecheck
    if ($LASTEXITCODE) { throw 'Frontend typing failed' }
    pnpm lint
    if ($LASTEXITCODE) { throw 'Frontend lint failed' }
    pnpm test
    if ($LASTEXITCODE) { throw 'Frontend tests failed' }
    pnpm build
    if ($LASTEXITCODE) { throw 'Frontend build failed' }
} finally { Pop-Location }
