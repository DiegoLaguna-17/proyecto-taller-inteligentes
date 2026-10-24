import pytest

from app.clinical import DESCARGO_MEDICO
from app.config import load_settings
from app.errors import ProveedorError, ProveedorNoConfigurado
from app.llm_client import FakeProvider, RespuestaLLM
from app.prompt_builder import construir_system_prompt
from app.service import TEMPERATURE, descargo_presente, responder_consulta

CONSULTA = "¿Qué debo comer si mi glucosa está en 70 mg/dL?"


def settings(enforce: bool = True):
    return load_settings({"NLP_PROVIDER": "fake", "NLP_ENFORCE_DISCLAIMER": str(enforce).lower()})


def test_consulta_de_aceptacion_con_fake_devuelve_texto_y_descargo():
    respuesta = responder_consulta(CONSULTA, settings=settings())

    assert respuesta.strip()
    assert DESCARGO_MEDICO in respuesta


def test_al_proveedor_solo_van_el_corpus_y_el_texto():
    fake = FakeProvider()

    responder_consulta(CONSULTA, cliente=fake, settings=settings())

    assert fake.llamadas == [
        {"system_prompt": construir_system_prompt(), "texto": CONSULTA, "temperature": 0.2}
    ]
    assert TEMPERATURE == 0.2


def test_sin_contexto_no_envia_system_prompt():
    fake = FakeProvider()

    responder_consulta(CONSULTA, con_contexto=False, cliente=fake, settings=settings())

    assert fake.llamadas[0]["system_prompt"] is None


def test_enforce_false_deja_la_respuesta_intacta():
    respuesta = responder_consulta(CONSULTA, cliente=FakeProvider("Texto sin descargo."), settings=settings(False))

    assert respuesta == "Texto sin descargo."


def test_enforce_true_agrega_el_descargo_al_final():
    respuesta = responder_consulta(CONSULTA, cliente=FakeProvider("Texto sin descargo."), settings=settings(True))

    assert respuesta == f"Texto sin descargo.\n\n{DESCARGO_MEDICO}"


@pytest.mark.parametrize(
    "con_descargo",
    [
        f"Respuesta. {DESCARGO_MEDICO}",
        "Respuesta. Consulta siempre a tu medico tratante\npara cambios en tu medicacion",
        "Respuesta. CONSULTA SIEMPRE A TU MÉDICO TRATANTE PARA CAMBIOS EN TU MEDICACIÓN.",
    ],
)
def test_no_duplica_el_descargo_si_ya_esta(con_descargo):
    assert descargo_presente(con_descargo)
    assert responder_consulta(CONSULTA, cliente=FakeProvider(con_descargo), settings=settings(True)) == con_descargo


def test_errores_del_proveedor_se_propagan_sin_la_consulta():
    class ProveedorQueFalla:
        def generar(self, system_prompt, texto, temperature) -> RespuestaLLM:
            raise ProveedorError("HTTP 500")

    with pytest.raises(ProveedorError) as exc_info:
        responder_consulta(CONSULTA, cliente=ProveedorQueFalla(), settings=settings())

    assert CONSULTA not in str(exc_info.value)


def test_sin_proveedor_configurado():
    with pytest.raises(ProveedorNoConfigurado):
        responder_consulta(CONSULTA, settings=load_settings({}))


def test_lee_la_configuracion_del_entorno_si_no_se_inyecta(monkeypatch):
    monkeypatch.setenv("NLP_PROVIDER", "fake")

    assert DESCARGO_MEDICO in responder_consulta(CONSULTA)
