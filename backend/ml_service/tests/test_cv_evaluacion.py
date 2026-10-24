"""
Pruebas de app/cv_evaluacion.py con un dataset sintetico pequeno: sin red y
sin el Excel real. Correr desde backend/ml_service/:

    python -m pytest
"""
import json

import numpy as np
import pandas as pd
import pytest
from datos_sinteticos import N_POSITIVOS_SINTETICOS, dataset_sintetico

from app import cv_evaluacion as cv
from app.train_baseline import METRICAS_PATH

N_POSITIVOS = N_POSITIVOS_SINTETICOS


@pytest.fixture(scope="module")
def datos():
    return dataset_sintetico()


@pytest.fixture(scope="module")
def resultado(datos):
    X, y, grupos = datos
    return cv.evaluar(X, y, grupos, semillas=(0, 1), n_splits=3, n_bootstrap=40, semilla_bootstrap=7)


@pytest.mark.parametrize("semilla", [0, 1, 2])
def test_folds_sin_fuga_y_cubren_todas_las_filas(datos, semilla):
    _, y, grupos = datos
    grupos = np.asarray(grupos)
    vistas = []
    for train_idx, test_idx in cv.generar_folds(y, grupos, semilla, n_splits=5):
        assert set(grupos[train_idx]).isdisjoint(set(grupos[test_idx]))
        assert len(train_idx) + len(test_idx) == len(grupos)
        vistas.extend(test_idx.tolist())
    assert sorted(vistas) == list(range(len(grupos)))


