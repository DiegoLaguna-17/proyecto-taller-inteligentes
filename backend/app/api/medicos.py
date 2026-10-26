import time
from datetime import datetime
from typing import Optional, Any, List
from fastapi import APIRouter, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse
from app.schemas.medicos import ResponderAlertaBody, RegistrarGlucosaMedicoBody
import app.core.supabase as sb
from app.core.security import hash_password
from app.core.audit import registrar_auditoria
from app.core.config import settings
from app.services.ml_client import calcular_riesgo_ml

router = APIRouter(prefix="/api/medicos", tags=["medicos"])

def formatear_fecha(fecha_str: Optional[str]) -> Optional[str]:
    if not fecha_str:
        return None
    partes = str(fecha_str).split("T")[0].split("-")
    if len(partes) == 3:
        return f"{partes[2]}/{partes[1]}/{partes[0]}"
    return fecha_str

def formatear_hora(hora_str: Optional[str]) -> Optional[str]:
    if not hora_str:
        return None
    return str(hora_str)[:5]

@router.post("/registrar")
async def registrar_medico(
    request: Request,
    nombre_completo: Optional[str] = Form(None),
    correo: Optional[str] = Form(None),
    contrasena: Optional[str] = Form(None),
    telefono: Optional[str] = Form(None),
    fecha_nac: Optional[str] = Form(None),
    id_especialidad: Optional[str] = Form(None),
    departamento: Optional[str] = Form(None),
    matriculaProfesional: Optional[UploadFile] = File(None),
    carnetProfesional: Optional[UploadFile] = File(None)
):
    if not matriculaProfesional or not matriculaProfesional.filename:
        return JSONResponse(status_code=400, content={"error": "Archivo de matrícula faltante"})
    if not carnetProfesional or not carnetProfesional.filename:
        return JSONResponse(status_code=400, content={"error": "Archivo de carnet faltante"})

    try:
        now_ts = int(time.time() * 1000)
        pdf_bytes = await matriculaProfesional.read()
        img_bytes = await carnetProfesional.read()

        pdf_path = f"pdfs/{now_ts}_{matriculaProfesional.filename}"
        img_path = f"imgs/{now_ts}_{carnetProfesional.filename}"

        sb.supabase.storage.from_("Matriculas_PDF").upload(
            pdf_path,
            pdf_bytes,
            {"content-type": matriculaProfesional.content_type or "application/pdf"}
        )
        sb.supabase.storage.from_("Carnets_IMG").upload(
            img_path,
            img_bytes,
            {"content-type": carnetProfesional.content_type or "image/jpeg"}
        )

        pdf_url = sb.supabase.storage.from_("Matriculas_PDF").get_public_url(pdf_path)
        img_url = sb.supabase.storage.from_("Carnets_IMG").get_public_url(img_path)

        hashed_pass = hash_password(contrasena)

        res_usr = sb.supabase.from_("usuario").insert([
            {
                "nombre_completo": nombre_completo,
                "correo": correo,
                "contrasena": hashed_pass,
                "rol": "medico",
                "teléfono": telefono,
                "fecha_nac": fecha_nac,
            }
        ]).execute()

        if not res_usr.data or len(res_usr.data) == 0:
            raise Exception("No se pudo crear el usuario")
        usuario = res_usr.data[0]

        res_med = sb.supabase.from_("medico").insert([
            {
                "id_usuario": usuario["id_usuario"],
                "id_especialidad": id_especialidad,
                "matricula_profesional": pdf_url,
                "departamento": departamento,
                "carnet_profesional": img_url,
                "administrador_id_admin": 1,
            }
        ]).execute()

        if not res_med.data or len(res_med.data) == 0:
            raise Exception("No se pudo crear el médico")

        return {
            "mensaje": "Médico registrado correctamente",
            "usuario": usuario,
            "medico": res_med.data[0]
        }
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": str(err)})

@router.get("/ver")
async def ver_medicos():
    try:
        res = sb.supabase.from_("medico").select("id_medico,usuario(nombre_completo)").execute()
        return res.data or []
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": str(err)})

