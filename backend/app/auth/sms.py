from typing import Protocol


class SmsProvider(Protocol):
    def send(self, to_e164: str, text: str) -> None: ...


class FakeSmsProvider:
    """Keeps messages in memory so tests and local dev need no SMS account."""

    def __init__(self) -> None:
        self.outbox: list[tuple[str, str]] = []

    def send(self, to_e164: str, text: str) -> None:
        self.outbox.append((to_e164, text))

    def last_code(self, to_e164: str) -> str:
        for phone, text in reversed(self.outbox):
            if phone == to_e164:
                return text.split()[-1]
        raise LookupError("no sms sent")


_fake = FakeSmsProvider()


def get_sms() -> SmsProvider:
    from app.config import get_settings

    if get_settings().use_fake_sms:
        return _fake
    raise NotImplementedError("Real SMS provider is added in Phase 6")
