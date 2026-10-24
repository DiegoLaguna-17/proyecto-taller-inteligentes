"""
POST /api/riesgo/hipoglucemia: contrato, errores genericos y NFR-001.

Usa el modelo pequeno entrenado sobre datos sinteticos (conftest.py): sin red,
sin el Excel real y sin el .pkl real.
"""
import json
import logging
import math
import statistics
import time

import pytest
from datos_sinteticos import PERFIL
from fastapi.testclient import TestClient

from app.api import riesgo
from app.api.riesgo import (
    MENSAJE_ENTRADA_INVALIDA,
    MENSAJE_ERROR_INTERNO,
    MENSAJE_NO_DISPONIBLE,
    obtener_predictor,
)
from app.errors import ModeloNoDisponible
from app.main import crear_app
from app.metadatos import NOMBRE_MODELO

RUTA = "/api/riesgo/hipoglucemia"

# Cuerpo valido; los valores son reconocibles para comprobar que no se repiten en errores ni logs.
CUERPO = {
    "glucosa": 123.456,
    "momento": "ayunas",
    "genero": "femenino",
    "edad": 61,
    "bmi": 27.3141,
    "duracion_diabetes": 11.7,
    "categoria_medicacion": "insulina",
    "com_hipertension": True,
    "com_neuropatia": True,
    "hba1c": 7.7777,
}
VALORES_SENSIBLES = ["123.456", "27.3141", "7.7777", "11.7"]


@pytest.fixture
def app_con_modelo(artefactos, monkeypatch):
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(artefactos))
    return crear_app(habilitar_docs=False)


@pytest.fixture
def cliente(app_con_modelo):
    return TestClient(app_con_modelo)


def _sin_valores(texto):
    for valor in VALORES_SENSIBLES:
        assert valor not in texto, "se filtro un valor de entrada"


# --- 200 -------------------------------------------------------------------

def test_200_con_rango_y_version_correctos(cliente, metadatos_sinteticos):
    respuesta = cliente.post(RUTA, json=CUERPO)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert set(cuerpo) == {"riesgo_hipoglucemia", "version_modelo"}
    assert 0.0 <= cuerpo["riesgo_hipoglucemia"] <= 1.0
    assert cuerpo["version_modelo"] == metadatos_sinteticos["version_modelo"]


def test_la_respuesta_no_incluye_alerta(cliente):
    respuesta = cliente.post(RUTA, json=CUERPO)

    assert "alerta" not in respuesta.json()
    assert "alerta" not in respuesta.text.lower()


def test_el_riesgo_se_redondea_a_cuatro_decimales(app_con_modelo):
    app_con_modelo.dependency_overrides[obtener_predictor] = lambda: (lambda datos: (0.123456789, "9.9.9"))

    cuerpo = TestClient(app_con_modelo).post(RUTA, json=CUERPO).json()

    assert cuerpo == {"riesgo_hipoglucemia": 0.1235, "version_modelo": "9.9.9"}


def test_hba1c_es_opcional(cliente):
    sin_hba1c = {k: v for k, v in CUERPO.items() if k != "hba1c"}

    assert cliente.post(RUTA, json=sin_hba1c).status_code == 200
    assert cliente.post(RUTA, json={**CUERPO, "hba1c": None}).status_code == 200


def test_las_comorbilidades_son_falsas_por_defecto(cliente):
    minimo = {k: CUERPO[k] for k in (
        "glucosa", "momento", "genero", "edad", "bmi", "duracion_diabetes", "categoria_medicacion")}

    assert cliente.post(RUTA, json=minimo).status_code == 200


@pytest.mark.parametrize("momento", ["ayunas", "postprandial"])
@pytest.mark.parametrize("medicacion", ["ninguno", "metformina_u_otros", "sulfonilurea", "insulina"])
def test_acepta_todos_los_valores_permitidos(cliente, momento, medicacion):
    respuesta = cliente.post(RUTA, json={**CUERPO, "momento": momento, "categoria_medicacion": medicacion})

    assert respuesta.status_code == 200


# --- 422 -------------------------------------------------------------------

CASOS_422 = {
    "campo_obligatorio_faltante": {k: v for k, v in CUERPO.items() if k != "edad"},
    "momento_no_permitido": {**CUERPO, "momento": "secreto_momento_9"},
    "genero_no_permitido": {**CUERPO, "genero": "secreto_genero_9"},
    "medicacion_no_permitida": {**CUERPO, "categoria_medicacion": "secreta_medicacion_9"},
    "glucosa_fuera_de_rango": {**CUERPO, "glucosa": 99999.5},
    "glucosa_cero": {**CUERPO, "glucosa": 0},
    "edad_fuera_de_rango": {**CUERPO, "edad": 777},
    "bmi_fuera_de_rango": {**CUERPO, "bmi": 8888.25},
    "duracion_negativa": {**CUERPO, "duracion_diabetes": -4.5},
    "hba1c_fuera_de_rango": {**CUERPO, "hba1c": 55.5},
    "tipo_incorrecto": {**CUERPO, "glucosa": "abc-secreto-123"},
    "campo_adicional_con_nombre": {**CUERPO, "nombre": "Zelda Sintetica"},
    "campo_adicional_con_id": {**CUERPO, "id_paciente": "sintetico-0001"},
}


