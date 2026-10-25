"""
Configuración del servicio de ML, leída de variables de entorno.

Este módulo NO carga el archivo .env: lo hace el punto de entrada
(`uvicorn ... --env-file .env`), de modo que las pruebas nunca leen la
configuración del desarrollador. Las variables están en `.env.example`
(solo nombres). Ver design.md § Servicio de ML.
"""
import os
from dataclasses import dataclass
from typing import Mapping, Optional

from app.errors import ConfiguracionInvalida

# app/artefactos/ junto a este archivo
DEFAULT_ARTEFACTOS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artefactos")
DEFAULT_LOG_LEVEL = "INFO"
NIVELES_DE_LOG = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")
# La documentacion interactiva esta apagada salvo que se pida (el servicio no es publico).
DEFAULT_ENABLE_DOCS = False
# Modelo que sirve el servicio: el real (por defecto) o el de DEMO entrenado con datos sinteticos (ADR-0009).
MODELOS_VALIDOS = ("real", "demo")
DEFAULT_MODELO = "real"

_VERDADERO = {"true", "1", "si", "sí", "yes"}
_FALSO = {"false", "0", "no"}


@dataclass(frozen=True)
class Settings:
    artefactos_dir: str
    log_level: str
    habilitar_docs: bool = DEFAULT_ENABLE_DOCS
    modelo: str = DEFAULT_MODELO


def _leer(entorno: Mapping[str, str], variable: str) -> Optional[str]:
    """Una variable vacía (p. ej. `ML_LOG_LEVEL=` en .env) cuenta como ausente."""
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


def load_settings(entorno: Optional[Mapping[str, str]] = None) -> Settings:
    """Construye Settings desde `entorno` (por defecto, os.environ)."""
    if entorno is None:
        entorno = os.environ
    nivel = (_leer(entorno, "ML_LOG_LEVEL") or DEFAULT_LOG_LEVEL).upper()
    if nivel not in NIVELES_DE_LOG:
        raise ConfiguracionInvalida("ML_LOG_LEVEL")
    modelo = (_leer(entorno, "ML_MODELO") or DEFAULT_MODELO).lower()
    if modelo not in MODELOS_VALIDOS:
        raise ConfiguracionInvalida("ML_MODELO")
    return Settings(
        artefactos_dir=_leer(entorno, "ML_ARTEFACTOS_DIR") or DEFAULT_ARTEFACTOS_DIR,
        log_level=nivel,
        habilitar_docs=_leer_bool(entorno, "ML_ENABLE_DOCS", DEFAULT_ENABLE_DOCS),
        modelo=modelo,
    )
