"""
POST /api/chatbot/consulta (REQ-006) — contrato en design.md § API.

Orden de validaciones: autenticación (401) → límite de tasa (429) →
entrada (422) → proveedor (503 / 502 / 504). Todos los mensajes de error
son genéricos: nunca repiten el texto del usuario ni detalles del
proveedor (NFR-001). Este módulo no registra nada en logs.
"""
from functools import lru_cache
from typing import Callable

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.auth import requerir_autenticacion
from app.config import Settings, obtener_settings
from app.errors import ConfiguracionInvalida, ProveedorError, ProveedorNoConfigurado, ProveedorTimeout
from app.llm_client import LLMClient, get_llm_client
from app.rate_limit import aplicar_limite_de_tasa
from app.service import responder_consulta

MENSAJE_ENTRADA_INVALIDA = "La consulta no es válida. Envía un texto no vacío y dentro del largo permitido."
MENSAJE_NO_DISPONIBLE = "El chatbot no está disponible en este momento."
MENSAJE_FALLO_PROVEEDOR = "El chatbot no pudo generar una respuesta. Intenta de nuevo."
MENSAJE_TIMEOUT = "El chatbot tardó demasiado en responder. Intenta de nuevo."

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


class ConsultaInput(BaseModel):
    texto: str

    model_config = {
        "json_schema_extra": {"example": {"texto": "¿Qué debo comer si mi glucosa está en 70 mg/dL?"}}
    }


class ConsultaOutput(BaseModel):
    respuesta: str


@lru_cache(maxsize=4)
def _cliente_para(settings: Settings) -> LLMClient:
    # Settings es inmutable: se reutiliza el cliente mientras la configuración no cambie.
    return get_llm_client(settings)


def fabrica_de_cliente() -> Callable[[Settings], LLMClient]:
    """
    Dependencia reemplazable en pruebas. Retorna una fábrica, no el cliente,
    para que la falta de configuración (503) se evalúe después de validar
    la entrada (422).
    """
    return _cliente_para


@router.post(
    "/consulta",
    response_model=ConsultaOutput,
    dependencies=[Depends(requerir_autenticacion), Depends(aplicar_limite_de_tasa)],
)
def consultar(
    consulta: ConsultaInput,
    settings: Settings = Depends(obtener_settings),
    fabrica: Callable[[Settings], LLMClient] = Depends(fabrica_de_cliente),
) -> ConsultaOutput:
    if not consulta.texto.strip() or len(consulta.texto) > settings.chatbot_max_input_chars:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=MENSAJE_ENTRADA_INVALIDA)

    try:
        cliente = fabrica(settings)
        respuesta = responder_consulta(consulta.texto, cliente=cliente, settings=settings)
    except ProveedorNoConfigurado:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=MENSAJE_NO_DISPONIBLE) from None
    except ProveedorTimeout:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=MENSAJE_TIMEOUT) from None
    except ProveedorError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=MENSAJE_FALLO_PROVEEDOR) from None

    return ConsultaOutput(respuesta=respuesta)


async def _entrada_invalida(request: Request, exc: RequestValidationError) -> JSONResponse:
    # El manejador por defecto de FastAPI devuelve el valor recibido ("input"),
    # es decir, el texto del usuario. Se reemplaza por un mensaje genérico.
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": MENSAJE_ENTRADA_INVALIDA})


async def _error_http(request: Request, exc: StarletteHTTPException):
    # FastAPI responde 400 ("There was an error parsing the body") cuando el
    # cuerpo no se puede decodificar (p. ej. UTF-8 inválido). El contrato no
    # tiene 400: es una entrada inválida (422). El servicio no emite 400 propios.
    if exc.status_code == status.HTTP_400_BAD_REQUEST:
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": MENSAJE_ENTRADA_INVALIDA})
    return await http_exception_handler(request, exc)


async def _configuracion_invalida(request: Request, exc: ConfiguracionInvalida) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"detail": MENSAJE_NO_DISPONIBLE})


def registrar(app: FastAPI) -> None:
    app.include_router(router)
    app.add_exception_handler(RequestValidationError, _entrada_invalida)
    app.add_exception_handler(StarletteHTTPException, _error_http)
    app.add_exception_handler(ConfiguracionInvalida, _configuracion_invalida)
