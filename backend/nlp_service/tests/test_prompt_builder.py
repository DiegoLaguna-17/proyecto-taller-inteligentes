import pytest

from app.prompt_builder import CORPUS_VIGENTE, VERSION_CORPUS, construir_system_prompt, cuerpo_del_corpus


def test_corpus_vigente_es_v1_1():
    assert VERSION_CORPUS == "v1.1"
    assert CORPUS_VIGENTE.name == "reglas_ada_v1.1.txt"


def test_prompt_contiene_el_cuerpo_completo_sin_encabezado():
    prompt = construir_system_prompt()

    assert prompt.startswith("ROL:")
    assert "FUERA DE ALCANCE" in prompt
    assert "VERSION:" not in prompt
    assert "FUENTE:" not in prompt
    assert "PENDIENTE" not in prompt


def test_corpus_sin_separador_falla():
    with pytest.raises(ValueError):
        cuerpo_del_corpus("sin separador")
