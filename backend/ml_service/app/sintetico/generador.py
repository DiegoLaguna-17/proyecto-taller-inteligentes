"""
Generador de datos SINTETICOS para el modelo de DEMO (Fase S2, TASK-011f).

ADVERTENCIA DE HONESTIDAD: el dataset se genera desde reglas clinicas escritas
por el equipo (app/sintetico/reglas.py), NO desde un modelo estadistico ajustado
a los 109 registros reales. El modelo de demo aprende esas reglas, no la
realidad: nada de lo que produzca es evidencia clinica. Especificacion:
docs/ml/generador_sintetico.md. Diseno: design.md § Modelo de demo.

Garantias:
- Determinista: la misma semilla produce el mismo dataset (una sola corriente
  de aleatoriedad, en orden fijo).
- Un registro por lectura; pacientes con 1 a 3 registros que comparten perfil.
- No lee ni importa nada de los datos reales (data/raw/, data_prep.py), ni de
  backend/app ni de nlp_service. Los ids llevan el prefijo "sint-".
- Todas las filas llevan origen = "sintetico".
"""
import hashlib
import json
import os
import platform
from dataclasses import dataclass
from datetime import datetime, timezone
from importlib import metadata
from typing import Optional

import numpy as np
import pandas as pd
from scipy.special import expit
from scipy.stats import gamma, norm, rankdata

from app.sintetico.reglas import (
    ESCALA_SENAL,
    PREVALENCIA_OBJETIVO,
    VERSION_REGLAS,
    suma_log_odds,
)

ORIGEN = "sintetico"
VERSION_ESQUEMA = "1.0"
SEMILLA_POR_DEFECTO = 20261024
N_POR_DEFECTO = 2000

ADVERTENCIA = (
    "Dataset sintetico generado a partir de reglas clinicas del equipo (pendientes de revision). "
    "No contiene pacientes reales. No es evidencia clinica."
)

# Distribuciones (docs/ml/generador_sintetico.md §5 y §6).
REGISTROS_POR_PACIENTE = (1, 2, 3)
PROB_REGISTROS_POR_PACIENTE = (0.90, 0.08, 0.02)
PROB_FEMENINO = 0.46
PROB_HBA1C_AUSENTE = 0.10
PROB_AYUNAS = 0.5
CORR_EDAD_DURACION = 0.4
CORR_EDAD_BMI = -0.3
# Medicacion segun banda de duracion: columnas = ninguno, metformina_u_otros, sulfonilurea, insulina.
CATEGORIAS_MEDICACION = ("ninguno", "metformina_u_otros", "sulfonilurea", "insulina")
MEDICACION_POR_BANDA = np.array([
    [0.22, 0.55, 0.08, 0.15],   # duracion < 3 anios
    [0.05, 0.44, 0.13, 0.38],   # 3 a 10 anios
    [0.02, 0.28, 0.12, 0.58],   # > 10 anios
])

COLUMNAS = [
    "id_paciente_sintetico", "id_registro_sintetico", "origen",
    "genero", "edad", "bmi", "duracion_diabetes", "categoria_medicacion",
    "com_hipertension", "com_dislipidemia", "com_renal", "com_neuropatia", "com_nefropatia", "com_cardiovascular",
    "hba1c", "glucosa", "momento", "hipoglucemia_registro",
]

LIBRERIAS = ("numpy", "pandas", "scipy")


@dataclass
class ResultadoGeneracion:
    dataframe: pd.DataFrame
    probabilidad: np.ndarray  # probabilidad verdadera de las reglas; NO es una columna del dataset
    intercepto: float
    escala_senal: float
    prevalencia_objetivo: float
    semilla: int
    n_pacientes: int


def auc_roc(y: np.ndarray, puntaje: np.ndarray) -> float:
    """AUC por rangos (Mann-Whitney), sin depender de scikit-learn."""
    y = np.asarray(y).astype(bool)
    positivos = int(y.sum())
    negativos = len(y) - positivos
    if positivos == 0 or negativos == 0:
        raise ValueError("El AUC no esta definido sin positivos o sin negativos.")
    rangos = rankdata(puntaje)
    return float((rangos[y].sum() - positivos * (positivos + 1) / 2) / (positivos * negativos))


