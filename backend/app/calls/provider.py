from typing import Protocol


class TelephonyProvider(Protocol):
    async def place_call(self, to_e164: str, session_id: str) -> str: ...


class FakeTelephonyProvider:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    async def place_call(self, to_e164: str, session_id: str) -> str:
        self.calls.append((to_e164, session_id))
        return f"fake-call-{len(self.calls)}"
