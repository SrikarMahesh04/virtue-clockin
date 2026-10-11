"""Clean only the schema recorded by the isolated browser-test server."""

import json
import os
import re
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

fixture = Path(__file__).resolve().parents[1] / ".tools/e2e-fixture.json"
if fixture.exists():
    url = os.environ.get("TEST_DATABASE_URL", "")
    if "test" not in (make_url(url).database or ""):
        raise SystemExit("Cleanup requires the dedicated TEST_DATABASE_URL")
    schema = json.loads(fixture.read_text(encoding="utf-8")).get("schema", "")
    if not re.fullmatch(r"e2e_[0-9a-f]{32}", schema):
        raise SystemExit("No validated browser-test schema to clean")
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
    engine.dispose()
    fixture.unlink(missing_ok=True)
