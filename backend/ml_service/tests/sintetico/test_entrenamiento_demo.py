"""
Entrenamiento del modelo de DEMO (Fase S3, TASK-011g). Aprende las reglas del
equipo, no la realidad: nada de esto es desempeno clinico. Sin red y sin los
datos reales.
"""
import json
import os
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from imblearn.over_sampling import SMOTENC

from app import cv_evaluacion as cv
from app import predict, train_baseline, train_demo
from app.metadatos import (
    NOMBRE_CV_DEMO,
    NOMBRE_METADATOS_DEMO,
    NOMBRE_MODELO_DEMO,
    SUBCARPETA_DEMO,
    ruta_modelo,
)
from app.sintetico import adaptador
from app.sintetico.generador import escribir_dataset, generar_dataset
from app.train_baseline import construir_pipeline, entrenar_y_evaluar

APP_DIR = Path(__file__).resolve().parents[2] / "app"


@pytest.fixture(scope="module")
def csv_sintetico(tmp_path_factory):
    ruta = str(tmp_path_factory.mktemp("ds_demo") / "dataset_sintetico.csv")
    escribir_dataset(generar_dataset(800, 3), ruta)
    return ruta


def _entrenar(base, csv):
    pipeline, metricas = entrenar_y_evaluar(str(base), origen="sintetico", ruta_dataset=csv)
    return pipeline, metricas


# --- Reproducibilidad ---------------------------------------------------------

def test_el_entrenamiento_es_reproducible_con_la_misma_semilla(tmp_path, csv_sintetico):
    a, ma = _entrenar(tmp_path / "a", csv_sintetico)
    b, mb = _entrenar(tmp_path / "b", csv_sintetico)

    assert ma == mb
    coef_a = a.named_steps["modelo"].coef_
    coef_b = b.named_steps["modelo"].coef_
    assert np.array_equal(coef_a, coef_b)
    assert a.named_steps["modelo"].intercept_ == b.named_steps["modelo"].intercept_


def test_dos_datasets_con_semillas_distintas_dan_modelos_distintos(tmp_path):
    csv1, csv2 = str(tmp_path / "d1" / "ds.csv"), str(tmp_path / "d2" / "ds.csv")
    escribir_dataset(generar_dataset(800, 1), csv1)
    escribir_dataset(generar_dataset(800, 2), csv2)

    a, _ = _entrenar(tmp_path / "a", csv1)
    b, _ = _entrenar(tmp_path / "b", csv2)

    assert not np.array_equal(a.named_steps["modelo"].coef_, b.named_steps["modelo"].coef_)


# --- Separacion por paciente ------------------------------------------------------

def test_el_split_separa_por_paciente(tmp_path, csv_sintetico, monkeypatch):
    registrado = {}
    original = train_baseline.GroupShuffleSplit

    class Espia(original):
        def split(self, X, y=None, groups=None):
            for train_idx, test_idx in super().split(X, y, groups):
                registrado["train"], registrado["test"], registrado["grupos"] = train_idx, test_idx, np.asarray(groups)
                yield train_idx, test_idx

    monkeypatch.setattr(train_baseline, "GroupShuffleSplit", Espia)

    _entrenar(tmp_path / "a", csv_sintetico)

    grupos = registrado["grupos"]
    assert set(grupos[registrado["train"]]).isdisjoint(set(grupos[registrado["test"]]))
    assert len(registrado["train"]) + len(registrado["test"]) == len(grupos)
    assert len(set(grupos)) < len(grupos)  # hay pacientes con varios registros: la separacion importa


# --- No lee los datos reales ------------------------------------------------------

def test_el_entrenamiento_de_demo_no_lee_los_109_registros_reales(tmp_path, csv_sintetico, monkeypatch):
    def prohibido(*a, **k):
        raise AssertionError("el entrenamiento de demo intento leer los datos reales")

    monkeypatch.setattr(train_baseline, "cargar_summary_crudo", prohibido)
    monkeypatch.setattr(train_baseline, "limpiar_datos_clinicos", prohibido)
    monkeypatch.setattr(pd, "read_excel", prohibido)

    _entrenar(tmp_path / "a", csv_sintetico)
    reporte = train_demo.entrenar_demo(
        str(tmp_path / "b"), csv_sintetico, semillas=(0,), n_splits=3, n_bootstrap=20, n_bootstrap_coef=5
    )

    assert reporte["entrenado_con"] == "sintetico"


@pytest.mark.parametrize("modulo", ["train_demo.py", os.path.join("sintetico", "adaptador.py")])
def test_los_modulos_de_demo_no_referencian_los_datos_reales(modulo):
    texto = (APP_DIR / modulo).read_text(encoding="utf-8")

    for prohibido in ("read_excel", "cargar_summary_crudo", "RAW_DATA_PATH", "ShanghaiT2DM", "limpiar_datos_clinicos"):
        assert prohibido not in texto, prohibido


