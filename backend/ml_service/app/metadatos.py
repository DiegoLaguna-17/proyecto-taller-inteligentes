"""
Metadatos del artefacto del modelo (ML-D7, RT-06).

El `.pkl` queda fuera de git; el JSON de metadatos que lo acompaña se versiona
y lleva la huella SHA-256 del `.pkl`. Aqui viven las piezas que comparten
`train_baseline.py` (que escribe el JSON) y `predict.py` (que lo verifica al
cargar): nombres de archivo, huella, versiones instaladas y la verificacion.

Hay dos juegos de artefactos (ADR-0009), cada uno en su carpeta y con sus
nombres, que NUNCA se confunden:
- modo "real": `artefactos/modelo_hipoglucemia.pkl|json` (modelo real).
- modo "demo": `artefactos/demo/modelo_hipoglucemia_demo.pkl|json` (modelo de
  DEMO entrenado con datos sinteticos; sus metricas no son desempeno clinico).

El JSON solo contiene agregados: sin valores de glucosa ni ids de pacientes.
"""
import hashlib
import json
import os
import platform
from importlib import metadata

from app.errors import ModeloNoDisponible

MODO_REAL = "real"
MODO_DEMO = "demo"
MODOS = (MODO_REAL, MODO_DEMO)

NOMBRE_MODELO = "modelo_hipoglucemia.pkl"
NOMBRE_METADATOS = "modelo_hipoglucemia.json"
SUBCARPETA_DEMO = "demo"
NOMBRE_MODELO_DEMO = "modelo_hipoglucemia_demo.pkl"
NOMBRE_METADATOS_DEMO = "modelo_hipoglucemia_demo.json"
NOMBRE_CV_DEMO = "cv_metrics_demo.json"

ENTRENADO_CON_SINTETICO = "sintetico"
SUFIJO_VERSION_DEMO = "-demo"

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
# El JSON del modelo de demo exige ademas estos campos.
CAMPOS_OBLIGATORIOS_DEMO = CAMPOS_OBLIGATORIOS + ("entrenado_con", "version_reglas", "semilla_dataset", "advertencia")


def _validar_modo(modo: str) -> str:
    if modo not in MODOS:
        raise ValueError("modo desconocido")
    return modo


def directorio_modelo(artefactos_dir: str, modo: str = MODO_REAL) -> str:
    """Carpeta donde viven los artefactos del modo (`artefactos/` o `artefactos/demo/`)."""
    if _validar_modo(modo) == MODO_DEMO:
        return os.path.join(artefactos_dir, SUBCARPETA_DEMO)
    return artefactos_dir


def sha256_archivo(ruta: str) -> str:
    huella = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1024 * 1024), b""):
            huella.update(bloque)
    return huella.hexdigest()


def _python_mayor_menor(version: str) -> str:
    return ".".join(version.split(".")[:2])


def versiones_instaladas() -> dict:
    """Python (completa) y las librerias que condicionan el comportamiento del `.pkl`."""
    versiones = {"python": platform.python_version()}
    for libreria in LIBRERIAS:
        try:
            versiones[libreria] = metadata.version(libreria)
        except metadata.PackageNotFoundError:
            versiones[libreria] = None
    return versiones


def versiones_coinciden(registradas: dict, instaladas: dict) -> bool:
    """Librerias: version exacta. Python: solo mayor.minor (el pickle depende de eso, no del parche)."""
    for nombre, version in registradas.items():
        actual = instaladas.get(nombre)
        if nombre == "python":
            if actual is None or version is None or _python_mayor_menor(actual) != _python_mayor_menor(version):
                return False
        elif actual != version:
            return False
    return True


def ruta_modelo(artefactos_dir: str, modo: str = MODO_REAL) -> str:
    nombre = NOMBRE_MODELO_DEMO if _validar_modo(modo) == MODO_DEMO else NOMBRE_MODELO
    return os.path.join(directorio_modelo(artefactos_dir, modo), nombre)


def ruta_metadatos(artefactos_dir: str, modo: str = MODO_REAL) -> str:
    nombre = NOMBRE_METADATOS_DEMO if _validar_modo(modo) == MODO_DEMO else NOMBRE_METADATOS
    return os.path.join(directorio_modelo(artefactos_dir, modo), nombre)


def escribir_metadatos(metadatos: dict, artefactos_dir: str, modo: str = MODO_REAL) -> str:
    ruta = ruta_metadatos(artefactos_dir, modo)
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(metadatos, f, indent=2, ensure_ascii=False)
    return ruta


def leer_metadatos(artefactos_dir: str, modo: str = MODO_REAL) -> dict:
    """Lee y valida la forma del JSON. No compara huella ni versiones."""
    ruta = ruta_metadatos(artefactos_dir, modo)
    if not os.path.isfile(ruta):
        raise ModeloNoDisponible("metadatos_ausentes")
    try:
        with open(ruta, encoding="utf-8") as f:
            metadatos = json.load(f)
    except (OSError, ValueError):
        raise ModeloNoDisponible("metadatos_invalidos") from None
    obligatorios = CAMPOS_OBLIGATORIOS_DEMO if modo == MODO_DEMO else CAMPOS_OBLIGATORIOS
    if not isinstance(metadatos, dict) or any(campo not in metadatos for campo in obligatorios):
        raise ModeloNoDisponible("metadatos_invalidos")
    if not isinstance(metadatos["versiones"], dict) or not isinstance(metadatos["sha256_pkl"], str):
        raise ModeloNoDisponible("metadatos_invalidos")
    return metadatos


def _comprobar_modo(metadatos: dict, modo: str) -> None:
    """
    Un modelo de demo solo se carga en modo demo y uno real solo en modo real,
    aunque alguien copie los archivos a la carpeta equivocada (ADR-0009).
    """
    sintetico = metadatos.get("entrenado_con") == ENTRENADO_CON_SINTETICO
    version_demo = str(metadatos.get("version_modelo", "")).endswith(SUFIJO_VERSION_DEMO)
    if modo == MODO_DEMO and not (sintetico and version_demo):
        raise ModeloNoDisponible("modo_incompatible")
    if modo == MODO_REAL and (sintetico or version_demo):
        raise ModeloNoDisponible("modo_incompatible")


def verificar_artefacto(artefactos_dir: str, modo: str = MODO_REAL) -> dict:
    """
    Comprueba, antes de deserializar nada, que el `.pkl` es el que describe el
    JSON: existe, corresponde al modo pedido, su SHA-256 coincide y las
    versiones instaladas coinciden con las del entrenamiento. Devuelve los
    metadatos o levanta ModeloNoDisponible (mensaje generico, sin rutas).
    """
    modelo = ruta_modelo(artefactos_dir, modo)
    if not os.path.isfile(modelo):
        raise ModeloNoDisponible("artefacto_ausente")
    metadatos = leer_metadatos(artefactos_dir, modo)
    _comprobar_modo(metadatos, modo)
    try:
        huella = sha256_archivo(modelo)
    except OSError:
        raise ModeloNoDisponible("artefacto_ilegible") from None
    if huella != metadatos["sha256_pkl"]:
        raise ModeloNoDisponible("huella_distinta")
    if not versiones_coinciden(metadatos["versiones"], versiones_instaladas()):
        raise ModeloNoDisponible("versiones_distintas")
    return metadatos
