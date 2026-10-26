"""
Seleccion real/demo (ADR-0009, Fase S3). El modelo de DEMO se entrena con datos
sinteticos: aprende las reglas del equipo, no la realidad. Estas pruebas solo
comprueban que los dos modelos nunca se confunden. Sin red y sin datos reales.
"""
import json
import shutil

import pytest
from datos_sinteticos import PERFIL
from fastapi.testclient import TestClient

from app import predict
from app.config import load_settings
from app.errors import ConfiguracionInvalida, ModeloNoDisponible
from app.main import crear_app
from app.metadatos import (
    CAMPOS_OBLIGATORIOS_DEMO,
    NOMBRE_METADATOS,
    NOMBRE_METADATOS_DEMO,
    NOMBRE_MODELO,
    NOMBRE_MODELO_DEMO,
    SUBCARPETA_DEMO,
    sha256_archivo,
)
from app.predict import modelo_cargado, predecir_con_version, version_modelo

RUTA = "/api/riesgo/hipoglucemia"


def _motivo(artefactos, modo):
    with pytest.raises(ModeloNoDisponible) as info:
        predecir_con_version(PERFIL, str(artefactos), modo)
    return info.value.motivo


# --- Configuracion -----------------------------------------------------------

def test_ml_modelo_es_real_por_defecto():
    assert load_settings({}).modelo == "real"
    assert load_settings({"ML_MODELO": ""}).modelo == "real"


@pytest.mark.parametrize("valor,esperado", [("real", "real"), ("demo", "demo"), ("DEMO", "demo"), (" Real ", "real")])
def test_ml_modelo_acepta_real_y_demo(valor, esperado):
    assert load_settings({"ML_MODELO": valor}).modelo == esperado


@pytest.mark.parametrize("valor", ["produccion", "demo2", "true", "sintetico"])
def test_ml_modelo_invalido_es_configuracion_invalida_sin_eco(valor):
    with pytest.raises(ConfiguracionInvalida) as info:
        load_settings({"ML_MODELO": valor})

    assert "ML_MODELO" in str(info.value)
    assert valor not in str(info.value)


# --- Seleccion al cargar ------------------------------------------------------

def test_sin_variable_se_sirve_el_modelo_real(ambos, monkeypatch):
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(ambos))

    _, version = predecir_con_version(PERFIL)

    assert version == "1.0.0"
    assert not version.endswith("-demo")


def test_con_demo_se_sirve_el_modelo_de_demo(ambos, monkeypatch):
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(ambos))
    monkeypatch.setenv("ML_MODELO", "demo")

    p, version = predecir_con_version(PERFIL)

    assert 0.0 <= p <= 1.0
    assert version == "1.1.0"
    assert "demo" not in version


def test_los_dos_modelos_son_distintos(ambos):
    real, demo = (predecir_con_version(PERFIL, str(ambos), m)[0] for m in ("real", "demo"))

    assert real != demo
    assert version_modelo(str(ambos), "real") != version_modelo(str(ambos), "demo")


def test_con_real_nunca_se_carga_el_demo(tmp_path, ambos):
    """Solo existe el modelo de demo: en modo real no hay modelo (no 'cae' al demo)."""
    solo_demo = tmp_path / "solo_demo"
    shutil.copytree(ambos / SUBCARPETA_DEMO, solo_demo / SUBCARPETA_DEMO)

    assert modelo_cargado(str(solo_demo), "real") is False
    assert _motivo(solo_demo, "real") == "artefacto_ausente"
    assert modelo_cargado(str(solo_demo), "demo") is True


def test_con_demo_nunca_se_carga_el_real(tmp_path, ambos):
    solo_real = tmp_path / "solo_real"
    solo_real.mkdir()
    shutil.copy(ambos / NOMBRE_MODELO, solo_real / NOMBRE_MODELO)
    shutil.copy(ambos / NOMBRE_METADATOS, solo_real / NOMBRE_METADATOS)

    assert modelo_cargado(str(solo_real), "demo") is False
    assert _motivo(solo_real, "demo") == "artefacto_ausente"
    assert modelo_cargado(str(solo_real), "real") is True


def test_un_modelo_de_demo_copiado_a_la_ubicacion_del_real_se_rechaza(tmp_path, ambos):
    trampa = tmp_path / "trampa"
    trampa.mkdir()
    shutil.copy(ambos / SUBCARPETA_DEMO / NOMBRE_MODELO_DEMO, trampa / NOMBRE_MODELO)
    shutil.copy(ambos / SUBCARPETA_DEMO / NOMBRE_METADATOS_DEMO, trampa / NOMBRE_METADATOS)

    assert _motivo(trampa, "real") == "modo_incompatible"


