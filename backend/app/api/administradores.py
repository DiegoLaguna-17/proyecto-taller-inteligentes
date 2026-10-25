from typing import Optional, Any, Dict
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from app.schemas.administradores import ActivarRequest, AgregarAdminRequest
import app.core.supabase as sb
from app.core.security import hash_password
from app.core.audit import registrar_auditoria

router = APIRouter(prefix="/api/administradores", tags=["administradores"])

def formatear_fecha(fecha_str: Optional[str]) -> Optional[str]:
    if not fecha_str:
        return None
    partes = str(fecha_str).split("T")[0].split("-")
    if len(partes) == 3:
        return f"{partes[2]}/{partes[1]}/{partes[0]}"
    return fecha_str

@router.get("/medicos/activos")
async def medicos_activos(request: Request):
    try:
        res = sb.supabase.from_("medico").select(
            "id_medico,"
            "matricula_profesional,"
            "departamento,"
            "carnet_profesional,"
            "usuario!inner("
            "nombre_completo,"
            "fecha_nac,"
            "teléfono,"
            "correo,"
            "estado"
            "),"
            "administrador("
            "usuario("
            "nombre_completo"
            ")"
            ")"
        ).eq("usuario.estado", True).execute()

        data = res.data or []
        medicos_formateados = []
        for m in data:
            usuario = m.get("usuario") or {}
            admin = m.get("administrador") or {}
            admin_usuario = admin.get("usuario") or {} if isinstance(admin, dict) else {}

            medicos_formateados.append({
                "id": m.get("id_medico"),
                "nombre": usuario.get("nombre_completo") or "Sin nombre",
                "fechaNac": usuario.get("fecha_nac"),
                "telefono": usuario.get("teléfono") or "No registrado",
                "correo": usuario.get("correo") or "No registrado",
                "matricula": m.get("matricula_profesional") or "N/A",
                "departamento": m.get("departamento") or "N/A",
                "carnet": m.get("carnet_profesional") or "N/A",
                "admitidoPor": admin_usuario.get("nombre_completo") or "Sistema",
            })
        return medicos_formateados
    except Exception as err:
        err_msg = str(err)
        if "28" in err_msg or "DB_AUTH_ERROR" in err_msg:
            return JSONResponse(
                status_code=403,
                content={"error": "No autorizado para consultar la base de datos", "code": "DB_AUTH_ERROR"}
            )
        if "57014" in err_msg or "DB_TIMEOUT" in err_msg:
            return JSONResponse(
                status_code=504,
                content={"error": "La base de datos tardó demasiado en responder", "code": "DB_TIMEOUT"}
            )
        return JSONResponse(
            status_code=500,
            content={"error": "Error interno inesperado del servidor", "code": "INTERNAL_SERVER_ERROR"}
        )

@router.get("/medicos/solicitantes")
async def medicos_solicitantes(request: Request):
    try:
        res = sb.supabase.from_("medico").select(
            "id_medico,"
            "matricula_profesional,"
            "departamento,"
            "carnet_profesional,"
            "usuario!inner("
            "nombre_completo,"
            "fecha_nac,"
            "teléfono,"
            "correo,"
            "estado"
            "),"
            "administrador("
            "usuario("
            "nombre_completo"
            ")"
            ")"
        ).eq("usuario.estado", False).execute()

        data = res.data or []
        medicos_formateados = []
        for m in data:
            usuario = m.get("usuario") or {}
            admin = m.get("administrador") or {}
            admin_usuario = admin.get("usuario") or {} if isinstance(admin, dict) else {}

            medicos_formateados.append({
                "id": m.get("id_medico"),
                "nombre": usuario.get("nombre_completo") or "Sin nombre",
                "fechaNac": usuario.get("fecha_nac"),
                "telefono": usuario.get("teléfono") or "No registrado",
                "correo": usuario.get("correo") or "No registrado",
                "matricula": m.get("matricula_profesional") or "N/A",
                "departamento": m.get("departamento") or "N/A",
                "carnet": m.get("carnet_profesional") or "N/A",
                "admitidoPor": admin_usuario.get("nombre_completo") or "Sistema",
            })
        return medicos_formateados
    except Exception as err:
        return JSONResponse(
            status_code=500,
            content={"error": "Error interno inesperado del servidor", "code": "INTERNAL_SERVER_ERROR"}
        )

