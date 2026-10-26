from fastapi.testclient import TestClient

from app.main import app


def test_health_retorna_200_y_modelo_no_cargado_sin_artefactos(tmp_path, monkeypatch):
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(tmp_path))

    respuesta = TestClient(app).get("/health")

    assert respuesta.status_code == 200
    assert respuesta.json() == {"status": "ok", "service": "glucotracker-ml", "modelo_cargado": False}


def test_health_informa_modelo_cargado(artefactos, monkeypatch):
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(artefactos))

    with TestClient(app) as cliente:
        respuesta = cliente.get("/health")

    assert respuesta.status_code == 200
    assert respuesta.json()["modelo_cargado"] is True


def test_health_no_expone_rutas_ni_versiones(tmp_path, monkeypatch):
    monkeypatch.setenv("ML_ARTEFACTOS_DIR", str(tmp_path))

    texto = TestClient(app).get("/health").text

    assert str(tmp_path) not in texto
    assert "scikit" not in texto
