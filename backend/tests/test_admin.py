from tests.conftest import MockQueryBuilder

def test_medicos_activos_formateados(client, mock_supabase):
    medicos_mock = [
        {
            "id_medico": 1,
            "matricula_profesional": "https://url.com/pdf",
            "departamento": "Cochabamba",
            "carnet_profesional": "https://url.com/carnet",
            "usuario": {
                "nombre_completo": "Dr. Mario Rossi",
                "fecha_nac": "1985-02-10",
                "teléfono": "71122334",
                "correo": "mario@hospital.com",
                "estado": True
            },
            "administrador": {
                "usuario": {"nombre_completo": "Super Admin"}
            }
        }
    ]
    mock_supabase.set_table_mock("medico", MockQueryBuilder(data=medicos_mock))
    resp = client.get("/api/administradores/medicos/activos")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["nombre"] == "Dr. Mario Rossi"
    assert data[0]["departamento"] == "Cochabamba"
    assert data[0]["admitidoPor"] == "Super Admin"


def test_medicos_activos_error_autorizacion(client, mock_supabase):
    mock_supabase.set_table_mock("medico", MockQueryBuilder(error=Exception("28P01 DB_AUTH_ERROR")))
    resp = client.get("/api/administradores/medicos/activos")
    assert resp.status_code == 403
    assert resp.json()["code"] == "DB_AUTH_ERROR"


def test_medicos_solicitantes_vacio(client, mock_supabase):
    mock_supabase.set_table_mock("medico", MockQueryBuilder(data=[]))
    resp = client.get("/api/administradores/medicos/solicitantes")
    assert resp.status_code == 200
    assert resp.json() == []


def test_activar_medico_falta_admin(client):
    resp = client.put("/api/administradores/medico/activar/1", json={})
    assert resp.status_code == 400
    assert resp.json()["error"] == "No hay administrador"


def test_activar_medico_no_encontrado(client, mock_supabase):
    mock_supabase.set_table_mock("medico", MockQueryBuilder(data=None))
    resp = client.put("/api/administradores/medico/activar/999", json={"idAdmin": 1})
    assert resp.status_code == 404
    assert resp.json()["error"] == "Médico no encontrado"


def test_activar_medico_exitoso(client, mock_supabase):
    mock_supabase.set_table_mock("medico", MockQueryBuilder(data={"id_usuario": 10}))
    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data={"id_usuario": 10, "estado": True}))
    resp = client.put("/api/administradores/medico/activar/1", json={"idAdmin": 2})
    assert resp.status_code == 200
    assert resp.json()["mensaje"] == "Usuario activado correctamente"


def test_pacientes_activos_formateo(client, mock_supabase):
    pacientes_mock = [
        {
            "id_paciente": 3,
            "genero": "Masculino",
            "peso": "75",
            "altura": "1.78",
            "nombre_emergencia": "Esposa",
            "numero_emergencia": "78965412",
            "foto_perfil": "https://url.com/p3.jpg",
            "usuario": {
                "nombre_completo": "Pedro Picapiedra",
                "fecha_nac": "1980-03-25",
                "teléfono": "71456987",
                "correo": "pedro@bedrock.com",
                "estado": True
            },
            "nivel_actividad_fisica": {"descripcion": "Intensa"},
            "medico": {"usuario": {"nombre_completo": "Dr. House"}},
            "administrador": {"usuario": {"nombre_completo": "Super Admin"}},
            "paciente_enfermedad": [{"enfermedades_base": {"nombre_enfermedad": "Hipertensión"}}],
            "tratamiento_enfermedad": [{"dosis": 5, "tratamientos": {"nombre_tratamiento": "Enalapril", "descripcion": "Oral"}}]
        }
    ]
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data=pacientes_mock))
    resp = client.get("/api/administradores/pacientes/activos")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["nombre"] == "Pedro Picapiedra"
    assert data[0]["fechaNac"] == "25/03/1980"
    assert data[0]["peso"] == "75"
    assert data[0]["afecciones"][0]["afeccion"] == "Hipertensión"


