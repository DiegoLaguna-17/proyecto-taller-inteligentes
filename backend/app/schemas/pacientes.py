from pydantic import BaseModel
from typing import Optional, Any

class RegistrarGlucosaBody(BaseModel):
    fecha: Optional[str] = None
    hora: Optional[str] = None
    id_momento: Optional[Any] = None
    id_paciente: Optional[Any] = None
    nivel_glucosa: Optional[Any] = None
    observaciones: Optional[str] = None

class ActualizarPacienteBody(BaseModel):
    nombre: Optional[str] = None
    altura: Optional[Any] = None
    peso: Optional[Any] = None
    telefono: Optional[str] = None
    correo: Optional[str] = None
    embarazo: Optional[Any] = None
    fecha_terminacion: Optional[str] = None
    semanas_embarazo: Optional[Any] = None
    nombre_emergencia: Optional[str] = None
    numero_emergencia: Optional[str] = None
