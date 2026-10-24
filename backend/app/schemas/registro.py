from pydantic import BaseModel
from typing import Optional

class RegistrarAlertaRequest(BaseModel):
    id_tipo_alerta: Optional[int] = None
    id_registro: Optional[int] = None
    id_medico: Optional[int] = None
    fecha_alerta: Optional[str] = None