@router.put("/medico/activar/{idMedico}")
async def activar_medico(idMedico: str, req_body: ActivarRequest, request: Request):
    id_admin = req_body.idAdmin
    if not id_admin:
        return JSONResponse(status_code=400, content={"error": "No hay administrador"})

    try:
        res_med = sb.supabase.from_("medico").select("id_usuario").eq("id_medico", idMedico).single().execute()
        if not res_med.data:
            return JSONResponse(status_code=404, content={"error": "Médico no encontrado"})

        id_usuario = res_med.data["id_usuario"]

        res_update_med = sb.supabase.from_("medico").update({"administrador_id_admin": id_admin}).eq("id_medico", idMedico).execute()
        res_update_usr = sb.supabase.from_("usuario").update({"estado": True}).eq("id_usuario", id_usuario).execute()

        await registrar_auditoria(request, rol="administrador", status_code=200, id_usuario=id_usuario, id_rol=id_admin)
        return {"mensaje": "Usuario activado correctamente"}
    except Exception as err:
        err_msg = str(err)
        if "No rows found" in err_msg or "PGRST116" in err_msg:
            return JSONResponse(status_code=404, content={"error": "Médico no encontrado"})
        return JSONResponse(status_code=500, content={"error": "Error del servidor", "detalles": str(err)})

@router.get("/pacientes/activos")
async def pacientes_activos(request: Request):
    try:
        res = sb.supabase.from_("paciente").select(
            "id_paciente,"
            "genero,"
            "peso,"
            "altura,"
            "nombre_emergencia,"
            "numero_emergencia,"
            "foto_perfil,"
            "usuario!inner("
            "nombre_completo,"
            "fecha_nac,"
            "teléfono,"
            "correo,"
            "estado"
            "),"
            "nivel_actividad_fisica("
            "descripcion"
            "),"
            "medico("
            "usuario("
            "nombre_completo"
            ")"
            "),"
            "administrador!inner("
            "usuario("
            "nombre_completo"
            ")"
            "),"
            "paciente_enfermedad("
            "enfermedades_base("
            "nombre_enfermedad"
            ")"
            "),"
            "tratamiento_enfermedad("
            "dosis,"
            "tratamientos("
            "nombre_tratamiento,"
            "descripcion"
            ")"
            ")"
        ).eq("usuario.estado", True).execute()

        data = res.data or []
        pacientes_formateados = []
        for p in data:
            usuario = p.get("usuario") or {}
            admin = p.get("administrador") or {}
            admin_usuario = admin.get("usuario") or {} if isinstance(admin, dict) else {}
            medico = p.get("medico") or {}
            medico_usuario = medico.get("usuario") or {} if isinstance(medico, dict) else {}

            afecciones_list = []
            for pe in p.get("paciente_enfermedad") or []:
                eb = pe.get("enfermedades_base")
                afecciones_list.append({"afeccion": eb.get("nombre_enfermedad") if eb else "Desconocida"})

            tratamientos_list = []
            for te in p.get("tratamiento_enfermedad") or []:
                t = te.get("tratamientos") or {}
                tratamientos_list.append({
                    "titulo": t.get("nombre_tratamiento") or "Sin título",
                    "desc": t.get("descripcion") or "",
                    "dosis": str(te.get("dosis")) if te.get("dosis") is not None else None,
                })

            pacientes_formateados.append({
                "id": p.get("id_paciente"),
                "nombre": usuario.get("nombre_completo") or "Sin nombre",
                "ci": usuario.get("correo"),
                "fechaNac": formatear_fecha(usuario.get("fecha_nac")),
                "genero": p.get("genero"),
                "peso": str(p["peso"]) if p.get("peso") is not None else None,
                "altura": str(p["altura"]) if p.get("altura") is not None else None,
                "actividadFisica": p.get("nivel_actividad_fisica", {}).get("descripcion") if p.get("nivel_actividad_fisica") else None,
                "telefono": usuario.get("teléfono") or "No registrado",
                "correo": usuario.get("correo") or "No registrado",
                "nombre_emergencia": p.get("nombre_emergencia"),
                "numero_emergencia": p.get("numero_emergencia"),
                "medico": medico_usuario.get("nombre_completo"),
                "foto_perfil": p.get("foto_perfil"),
                "afecciones": afecciones_list,
                "tratamientos": tratamientos_list,
                "admitidoPor": admin_usuario.get("nombre_completo") or "Sistema",
            })
        return pacientes_formateados
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": "Error interno del servidor", "code": "INTERNAL_SERVER_ERROR"})

