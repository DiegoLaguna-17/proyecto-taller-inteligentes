"""
Adaptador del dataset SINTETICO a la tuberia de entrenamiento (Fase S3, ADR-0009).

Lee el CSV que escribe `generador.py`, lo valida y renombra sus columnas a las
que espera `preparar_features(..., expandir_lecturas=False)`, para que el modelo
de demo se entrene con EXACTAMENTE la misma logica de features que el real, sin
duplicarla.

ADVERTENCIA: son datos sinteticos generados desde reglas del equipo. Este
modulo no lee los datos reales (data/raw/) ni importa nada de backend/app ni de
nlp_service. Los mensajes de error no incluyen valores del dataset.
"""
import hashlib
import json
import os

import numpy as np
import pandas as pd

ORIGEN_SINTETICO = "sintetico"
PREFIJO_ID_PACIENTE = "sint-"

COLUMNAS_REQUERIDAS = (
    "id_paciente_sintetico", "id_registro_sintetico", "origen", "genero", "edad", "bmi", "duracion_diabetes",
    "categoria_medicacion", "com_hipertension", "com_dislipidemia", "com_renal", "com_neuropatia",
    "com_nefropatia", "com_cardiovascular", "hba1c", "glucosa", "momento", "hipoglucemia_registro",
)


def ruta_metadatos_dataset(ruta_csv: str) -> str:
    return os.path.splitext(ruta_csv)[0] + ".json"


def _sha256(ruta: str) -> str:
    huella = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1024 * 1024), b""):
            huella.update(bloque)
    return huella.hexdigest()


def cargar_dataset_sintetico(ruta_csv: str) -> dict:
    """
    Lee y valida el CSV sintetico y su JSON de metadatos. Rechaza (ValueError,
    sin valores del dataset) cualquier archivo que no sea sintetico: falta de
    columnas, `origen` distinto de "sintetico" en alguna fila, ids sin el
    prefijo `sint-`, metadatos ausentes o que no correspondan al CSV.
    """
    if not os.path.isfile(ruta_csv):
        raise ValueError("No existe el dataset sintetico. Generalo con: python -m app.sintetico.generar")
    ruta_meta = ruta_metadatos_dataset(ruta_csv)
    if not os.path.isfile(ruta_meta):
        raise ValueError("Falta el JSON de metadatos del dataset sintetico (debe estar junto al CSV).")
    with open(ruta_meta, encoding="utf-8") as f:
        metadatos = json.load(f)
    if metadatos.get("origen") != ORIGEN_SINTETICO:
        raise ValueError("Los metadatos del dataset no declaran origen 'sintetico'.")
    if metadatos.get("sha256_csv") != _sha256(ruta_csv):
        raise ValueError("El CSV no coincide con la huella de sus metadatos; vuelve a generarlo.")

    df = pd.read_csv(ruta_csv)
    faltantes = [c for c in COLUMNAS_REQUERIDAS if c not in df.columns]
    if faltantes:
        raise ValueError(f"Al dataset sintetico le faltan {len(faltantes)} columnas.")
    if not (df["origen"] == ORIGEN_SINTETICO).all():
        raise ValueError("El dataset contiene filas cuyo origen no es 'sintetico'.")
    if not df["id_paciente_sintetico"].astype(str).str.startswith(PREFIJO_ID_PACIENTE).all():
        raise ValueError("El dataset contiene ids de paciente sin el prefijo 'sint-'.")
    return {"dataframe": df, "metadatos": metadatos}


def adaptar_para_entrenamiento(df: pd.DataFrame) -> pd.DataFrame:
    """
    Renombra las columnas sinteticas a las que usa `preparar_features` (las
    mismas del dataset original), conservando el orden de las filas.
    """
    return pd.DataFrame({
        "id_paciente_real": df["id_paciente_sintetico"].to_numpy(),
        "riesgo_hipoglucemia_paciente": np.where(df["hipoglucemia_registro"].to_numpy() == 1, "yes", "no"),
        "Gender (Female=1, Male=2)": np.where(df["genero"].to_numpy() == "masculino", 2, 1),
        "Age (years)": df["edad"].to_numpy(),
        "BMI (kg/m2)": df["bmi"].to_numpy(),
        "Duration of diabetes (years)": df["duracion_diabetes"].to_numpy(),
        "HbA1c (%)": df["hba1c"].to_numpy(dtype=float),
        "glucosa": df["glucosa"].to_numpy(),
        "momento": df["momento"].to_numpy(),
        "categoria_medicacion": df["categoria_medicacion"].to_numpy(),
        "com_hipertension": df["com_hipertension"].to_numpy(),
        "com_dislipidemia": df["com_dislipidemia"].to_numpy(),
        "com_renal": df["com_renal"].to_numpy(),
        "com_neuropatia": df["com_neuropatia"].to_numpy(),
        "com_nefropatia": df["com_nefropatia"].to_numpy(),
        "com_cardiovascular": df["com_cardiovascular"].to_numpy(),
    })