@router.get("/perfil/{idUsuario}")
async def perfil_medico(idUsuario: str, request: Request):
    try:
        id_usuario = int(idUsuario)
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "El ID de usuario debe ser un número válido"})

    try:
        res = sb.supabase.from_("medico").select(
            "id_medico,"
            "matricula_profesional,"
            "departamento,"
            "carnet_profesional,"
            "especialidad("
            "nombre"
            "),"
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
            return JSONResponse(status_code=404, content={"message": "No se encontró el médico"})

        usuario = data.get("usuario") or {}
        admin = data.get("administrador") or {}
        admin_usuario = admin.get("usuario") or {} if isinstance(admin, dict) else {}
        esp = data.get("especialidad") or {}

        medico_formateado = {
            "id": data.get("id_medico"),
            "nombre": usuario.get("nombre_completo") or "Sin nombre",
            "fechaNac": formatear_fecha(usuario.get("fecha_nac")),
            "telefono": usuario.get("teléfono") or "No registrado",
            "correo": usuario.get("correo") or "No registrado",
            "matricula": data.get("matricula_profesional") or "N/A",
            "carnet": data.get("carnet_profesional") or "N/A",
            "especialidad": esp.get("nombre") or "Sin especialidad",
            "departamento": data.get("departamento") or "N/A",
            "admitidoPor": admin_usuario.get("nombre_completo") or "Sistema",
        }

        await registrar_auditoria(request, rol="medico", status_code=200, id_usuario=id_usuario, id_rol=data.get("id_medico"))
        return medico_formateado
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": "Error interno del servidor", "code": "INTERNAL_SERVER_ERROR"})

@router.get("/misPacientes/{idMedico}")
async def ver_pacientes(idMedico: str, request: Request):
    try:
        id_medico = int(idMedico)
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "El ID del médico debe ser un número válido"})

    try:
        res = sb.supabase.from_("paciente").select(
            "id_paciente,"
            "genero,"
            "peso,"
            "altura,"
            "numero_emergencia,"
            "nombre_emergencia,"
            "foto_perfil,"
            "usuario!inner("
            "id_usuario,"
            "nombre_completo,"
            "fecha_nac,"
            "teléfono,"
            "correo,"
            "estado"
            "),"
            "nivel_actividad_fisica("
            "descripcion"
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
            "registro_glucosa("
            "fecha,"
            "hora,"
            "nivel_glucosa,"
            "observaciones,"
            "momento_dia("
            "momento"
            "),"
            "alertas("
            "tipo_alerta("
            "tipo"
            "),"
            "retroalimentacion("
            "mensaje"
            ")"
            ")"
            ")"
        ).eq("id_medico", id_medico).eq("usuario.estado", True).execute()

        data = res.data or []
        pacientes_formateados = []

        for p in data:
            usuario = p.get("usuario") or {}
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
                "foto_perfil": p.get("foto_perfil"),
                "afecciones": afecciones_list,
                "tratamientos": tratamientos_list,
            })

        await registrar_auditoria(request, rol="medico", status_code=200, id_rol=id_medico)
        return pacientes_formateados
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": "Error interno del servidor", "code": "INTERNAL_SERVER_ERROR"})

@router.get("/alertasActivas/{idMedico}")
async def alertas_activas(idMedico: str, request: Request):
    try:
        id_medico = int(idMedico)
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "El ID del médico debe ser un número válido"})

    try:
        res = sb.supabase.from_("alertas").select(
            "id_alerta,"
            "estado,"
            "tipo_alerta!inner("
            "tipo"
            "),"
            "registro_glucosa!inner("
            "fecha,"
            "hora,"
            "nivel_glucosa,"
            "observaciones,"
            "id_medico,"
            "paciente!inner("
            "id_paciente,"
            "usuario!inner("
            "nombre_completo"
            ")"
            "),"
            "momento_dia("
            "momento"
            ")"
            ")"
        ).eq("estado", True).eq("registro_glucosa.id_medico", id_medico).execute()

        data = res.data or []
        alertas_formateadas = []

        for a in data:
            reg = a.get("registro_glucosa") or {}
            pac = reg.get("paciente") or {}
            usr = pac.get("usuario") or {}
            tipo = a.get("tipo_alerta") or {}

            alertas_formateadas.append({
                "id": a.get("id_alerta"),
                "nivel": tipo.get("tipo") or "Desconocido",
                "idpaciente": pac.get("id_paciente"),
                "paciente": usr.get("nombre_completo") or "Sin nombre",
                "fecha": reg.get("fecha"),
                "hora": formatear_hora(reg.get("hora")),
                "glucosa": float(reg["nivel_glucosa"]) if reg.get("nivel_glucosa") is not None else None,
                "momento": reg.get("momento_dia", {}).get("momento") if reg.get("momento_dia") else "",
                "observaciones": reg.get("observaciones") or "",
            })

        await registrar_auditoria(request, rol="medico", status_code=200, id_rol=id_medico)
        return alertas_formateadas
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": "Error interno del servidor", "code": "INTERNAL_SERVER_ERROR"})

