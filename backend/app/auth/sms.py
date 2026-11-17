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


class TwilioSmsProvider:
    """Sends real texts with the same Twilio account used for calls."""

    def send(self, to_e164: str, text: str) -> None:
        import httpx

        from app.config import get_settings

        s = get_settings()
        r = httpx.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{s.twilio_account_sid}/Messages.json",
            auth=(s.twilio_account_sid, s.twilio_auth_token), timeout=15,
            data={"To": to_e164, "From": s.twilio_number, "Body": text})
        r.raise_for_status()


def get_sms() -> SmsProvider:
    from app.config import get_settings

    if get_settings().use_fake_sms:
        return _fake
    return TwilioSmsProvider()
