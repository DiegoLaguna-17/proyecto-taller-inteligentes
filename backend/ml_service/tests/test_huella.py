"""
La verificacion al cargar (RT-06): un .pkl alterado, ausente o entrenado con
otras versiones de librerias no se deserializa y falla con un error generico
que no revela rutas.
"""
import json

import pytest
from datos_sinteticos import PERFIL

from app import predict
from app.errors import ModeloNoDisponible
from app.metadatos import NOMBRE_METADATOS, NOMBRE_MODELO
from app.predict import modelo_cargado, predecir_riesgo


def _intentar(artefactos):
    with pytest.raises(ModeloNoDisponible) as info:
        predecir_riesgo(PERFIL, str(artefactos))
    return info.value


def _comprobar_generico(error, artefactos):
    assert str(error) == ModeloNoDisponible.MENSAJE
    assert str(artefactos) not in str(error)
    assert error.__cause__ is None


def test_artefacto_integro_carga(artefactos):
    assert modelo_cargado(str(artefactos)) is True


def test_pkl_alterado_falla_por_huella(artefactos):
    with open(artefactos / NOMBRE_MODELO, "ab") as f:
        f.write(b"\x00alterado")

    error = _intentar(artefactos)

    assert error.motivo == "huella_distinta"
    _comprobar_generico(error, artefactos)
    assert modelo_cargado(str(artefactos)) is False


def test_pkl_alterado_no_se_deserializa(artefactos, monkeypatch):
    with open(artefactos / NOMBRE_MODELO, "ab") as f:
        f.write(b"\x00alterado")
    monkeypatch.setattr(predict.joblib, "load", lambda *a, **k: pytest.fail("se deserializo un .pkl con huella distinta"))

    _intentar(artefactos)


def test_pkl_ausente(artefactos):
    (artefactos / NOMBRE_MODELO).unlink()

    error = _intentar(artefactos)

    assert error.motivo == "artefacto_ausente"
    _comprobar_generico(error, artefactos)


def test_json_ausente(artefactos):
    (artefactos / NOMBRE_METADATOS).unlink()

    error = _intentar(artefactos)

    assert error.motivo == "metadatos_ausentes"
    _comprobar_generico(error, artefactos)


@pytest.mark.parametrize("contenido", ["no es json", "[]", "{}"])
def test_json_invalido_o_incompleto(artefactos, contenido):
    (artefactos / NOMBRE_METADATOS).write_text(contenido, encoding="utf-8")

    error = _intentar(artefactos)

    assert error.motivo == "metadatos_invalidos"
    _comprobar_generico(error, artefactos)


def test_json_sin_un_campo_obligatorio(artefactos):
    ruta = artefactos / NOMBRE_METADATOS
    metadatos = json.loads(ruta.read_text(encoding="utf-8"))
    del metadatos["sha256_pkl"]
    ruta.write_text(json.dumps(metadatos), encoding="utf-8")

    assert _intentar(artefactos).motivo == "metadatos_invalidos"


def test_version_de_libreria_distinta_falla(artefactos):
    ruta = artefactos / NOMBRE_METADATOS
    metadatos = json.loads(ruta.read_text(encoding="utf-8"))
    metadatos["versiones"]["scikit-learn"] = "0.0.1"
    ruta.write_text(json.dumps(metadatos), encoding="utf-8")

    error = _intentar(artefactos)

    assert error.motivo == "versiones_distintas"
    _comprobar_generico(error, artefactos)


def test_python_distinto_en_el_parche_se_acepta_pero_no_en_el_minor(artefactos):
    ruta = artefactos / NOMBRE_METADATOS
    metadatos = json.loads(ruta.read_text(encoding="utf-8"))
    mayor, menor, *_ = metadatos["versiones"]["python"].split(".")

    metadatos["versiones"]["python"] = f"{mayor}.{menor}.999"
    ruta.write_text(json.dumps(metadatos), encoding="utf-8")
    assert modelo_cargado(str(artefactos)) is True

    predict._cargar_bundle.cache_clear()
    metadatos["versiones"]["python"] = f"{mayor}.{int(menor) + 1}.0"
    ruta.write_text(json.dumps(metadatos), encoding="utf-8")
    assert modelo_cargado(str(artefactos)) is False


def test_un_error_no_se_cachea_y_al_corregirse_el_artefacto_carga(artefactos):
    original = (artefactos / NOMBRE_MODELO).read_bytes()
    with open(artefactos / NOMBRE_MODELO, "ab") as f:
        f.write(b"x")
    assert modelo_cargado(str(artefactos)) is False

    (artefactos / NOMBRE_MODELO).write_bytes(original)

    assert modelo_cargado(str(artefactos)) is True