@router.get("/alertasResueltas/{idMedico}")
async def alertas_resueltas(idMedico: str, request: Request):
    try:
        id_medico = int(idMedico)
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "El ID del médico debe ser un número válido"})

    try:
        res = sb.supabase.from_("alertas").select(
            "id_alerta,"
            "estado,"
            "tipo_alerta!inner("
            "tipo"
            "),"
            "retroalimentacion("
            "mensaje"
            "),"
            "registro_glucosa!inner("
            "fecha,"
            "hora,"
            "nivel_glucosa,"
            "observaciones,"
            "id_paciente,"
            "id_medico,"
            "paciente("
            "id_paciente,"
            "usuario("
            "nombre_completo"
            ")"
            "),"
            "momento_dia("
            "momento"
            ")"
            ")"
        ).eq("estado", False).eq("registro_glucosa.id_medico", id_medico).execute()

        data = res.data or []
        alertas_formateadas = []

        for a in data:
            retro = a.get("retroalimentacion")
            if isinstance(retro, list):
                retro = retro[0] if len(retro) > 0 else None
            mensaje = retro.get("mensaje") if retro else ""

            reg = a.get("registro_glucosa") or {}
            pac = reg.get("paciente") or {}
            usr = pac.get("usuario") or {}
            tipo = a.get("tipo_alerta") or {}

            alertas_formateadas.append({
                "id": a.get("id_alerta"),
                "nivel": tipo.get("tipo") or "Desconocido",
                "idpaciente": pac.get("id_paciente") or reg.get("id_paciente"),
                "paciente": usr.get("nombre_completo") or "",
                "fecha": reg.get("fecha"),
                "hora": formatear_hora(reg.get("hora")),
                "glucosa": float(reg["nivel_glucosa"]) if reg.get("nivel_glucosa") is not None else None,
                "momento": reg.get("momento_dia", {}).get("momento") if reg.get("momento_dia") else "",
                "observaciones": reg.get("observaciones") or "",
                "mensaje": mensaje or "",
            })

        await registrar_auditoria(request, rol="medico", status_code=200, id_rol=id_medico)
        return alertas_formateadas
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": "Error interno del servidor", "code": "INTERNAL_SERVER_ERROR"})

@router.post("/responder/alerta")
async def retroalimentacion_alerta(req_body: ResponderAlertaBody, request: Request):
    if (
        not req_body.id_medico
        or not req_body.fecha_registro
        or not req_body.mensaje
        or not req_body.alertas_id_alerta
    ):
        await registrar_auditoria(request, rol="medico", status_code=400)
        return JSONResponse(status_code=400, content={"error": "Todos los campos son requeridos"})

    try:
        res_retro = sb.supabase.from_("retroalimentacion").insert([
            {
                "id_medico": req_body.id_medico,
                "fecha_registro": req_body.fecha_registro,
                "mensaje": req_body.mensaje,
                "alertas_id_alerta": req_body.alertas_id_alerta,
            }
        ]).execute()

        res_upd = sb.supabase.from_("alertas").update({"estado": False}).eq("id_alerta", req_body.alertas_id_alerta).execute()

        await registrar_auditoria(request, rol="medico", status_code=200, id_rol=req_body.id_medico)
        return {
            "message": "Alerta respondida y actualizada correctamente",
            "retroalimentacion": res_retro.data,
            "alerta_actualizada": res_upd.data,
        }
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": str(err)})

