"""
Proveedores LLM. GeminiProvider se prueba con un doble del cliente del SDK:
ninguna prueba hace llamadas de red.
"""
from types import SimpleNamespace

import httpx
import pytest
from google.genai import errors as genai_errors

from app.config import load_settings
from app.errors import ProveedorError, ProveedorNoConfigurado, ProveedorTimeout
from app.llm_client import FakeProvider, GeminiProvider, get_llm_client

CONSULTA = "Consulta privada de prueba con glucosa 64 mg/dL"


class ModelsDoble:
    def __init__(self, respuesta=None, error=None):
        self.respuesta = respuesta
        self.error = error
        self.llamadas = []

    def generate_content(self, *, model, contents, config):
        self.llamadas.append({"model": model, "contents": contents, "config": config})
        if self.error is not None:
            raise self.error
        return self.respuesta


def gemini_con(models_doble):
    return GeminiProvider(
        api_key="no-se-usa", modelo="modelo-de-prueba", timeout_seconds=5, cliente=SimpleNamespace(models=models_doble)
    )


def test_fake_seleccionado_por_entorno():
    assert isinstance(get_llm_client(load_settings({"NLP_PROVIDER": "fake"})), FakeProvider)


def test_gemini_seleccionado_por_entorno_sin_red():
    entorno = {"NLP_PROVIDER": "gemini", "NLP_MODEL": "modelo-de-prueba", "NLP_PROVIDER_API_KEY": "clave-de-prueba"}

    assert isinstance(get_llm_client(load_settings(entorno)), GeminiProvider)


def test_valor_desconocido_es_error_de_configuracion():
    with pytest.raises(ProveedorNoConfigurado):
        get_llm_client(load_settings({"NLP_PROVIDER": "desconocido"}))


def test_fake_es_deterministico_y_registra_la_llamada():
    fake = FakeProvider()

    primera = fake.generar("prompt", CONSULTA, 0.2)
    segunda = fake.generar("prompt", CONSULTA, 0.2)

    assert primera == segunda
    assert primera.modelo == FakeProvider.MODELO
    assert fake.llamadas[0] == {"system_prompt": "prompt", "texto": CONSULTA, "temperature": 0.2}


def test_gemini_envia_prompt_temperatura_y_retorna_modelo_exacto():
    models = ModelsDoble(respuesta=SimpleNamespace(text="  Respuesta  ", model_version="modelo-de-prueba-001"))

    resultado = gemini_con(models).generar("system prompt", CONSULTA, 0.2)

    assert resultado.texto == "Respuesta"
    assert resultado.modelo == "modelo-de-prueba-001"
    llamada = models.llamadas[0]
    assert llamada["model"] == "modelo-de-prueba"
    assert llamada["contents"] == CONSULTA
    assert llamada["config"].system_instruction == "system prompt"
    assert llamada["config"].temperature == 0.2


def test_gemini_sin_contexto_no_envia_system_instruction():
    models = ModelsDoble(respuesta=SimpleNamespace(text="ok", model_version=None))

    resultado = gemini_con(models).generar(None, CONSULTA, 0.2)

    assert models.llamadas[0]["config"].system_instruction is None
    assert resultado.modelo == "modelo-de-prueba"


@pytest.mark.parametrize(
    "error, esperado",
    [
        (genai_errors.ServerError(500, {"error": {"code": 500, "message": CONSULTA, "status": "INTERNAL"}}), ProveedorError),
        (genai_errors.ClientError(429, {"error": {"code": 429, "message": CONSULTA, "status": "RESOURCE_EXHAUSTED"}}), ProveedorError),
        (httpx.ReadTimeout(CONSULTA), ProveedorTimeout),
        (RuntimeError(CONSULTA), ProveedorError),
    ],
)
def test_gemini_traduce_errores_sin_filtrar_la_consulta(error, esperado):
    with pytest.raises(esperado) as exc_info:
        gemini_con(ModelsDoble(error=error)).generar("system prompt", CONSULTA, 0.2)

    assert CONSULTA not in str(exc_info.value)
    assert exc_info.value.__cause__ is None
    assert exc_info.value.__suppress_context__ is True


@pytest.mark.parametrize("texto", [None, "", "   "])
def test_gemini_respuesta_vacia_es_fallo(texto):
    with pytest.raises(ProveedorError):
        gemini_con(ModelsDoble(respuesta=SimpleNamespace(text=texto, model_version="x"))).generar("p", CONSULTA, 0.2)
