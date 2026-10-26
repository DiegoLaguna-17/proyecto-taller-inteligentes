"""
Datos y modelo SINTETICOS para las pruebas: ningun valor es de un paciente
real y no se necesita el Excel ni la red. Los ids empiezan por "sintetico"
para poder comprobar que no se filtran a ningun reporte.
"""
import numpy as np
import pandas as pd

from app.data_prep import preparar_features
from app.train_baseline import construir_pipeline, guardar_artefactos

N_PACIENTES = 30
N_POSITIVOS_SINTETICOS = 10

# Perfil de ejemplo con valores reconocibles (para comprobar que no aparecen en logs).
PERFIL = {
    "glucosa": 123.456,
    "momento": "ayunas",
    "genero": "femenino",
    "edad": 61,
    "bmi": 27.3141,
    "duracion_diabetes": 11.7,
    "categoria_medicacion": "insulina",
    "com_hipertension": True,
    "com_dislipidemia": False,
    "com_renal": False,
    "com_neuropatia": True,
    "com_nefropatia": False,
    "com_cardiovascular": False,
    "hba1c": 7.7777,
}


def dataframe_sintetico(semilla=0) -> pd.DataFrame:
    """
    Mismas columnas que deja `limpiar_datos_clinicos`, con valores inventados.
    Algunos pacientes tienen 2 registros, para que haya varias filas por
    paciente como en el dataset real.
    """
    rng = np.random.default_rng(semilla)
    medicaciones = ["insulina", "ninguno", "sulfonilurea", "metformina_u_otros"]
    filas = []
    for i in range(N_PACIENTES):
        positivo = i < N_POSITIVOS_SINTETICOS
        for registro in range(2 if i % 4 == 0 else 1):
            filas.append({
                "Patient Number": f"sintetico{i:03d}_{registro}",
                "riesgo_hipoglucemia_paciente": "yes" if positivo else "no",
                "Gender (Female=1, Male=2)": 1 + i % 2,
                "Fasting Plasma Glucose (mg/dl)": rng.normal(95 if positivo else 140, 15),
                "2-hour Postprandial Plasma Glucose (mg/dl)": rng.normal(160 if positivo else 210, 20),
                "Age (years)": rng.integers(40, 80),
                "BMI (kg/m2)": rng.normal(25, 3),
                "Duration of diabetes (years)": rng.integers(1, 20),
                "HbA1c (%)": np.nan if i % 5 == 0 else rng.normal(8, 1),
                "categoria_medicacion": medicaciones[i % 4],
                "com_hipertension": bool(i % 2),
                "com_dislipidemia": bool(i % 3 == 0),
                "com_renal": False,
                "com_neuropatia": bool(i % 4 == 0),
                "com_nefropatia": False,
                "com_cardiovascular": bool(i % 5 == 0),
            })
    return pd.DataFrame(filas)


def preparado_sintetico(semilla=0):
    """(X, y, grupos, columnas_features, medianas_imputacion) del dataset sintetico."""
    return preparar_features(dataframe_sintetico(semilla), expandir_lecturas=True)


def dataset_sintetico(semilla=0):
    X, y, grupos, _, _ = preparado_sintetico(semilla)
    return X, y, grupos


def entrenar_modelo_sintetico(artefactos_dir: str) -> dict:
    """Entrena la tuberia real sobre datos sinteticos y escribe .pkl + JSON en `artefactos_dir`."""
    X, y, grupos, columnas, medianas = preparado_sintetico()
    pipeline = construir_pipeline(X, y)
    pipeline.fit(X, y)
    conteos = {
        "filas": int(len(y)), "filas_positivas": int(y.sum()), "pacientes": int(grupos.nunique()),
        "filas_train": int(len(y)), "filas_positivas_train": int(y.sum()),
        "filas_test": 0, "filas_positivas_test": 0,
    }
    return guardar_artefactos(pipeline, columnas, medianas, {"auc_roc": 0.5}, conteos, artefactos_dir)
