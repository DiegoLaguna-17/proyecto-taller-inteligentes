from fastapi import APIRouter
from fastapi.responses import JSONResponse
import app.core.supabase as sb

router = APIRouter(prefix="/api/general", tags=["general"])

@router.get("/momentos")
async def ver_momentos():
    try:
        res = sb.supabase.from_("momento_dia").select("id_momento, momento").execute()
        return res.data or []
    except Exception as error:
        print("Error al obtener momentos:", error)
        return JSONResponse(status_code=500, content={"error": "Error al obtener momentos"})

@router.get("/niveles")
async def ver_niveles():
    try:
        res = sb.supabase.from_("nivel_actividad_fisica").select("id_nivel_actividad, descripcion").execute()
        return res.data or []
    except Exception as error:
        print("Error al obtener niveles de actividad:", error)
        return JSONResponse(status_code=500, content={"error": "Error al obtener actividades"})

@router.get("/enfermedades")
async def ver_enfermedades():
    try:
        res = sb.supabase.from_("enfermedades_base").select("id_enfermedad, nombre_enfermedad").execute()
        return res.data or []
    except Exception as error:
        print("Error al obtener enfermedades:", error)
        return JSONResponse(status_code=500, content={"error": "Error al obtener enfermedades"})

@router.get("/tratamientos")
async def ver_tratamientos():
    try:
        res = sb.supabase.from_("tratamientos").select("id_tratamiento, nombre_tratamiento, descripcion").execute()
        return res.data or []
    except Exception as error:
        print("Error al obtener tratamientos:", error)
        return JSONResponse(status_code=500, content={"error": "Error al obtener tratamientos"})

@router.get("/especialidades")
async def ver_especialidades():
    try:
        res = sb.supabase.from_("especialidad").select("id_especialidad, nombre").execute()
        return res.data or []
    except Exception as error:
        print("Error al obtener tratamientos:", error)
        return JSONResponse(status_code=500, content={"error": "Error al obtener tratamientos"})

@router.get("/auditoria")
async def ver_auditoria():
    try:
        res = sb.supabase.from_("auditoria_endpoints").select("*, usuario(nombre_completo)").execute()
        return res.data or []
    except Exception as error:
        print("Error obteniendo auditoría:", error)
        return JSONResponse(
            status_code=500,
            content={"message": "Error obteniendo auditoría", "error": str(error)}
        )
