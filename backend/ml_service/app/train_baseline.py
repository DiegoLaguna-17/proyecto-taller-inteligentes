"""
Entrenamiento del modelo baseline (Regresion Logistica) de riesgo de
hipoglucemia para GlucoTracker.

Adaptado de la Parte C del notebook `GlucoTracker_Consolidado_Hipoglucemia.ipynb`.
A diferencia del notebook, este script no imprime nada mas de lo necesario para
seguimiento en consola: el resultado real de correrlo son tres artefactos en
backend/ml_service/app/artefactos/:

    modelo_hipoglucemia.pkl    -> el pipeline entrenado + metadata (fuera de git)
    modelo_hipoglucemia.json   -> metadatos del modelo (en git, ML-D7): version,
                                  fecha, SHA-256 del .pkl, versiones de
                                  librerias, conteos y metricas
    baseline_metrics.json      -> metricas de evaluacion en test

Uso:
    python -m app.train_baseline
    (correr desde backend/ml_service/, con el entorno virtual activado)

ADR-0009: `entrenar_y_evaluar(origen="sintetico")` reutiliza esta misma tuberia
para el modelo de DEMO (datos sinteticos, sin SMOTE-NC), con artefactos propios
en artefactos/demo/. El modelo de demo aprende las reglas del equipo, no la
realidad: sus metricas no son desempeno clinico. Ver app/train_demo.py.
"""

import json
import os
from datetime import datetime, timezone
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTENC
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    confusion_matrix,
    precision_recall_fscore_support,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.config import load_settings
from app.data_prep import (
    COLUMNAS_BINARIAS_COMORBILIDAD,
    COLUMNAS_NUMERICAS_MODELO,
    RAW_DATA_PATH,
    cargar_summary_crudo,
    limpiar_datos_clinicos,
    preparar_features,
)
from app.metadatos import (
    ENTRENADO_CON_SINTETICO,
    MODO_DEMO,
    MODO_REAL,
    NOMBRE_MODELO,
    VERSION_MODELO_SINTETICO,
    escribir_metadatos,
    ruta_modelo,
    sha256_archivo,
    versiones_instaladas,
)
from app.sintetico import adaptador

# Valores por defecto (sin variables de entorno); entrenar_y_evaluar() acepta otra carpeta.
ARTEFACTOS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artefactos")
MODELO_PATH = os.path.join(ARTEFACTOS_DIR, NOMBRE_MODELO)
METRICAS_PATH = os.path.join(ARTEFACTOS_DIR, "baseline_metrics.json")

RANDOM_STATE = 42
TEST_SIZE = 0.2
VERSION_MODELO = "1.0.0"
VERSION_MODELO_DEMO = VERSION_MODELO_SINTETICO  # neutra: sin «demo» (ADR-0011)
ORIGENES = ("real", "sintetico")
RUTA_DATASET_SINTETICO = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "sintetico", "dataset_sintetico.csv"
)
ADVERTENCIA_DEMO = (
    "Modelo de DEMOSTRACION entrenado con datos SINTETICOS generados por reglas clinicas del equipo "
    "(pendientes de revision). Aprende esas reglas, no la realidad: sus metricas NO son desempeno clinico "
    "y sus probabilidades no son una estimacion clinica."
)


def _construir_indices_categoricas(X: pd.DataFrame) -> list:
    """
    SMOTE-NC necesita saber, por INDICE de columna, cuales son categoricas
    -- si no se le dice, trata columnas como momento_cod/medicacion_cod como
    continuas y podria "inventar" valores intermedios sin sentido
    (ej. momento_cod = 0.5). Estas son las mismas columnas categoricas
    definidas en `preparar_features` (Parte B del notebook).
    """
    columnas_categoricas = ["momento_cod", "medicacion_cod", "genero_masculino"] + \
        [c for c in COLUMNAS_BINARIAS_COMORBILIDAD if c in X.columns]
    columnas_banderas_faltante = [c for c in X.columns if c.endswith("_faltante")]
    columnas_categoricas = columnas_categoricas + columnas_banderas_faltante
    return [X.columns.get_loc(c) for c in columnas_categoricas if c in X.columns]