def test_cada_fold_recibe_la_misma_cantidad_de_pacientes_positivos(datos):
    _, y, grupos = datos
    por_fold = [cv._pacientes_positivos(np.asarray(y)[te], np.asarray(grupos)[te])
                for _, te in cv.generar_folds(y, grupos, semilla=0, n_splits=5)]
    assert por_fold == [N_POSITIVOS // 5] * 5


def test_bootstrap_remuestrea_pacientes_completos():
    grupos = np.array(["a", "a", "a", "b", "c", "c"])
    _, inverso = np.unique(grupos, return_inverse=True)
    filas_por_paciente = [np.where(inverso == i)[0] for i in range(inverso.max() + 1)]

    idx = cv.indices_bootstrap(filas_por_paciente, np.random.default_rng(0))

    for paciente in set(grupos[idx]):
        filas_del_paciente = np.where(grupos == paciente)[0]
        apariciones = np.isin(idx, filas_del_paciente).sum()
        assert apariciones % len(filas_del_paciente) == 0


def test_bootstrap_reproducible_con_la_misma_semilla(datos):
    _, y, grupos = datos
    rng = np.random.default_rng(3)
    oof = np.vstack([rng.random(len(y)), rng.random(len(y))])

    primera = cv.bootstrap_por_pacientes(y, grupos, oof, n_bootstrap=50, semilla=11)
    segunda = cv.bootstrap_por_pacientes(y, grupos, oof, n_bootstrap=50, semilla=11)
    otra = cv.bootstrap_por_pacientes(y, grupos, oof, n_bootstrap=50, semilla=12)

    assert primera == segunda
    assert primera["auc_roc"] != otra["auc_roc"]


def test_estructura_de_la_salida(resultado):
    assert set(resultado) == set(cv.VARIANTES)
    for variante in resultado.values():
        assert set(variante) == {"descripcion", "hiperparametros", "umbrales", "agregado", "folds"}
        assert set(variante["agregado"]) == set(cv.nombres_metricas())
        for nombre, metrica in variante["agregado"].items():
            assert set(metrica) == {"media", "ic95", "bootstrap_validos"}
            inferior, superior = metrica["ic95"]
            # el lift no esta acotado a 1 (precision / prevalencia)
            tope = float("inf") if nombre.startswith("lift@") else 1.0
            assert 0.0 <= metrica["media"] <= tope
            assert 0.0 <= inferior <= superior <= tope
        assert len(variante["folds"]) == 2 * 3
        for fold in variante["folds"]:
            assert fold["pacientes_positivos_test"] >= 1
            assert {"auc_roc", "recall@0.25", "precision@0.5"} <= set(fold)


def test_la_evaluacion_completa_se_regenera_igual_con_las_mismas_semillas(datos, resultado):
    X, y, grupos = datos

    otra_vez = cv.evaluar(X, y, grupos, semillas=(0, 1), n_splits=3, n_bootstrap=40, semilla_bootstrap=7)
    referencias_1 = cv.evaluar(X, y, grupos, variantes=cv.REFERENCIAS, semillas=(0, 1), n_splits=3, n_bootstrap=40, semilla_bootstrap=7)
    referencias_2 = cv.evaluar(X, y, grupos, variantes=cv.REFERENCIAS, semillas=(0, 1), n_splits=3, n_bootstrap=40, semilla_bootstrap=7)

    assert otra_vez == resultado
    assert referencias_1 == referencias_2


def test_todas_las_variantes_usan_los_mismos_folds(resultado):
    def conteos(variante):
        return [(f["semilla_particion"], f["fold"], f["filas_test"], f["pacientes_positivos_test"]) for f in variante["folds"]]

    referencia = conteos(resultado["rl_smote"])
    assert all(conteos(v) == referencia for v in resultado.values())


def test_reporte_serializable_y_sin_ids_de_pacientes(datos, resultado, tmp_path):
    X, y, grupos = datos
    reporte = cv.construir_reporte(X, y, grupos, resultado, semillas=(0, 1), n_splits=3, n_bootstrap=40, semilla_bootstrap=7)
    ruta = tmp_path / "cv_metrics.json"

    cv.escribir_reporte(reporte, str(ruta))

    texto = ruta.read_text(encoding="utf-8")
    cargado = json.loads(texto)
    assert cargado["dataset"]["pacientes_positivos"] == N_POSITIVOS
    assert "sintetico" not in texto
    assert set(cargado["versiones"]) >= {"python", "scikit-learn", "imbalanced-learn", "numpy"}


def dataset_medicacion_perfecta():
    """
    20 pacientes, 1 fila cada uno, 5 positivos. Todos los positivos tienen
    medicacion_cod = 3 (insulina) y ningun negativo la tiene: la regla por
    medicacion separa las clases sin error.
    """
    n = 20
    y = pd.Series([1] * 5 + [0] * (n - 5))
    medicacion = [3] * 5 + [0, 1, 2] * 5
    X = pd.DataFrame({"medicacion_cod": medicacion[:n], "otra": np.arange(n, dtype=float)})
    grupos = pd.Series([f"sintetico{i:03d}" for i in range(n)])
    return X, y, grupos


def evaluar_referencias(X, y, grupos):
    return cv.evaluar(X, y, grupos, variantes=cv.REFERENCIAS, semillas=(0, 1), n_splits=5,
                      n_bootstrap=60, semilla_bootstrap=7)


def test_referencia_medicacion_da_auc_perfecto_en_un_caso_construido():
    X, y, grupos = dataset_medicacion_perfecta()

    medicacion = evaluar_referencias(X, y, grupos)["ref_medicacion"]["agregado"]

    assert medicacion["auc_roc"]["media"] == pytest.approx(1.0)
    assert medicacion["auc_roc"]["ic95"] == pytest.approx([1.0, 1.0])
    # el corte >=3 marca exactamente a los 5 positivos
    assert medicacion["recall@3"]["media"] == 1.0
    assert medicacion["precision@3"]["media"] == 1.0
    assert medicacion["lift@3"]["media"] == pytest.approx(1.0 / 0.25)
    # el corte >=1 marca a casi todos: recall perfecto, precision baja
    assert medicacion["recall@1"]["media"] == 1.0
    assert medicacion["precision@1"]["media"] < 1.0


def test_referencia_constante_da_auc_medio_y_lift_uno():
    X, y, grupos = dataset_medicacion_perfecta()

    constante = evaluar_referencias(X, y, grupos)["ref_prevalencia"]["agregado"]

    assert constante["auc_roc"]["media"] == pytest.approx(0.5)
    assert constante["auc_roc"]["ic95"] == pytest.approx([0.5, 0.5])
    # marca a todos como positivos: la precision es la prevalencia y el lift 1
    assert constante["recall@0.5"]["media"] == 1.0
    assert constante["precision@0.5"]["media"] == pytest.approx(constante["prevalencia"]["media"])
    assert constante["lift@0.5"]["media"] == pytest.approx(1.0)


def test_referencias_usan_los_mismos_folds_que_las_variantes(resultado, datos):
    X, y, grupos = datos
    referencias = cv.evaluar(X, y, grupos, variantes=cv.REFERENCIAS, semillas=(0, 1), n_splits=3,
                             n_bootstrap=40, semilla_bootstrap=7)

    def conteos(variante):
        return [(f["semilla_particion"], f["fold"], f["filas_test"], f["pacientes_positivos_test"]) for f in variante["folds"]]

    referencia = conteos(resultado["rl_smote"])
    assert all(conteos(v) == referencia for v in referencias.values())


def test_prevalencia_por_fold_y_lift():
    y = np.array([1, 0, 0, 0, 1, 0, 0, 0])
    proba = np.array([0.9, 0.8, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1])

    metricas = cv.calcular_metricas(y, proba, umbrales=(0.5,))

    assert metricas["prevalencia"] == 0.25
    assert metricas["precision@0.5"] == 0.5
    assert metricas["lift@0.5"] == pytest.approx(2.0)


def test_folds_informan_prevalencia(resultado):
    for fold in resultado["rl_smote"]["folds"]:
        assert fold["prevalencia"] == pytest.approx(fold["filas_positivas_test"] / fold["filas_test"])


def test_referencias_van_en_seccion_aparte_del_reporte(datos, resultado):
    X, y, grupos = datos
    referencias = evaluar_referencias(*dataset_medicacion_perfecta())

    reporte = cv.construir_reporte(X, y, grupos, resultado, semillas=(0, 1), n_splits=3, n_bootstrap=40,
                                   semilla_bootstrap=7, referencias=referencias)

    assert set(reporte["referencias"]) == {"ref_prevalencia", "ref_medicacion"}
    assert not set(reporte["referencias"]) & set(reporte["variantes"])


def test_no_sobrescribe_baseline_metrics():
    with pytest.raises(ValueError):
        cv.escribir_reporte({}, METRICAS_PATH)


def test_metricas_sin_positivos_no_inventan_valores():
    metricas = cv.calcular_metricas(np.zeros(4), np.array([0.1, 0.6, 0.3, 0.9]))

    assert metricas["auc_roc"] is None
    assert metricas["recall@0.5"] is None
    assert metricas["precision@0.5"] == 0.0
