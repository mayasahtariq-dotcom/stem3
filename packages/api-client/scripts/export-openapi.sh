#!/bin/sh
# Re-exports the FastAPI backend's OpenAPI document into openapi/backend.json.
# Needs the backend's virtualenv (see CLAUDE.md). Then run `pnpm generate`.
set -e
cd "$(dirname "$0")/../../../backend"
PY="${PYTHON:-.venv/bin/python}"
[ -x "$PY" ] || PY=".venv/Scripts/python"
"$PY" -c "
import json, os
os.environ.setdefault('DATABASE_URL', 'postgresql+psycopg://openapi:openapi@localhost/openapi')
from app.main import app
json.dump(app.openapi(), open('../packages/api-client/openapi/backend.json', 'w'), indent=1)
"
echo "wrote packages/api-client/openapi/backend.json"
