"""
Endpoint de riesgo de hipoglucemia de GlucoTracker.

Vive dentro de `app/ml/` (no en una capa `api/` separada) porque el modulo de
ML es autocontenido: datos, entrenamiento, prediccion y la ruta HTTP que lo
expone quedan todos juntos -- quien toque el modelo de riesgo, toca un solo
paquete.

Este es el componente de ML (probabilidad continua) que corre EN PARALELO al
motor de reglas ADA (if/else, clasificacion instantanea Normal/Hipo/Hiper) --
no lo reemplaza. Ver la introduccion del notebook consolidado para el
razonamiento completo de por que ambos componentes coexisten.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ml.predict import predecir_riesgo

router = APIRouter(prefix="/api/riesgo", tags=["riesgo"])


class PacienteRiesgoInput(BaseModel):
    """
    Campos exactos que espera el modelo de riesgo de hipoglucemia.

    `hba1c` es el unico campo opcional -- coincide con la decision de
    producto de mantenerlo como dato de perfil que el usuario puede o no
    conocer (ver Parte B del notebook consolidado). Todo lo demas es
    obligatorio porque son datos que la app ya captura al registrar una
    lectura de glucosa o al configurar el perfil del paciente.
    """

    glucosa: float = Field(..., gt=0, le=700, description="Lectura de glucosa en mg/dl")
    momento: str = Field(..., description="Momento de la lectura: 'ayunas' o 'postprandial'")
    genero: str = Field(..., description="'femenino' o 'masculino'")
    edad: int = Field(..., gt=0, le=120, description="Edad en años")
    bmi: float = Field(..., gt=0, le=80, description="Indice de masa corporal (kg/m2)")
    duracion_diabetes: float = Field(..., ge=0, le=80, description="Años desde el diagnostico de diabetes")
    categoria_medicacion: str = Field(
        ..., description="'ninguno', 'metformina_u_otros', 'sulfonilurea' o 'insulina'"
    )
    com_hipertension: bool = False
    com_dislipidemia: bool = False
    com_renal: bool = False
    com_neuropatia: bool = False
    com_nefropatia: bool = False
    com_cardiovascular: bool = False
    hba1c: Optional[float] = Field(
        default=None, gt=0, le=20, description="Ultimo HbA1c (%) conocido, si el usuario lo tiene"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "glucosa": 68,
                "momento": "ayunas",
                "genero": "femenino",
                "edad": 61,
                "bmi": 26.4,
                "duracion_diabetes": 12,
                "categoria_medicacion": "insulina",
                "com_hipertension": True,
                "com_dislipidemia": False,
                "com_renal": False,
                "com_neuropatia": True,
                "com_nefropatia": False,
                "com_cardiovascular": False,
                "hba1c": 8.1,
            }
        }
    }


class RiesgoHipoglucemiaOutput(BaseModel):
    riesgo_hipoglucemia: float = Field(..., description="Probabilidad estimada (0-1) de riesgo de hipoglucemia")
    alerta: str = Field(..., description="'Baja', 'Media' o 'Alta', segun el nivel de riesgo")


def _clasificar_alerta(riesgo: float) -> str:
    """
    Umbrales iniciales para traducir la probabilidad continua en un nivel de
    alerta legible para el usuario. Son un punto de partida razonable, no un
    valor final: el umbral de "Alta" en particular debe recalibrarse con
    validacion cruzada (GroupKFold) priorizando recall -- perder un caso real
    de hipoglucemia (falso negativo) es mas costoso que una alerta de mas.
    """
    if riesgo >= 0.5:
        return "Alta"
    if riesgo >= 0.25:
        return "Media"
    return "Baja"


@router.post("/hipoglucemia", response_model=RiesgoHipoglucemiaOutput)
def predecir_riesgo_hipoglucemia(paciente: PacienteRiesgoInput) -> RiesgoHipoglucemiaOutput:
    """
    Recibe una lectura de glucosa + perfil del paciente y devuelve la
    probabilidad de riesgo de hipoglucemia estimada por el modelo de ML
    (Regresion Logistica, ver app/ml/train_baseline.py).
    """
    try:
        riesgo = predecir_riesgo(paciente.model_dump())
    except FileNotFoundError as exc:
        # El modelo no se ha entrenado todavia en este entorno -- error claro
        # en vez de un 500 generico.
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"No se pudo calcular el riesgo: {exc}") from exc

    return RiesgoHipoglucemiaOutput(
        riesgo_hipoglucemia=round(riesgo, 4),
        alerta=_clasificar_alerta(riesgo),
    )
