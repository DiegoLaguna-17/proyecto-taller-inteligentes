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


# ---------------------------------------------------------------- interruptor de OTP (ADR-0012)
import logging

from app.core.config import settings
import app.main as main_module
from fastapi.testclient import TestClient


def _usuario(mock_supabase, contrasena="mypassword123", rol="paciente", tabla_rol="paciente", id_rol_clave="id_paciente", id_rol=5):
    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data={
        "id_usuario": 10, "correo": "paciente@test.com", "contrasena": hash_password(contrasena), "rol": rol, "estado": True,
    }))
    mock_supabase.set_table_mock(tabla_rol, MockQueryBuilder(data={id_rol_clave: id_rol}))


@pytest.fixture
def espia_correo(monkeypatch):
    llamadas = []

    async def fake_send(*args, **kwargs):
        llamadas.append(args)
        return True

    import app.services.email_service as email_module
    monkeypatch.setattr(email_module.EmailService, "send_email", fake_send)
    return llamadas


def test_otp_por_defecto_esta_activado():
    assert settings.OTP_ACTIVADO is True


def test_otp_activado_la_respuesta_es_la_de_siempre(client, mock_supabase, monkeypatch, espia_correo):
    monkeypatch.setattr(settings, "OTP_ACTIVADO", True)
    OtpCacheService.delete_otp(10)
    _usuario(mock_supabase)

    resp = client.post("/api/login", json={"correo": "paciente@test.com", "contrasena": "mypassword123"})

    assert resp.status_code == 200
    assert resp.json() == {"id_usuario": 10, "id_rol": 5, "message": "OTP enviado al correo"}  # sin `rol`
    assert OtpCacheService.get_otp(10) is not None
    assert len(espia_correo) == 1


@pytest.mark.parametrize("rol,tabla,clave,id_rol", [
    ("paciente", "paciente", "id_paciente", 5),
    ("medico", "medico", "id_medico", 7),
    ("administrador", "administrador", "id_admin", 2),
])
def test_otp_apagado_devuelve_el_rol_sin_correo_ni_otp(client, mock_supabase, monkeypatch, espia_correo, rol, tabla, clave, id_rol):
    monkeypatch.setattr(settings, "OTP_ACTIVADO", False)
    OtpCacheService.delete_otp(10)
    _usuario(mock_supabase, rol=rol, tabla_rol=tabla, id_rol_clave=clave, id_rol=id_rol)

    resp = client.post("/api/login", json={"correo": "paciente@test.com", "contrasena": "mypassword123"})

    assert resp.status_code == 200
    cuerpo = resp.json()
    assert cuerpo["id_usuario"] == 10 and cuerpo["id_rol"] == id_rol and cuerpo["rol"] == rol
    assert "OTP" in cuerpo["message"]
    assert espia_correo == []  # no se envía correo
    assert OtpCacheService.get_otp(10) is None  # no se crea OTP


@pytest.mark.parametrize("otp_activado", [True, False])
def test_credenciales_invalidas_fallan_igual_en_ambos_modos(client, mock_supabase, monkeypatch, espia_correo, otp_activado):
    monkeypatch.setattr(settings, "OTP_ACTIVADO", otp_activado)
    _usuario(mock_supabase, contrasena="correctpassword")

    mala = client.post("/api/login", json={"correo": "paciente@test.com", "contrasena": "otra"})
    assert (mala.status_code, mala.json()) == (401, {"error": "Contraseña incorrecta"})

    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data=None))
    sin_usuario = client.post("/api/login", json={"correo": "nadie@test.com", "contrasena": "x12345"})
    assert (sin_usuario.status_code, sin_usuario.json()) == (401, {"error": "Correo no encontrado"})
    assert espia_correo == []


def test_verify_otp_no_cambia_con_el_interruptor_apagado(client, mock_supabase, monkeypatch):
    monkeypatch.setattr(settings, "OTP_ACTIVADO", False)
    OtpCacheService.set_otp(10, "123456", 50000)
    mock_supabase.set_table_mock("usuario", MockQueryBuilder(data={"id_usuario": 10, "rol": "paciente"}))
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data={"id_paciente": 5}))

    resp = client.post("/api/verify-otp", json={"id_usuario": 10, "codigo": "123456"})

    assert resp.status_code == 200
    assert resp.json() == {"id_usuario": 10, "rol": "paciente", "id_rol": 5, "message": "Login exitoso"}


def test_aviso_fuerte_al_arrancar_con_otp_apagado(monkeypatch, caplog):
    monkeypatch.setattr(settings, "OTP_ACTIVADO", False)
    with caplog.at_level(logging.WARNING, logger="app.main"):
        with TestClient(main_module.app):  # ejecuta el lifespan (arranque)
            pass
    avisos = [r for r in caplog.records if r.levelno == logging.WARNING and "OTP_ACTIVADO=false" in r.getMessage()]
    assert len(avisos) == 1
    assert "pruebas" in avisos[0].getMessage().lower()


def test_sin_aviso_al_arrancar_con_otp_activado(monkeypatch, caplog):
    monkeypatch.setattr(settings, "OTP_ACTIVADO", True)
    with caplog.at_level(logging.WARNING, logger="app.main"):
        with TestClient(main_module.app):
            pass
    assert not [r for r in caplog.records if "OTP_ACTIVADO" in r.getMessage()]
    assert main_module.avisar_otp_desactivado() is False
