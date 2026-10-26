"""
Contrato publico de la API (Fase S4 reducida, ADR-0009). Decision del equipo:
el contrato NO cambia y la API no revela que modelo sirve. La respuesta es
{riesgo_hipoglucemia, version_modelo}, /health es {status, service,
modelo_cargado}, y ningun mensaje ni la version contienen "demo" ni "sintetico" (desde ADR-0011
la version del modelo sintetico es neutra: 1.1.0; la trazabilidad esta en los
metadatos, en `entrenado_con`).
"""
import json
import re
import shutil
from pathlib import Path

import pytest
from datos_sinteticos import PERFIL
from fastapi.testclient import TestClient

from app.api.riesgo import obtener_predictor
from app.main import crear_app
from app.metadatos import SUBCARPETA_DEMO

RUTA = "/api/riesgo/hipoglucemia"
CLAVES_RESPUESTA = {"riesgo_hipoglucemia", "version_modelo"}
CLAVES_HEALTH = {"status", "service", "modelo_cargado"}
PALABRAS_PROHIBIDAS = re.compile(r"demo|sint[eé]tic|synthetic", re.IGNORECASE)
APP_DIR = Path(__file__).resolve().parents[1] / "app"


def _cliente(ambos, monkeypatch, modo, **entorno):
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(ambos))
    monkeypatch.setenv("ML_MODELO", modo)
    for k, v in entorno.items():
        monkeypatch.setenv(k, v)
    return crear_app()


@pytest.mark.parametrize("modo", ["real", "demo"])
def test_la_respuesta_200_tiene_solo_las_claves_del_contrato(ambos, monkeypatch, modo):
    with TestClient(_cliente(ambos, monkeypatch, modo)) as cliente:
        respuesta = cliente.post(RUTA, json=PERFIL)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert set(cuerpo) == CLAVES_RESPUESTA
    assert isinstance(cuerpo["riesgo_hipoglucemia"], float) and 0.0 <= cuerpo["riesgo_hipoglucemia"] <= 1.0
    assert isinstance(cuerpo["version_modelo"], str)


def test_la_version_viene_de_los_metadatos_y_no_dice_demo(ambos, monkeypatch):
    versiones = {}
    for modo in ("real", "demo"):
        with TestClient(_cliente(ambos, monkeypatch, modo)) as cliente:
            versiones[modo] = cliente.post(RUTA, json=PERFIL).json()["version_modelo"]

    assert re.fullmatch(r"\d+\.\d+\.\d+", versiones["real"])
    assert re.fullmatch(r"\d+\.\d+\.\d+", versiones["demo"])  # neutra: sin «demo»
    assert versiones["demo"] != versiones["real"]  # la trazabilidad no se pierde


def test_health_no_revela_el_modo(ambos, monkeypatch):
    cuerpos = {}
    for modo in ("real", "demo"):
        with TestClient(_cliente(ambos, monkeypatch, modo)) as cliente:
            respuesta = cliente.get("/health")
        assert respuesta.status_code == 200
        cuerpos[modo] = respuesta.json()

    assert set(cuerpos["real"]) == CLAVES_HEALTH
    assert cuerpos["real"] == cuerpos["demo"]  # identico en los dos modos
    assert "modo" not in cuerpos["real"]


