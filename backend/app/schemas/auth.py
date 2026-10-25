from pydantic import BaseModel
from typing import Any

class LoginRequest(BaseModel):
    correo: str
    contrasena: str

class VerifyOtpRequest(BaseModel):
    id_usuario: Any
    codigo: str

class UpdatePasswordRequest(BaseModel):
    contrasena: str
