from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    public_base_url: str = ""
    use_fake_ai: bool = True
    use_fake_speech: bool = True
    use_fake_telephony: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
