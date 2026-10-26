"""
Clientes LLM intercambiables (ADR-0005, D1/D2).

- GeminiProvider: SDK oficial `google-genai`.
- FakeProvider: determinístico y sin red; lo usan todas las pruebas.
- OpenAIProvider: diferido (la interfaz ya lo admite).

Los errores del SDK se traducen a los de app/errors.py con `from None`,
para que ningún mensaje ni traceback encadenado arrastre el texto de la
consulta o la respuesta del proveedor (NFR-001).
"""
from dataclasses import dataclass
from typing import Optional, Protocol

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from app.config import Settings, validar_proveedor
from app.errors import ProveedorError, ProveedorTimeout


@dataclass(frozen=True)
class RespuestaLLM:
    texto: str
    # Id exacto del modelo que respondió, para registrarlo en cada corrida (D2).
    modelo: str


class LLMClient(Protocol):
    def generar(self, system_prompt: Optional[str], texto: str, temperature: float) -> RespuestaLLM:
        """`system_prompt=None` es la corrida sin contexto (línea base cruda)."""
        ...


class FakeProvider:
    """Proveedor de pruebas: no usa red y guarda en memoria las llamadas recibidas."""

    MODELO = "fake-provider"
    RESPUESTA_POR_DEFECTO = (
        "Respuesta simulada de FakeProvider: si tu glucosa está por debajo de "
        "70 mg/dL, aplica la Regla del 15-15."
    )

    def __init__(self, respuesta: str = RESPUESTA_POR_DEFECTO):
        self.respuesta = respuesta
        self.llamadas: list[dict] = []

    def generar(self, system_prompt: Optional[str], texto: str, temperature: float) -> RespuestaLLM:
        self.llamadas.append({"system_prompt": system_prompt, "texto": texto, "temperature": temperature})
        return RespuestaLLM(texto=self.respuesta, modelo=self.MODELO)


class GeminiProvider:
    def __init__(self, api_key: str, modelo: str, timeout_seconds: float, cliente=None):
        if cliente is None:
            cliente = genai.Client(
                api_key=api_key,
                # El SDK espera el timeout en milisegundos; sin retry_options no reintenta.
                http_options=genai_types.HttpOptions(timeout=int(timeout_seconds * 1000)),
            )
        self._cliente = cliente
        self._modelo = modelo

    def generar(self, system_prompt: Optional[str], texto: str, temperature: float) -> RespuestaLLM:
        config = genai_types.GenerateContentConfig(system_instruction=system_prompt, temperature=temperature)
        try:
            respuesta = self._cliente.models.generate_content(model=self._modelo, contents=texto, config=config)
            texto_respuesta = (respuesta.text or "").strip()
        except (httpx.TimeoutException, TimeoutError):
            raise ProveedorTimeout() from None
        except genai_errors.APIError as exc:
            raise ProveedorError(f"HTTP {exc.code}") from None
        except Exception as exc:  # noqa: BLE001 — frontera con un servicio externo
            raise ProveedorError(type(exc).__name__) from None

        if not texto_respuesta:
            raise ProveedorError("respuesta vacía")
        return RespuestaLLM(texto=texto_respuesta, modelo=respuesta.model_version or self._modelo)


def get_llm_client(settings: Settings) -> LLMClient:
    """Retorna el proveedor según NLP_PROVIDER, o levanta ProveedorNoConfigurado."""
    validar_proveedor(settings)
    if settings.nlp_provider == "fake":
        return FakeProvider()
    return GeminiProvider(
        api_key=settings.nlp_provider_api_key,
        modelo=settings.nlp_model,
        timeout_seconds=settings.nlp_timeout_seconds,
    )
