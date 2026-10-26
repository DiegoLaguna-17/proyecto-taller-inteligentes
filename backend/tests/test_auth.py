import pytest
from app.core.security import hash_password
from app.services.otp_service import OtpCacheService
from tests.conftest import MockQueryBuilder

def test_login_exitoso(client, mock_supabase):
    raw_pass = "mypassword123"
    hashed = hash_password(raw_pass)

    user_data = {
        "id_usuario": 10,
        "correo": "paciente@test.com",
        "contrasena": hashed,
        "rol": "paciente",
        "estado": True
    }
    paciente_data = {"id_paciente": 5}

    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data=user_data))
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data=paciente_data))

    resp = client.post("/api/login", json={"correo": "paciente@test.com", "contrasena": raw_pass})
    assert resp.status_code == 200
    res_json = resp.json()
    assert res_json["id_usuario"] == 10
    assert res_json["id_rol"] == 5
    assert res_json["message"] == "OTP enviado al correo"
    assert OtpCacheService.get_otp(10) is not None


def test_login_correo_no_encontrado(client, mock_supabase):
    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data=None))
    resp = client.post("/api/login", json={"correo": "noexiste@test.com", "contrasena": "123456"})
    assert resp.status_code == 401
    assert resp.json()["error"] == "Correo no encontrado"


def test_login_contrasena_incorrecta(client, mock_supabase):
    hashed = hash_password("correctpassword")
    user_data = {
        "id_usuario": 10,
        "correo": "paciente@test.com",
        "contrasena": hashed,
        "rol": "paciente",
        "estado": True
    }
    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data=user_data))
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data={"id_paciente": 5}))

    resp = client.post("/api/login", json={"correo": "paciente@test.com", "contrasena": "wrongpassword"})
    assert resp.status_code == 401
    assert resp.json()["error"] == "Contraseña incorrecta"


def test_verify_otp_codigo_incorrecto(client):
    OtpCacheService.set_otp(10, "123456", 50000)
    resp = client.post("/api/verify-otp", json={"id_usuario": 10, "codigo": "999999"})
    assert resp.status_code == 401
    assert resp.json()["error"] == "Código incorrecto o expirado"


def test_verify_otp_exitoso(client, mock_supabase):
    OtpCacheService.set_otp(20, "654321", 50000)
    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data={"id_usuario": 20, "rol": "medico"}))
    mock_supabase.set_table_mock("medico", MockQueryBuilder(data={"id_medico": 8}))

    resp = client.post("/api/verify-otp", json={"id_usuario": 20, "codigo": "654321"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["id_usuario"] == 20
    assert data["rol"] == "medico"
    assert data["id_rol"] == 8
    assert data["message"] == "Login exitoso"
    assert OtpCacheService.get_otp(20) is None


def test_update_password_corta(client):
    resp = client.put("/usuario/10/password", json={"contrasena": "123"})
    assert resp.status_code == 400
    assert "al menos 6 caracteres" in resp.json()["error"]


def test_update_password_usuario_no_encontrado(client, mock_supabase):
    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data=[]))
    resp = client.put("/usuario/999/password", json={"contrasena": "nueva1234"})
    assert resp.status_code == 404
    assert resp.json()["error"] == "Usuario no encontrado."


def test_update_password_exitoso(client, mock_supabase):
    updated_user = [{"id_usuario": 10, "nombre_completo": "Test User", "correo": "test@test.com"}]
    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data=updated_user))
    resp = client.put("/usuario/10/password", json={"contrasena": "nueva1234"})
    assert resp.status_code == 200
    assert resp.json()["message"] == "Contraseña actualizada correctamente."
    assert resp.json()["usuario"]["id_usuario"] == 10