@router.post("/registrar/glucosa")
async def registrar_glucosa_medico(req_body: RegistrarGlucosaMedicoBody, request: Request):
    if (
        not req_body.fecha
        or not req_body.hora
        or not req_body.id_medico
        or not req_body.id_momento
        or not req_body.id_paciente
        or req_body.nivel_glucosa is None
    ):
        await registrar_auditoria(request, rol="medico", status_code=400)
        return JSONResponse(
            status_code=400,
            content={"error": "Todos los campos (menos observaciones) deben estar llenados"}
        )

    try:
        res = sb.supabase.from_("registro_glucosa").insert([
            {
                "id_paciente": req_body.id_paciente,
                "id_medico": req_body.id_medico,
                "id_momento": req_body.id_momento,
                "fecha": req_body.fecha,
                "hora": req_body.hora,
                "nivel_glucosa": req_body.nivel_glucosa,
                "observaciones": req_body.observaciones,
            }
        ]).execute()

        if not res.data or len(res.data) == 0:
            raise Exception("No se pudo insertar el registro")

        registro_glucosa = res.data[0]
        id_reg = registro_glucosa.get("id") or registro_glucosa.get("id_registro")

        await registrar_auditoria(request, rol="medico", status_code=200, id_rol=req_body.id_medico)
        respuesta = {
            "message": "Registro insertado correctamente",
            "id_registro": id_reg,
            "registro_glucosa": registro_glucosa,
        }
        # Riesgo informativo del ML (ADR-0011): la lectura YA está guardada; calcular_riesgo_ml nunca lanza y
        # con ML_ENABLED=false la respuesta es exactamente la de siempre (sin la clave `riesgo_ml`).
        if settings.ML_ENABLED:
            respuesta["riesgo_ml"] = await calcular_riesgo_ml(
                req_body.id_paciente, req_body.nivel_glucosa, req_body.id_momento, req_body.fecha
            )
        return respuesta
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": str(err)})

@router.put("/actualizar/{id_medico}")
async def actualizar_medico(
    id_medico: str,
    request: Request,
    telefono: Optional[str] = Form(None),
    correo: Optional[str] = Form(None),
    departamento: Optional[str] = Form(None),
    carnet: Optional[UploadFile] = File(None)
):
    try:
        res_med = sb.supabase.from_("medico").select("id_usuario").eq("id_medico", id_medico).single().execute()
        if not res_med.data:
            return JSONResponse(status_code=404, content={"message": "Médico no encontrado"})

        id_usuario = res_med.data["id_usuario"]
        usuario_updates = {}
        if telefono is not None:
            usuario_updates["teléfono"] = telefono
        if correo is not None:
            usuario_updates["correo"] = correo

        medico_updates = {}
        if departamento is not None:
            medico_updates["departamento"] = departamento

        if carnet and carnet.filename:
            file_bytes = await carnet.read()
            ext = carnet.filename.split(".")[-1]
            filename = f"carnet-{id_usuario}-{int(time.time() * 1000)}.{ext}"
            res_upload = sb.supabase.storage.from_("Carnets_IMG").upload(
                filename,
                file_bytes,
                {"content-type": carnet.content_type or "image/jpeg", "upsert": "true"}
            )
            url_res = sb.supabase.storage.from_("Carnets_IMG").get_public_url(filename)
            medico_updates["carnet_profesional"] = url_res

        if usuario_updates:
            sb.supabase.from_("usuario").update(usuario_updates).eq("id_usuario", id_usuario).execute()

        if medico_updates:
            sb.supabase.from_("medico").update(medico_updates).eq("id_medico", id_medico).execute()

        await registrar_auditoria(request, rol="medico", status_code=200, id_usuario=id_usuario, id_rol=id_medico)
        return {
            "message": "Datos actualizados correctamente",
            "carnet_url": medico_updates.get("carnet_profesional") or "No se actualizó el carnet",
        }
    except Exception as err:
        err_msg = str(err)
        if "No rows found" in err_msg or "PGRST116" in err_msg:
            return JSONResponse(status_code=404, content={"message": "Médico no encontrado"})
        return JSONResponse(status_code=500, content={"message": "Error al actualizar los datos", "error": str(err)})