def test_pacientes_solicitantes_semanas_embarazo(client, mock_supabase):
    solicitantes_mock = [
        {
            "id_paciente": 8,
            "genero": "Femenino",
            "peso": 62,
            "altura": 1.60,
            "nombre_emergencia": "Hermano",
            "numero_emergencia": "71112233",
            "foto_perfil": None,
            "embarazo": True,
            "usuario": {
                "nombre_completo": "Vilma Picapiedra",
                "fecha_nac": "1982-08-14",
                "teléfono": "77788990",
                "correo": "vilma@bedrock.com",
                "estado": False
            },
            "nivel_actividad_fisica": {"descripcion": "Sedentario"},
            "medico": {"usuario": {"nombre_completo": "Dr. House"}},
            "administrador": None,
            "paciente_enfermedad": [],
            "tratamiento_enfermedad": [],
            "seguimiento_embarazo": [{"semanas_gestacion": 18, "activo": True}]
        }
    ]
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data=solicitantes_mock))
    resp = client.get("/api/administradores/pacientes/solicitantes")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["nombre"] == "Vilma Picapiedra"
    assert data[0]["semanas_embarazo"] == 18


def test_activar_paciente_exitoso(client, mock_supabase):
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data={"id_usuario": 18}))
    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data=[{"id_usuario": 18, "estado": True}]))
    resp = client.put("/api/administradores/paciente/activar/8", json={"idAdmin": 1})
    assert resp.status_code == 200
    assert resp.json()["mensaje"] == "Usuario activado correctamente"


def test_perfil_admin_id_invalido(client):
    resp = client.get("/api/administradores/perfilAdmin/no-num")
    assert resp.status_code == 400
    assert resp.json()["error"] == "El ID de usuario debe ser un número válido"


def test_perfil_admin_no_encontrado(client, mock_supabase):
    mock_supabase.set_table_mock("administrador", MockQueryBuilder(data=None))
    resp = client.get("/api/administradores/perfilAdmin/999")
    assert resp.status_code == 404
    assert resp.json()["message"] == "No se encontró el administrador"


def test_perfil_admin_exitoso(client, mock_supabase):
    admin_mock = {
        "id_admin": 2,
        "cargo": "Director Médico",
        "fecha_ingreso": "2025-01-15",
        "usuario": {
            "nombre_completo": "Admin Juan",
            "correo": "juan.admin@test.com",
            "fecha_nac": "1988-12-05",
            "teléfono": "70011223"
        },
        "administrador": {"usuario": {"nombre_completo": "Super Admin"}}
    }
    mock_supabase.set_table_mock("administrador", MockQueryBuilder(data=admin_mock))
    resp = client.get("/api/administradores/perfilAdmin/12")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 2
    assert data["nombre"] == "Admin Juan"
    assert data["cargo"] == "Director Médico"
    assert data["fechaIn"] == "15/01/2025"


def test_agregar_admin_faltan_campos(client):
    resp = client.post("/api/administradores/agregar", json={"nombre": "Solo Nombre"})
    assert resp.status_code == 400
    assert "Todos los campos" in resp.json()["error"]


def test_agregar_admin_exitoso(client, mock_supabase):
    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data=[{"id_usuario": 99, "nombre_completo": "Nuevo Admin"}]))
    mock_supabase.set_table_mock("administrador", MockQueryBuilder(data=[{"id_admin": 5, "id_usuario": 99}]))
    payload = {
        "nombre": "Nuevo Admin",
        "correo": "nuevo.admin@test.com",
        "contrasena": "admin123456",
        "fechaNacimiento": "1990-01-01",
        "telefono": "78899001",
        "cargo": "Soporte",
        "fecha_registro": "2026-06-01",
        "administrador_id_admin": 1
    }
    resp = client.post("/api/administradores/agregar", json=payload)
    assert resp.status_code == 200
    assert resp.json()["message"] == "Usuario y admin registrados correctamente"
