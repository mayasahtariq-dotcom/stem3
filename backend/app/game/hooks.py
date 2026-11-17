"""Extension points so quests, leagues, badges and pots plug into the core flow."""
from collections.abc import Callable
from typing import Any

Hook = Callable[[dict[str, Any]], None]
ON_ATTEMPT: list[Hook] = []
ON_COMPLETE: list[Hook] = []


def run(hooks: list[Hook], ctx: dict[str, Any]) -> None:
    for h in hooks:
        h(ctx)
