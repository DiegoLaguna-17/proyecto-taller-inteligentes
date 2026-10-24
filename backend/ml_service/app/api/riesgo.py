"""
POST /api/riesgo/hipoglucemia (REQ-004) — contrato en design.md § Servicio de ML.

Devuelve la probabilidad INFORMATIVA de hipoglucemia observada en el registro.
No clasifica Normal/Hipo/Hiper ni devuelve nivel de alerta: la clasificación
ADA es lógica de negocio del backend y la probabilidad no dispara alertas
(ML-D4, ML-D5).

Seguridad (NFR-001): todos los mensajes de error son genéricos. Nunca repiten
valores de entrada ni el texto de una excepción, y este módulo no registra
glucosa ni datos del perfil: ante un error inesperado solo se registra el
nombre de la clase de la excepción.

Autenticación: este servicio no tiene autenticación propia en v1 (ADR-0008,
ML-D8). No debe tener ingreso público ni CORS: solo lo llama el backend por
red interna. El mecanismo de autenticación entre servicios queda pendiente
del despliegue (TASK-002b; Open Question de design.md).
"""
import logging
import math
from typing import Callable, Literal, Optional, Tuple

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.errors import ConfiguracionInvalida, ModeloNoDisponible
from app.predict import predecir_con_version

logger = logging.getLogger(__name__)

MENSAJE_ENTRADA_INVALIDA = (
    "La solicitud no es válida. Revisa los campos obligatorios, los valores permitidos y los rangos."
)
MENSAJE_NO_DISPONIBLE = "El modelo de riesgo no está disponible en este momento."
MENSAJE_ERROR_INTERNO = "No se pudo calcular el riesgo."

DECIMALES = 4

router = APIRouter(prefix="/api/riesgo", tags=["Riesgo de hipoglucemia"])

Momento = Literal["ayunas", "postprandial"]
Genero = Literal["femenino", "masculino"]
CategoriaMedicacion = Literal["ninguno", "metformina_u_otros", "sulfonilurea", "insulina"]


class PacienteRiesgoInput(BaseModel):
    """
    Una lectura de glucosa y el perfil clínico, sin nombre, correo ni ids.
    Cualquier campo que no figure aquí se rechaza con 422.
    """

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "glucosa": 68,
                "momento": "ayunas",
                "genero": "femenino",
                "edad": 61,
                "bmi": 26.4,
                "duracion_diabetes": 12,
                "categoria_medicacion": "insulina",
                "com_hipertension": True,
                "com_dislipidemia": False,
                "com_renal": False,
                "com_neuropatia": True,
                "com_nefropatia": False,
                "com_cardiovascular": False,
                "hba1c": 8.1,
            }
        },
    )

    glucosa: float = Field(..., gt=0, le=700, description="Lectura de glucosa en mg/dL (mayor que 0 y hasta 700).")
    momento: Momento = Field(..., description="Momento de la lectura: `ayunas` o `postprandial`.")
    genero: Genero = Field(..., description="`femenino` o `masculino`.")
    edad: int = Field(..., gt=0, le=120, description="Edad en años (1 a 120).")
    bmi: float = Field(..., gt=0, le=80, description="Índice de masa corporal en kg/m² (mayor que 0 y hasta 80).")
    duracion_diabetes: float = Field(..., ge=0, le=80, description="Años desde el diagnóstico de diabetes (0 a 80).")
    categoria_medicacion: CategoriaMedicacion = Field(
        ..., description="`ninguno`, `metformina_u_otros`, `sulfonilurea` o `insulina`."
    )
    com_hipertension: bool = Field(False, description="Tiene hipertensión.")
    com_dislipidemia: bool = Field(False, description="Tiene dislipidemia.")
    com_renal: bool = Field(False, description="Tiene enfermedad renal.")
    com_neuropatia: bool = Field(False, description="Tiene neuropatía.")
    com_nefropatia: bool = Field(False, description="Tiene nefropatía.")
    com_cardiovascular: bool = Field(False, description="Tiene enfermedad cardiovascular.")
    hba1c: Optional[float] = Field(
        None,
        gt=0,
        le=20,
        description="Último HbA1c (%) conocido (mayor que 0 y hasta 20). Opcional: si falta, el modelo lo trata como dato faltante.",
    )


class RiesgoHipoglucemiaOutput(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"example": {"riesgo_hipoglucemia": 0.4321, "version_modelo": "1.0.0"}}
    )

    riesgo_hipoglucemia: float = Field(
        ...,
        ge=0,
        le=1,
        description=(
            "Probabilidad estimada (0 a 1, con 4 decimales) de hipoglucemia observada en el registro. "
            "Es solo informativa: no es un diagnóstico ni dispara alertas."
        ),
    )
    version_modelo: str = Field(..., description="Versión del modelo que produjo la estimación.")


