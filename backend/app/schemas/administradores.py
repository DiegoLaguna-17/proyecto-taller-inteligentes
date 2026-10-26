from pydantic import BaseModel
from typing import Optional, Any

class ActivarRequest(BaseModel):
    idAdmin: Optional[Any] = None

class AgregarAdminRequest(BaseModel):
    nombre: Optional[str] = None
    correo: Optional[str] = None
    contrasena: Optional[str] = None
    fechaNacimiento: Optional[str] = None
    telefono: Optional[str] = None
    cargo: Optional[str] = None
    fecha_registro: Optional[str] = None
    administrador_id_admin: Optional[Any] = None
