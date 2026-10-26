from pydantic import BaseModel
from typing import Optional, Any

class MomentoResponse(BaseModel):
    id_momento: int
    momento: str

class NivelActividadResponse(BaseModel):
    id_nivel_actividad: int
    descripcion: str

class EnfermedadResponse(BaseModel):
    id_enfermedad: int
    nombre_enfermedad: str

class TratamientoResponse(BaseModel):
    id_tratamiento: int
    nombre_tratamiento: str
    descripcion: Optional[str] = None

class EspecialidadResponse(BaseModel):
    id_especialidad: int
    nombre: str

class AuditoriaResponse(BaseModel):
    id_auditoria: Optional[int] = None
    id_usuario: Optional[int] = None
    rol: Optional[str] = None
    id_rol: Optional[int] = None
    endpoint: Optional[str] = None
    operacion: Optional[str] = None
    exito: Optional[bool] = None
    codigo_http: Optional[int] = None
    ip_origen: Optional[str] = None
    fecha_hora: Optional[str] = None
    usuario: Optional[Any] = None
