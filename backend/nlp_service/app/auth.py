"""
Dependencia de autenticación reemplazable del servicio NLP (D3, ADR-0006).

- CHATBOT_REQUIRE_AUTH=false (solo desarrollo): deja pasar sin token.
- CHATBOT_REQUIRE_AUTH=true: mientras no exista TASK-014 no hay forma de
  validar un token, así que toda llamada recibe 401.

El servicio no se despliega públicamente hasta TASK-014 (CONTEXT.md §
Divergences).
"""
from fastapi import Depends, HTTPException, status

from app.config import Settings, obtener_settings

MENSAJE_NO_AUTENTICADO = "Autenticación requerida."


def requerir_autenticacion(settings: Settings = Depends(obtener_settings)) -> None:
    if not settings.chatbot_require_auth:
        return
    # TODO(TASK-014): validar localmente el token de sesión emitido por el
    # backend (cabecera Authorization: Bearer), sin llamarlo ni importar su
    # código. El esquema depende de RT-01; se prefiere uno verificable con
    # clave pública o JWKS (docs/risks.md). Al implementarlo, retornar el id
    # del usuario para que el límite de tasa pueda ser por usuario.
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=MENSAJE_NO_AUTENTICADO,
        headers={"WWW-Authenticate": "Bearer"},
    )