def construir_pipeline(X_train: pd.DataFrame, y_train: pd.Series, usar_smote: bool = True) -> ImbPipeline:
    """
    Arma el pipeline SMOTE-NC -> preprocesamiento -> Regresion Logistica.

    `usar_smote=False` (modelo de demo, ADR-0009) deja el paso `smote` en
    "passthrough": con ~15 % de prevalencia y ~300 positivos no hace falta, y
    medido en el dataset sintetico empeora el AUC e infla las probabilidades.
    El modelo real mantiene `usar_smote=True`.

    Por que un Pipeline de imblearn (y no pasos manuales): el paso de SMOTENC
    solo se ejecuta dentro de `.fit()`, nunca en `.predict()` -- asi que el
    mismo objeto sirve para entrenar y, ya cargado desde el .pkl en
    produccion, para predecir sobre un paciente nuevo sin ningun riesgo de
    generarle datos sinteticos por error.
    """
    positivos_train = int(y_train.sum())
    if usar_smote:
        indices_categoricas = _construir_indices_categoricas(X_train)
        if positivos_train < 2:
            raise ValueError(
                f"Muy pocos positivos en train ({positivos_train}) para aplicar SMOTE-NC. "
                "Prueba otro random_state en el split."
            )
        k_neighbors = max(1, min(5, positivos_train - 1))
        paso_smote = SMOTENC(categorical_features=indices_categoricas, random_state=RANDOM_STATE, k_neighbors=k_neighbors)
    else:
        paso_smote = "passthrough"

    columnas_numericas_presentes = [c for c in COLUMNAS_NUMERICAS_MODELO if c in X_train.columns]

    preprocesador = ColumnTransformer(
        transformers=[
            ("escalado", StandardScaler(), columnas_numericas_presentes),
            ("onehot", OneHotEncoder(handle_unknown="ignore"), ["momento_cod", "medicacion_cod"]),
        ],
        remainder="passthrough",
    )

    pipeline = ImbPipeline(steps=[
        ("smote", paso_smote),
        ("preprocesamiento", preprocesador),
        ("modelo", LogisticRegression(max_iter=1000, random_state=RANDOM_STATE)),
    ])
    return pipeline


def guardar_artefactos(
    pipeline,
    columnas_features,
    medianas_imputacion,
    metricas: dict,
    conteos: dict,
    artefactos_dir: str,
    ruta_dataset: Optional[str] = None,
    modo: str = MODO_REAL,
    version_modelo: str = VERSION_MODELO,
    extra: Optional[dict] = None,
) -> dict:
    """
    Escribe el .pkl y, junto a el, el JSON de metadatos con la huella SHA-256
    del .pkl recien escrito (ML-D7). Devuelve los metadatos.

    El .pkl guarda el pipeline Y todo lo que predict.py necesita para
    reconstruir el mismo preprocesamiento con UN solo paciente (columnas
    esperadas y medianas de imputacion). Guardar esto junto con el modelo evita
    que entrenamiento y prediccion se desincronicen si alguno de los dos
    cambia por separado.
    """
    modelo = ruta_modelo(artefactos_dir, modo)
    os.makedirs(os.path.dirname(modelo), exist_ok=True)
    bundle = {
        "pipeline": pipeline,
        "columnas_features": columnas_features,
        "medianas_imputacion": medianas_imputacion,
        "version": version_modelo,
    }
    joblib.dump(bundle, modelo)

    metadatos = {
        "version_modelo": version_modelo,
        "fecha_entrenamiento": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sha256_pkl": sha256_archivo(modelo),
        "versiones": versiones_instaladas(),
        "metricas": metricas,
        "random_state": RANDOM_STATE,
        "dataset": {
            "archivo": os.path.basename(ruta_dataset) if ruta_dataset else None,
            "sha256": sha256_archivo(ruta_dataset) if ruta_dataset else None,
        },
        "conteos": conteos,
    }
    if extra:
        metadatos.update(extra)
    escribir_metadatos(metadatos, artefactos_dir, modo)
    return metadatos


def cargar_dataset_entrenamiento(origen: str = "real", ruta_dataset: Optional[str] = None) -> dict:
    """
    Dataset listo para entrenar segun el origen, con el MISMO `preparar_features`:
    - "real": el Excel ShanghaiT2DM (limpieza + expansion a nivel de lectura).
    - "sintetico": el CSV del generador (ADR-0009), adaptado a las columnas que
      espera `preparar_features`. NO lee nunca los datos reales.
    Devuelve un dict con X, y, grupos, columnas_features, medianas_imputacion,
    ruta_dataset y `meta_sintetico` (None para el real).
    """
    if origen == "real":
        df_crudo = cargar_summary_crudo()
        df_limpio = limpiar_datos_clinicos(df_crudo)
        X, y, grupos, columnas_features, medianas = preparar_features(df_limpio, expandir_lecturas=True)
        return {"X": X, "y": y, "grupos": grupos, "columnas_features": columnas_features,
                "medianas_imputacion": medianas, "ruta_dataset": RAW_DATA_PATH, "meta_sintetico": None}
    if origen == "sintetico":
        ruta = ruta_dataset or RUTA_DATASET_SINTETICO
        sintetico = adaptador.cargar_dataset_sintetico(ruta)
        X, y, grupos, columnas_features, medianas = preparar_features(
            adaptador.adaptar_para_entrenamiento(sintetico["dataframe"]), expandir_lecturas=False
        )
        return {"X": X, "y": y, "grupos": grupos, "columnas_features": columnas_features,
                "medianas_imputacion": medianas, "ruta_dataset": ruta, "meta_sintetico": sintetico["metadatos"],
                "dataframe_sintetico": sintetico["dataframe"]}
    raise ValueError("origen desconocido")