def _todas_las_respuestas(ambos, monkeypatch, modo):
    """(nombre, texto de la respuesta) de 200, varios 422, 503, 500 y /health, y la documentacion."""
    respuestas = []
    with TestClient(_cliente(ambos, monkeypatch, modo, ML_ENABLE_DOCS="true")) as cliente:
        r200 = cliente.post(RUTA, json=PERFIL)
        cuerpo = r200.json()
        cuerpo.pop("version_modelo")  # el sufijo de la version es la unica huella permitida
        respuestas.append(("200", json.dumps(cuerpo)))
        for nombre, solicitud in (
            ("422 campo faltante", {k: v for k, v in PERFIL.items() if k != "edad"}),
            ("422 valor no permitido", {**PERFIL, "momento": "otro"}),
            ("422 campo adicional", {**PERFIL, "extra": 1}),
        ):
            respuestas.append((nombre, cliente.post(RUTA, json=solicitud).text))
        respuestas.append(("422 json malformado", cliente.post(RUTA, content='{"glucosa": 1,', headers={"Content-Type": "application/json"}).text))
        respuestas.append(("422 no utf-8", cliente.post(RUTA, content=b'{"a": "\xff"}', headers={"Content-Type": "application/json"}).text))
        respuestas.append(("health", cliente.get("/health").text))
        respuestas.append(("openapi", cliente.get("/openapi.json").text))
        respuestas.append(("docs", cliente.get("/docs").text))
        respuestas.append(("404", cliente.get("/no-existe").text))

    # 500: el predictor falla con un texto que no debe aparecer
    aplicacion = _cliente(ambos, monkeypatch, modo)

    def roto(datos):
        raise RuntimeError("fallo interno")

    aplicacion.dependency_overrides[obtener_predictor] = lambda: roto
    respuestas.append(("500", TestClient(aplicacion).post(RUTA, json=PERFIL).text))
    return respuestas


@pytest.mark.parametrize("modo", ["real", "demo"])
def test_ninguna_respuesta_contiene_demo_ni_sintetico(ambos, monkeypatch, modo):
    for nombre, texto in _todas_las_respuestas(ambos, monkeypatch, modo):
        assert not PALABRAS_PROHIBIDAS.search(texto), f"la respuesta '{nombre}' contiene una palabra prohibida"
        assert '"modo"' not in texto.lower(), f"la respuesta '{nombre}' expone el modo"


def test_ningun_error_contiene_demo_ni_sintetico_ni_nombra_la_variable(ambos, monkeypatch):
    # artefacto de demo ausente: el POST da 503 y /health sigue siendo 200 con modelo_cargado=false
    shutil.rmtree(ambos / SUBCARPETA_DEMO)
    with TestClient(_cliente(ambos, monkeypatch, "demo")) as cliente:
        post_sin_artefacto = cliente.post(RUTA, json=PERFIL)
        salud_sin_artefacto = cliente.get("/health")
    # valor invalido de ML_MODELO: ambos 503 genericos
    monkeypatch.setenv("ML_MODELO", "otro-valor")
    with TestClient(crear_app()) as cliente:
        invalidos = [cliente.post(RUTA, json=PERFIL), cliente.get("/health")]

    assert post_sin_artefacto.status_code == 503
    assert salud_sin_artefacto.status_code == 200
    assert salud_sin_artefacto.json() == {"status": "ok", "service": "glucotracker-ml", "modelo_cargado": False}
    for respuesta in invalidos:
        assert respuesta.status_code == 503
    for respuesta in [post_sin_artefacto, salud_sin_artefacto, *invalidos]:
        assert not PALABRAS_PROHIBIDAS.search(respuesta.text)
        assert "ML_MODELO" not in respuesta.text and "otro-valor" not in respuesta.text
    for respuesta in [post_sin_artefacto, *invalidos]:
        assert set(respuesta.json()) == {"detail"}


@pytest.mark.parametrize("modulo", ["api/riesgo.py", "main.py", "errors.py"])
def test_el_codigo_que_arma_las_respuestas_no_dice_demo_ni_sintetico(modulo):
    texto = (APP_DIR / modulo).read_text(encoding="utf-8")

    assert not PALABRAS_PROHIBIDAS.search(texto), modulo


def test_el_esquema_openapi_no_expone_el_modelo():
    esquema = TestClient(crear_app(habilitar_docs=True)).get("/openapi.json").json()
    salida = esquema["components"]["schemas"]["RiesgoHipoglucemiaOutput"]

    assert set(salida["properties"]) == CLAVES_RESPUESTA
    assert not PALABRAS_PROHIBIDAS.search(json.dumps(esquema, ensure_ascii=False))
