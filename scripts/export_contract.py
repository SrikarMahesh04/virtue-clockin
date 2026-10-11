"""Run from repository root using backend/.venv/Scripts/python."""

import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
from app.main import app

target = root / "contracts" / "openapi.json"
content = json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"
if "--check" in sys.argv:
    if not target.exists() or target.read_text(encoding="utf-8") != content:
        raise SystemExit(
            "OpenAPI contract is stale. Run scripts/export_contract.py and regenerate TypeScript."
        )
else:
    target.parent.mkdir(exist_ok=True)
    target.write_text(content, encoding="utf-8")
