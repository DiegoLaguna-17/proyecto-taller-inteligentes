import time
from datetime import datetime, timezone
from typing import Optional, Any, List
from fastapi import APIRouter, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse
from app.schemas.pacientes import RegistrarGlucosaBody, ActualizarPacienteBody
import app.core.supabase as sb
from app.core.security import hash_password
from app.core.audit import registrar_auditoria

router = APIRouter(prefix="/api/pacientes", tags=["pacientes"])

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

@router.post("/registrarPaciente")
async def registrar_paciente(
    request: Request,
    nombre_completo: Optional[str] = Form(None),
    correo: Optional[str] = Form(None),
    contrasena: Optional[str] = Form(None),
    rol: Optional[str] = Form(None),
    fecha_nac: Optional[str] = Form(None),
    id_medico: Optional[str] = Form(None),
    id_actividad: Optional[str] = Form(None),
    genero: Optional[str] = Form(None),
    peso: Optional[str] = Form(None),
    altura: Optional[str] = Form(None),
    enfermedad_id: Optional[str] = Form(None),
    tratamiento_id: Optional[str] = Form(None),
    dosis_: Optional[str] = Form(None),
    nombre_emergencia: Optional[str] = Form(None),
    numero_emergencia: Optional[str] = Form(None),
    embarazada: Optional[str] = Form(None),
    semanas: Optional[str] = Form(None),
    foto_perfil: Optional[UploadFile] = File(None)
):
    form_data = await request.form()
    telefono = form_data.get("teléfono") or form_data.get("telÃ©fono") or form_data.get("telefono")

    if not foto_perfil or not foto_perfil.filename:
        return JSONResponse(status_code=400, content={"error": "Archivo de perfil faltante"})

    try:
        file_bytes = await foto_perfil.read()
        filename = f"imgs/{int(time.time() * 1000)}_{foto_perfil.filename}"
        res_upload = sb.supabase.storage.from_("perfiles_pacientes").upload(
            filename,
            file_bytes,
            {"content-type": foto_perfil.content_type or "image/jpeg"}
        )
        img_url = sb.supabase.storage.from_("perfiles_pacientes").get_public_url(filename)
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": str(err)})

    if (
        not nombre_completo
        or not correo
        or not contrasena
        or not rol
        or not fecha_nac
        or not telefono
        or not id_medico
        or not id_actividad
        or not genero
        or not peso
        or not altura
        or not enfermedad_id
        or not tratamiento_id
        or not dosis_
        or not nombre_emergencia
        or not numero_emergencia
        or not img_url
    ):
        return JSONResponse(status_code=400, content={"error": "Todos los campos obligatorios deben ser llenados"})

    try:
        id_medico_int = int(id_medico)
        id_actividad_int = int(id_actividad)
        enfermedad_id_int = int(enfermedad_id)
        tratamiento_id_int = int(tratamiento_id)
        peso_num = float(peso)
        altura_num = float(altura)
        embarazada_bool = str(embarazada).lower() == "true"
        semanas_int = int(semanas) if semanas else None

        hashed_pass = hash_password(contrasena)

        res_usr = sb.supabase.from_("usuario").insert([
            {
                "nombre_completo": nombre_completo,
                "correo": correo,
                "contrasena": hashed_pass,
                "rol": rol,
                "fecha_nac": fecha_nac,
                "teléfono": telefono,
            }
        ]).execute()

        if not res_usr.data or len(res_usr.data) == 0:
            raise Exception("No se pudo insertar el usuario")
        usuario_insertado = res_usr.data[0]

        res_pac = sb.supabase.from_("paciente").insert([
            {
                "id_usuario": usuario_insertado["id_usuario"],
                "id_medico": id_medico_int,
                "id_nivel_actividad": id_actividad_int,
                "genero": genero,
                "peso": peso_num,
                "altura": altura_num,
                "embarazo": embarazada_bool,
                "nombre_emergencia": nombre_emergencia,
                "numero_emergencia": numero_emergencia,
                "foto_perfil": img_url,
            }
        ]).execute()

        if not res_pac.data or len(res_pac.data) == 0:
            raise Exception("No se pudo insertar el paciente")
        paciente = res_pac.data[0]

        if embarazada_bool and semanas_int is not None:
            sb.supabase.from_("seguimiento_embarazo").insert({
                "id_paciente": paciente["id_paciente"],
                "fecha_registro": usuario_insertado.get("fecha_registro"),
                "semanas_embarazo": semanas_int,
            }).execute()

        sb.supabase.from_("tratamiento_enfermedad").insert({
            "id_paciente": paciente["id_paciente"],
            "id_tratamiento": tratamiento_id_int,
            "dosis": dosis_,
        }).execute()

        sb.supabase.from_("paciente_enfermedad").insert({
            "id_paciente": paciente["id_paciente"],
            "id_enfermedad": enfermedad_id_int,
        }).execute()

        return {
            "message": "Usuario y paciente registrados correctamente",
            "usuario_insertado": usuario_insertado,
            "paciente": paciente,
        }
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": str(err)})