def test_un_modelo_real_copiado_a_la_ubicacion_del_demo_se_rechaza(tmp_path, ambos):
    trampa = tmp_path / "trampa"
    (trampa / SUBCARPETA_DEMO).mkdir(parents=True)
    shutil.copy(ambos / NOMBRE_MODELO, trampa / SUBCARPETA_DEMO / NOMBRE_MODELO_DEMO)
    shutil.copy(ambos / NOMBRE_METADATOS, trampa / SUBCARPETA_DEMO / NOMBRE_METADATOS_DEMO)

    assert _motivo(trampa, "demo") in ("metadatos_invalidos", "modo_incompatible")


def test_un_demo_con_metadatos_de_otro_modo_no_pasa(ambos):
    """Aunque la huella sea correcta, si el JSON no declara 'sintetico' y '-demo' no se carga en modo demo."""
    ruta = ambos / SUBCARPETA_DEMO / NOMBRE_METADATOS_DEMO
    meta = json.loads(ruta.read_text(encoding="utf-8"))
    meta["entrenado_con"] = "real"
    ruta.write_text(json.dumps(meta), encoding="utf-8")

    assert _motivo(ambos, "demo") == "modo_incompatible"


def test_el_modo_se_decide_por_entrenado_con_y_no_por_la_version(ambos):
    """ADR-0011: la version del sintetico es neutra; la marca que protege la carga es `entrenado_con`."""
    ruta = ambos / SUBCARPETA_DEMO / NOMBRE_METADATOS_DEMO
    meta = json.loads(ruta.read_text(encoding="utf-8"))
    meta["version_modelo"] = "9.9.9"
    ruta.write_text(json.dumps(meta), encoding="utf-8")
    assert predecir_con_version(PERFIL, str(ambos), "demo")[1] == "9.9.9"  # la version no decide el modo


def test_un_demo_sin_entrenado_con_sintetico_no_se_sirve(ambos):
    ruta = ambos / SUBCARPETA_DEMO / NOMBRE_METADATOS_DEMO
    meta = json.loads(ruta.read_text(encoding="utf-8"))
    meta["entrenado_con"] = "real"
    ruta.write_text(json.dumps(meta), encoding="utf-8")

    assert _motivo(ambos, "demo") == "modo_incompatible"


def test_un_real_marcado_como_sintetico_no_se_sirve_en_modo_real(ambos):
    ruta = ambos / NOMBRE_METADATOS
    meta = json.loads(ruta.read_text(encoding="utf-8"))
    meta["entrenado_con"] = "sintetico"
    ruta.write_text(json.dumps(meta), encoding="utf-8")

    assert _motivo(ambos, "real") == "modo_incompatible"


# --- Falta de artefacto, huella y versiones del demo ---------------------------

def test_falta_el_artefacto_de_demo(ambos):
    shutil.rmtree(ambos / SUBCARPETA_DEMO)

    assert _motivo(ambos, "demo") == "artefacto_ausente"
    assert modelo_cargado(str(ambos), "real") is True  # el real sigue disponible


def test_huella_alterada_del_demo_se_rechaza_y_no_se_deserializa(ambos, monkeypatch):
    with open(ambos / SUBCARPETA_DEMO / NOMBRE_MODELO_DEMO, "ab") as f:
        f.write(b"\x00alterado")
    monkeypatch.setattr(predict.joblib, "load", lambda *a, **k: pytest.fail("se deserializo un .pkl alterado"))

    assert _motivo(ambos, "demo") == "huella_distinta"


def test_version_de_libreria_distinta_en_el_demo(ambos):
    ruta = ambos / SUBCARPETA_DEMO / NOMBRE_METADATOS_DEMO
    meta = json.loads(ruta.read_text(encoding="utf-8"))
    meta["versiones"]["scikit-learn"] = "0.0.1"
    ruta.write_text(json.dumps(meta), encoding="utf-8")

    assert _motivo(ambos, "demo") == "versiones_distintas"


def test_json_de_demo_sin_un_campo_obligatorio(ambos):
    ruta = ambos / SUBCARPETA_DEMO / NOMBRE_METADATOS_DEMO
    meta = json.loads(ruta.read_text(encoding="utf-8"))
    del meta["advertencia"]
    ruta.write_text(json.dumps(meta), encoding="utf-8")

    assert _motivo(ambos, "demo") == "metadatos_invalidos"


# --- Metadatos del modelo de demo ----------------------------------------------

