"""Twilio voice: place calls, verify webhook signatures, build TwiML. No SDK, just httpx."""
import base64
import hashlib
import hmac
from xml.sax.saxutils import escape, quoteattr

import httpx

from app.config import Settings

VOICES = {"hi": ("Google.hi-IN-Standard-A", "hi-IN"), "kn": ("Google.kn-IN-Standard-A", "kn-IN"),
          "en": ("Google.en-IN-Standard-A", "en-IN")}


class TwilioProvider:
    def __init__(self, settings: Settings) -> None:
        self.s = settings

    def place_call(self, to_e164: str, session_id: str) -> str:
        base = self.s.public_base_url.rstrip("/")
        r = httpx.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{self.s.twilio_account_sid}/Calls.json",
            auth=(self.s.twilio_account_sid, self.s.twilio_auth_token), timeout=15,
            data={"To": to_e164, "From": self.s.twilio_number, "Method": "POST",
                  "Url": f"{base}/v1/webhooks/twilio/voice?s={session_id}",
                  "StatusCallback": f"{base}/v1/webhooks/twilio/status?s={session_id}",
                  "StatusCallbackMethod": "POST", "Timeout": "30"})
        r.raise_for_status()
        return str(r.json()["sid"])


def signature(token: str, url: str, params: dict[str, str]) -> str:
    """X-Twilio-Signature: base64(HMAC-SHA1(token, url + sorted name+value pairs))."""
    payload = url + "".join(k + params[k] for k in sorted(params))
    digest = hmac.new(token.encode(), payload.encode(), hashlib.sha1).digest()
    return base64.b64encode(digest).decode()


def valid_signature(token: str, url: str, params: dict[str, str], given: str) -> bool:
    return hmac.compare_digest(signature(token, url, params), given or "")


# ---------- TwiML ----------
def say(text: str, lang: str) -> str:
    """Twilio's voice by default; inside a call step with Sarvam on, a placeholder for a clip."""
    voice, code = VOICES.get(lang, VOICES["hi"])
    xml = f"<Say voice={quoteattr(voice)} language={quoteattr(code)}>{escape(text)}</Say>"
    from app.calls.voice import CURRENT  # local import: voice.py needs settings and speech

    collector = CURRENT.get()
    return collector.add(text, lang, xml) if collector is not None else xml


def gather(inner: str, action: str) -> str:
    return (f'<Gather input="dtmf" numDigits="1" timeout="8" method="POST" '
            f"action={quoteattr(action)}>{inner}</Gather>")


def redirect(url: str) -> str:
    return f'<Redirect method="POST">{escape(url)}</Redirect>'


def response(*parts: str) -> str:
    return '<?xml version="1.0" encoding="UTF-8"?><Response>' + "".join(parts) + "</Response>"


HANGUP = "<Hangup/>"
