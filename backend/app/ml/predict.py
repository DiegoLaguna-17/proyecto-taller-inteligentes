"""
Inferencia en produccion del modelo de riesgo de hipoglucemia.

Reutiliza `preparar_features` de `data_prep.py` (la MISMA funcion que se usa
en entrenamiento) para construir los features de un paciente nuevo -- esto es
deliberado: si la logica de codificacion/imputacion viviera duplicada aca,
cualquier cambio futuro en `data_prep.py` podria desalinear entrenamiento y
produccion sin que nadie lo note. La unica diferencia en produccion es que
las medianas de imputacion (HbA1c) NO se calculan de nuevo -- no tendria
sentido calcular una mediana de un solo paciente -- sino que se reutilizan
las que quedaron guardadas en el `.pkl` desde el momento del entrenamiento.
"""

import os
from functools import lru_cache

import joblib
import pandas as pd

from app.ml.data_prep import preparar_features

ML_DIR = os.path.dirname(os.path.abspath(__file__))
MODELO_PATH = os.path.join(ML_DIR, "modelo_hipoglucemia.pkl")

# Traduce las claves "amigables" que recibe la API (ver PacienteRiesgoInput en
# el endpoint) a los nombres de columna crudos que espera `preparar_features`
# -- son los mismos nombres de columna del dataset ShanghaiT2DM, para no
# tener que mantener dos convenciones de nombres en paralelo.
MAPEO_CAMPOS_ENTRADA = {
    "edad": "Age (years)",
    "bmi": "BMI (kg/m2)",
    "duracion_diabetes": "Duration of diabetes (years)",
    "hba1c": "HbA1c (%)",
}


@lru_cache(maxsize=1)
def _cargar_bundle():
    """
    Carga el pipeline entrenado + metadata una sola vez por proceso.
    `lru_cache` evita releer el .pkl del disco en cada request -- FastAPI
    puede recibir muchas peticiones por segundo y joblib.load no es gratis.
    """
    if not os.path.exists(MODELO_PATH):
        raise FileNotFoundError(
            f"No se encontro el modelo entrenado en {MODELO_PATH}. "
            "Corre primero: python -m app.ml.train_baseline"
        )
    return joblib.load(MODELO_PATH)


def _construir_dataframe_paciente(datos_paciente: dict) -> pd.DataFrame:
    """Convierte el dict de entrada (una persona) en un DataFrame de una fila
    con los nombres de columna crudos que espera `preparar_features`."""
    fila = {}

    for campo_amigable, columna_cruda in MAPEO_CAMPOS_ENTRADA.items():
        if campo_amigable in datos_paciente:
            fila[columna_cruda] = datos_paciente[campo_amigable]

    # Genero: la API recibe "femenino"/"masculino"; el dataset original usa
    # la convencion Female=1, Male=2 -- se traduce aqui para no filtrar esa
    # convencion (poco intuitiva) hasta el contrato publico de la API.
    genero = datos_paciente.get("genero")
    if genero is not None:
        fila["Gender (Female=1, Male=2)"] = 2 if str(genero).strip().lower() == "masculino" else 1

    # Campos que ya usan el mismo nombre en la API y en el dataset interno
    for campo_directo in ["glucosa", "momento", "categoria_medicacion",
                           "com_hipertension", "com_dislipidemia", "com_renal",
                           "com_neuropatia", "com_nefropatia", "com_cardiovascular"]:
        if campo_directo in datos_paciente:
            fila[campo_directo] = datos_paciente[campo_directo]

    return pd.DataFrame([fila])


def predecir_riesgo(datos_paciente: dict) -> float:
    """
    Calcula la probabilidad de riesgo de hipoglucemia para UN paciente.

    Args:
        datos_paciente: dict con las claves amigables del contrato de la API
            (ver `PacienteRiesgoInput` en app/api/endpoints/riesgo.py):
            glucosa, momento, genero, edad, bmi, duracion_diabetes,
            categoria_medicacion, com_hipertension, com_dislipidemia,
            com_renal, com_neuropatia, com_nefropatia, com_cardiovascular,
            hba1c (opcional).

    Returns:
        float en [0, 1]: probabilidad de la clase positiva (hipoglucemia).
    """
    bundle = _cargar_bundle()
    pipeline = bundle["pipeline"]
    columnas_features = bundle["columnas_features"]
    medianas_imputacion = bundle["medianas_imputacion"]

    df_paciente = _construir_dataframe_paciente(datos_paciente)

    # Misma funcion que en entrenamiento (Parte B) -- sin expandir a nivel de
    # lectura (ya es una sola lectura) y reutilizando las medianas guardadas
    # en vez de recalcularlas sobre un dataframe de una sola fila.
    X, _, _, _, _ = preparar_features(
        df_paciente,
        expandir_lecturas=False,
        medianas_imputacion=medianas_imputacion,
    )

    # Alinear columnas exactamente como las vio el pipeline al entrenar --
    # mismo orden, y si faltara alguna (ej. una bandera de faltante que en
    # este paciente no aplica), se completa en 0 en vez de romper la
    # prediccion.
    X = X.reindex(columns=columnas_features, fill_value=0)

    probabilidad = pipeline.predict_proba(X)[:, 1]
    return float(probabilidad[0])