@router.get("/perfil/{idPaciente}")
async def perfil_paciente(idPaciente: str, request: Request):
    try:
        id_paciente = int(idPaciente)
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "El ID del paciente debe ser un número válido"})

    try:
        res = sb.supabase.from_("paciente").select(
            "id_paciente,"
            "genero,"
            "altura,"
            "peso,"
            "embarazo,"
            "nombre_emergencia,"
            "numero_emergencia,"
            "foto_perfil,"
            "usuario!inner("
            "id_usuario,"
            "nombre_completo,"
            "fecha_nac,"
            "teléfono,"
            "correo,"
            "fecha_registro"
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
            "fecha_registro,"
            "fecha_terminacion"
            ")"
        ).eq("id_paciente", id_paciente).maybe_single().execute()

        data = res.data
        if not data:
            return JSONResponse(status_code=404, content={"message": "No se encontró el paciente solicitado"})

        usuario = data.get("usuario") or {}
        medico = data.get("medico") or {}
        medico_usuario = medico.get("usuario") or {} if isinstance(medico, dict) else {}
        admin = data.get("administrador") or {}
        admin_usuario = admin.get("usuario") or {} if isinstance(admin, dict) else {}

        afecciones_list = []
        for pe in data.get("paciente_enfermedad") or []:
            eb = pe.get("enfermedades_base")
            if eb and eb.get("nombre_enfermedad"):
                afecciones_list.append(eb["nombre_enfermedad"])

        tratamientos_list = []
        for te in data.get("tratamiento_enfermedad") or []:
            t = te.get("tratamientos") or {}
            tratamientos_list.append({
                "titulo": t.get("nombre_tratamiento") or "",
                "descripcion": t.get("descripcion") or "",
                "dosis": str(te.get("dosis")) if te.get("dosis") is not None else None,
            })

        semanas_embarazo_actual = None
        fecha_registro_embarazo = None

        if data.get("embarazo") and data.get("seguimiento_embarazo"):
            seguimientos = list(data["seguimiento_embarazo"])
            def sort_key(item):
                activo = 0 if item.get("fecha_terminacion") is None else 1
                return (activo, -(datetime.fromisoformat(item["fecha_registro"]).timestamp() if item.get("fecha_registro") else 0))
            try:
                seguimientos.sort(key=sort_key)
                embarazo_principal = seguimientos[0]
                semanas_embarazo_actual = embarazo_principal.get("semanas_embarazo")
                fecha_registro_embarazo = embarazo_principal.get("fecha_registro")
            except Exception:
                pass

        paciente_formateado = {
            "nombre": usuario.get("nombre_completo") or "Sin nombre",
            "id": str(usuario.get("id_usuario")) if usuario.get("id_usuario") is not None else None,
            "fechaNac": formatear_fecha(usuario.get("fecha_nac")),
            "genero": data.get("genero"),
            "altura": data.get("altura"),
            "peso": data.get("peso"),
            "telefono": usuario.get("teléfono"),
            "correo": usuario.get("correo"),
            "nombre_emergencia": data.get("nombre_emergencia"),
            "numero_emergencia": data.get("numero_emergencia"),
            "foto_perfil": data.get("foto_perfil"),
            "nombre_medico": medico_usuario.get("nombre_completo"),
            "fecha_registro": usuario.get("fecha_registro"),
            "admitidoPor": admin_usuario.get("nombre_completo"),
            "actividadFisica": {
                "nivel": data.get("nivel_actividad_fisica", {}).get("descripcion") if data.get("nivel_actividad_fisica") else None,
                "descripcion": data.get("nivel_actividad_fisica", {}).get("descripcion") if data.get("nivel_actividad_fisica") else None,
            },
            "afecciones": afecciones_list,
            "tratamientos": tratamientos_list,
            "embarazo": bool(data.get("embarazo")),
            "semanas_embarazo": semanas_embarazo_actual,
            "registro_embarazo": fecha_registro_embarazo,
        }

        await registrar_auditoria(request, rol="paciente", status_code=200, id_usuario=usuario.get("id_usuario"), id_rol=id_paciente)
        return paciente_formateado
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": "Error interno del servidor", "code": "INTERNAL_SERVER_ERROR"})

