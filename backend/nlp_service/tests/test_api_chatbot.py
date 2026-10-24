"""
Contrato HTTP de POST /api/chatbot/consulta (TASK-018), con TestClient y
FakeProvider: ninguna prueba llama a una API real.
"""
import logging

import pytest
from fastapi.testclient import TestClient

from app.api import chatbot
from app.auth import MENSAJE_NO_AUTENTICADO
from app.clinical import DESCARGO_MEDICO
from app.errors import ProveedorError, ProveedorTimeout
from app.llm_client import FakeProvider
from app.main import app
from app.rate_limit import MENSAJE_LIMITE_EXCEDIDO

URL = "/api/chatbot/consulta"
TEXTO = "Consulta privada de prueba: mi glucosa marca 64 mg/dL"


class ProveedorQueFalla:
    def __init__(self, error):
        self.error = error

    def generar(self, system_prompt, texto, temperature):
        raise self.error


@pytest.fixture
def entorno_dev(monkeypatch):
    monkeypatch.setenv("NLP_PROVIDER", "fake")
    monkeypatch.setenv("CHATBOT_REQUIRE_AUTH", "false")


@pytest.fixture
def cliente_http():
    yield TestClient(app)
    app.dependency_overrides.clear()


def con_proveedor(proveedor):
    app.dependency_overrides[chatbot.fabrica_de_cliente] = lambda: (lambda settings: proveedor)


def assert_sin_texto(respuesta, caplog):
    assert TEXTO not in respuesta.text
    assert TEXTO not in caplog.text


def test_200_con_respuesta_y_descargo(entorno_dev, cliente_http, caplog):
    caplog.set_level(logging.DEBUG)

    respuesta = cliente_http.post(URL, json={"texto": TEXTO})

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert set(cuerpo) == {"respuesta"}
    assert cuerpo["respuesta"].strip()
    assert DESCARGO_MEDICO in cuerpo["respuesta"]
    assert_sin_texto(respuesta, caplog)


def test_al_proveedor_llega_el_texto_con_el_corpus(entorno_dev, cliente_http):
    fake = FakeProvider()
    con_proveedor(fake)

    cliente_http.post(URL, json={"texto": TEXTO})

    assert fake.llamadas[0]["texto"] == TEXTO
    assert fake.llamadas[0]["system_prompt"].startswith("ROL:")


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"texto": ""},
        {"texto": "   \n "},
        {},
        {"texto": 123},
        {"otro": TEXTO},
    ],
)
def test_422_entrada_invalida(entorno_dev, cliente_http, caplog, cuerpo):
    caplog.set_level(logging.DEBUG)

    respuesta = cliente_http.post(URL, json=cuerpo)

    assert respuesta.status_code == 422
    assert respuesta.json() == {"detail": chatbot.MENSAJE_ENTRADA_INVALIDA}
    assert_sin_texto(respuesta, caplog)


