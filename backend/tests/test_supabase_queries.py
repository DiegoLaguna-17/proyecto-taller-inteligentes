"""
Pruebas estáticas sobre el uso del cliente Supabase en app/api.

Los tests de endpoints mockean Supabase, así que no detectan consultas que el
cliente real (supabase==2.7.4 / postgrest 0.16.x) rechaza. Estas pruebas
cubren dos patrones que fallaban con 500 en ejecución real:

1. `.select("...")` con tablas embebidas y espacios o saltos de línea: PostgREST no reconoce las
   tablas embebidas y falla al filtrar por `tabla.columna` (PGRST108).
2. `.select()` encadenado a insert/update/upsert/delete: ese método no existe
   en esas respuestas (AttributeError). insert/update ya devuelven la fila.
"""
import ast
from pathlib import Path

import pytest

API_DIR = Path(__file__).resolve().parent.parent / "app" / "api"
API_FILES = sorted(API_DIR.glob("*.py"))
MUTATIONS = {"insert", "update", "upsert", "delete"}


def _select_calls(path):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "select"
        ):
            yield node


def _chain_methods(call):
    """Nombres de los métodos encadenados antes de este `.select`."""
    names = []
    node = call.func.value
    while True:
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            names.append(node.func.attr)
            node = node.func.value
        elif isinstance(node, ast.Attribute):
            names.append(node.attr)
            node = node.value
        else:
            return names


@pytest.mark.parametrize("path", API_FILES, ids=lambda p: p.name)
def test_select_embebido_sin_espacios_ni_saltos_de_linea(path):
    for call in _select_calls(path):
        for arg in call.args:
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                cols = arg.value
                assert "\n" not in cols and not ("(" in cols and " " in cols), (
                    f"{path.name}:{call.lineno} select con tablas embebidas y espacios/saltos de línea"
                )


@pytest.mark.parametrize("path", API_FILES, ids=lambda p: p.name)
def test_select_no_encadenado_a_escrituras(path):
    for call in _select_calls(path):
        assert not (MUTATIONS & set(_chain_methods(call))), (
            f"{path.name}:{call.lineno} .select() encadenado a insert/update/upsert/delete"
        )
