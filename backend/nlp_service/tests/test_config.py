import pytest

from app import config
from app.config import load_settings, validar_proveedor
from app.errors import ConfiguracionInvalida, ProveedorNoConfigurado


def test_fake_carga_sin_clave_ni_modelo():
    settings = load_settings({"NLP_PROVIDER": "fake"})

    validar_proveedor(settings)
    assert settings.nlp_provider_api_key is None


def test_valores_por_defecto():
    settings = load_settings({})

    assert settings.nlp_timeout_seconds == config.DEFAULT_TIMEOUT_SECONDS
    assert settings.nlp_enforce_disclaimer is True
    assert settings.chatbot_require_auth is True
    assert settings.chatbot_max_input_chars == config.DEFAULT_MAX_INPUT_CHARS
    assert settings.chatbot_rate_limit_per_minute == config.DEFAULT_RATE_LIMIT_PER_MINUTE


def test_variables_vacias_cuentan_como_ausentes():
    settings = load_settings({"NLP_PROVIDER": "fake", "NLP_MODEL": "  ", "CHATBOT_MAX_INPUT_CHARS": ""})

    assert settings.nlp_model is None
    assert settings.chatbot_max_input_chars == config.DEFAULT_MAX_INPUT_CHARS


@pytest.mark.parametrize(
    "entorno, variable_faltante",
    [
        ({}, "NLP_PROVIDER"),
        ({"NLP_PROVIDER": "gemini", "NLP_PROVIDER_API_KEY": "clave-de-prueba"}, "NLP_MODEL"),
        ({"NLP_PROVIDER": "gemini", "NLP_MODEL": "modelo-de-prueba"}, "NLP_PROVIDER_API_KEY"),
    ],
)
def test_proveedor_incompleto_nombra_solo_la_variable(entorno, variable_faltante):
    with pytest.raises(ProveedorNoConfigurado) as exc_info:
        validar_proveedor(load_settings(entorno))

    assert exc_info.value.variable == variable_faltante
    assert variable_faltante in str(exc_info.value)
    for valor in entorno.values():
        assert valor not in str(exc_info.value)


def test_proveedor_no_soportado():
    with pytest.raises(ProveedorNoConfigurado) as exc_info:
        validar_proveedor(load_settings({"NLP_PROVIDER": "openai"}))

    assert exc_info.value.variable == "NLP_PROVIDER"
    assert "openai" not in str(exc_info.value)


@pytest.mark.parametrize(
    "variable, valor",
    [
        ("NLP_TIMEOUT_SECONDS", "abc"),
        ("NLP_TIMEOUT_SECONDS", "0"),
        ("CHATBOT_MAX_INPUT_CHARS", "-5"),
        ("CHATBOT_RATE_LIMIT_PER_MINUTE", "diez"),
        ("NLP_ENFORCE_DISCLAIMER", "quizas"),
        ("CHATBOT_REQUIRE_AUTH", "talvez"),
    ],
)
def test_valores_invalidos(variable, valor):
    with pytest.raises(ConfiguracionInvalida) as exc_info:
        load_settings({variable: valor})

    assert exc_info.value.variable == variable


def test_booleanos():
    settings = load_settings({"NLP_ENFORCE_DISCLAIMER": "false", "CHATBOT_REQUIRE_AUTH": "FALSE"})

    assert settings.nlp_enforce_disclaimer is False
    assert settings.chatbot_require_auth is False


def test_nlp_temperature_no_se_lee():
    settings = load_settings({"NLP_PROVIDER": "fake", "NLP_TEMPERATURE": "0.9"})

    assert not hasattr(settings, "nlp_temperature")
    assert "NLP_TEMPERATURE" not in open(config.__file__, encoding="utf-8").read().split('"""', 2)[2]


def test_la_clave_no_aparece_en_repr():
    settings = load_settings({"NLP_PROVIDER": "gemini", "NLP_PROVIDER_API_KEY": "clave-secreta-de-prueba"})

    assert "clave-secreta-de-prueba" not in repr(settings)
