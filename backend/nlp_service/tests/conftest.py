"""
Fixtures comunes. Ninguna prueba llama a una API real: todas usan
FakeProvider o dobles del SDK, y las variables de entorno del servicio se
limpian antes de cada prueba para no leer la configuración (ni la clave)
del desarrollador.
"""
import os

import pytest

VARIABLES_DEL_SERVICIO = (
    "NLP_PROVIDER",
    "NLP_MODEL",
    "NLP_PROVIDER_API_KEY",
    "NLP_TIMEOUT_SECONDS",
    "NLP_ENFORCE_DISCLAIMER",
    "NLP_TEMPERATURE",
    "CHATBOT_REQUIRE_AUTH",
    "CHATBOT_MAX_INPUT_CHARS",
    "CHATBOT_RATE_LIMIT_PER_MINUTE",
)


@pytest.fixture(autouse=True)
def entorno_limpio(monkeypatch):
    for variable in VARIABLES_DEL_SERVICIO:
        monkeypatch.delenv(variable, raising=False)
    # Estado en memoria del endpoint: cada prueba empieza sin historial.
    from app.api import chatbot
    from app.rate_limit import limitador

    limitador.reiniciar()
    chatbot._cliente_para.cache_clear()
    yield
    # load_dotenv (dev_chat) escribe en os.environ sin pasar por monkeypatch.
    for variable in VARIABLES_DEL_SERVICIO:
        os.environ.pop(variable, None)
