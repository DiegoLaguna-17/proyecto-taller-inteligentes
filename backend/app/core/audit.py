from typing import Optional, Any
from fastapi import Request
import app.core.supabase as sb

async def registrar_auditoria(
    request: Request,
    rol: str,
    status_code: int,
    id_usuario: Optional[Any] = None,
    id_rol: Optional[Any] = None,
    body_data: Optional[dict] = None
):
    if not sb.supabase:
        return

    try:
        url_path = request.url.path
        method = request.method
        client_host = request.client.host if request.client else "127.0.0.1"

        if not id_usuario:
            id_usuario = (
                request.path_params.get("id_usuario")
                or request.path_params.get("idUsuario")
                or request.query_params.get("id_usuario")
                or (body_data.get("id_usuario") if isinstance(body_data, dict) else None)
            )

        if not id_rol:
            if rol == "medico":
                id_rol = (
                    request.path_params.get("idMedico")
                    or request.path_params.get("id_medico")
                    or request.query_params.get("idMedico")
                    or (body_data.get("idMedico") if isinstance(body_data, dict) else None)
                    or (body_data.get("id_medico") if isinstance(body_data, dict) else None)
                )
            elif rol == "paciente":
                id_rol = (
                    request.path_params.get("idPaciente")
                    or request.path_params.get("id_paciente")
                    or request.query_params.get("idPaciente")
                    or (body_data.get("idPaciente") if isinstance(body_data, dict) else None)
                    or (body_data.get("id_paciente") if isinstance(body_data, dict) else None)
                )
            elif rol == "administrador":
                id_rol = (
                    request.path_params.get("idAdmin")
                    or request.query_params.get("idAdmin")
                    or (body_data.get("idAdmin") if isinstance(body_data, dict) else None)
                    or (body_data.get("administrador_id_admin") if isinstance(body_data, dict) else None)
                )

        if not id_usuario and id_rol:
            table_name = rol
            pk_name = "id_admin" if rol == "administrador" else f"id_{rol}"
            res = sb.supabase.from_(table_name).select("id_usuario").eq(pk_name, id_rol).maybe_single().execute()
            if res.data:
                id_usuario = res.data.get("id_usuario")

        if not id_rol and id_usuario and rol in ["medico", "paciente", "administrador"]:
            table_name = rol
            pk_name = "id_admin" if rol == "administrador" else f"id_{rol}"
            res = sb.supabase.from_(table_name).select(pk_name).eq("id_usuario", id_usuario).maybe_single().execute()
            if res.data:
                id_rol = res.data.get(pk_name)

        try:
            if id_usuario is not None:
                id_usuario = int(id_usuario)
        except Exception:
            pass
        try:
            if id_rol is not None:
                id_rol = int(id_rol)
        except Exception:
            pass

        exito = status_code < 400

        sb.supabase.from_("auditoria_endpoints").insert([
            {
                "id_usuario": id_usuario,
                "rol": rol,
                "id_rol": id_rol,
                "endpoint": url_path,
                "operacion": method,
                "exito": exito,
                "codigo_http": status_code,
                "ip_origen": client_host
            }
        ]).execute()
    except Exception as err:
        pass
