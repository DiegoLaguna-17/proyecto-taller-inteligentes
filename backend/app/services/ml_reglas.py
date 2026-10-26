"""
Reglas y armado de la entrada del servicio de ML (ADR-0011, design.md § Integración backend ↔ ML).

Funciones PURAS (sin red, sin base de datos, sin importar código del servicio de ML): reciben los datos que el
backend ya leyó de Supabase y devuelven la entrada del contrato de `POST /api/riesgo/hipoglucemia` o el motivo por
el que no se calcula. **Ningún identificador** entra en la entrada (nombre, correo, ids, teléfono).

Motivos (`riesgo_ml.motivo`): no_aplica_tipo, datos_insuficientes, momento_no_cubierto, no_disponible.
Supuestos (`riesgo_ml.supuestos`): duracion_estimada, comorbilidades_no_capturadas, hba1c_no_disponible.

Puntos de extensión (sin tabla ni columna hoy; TASK-017h): `extras["anio_diagnostico"]` (si existe, la duración se
calcula con ese año y se omite el supuesto `duracion_estimada`) y `extras["comorbilidades"]` (si existe, se usan sus
banderas y se omite `comorbilidades_no_capturadas`).
"""
import math
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional

MOTIVO_NO_APLICA_TIPO = "no_aplica_tipo"
MOTIVO_DATOS_INSUFICIENTES = "datos_insuficientes"
MOTIVO_MOMENTO_NO_CUBIERTO = "momento_no_cubierto"
MOTIVO_NO_DISPONIBLE = "no_disponible"

SUPUESTO_DURACION = "duracion_estimada"
SUPUESTO_COMORBILIDADES = "comorbilidades_no_capturadas"
SUPUESTO_HBA1C = "hba1c_no_disponible"

NOMBRE_TIPO_2 = "diabetes tipo 2"

# Catálogo real `momento_dia` (GET /api/general/momentos): 1 AYUNAS, 2 DESPUES DE COMER, 3 ANTES DE DORMIR.
# El modelo solo conoce ayunas y postprandial (2 h después de comer): el resto no se calcula.
MOMENTOS_ML = {1: "ayunas", 2: "postprandial"}

# Rangos del contrato del ML (backend/ml_service/app/api/riesgo.py) y de plausibilidad
GLUCOSA_MAX_ML = 700.0
EDAD_MIN, EDAD_MAX = 1, 120
BMI_MAX_ML = 80.0
ALTURA_M_MIN, ALTURA_M_MAX = 1.0, 2.5  # la altura se guarda en METROS (numeric(4,2))
PESO_KG_MIN, PESO_KG_MAX = 20.0, 300.0
DURACION_MIN, DURACION_MAX = 0.0, 80.0

COMORBILIDADES = (
    "com_hipertension",
    "com_dislipidemia",
    "com_renal",
    "com_neuropatia",
    "com_nefropatia",
    "com_cardiovascular",
)

# Lista ESTRICTA de géneros (el campo `paciente.genero` es texto libre): cualquier otro valor → datos_insuficientes
_GENEROS = {
    "masculino": "masculino",
    "hombre": "masculino",
    "varon": "masculino",
    "femenino": "femenino",
    "mujer": "femenino",
}

_INSULINA = ("insulin", "novolin", "degludec", "aspart", "glargine", "lispro", "detemir", "csii")
_SULFONILUREA = ("sulfonilurea", "glimepirid", "glipizid", "gliclazid", "glibenclamid", "glyburide", "glimepiride")
_METFORMINA_U_OTROS = (
    "metformin",
    "sitagliptin",
    "linagliptin",
    "vildagliptin",
    "dapagliflozin",
    "empagliflozin",
    "canagliflozin",
    "pioglitazon",
    "acarbosa",
)


def normalizar_texto(texto: Any) -> str:
    """Minúsculas, sin tildes y con espacios colapsados."""
    if texto is None:
        return ""
    sin_tildes = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", sin_tildes).strip().lower()


def _numero(valor: Any) -> Optional[float]:
    """Número finito o None (los booleanos y los textos no numéricos no cuentan)."""
    if isinstance(valor, bool) or valor is None:
        return None
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return None
    return n if math.isfinite(n) else None


def es_tipo_2(enfermedades: List[str], embarazo: Any) -> bool:
    """
    Regla «solo diabetes tipo 2»: EXACTAMENTE una enfermedad, cuyo nombre normalizado es «diabetes tipo 2», y sin
    embarazo activo. Sin tipo, tipo 1, gestacional, varias filas o tipo 2 con embarazo → False.
    """
    if embarazo is True:
        return False
    nombres = [normalizar_texto(e) for e in (enfermedades or []) if normalizar_texto(e)]
    return len(nombres) == 1 and nombres[0] == NOMBRE_TIPO_2


def normalizar_genero(valor: Any) -> Optional[str]:
    return _GENEROS.get(normalizar_texto(valor))