# --- Pipeline: sin SMOTE-NC en el demo, con SMOTE-NC en el real ----------------------

def test_el_modelo_de_demo_no_usa_smote_y_el_real_si(tmp_path, csv_sintetico):
    demo, _ = _entrenar(tmp_path / "a", csv_sintetico)
    X = pd.DataFrame({"glucosa": [90.0, 150.0, 70.0, 200.0] * 5, "Age (years)": [60] * 20, "BMI (kg/m2)": [25.0] * 20,
                      "Duration of diabetes (years)": [5.0] * 20, "HbA1c (%)": [8.0] * 20, "momento_cod": [0, 1] * 10,
                      "medicacion_cod": [0, 1, 2, 3] * 5, "genero_masculino": [0, 1] * 10, "hba1c_faltante": [0] * 20})
    y = pd.Series([0, 1] * 10)

    assert demo.named_steps["smote"] == "passthrough"
    assert isinstance(construir_pipeline(X, y).named_steps["smote"], SMOTENC)  # el real conserva SMOTE-NC por defecto
    assert construir_pipeline(X, y, usar_smote=False).named_steps["smote"] == "passthrough"


# --- Salidas: solo en artefactos/demo/ ----------------------------------------------

def test_solo_escribe_en_la_carpeta_de_demo(tmp_path, csv_sintetico):
    base = tmp_path / "artefactos"
    _entrenar(base, csv_sintetico)

    assert sorted(p.name for p in base.iterdir()) == [SUBCARPETA_DEMO]  # nada en la raiz (modelo real)
    assert sorted(p.name for p in (base / SUBCARPETA_DEMO).iterdir()) == sorted([NOMBRE_MODELO_DEMO, NOMBRE_METADATOS_DEMO])
    assert not (base / "baseline_metrics.json").exists()
    assert ruta_modelo(str(base), "demo") == str(base / SUBCARPETA_DEMO / NOMBRE_MODELO_DEMO)


def test_el_reporte_de_validacion_sintetica_esta_rotulado_y_completo(tmp_path, csv_sintetico):
    base = tmp_path / "artefactos"

    reporte = train_demo.entrenar_demo(str(base), csv_sintetico, semillas=(0, 1), n_splits=3, n_bootstrap=30, n_bootstrap_coef=10)

    ruta = base / SUBCARPETA_DEMO / NOMBRE_CV_DEMO
    escrito = json.loads(ruta.read_text(encoding="utf-8"))
    assert reporte["ruta_cv"] == str(ruta)
    assert "NO ES DESEMPENO CLINICO" in escrito["rotulo"]
    assert escrito["entrenado_con"] == "sintetico"
    assert 0.5 < escrito["modelo_demo"]["agregado"]["auc_roc"]["media"] < 1.0
    assert escrito["reglas_verdaderas"]["auc_roc"]["media"] >= escrito["modelo_demo"]["agregado"]["auc_roc"]["media"] - 0.05
    assert set(escrito["comparacion"]) == {"auc_modelo", "auc_reglas_verdaderas", "diferencia", "fraccion_de_la_senal_recuperada"}
    assert set(escrito["controles"]["resultados"]) == set(train_demo.CONTROLES)
    assert escrito["decisiones_medidas"]["smote_nc"]["usado"] is False
    assert escrito["decisiones_medidas"]["interacciones"]["usadas"] is False
    assert "sint-" not in ruta.read_text(encoding="utf-8")  # solo agregados


def test_no_sobrescribe_las_metricas_del_modelo_real(tmp_path, monkeypatch):
    destino = tmp_path / SUBCARPETA_DEMO / NOMBRE_CV_DEMO
    monkeypatch.setattr(cv, "CV_METRICS_PATH", str(destino))

    with pytest.raises(ValueError):
        train_demo.escribir_reporte({}, str(tmp_path))
    assert not destino.exists()

    monkeypatch.setattr(cv, "CV_METRICS_PATH", str(tmp_path / "otro.json"))
    monkeypatch.setattr(train_demo, "METRICAS_PATH", str(destino))
    with pytest.raises(ValueError):
        train_demo.escribir_reporte({}, str(tmp_path))


def test_el_entrenamiento_no_toca_el_modelo_real_de_la_misma_carpeta(tmp_path, _artefactos_sinteticos, csv_sintetico):
    base = tmp_path / "artefactos"
    shutil.copytree(_artefactos_sinteticos[0], base)
    antes = {p.name: p.read_bytes() for p in base.iterdir() if p.is_file()}

    _entrenar(base, csv_sintetico)

    despues = {p.name: p.read_bytes() for p in base.iterdir() if p.is_file()}
    assert antes == despues