def _perfiles(rng: np.random.Generator, m: int) -> dict:
    """Perfil de `m` pacientes (se comparte entre sus registros)."""
    z = rng.standard_normal((m, 3))
    edad = np.round(np.clip(60 + 13 * z[:, 0], 25, 90)).astype(int)

    # Duracion: copula gaussiana con la edad, marginal gamma, limitada por la edad.
    z_dur = CORR_EDAD_DURACION * z[:, 0] + np.sqrt(1 - CORR_EDAD_DURACION ** 2) * z[:, 1]
    duracion = gamma.ppf(norm.cdf(z_dur), a=1.4, scale=6.0)
    duracion = np.round(np.clip(np.minimum(duracion, edad - 18), 0, 40), 1)

    bmi = 24.5 + 3.5 * (CORR_EDAD_BMI * z[:, 0] + np.sqrt(1 - CORR_EDAD_BMI ** 2) * z[:, 2])
    bmi = np.round(np.clip(bmi, 17, 38), 1)

    banda = np.where(duracion < 3, 0, np.where(duracion <= 10, 1, 2))
    acumulada = np.cumsum(MEDICACION_POR_BANDA[banda], axis=1)
    indice = np.minimum((rng.random(m)[:, None] > acumulada).sum(axis=1), 3)
    medicacion = np.array(CATEGORIAS_MEDICACION)[indice]

    hba1c = np.round(np.clip(rng.normal(8.3, 1.9, m), 5.0, 14.0), 1)
    hba1c_ausente = rng.random(m) < PROB_HBA1C_AUSENTE

    genero = np.where(rng.random(m) < PROB_FEMENINO, "femenino", "masculino")

    renal = rng.random(m) < expit(-2.4 + 0.03 * (edad - 60) + 0.04 * (duracion - 8))
    nefropatia = rng.random(m) < np.where(renal, 0.40, 0.03)
    hipertension = rng.random(m) < expit(-0.4 + 0.03 * (edad - 60))
    dislipidemia = rng.random(m) < expit(-1.2)
    neuropatia = rng.random(m) < expit(-1.7 + 0.06 * (duracion - 8))
    cardiovascular = rng.random(m) < expit(-0.8 + 0.04 * (edad - 60))

    return {
        "genero": genero, "edad": edad, "bmi": bmi, "duracion_diabetes": duracion,
        "categoria_medicacion": medicacion, "hba1c_latente": hba1c, "hba1c_ausente": hba1c_ausente,
        "com_hipertension": hipertension, "com_dislipidemia": dislipidemia, "com_renal": renal,
        "com_neuropatia": neuropatia, "com_nefropatia": nefropatia, "com_cardiovascular": cardiovascular,
    }


def _registros_por_paciente(rng: np.random.Generator, n: int) -> np.ndarray:
    """Registros de cada paciente, recortados para sumar exactamente `n`."""
    cantidades = rng.choice(REGISTROS_POR_PACIENTE, size=n, p=PROB_REGISTROS_POR_PACIENTE)
    acumulado = np.cumsum(cantidades)
    ultimo = int(np.searchsorted(acumulado, n))  # primer paciente que completa n registros
    cantidades = cantidades[: ultimo + 1].copy()
    cantidades[-1] = n - (acumulado[ultimo - 1] if ultimo > 0 else 0)
    return cantidades


def calibrar_intercepto(s_escalada: np.ndarray, uniformes: np.ndarray, positivos_objetivo: int) -> float:
    """
    Busca por biseccion el intercepto b0 con el que `uniformes < sigmoide(s + b0)`
    da exactamente `positivos_objetivo` positivos (el conteo crece con b0).
    """
    bajo, alto = -30.0, 30.0
    for _ in range(200):
        medio = (bajo + alto) / 2
        if int((uniformes < expit(s_escalada + medio)).sum()) >= positivos_objetivo:
            alto = medio
        else:
            bajo = medio
    return alto


def generar_dataset(
    n: int = N_POR_DEFECTO,
    semilla: int = SEMILLA_POR_DEFECTO,
    escala_senal: float = ESCALA_SENAL,
    prevalencia: float = PREVALENCIA_OBJETIVO,
) -> ResultadoGeneracion:
    if n < 50:
        raise ValueError("n debe ser al menos 50.")
    if not 0.0 < prevalencia < 1.0:
        raise ValueError("La prevalencia objetivo debe estar entre 0 y 1.")
    if escala_senal <= 0:
        raise ValueError("La escala de senal debe ser positiva.")

    rng = np.random.default_rng(semilla)
    cantidades = _registros_por_paciente(rng, n)
    m = len(cantidades)
    perfil = _perfiles(rng, m)

    por_registro = {k: np.repeat(v, cantidades) for k, v in perfil.items()}
    paciente_de_registro = np.repeat(np.arange(m), cantidades)

    ayunas = rng.random(n) < PROB_AYUNAS
    eag = 28.7 * por_registro["hba1c_latente"] - 46.7  # glucosa promedio estimada (relacion ADAG)
    glucosa_ayunas = 0.85 * eag * np.exp(rng.normal(0.0, 0.22, n))
    glucosa_postprandial = 1.5 * 0.85 * eag * np.exp(rng.normal(0.0, 0.20, n))
    glucosa = np.round(np.clip(np.where(ayunas, glucosa_ayunas, glucosa_postprandial), 40, 600), 1)
    uniformes = rng.random(n)

    hba1c = np.where(por_registro["hba1c_ausente"], np.nan, por_registro["hba1c_latente"])

    df = pd.DataFrame({
        "id_paciente_sintetico": [f"sint-{i + 1:05d}" for i in paciente_de_registro],
        "id_registro_sintetico": [f"sint-reg-{j + 1:06d}" for j in range(n)],
        "origen": ORIGEN,
        "genero": por_registro["genero"],
        "edad": por_registro["edad"],
        "bmi": por_registro["bmi"],
        "duracion_diabetes": por_registro["duracion_diabetes"],
        "categoria_medicacion": por_registro["categoria_medicacion"],
        "com_hipertension": por_registro["com_hipertension"],
        "com_dislipidemia": por_registro["com_dislipidemia"],
        "com_renal": por_registro["com_renal"],
        "com_neuropatia": por_registro["com_neuropatia"],
        "com_nefropatia": por_registro["com_nefropatia"],
        "com_cardiovascular": por_registro["com_cardiovascular"],
        "hba1c": hba1c,
        "glucosa": glucosa,
        "momento": np.where(ayunas, "ayunas", "postprandial"),
    })

    s_escalada = escala_senal * suma_log_odds(df)
    positivos_objetivo = int(round(prevalencia * n))
    intercepto = calibrar_intercepto(s_escalada, uniformes, positivos_objetivo)
    probabilidad = expit(s_escalada + intercepto)
    df["hipoglucemia_registro"] = (uniformes < probabilidad).astype(int)

    return ResultadoGeneracion(
        dataframe=df[COLUMNAS],
        probabilidad=probabilidad,
        intercepto=float(intercepto),
        escala_senal=float(escala_senal),
        prevalencia_objetivo=float(prevalencia),
        semilla=int(semilla),
        n_pacientes=int(m),
    )


