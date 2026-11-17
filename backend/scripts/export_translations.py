"""Write docs/translation-review-sheet.md: every Hindi/Kannada line next to its English, for a
native speaker to check before the pilot (PRD: every regional string is a draft until reviewed).

Run from backend/:  python scripts/export_translations.py
"""
from pathlib import Path

from app.calls.script import LINES
from app.jobs.scheduler import WEEKLY
from app.notify import MESSAGES

OUT = Path(__file__).resolve().parents[2] / "docs" / "translation-review-sheet.md"


def cell(s: str) -> str:
    return s.replace("|", r"\|").replace("\n", " ")


rows = ["# Translation review sheet", "",
        "Every Hindi (hi) and Kannada (kn) line the backend speaks or sends. All are drafts.",
        "Reviewer: correct the text in place in the source file shown, then tick the box.", "",
        "| Source | Key | English | Hindi | Kannada | OK |", "|---|---|---|---|---|---|"]
for key in LINES["en"]:
    rows.append(f"| calls/script.py | {key} | {cell(LINES['en'][key])} | {cell(LINES['hi'].get(key, ''))} "
                f"| {cell(LINES['kn'].get(key, ''))} | [ ] |")
rows.append(f"| notify.py | course_complete_sms | {cell(MESSAGES['en'])} | {cell(MESSAGES['hi'])} | {cell(MESSAGES['kn'])} | [ ] |")
rows.append(f"| jobs/scheduler.py | weekly_sms | {cell(WEEKLY['en'])} | {cell(WEEKLY['hi'])} | {cell(WEEKLY['kn'])} | [ ] |")
OUT.write_text("\n".join(rows) + "\n", encoding="utf-8")
print(f"wrote {OUT} ({len(rows) - 7} lines)")
