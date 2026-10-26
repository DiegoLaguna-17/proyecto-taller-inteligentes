import random
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import JSONResponse
import app.core.supabase as sb
from app.core.config import settings
from app.core.security import verify_password, hash_password
from app.services.otp_service import OtpCacheService
from app.services.email_service import EmailService, get_otp_template
from app.core.audit import registrar_auditoria
from app.schemas.auth import LoginRequest, VerifyOtpRequest, UpdatePasswordRequest

router = APIRouter(tags=["auth"])

@router.post("/api/login")
async def login(req_body: LoginRequest, request: Request):
    correo = req_body.correo
    contrasena = req_body.contrasena
    client_ip = request.client.host if request.client else "127.0.0.1"

    try:
        # 1. Buscar usuario
        res_usuario = sb.supabase.from_("usuario") \
            .select("id_usuario, correo, contrasena, rol") \
            .eq("correo", correo) \
            .eq("estado", True) \
            .single() \
            .execute()

        usuario = res_usuario.data
        if not usuario:
            await registrar_auditoria(request, rol="login", status_code=401, body_data={"correo": correo})
            return JSONResponse(status_code=401, content={"error": "Correo no encontrado"})

        # 2. Buscar ID según rol
        rol_map = {
            "administrador": "id_admin",
            "paciente": "id_paciente",
            "medico": "id_medico"
        }
        rol = usuario.get("rol")
        rol_b = rol_map.get(rol)

        res_rol = sb.supabase.from_(rol).select(rol_b).eq("id_usuario", usuario["id_usuario"]).single().execute()
        rol_data = res_rol.data
        if not rol_data:
            await registrar_auditoria(request, rol="login", status_code=401, id_usuario=usuario["id_usuario"])
            return JSONResponse(status_code=401, content={"error": "Rol cuenta"})

        id_rol = rol_data.get(rol_b)

        # 3. Verificar contraseña
        is_match = verify_password(contrasena, usuario["contrasena"])
        if not is_match:
            await registrar_auditoria(request, rol="login", status_code=401, id_usuario=usuario["id_usuario"], id_rol=id_rol)
            return JSONResponse(status_code=401, content={"error": "Contraseña incorrecta"})

        # 4. Interruptor de PRUEBAS (ADR-0012): con OTP_ACTIVADO=false no se genera ni se envía el OTP y se devuelve el rol
        if not settings.OTP_ACTIVADO:
            await registrar_auditoria(request, rol="login", status_code=200, id_usuario=usuario["id_usuario"], id_rol=id_rol)
            return {
                "id_usuario": usuario["id_usuario"],
                "id_rol": id_rol,
                "rol": rol,
                "message": "Login exitoso (OTP desactivado para pruebas)"
            }

        # 4. Generar OTP
        otp = str(random.randint(100000, 999999))
        OtpCacheService.set_otp(usuario["id_usuario"], otp, 5 * 60 * 1000)

        # 5. Enviar OTP por correo
        template = get_otp_template({
            "nombreUsuario": usuario["correo"],
            "codigo": otp
        })
        await EmailService.send_email(usuario["correo"], template["subject"], template["html"])

        # 6. Auditoría exitosa
        await registrar_auditoria(request, rol="login", status_code=200, id_usuario=usuario["id_usuario"], id_rol=id_rol)

        return {
            "id_usuario": usuario["id_usuario"],
            "id_rol": id_rol,
            "message": "OTP enviado al correo"
        }

    except Exception as err:
        error_msg = str(err)
        # Manejo de error de Supabase o excepción interna
        if "No rows found" in error_msg or "PGRST116" in error_msg:
            await registrar_auditoria(request, rol="login", status_code=401)
            return JSONResponse(status_code=401, content={"error": "Correo no encontrado"})
        
        await registrar_auditoria(request, rol="login", status_code=500)
        return JSONResponse(status_code=500, content={"error": "Error interno"})


@router.post("/api/verify-otp")
async def verify_otp(req_body: VerifyOtpRequest, request: Request):
    id_usuario = req_body.id_usuario
    codigo = req_body.codigo

    try:
        cached_otp = OtpCacheService.get_otp(id_usuario)

        if not cached_otp or cached_otp != codigo:
            await registrar_auditoria(request, rol="login", status_code=401, id_usuario=id_usuario)
            return JSONResponse(status_code=401, content={"error": "Código incorrecto o expirado"})

        OtpCacheService.delete_otp(id_usuario)

        res_usuario = sb.supabase.from_("usuario").select("id_usuario, rol").eq("id_usuario", id_usuario).single().execute()
        usuario_data = res_usuario.data

        if not usuario_data:
            await registrar_auditoria(request, rol="login", status_code=401, id_usuario=id_usuario)
            return JSONResponse(status_code=401, content={"error": "Usuario no encontrado"})

        rol = usuario_data.get("rol")
        id_rol = 0

        if rol == "administrador":
            res_admin = sb.supabase.from_("administrador").select("id_admin").eq("id_usuario", id_usuario).single().execute()
            id_rol = res_admin.data.get("id_admin") if res_admin.data else 0
        elif rol == "medico":
            res_med = sb.supabase.from_("medico").select("id_medico").eq("id_usuario", id_usuario).single().execute()
            id_rol = res_med.data.get("id_medico") if res_med.data else 0
        else:
            res_pac = sb.supabase.from_("paciente").select("id_paciente").eq("id_usuario", id_usuario).single().execute()
            id_rol = res_pac.data.get("id_paciente") if res_pac.data else 0

        await registrar_auditoria(request, rol="login", status_code=200, id_usuario=id_usuario, id_rol=id_rol)

        return {
            "id_usuario": id_usuario,
            "rol": rol,
            "id_rol": id_rol,
            "message": "Login exitoso"
        }
    except Exception as err:
        await registrar_auditoria(request, rol="login", status_code=500, id_usuario=id_usuario)
        return JSONResponse(status_code=500, content={"error": "Error interno"})


@router.put("/usuario/{id_usuario}/password")
async def update_password(id_usuario: int, req_body: UpdatePasswordRequest, request: Request):
    contrasena = req_body.contrasena

    if not contrasena or len(contrasena) < 6:
        return JSONResponse(
            status_code=400,
            content={"error": "La contraseña debe tener al menos 6 caracteres."}
        )

    try:
        hashed_password = hash_password(contrasena)

        res = sb.supabase.from_("usuario") \
            .update({"contrasena": hashed_password}) \
            .eq("id_usuario", id_usuario) \
            .execute()

        if not res.data or len(res.data) == 0:
            return JSONResponse(status_code=404, content={"error": "Usuario no encontrado."})

        return {
            "message": "Contraseña actualizada correctamente.",
            "usuario": {k: res.data[0].get(k) for k in ("id_usuario", "nombre_completo", "correo")}
        }
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": "Error interno del servidor."})