def _versiones() -> dict:
    versiones = {"python": platform.python_version()}
    for libreria in LIBRERIAS:
        try:
            versiones[libreria] = metadata.version(libreria)
        except metadata.PackageNotFoundError:
            versiones[libreria] = None
    return versiones


def _sha256(ruta: str) -> str:
    huella = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1024 * 1024), b""):
            huella.update(bloque)
    return huella.hexdigest()


def construir_metadatos(resultado: ResultadoGeneracion, sha256_csv: Optional[str] = None) -> dict:
    """Metadatos del dataset: solo agregados, sin valores ni ids por registro."""
    df = resultado.dataframe
    p = resultado.probabilidad
    y = df["hipoglucemia_registro"].to_numpy()
    tasa_por_medicacion = {
        categoria: {"n": int(len(grupo)), "tasa_positivos": round(float(grupo["hipoglucemia_registro"].mean()), 4)}
        for categoria, grupo in df.groupby("categoria_medicacion")
    }
    return {
        "origen": ORIGEN,
        "advertencia": ADVERTENCIA,
        "version_esquema": VERSION_ESQUEMA,
        "version_reglas": VERSION_REGLAS,
        "semilla": resultado.semilla,
        "fecha": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "n_registros": int(len(df)),
        "n_pacientes": resultado.n_pacientes,
        "prevalencia_objetivo": resultado.prevalencia_objetivo,
        "prevalencia_obtenida": round(float(y.mean()), 4),
        "escala_senal": resultado.escala_senal,
        "intercepto": round(resultado.intercepto, 4),
        "auc_oraculo": round(auc_roc(y, p), 4),
        "percentiles_probabilidad": {
            f"p{q}": round(float(np.percentile(p, q)), 4) for q in (5, 25, 50, 75, 95, 99)
        },
        "tasa_positivos_por_medicacion": tasa_por_medicacion,
        "hba1c_ausente": round(float(df["hba1c"].isna().mean()), 4),
        "sha256_csv": sha256_csv,
        "versiones": _versiones(),
    }


def validar_ruta_de_salida(ruta_csv: str) -> None:
    """El generador nunca escribe sobre los datos reales."""
    ruta = os.path.abspath(ruta_csv)
    partes = [p.lower() for p in ruta.replace("\\", "/").split("/")]
    for a, b in zip(partes, partes[1:]):
        if a == "data" and b == "raw":
            raise ValueError("No se escribe en data/raw/: los datos sinteticos nunca se mezclan con los reales.")
    if os.path.splitext(ruta)[1].lower() in (".xlsx", ".xls", ".pkl"):
        raise ValueError("La salida del generador debe ser un CSV.")
    if os.path.splitext(ruta)[1].lower() != ".csv":
        raise ValueError("La salida del generador debe ser un archivo .csv.")


def ruta_metadatos(ruta_csv: str) -> str:
    return os.path.splitext(ruta_csv)[0] + ".json"


def escribir_dataset(resultado: ResultadoGeneracion, ruta_csv: str) -> dict:
    """Escribe el CSV y, al lado, el JSON de metadatos (con la huella del CSV). Devuelve los metadatos."""
    validar_ruta_de_salida(ruta_csv)
    carpeta = os.path.dirname(os.path.abspath(ruta_csv))
    os.makedirs(carpeta, exist_ok=True)
    resultado.dataframe.to_csv(ruta_csv, index=False, lineterminator="\n")
    metadatos = construir_metadatos(resultado, sha256_csv=_sha256(ruta_csv))
    with open(ruta_metadatos(ruta_csv), "w", encoding="utf-8") as f:
        json.dump(metadatos, f, indent=2, ensure_ascii=False)
    return metadatos
