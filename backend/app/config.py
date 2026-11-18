from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    public_base_url: str = ""
    # Gemini and Sarvam turn on by themselves when their key is set (GEMINI_API_KEY, SARVAM_API_KEY);
    # without a key the fake is used. USE_FAKE_AI / USE_FAKE_SPEECH only matter when there is no key.
    # FORCE_FAKES=true (tests) keeps every fake on even when .env has real keys.
    use_fake_ai: bool = True
    use_fake_speech: bool = True
    force_fakes: bool = False
    use_fake_telephony: bool = True
    use_fake_sms: bool = True
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_number: str = ""
    twilio_verify_sid: str = ""       # VA…: login codes go through Twilio Verify when set
    call_hours_enforced: bool = True
    quiet_hours_enforced: bool = True
    demo_mode: bool = False
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    sarvam_api_key: str = ""
    sarvam_model: str = "bulbul:v3"
    sarvam_speaker: str = "shubh"
    call_voice: str = "sarvam"        # sarvam | twilio
    upload_dir: str = "storage"
    scheduler_enabled: bool = False
    scheduler_interval: int = 300
    web_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000"
    demo_phone: str = ""
    demo_parent_phone: str = ""
    supabase_url: str = ""
    supabase_jwt_secret: str = "dev-only-secret-change-me-32-bytes!!"

    @property
    def fake_ai(self) -> bool:
        """Gemini whenever GEMINI_API_KEY is set (unless FORCE_FAKES); the fake otherwise."""
        return self.force_fakes or not self.gemini_api_key

    @property
    def fake_speech(self) -> bool:
        """Sarvam whenever SARVAM_API_KEY is set (unless FORCE_FAKES); the fake otherwise."""
        return self.force_fakes or not self.sarvam_api_key


DEV_JWT_SECRET = "dev-only-secret-change-me-32-bytes!!"


def key_status(s: Settings) -> list[dict[str, object]]:
    """Which keys are set (never their values) and what runs without each one."""
    rows = [
        ("DATABASE_URL", bool(s.database_url), "Database", "the API cannot start"),
        ("GEMINI_API_KEY", bool(s.gemini_api_key), "AI lessons, doubts, translations for the voice",
         "fake AI (sample answers, no translation)"),
        ("SARVAM_API_KEY", bool(s.sarvam_api_key), "Hindi and Kannada voice (Listen, call simulator, calls)",
         "no server voice; the browser voice reads (no Kannada voice in most browsers)"),
        ("SUPABASE_JWT_SECRET", s.supabase_jwt_secret != DEV_JWT_SECRET, "Signing login tokens",
         "a built-in development secret (not safe in production)"),
        ("PUBLIC_BASE_URL", bool(s.public_base_url), "Links in calls and SMS", "call webhooks can't be reached"),
        ("TWILIO_ACCOUNT_SID", bool(s.twilio_account_sid), "Real phone calls and SMS", "fake calls and SMS"),
        ("TWILIO_AUTH_TOKEN", bool(s.twilio_auth_token), "Real phone calls and SMS", "fake calls and SMS"),
        ("TWILIO_NUMBER", bool(s.twilio_number), "The number calls come from", "fake calls"),
        ("TWILIO_VERIFY_SID", bool(s.twilio_verify_sid), "Login codes by SMS (Twilio Verify)",
         "login codes from the built-in SMS path (demo code 123456 in demo mode)"),
    ]
    return [{"name": n, "set": ok, "used_for": use, "when_missing": miss} for n, ok, use, miss in rows]


@lru_cache
def get_settings() -> Settings:
    return Settings()
