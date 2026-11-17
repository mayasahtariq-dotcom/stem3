from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    public_base_url: str = ""
    use_fake_ai: bool = True
    use_fake_speech: bool = True
    use_fake_telephony: bool = True
    use_fake_sms: bool = True
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_number: str = ""
    call_hours_enforced: bool = True
    quiet_hours_enforced: bool = True
    demo_mode: bool = False
    demo_phone: str = ""
    demo_parent_phone: str = ""
    supabase_url: str = ""
    supabase_jwt_secret: str = "dev-only-secret-change-me-32-bytes!!"


@lru_cache
def get_settings() -> Settings:
    return Settings()