@router.get("/registros/{idPaciente}")
async def registros_paciente(idPaciente: str, request: Request):
    try:
        id_paciente = int(idPaciente)
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "El ID del paciente debe ser un número válido"})

    try:
        res = sb.supabase.from_("registro_glucosa").select(
            "id_registro,"
            "fecha,"
            "hora,"
            "nivel_glucosa,"
            "observaciones,"
            "momento_dia("
            "momento"
            "),"
            "medico("
            "usuario("
            "nombre_completo"
            ")"
            "),"
            "alertas("
            "id_alerta,"
            "tipo_alerta("
            "tipo"
            "),"
            "retroalimentacion("
            "mensaje"
            ")"
            ")"
        ).eq("id_paciente", id_paciente).order("fecha", desc=True).order("hora", desc=True).execute()

        data = res.data or []
        registros_formateados = []

        for r in data:
            alerta = r.get("alertas")
            if isinstance(alerta, list):
                alerta = alerta[0] if len(alerta) > 0 else None

            tipo_alerta = None
            retro = None
            if alerta:
                tipo_obj = alerta.get("tipo_alerta")
                if isinstance(tipo_obj, list):
                    tipo_obj = tipo_obj[0] if len(tipo_obj) > 0 else None
                tipo_alerta = tipo_obj.get("tipo") if tipo_obj else None

                retro_obj = alerta.get("retroalimentacion")
                if isinstance(retro_obj, list):
                    retro_obj = retro_obj[0] if len(retro_obj) > 0 else None
                retro = retro_obj.get("mensaje") if retro_obj else None

            medico = r.get("medico") or {}
            medico_usuario = medico.get("usuario") or {} if isinstance(medico, dict) else {}

            registros_formateados.append({
                "id": r.get("id_registro"),
                "fecha": r.get("fecha"),
                "hora": formatear_hora(r.get("hora")),
                "nivelGlucosa": float(r["nivel_glucosa"]) if r.get("nivel_glucosa") is not None else None,
                "momentoDia": r.get("momento_dia", {}).get("momento") if r.get("momento_dia") else None,
                "quienTomoMuestra": medico_usuario.get("nombre_completo"),
                "observaciones": r.get("observaciones"),
                "idAlerta": alerta.get("id_alerta") if alerta else None,
                "tipo_alerta": tipo_alerta,
                "placeholderRetro": None,
                "respuesta": retro,
            })

        await registrar_auditoria(request, rol="paciente", status_code=200, id_rol=id_paciente)
        return registros_formateados
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": "Error interno del servidor", "code": "INTERNAL_SERVER_ERROR"})

