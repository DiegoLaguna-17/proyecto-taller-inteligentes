import pytest

from app.config import DEFAULT_ARTEFACTOS_DIR, load_settings
from app.errors import ConfiguracionInvalida


def test_valores_por_defecto():
    settings = load_settings({})

    assert settings.artefactos_dir == DEFAULT_ARTEFACTOS_DIR
    assert settings.log_level == "INFO"


def test_variable_vacia_cuenta_como_ausente():
    assert load_settings({"ML_ARTEFACTOS_DIR": "  ", "ML_LOG_LEVEL": ""}).log_level == "INFO"


def test_lee_las_variables():
    settings = load_settings({"ML_ARTEFACTOS_DIR": "/x", "ML_LOG_LEVEL": "debug"})

    assert settings.artefactos_dir == "/x"
    assert settings.log_level == "DEBUG"


def test_nivel_de_log_invalido_nombra_solo_la_variable():
    with pytest.raises(ConfiguracionInvalida) as info:
        load_settings({"ML_LOG_LEVEL": "ruidoso"})

    assert "ML_LOG_LEVEL" in str(info.value)
    assert "ruidoso" not in str(info.value)


def test_documentacion_apagada_por_defecto():
    assert load_settings({}).habilitar_docs is False
    assert load_settings({"ML_ENABLE_DOCS": ""}).habilitar_docs is False


@pytest.mark.parametrize("valor,esperado", [("true", True), ("1", True), ("False", False), ("no", False)])
def test_lee_ml_enable_docs(valor, esperado):
    assert load_settings({"ML_ENABLE_DOCS": valor}).habilitar_docs is esperado


def test_ml_enable_docs_invalido_nombra_solo_la_variable():
    with pytest.raises(ConfiguracionInvalida) as info:
        load_settings({"ML_ENABLE_DOCS": "tal-vez"})

    assert "ML_ENABLE_DOCS" in str(info.value)
    assert "tal-vez" not in str(info.value)