@router.get("/pacientes/solicitantes")
async def pacientes_solicitantes(request: Request):
    try:
        res = sb.supabase.from_("paciente").select(
            "id_paciente,"
            "genero,"
            "peso,"
            "altura,"
            "nombre_emergencia,"
            "numero_emergencia,"
            "foto_perfil,"
            "embarazo,"
            "usuario!inner("
            "nombre_completo,"
            "fecha_nac,"
            "teléfono,"
            "correo,"
            "estado"
            "),"
            "nivel_actividad_fisica("
            "descripcion"
            "),"
            "medico("
            "usuario("
            "nombre_completo"
            ")"
            "),"
            "administrador("
            "usuario("
            "nombre_completo"
            ")"
            "),"
            "paciente_enfermedad("
            "enfermedades_base("
            "nombre_enfermedad"
            ")"
            "),"
            "tratamiento_enfermedad("
            "dosis,"
            "tratamientos("
            "nombre_tratamiento,"
            "descripcion"
            ")"
            "),"
            "seguimiento_embarazo("
            "semanas_embarazo,"
            "fecha_terminacion"
            ")"
        ).eq("usuario.estado", False).execute()

        data = res.data or []
        pacientes_formateados = []
        for p in data:
            usuario = p.get("usuario") or {}
            admin = p.get("administrador") or {}
            admin_usuario = admin.get("usuario") or {} if isinstance(admin, dict) else {}
            medico = p.get("medico") or {}
            medico_usuario = medico.get("usuario") or {} if isinstance(medico, dict) else {}

            afecciones_list = []
            for pe in p.get("paciente_enfermedad") or []:
                eb = pe.get("enfermedades_base")
                afecciones_list.append({"afeccion": eb.get("nombre_enfermedad") if eb else "Desconocida"})

            tratamientos_list = []
            for te in p.get("tratamiento_enfermedad") or []:
                t = te.get("tratamientos") or {}
                tratamientos_list.append({
                    "titulo": t.get("nombre_tratamiento") or "Sin título",
                    "desc": t.get("descripcion") or "",
                    "dosis": str(te.get("dosis")) if te.get("dosis") is not None else None,
                })

            semanas_emb = None
            for seg in p.get("seguimiento_embarazo") or []:
                if seg.get("fecha_terminacion") is None:
                    semanas_emb = seg.get("semanas_embarazo")
                    break

            pacientes_formateados.append({
                "id": p.get("id_paciente"),
                "nombre": usuario.get("nombre_completo") or "Sin nombre",
                "ci": usuario.get("correo"),
                "fechaNac": formatear_fecha(usuario.get("fecha_nac")),
                "genero": p.get("genero"),
                "peso": str(p["peso"]) if p.get("peso") is not None else None,
                "altura": str(p["altura"]) if p.get("altura") is not None else None,
                "actividadFisica": p.get("nivel_actividad_fisica", {}).get("descripcion") if p.get("nivel_actividad_fisica") else None,
                "telefono": usuario.get("teléfono") or "No registrado",
                "correo": usuario.get("correo") or "No registrado",
                "nombre_emergencia": p.get("nombre_emergencia"),
                "numero_emergencia": p.get("numero_emergencia"),
                "medico": medico_usuario.get("nombre_completo"),
                "foto_perfil": p.get("foto_perfil"),
                "embarazo": p.get("embarazo"),
                "semanas_embarazo": semanas_emb,
                "afecciones": afecciones_list,
                "tratamientos": tratamientos_list,
                "admitidoPor": admin_usuario.get("nombre_completo") or "Sistema",
            })
        return pacientes_formateados
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": "Error interno del servidor", "code": "INTERNAL_SERVER_ERROR"})

@router.put("/paciente/activar/{idPaciente}")
async def activar_paciente(idPaciente: str, req_body: ActivarRequest, request: Request):
    id_admin = req_body.idAdmin
    if not id_admin:
        return JSONResponse(status_code=400, content={"error": "No hay administrador"})

    try:
        res_pac = sb.supabase.from_("paciente").select("id_usuario").eq("id_paciente", idPaciente).single().execute()
        if not res_pac.data:
            return JSONResponse(status_code=404, content={"error": "Paciente no encontrado"})

        id_usuario = res_pac.data["id_usuario"]

        sb.supabase.from_("paciente").update({"administrador_id_admin": id_admin}).eq("id_paciente", idPaciente).execute()
        res_usr = sb.supabase.from_("usuario").update({"estado": True}).eq("id_usuario", id_usuario).execute()

        await registrar_auditoria(request, rol="administrador", status_code=200, id_usuario=id_usuario, id_rol=id_admin)
        return {"mensaje": "Usuario activado correctamente", "usuario": res_usr.data}
    except Exception as err:
        err_msg = str(err)
        if "No rows found" in err_msg or "PGRST116" in err_msg:
            return JSONResponse(status_code=404, content={"error": "Paciente no encontrado"})
        return JSONResponse(status_code=500, content={"error": "Error del servidor", "detalles": str(err)})

