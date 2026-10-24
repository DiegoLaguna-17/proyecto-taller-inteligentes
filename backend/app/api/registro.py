from datetime import datetime
from typing import Optional, Any
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from app.schemas.registro import RegistrarAlertaRequest
import app.core.supabase as sb
from app.core.audit import registrar_auditoria
from app.services.email_service import EmailService, get_hipo_template, get_hiper_template

router = APIRouter(prefix="/api/registro", tags=["registro"])

def calcular_edad(fecha_nacimiento: Optional[str]) -> Optional[int]:
    if not fecha_nacimiento:
        return None
    try:
        # Permite formato YYYY-MM-DD
        fecha_nac = datetime.strptime(str(fecha_nacimiento)[:10], "%Y-%m-%d")
        hoy = datetime.now()
        edad = hoy.year - fecha_nac.year
        if (hoy.month, hoy.day) < (fecha_nac.month, fecha_nac.day):
            edad -= 1
        return edad
    except Exception:
        return None

@router.get("/datosGlucosa/{idUsuario}")
async def datos_para_glucosa(idUsuario: str, request: Request):
    try:
        id_paciente = int(idUsuario)
    except (ValueError, TypeError):
        return JSONResponse(
            status_code=400,
            content={"error": "El ID del paciente debe ser un número válido"}
        )

    try:
        res = sb.supabase.from_("paciente").select(
            """
            id_paciente,
            embarazo,
            id_medico,
            usuario!inner (
                fecha_nac
            ),
            paciente_enfermedad (
                enfermedades_base (
                    nombre_enfermedad
                )
            )
            """
        ).eq("id_paciente", id_paciente).maybe_single().execute()

        data = res.data
        if not data:
            return JSONResponse(
                status_code=404,
                content={"message": "No se encontraron datos para este paciente"}
            )

        usuario_obj = data.get("usuario") or {}
        fecha_nac = usuario_obj.get("fecha_nac")
        edad = calcular_edad(fecha_nac)

        enfermedades_list = []
        for pe in data.get("paciente_enfermedad") or []:
            eb = pe.get("enfermedades_base")
            if eb and eb.get("nombre_enfermedad"):
                enfermedades_list.append(eb["nombre_enfermedad"])

        datos_glucosa = {
            "edad": edad,
            "embarazo": bool(data.get("embarazo")),
            "id_medico": data.get("id_medico"),
            "id_paciente": data.get("id_paciente"),
            "enfermedades": enfermedades_list,
        }
        return datos_glucosa
    except Exception as err:
        return JSONResponse(
            status_code=500,
            content={"error": "Error al consultar los datos del paciente", "code": "DB_QUERY_ERROR"}
        )

@router.post("/registrarAlerta")
async def registrar_alerta(req_body: RegistrarAlertaRequest, request: Request):
    id_tipo_alerta = req_body.id_tipo_alerta
    id_registro = req_body.id_registro
    id_medico = req_body.id_medico
    fecha_alerta = req_body.fecha_alerta

    if not id_tipo_alerta or not id_registro or not id_medico or not fecha_alerta:
        await registrar_auditoria(request, rol="paciente", status_code=400)
        return JSONResponse(
            status_code=400,
            content={"error": "Todos los campos son requeridos"}
        )

    try:
        # 1. Insertar alerta
        res_alerta = sb.supabase.from_("alertas").insert([
            {
                "id_tipo_alerta": id_tipo_alerta,
                "id_registro": id_registro,
                "id_medico": id_medico,
                "fecha_alerta": fecha_alerta,
            }
        ]).select().execute()

        if not res_alerta.data or len(res_alerta.data) == 0:
            raise Exception("No se pudo insertar la alerta")

        alerta_insertada = res_alerta.data[0]

        # 2. Obtener datos para correo
        res_registro = sb.supabase.from_("registro_glucosa") \
            .select("id_paciente, nivel_glucosa, fecha, hora, observaciones") \
            .eq("id_registro", id_registro) \
            .single() \
            .execute()
        registro = res_registro.data
        if not registro:
            raise Exception("Registro de glucosa no encontrado")

        res_paciente = sb.supabase.from_("paciente") \
            .select("id_usuario, id_medico") \
            .eq("id_paciente", registro["id_paciente"]) \
            .single() \
            .execute()
        paciente = res_paciente.data
        if not paciente:
            raise Exception("Paciente no encontrado")

        res_medico = sb.supabase.from_("medico") \
            .select("id_usuario") \
            .eq("id_medico", paciente["id_medico"]) \
            .single() \
            .execute()
        medico = res_medico.data
        if not medico:
            raise Exception("Médico asignado no encontrado")

        res_usr_medico = sb.supabase.from_("usuario") \
            .select("correo, nombre_completo") \
            .eq("id_usuario", medico["id_usuario"]) \
            .single() \
            .execute()
        usr_medico = res_usr_medico.data
        if not usr_medico:
            raise Exception("Usuario del médico no encontrado")

        res_usr_paciente = sb.supabase.from_("usuario") \
            .select("nombre_completo") \
            .eq("id_usuario", paciente["id_usuario"]) \
            .single() \
            .execute()
        usr_paciente = res_usr_paciente.data
        if not usr_paciente:
            raise Exception("Usuario del paciente no encontrado")

        datos_correo = {
            "nombrePaciente": usr_paciente.get("nombre_completo"),
            "valor": registro.get("nivel_glucosa"),
            "fecha": registro.get("fecha"),
            "hora": registro.get("hora"),
            "nombreMedico": usr_medico.get("nombre_completo"),
            "observaciones": registro.get("observaciones"),
        }

        template = get_hipo_template(datos_correo) if id_tipo_alerta == 1 else get_hiper_template(datos_correo)
        await EmailService.send_email(usr_medico["correo"], template["subject"], template["html"])

        await registrar_auditoria(
            request,
            rol="paciente",
            status_code=200,
            id_usuario=paciente.get("id_usuario"),
            id_rol=registro.get("id_paciente")
        )

        return {
            "message": "Alerta registrada y correo enviado correctamente",
            "alerta": alerta_insertada,
        }
    except Exception as err:
        await registrar_auditoria(request, rol="paciente", status_code=500)
        return JSONResponse(status_code=500, content={"error": str(err)})
