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

import logging
from functools import lru_cache
from typing import Optional

import joblib
import pandas as pd

from app.config import load_settings
from app.data_prep import preparar_features
from app.errors import ModeloNoDisponible
from app.metadatos import ruta_modelo, verificar_artefacto

logger = logging.getLogger(__name__)

# Traduce las claves "amigables" que recibe la API (ver PacienteRiesgoInput en
# el endpoint) a los nombres de columna crudos que espera `preparar_features`
# -- son los mismos nombres de columna del dataset ShanghaiT2DM, para no
# tener que mantener dos convenciones de nombres en paralelo.
MAPEO_CAMPOS_ENTRADA = {
    "edad": "Age (years)",
    "bmi": "BMI (kg/m2)",
    "duracion_diabetes": "Duration of diabetes (years)",
}

COLUMNA_HBA1C = "HbA1c (%)"


@lru_cache(maxsize=4)
def _cargar_bundle(artefactos_dir: str, modo: str = "real"):
    """
    Verifica y carga el pipeline entrenado + metadata una sola vez por proceso.
    `lru_cache` evita releer el .pkl del disco en cada request -- FastAPI
    puede recibir muchas peticiones por segundo y joblib.load no es gratis.

    Antes de deserializar se comprueba (metadatos.verificar_artefacto) que la
    huella SHA-256 del .pkl y las versiones de las librerias coinciden con las
    del JSON de metadatos del entrenamiento (RT-06). Una excepcion no se
    cachea: si el artefacto aparece o se corrige, la siguiente llamada lo
    vuelve a verificar. Los errores son ModeloNoDisponible, de mensaje
    generico: sin rutas ni detalles internos (NFR-001).

    `modo` ("real" | "demo", ADR-0009) decide de que carpeta se carga y que
    metadatos se exigen: con "real" nunca se carga el modelo de demo y con
    "demo" nunca se carga el real.
    """
    try:
        metadatos = verificar_artefacto(artefactos_dir, modo)
    except ModeloNoDisponible as exc:
        logger.warning("Modelo no disponible (motivo: %s).", exc.motivo)
        raise
    try:
        bundle = joblib.load(ruta_modelo(artefactos_dir, modo))
    except Exception:
        logger.warning("Modelo no disponible (motivo: artefacto_ilegible).")
        raise ModeloNoDisponible("artefacto_ilegible") from None
    return {**bundle, "metadatos": metadatos}


def _directorio(artefactos_dir: Optional[str]) -> str:
    return artefactos_dir if artefactos_dir is not None else load_settings().artefactos_dir


def _modo(modo: Optional[str]) -> str:
    """Modelo a servir: el pedido o, si no, ML_MODELO (por defecto real). Un valor invalido es ConfiguracionInvalida."""
    return modo if modo is not None else load_settings().modelo


def modelo_cargado(artefactos_dir: Optional[str] = None, modo: Optional[str] = None) -> bool:
    """True si el artefacto existe, esta verificado y se pudo cargar (para /health)."""
    try:
        _cargar_bundle(_directorio(artefactos_dir), _modo(modo))
    except ModeloNoDisponible:
        return False
    return True


def version_modelo(artefactos_dir: Optional[str] = None, modo: Optional[str] = None) -> str:
    """Version del modelo segun el JSON de metadatos verificado."""
    return _cargar_bundle(_directorio(artefactos_dir), _modo(modo))["metadatos"]["version_modelo"]


def _construir_dataframe_paciente(datos_paciente: dict) -> pd.DataFrame:
    """Convierte el dict de entrada (una persona) en un DataFrame de una fila
    con los nombres de columna crudos que espera `preparar_features`."""
    fila = {}

    for campo_amigable, columna_cruda in MAPEO_CAMPOS_ENTRADA.items():
        if campo_amigable in datos_paciente:
            fila[columna_cruda] = datos_paciente[campo_amigable]

    # HbA1c es opcional: si no viene, o viene en None, la columna se crea igual
    # con NaN para que `preparar_features` la trate como faltante (bandera de
    # faltante + mediana guardada). Sin la columna, `reindex(fill_value=0)` la
    # rellenaria con 0 y sin bandera, como si fuera un valor real.
    hba1c = datos_paciente.get("hba1c")
    fila[COLUMNA_HBA1C] = float("nan") if hba1c is None else float(hba1c)

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


def predecir_con_version(datos_paciente: dict, artefactos_dir: Optional[str] = None, modo: Optional[str] = None) -> tuple:
    """(probabilidad, version_modelo): la version sale del JSON de metadatos verificado."""
    riesgo = predecir_riesgo(datos_paciente, artefactos_dir, modo)
    return riesgo, version_modelo(artefactos_dir, modo)


def predecir_riesgo(datos_paciente: dict, artefactos_dir: Optional[str] = None, modo: Optional[str] = None) -> float:
    """
    Calcula la probabilidad de riesgo de hipoglucemia para UN paciente.

    Args:
        datos_paciente: dict con las claves amigables del contrato de la API
            (contrato en design.md § Servicio de ML):
            glucosa, momento, genero, edad, bmi, duracion_diabetes,
            categoria_medicacion, com_hipertension, com_dislipidemia,
            com_renal, com_neuropatia, com_nefropatia, com_cardiovascular,
            hba1c (opcional).

    Returns:
        float en [0, 1]: probabilidad de la clase positiva (hipoglucemia).

    Raises:
        ModeloNoDisponible: el artefacto falta, esta alterado o no coincide
            con las versiones del entrenamiento (mensaje generico).

    Nada de `datos_paciente` se escribe en logs ni en excepciones propias.
    """
    bundle = _cargar_bundle(_directorio(artefactos_dir), _modo(modo))
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