class ErrorRespuesta(BaseModel):
    detail: str = Field(..., description="Mensaje genérico en español. Nunca repite lo enviado ni detalles internos.")


Predictor = Callable[[dict], Tuple[float, str]]


def obtener_predictor() -> Predictor:
    """Dependencia reemplazable en pruebas: devuelve (probabilidad, version_modelo)."""
    return predecir_con_version


def _respuesta_de_error(descripcion: str, mensaje: str) -> dict:
    return {
        "model": ErrorRespuesta,
        "description": descripcion,
        "content": {"application/json": {"example": {"detail": mensaje}}},
    }


@router.post(
    "/hipoglucemia",
    response_model=RiesgoHipoglucemiaOutput,
    summary="Estimar la probabilidad de hipoglucemia",
    description=(
        "Recibe una lectura de glucosa y el perfil clínico y devuelve la probabilidad **informativa** de "
        "hipoglucemia observada en el registro, junto con la versión del modelo. No devuelve nivel de alerta: "
        "la clasificación Normal/Hipo/Hiper la hace el backend con los umbrales ADA."
    ),
    responses={
        422: _respuesta_de_error(
            "Entrada inválida: campo faltante o adicional, tipo, rango o valor no permitido, JSON malformado "
            "o cuerpo que no es UTF-8.",
            MENSAJE_ENTRADA_INVALIDA,
        ),
        503: _respuesta_de_error(
            "El modelo no está disponible: artefacto ausente, huella distinta o versiones de librerías "
            "incompatibles con las del entrenamiento.",
            MENSAJE_NO_DISPONIBLE,
        ),
        500: _respuesta_de_error("Error inesperado al calcular el riesgo.", MENSAJE_ERROR_INTERNO),
    },
)
def predecir_riesgo_hipoglucemia(
    paciente: PacienteRiesgoInput,
    predictor: Predictor = Depends(obtener_predictor),
) -> RiesgoHipoglucemiaOutput:
    try:
        riesgo, version = predictor(paciente.model_dump())
        if not math.isfinite(riesgo) or not 0.0 <= riesgo <= 1.0:
            raise ValueError("probabilidad fuera de rango")
        return RiesgoHipoglucemiaOutput(riesgo_hipoglucemia=round(riesgo, DECIMALES), version_modelo=version)
    except (ModeloNoDisponible, ConfiguracionInvalida):
        # El motivo de ModeloNoDisponible ya lo registró predict.py (categoría fija, sin rutas).
        # Una variable de entorno inválida también deja al servicio sin poder predecir.
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=MENSAJE_NO_DISPONIBLE) from None
    except Exception as exc:  # noqa: BLE001
        # Solo el nombre de la clase: el texto de la excepción podría contener valores de entrada.
        logger.error("Error inesperado al calcular el riesgo (%s).", type(exc).__name__)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=MENSAJE_ERROR_INTERNO) from None


async def _entrada_invalida(request: Request, exc: RequestValidationError) -> JSONResponse:
    # El manejador por defecto de FastAPI devuelve el valor recibido ("input"),
    # incluida la glucosa. Se reemplaza por un mensaje genérico.
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": MENSAJE_ENTRADA_INVALIDA})


async def _error_http(request: Request, exc: StarletteHTTPException):
    # FastAPI responde 400 cuando el cuerpo no se puede decodificar (p. ej. UTF-8
    # inválido). El contrato no tiene 400: es una entrada inválida (422).
    if exc.status_code == status.HTTP_400_BAD_REQUEST:
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": MENSAJE_ENTRADA_INVALIDA})
    return await http_exception_handler(request, exc)


async def _configuracion_invalida(request: Request, exc: ConfiguracionInvalida) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"detail": MENSAJE_NO_DISPONIBLE})


async def _error_inesperado(request: Request, exc: Exception) -> JSONResponse:
    # Red de seguridad para lo que escape de los manejadores anteriores.
    logger.error("Error inesperado no controlado (%s).", type(exc).__name__)
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": MENSAJE_ERROR_INTERNO})


def registrar(app: FastAPI) -> None:
    app.include_router(router)
    app.add_exception_handler(RequestValidationError, _entrada_invalida)
    app.add_exception_handler(StarletteHTTPException, _error_http)
    app.add_exception_handler(ConfiguracionInvalida, _configuracion_invalida)
    app.add_exception_handler(Exception, _error_inesperado)
