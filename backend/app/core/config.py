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


def _bool_env(nombre: str, defecto: bool = False) -> bool:
    valor = os.getenv(nombre)
    if valor is None or not valor.strip():
        return defecto
    return valor.strip().lower() in ("true", "1", "si", "sí", "yes")


def _float_env(nombre: str, defecto: float) -> float:
    try:
        n = float(os.getenv(nombre, ""))
        return n if n > 0 else defecto
    except ValueError:
        return defecto


class Settings(BaseSettings):
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "secret-key")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    PORT: int = int(os.getenv("PORT", "3000"))
    EMAIL_USER: str = os.getenv("EMAIL_USER", "")
    EMAIL_PASS: str = os.getenv("EMAIL_PASS", "")

    # Integración con el servicio de ML (ADR-0011). Apagada por defecto: con ML_ENABLED=false el registro del
    # médico responde exactamente como antes. ML_URL es la dirección INTERNA (red_ml), nunca pública.
    ML_ENABLED: bool = _bool_env("ML_ENABLED", False)
    ML_URL: str = os.getenv("ML_URL", "http://ml_service:8002")
    ML_TIMEOUT: float = _float_env("ML_TIMEOUT", 2.0)  # segundos; sin reintentos
    # Duración de la diabetes asumida mientras no exista paciente.anio_diagnostico (TASK-017h): mediana (6,5 años)
    # del conjunto sintético de entrenamiento (dataset canónico, semilla 20261024). Es una ESTIMACIÓN, no un dato.
    ML_DURACION_DEFECTO_ANIOS: float = _float_env("ML_DURACION_DEFECTO_ANIOS", 6.5)

    model_config = SettingsConfigDict(case_sensitive=True, extra="ignore")


settings = Settings()
