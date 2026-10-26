"""
ADR-0006: el servicio NLP no importa nada del backend principal. Como ambos
paquetes se llaman `app`, se verifica que todo `app.<módulo>` importado
exista dentro de backend/nlp_service/app/, y que no se usen los módulos
exclusivos del backend (core, ml, models).
"""
import re
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1] / "app"
IMPORT_APP = re.compile(r"^\s*(?:from|import)\s+app\.(\w+)", re.MULTILINE)
SOLO_DEL_BACKEND = {"core", "ml", "models"}


def _modulos_importados():
    for ruta in APP_DIR.rglob("*.py"):
        for modulo in IMPORT_APP.findall(ruta.read_text(encoding="utf-8")):
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