@pytest.mark.parametrize("caso", sorted(CASOS_422))
def test_422_generico_y_sin_repetir_lo_enviado(cliente, caso):
    cuerpo = CASOS_422[caso]

    respuesta = cliente.post(RUTA, json=cuerpo)

    assert respuesta.status_code == 422
    assert respuesta.json() == {"detail": MENSAJE_ENTRADA_INVALIDA}
    for valor in (v for v in cuerpo.values() if isinstance(v, str)):
        assert valor not in respuesta.text
    for fragmento in ("secret", "Zelda", "sintetico", "99999.5", "8888.25", "777", "input", "loc"):
        assert fragmento not in respuesta.text


def test_422_con_json_malformado(cliente):
    respuesta = cliente.post(
        RUTA, content='{"glucosa": 123.456, "momento": "ayunas",', headers={"Content-Type": "application/json"}
    )

    assert respuesta.status_code == 422
    assert respuesta.json() == {"detail": MENSAJE_ENTRADA_INVALIDA}
    _sin_valores(respuesta.text)


def test_422_con_cuerpo_que_no_es_utf8(cliente):
    respuesta = cliente.post(
        RUTA, content=b'{"glucosa": 123.456, "nota": "\xff\xfe\xfa"}', headers={"Content-Type": "application/json"}
    )

    assert respuesta.status_code == 422
    assert respuesta.json() == {"detail": MENSAJE_ENTRADA_INVALIDA}
    _sin_valores(respuesta.text)


def test_422_con_cuerpo_vacio(cliente):
    respuesta = cliente.post(RUTA)

    assert respuesta.status_code == 422
    assert respuesta.json() == {"detail": MENSAJE_ENTRADA_INVALIDA}


def test_el_servicio_no_emite_400(cliente):
    for cuerpo in (b"", b"\xff", b"{", b"[]", b"null"):
        respuesta = cliente.post(RUTA, content=cuerpo, headers={"Content-Type": "application/json"})
        assert respuesta.status_code != 400


# --- 503 -------------------------------------------------------------------

def test_503_con_el_modelo_no_disponible_por_dependency_override(app_con_modelo, artefactos):
    def predictor_roto(datos):
        raise ModeloNoDisponible("huella_distinta")

    app_con_modelo.dependency_overrides[obtener_predictor] = lambda: predictor_roto

    respuesta = TestClient(app_con_modelo).post(RUTA, json=CUERPO)

    assert respuesta.status_code == 503
    assert respuesta.json() == {"detail": MENSAJE_NO_DISPONIBLE}
    assert "huella" not in respuesta.text
    assert str(artefactos) not in respuesta.text


def test_503_real_con_un_pkl_alterado(cliente, artefactos):
    with open(artefactos / NOMBRE_MODELO, "ab") as f:
        f.write(b"\x00alterado")

    respuesta = cliente.post(RUTA, json=CUERPO)

    assert respuesta.status_code == 503
    assert respuesta.json() == {"detail": MENSAJE_NO_DISPONIBLE}
    assert str(artefactos) not in respuesta.text


def test_503_real_sin_artefactos(tmp_path, monkeypatch):
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(tmp_path))

    respuesta = TestClient(crear_app(habilitar_docs=False)).post(RUTA, json=CUERPO)

    assert respuesta.status_code == 503
    assert str(tmp_path) not in respuesta.text


def test_503_con_configuracion_invalida(monkeypatch):
    monkeypatch.setenv("ML_LOG_LEVEL", "ruidoso")
    aplicacion = crear_app(habilitar_docs=False)

    respuesta = TestClient(aplicacion).post(RUTA, json=CUERPO)

    assert respuesta.status_code == 503
    assert "ML_LOG_LEVEL" not in respuesta.text


# --- 500 -------------------------------------------------------------------

def test_500_generico_sin_el_texto_de_la_excepcion(app_con_modelo, caplog):
    def predictor_roto(datos):
        raise RuntimeError("fallo con glucosa 123.456 en /ruta/interna/secreta")

    app_con_modelo.dependency_overrides[obtener_predictor] = lambda: predictor_roto

    with caplog.at_level(logging.DEBUG):
        respuesta = TestClient(app_con_modelo).post(RUTA, json=CUERPO)

    assert respuesta.status_code == 500
    assert respuesta.json() == {"detail": MENSAJE_ERROR_INTERNO}
    assert "123.456" not in respuesta.text and "ruta" not in respuesta.text
    # El log solo lleva el nombre de la clase.
    _sin_valores(caplog.text)
    assert "ruta/interna" not in caplog.text
    assert "RuntimeError" in caplog.text


@pytest.mark.parametrize("salida", [math.nan, math.inf, -0.1, 1.5])
def test_500_si_la_probabilidad_no_es_valida(app_con_modelo, salida):
    app_con_modelo.dependency_overrides[obtener_predictor] = lambda: (lambda datos: (salida, "1.0.0"))

    respuesta = TestClient(app_con_modelo).post(RUTA, json=CUERPO)

    assert respuesta.status_code == 500
    assert respuesta.json() == {"detail": MENSAJE_ERROR_INTERNO}


