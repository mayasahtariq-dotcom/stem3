from app.ai.provider import FakeLLMProvider, LLMProvider
from app.calls.provider import FakeTelephonyProvider, TelephonyProvider
from app.config import Settings
from app.speech.provider import FakeSpeechProvider, SpeechProvider


def get_llm(settings: Settings) -> LLMProvider:
    if settings.use_fake_ai:
        return FakeLLMProvider()
    if not settings.gemini_api_key:
        raise NotImplementedError("Set GEMINI_API_KEY (or USE_FAKE_AI=true)")
    from app.ai.provider import GeminiProvider

    return GeminiProvider(settings.gemini_api_key, settings.gemini_model)


def get_speech(settings: Settings) -> SpeechProvider:
    if settings.use_fake_speech:
        return FakeSpeechProvider()
    if not settings.sarvam_api_key:
        raise NotImplementedError("Set SARVAM_API_KEY (or USE_FAKE_SPEECH=true)")
    from app.speech.provider import SarvamProvider

    return SarvamProvider(settings.sarvam_api_key, settings.sarvam_model, settings.sarvam_speaker)


def get_telephony(settings: Settings) -> TelephonyProvider:
    if settings.use_fake_telephony:
        return FakeTelephonyProvider()
    from app.calls.twilio import TwilioProvider

    return TwilioProvider(settings)