def test_422_texto_demasiado_largo_no_repite_el_texto(entorno_dev, cliente_http, monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    monkeypatch.setenv("CHATBOT_MAX_INPUT_CHARS", str(len(TEXTO) - 1))

    respuesta = cliente_http.post(URL, json={"texto": TEXTO})

    assert respuesta.status_code == 422
    assert respuesta.json() == {"detail": chatbot.MENSAJE_ENTRADA_INVALIDA}
    assert_sin_texto(respuesta, caplog)


def test_texto_en_el_limite_exacto_se_acepta(entorno_dev, cliente_http, monkeypatch):
    monkeypatch.setenv("CHATBOT_MAX_INPUT_CHARS", str(len(TEXTO)))

    assert cliente_http.post(URL, json={"texto": TEXTO}).status_code == 200


def test_422_json_malformado_no_repite_el_cuerpo(entorno_dev, cliente_http, caplog):
    caplog.set_level(logging.DEBUG)

    respuesta = cliente_http.post(URL, content=f'{{"texto": "{TEXTO}"', headers={"Content-Type": "application/json"})

    assert respuesta.status_code == 422
    assert_sin_texto(respuesta, caplog)


def test_422_cuerpo_no_decodificable_no_es_400(entorno_dev, cliente_http, caplog):
    caplog.set_level(logging.DEBUG)
    cuerpo_latin1 = '{"texto": "¿Qué como? ' .encode("latin-1") + TEXTO.encode("utf-8") + b'"}'

    respuesta = cliente_http.post(URL, content=cuerpo_latin1, headers={"Content-Type": "application/json"})

    assert respuesta.status_code == 422
    assert respuesta.json() == {"detail": chatbot.MENSAJE_ENTRADA_INVALIDA}
    assert_sin_texto(respuesta, caplog)


def test_404_sigue_siendo_404(cliente_http):
    assert cliente_http.get("/no-existe").status_code == 404


def test_texto_con_tildes_en_utf8_se_acepta(entorno_dev, cliente_http):
    respuesta = cliente_http.post(URL, json={"texto": "¿Qué debo comer si mi glucosa está en 70 mg/dL?"})

    assert respuesta.status_code == 200


def test_429_al_superar_el_limite(entorno_dev, cliente_http, monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    monkeypatch.setenv("CHATBOT_RATE_LIMIT_PER_MINUTE", "2")

    codigos = [cliente_http.post(URL, json={"texto": TEXTO}).status_code for _ in range(2)]
    respuesta = cliente_http.post(URL, json={"texto": TEXTO})

    assert codigos == [200, 200]
    assert respuesta.status_code == 429
    assert respuesta.json() == {"detail": MENSAJE_LIMITE_EXCEDIDO}
    assert 1 <= int(respuesta.headers["Retry-After"]) <= 60
    assert_sin_texto(respuesta, caplog)


def test_las_peticiones_invalidas_tambien_cuentan_para_el_limite(entorno_dev, cliente_http, monkeypatch):
    monkeypatch.setenv("CHATBOT_RATE_LIMIT_PER_MINUTE", "1")

    assert cliente_http.post(URL, json={"texto": ""}).status_code == 422
    assert cliente_http.post(URL, json={"texto": TEXTO}).status_code == 429


@pytest.mark.parametrize(
    "entorno",
    [
        {"CHATBOT_REQUIRE_AUTH": "false"},
        {"CHATBOT_REQUIRE_AUTH": "false", "NLP_PROVIDER": "gemini"},
        {"CHATBOT_REQUIRE_AUTH": "false", "NLP_PROVIDER": "gemini", "NLP_MODEL": "modelo-de-prueba"},
        {"CHATBOT_REQUIRE_AUTH": "false", "NLP_PROVIDER": "desconocido"},
        {"CHATBOT_REQUIRE_AUTH": "false", "NLP_PROVIDER": "fake", "NLP_TIMEOUT_SECONDS": "abc"},
    ],
)
def test_503_proveedor_no_configurado(cliente_http, monkeypatch, caplog, entorno):
    caplog.set_level(logging.DEBUG)
    for variable, valor in entorno.items():
        monkeypatch.setenv(variable, valor)

    respuesta = cliente_http.post(URL, json={"texto": TEXTO})

    assert respuesta.status_code == 503
    assert respuesta.json() == {"detail": chatbot.MENSAJE_NO_DISPONIBLE}
    assert "NLP_" not in respuesta.text
    assert_sin_texto(respuesta, caplog)


def test_502_fallo_del_proveedor(entorno_dev, cliente_http, caplog):
    caplog.set_level(logging.DEBUG)
    con_proveedor(ProveedorQueFalla(ProveedorError("HTTP 500")))

    respuesta = cliente_http.post(URL, json={"texto": TEXTO})

    assert respuesta.status_code == 502
    assert respuesta.json() == {"detail": chatbot.MENSAJE_FALLO_PROVEEDOR}
    assert "HTTP 500" not in respuesta.text
    assert_sin_texto(respuesta, caplog)


def test_504_timeout_del_proveedor(entorno_dev, cliente_http, caplog):
    caplog.set_level(logging.DEBUG)
    con_proveedor(ProveedorQueFalla(ProveedorTimeout()))

    respuesta = cliente_http.post(URL, json={"texto": TEXTO})

    assert respuesta.status_code == 504
    assert respuesta.json() == {"detail": chatbot.MENSAJE_TIMEOUT}
    assert_sin_texto(respuesta, caplog)


def test_401_con_auth_requerida_sin_implementar(cliente_http, monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    monkeypatch.setenv("NLP_PROVIDER", "fake")
    monkeypatch.setenv("CHATBOT_REQUIRE_AUTH", "true")

    respuesta = cliente_http.post(URL, json={"texto": TEXTO}, headers={"Authorization": "Bearer token-cualquiera"})

    assert respuesta.status_code == 401
    assert respuesta.json() == {"detail": MENSAJE_NO_AUTENTICADO}
    assert respuesta.headers["WWW-Authenticate"] == "Bearer"
    assert_sin_texto(respuesta, caplog)


def test_401_es_el_valor_por_defecto(cliente_http, monkeypatch):
    monkeypatch.setenv("NLP_PROVIDER", "fake")

    assert cliente_http.post(URL, json={"texto": TEXTO}).status_code == 401


def test_auth_se_evalua_antes_que_la_entrada(cliente_http, monkeypatch):
    monkeypatch.setenv("NLP_PROVIDER", "fake")
    monkeypatch.setenv("CHATBOT_REQUIRE_AUTH", "true")

    assert cliente_http.post(URL, json={"texto": ""}).status_code == 401


def test_la_entrada_se_valida_antes_que_el_proveedor(cliente_http, monkeypatch):
    monkeypatch.setenv("CHATBOT_REQUIRE_AUTH", "false")

    assert cliente_http.post(URL, json={"texto": ""}).status_code == 422


def test_health_sigue_publico(cliente_http):
    assert cliente_http.get("/health").status_code == 200
