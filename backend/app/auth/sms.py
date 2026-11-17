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
        if r.status_code >= 400:          # keep Twilio's reason (e.g. 21659: not your Twilio number)
            raise RuntimeError(f"Twilio SMS {r.status_code}: {r.text[:200]}")


class CodeService(Protocol):
    """Sends and checks login codes itself (we never see the code)."""

    def start(self, to_e164: str, locale: str = "en") -> None: ...
    def check(self, to_e164: str, code: str) -> bool: ...


class TwilioVerify:
    """Twilio Verify: real login codes by SMS. Twilio owns the message templates, so it works in
    India without our own DLT registration, and it checks the code (we store no code)."""

    def __init__(self, service_sid: str) -> None:
        self.base = f"https://verify.twilio.com/v2/Services/{service_sid}"

    def _post(self, path: str, data: dict[str, str]) -> dict[str, object]:
        import httpx

        from app.config import get_settings
        s = get_settings()
        r = httpx.post(self.base + path, data=data, auth=(s.twilio_account_sid, s.twilio_auth_token), timeout=15)
        if r.status_code == 404 and path == "/VerificationCheck":
            return {"status": "expired"}         # no pending verification (expired, used or never sent)
        if r.status_code >= 400:
            raise RuntimeError(f"Twilio Verify {r.status_code}: {r.text[:200]}")
        return r.json()

    def start(self, to_e164: str, locale: str = "en") -> None:
        self._post("/Verifications", {"To": to_e164, "Channel": "sms", "Locale": locale})

    def check(self, to_e164: str, code: str) -> bool:
        return self._post("/VerificationCheck", {"To": to_e164, "Code": code}).get("status") == "approved"


def get_code_service() -> CodeService | None:
    """Twilio Verify when it is set up (TWILIO_VERIFY_SID) and real SMS is on; otherwise None (we send our own codes)."""
    from app.config import get_settings

    s = get_settings()
    if s.use_fake_sms or not s.twilio_verify_sid:
        return None
    return TwilioVerify(s.twilio_verify_sid)


def get_sms() -> SmsProvider:
    from app.config import get_settings

    if get_settings().use_fake_sms:
        return _fake
    return TwilioSmsProvider()
