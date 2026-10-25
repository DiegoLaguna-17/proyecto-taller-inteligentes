from tests.conftest import MockQueryBuilder

def test_ver_momentos(client, mock_supabase):
    mock_supabase.set_table_mock("momento_dia", MockQueryBuilder(data=[{"id_momento": 1, "momento": "Ayunas"}]))
    resp = client.get("/api/general/momentos")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["momento"] == "Ayunas"


def test_ver_niveles(client, mock_supabase):
    mock_supabase.set_table_mock("nivel_actividad_fisica", MockQueryBuilder(data=[{"id_nivel_actividad": 1, "descripcion": "Sedentario"}]))
    resp = client.get("/api/general/niveles")
    assert resp.status_code == 200
    assert resp.json()[0]["descripcion"] == "Sedentario"


def test_ver_enfermedades(client, mock_supabase):
    mock_supabase.set_table_mock("enfermedades_base", MockQueryBuilder(data=[{"id_enfermedad": 2, "nombre_enfermedad": "Hipertensión"}]))
    resp = client.get("/api/general/enfermedades")
    assert resp.status_code == 200
    assert resp.json()[0]["nombre_enfermedad"] == "Hipertensión"


def test_ver_auditoria(client, mock_supabase):
    mock_supabase.set_table_mock("auditoria_endpoints", MockQueryBuilder(data=[{"id_auditoria": 1, "endpoint": "/api/login", "exito": True}]))
    resp = client.get("/api/general/auditoria")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_datos_para_glucosa_invalido(client):
    resp = client.get("/api/registro/datosGlucosa/xyz")
    assert resp.status_code == 400
    assert resp.json()["error"] == "El ID del paciente debe ser un número válido"


def test_datos_para_glucosa_no_encontrado(client, mock_supabase):
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data=None))
    resp = client.get("/api/registro/datosGlucosa/999")
    assert resp.status_code == 404
    assert resp.json()["message"] == "No se encontraron datos para este paciente"


def test_datos_para_glucosa_exitoso(client, mock_supabase):
    paciente_mock = {
        "id_paciente": 10,
        "embarazo": False,
        "id_medico": 3,
        "usuario": {"fecha_nac": "2000-01-01"},
        "paciente_enfermedad": [
            {"enfermedades_base": {"nombre_enfermedad": "Diabetes"}}
        ]
    }
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data=paciente_mock))
    resp = client.get("/api/registro/datosGlucosa/10")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id_paciente"] == 10
    assert data["id_medico"] == 3
    assert data["edad"] is not None
    assert data["enfermedades"] == ["Diabetes"]


def test_registrar_alerta_faltan_campos(client):
    resp = client.post("/api/registro/registrarAlerta", json={"id_tipo_alerta": 1})
    assert resp.status_code == 400
    assert resp.json()["error"] == "Todos los campos son requeridos"


def test_registrar_alerta_exitoso(client, mock_supabase):
    mock_supabase.set_table_mock("alertas", MockQueryBuilder(data=[{"id_alerta": 1, "id_tipo_alerta": 1}]))
    mock_supabase.set_table_mock("registro_glucosa", MockQueryBuilder(data={"id_paciente": 5, "nivel_glucosa": 50, "fecha": "2026-06-10", "hora": "10:00", "observaciones": "Mareos"}))
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data={"id_usuario": 12, "id_medico": 3}))
    mock_supabase.set_table_mock("medico", MockQueryBuilder(data={"id_usuario": 14}))
    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data={"correo": "medico@test.com", "nombre_completo": "Dr. Mario"}))

    payload = {
        "id_tipo_alerta": 1,
        "id_registro": 22,
        "id_medico": 3,
        "fecha_alerta": "2026-06-10 10:05:00"
    }
    resp = client.post("/api/registro/registrarAlerta", json=payload)
    assert resp.status_code == 200
    assert resp.json()["message"] == "Alerta registrada y correo enviado correctamente"


def test_generar_pdf_objeto_vacio(client):
    resp = client.post("/api/paciente/pdf", json={})
    assert resp.status_code == 400
    assert resp.json()["error"] == "Debes enviar el objeto paciente"


def test_generar_pdf_exitoso(client):
    paciente_payload = {
        "id": 105,
        "nombre": "Carlos Perez",
        "ci": "1234567 LP",
        "fechaNac": "1990-05-20",
        "genero": "Masculino",
        "peso": "72",
        "altura": "1.75",
        "actividadFisica": "Moderada",
        "telefono": "78965412",
        "Correo": "carlos@test.com",
        "historial": [
            {
                "fecha": "2026-06-10",
                "registros": [
                    {
                        "hora": "08:00",
                        "momento": "Ayunas",
                        "glucosa": "95",
                        "alerta": None
                    }
                ]
            }
        ]
    }
    resp = client.post("/api/paciente/pdf", json=paciente_payload)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert b"%PDF" in resp.content[:10]
