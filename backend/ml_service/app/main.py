"""
GlucoTracker — Servicio de ML (riesgo de hipoglucemia).

Servicio FastAPI independiente del backend principal y del servicio NLP
(ADR-0008): tiene su propia configuración y dependencias y no importa nada de
ellos. Sin ingreso público ni CORS: solo lo llama el backend por red interna
(ML-D8). Ver design.md § Servicio de ML antes de agregar lógica.

Se ejecuta desde backend/ml_service/:
    uvicorn app.main:app --env-file .env --port 8002
"""
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI

from app.api import riesgo
from app.config import load_settings
from app.predict import modelo_cargado

logger = logging.getLogger("app.main")

DESCRIPCION = (
    "Estima la **probabilidad informativa** de hipoglucemia observada en el registro (REQ-004). "
    "No clasifica Normal/Hipo/Hiper, no diagnostica y no dispara alertas. "
    "Servicio interno: solo lo llama el backend por red interna, sin ingreso público."
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Configura el nivel de log y precarga (verificando) el modelo una vez."""
    settings = load_settings()
    logging.basicConfig(level=settings.log_level)
    logging.getLogger("app").setLevel(settings.log_level)
    if not modelo_cargado(settings.artefactos_dir):
        logger.warning("El modelo no está disponible al arrancar; /health lo informa.")
    yield


def crear_app(habilitar_docs: Optional[bool] = None) -> FastAPI:
    """
    `habilitar_docs=None` toma ML_ENABLE_DOCS (apagada por defecto). Con la
    documentación apagada, /docs, /redoc y /openapi.json responden 404.
    """
    if habilitar_docs is None:
        habilitar_docs = load_settings().habilitar_docs

    aplicacion = FastAPI(
        title="Servicio de ML de GlucoTracker",
        version="0.1.0",
        description=DESCRIPCION,
        lifespan=lifespan,
        docs_url="/docs" if habilitar_docs else None,
        redoc_url="/redoc" if habilitar_docs else None,
        openapi_url="/openapi.json" if habilitar_docs else None,
    )

    @aplicacion.get("/health", summary="Estado del servicio", tags=["Salud"])
    def health_check():
        """Salud del servicio (TASK-026b) e indicador de si el modelo está cargado y verificado."""
        return {
            "status": "ok",
            "service": "glucotracker-ml",
            "modelo_cargado": modelo_cargado(load_settings().artefactos_dir),
        }

    # POST /api/riesgo/hipoglucemia y manejadores de error genéricos.
    riesgo.registrar(aplicacion)
    return aplicacion


app = crear_app()
