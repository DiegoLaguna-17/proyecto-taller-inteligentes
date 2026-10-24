"""
Metadatos del artefacto del modelo (ML-D7, RT-06).

El `.pkl` queda fuera de git; el JSON de metadatos que lo acompaña se versiona
y lleva la huella SHA-256 del `.pkl`. Aquí viven las piezas que comparten
`train_baseline.py` (que escribe el JSON) y `predict.py` (que lo verifica al
cargar): nombres de archivo, huella, versiones instaladas y la verificación.

El JSON solo contiene agregados: sin valores de glucosa ni ids de pacientes.
"""
import hashlib
import json
import os
import platform
from importlib import metadata

from app.errors import ModeloNoDisponible

NOMBRE_MODELO = "modelo_hipoglucemia.pkl"
NOMBRE_METADATOS = "modelo_hipoglucemia.json"

LIBRERIAS = ("scikit-learn", "imbalanced-learn", "numpy", "scipy", "pandas", "joblib", "openpyxl")

CAMPOS_OBLIGATORIOS = (
    "version_modelo",
    "fecha_entrenamiento",
    "sha256_pkl",
    "versiones",
    "metricas",
    "random_state",
    "dataset",
    "conteos",
)


def sha256_archivo(ruta: str) -> str:
    huella = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1024 * 1024), b""):
            huella.update(bloque)
    return huella.hexdigest()


def _python_mayor_menor(version: str) -> str:
    return ".".join(version.split(".")[:2])


def versiones_instaladas() -> dict:
    """Python (completa) y las librerías que condicionan el comportamiento del `.pkl`."""
    versiones = {"python": platform.python_version()}
    for libreria in LIBRERIAS:
        try:
            versiones[libreria] = metadata.version(libreria)
        except metadata.PackageNotFoundError:
            versiones[libreria] = None
    return versiones


def versiones_coinciden(registradas: dict, instaladas: dict) -> bool:
    """Librerías: versión exacta. Python: solo mayor.minor (el pickle depende de eso, no del parche)."""
    for nombre, version in registradas.items():
        actual = instaladas.get(nombre)
        if nombre == "python":
            if actual is None or version is None or _python_mayor_menor(actual) != _python_mayor_menor(version):
                return False
        elif actual != version:
            return False
    return True


def ruta_modelo(artefactos_dir: str) -> str:
    return os.path.join(artefactos_dir, NOMBRE_MODELO)


def ruta_metadatos(artefactos_dir: str) -> str:
    return os.path.join(artefactos_dir, NOMBRE_METADATOS)


def escribir_metadatos(metadatos: dict, artefactos_dir: str) -> str:
    ruta = ruta_metadatos(artefactos_dir)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(metadatos, f, indent=2, ensure_ascii=False)
    return ruta


def leer_metadatos(artefactos_dir: str) -> dict:
    """Lee y valida la forma del JSON. No compara huella ni versiones."""
    ruta = ruta_metadatos(artefactos_dir)
    if not os.path.isfile(ruta):
        raise ModeloNoDisponible("metadatos_ausentes")
    try:
        with open(ruta, encoding="utf-8") as f:
            metadatos = json.load(f)
    except (OSError, ValueError):
        raise ModeloNoDisponible("metadatos_invalidos") from None
    if not isinstance(metadatos, dict) or any(campo not in metadatos for campo in CAMPOS_OBLIGATORIOS):
        raise ModeloNoDisponible("metadatos_invalidos")
    if not isinstance(metadatos["versiones"], dict) or not isinstance(metadatos["sha256_pkl"], str):
        raise ModeloNoDisponible("metadatos_invalidos")
    return metadatos


def verificar_artefacto(artefactos_dir: str) -> dict:
    """
    Comprueba, antes de deserializar nada, que el `.pkl` es el que describe el
    JSON: existe, su SHA-256 coincide y las versiones instaladas coinciden con
    las del entrenamiento. Devuelve los metadatos o levanta ModeloNoDisponible
    (mensaje genérico, sin rutas).
    """
    modelo = ruta_modelo(artefactos_dir)
    if not os.path.isfile(modelo):
        raise ModeloNoDisponible("artefacto_ausente")
    metadatos = leer_metadatos(artefactos_dir)
    try:
        huella = sha256_archivo(modelo)
    except OSError:
        raise ModeloNoDisponible("artefacto_ilegible") from None
    if huella != metadatos["sha256_pkl"]:
        raise ModeloNoDisponible("huella_distinta")
    if not versiones_coinciden(metadatos["versiones"], versiones_instaladas()):
        raise ModeloNoDisponible("versiones_distintas")
    return metadatos
