from typing import Literal

from pydantic import PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Where to read env vars from. Run from backend/, so ../.env is the root .env.
    # Real environment variables always win over the file (same as dotenv).
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    # Each field = one env var (matched case-insensitively: DATABASE_URL -> database_url).
    # No default = required. Missing or invalid -> the app refuses to start.
    database_url: PostgresDsn
    db_pool_size: int = 5
    environment: Literal["dev", "test", "prod"] = "dev"


settings = Settings()  # like: const env = envSchema.parse(process.env)
