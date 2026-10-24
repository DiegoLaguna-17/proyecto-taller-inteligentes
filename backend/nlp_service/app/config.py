"""
Configuración del servicio NLP, leída de variables de entorno.

Ver design.md § Servicio NLP (chatbot) Design para la lista de variables.
Este módulo NO carga el archivo .env: lo hacen los puntos de entrada
(`uvicorn ... --env-file .env` y `python -m app.dev_chat`), de modo que las
pruebas nunca leen la configuración ni la clave del desarrollador.

La temperatura no se configura aquí: es la constante TEMPERATURE de
app/service.py (ADR-0005, D2).
"""
import os
from dataclasses import dataclass, field
from typing import Mapping, Optional

from app.errors import ConfiguracionInvalida, ProveedorNoConfigurado

PROVEEDORES_SOPORTADOS = ("gemini", "fake")

# Valores por defecto de las variables que no son secretas. Las de
# seguridad son conservadoras: auth exigida salvo que se desactive
# explícitamente en desarrollo (D3).
DEFAULT_TIMEOUT_SECONDS = 30.0
DEFAULT_ENFORCE_DISCLAIMER = True
DEFAULT_REQUIRE_AUTH = True
DEFAULT_MAX_INPUT_CHARS = 1000
DEFAULT_RATE_LIMIT_PER_MINUTE = 10

_VERDADERO = {"true", "1", "si", "sí", "yes"}
_FALSO = {"false", "0", "no"}


@dataclass(frozen=True)
class Settings:
    nlp_provider: Optional[str]
    nlp_model: Optional[str]
    # repr=False: la clave nunca aparece al imprimir o registrar Settings.
    nlp_provider_api_key: Optional[str] = field(repr=False)
    nlp_timeout_seconds: float
    nlp_enforce_disclaimer: bool
    chatbot_require_auth: bool
    chatbot_max_input_chars: int
    chatbot_rate_limit_per_minute: int


def _leer(entorno: Mapping[str, str], variable: str) -> Optional[str]:
    """Una variable vacía (p. ej. `NLP_MODEL=` en .env) cuenta como ausente."""
    valor = entorno.get(variable)
    if valor is None or not valor.strip():
        return None
    return valor.strip()


def _leer_bool(entorno: Mapping[str, str], variable: str, por_defecto: bool) -> bool:
    valor = _leer(entorno, variable)
    if valor is None:
        return por_defecto
    if valor.lower() in _VERDADERO:
        return True
    if valor.lower() in _FALSO:
        return False
    raise ConfiguracionInvalida(variable)


def _leer_positivo(entorno: Mapping[str, str], variable: str, por_defecto, tipo):
    valor = _leer(entorno, variable)
    if valor is None:
        return por_defecto
    try:
        numero = tipo(valor)
    except ValueError:
        raise ConfiguracionInvalida(variable) from None
    if numero <= 0:
        raise ConfiguracionInvalida(variable)
    return numero


def load_settings(entorno: Optional[Mapping[str, str]] = None) -> Settings:
    """
    Construye Settings desde `entorno` (por defecto, os.environ).

    No valida que el proveedor esté completo: un servicio sin proveedor
    configurado arranca igual (para /health) y falla por consulta con
    ProveedorNoConfigurado → 503. Ver validar_proveedor().
    """
    if entorno is None:
        entorno = os.environ
    proveedor = _leer(entorno, "NLP_PROVIDER")
    return Settings(
        nlp_provider=proveedor.lower() if proveedor else None,
        nlp_model=_leer(entorno, "NLP_MODEL"),
        nlp_provider_api_key=_leer(entorno, "NLP_PROVIDER_API_KEY"),
        nlp_timeout_seconds=_leer_positivo(entorno, "NLP_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS, float),
        nlp_enforce_disclaimer=_leer_bool(entorno, "NLP_ENFORCE_DISCLAIMER", DEFAULT_ENFORCE_DISCLAIMER),
        chatbot_require_auth=_leer_bool(entorno, "CHATBOT_REQUIRE_AUTH", DEFAULT_REQUIRE_AUTH),
        chatbot_max_input_chars=_leer_positivo(entorno, "CHATBOT_MAX_INPUT_CHARS", DEFAULT_MAX_INPUT_CHARS, int),
        chatbot_rate_limit_per_minute=_leer_positivo(
            entorno, "CHATBOT_RATE_LIMIT_PER_MINUTE", DEFAULT_RATE_LIMIT_PER_MINUTE, int
        ),
    )


def obtener_settings() -> Settings:
    """Dependencia FastAPI: lee la configuración vigente en cada request."""
    return load_settings()


def validar_proveedor(settings: Settings) -> None:
    """Levanta ProveedorNoConfigurado nombrando solo la variable que falta."""
    if settings.nlp_provider is None:
        raise ProveedorNoConfigurado("NLP_PROVIDER")
    if settings.nlp_provider not in PROVEEDORES_SOPORTADOS:
        raise ProveedorNoConfigurado("NLP_PROVIDER", no_soportado=True)
    if settings.nlp_provider == "gemini":
        if settings.nlp_model is None:
            raise ProveedorNoConfigurado("NLP_MODEL")
        if settings.nlp_provider_api_key is None:
            raise ProveedorNoConfigurado("NLP_PROVIDER_API_KEY")
