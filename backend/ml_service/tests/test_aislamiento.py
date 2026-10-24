"""
ADR-0008: el servicio de ML no importa nada del backend principal ni del
servicio NLP. Como los tres paquetes se llaman `app`, se verifica que todo
`app.<modulo>` importado exista dentro de backend/ml_service/app/, que no se
usen los modulos exclusivos del backend y que no haya imports de `nlp_service`.
"""
import re
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1] / "app"
IMPORT_APP = re.compile(r"^\s*(?:from|import)\s+app\.(\w+)", re.MULTILINE)
IMPORT_APP_DESDE_RAIZ = re.compile(r"^\s*from\s+app\s+import\s+(\w+)", re.MULTILINE)
IMPORT_OTRO_SERVICIO = re.compile(r"^\s*(?:from|import)\s+(?:nlp_service|backend)\b", re.MULTILINE)
SOLO_DEL_BACKEND = {"core", "ml", "models", "nlp"}


def _modulos_importados():
    for ruta in APP_DIR.rglob("*.py"):
        texto = ruta.read_text(encoding="utf-8")
        for modulo in IMPORT_APP.findall(texto) + IMPORT_APP_DESDE_RAIZ.findall(texto):
            yield ruta.name, modulo


def test_no_importa_modulos_exclusivos_del_backend():
    assert [(r, m) for r, m in _modulos_importados() if m in SOLO_DEL_BACKEND] == []


def test_todo_modulo_importado_existe_en_el_servicio():
    faltantes = [
        (ruta, modulo)
        for ruta, modulo in _modulos_importados()
        if not ((APP_DIR / f"{modulo}.py").exists() or (APP_DIR / modulo / "__init__.py").exists())
    ]

    assert faltantes == []


def test_no_importa_otros_servicios():
    ofensores = [r.name for r in APP_DIR.rglob("*.py") if IMPORT_OTRO_SERVICIO.search(r.read_text(encoding="utf-8"))]

    assert ofensores == []


def test_hay_modulos_que_comprobar():
    """Evita que las pruebas de arriba pasen vacias si cambia la estructura."""
    assert len(list(_modulos_importados())) > 5
