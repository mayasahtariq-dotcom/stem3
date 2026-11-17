"""Reference data (quests, badges) as idempotent SQL; used by the migration."""
import json

from app.game.badges import all_badges

QUESTS = [  # code, kind, target, gems, event
    ("answer_10", "daily", 10, 20, "answer"),
    ("combo_3", "daily", 1, 20, "combo"),
    ("lesson_1", "daily", 1, 20, "lesson"),
    ("lessons_5", "weekly", 5, 20, "lesson"),
    ("revision_5", "revision", 5, 40, "revision"),
]


def _q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def seed_reference_sql() -> str:
    parts = []
    for code, kind, target, gems, event in QUESTS:
        parts.append(f"insert into quests(kind, code, target, gems, event) values "
                     f"({_q(kind)},{_q(code)},{target},{gems},{_q(event)}) on conflict (code) do nothing;")
    for code, title in all_badges().items():
        parts.append(f"insert into badges(code, title) values ({_q(code)},"
                     f"{_q(json.dumps({'en': title}))}::jsonb) on conflict (code) do nothing;")
    return "\n".join(parts)