def test_los_metadatos_de_demo_tienen_todos_los_campos(ambos):
    meta = json.loads((ambos / SUBCARPETA_DEMO / NOMBRE_METADATOS_DEMO).read_text(encoding="utf-8"))

    assert set(CAMPOS_OBLIGATORIOS_DEMO) <= set(meta)
    assert meta["entrenado_con"] == "sintetico"
    assert meta["version_modelo"] == "1.1.0"
    assert "demo" not in meta["version_modelo"].lower()
    assert meta["sha256_pkl"] == sha256_archivo(str(ambos / SUBCARPETA_DEMO / NOMBRE_MODELO_DEMO))
    assert meta["semilla_dataset"] == 3 and meta["version_reglas"]
    assert meta["random_state"] == 42
    assert meta["usa_smote_nc"] is False
    assert "NO son desempeno clinico" in meta["advertencia"] and "SINTETICOS" in meta["advertencia"]
    assert meta["metricas"]["rotulo"].startswith("validacion sintetica, no clinica")
    assert {"python", "scikit-learn", "numpy", "scipy", "pandas"} <= set(meta["versiones"])


def test_los_metadatos_de_demo_no_tienen_ids_ni_valores_por_paciente(ambos):
    texto = (ambos / SUBCARPETA_DEMO / NOMBRE_METADATOS_DEMO).read_text(encoding="utf-8")

    assert "sint-" not in texto
    assert "id_paciente" not in texto


def test_el_modelo_real_no_declara_entrenado_con_sintetico(ambos):
    meta = json.loads((ambos / NOMBRE_METADATOS).read_text(encoding="utf-8"))

    assert meta.get("entrenado_con") != "sintetico"
    assert meta["version_modelo"] == "1.0.0"


# --- Endpoint: seleccion sin cambiar el contrato publico ------------------------

def test_la_api_con_demo_responde_con_version_demo_y_el_mismo_contrato(ambos, monkeypatch):
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(ambos))
    monkeypatch.setenv("ML_MODELO", "demo")

    with TestClient(crear_app(habilitar_docs=False)) as cliente:
        respuesta = cliente.post(RUTA, json=PERFIL)
        salud = cliente.get("/health")

    assert respuesta.status_code == 200
    assert set(respuesta.json()) == {"riesgo_hipoglucemia", "version_modelo"}  # el campo 'modo' llega en S4
    assert respuesta.json()["version_modelo"] == "1.1.0"
    assert "demo" not in respuesta.text.lower()
    assert salud.json()["modelo_cargado"] is True


def test_la_api_con_real_no_usa_el_demo(ambos, monkeypatch):
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(ambos))

    respuesta = TestClient(crear_app(habilitar_docs=False)).post(RUTA, json=PERFIL)

    assert respuesta.status_code == 200
    assert respuesta.json()["version_modelo"] == "1.0.0"


def test_la_api_con_demo_sin_artefacto_de_demo_responde_503_generico(ambos, monkeypatch):
    shutil.rmtree(ambos / SUBCARPETA_DEMO)
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(ambos))
    monkeypatch.setenv("ML_MODELO", "demo")

    respuesta = TestClient(crear_app(habilitar_docs=False)).post(RUTA, json=PERFIL)

    assert respuesta.status_code == 503
    assert respuesta.json() == {"detail": "El modelo de riesgo no está disponible en este momento."}
    assert str(ambos) not in respuesta.text


def test_la_api_con_ml_modelo_invalido_responde_503_sin_eco(ambos, monkeypatch):
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(ambos))
    monkeypatch.setenv("ML_MODELO", "valor-raro-9")

    respuesta = TestClient(crear_app(habilitar_docs=False)).post(RUTA, json=PERFIL)

    assert respuesta.status_code == 503
    assert "valor-raro-9" not in respuesta.text and "ML_MODELO" not in respuesta.text


def test_la_api_con_demo_alterado_responde_503(ambos, monkeypatch):
    with open(ambos / SUBCARPETA_DEMO / NOMBRE_MODELO_DEMO, "ab") as f:
        f.write(b"x")
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(ambos))
    monkeypatch.setenv("ML_MODELO", "demo")

    respuesta = TestClient(crear_app(habilitar_docs=False)).post(RUTA, json=PERFIL)

    assert respuesta.status_code == 503
    assert "huella" not in respuesta.text


def test_con_ml_modelo_invalido_el_servicio_arranca_y_responde_503(ambos, monkeypatch):
    """Antes de este arreglo la excepcion saltaba al importar/arrancar y el servicio no levantaba."""
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(ambos))
    monkeypatch.setenv("ML_MODELO", "valor-raro-9")

    aplicacion = crear_app()  # sin habilitar_docs explicito: lee la configuracion invalida
    with TestClient(aplicacion) as cliente:  # con lifespan
        salud = cliente.get("/health")
        riesgo = cliente.post(RUTA, json=PERFIL)

    for respuesta in (salud, riesgo):
        assert respuesta.status_code == 503
        assert "valor-raro-9" not in respuesta.text and "ML_MODELO" not in respuesta.text
    assert cliente.get("/docs").status_code == 404  # con configuracion invalida, la documentacion queda apagada