def test_el_modelo_entrenado_predice_con_el_cargador_en_modo_demo(tmp_path, csv_sintetico):
    base = tmp_path / "artefactos"
    _entrenar(base, csv_sintetico)

    p, version = predict.predecir_con_version(
        {"glucosa": 70.0, "momento": "ayunas", "genero": "femenino", "edad": 70, "bmi": 24.0, "duracion_diabetes": 10,
         "categoria_medicacion": "insulina", "hba1c": 6.5}, str(base), "demo")

    assert 0.0 < p < 1.0
    assert version == "1.1.0"


# --- Rechazo de datasets que no sean sinteticos --------------------------------------

def _copiar(csv, destino):
    destino.mkdir(parents=True, exist_ok=True)
    nuevo_csv = destino / "ds.csv"
    shutil.copy(csv, nuevo_csv)
    shutil.copy(os.path.splitext(csv)[0] + ".json", destino / "ds.json")
    return nuevo_csv


def _recalcular_huella(csv):
    meta_ruta = csv.with_suffix(".json")
    meta = json.loads(meta_ruta.read_text(encoding="utf-8"))
    meta["sha256_csv"] = adaptador._sha256(str(csv))
    meta_ruta.write_text(json.dumps(meta), encoding="utf-8")


def test_rechaza_un_dataset_con_filas_que_no_son_sinteticas(tmp_path, csv_sintetico):
    csv = _copiar(csv_sintetico, tmp_path / "x")
    df = pd.read_csv(csv)
    df.loc[0, "origen"] = "real"
    df.to_csv(csv, index=False, lineterminator="\n")
    _recalcular_huella(csv)

    with pytest.raises(ValueError, match="origen"):
        adaptador.cargar_dataset_sintetico(str(csv))
    with pytest.raises(ValueError):
        entrenar_y_evaluar(str(tmp_path / "salida"), origen="sintetico", ruta_dataset=str(csv))
    assert not (tmp_path / "salida").exists()


def test_rechaza_ids_sin_el_prefijo_sint(tmp_path, csv_sintetico):
    csv = _copiar(csv_sintetico, tmp_path / "x")
    df = pd.read_csv(csv)
    df.loc[0, "id_paciente_sintetico"] = "P-0001"
    df.to_csv(csv, index=False, lineterminator="\n")
    _recalcular_huella(csv)

    with pytest.raises(ValueError, match="sint-"):
        adaptador.cargar_dataset_sintetico(str(csv))


def test_rechaza_un_csv_que_no_coincide_con_su_huella(tmp_path, csv_sintetico):
    csv = _copiar(csv_sintetico, tmp_path / "x")
    with open(csv, "a", encoding="utf-8") as f:
        f.write("\n")

    with pytest.raises(ValueError, match="huella"):
        adaptador.cargar_dataset_sintetico(str(csv))


def test_rechaza_metadatos_que_no_declaran_origen_sintetico(tmp_path, csv_sintetico):
    csv = _copiar(csv_sintetico, tmp_path / "x")
    meta_ruta = csv.with_suffix(".json")
    meta = json.loads(meta_ruta.read_text(encoding="utf-8"))
    meta["origen"] = "real"
    meta_ruta.write_text(json.dumps(meta), encoding="utf-8")

    with pytest.raises(ValueError, match="sintetico"):
        adaptador.cargar_dataset_sintetico(str(csv))


def test_rechaza_dataset_sin_metadatos_o_inexistente(tmp_path, csv_sintetico):
    csv = _copiar(csv_sintetico, tmp_path / "x")
    csv.with_suffix(".json").unlink()

    with pytest.raises(ValueError, match="metadatos"):
        adaptador.cargar_dataset_sintetico(str(csv))
    with pytest.raises(ValueError) as info:
        adaptador.cargar_dataset_sintetico(str(tmp_path / "no_existe.csv"))
    assert str(tmp_path) not in str(info.value)  # el mensaje no revela rutas


def test_rechaza_origen_desconocido(tmp_path):
    with pytest.raises(ValueError):
        entrenar_y_evaluar(str(tmp_path), origen="otro")


def test_el_adaptador_conserva_el_orden_y_renombra_a_las_columnas_de_preparar_features(csv_sintetico):
    datos = adaptador.cargar_dataset_sintetico(csv_sintetico)
    df = datos["dataframe"]

    adaptado = adaptador.adaptar_para_entrenamiento(df)

    assert list(adaptado["id_paciente_real"]) == list(df["id_paciente_sintetico"])
    assert set(adaptado["riesgo_hipoglucemia_paciente"]) == {"yes", "no"}
    assert (adaptado["riesgo_hipoglucemia_paciente"] == "yes").sum() == df["hipoglucemia_registro"].sum()
    assert {"Age (years)", "BMI (kg/m2)", "HbA1c (%)", "Gender (Female=1, Male=2)", "glucosa", "momento"} <= set(adaptado.columns)
