"""SpeechProvider: Hindi/Kannada text to speech. Sarvam for real use, a fake for tests (P3)."""
import base64
from typing import Protocol

import httpx

LANG_CODES = {"hi": "hi-IN", "kn": "kn-IN", "en": "en-IN"}


class SpeechProvider(Protocol):
    def synthesize(self, text: str, language: str, sample_rate: int = 22050) -> bytes: ...


class FakeSpeechProvider:
    def synthesize(self, text: str, language: str, sample_rate: int = 22050) -> bytes:
        return f"fake-audio:{language}:{text}".encode()


class SarvamProvider:
    """Sarvam bulbul text-to-speech. Returns WAV bytes. 8000 Hz suits phone calls (PRD)."""

    URL = "https://api.sarvam.ai/text-to-speech"

    def __init__(self, api_key: str, model: str = "bulbul:v3", speaker: str = "shubh") -> None:
        self.key, self.model, self.speaker = api_key, model, speaker

    def synthesize(self, text: str, language: str, sample_rate: int = 22050) -> bytes:
        r = httpx.post(self.URL, headers={"api-subscription-key": self.key}, timeout=45, json={
            "text": text[:2400], "language_code": LANG_CODES.get(language, "hi-IN"),
            "model": self.model, "speaker": self.speaker, "speech_sample_rate": sample_rate})
        r.raise_for_status()
        return b"".join(base64.b64decode(a) for a in r.json()["audios"])
