import io
from datetime import datetime, timedelta
from tests.conftest import MockQueryBuilder

def test_registrar_paciente_falta_archivo(client):
    resp = client.post("/api/pacientes/registrarPaciente", data={"nombre_completo": "Carlos"})
    assert resp.status_code == 400
    assert resp.json()["error"] == "Archivo de perfil faltante"


def test_registrar_paciente_faltan_campos(client):
    files = {"foto_perfil": ("foto.jpg", io.BytesIO(b"fake image"), "image/jpeg")}
    data = {"nombre_completo": "Carlos"}
    resp = client.post("/api/pacientes/registrarPaciente", data=data, files=files)
    assert resp.status_code == 400
    assert resp.json()["error"] == "Todos los campos obligatorios deben ser llenados"


def test_perfil_paciente_no_encontrado(client, mock_supabase):
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data=None))
    resp = client.get("/api/pacientes/perfil/999")
    assert resp.status_code == 404
    assert resp.json()["message"] == "No se encontró el paciente solicitado"


def test_perfil_paciente_formateado_exitoso(client, mock_supabase):
    paciente_mock = {
        "id_paciente": 7,
        "genero": "Femenino",
        "altura": "1.65",
        "peso": "60",
        "embarazo": False,
        "nombre_emergencia": "Mama",
        "numero_emergencia": "78912345",
        "foto_perfil": "https://url.com/foto",
        "usuario": {
            "id_usuario": 15,
            "nombre_completo": "Lucia Mendez",
            "fecha_nac": "1995-10-20",
            "teléfono": "71122334",
            "correo": "lucia@test.com",
            "fecha_registro": "2026-01-01"
        },
        "nivel_actividad_fisica": {"descripcion": "Moderada"},
        "medico": {"usuario": {"nombre_completo": "Dr. House"}},
        "administrador": {"usuario": {"nombre_completo": "Super Admin"}},
        "paciente_enfermedad": [
            {"enfermedades_base": {"nombre_enfermedad": "Diabetes Tipo 2"}}
        ],
        "tratamiento_enfermedad": [
            {"dosis": 10, "tratamientos": {"nombre_tratamiento": "Metformina", "descripcion": "Oral"}}
        ],
        "seguimiento_embarazo": []
    }
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data=paciente_mock))
    resp = client.get("/api/pacientes/perfil/7")
    assert resp.status_code == 200
    data = resp.json()
    assert data["nombre"] == "Lucia Mendez"
    assert data["fechaNac"] == "20/10/1995"
    assert data["afecciones"] == ["Diabetes Tipo 2"]
    assert len(data["tratamientos"]) == 1
    assert data["tratamientos"][0]["titulo"] == "Metformina"


def test_registros_paciente_formateados(client, mock_supabase):
    registros_mock = [
        {
            "id_registro": 10,
            "fecha": "2026-06-10",
            "hora": "08:15:00",
            "nivel_glucosa": 95,
            "observaciones": "En ayunas",
            "momento_dia": {"momento": "Ayunas"},
            "medico": {"usuario": {"nombre_completo": "Dr. Strange"}},
            "alertas": None
        }
    ]
    mock_supabase.set_table_mock("registro_glucosa", MockQueryBuilder(data=registros_mock))
    resp = client.get("/api/pacientes/registros/7")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == 10
    assert data[0]["hora"] == "08:15"
    assert data[0]["nivelGlucosa"] == 95.0
    assert data[0]["momentoDia"] == "Ayunas"


def test_registrar_glucosa_faltan_campos(client):
    resp = client.post("/api/pacientes/registrarGlucosa", json={"fecha": "2026-06-10"})
    assert resp.status_code == 400
    assert "Todos los campos" in resp.json()["error"]


def test_registrar_glucosa_exitoso(client, mock_supabase):
    created_mock = [{"id_registro": 42, "id_paciente": 7, "nivel_glucosa": 105}]
    mock_supabase.set_table_mock("registro_glucosa", MockQueryBuilder(data=created_mock))
    payload = {
        "fecha": "2026-06-10",
        "hora": "12:00:00",
        "id_momento": 1,
        "id_paciente": 7,
        "nivel_glucosa": 105,
        "observaciones": "Post almuerzo"
    }
    resp = client.post("/api/pacientes/registrarGlucosa", json=payload)
    assert resp.status_code == 200
    assert resp.json()["message"] == "Registro insertado correctamente"
    assert resp.json()["id_registro"] == 42


def test_actualizar_paciente_faltan_datos(client):
    resp = client.put("/api/pacientes/actualizarPaciente/15", json={"nombre": "Solo Nombre"})
    assert resp.status_code == 400
    assert resp.json()["error"] == "Faltan datos obligatorios"


def test_actualizar_paciente_no_encontrado(client, mock_supabase):
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data=None))
    payload = {
        "nombre": "Lucia",
        "altura": 1.65,
        "peso": 60,
        "telefono": "71122334",
        "correo": "lucia@test.com",
        "nombre_emergencia": "Mama",
        "numero_emergencia": "78912345"
    }
    resp = client.put("/api/pacientes/actualizarPaciente/999", json=payload)
    assert resp.status_code == 404
    assert resp.json()["error"] == "Paciente no encontrado"


def test_actualizar_paciente_exitoso(client, mock_supabase):
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data={"id_paciente": 7}))
    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data={"id_usuario": 15, "nombre_completo": "Lucia Gomez"}))
    payload = {
        "nombre": "Lucia Gomez",
        "altura": 1.65,
        "peso": 60,
        "telefono": "71122334",
        "correo": "lucia@test.com",
        "nombre_emergencia": "Mama",
        "numero_emergencia": "78912345"
    }
    resp = client.put("/api/pacientes/actualizarPaciente/15", json=payload)
    assert resp.status_code == 200
    assert "usuario" in resp.json()


def test_obtener_semanas_embarazo_no_embarazada(client, mock_supabase):
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data={"embarazo": False}))
    resp = client.get("/api/pacientes/obtenerDatosEmbarazo/7")
    assert resp.status_code == 200
    assert resp.json()["semanas_actuales"] is None


def test_obtener_semanas_embarazo_activa(client, mock_supabase):
    fecha_hace_14_dias = (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data={"embarazo": True}))
    mock_supabase.set_table_mock("seguimiento_embarazo", MockQueryBuilder(data=[
        {"fecha_registro": fecha_hace_14_dias, "semanas_embarazo": 12}
    ]))
    resp = client.get("/api/pacientes/obtenerDatosEmbarazo/7")
    assert resp.status_code == 200
    assert resp.json()["semanas_actuales"] == 14
