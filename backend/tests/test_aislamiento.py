"""
Aislamiento del backend de negocio (design.md 1.6.0, ADR-0001, ADR-0006, ADR-0008).

El ML (backend/ml_service) y el chatbot (backend/nlp_service) son servicios
independientes: el backend no los incluye ni los importa, no expone
POST /api/riesgo/hipoglucemia, y sus dependencias declaradas cubren lo que
importa su codigo (sin librerias de ML). Ejecutar desde backend/:

    PYTHONPATH=. python -m pytest tests
"""
import re
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

BACKEND = Path(__file__).resolve().parents[1]
APP_DIR = BACKEND / "app"

# Nombre de import -> nombre del paquete en requirements.txt
PAQUETE_DE_IMPORT = {
    "dotenv": "python-dotenv",
    "pydantic_settings": "pydantic-settings",
}
LIBRERIAS_DE_ML = ("scikit-learn", "sklearn", "pandas", "numpy", "scipy", "imbalanced-learn", "imblearn", "joblib", "openpyxl")


def _requirements(nombre: str) -> list:
    paquetes = []
    for linea in (BACKEND / nombre).read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith(("#", "-")):
            continue
        paquetes.append(re.split(r"[\[<>=!~ ]", linea, maxsplit=1)[0].lower())
    return paquetes


def _imports_de_terceros() -> set:
    encontrados = set()
    for ruta in APP_DIR.rglob("*.py"):
        for modulo in re.findall(r"^\s*(?:from|import)\s+([A-Za-z_][\w]*)", ruta.read_text(encoding="utf-8"), re.MULTILINE):
            if modulo != "app" and modulo not in sys.stdlib_module_names:
                encontrados.add(modulo)
    return encontrados


def test_el_backend_arranca_y_health_responde_200():
    respuesta = TestClient(app).get("/health")

    assert respuesta.status_code == 200
    assert respuesta.json() == {"status": "ok", "service": "glucotracker-backend"}


def test_el_backend_no_expone_el_endpoint_de_riesgo():
    cliente = TestClient(app)

    assert cliente.post("/api/riesgo/hipoglucemia", json={}).status_code == 404
    assert not any("riesgo" in ruta.path for ruta in app.routes if hasattr(ruta, "path"))


def test_no_quedan_restos_del_modulo_de_ml_en_el_backend():
    assert not (APP_DIR / "ml").exists()
    assert not (APP_DIR / "test_ml.sh").exists()
    assert not (BACKEND / "data" / "raw").exists()
    for ruta in list(APP_DIR.rglob("*.py")) + list(Path(__file__).parent.glob("*.py")):
        if ruta.name == Path(__file__).name:
            continue
        texto = ruta.read_text(encoding="utf-8")
        assert "has_ml_riesgo" not in texto, ruta.name
        assert not re.search(r"^\s*(?:from|import)\s+app\.ml\b", texto, re.MULTILINE), ruta.name


def test_el_backend_no_importa_los_servicios_independientes():
    ofensores = []
    for ruta in APP_DIR.rglob("*.py"):
        texto = ruta.read_text(encoding="utf-8")
        if re.search(r"^\s*(?:from|import)\s+(?:ml_service|nlp_service)\b", texto, re.MULTILINE):
            ofensores.append(ruta.name)

    assert ofensores == []
    assert not any(nombre in sys.modules for nombre in ("ml_service", "nlp_service"))


def test_los_servicios_independientes_no_importan_el_backend():
    ofensores = []
    for servicio in ("ml_service", "nlp_service"):
        for ruta in (BACKEND / servicio / "app").rglob("*.py"):
            if re.search(r"^\s*(?:from|import)\s+(?:backend|ml_service|nlp_service)\b", ruta.read_text(encoding="utf-8"), re.MULTILINE):
                ofensores.append(f"{servicio}/{ruta.name}")

    assert ofensores == []


def test_requirements_cubren_todos_los_imports_de_terceros_del_backend():
    declarados = set(_requirements("requirements.txt"))

    faltantes = sorted(
        PAQUETE_DE_IMPORT.get(modulo, modulo).replace("_", "-").lower()
        for modulo in _imports_de_terceros()
        if PAQUETE_DE_IMPORT.get(modulo, modulo).replace("_", "-").lower() not in declarados
    )

    assert faltantes == [], f"imports sin declarar en requirements.txt: {faltantes}"


def test_requirements_sin_librerias_de_ml_ni_paquetes_de_prueba():
    declarados = set(_requirements("requirements.txt")) | set(_requirements("requirements-dev.txt"))

    assert not [p for p in LIBRERIAS_DE_ML if p in declarados]
    assert "pytest" not in _requirements("requirements.txt")  # las pruebas van en requirements-dev.txt


def test_requirements_sin_paquetes_repetidos():
    for nombre in ("requirements.txt", "requirements-dev.txt"):
        paquetes = _requirements(nombre)
        assert len(paquetes) == len(set(paquetes)), nombre


def test_requirements_con_versiones_exactas():
    for linea in (BACKEND / "requirements.txt").read_text(encoding="utf-8").splitlines():
        if linea.strip():
            assert "==" in linea, f"version no fijada: {linea}"


