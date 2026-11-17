from app.ai.provider import FakeLLMProvider, LLMProvider
from app.calls.provider import FakeTelephonyProvider, TelephonyProvider
from app.config import Settings
from app.speech.provider import FakeSpeechProvider, SpeechProvider


def get_llm(settings: Settings) -> LLMProvider:
    if settings.use_fake_ai:
        return FakeLLMProvider()
    raise NotImplementedError("Real LLM provider is added in Phase 3")


def get_speech(settings: Settings) -> SpeechProvider:
    if settings.use_fake_speech:
        return FakeSpeechProvider()
    raise NotImplementedError("Real speech provider is added in Phase 2")


def get_telephony(settings: Settings) -> TelephonyProvider:
    if settings.use_fake_telephony:
        return FakeTelephonyProvider()
    raise NotImplementedError("Real Exotel provider is added in Phase 5")