def test_500_generico_para_un_error_fuera_de_la_ruta(app_con_modelo):
    def dependencia_rota():
        raise RuntimeError("error con valor 123.456")

    app_con_modelo.dependency_overrides[obtener_predictor] = dependencia_rota

    respuesta = TestClient(app_con_modelo, raise_server_exceptions=False).post(RUTA, json=CUERPO)

    assert respuesta.status_code == 500
    assert respuesta.json() == {"detail": MENSAJE_ERROR_INTERNO}
    _sin_valores(respuesta.text)


# --- NFR-001 ---------------------------------------------------------------

def test_ningun_log_ni_salida_contiene_valores_de_entrada(cliente, caplog, capsys):
    with caplog.at_level(logging.DEBUG):
        cliente.post(RUTA, json=CUERPO)
        cliente.post(RUTA, json={**CUERPO, "momento": "no_permitido"})
        cliente.post(RUTA, content=b'{"glucosa": 123.456,', headers={"Content-Type": "application/json"})

    _sin_valores(caplog.text)
    salida = capsys.readouterr()
    _sin_valores(salida.out + salida.err)


# --- Documentacion ----------------------------------------------------------

RUTAS_DE_DOCUMENTACION = ("/docs", "/redoc", "/openapi.json")


def test_documentacion_apagada_por_defecto_responde_404(monkeypatch):
    monkeypatch.delenv("ML_ENABLE_DOCS", raising=False)
    cliente = TestClient(crear_app())

    for ruta in RUTAS_DE_DOCUMENTACION:
        assert cliente.get(ruta).status_code == 404


def test_documentacion_apagada_explicitamente(monkeypatch):
    monkeypatch.setenv("ML_ENABLE_DOCS", "false")
    cliente = TestClient(crear_app())

    for ruta in RUTAS_DE_DOCUMENTACION:
        assert cliente.get(ruta).status_code == 404


def test_documentacion_encendida_con_la_variable(monkeypatch):
    monkeypatch.setenv("ML_ENABLE_DOCS", "true")
    cliente = TestClient(crear_app())

    for ruta in RUTAS_DE_DOCUMENTACION:
        assert cliente.get(ruta).status_code == 200


def test_openapi_documenta_todos_los_codigos_con_su_esquema():
    esquema = TestClient(crear_app(habilitar_docs=True)).get("/openapi.json").json()
    operacion = esquema["paths"][RUTA]["post"]

    assert set(operacion["responses"]) == {"200", "422", "500", "503"}
    assert operacion["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith("RiesgoHipoglucemiaOutput")
    for codigo, mensaje in (("422", MENSAJE_ENTRADA_INVALIDA), ("503", MENSAJE_NO_DISPONIBLE), ("500", MENSAJE_ERROR_INTERNO)):
        contenido = operacion["responses"][codigo]["content"]["application/json"]
        assert contenido["schema"]["$ref"].endswith("ErrorRespuesta")
        assert contenido["example"] == {"detail": mensaje}
    assert esquema["components"]["schemas"]["PacienteRiesgoInput"]["example"]["momento"] == "ayunas"
    assert esquema["components"]["schemas"]["RiesgoHipoglucemiaOutput"]["example"]["version_modelo"]


def test_openapi_esta_en_espanol_y_sin_alerta():
    esquema = TestClient(crear_app(habilitar_docs=True)).get("/openapi.json").json()
    texto = json.dumps(esquema, ensure_ascii=False)

    assert esquema["info"]["title"] == "Servicio de ML de GlucoTracker"
    assert "probabilidad" in esquema["info"]["description"].lower()
    assert "alerta" not in esquema["components"]["schemas"]["RiesgoHipoglucemiaOutput"]["properties"]
    assert "Lectura de glucosa" in texto
    # Los valores permitidos salen del esquema (enum), no solo de la descripcion.
    assert esquema["components"]["schemas"]["PacienteRiesgoInput"]["properties"]["momento"]["enum"] == ["ayunas", "postprandial"]


def test_el_ejemplo_del_esquema_es_valido_y_sintetico(cliente):
    ejemplo = riesgo.PacienteRiesgoInput.model_config["json_schema_extra"]["example"]

    assert cliente.post(RUTA, json=ejemplo).status_code == 200


# --- Latencia (NFR-003) ------------------------------------------------------

def test_latencia_p95_menor_a_2000_ms_en_200_predicciones(cliente):
    cliente.post(RUTA, json=CUERPO)  # la primera llamada carga y verifica el modelo
    tiempos = []
    for i in range(200):
        cuerpo = {**CUERPO, "glucosa": 60.0 + i % 120}
        inicio = time.perf_counter()
        assert cliente.post(RUTA, json=cuerpo).status_code == 200
        tiempos.append((time.perf_counter() - inicio) * 1000)

    p95 = statistics.quantiles(tiempos, n=100)[94]

    assert p95 < 2000, f"p95={p95:.1f} ms"
