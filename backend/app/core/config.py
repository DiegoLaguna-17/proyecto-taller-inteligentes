import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

CORE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CORE_DIR.parent.parent
DATA_ENV_FILE = BACKEND_DIR / "data" / ".env"
ROOT_ENV_FILE = BACKEND_DIR / ".env"

if DATA_ENV_FILE.exists():
    load_dotenv(DATA_ENV_FILE)
elif ROOT_ENV_FILE.exists():
    load_dotenv(ROOT_ENV_FILE)
else:
    load_dotenv()


class Settings(BaseSettings):
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "secret-key")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    PORT: int = int(os.getenv("PORT", "3000"))
    EMAIL_USER: str = os.getenv("EMAIL_USER", "")
    EMAIL_PASS: str = os.getenv("EMAIL_PASS", "")

    model_config = SettingsConfigDict(case_sensitive=True, extra="ignore")


settings = Settings()