@router.get("/perfilAdmin/{idUsuario}")
async def perfil_admin(idUsuario: str, request: Request):
    try:
        id_usuario = int(idUsuario)
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "El ID de usuario debe ser un número válido"})

    try:
        res = sb.supabase.from_("administrador").select(
            "id_admin,"
            "cargo,"
            "fecha_ingreso,"
            "usuario!inner("
            "nombre_completo,"
            "correo,"
            "fecha_nac,"
            "teléfono"
            "),"
            "administrador("
            "usuario("
            "nombre_completo"
            ")"
            ")"
        ).eq("id_usuario", id_usuario).maybe_single().execute()

        data = res.data
        if not data:
            return JSONResponse(status_code=404, content={"message": "No se encontró el administrador"})

        usuario = data.get("usuario") or {}
        admin_padre = data.get("administrador") or {}
        admin_usuario = admin_padre.get("usuario") or {} if isinstance(admin_padre, dict) else {}

        admin_formateado = {
            "id": data.get("id_admin"),
            "nombre": usuario.get("nombre_completo") or "Sin nombre",
            "correo": usuario.get("correo") or "Sin correo",
            "fechaNac": formatear_fecha(usuario.get("fecha_nac")),
            "telefono": usuario.get("teléfono") or "No registrado",
            "cargo": data.get("cargo") or "N/A",
            "fechaIn": formatear_fecha(data.get("fecha_ingreso")),
            "admitidoPor": admin_usuario.get("nombre_completo") or "No",
        }
        await registrar_auditoria(request, rol="administrador", status_code=200, id_usuario=id_usuario, id_rol=data.get("id_admin"))
        return admin_formateado
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": "Error interno del servidor", "code": "INTERNAL_SERVER_ERROR"})

@router.post("/agregar")
async def agregar_admin(req_body: AgregarAdminRequest, request: Request):
    if (
        not req_body.nombre
        or not req_body.correo
        or not req_body.contrasena
        or not req_body.fechaNacimiento
        or not req_body.cargo
        or not req_body.fecha_registro
        or not req_body.telefono
        or not req_body.administrador_id_admin
    ):
        return JSONResponse(status_code=400, content={"error": "Todos los campos deben ser llenados"})

    try:
        hashed_password = hash_password(req_body.contrasena)
        res_usr = sb.supabase.from_("usuario").insert([
            {
                "nombre_completo": req_body.nombre,
                "correo": req_body.correo,
                "contrasena": hashed_password,
                "rol": "administrador",
                "fecha_nac": req_body.fechaNacimiento,
                "teléfono": req_body.telefono,
                "estado": True,
            }
        ]).execute()

        if not res_usr.data or len(res_usr.data) == 0:
            raise Exception("Error insertando usuario")

        usuario_insertado = res_usr.data[0]

        res_adm = sb.supabase.from_("administrador").insert([
            {
                "id_usuario": usuario_insertado["id_usuario"],
                "cargo": req_body.cargo,
                "fecha_ingreso": req_body.fecha_registro,
                "administrador_id_admin": req_body.administrador_id_admin,
            }
        ]).execute()

        if not res_adm.data or len(res_adm.data) == 0:
            raise Exception("Error insertando administrador")

        await registrar_auditoria(
            request,
            rol="administrador",
            status_code=200,
            id_usuario=usuario_insertado["id_usuario"],
            id_rol=res_adm.data[0]["id_admin"]
        )

        return {
            "message": "Usuario y admin registrados correctamente",
            "usuario_insertado": usuario_insertado,
            "adminData": res_adm.data,
        }
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": str(err)})

@router.get("/obtenerAdmins/{idAdmin}")
async def obtener_admins(idAdmin: str, request: Request):
    try:
        id_admin = int(idAdmin)
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "El ID de administrador debe ser un número válido"})

    try:
        res = sb.supabase.from_("administrador").select(
            "id_admin,"
            "cargo,"
            "fecha_ingreso,"
            "usuario!inner("
            "nombre_completo,"
            "correo,"
            "fecha_nac,"
            "teléfono"
            "),"
            "administrador("
            "usuario("
            "nombre_completo"
            ")"
            ")"
        ).neq("id_admin", 1).neq("id_admin", id_admin).execute()

        data = res.data or []
        admins_formateados = []
        for a in data:
            usuario = a.get("usuario") or {}
            admin_padre = a.get("administrador") or {}
            admin_usuario = admin_padre.get("usuario") or {} if isinstance(admin_padre, dict) else {}

            admins_formateados.append({
                "id": a.get("id_admin"),
                "nombre": usuario.get("nombre_completo") or "Sin nombre",
                "correo": usuario.get("correo") or "Sin correo",
                "fechaNac": formatear_fecha(usuario.get("fecha_nac")),
                "telefono": usuario.get("teléfono") or "No registrado",
                "cargo": a.get("cargo") or "N/A",
                "fechaIn": formatear_fecha(a.get("fecha_ingreso")),
                "admitidoPor": admin_usuario.get("nombre_completo") or "No",
            })
        await registrar_auditoria(request, rol="administrador", status_code=200, id_rol=id_admin)
        return admins_formateados
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": "Error interno del servidor", "code": "INTERNAL_SERVER_ERROR"})