def entrenar_y_evaluar(artefactos_dir: Optional[str] = None, origen: str = "real", ruta_dataset: Optional[str] = None):
    if origen not in ORIGENES:
        raise ValueError("origen desconocido")
    demo = origen == "sintetico"
    modo = MODO_DEMO if demo else MODO_REAL
    artefactos_dir = artefactos_dir or load_settings().artefactos_dir

    # --- Parte A + B: dataset listo para entrenar ---
    datos = cargar_dataset_entrenamiento(origen, ruta_dataset)
    X, y, grupos = datos["X"], datos["y"], datos["grupos"]
    columnas_features, medianas_imputacion = datos["columnas_features"], datos["medianas_imputacion"]

    etiqueta = "SINTETICO (no es desempeno clinico)" if demo else "real"
    print(f"Dataset {etiqueta} listo: {X.shape[0]} filas, {X.shape[1]} features | Positivos: {y.sum()} ({y.mean()*100:.1f}%)")

    # --- Split agrupado por paciente (sin fuga de datos) ---
    gss = GroupShuffleSplit(n_splits=1, test_size=TEST_SIZE, random_state=RANDOM_STATE)
    train_idx, test_idx = next(gss.split(X, y, groups=grupos))
    X_train, X_test = X.iloc[train_idx].reset_index(drop=True), X.iloc[test_idx].reset_index(drop=True)
    y_train, y_test = y.iloc[train_idx].reset_index(drop=True), y.iloc[test_idx].reset_index(drop=True)

    pacientes_train = set(grupos.iloc[train_idx])
    pacientes_test = set(grupos.iloc[test_idx])
    assert len(pacientes_train & pacientes_test) == 0, "Fuga de datos: pacientes repetidos entre train y test"

    print(f"Train: {X_train.shape[0]} filas ({y_train.sum()} positivos) | Test: {X_test.shape[0]} filas ({y_test.sum()} positivos)")

    # --- Entrenamiento (el modelo de demo no usa SMOTE-NC) ---
    pipeline = construir_pipeline(X_train, y_train, usar_smote=not demo)
    pipeline.fit(X_train, y_train)

    # --- Evaluacion sobre test (real, o sintetico si es el modelo de demo) ---
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    auc = roc_auc_score(y_test, y_proba)
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average="binary", zero_division=0)
    matriz = confusion_matrix(y_test, y_pred).tolist()

    metricas = {
        "modelo": "regresion_logistica_demo_sintetico" if demo else "regresion_logistica_baseline",
        "auc_roc": round(float(auc), 4),
        "precision_hipo": round(float(precision), 4),
        "recall_hipo": round(float(recall), 4),
        "f1_hipo": round(float(f1), 4),
        "matriz_confusion": {
            "orden": ["real_no", "real_hipo"],
            "valores": matriz,
        },
        "n_train": int(X_train.shape[0]),
        "n_test": int(X_test.shape[0]),
        "positivos_test": int(y_test.sum()),
        "random_state": RANDOM_STATE,
    }
    if demo:
        metricas["rotulo"] = "validacion sintetica, no clinica: NO es desempeno clinico"

    print("\nMetricas en test " + ("SINTETICO (NO es desempeno clinico):" if demo else "real:"))
    print(json.dumps(metricas, indent=2, ensure_ascii=False))

    # --- Persistencia: .pkl + JSON de metadatos con su huella + metricas ---
    conteos = {
        "filas": int(X.shape[0]),
        "filas_positivas": int(y.sum()),
        "pacientes": int(grupos.nunique()),
        "filas_train": int(X_train.shape[0]),
        "filas_positivas_train": int(y_train.sum()),
        "filas_test": int(X_test.shape[0]),
        "filas_positivas_test": int(y_test.sum()),
    }
    extra = None
    version = VERSION_MODELO
    if demo:
        meta = datos["meta_sintetico"]
        version = VERSION_MODELO_DEMO
        extra = {
            "entrenado_con": ENTRENADO_CON_SINTETICO,
            "version_reglas": meta["version_reglas"],
            "semilla_dataset": meta["semilla"],
            "usa_smote_nc": False,
            "advertencia": ADVERTENCIA_DEMO,
        }
    metadatos = guardar_artefactos(
        pipeline, columnas_features, medianas_imputacion, metricas, conteos, artefactos_dir,
        ruta_dataset=datos["ruta_dataset"], modo=modo, version_modelo=version, extra=extra,
    )
    print(f"\nModelo guardado en: {ruta_modelo(artefactos_dir, modo)}")
    print(f"Metadatos guardados (sha256_pkl {metadatos['sha256_pkl'][:12]}...)")

    if not demo:  # el modelo de demo no escribe baseline_metrics.json
        ruta_metricas = os.path.join(artefactos_dir, os.path.basename(METRICAS_PATH))
        with open(ruta_metricas, "w", encoding="utf-8") as f:
            json.dump(metricas, f, indent=2, ensure_ascii=False)
        print(f"Metricas guardadas en: {ruta_metricas}")

    return pipeline, metricas


if __name__ == "__main__":
    entrenar_y_evaluar()
