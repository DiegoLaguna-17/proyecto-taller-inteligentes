from pydantic import BaseModel
from typing import Optional, Any

class ResponderAlertaBody(BaseModel):
    id_medico: Optional[Any] = None
    fecha_registro: Optional[str] = None
    mensaje: Optional[str] = None
    alertas_id_alerta: Optional[Any] = None

class RegistrarGlucosaMedicoBody(BaseModel):
    fecha: Optional[str] = None
    hora: Optional[str] = None
    id_medico: Optional[Any] = None
    id_momento: Optional[Any] = None
    id_paciente: Optional[Any] = None
    nivel_glucosa: Optional[Any] = None
    observaciones: Optional[str] = None
