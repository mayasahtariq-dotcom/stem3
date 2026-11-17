"""Write the OpenAPI contract for P2/P3: python scripts/export_openapi.py"""
import json
from pathlib import Path

from app.main import app

out = Path(__file__).resolve().parents[2] / "packages" / "api-client" / "openapi.json"
out.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {out}")
