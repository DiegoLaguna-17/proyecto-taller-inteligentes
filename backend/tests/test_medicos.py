import io
from tests.conftest import MockQueryBuilder

def test_registrar_medico_falta_matricula(client):
    data = {
        "nombre_completo": "Dr. House",
        "correo": "house@hospital.com",
        "contrasena": "vicodin123",
        "telefono": "77712345",
        "fecha_nac": "1970-01-01",
        "id_especialidad": "1",
        "departamento": "La Paz",
    }
    files = {
        "carnetProfesional": ("carnet.jpg", io.BytesIO(b"fake image"), "image/jpeg")
    }
    resp = client.post("/api/medicos/registrar", data=data, files=files)
    assert resp.status_code == 400
    assert resp.json()["error"] == "Archivo de matrícula faltante"


def test_registrar_medico_falta_carnet(client):
    data = {
        "nombre_completo": "Dr. House",
        "correo": "house@hospital.com",
        "contrasena": "vicodin123",
        "telefono": "77712345",
        "fecha_nac": "1970-01-01",
        "id_especialidad": "1",
        "departamento": "La Paz",
    }
    files = {
        "matriculaProfesional": ("matricula.pdf", io.BytesIO(b"fake pdf"), "application/pdf")
    }
    resp = client.post("/api/medicos/registrar", data=data, files=files)
    assert resp.status_code == 400
    assert resp.json()["error"] == "Archivo de carnet faltante"


def test_ver_medicos_exitoso(client, mock_supabase):
    medicos_mock = [
        {"id_medico": 1, "usuario": {"nombre_completo": "Dr. Strange"}},
        {"id_medico": 2, "usuario": {"nombre_completo": "Dr. Who"}}
    ]
    mock_supabase.set_table_mock("medico", MockQueryBuilder(data=medicos_mock))
    resp = client.get("/api/medicos/ver")
    assert resp.status_code == 200
    assert len(resp.json()) == 2
    assert resp.json()[0]["id_medico"] == 1


def test_ver_medicos_error(client, mock_supabase):
    mock_supabase.set_table_mock("medico", MockQueryBuilder(error=Exception("Database error")))
    resp = client.get("/api/medicos/ver")
    assert resp.status_code == 500


def test_perfil_medico_id_invalido(client):
    resp = client.get("/api/medicos/perfil/abc")
    assert resp.status_code == 400
    assert resp.json()["error"] == "El ID de usuario debe ser un número válido"


def test_perfil_medico_no_encontrado(client, mock_supabase):
    mock_supabase.set_table_mock("medico", MockQueryBuilder(data=None))
    resp = client.get("/api/medicos/perfil/999")
    assert resp.status_code == 404
    assert resp.json()["message"] == "No se encontró el médico"


def test_perfil_medico_exitoso(client, mock_supabase):
    medico_data = {
        "id_medico": 4,
        "matricula_profesional": "https://url.com/pdf",
        "departamento": "Santa Cruz",
        "carnet_profesional": "https://url.com/carnet",
        "especialidad": {"nombre": "Endocrinología"},
        "usuario": {
            "nombre_completo": "Dr. Juan Perez",
            "correo": "juan@hospital.com",
            "fecha_nac": "1980-05-15",
            "teléfono": "71234567"
        },
        "administrador": {
            "usuario": {"nombre_completo": "Admin Root"}
        }
    }
    mock_supabase.set_table_mock("medico", MockQueryBuilder(data=medico_data))
    resp = client.get("/api/medicos/perfil/4")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 4
    assert data["nombre"] == "Dr. Juan Perez"
    assert data["especialidad"] == "Endocrinología"
    assert data["fechaNac"] == "15/05/1980"


def test_ver_pacientes_id_invalido(client):
    resp = client.get("/api/medicos/misPacientes/xyz")
    assert resp.status_code == 400
    assert resp.json()["error"] == "El ID del médico debe ser un número válido"


def test_ver_pacientes_lista_vacia(client, mock_supabase):
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data=[]))
    resp = client.get("/api/medicos/misPacientes/1")
    assert resp.status_code == 200
    assert resp.json() == []


def test_alertas_activas_vacia(client, mock_supabase):
    mock_supabase.set_table_mock("alertas", MockQueryBuilder(data=[]))
    resp = client.get("/api/medicos/alertasActivas/1")
    assert resp.status_code == 200
    assert resp.json() == []


def test_alertas_resueltas_formateadas(client, mock_supabase):
    alertas_mock = [
        {
            "id_alerta": 101,
            "estado": False,
            "tipo_alerta": {"tipo": "Hipoglucemia"},
            "retroalimentacion": {"mensaje": "Paciente estabilizado"},
            "registro_glucosa": {
                "fecha": "2026-06-01",
                "hora": "14:30:00",
                "nivel_glucosa": 55,
                "observaciones": "Mareos",
                "id_paciente": 2,
                "paciente": {"usuario": {"nombre_completo": "Ana Gomez"}},
                "momento_dia": {"momento": "Ayunas"}
            }
        }
    ]
    mock_supabase.set_table_mock("alertas", MockQueryBuilder(data=alertas_mock))
    resp = client.get("/api/medicos/alertasResueltas/1")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == 101
    assert data[0]["nivel"] == "Hipoglucemia"
    assert data[0]["mensaje"] == "Paciente estabilizado"
    assert data[0]["paciente"] == "Ana Gomez"


def test_retroalimentacion_alerta_faltan_campos(client):
    resp = client.post("/api/medicos/responder/alerta", json={"id_medico": 1})
    assert resp.status_code == 400
    assert resp.json()["error"] == "Todos los campos son requeridos"


def test_actualizar_medico_no_encontrado(client, mock_supabase):
    mock_supabase.set_table_mock("medico", MockQueryBuilder(data=None))
    resp = client.put("/api/medicos/actualizar/999", data={"telefono": "78945612"})
    assert resp.status_code == 404
    assert resp.json()["message"] == "Médico no encontrado"
