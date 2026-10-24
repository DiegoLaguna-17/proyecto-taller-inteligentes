"""
preparar_features y predecir_riesgo con un modelo pequeno entrenado sobre datos
sinteticos dentro de la propia sesion de pruebas: sin el Excel real, sin el
.pkl real y sin red.
"""
import pytest
from datos_sinteticos import PERFIL, dataframe_sintetico, preparado_sintetico

from app.data_prep import MAPEO_MEDICACION, MAPEO_MOMENTO, preparar_features
from app.predict import _construir_dataframe_paciente, predecir_riesgo


def test_preparar_features_expande_a_una_fila_por_lectura():
    df = dataframe_sintetico()
    X, y, grupos, columnas, medianas = preparado_sintetico()

    assert len(X) == len(y) == len(grupos)
    assert len(X) == 2 * len(df)  # cada registro aporta ayunas y postprandial
    assert list(X.columns) == columnas
    assert set(X["momento_cod"]) == set(MAPEO_MOMENTO.values())
    assert set(X["medicacion_cod"]) <= set(MAPEO_MEDICACION.values())
    assert set(y) == {0, 1}
    assert not X.isna().any().any()


def test_preparar_features_agrupa_por_paciente_real_sin_sufijo_de_registro():
    _, _, grupos, _, _ = preparado_sintetico()

    assert not grupos.str.contains("_").any()
    assert grupos.nunique() == 30


def test_hba1c_faltante_se_marca_y_se_imputa_con_la_mediana_dada():
    # hba1c=None es como lo envia el router (campo opcional presente pero vacio).
    df = _construir_dataframe_paciente({**PERFIL, "hba1c": None})

    X, _, _, _, medianas = preparar_features(
        df, expandir_lecturas=False, medianas_imputacion={"HbA1c (%)": 8.25}
    )

    assert X["hba1c_faltante"].iloc[0] == 1
    assert X["HbA1c (%)"].iloc[0] == 8.25
    assert medianas["HbA1c (%)"] == 8.25


def test_hba1c_presente_no_se_marca_como_faltante():
    X, _, _, _, _ = preparar_features(
        _construir_dataframe_paciente(PERFIL), expandir_lecturas=False, medianas_imputacion={"HbA1c (%)": 8.25}
    )

    assert X["hba1c_faltante"].iloc[0] == 0
    assert X["HbA1c (%)"].iloc[0] == PERFIL["hba1c"]


def test_predecir_riesgo_devuelve_una_probabilidad(artefactos):
    p = predecir_riesgo(PERFIL, str(artefactos))

    assert isinstance(p, float)
    assert 0.0 <= p <= 1.0


@pytest.mark.parametrize("momento", ["ayunas", "postprandial"])
@pytest.mark.parametrize("con_hba1c", [True, False])
def test_predecir_riesgo_cubre_ambos_momentos_con_y_sin_hba1c(artefactos, momento, con_hba1c):
    perfil = {**PERFIL, "momento": momento}
    if not con_hba1c:
        perfil["hba1c"] = None

    assert 0.0 <= predecir_riesgo(perfil, str(artefactos)) <= 1.0


def test_predecir_riesgo_es_determinista(artefactos):
    assert predecir_riesgo(PERFIL, str(artefactos)) == predecir_riesgo(dict(PERFIL), str(artefactos))


def test_una_glucosa_baja_no_da_menos_riesgo_que_una_alta(artefactos):
    """El modelo sintetico asocia glucosa baja con positivos: sirve de verificacion de cordura."""
    bajo = predecir_riesgo({**PERFIL, "glucosa": 60.0}, str(artefactos))
    alto = predecir_riesgo({**PERFIL, "glucosa": 300.0}, str(artefactos))

    assert bajo > alto


def test_el_modelo_se_carga_una_sola_vez(artefactos, monkeypatch):
    import joblib

    from app import predict

    llamadas = []
    original = joblib.load
    monkeypatch.setattr(predict.joblib, "load", lambda *a, **k: llamadas.append(1) or original(*a, **k))

    for _ in range(3):
        predecir_riesgo(PERFIL, str(artefactos))

    assert len(llamadas) == 1


def test_hba1c_ausente_y_none_se_tratan_igual_como_faltante():
    sin_clave = {k: v for k, v in PERFIL.items() if k != "hba1c"}
    medianas = {"HbA1c (%)": 8.25}

    for perfil in (sin_clave, {**PERFIL, "hba1c": None}):
        X, _, _, _, _ = preparar_features(
            _construir_dataframe_paciente(perfil), expandir_lecturas=False, medianas_imputacion=medianas
        )
        assert X["hba1c_faltante"].iloc[0] == 1
        assert X["HbA1c (%)"].iloc[0] == 8.25  # la mediana guardada, nunca 0


def test_prediccion_igual_con_hba1c_ausente_que_con_none(artefactos):
    sin_clave = {k: v for k, v in PERFIL.items() if k != "hba1c"}

    assert predecir_riesgo(sin_clave, str(artefactos)) == predecir_riesgo({**PERFIL, "hba1c": None}, str(artefactos))


def test_hba1c_ausente_cambia_la_prediccion_respecto_de_uno_presente(artefactos):
    """La bandera de faltante llega al modelo: con HbA1c presente el resultado no es el mismo."""
    sin_clave = {k: v for k, v in PERFIL.items() if k != "hba1c"}

    assert predecir_riesgo(sin_clave, str(artefactos)) != predecir_riesgo(PERFIL, str(artefactos))