@router.post("/registrarGlucosa")
async def registrar_glucosa(req_body: RegistrarGlucosaBody, request: Request):
    if (
        not req_body.fecha
        or not req_body.hora
        or not req_body.id_momento
        or not req_body.id_paciente
        or req_body.nivel_glucosa is None
    ):
        await registrar_auditoria(request, rol="paciente", status_code=400)
        return JSONResponse(
            status_code=400,
            content={"error": "Todos los campos (menos observaciones) deben estar llenados"}
        )

    try:
        res = sb.supabase.from_("registro_glucosa").insert([
            {
                "id_paciente": req_body.id_paciente,
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

        await registrar_auditoria(
            request,
            rol="paciente",
            status_code=200,
            id_rol=req_body.id_paciente
        )

        return {
            "message": "Registro insertado correctamente",
            "id_registro": id_reg,
            "registro_glucosa": registro_glucosa,
        }
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": str(err)})

@router.put("/actualizarPaciente/{id_usuario}")
async def actualizar_paciente(id_usuario: str, req_body: ActualizarPacienteBody, request: Request):
    try:
        id_usr = int(id_usuario)
    except (ValueError, TypeError):
        id_usr = id_usuario

    if (
        not req_body.nombre
        or req_body.altura is None
        or not req_body.peso
        or not req_body.telefono
        or not req_body.correo
        or not req_body.nombre_emergencia
        or not req_body.numero_emergencia
    ):
        await registrar_auditoria(request, rol="paciente", status_code=400, id_usuario=id_usr)
        return JSONResponse(status_code=400, content={"error": "Faltan datos obligatorios"})

    try:
        res_pac = sb.supabase.from_("paciente").select("id_paciente").eq("id_usuario", id_usr).single().execute()
        if not res_pac.data:
            return JSONResponse(status_code=404, content={"error": "Paciente no encontrado"})

        id_paciente = res_pac.data["id_paciente"]

        res_usr = sb.supabase.from_("usuario").update({
            "nombre_completo": req_body.nombre,
            "correo": req_body.correo,
            "teléfono": req_body.telefono,
        }).eq("id_usuario", id_usr).execute()

        update_paciente_data = {
            "altura": req_body.altura,
            "peso": float(req_body.peso),
            "nombre_emergencia": req_body.nombre_emergencia,
            "numero_emergencia": req_body.numero_emergencia,
        }
        if req_body.embarazo is not None:
            update_paciente_data["embarazo"] = req_body.embarazo

        res_pac_upd = sb.supabase.from_("paciente").update(update_paciente_data).eq("id_usuario", id_usr).execute()

        if req_body.embarazo is True and req_body.semanas_embarazo and int(req_body.semanas_embarazo) > 0:
            sb.supabase.from_("seguimiento_embarazo").insert({
                "id_paciente": id_paciente,
                "fecha_registro": datetime.now().isoformat().split("T")[0],
                "semanas_embarazo": int(req_body.semanas_embarazo),
                "fecha_terminacion": None,
            }).execute()
        elif req_body.embarazo is False and req_body.fecha_terminacion:
            res_seg = sb.supabase.from_("seguimiento_embarazo") \
                .select("id_seguimiento") \
                .eq("id_paciente", id_paciente) \
                .is_("fecha_terminacion", "null") \
                .order("fecha_registro", desc=True) \
                .limit(1) \
                .execute()
            if res_seg.data and len(res_seg.data) > 0:
                id_seg = res_seg.data[0]["id_seguimiento"]
                sb.supabase.from_("seguimiento_embarazo").update({
                    "fecha_terminacion": req_body.fecha_terminacion
                }).eq("id_seguimiento", id_seg).execute()

        await registrar_auditoria(request, rol="paciente", status_code=200, id_usuario=id_usr, id_rol=id_paciente)
        return {
            "usuario": res_usr.data[0] if res_usr.data else None,
            "paciente": res_pac_upd.data[0] if res_pac_upd.data else None,
        }
    except Exception as err:
        err_msg = str(err)
        if "No rows found" in err_msg or "PGRST116" in err_msg:
            return JSONResponse(status_code=404, content={"error": "Paciente no encontrado"})
        return JSONResponse(status_code=500, content={"error": "Error al actualizar paciente", "details": str(err)})

@router.get("/obtenerDatosEmbarazo/{id_paciente}")
async def obtener_semanas_embarazo_actual(id_paciente: str):
    try:
        res_pac = sb.supabase.from_("paciente").select("embarazo").eq("id_paciente", id_paciente).single().execute()
        if not res_pac.data:
            return {"semanas_actuales": None}

        if res_pac.data.get("embarazo") is True:
            res_emb = sb.supabase.from_("seguimiento_embarazo") \
                .select("fecha_registro, semanas_embarazo") \
                .eq("id_paciente", id_paciente) \
                .is_("fecha_terminacion", "null") \
                .order("fecha_registro", desc=True) \
                .limit(1) \
                .execute()

            if not res_emb.data or len(res_emb.data) == 0:
                return {"semanas_actuales": None}

            registro = res_emb.data[0]
            fecha_registro = datetime.strptime(str(registro["fecha_registro"])[:10], "%Y-%m-%d")
            semanas_iniciales = int(registro.get("semanas_embarazo") or 0)
            hoy = datetime.now()
            dias = (hoy - fecha_registro).days
            semanas_actuales = semanas_iniciales + (dias // 7)
            return {"semanas_actuales": semanas_actuales}
        else:
            return {"semanas_actuales": None}
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": "Error al obtener semanas de embarazo"})
