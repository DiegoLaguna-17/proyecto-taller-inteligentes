"""
Servicio del chatbot: responder_consulta(texto).

Sin estado (D8): una consulta, una llamada al proveedor. Al proveedor solo
se envían el system prompt y el texto del usuario. Este módulo no registra
nada en logs (NFR-001).
"""
import re
import unicodedata
from typing import Optional

from app.clinical import DESCARGO_MEDICO
from app.config import Settings, load_settings
from app.llm_client import LLMClient, get_llm_client
from app.prompt_builder import construir_system_prompt

# Constante, no variable de entorno (ADR-0005, D2).
TEMPERATURE = 0.2


def _normalizar(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", sin_tildes).casefold().strip()


def descargo_presente(respuesta: str) -> bool:
    """
    Compara sin distinguir tildes, mayúsculas ni saltos de línea, para no
    duplicar el descargo cuando el LLM ya lo escribió con otra ortografía.
    """
    return _normalizar(DESCARGO_MEDICO).rstrip(".") in _normalizar(respuesta)


def agregar_descargo(respuesta: str) -> str:
    return f"{respuesta.rstrip()}\n\n{DESCARGO_MEDICO}"


def responder_consulta(
    texto: str,
    *,
    con_contexto: bool = True,
    cliente: Optional[LLMClient] = None,
    settings: Optional[Settings] = None,
) -> str:
    """
    Retorna la respuesta del chatbot para `texto`.

    `con_contexto=False` omite el corpus (corrida neutra de
    baseline_chatbot.md §4). Si NLP_ENFORCE_DISCLAIMER está activo y falta
    el descargo médico, se agrega por código (D6).

    Levanta ProveedorNoConfigurado, ProveedorError o ProveedorTimeout.
    """
    if settings is None:
        settings = load_settings()
    if cliente is None:
        cliente = get_llm_client(settings)

    system_prompt = construir_system_prompt() if con_contexto else None
    respuesta = cliente.generar(system_prompt, texto, TEMPERATURE).texto

    if settings.nlp_enforce_disclaimer and not descargo_presente(respuesta):
        respuesta = agregar_descargo(respuesta)
    return respuesta
