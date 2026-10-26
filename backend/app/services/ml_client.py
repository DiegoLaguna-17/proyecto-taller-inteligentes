"""
Cliente del servicio de ML y orquestación del riesgo (ADR-0011).

Aislado: solo habla con `POST {ML_URL}/api/riesgo/hipoglucemia` por HTTP (el backend no importa código del servicio
de ML). El registro del médico NUNCA debe fallar ni demorarse por el ML: `calcular_riesgo_ml` captura toda excepción
y devuelve `riesgo_hipoglucemia: null` con motivo `no_disponible`. Los logs solo llevan el nombre de la excepción o el
código HTTP: nunca cuerpos, valores clínicos ni datos personales.
"""
import asyncio
import logging
import math
from typing import Any, Dict, Optional, Tuple

import httpx

import app.core.supabase as sb
from app.core.config import settings
from app.services import ml_reglas as reglas

logger = logging.getLogger(__name__)

RUTA_RIESGO = "/api/riesgo/hipoglucemia"


class MLNoDisponible(Exception):
    """El servicio de ML no respondió con un resultado válido (red, tiempo, código distinto de 200 o cuerpo inválido)."""

    def __init__(self, causa: str):
        super().__init__(causa)
        self.causa = causa


async def consultar_riesgo(
    entrada: Dict[str, Any],
    url: str,
    timeout: float,
    transport: Optional[httpx.AsyncBaseTransport] = None,
) -> Tuple[float, str]:
    """(probabilidad, version_modelo) del ML, o MLNoDisponible. Sin reintentos."""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout), transport=transport) as cliente:
            respuesta = await cliente.post(url.rstrip("/") + RUTA_RIESGO, json=entrada)
    except Exception as exc:  # noqa: BLE001 - se informa solo el nombre de la clase
        raise MLNoDisponible(type(exc).__name__) from None
    if respuesta.status_code != 200:
        raise MLNoDisponible(f"http_{respuesta.status_code}")
    try:
        cuerpo = respuesta.json()
        riesgo = cuerpo["riesgo_hipoglucemia"]
        version = cuerpo["version_modelo"]
    except Exception:  # noqa: BLE001
        raise MLNoDisponible("respuesta_invalida") from None
    if (
        isinstance(riesgo, bool)
        or not isinstance(riesgo, (int, float))
        or not math.isfinite(riesgo)
        or not 0.0 <= riesgo <= 1.0
        or not isinstance(version, str)
        or not version.strip()
    ):
        raise MLNoDisponible("respuesta_invalida")
    return float(riesgo), version


def _leer_paciente(id_paciente: Any) -> Optional[Dict[str, Any]]:
    """Una sola consulta con relaciones a Supabase (solo lectura). Devuelve los datos que usan las reglas."""
    res = (
        sb.supabase.from_("paciente")
        .select(
            "embarazo,genero,peso,altura,"
            "usuario!inner(fecha_nac),"
            "paciente_enfermedad(enfermedades_base(nombre_enfermedad)),"
            "tratamiento_enfermedad(tratamientos(nombre_tratamiento))"
        )
        .eq("id_paciente", id_paciente)
        .maybe_single()
        .execute()
    )
    d = res.data
    if not d:
        return None
    usuario = d.get("usuario") or {}
    enfermedades = [
        (pe.get("enfermedades_base") or {}).get("nombre_enfermedad")
        for pe in (d.get("paciente_enfermedad") or [])
    ]
    tratamientos = [
        (te.get("tratamientos") or {}).get("nombre_tratamiento")
        for te in (d.get("tratamiento_enfermedad") or [])
    ]
    return {
        "embarazo": d.get("embarazo"),
        "genero": d.get("genero"),
        "peso": d.get("peso"),
        "altura": d.get("altura"),
        "fecha_nac": usuario.get("fecha_nac"),
        "enfermedades": [e for e in enfermedades if e],
        "tratamientos": [t for t in tratamientos if t],
    }


def _registrar_resultado(riesgo_ml: Dict[str, Any], causa: Optional[str] = None) -> None:
    """
    UNA línea de log por cálculo (diagnóstico): motivo, códigos de lo que faltó y supuestos. Sin id de paciente, sin
    valores y sin datos personales. Si no se calculó va como WARNING (visible con la configuración por defecto de
    uvicorn); si se calculó, como INFO.
    """
    motivo = riesgo_ml.get("motivo")
    faltantes = ",".join(riesgo_ml.get("faltantes") or []) or "-"
    supuestos = ",".join(riesgo_ml.get("supuestos") or []) or "-"
    if motivo is None:
        logger.info("riesgo_ml: calculado supuestos=%s", supuestos)
    else:
        logger.warning(
            "riesgo_ml: no calculado motivo=%s faltantes=%s%s", motivo, faltantes, f" causa={causa}" if causa else ""
        )


async def calcular_riesgo_ml(
    id_paciente: Any,
    glucosa: Any,
    id_momento: Any,
    fecha_lectura: Any,
    transport: Optional[httpx.AsyncBaseTransport] = None,
) -> Dict[str, Any]:
    """
    Devuelve SIEMPRE un `riesgo_ml` (nunca lanza). Se llama después de guardar la lectura y solo con ML_ENABLED.
    Solo lee de Supabase; no escribe nada. Deja una línea de log por cálculo (ver `_registrar_resultado`).
    """
    causa: Optional[str] = None
    try:
        paciente = _leer_paciente(id_paciente)
        if paciente is None:
            resultado = reglas.riesgo_ml_sin_calculo(reglas.MOTIVO_DATOS_INSUFICIENTES, [reglas.FALTANTE_PACIENTE])
        else:
            armado = reglas.armar_entrada(
                paciente, glucosa, id_momento, fecha_lectura, float(settings.ML_DURACION_DEFECTO_ANIOS)
            )
            if armado.entrada is None:
                resultado = reglas.riesgo_ml_sin_calculo(
                    armado.motivo or reglas.MOTIVO_DATOS_INSUFICIENTES, armado.faltantes
                )
            else:
                timeout = float(settings.ML_TIMEOUT)
                riesgo, version = await asyncio.wait_for(
                    consultar_riesgo(armado.entrada, settings.ML_URL, timeout, transport), timeout=timeout + 0.5
                )
                resultado = reglas.riesgo_ml_calculado(round(riesgo, 4), version, armado.supuestos)
    except MLNoDisponible as exc:
        causa = exc.causa
        resultado = reglas.riesgo_ml_sin_calculo(reglas.MOTIVO_NO_DISPONIBLE)
    except Exception as exc:  # noqa: BLE001 - incluye tiempo de espera y errores de la consulta (solo el nombre de la clase)
        causa = type(exc).__name__
        resultado = reglas.riesgo_ml_sin_calculo(reglas.MOTIVO_NO_DISPONIBLE)
    try:
        _registrar_resultado(resultado, causa)
    except Exception:  # noqa: BLE001 - el log jamás puede romper el registro
        pass
    return resultado