def _a_fecha(valor: Any) -> Optional[date]:
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    try:
        return datetime.strptime(str(valor)[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def calcular_edad(fecha_nac: Any, fecha_lectura: Any) -> Optional[int]:
    """Años cumplidos a la fecha de la lectura; None si no se puede calcular o está fuera de 1 a 120."""
    nac, ref = _a_fecha(fecha_nac), _a_fecha(fecha_lectura)
    if nac is None or ref is None or nac > ref:
        return None
    edad = ref.year - nac.year - ((ref.month, ref.day) < (nac.month, nac.day))
    return edad if EDAD_MIN <= edad <= EDAD_MAX else None


def calcular_bmi(peso_kg: Any, altura_m: Any) -> Optional[float]:
    """IMC = peso (kg) / altura (METROS)². None si los datos no son plausibles (nunca se asume altura en cm)."""
    peso, altura = _numero(peso_kg), _numero(altura_m)
    if peso is None or altura is None:
        return None
    if not (PESO_KG_MIN <= peso <= PESO_KG_MAX and ALTURA_M_MIN <= altura <= ALTURA_M_MAX):
        return None
    bmi = peso / (altura * altura)
    return round(bmi, 1) if 0 < bmi <= BMI_MAX_ML else None


def categoria_medicacion(tratamientos: List[str]) -> Optional[str]:
    """
    Categoría del contrato desde los nombres del catálogo de tratamientos. Prioridad del entrenamiento: insulina >
    sulfonilurea > metformina u otros. Sin tratamientos, o con nombres sin equivalente, devuelve None (no se asume
    «ninguno»: no se puede distinguir «no toma nada» de «no está registrado»).
    """
    nombres = [normalizar_texto(t) for t in (tratamientos or []) if normalizar_texto(t)]
    if any(k in n for n in nombres for k in _INSULINA):
        return "insulina"
    if any(k in n for n in nombres for k in _SULFONILUREA):
        return "sulfonilurea"
    if any(k in n for n in nombres for k in _METFORMINA_U_OTROS):
        return "metformina_u_otros"
    return None


def mapear_momento(id_momento: Any) -> Optional[str]:
    n = _numero(id_momento)
    if n is None or n != int(n):
        return None
    return MOMENTOS_ML.get(int(n))


@dataclass
class ResultadoArmado:
    """Entrada lista para el ML, o el motivo por el que no se calcula (con los supuestos hechos hasta ese punto)."""

    entrada: Optional[Dict[str, Any]] = None
    motivo: Optional[str] = None
    supuestos: List[str] = field(default_factory=list)


def armar_entrada(
    paciente: Dict[str, Any],
    glucosa: Any,
    id_momento: Any,
    fecha_lectura: Any,
    duracion_defecto_anios: float,
    extras: Optional[Dict[str, Any]] = None,
) -> ResultadoArmado:
    """
    `paciente`: {genero, peso, altura, embarazo, fecha_nac, enfermedades: [str], tratamientos: [str]}.
    Orden de decisión: tipo → momento → datos obligatorios (glucosa, género, edad, IMC, medicación) → entrada.
    La falta de duración NUNCA produce datos_insuficientes (se usa el valor por defecto con el supuesto).
    """
    extras = extras or {}
    if not es_tipo_2(paciente.get("enfermedades") or [], paciente.get("embarazo")):
        return ResultadoArmado(motivo=MOTIVO_NO_APLICA_TIPO)

    momento = mapear_momento(id_momento)
    if momento is None:
        return ResultadoArmado(motivo=MOTIVO_MOMENTO_NO_CUBIERTO)

    g = _numero(glucosa)
    genero = normalizar_genero(paciente.get("genero"))
    edad = calcular_edad(paciente.get("fecha_nac"), fecha_lectura)
    bmi = calcular_bmi(paciente.get("peso"), paciente.get("altura"))
    medicacion = categoria_medicacion(paciente.get("tratamientos") or [])
    if g is None or not (0 < g <= GLUCOSA_MAX_ML) or genero is None or edad is None or bmi is None or medicacion is None:
        return ResultadoArmado(motivo=MOTIVO_DATOS_INSUFICIENTES)

    supuestos: List[str] = []

    # Duración: real si existe `anio_diagnostico` (extensión, TASK-017h); si no, el valor por defecto configurable
    duracion: Optional[float] = None
    anio = _numero(extras.get("anio_diagnostico"))
    ref = _a_fecha(fecha_lectura)
    if anio is not None and ref is not None and 1900 <= anio <= ref.year:
        duracion = float(ref.year - int(anio))
    if duracion is None or not (DURACION_MIN <= duracion <= DURACION_MAX):
        duracion = float(duracion_defecto_anios)
        supuestos.append(SUPUESTO_DURACION)
    duracion = min(max(duracion, DURACION_MIN), DURACION_MAX)

    # Comorbilidades: banderas reales si existen (extensión); si no, todas en false con el supuesto
    banderas = extras.get("comorbilidades")
    if isinstance(banderas, dict):
        comorbilidades = {c: banderas.get(c) is True for c in COMORBILIDADES}
    else:
        comorbilidades = {c: False for c in COMORBILIDADES}
        supuestos.append(SUPUESTO_COMORBILIDADES)

    supuestos.append(SUPUESTO_HBA1C)  # la HbA1c no se captura hoy: va nula (campo opcional del contrato)

    entrada = {
        "glucosa": g,
        "momento": momento,
        "genero": genero,
        "edad": edad,
        "bmi": bmi,
        "duracion_diabetes": duracion,
        "categoria_medicacion": medicacion,
        **comorbilidades,
        "hba1c": None,
    }
    return ResultadoArmado(entrada=entrada, supuestos=supuestos)


def riesgo_ml_sin_calculo(motivo: str) -> Dict[str, Any]:
    """Forma de `riesgo_ml` cuando NO se calcula: riesgo nulo, motivo y supuestos `[]` (no hubo cálculo)."""
    return {"riesgo_hipoglucemia": None, "version_modelo": None, "motivo": motivo, "supuestos": []}


def riesgo_ml_calculado(riesgo: float, version: str, supuestos: List[str]) -> Dict[str, Any]:
    return {"riesgo_hipoglucemia": riesgo, "version_modelo": version, "motivo": None, "supuestos": list(supuestos)}
