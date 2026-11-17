from app.game import awards, leagues, quests

_done = False


def register_all() -> None:
    """Order matters: quests first (they add gems and quest counts badges use)."""
    global _done
    if _done:
        return
    quests.register()
    leagues.register()
    awards.register()
    _done = True
