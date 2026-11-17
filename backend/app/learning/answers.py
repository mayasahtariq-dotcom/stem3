"""Server-side answer checking. The browser never decides if an answer is right."""
from typing import Any


def _norm(v: Any) -> str:
    return " ".join(str(v).strip().lower().split())


def _as_bool(v: Any) -> bool | None:
    if isinstance(v, bool):
        return v
    s = _norm(v)
    if s in ("true", "t", "yes", "1", "सही", "ಸರಿ"):
        return True
    if s in ("false", "f", "no", "0", "गलत", "ತಪ್ಪು"):
        return False
    return None


def check_answer(kind: str, expected: Any, given: Any) -> bool:
    if kind == "mcq":
        return _norm(given) == _norm(expected)
    if kind == "true_false":
        g, e = _as_bool(given), _as_bool(expected)
        return g is not None and g == e
    if kind == "match":
        if not isinstance(given, dict) or not isinstance(expected, dict):
            return False
        return {_norm(k): _norm(v) for k, v in given.items()} == {
            _norm(k): _norm(v) for k, v in expected.items()}
    if kind == "fill_in":
        accepted = expected if isinstance(expected, list) else [expected]
        return _norm(given) in {_norm(a) for a in accepted}
    return False
