"""
Reglas clinicas del generador de datos sinteticos (modelo de DEMO).

ADVERTENCIA DE HONESTIDAD: estas reglas las escribio el equipo; el modelo de
demo aprende ESTAS reglas, no la realidad. Sus probabilidades y metricas no son
evidencia clinica. Todas las reglas y sus magnitudes estan pendientes de
revision por el equipo. Fuente de verdad: docs/ml/generador_sintetico.md §7.

La probabilidad de la etiqueta es
    P = sigmoide(ESCALA_SENAL * S + b0)
con S la suma de los terminos de `suma_log_odds` (en log-odds) y b0 un
intercepto que calibra el generador para lograr la prevalencia objetivo.

Este modulo no importa nada de backend/app, nlp_service ni data_prep.py, y no
lee los datos reales.
"""
import numpy as np
import pandas as pd

VERSION_REGLAS = "1.0.0-reglas"

# Ajuste global de la senal moderada (decision de la Fase S1).
ESCALA_SENAL = 0.8
PREVALENCIA_OBJETIVO = 0.15

# Terminos en log-odds, ANTES de aplicar ESCALA_SENAL. Magnitudes: supuestos del equipo.
COEFICIENTES = {
    # R1-R3: medicacion (ninguno es la referencia, 0)
    "insulina": 1.2,
    "sulfonilurea": 0.9,
    "metformina_u_otros": 0.15,
    # R4: glucosa continua: -1.8 * ln(glucosa / 130), glucosa recortada a 45-300
    "glucosa_pendiente": -1.8,
    "glucosa_centro_mg_dl": 130.0,
    "glucosa_min_mg_dl": 45.0,
    "glucosa_max_mg_dl": 300.0,
    # R5: momento ayunas
    "ayunas": 0.3,
    # R6: duracion: 0.05 * (min(duracion, 25) - 8)
    "duracion_pendiente": 0.05,
    "duracion_centro_anios": 8.0,
    "duracion_max_anios": 25.0,
    # R7: edad: 0.03 * (clip(edad, 40, 90) - 60)
    "edad_pendiente": 0.03,
    "edad_centro_anios": 60.0,
    "edad_min": 40.0,
    "edad_max": 90.0,
    # R8: HbA1c baja (interaccion 1): solo si HbA1c observada
    "hba1c_menor_7_con_riesgo": 0.7,    # insulina o sulfonilurea
    "hba1c_menor_7_sin_riesgo": 0.1,
    "hba1c_7_a_8_con_riesgo": 0.3,      # insulina o sulfonilurea
    # R9: HbA1c alta
    "hba1c_mayor_9": -0.4,
    # R10: IMC bajo
    "bmi_menor_20": 0.4,
    # R11-R12: funcion renal
    "com_renal": 0.6,
    "com_nefropatia": 0.3,
    # R13: edad >= 75 con insulina (interaccion 2)
    "edad_75_con_insulina": 0.4,
}

# Variables que se generan pero NO influyen en la etiqueta (controles y reglas descartadas).
VARIABLES_SIN_EFECTO = (
    "genero",
    "com_hipertension",
    "com_dislipidemia",
    "com_neuropatia",
    "com_cardiovascular",
)

COLUMNAS_USADAS = (
    "categoria_medicacion", "glucosa", "momento", "duracion_diabetes", "edad",
    "hba1c", "bmi", "com_renal", "com_nefropatia",
)


def suma_log_odds(df: pd.DataFrame) -> np.ndarray:
    """
    Suma S de los terminos de las reglas R1-R13 (en log-odds, sin escala ni
    intercepto) para cada fila de `df`. Solo lee las columnas de COLUMNAS_USADAS:
    el resto de las variables (VARIABLES_SIN_EFECTO) no puede influir.
    HbA1c ausente (NaN) aporta 0.
    """
    c = COEFICIENTES
    medicacion = df["categoria_medicacion"].to_numpy()
    glucosa = df["glucosa"].to_numpy(dtype=float)
    ayunas = (df["momento"].to_numpy() == "ayunas")
    duracion = df["duracion_diabetes"].to_numpy(dtype=float)
    edad = df["edad"].to_numpy(dtype=float)
    hba1c = df["hba1c"].to_numpy(dtype=float)
    bmi = df["bmi"].to_numpy(dtype=float)
    renal = df["com_renal"].to_numpy(dtype=bool)
    nefropatia = df["com_nefropatia"].to_numpy(dtype=bool)

    insulina = medicacion == "insulina"
    riesgo = insulina | (medicacion == "sulfonilurea")  # insulina o sulfonilurea
    observada = ~np.isnan(hba1c)
    h = np.where(observada, hba1c, np.nan)

    s = np.zeros(len(df))
    s += np.select(
        [insulina, medicacion == "sulfonilurea", medicacion == "metformina_u_otros"],
        [c["insulina"], c["sulfonilurea"], c["metformina_u_otros"]],
        0.0,
    )
    g = np.clip(glucosa, c["glucosa_min_mg_dl"], c["glucosa_max_mg_dl"])
    s += c["glucosa_pendiente"] * np.log(g / c["glucosa_centro_mg_dl"])
    s += np.where(ayunas, c["ayunas"], 0.0)
    s += c["duracion_pendiente"] * (np.minimum(duracion, c["duracion_max_anios"]) - c["duracion_centro_anios"])
    s += c["edad_pendiente"] * (np.clip(edad, c["edad_min"], c["edad_max"]) - c["edad_centro_anios"])

    # NaN en las comparaciones da False, asi que HbA1c ausente no aporta nada.
    with np.errstate(invalid="ignore"):
        menor_7 = observada & (h < 7.0)
        entre_7_y_8 = observada & (h >= 7.0) & (h < 8.0)
        mayor_9 = observada & (h > 9.0)
    s += np.where(menor_7, np.where(riesgo, c["hba1c_menor_7_con_riesgo"], c["hba1c_menor_7_sin_riesgo"]), 0.0)
    s += np.where(entre_7_y_8 & riesgo, c["hba1c_7_a_8_con_riesgo"], 0.0)
    s += np.where(mayor_9, c["hba1c_mayor_9"], 0.0)
    s += np.where(bmi < 20.0, c["bmi_menor_20"], 0.0)
    s += np.where(renal, c["com_renal"], 0.0)
    s += np.where(nefropatia, c["com_nefropatia"], 0.0)
    s += np.where((edad >= 75.0) & insulina, c["edad_75_con_insulina"], 0.0)
    return s