@pytest.mark.parametrize("nombre", ["requirements.txt", "requirements-dev.txt", ".env.example"])
def test_archivos_de_configuracion_terminan_en_salto_de_linea(nombre):
    assert (BACKEND / nombre).read_bytes().endswith(b"\n")


# Variables del CLIENTE del servicio de ML que el backend sí lee (ADR-0011). Las del propio servicio de ML
# (ML_MODELO, ML_ARTEFACTOS_DIR, ML_LOG_LEVEL, ML_ENABLE_DOCS) y las del NLP siguen sin ir en el .env del backend.
VARIABLES_CLIENTE_ML = {"ML_ENABLED", "ML_URL", "ML_TIMEOUT", "ML_DURACION_DEFECTO_ANIOS"}


def test_env_example_declara_las_variables_que_lee_config():
    variables = set(re.findall(r"^([A-Z_]+)=", (BACKEND / ".env.example").read_text(encoding="utf-8"), re.MULTILINE))
    texto_config = (APP_DIR / "core" / "config.py").read_text(encoding="utf-8")
    leidas = set(re.findall(r'(?:os\.getenv|_bool_env|_float_env)\("([A-Z_]+)"', texto_config))

    assert leidas <= variables, f"variables de config.py que faltan en .env.example: {sorted(leidas - variables)}"
    assert VARIABLES_CLIENTE_ML <= variables
    assert not [v for v in variables if v.startswith(("NLP_", "CHATBOT_"))]  # esas son de sus servicios
    assert not [v for v in variables if v.startswith("ML_") and v not in VARIABLES_CLIENTE_ML]  # solo las del cliente


def test_el_cliente_de_ml_solo_usa_http_y_no_importa_el_servicio_de_ml():
    texto = (APP_DIR / "services" / "ml_client.py").read_text(encoding="utf-8")
    assert "import httpx" in texto
    assert not re.search(r"^\s*(?:from|import)\s+(?:ml_service|app\.ml)", texto, re.MULTILINE)
    for libreria in LIBRERIAS_DE_ML:
        assert not re.search(rf"^\s*(?:from|import)\s+{libreria}", texto, re.MULTILINE), libreria


def _bloque_compose(servicio: str) -> str:
    compose = (BACKEND.parent / "docker-compose.yml").read_text(encoding="utf-8")
    m = re.search(rf"^  {servicio}:\n(.*?)(?=^  \S|^\S)", compose, re.MULTILINE | re.DOTALL)
    assert m, servicio
    return m.group(1)


def test_el_ml_no_publica_puertos_y_solo_esta_en_la_red_interna():
    ml = _bloque_compose("ml_service")
    assert not re.search(r"^\s+ports:", ml, re.MULTILINE)  # sin ports publicados
    assert "networks:[red_ml]" in ml.replace(" ", "")
    compose = (BACKEND.parent / "docker-compose.yml").read_text(encoding="utf-8")
    assert re.search(r"red_ml:\s*\n\s+internal: true", compose)  # red sin salida ni acceso desde el host
    backend = _bloque_compose("backend")
    assert "red_ml" in backend and "ML_URL: http://ml_service:8002" in backend
    assert "ML_ENABLED" not in re.sub(r"#.*", "", backend)  # se activa en backend/.env, no en Compose

# ---------------------------------------------------------------- interruptor de OTP (ADR-0012)
OTP_FALSE = re.compile(r"OTP_ACTIVADO\s*[:=]\s*[\"']?\s*(false|0|no)\b", re.IGNORECASE)


def _sin_comentarios(texto: str) -> str:
    return "\n".join(re.sub(r"#.*", "", linea) for linea in texto.splitlines())


def test_ningun_compose_principal_ni_env_example_fija_otp_apagado():
    raiz = BACKEND.parent
    archivos = [p for p in raiz.glob("docker-compose*.yml") if "prueba" not in p.name]
    archivos += [p for p in raiz.rglob(".env.example") if "node_modules" not in p.parts and ".venv" not in p.parts]
    assert (raiz / "docker-compose.yml") in archivos and (BACKEND / ".env.example") in archivos
    for archivo in archivos:
        assert not OTP_FALSE.search(_sin_comentarios(archivo.read_text(encoding="utf-8"))), f"OTP_ACTIVADO=false en {archivo.name}"


def test_otp_activado_true_explicito_en_el_compose_principal_y_en_env_example():
    assert re.search(r"OTP_ACTIVADO:\s*[\"']?true", _sin_comentarios(_bloque_compose("backend")))
    assert re.search(r"^OTP_ACTIVADO=true\s*$", (BACKEND / ".env.example").read_text(encoding="utf-8"), re.MULTILINE)


def test_otp_apagado_solo_en_el_compose_de_prueba():
    prueba = _sin_comentarios((BACKEND.parent / "docker-compose.prueba.yml").read_text(encoding="utf-8"))
    assert OTP_FALSE.search(prueba)
    assert not OTP_FALSE.search(_sin_comentarios((BACKEND.parent / "docker-compose.yml").read_text(encoding="utf-8")))
