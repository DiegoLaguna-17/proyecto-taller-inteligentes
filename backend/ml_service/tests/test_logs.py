"""NFR-001: ningun log, print ni excepcion contiene valores de entrada (glucosa, perfil)."""
import logging

import pytest
from datos_sinteticos import PERFIL

from app.errors import ModeloNoDisponible
from app.metadatos import NOMBRE_MODELO
from app.predict import modelo_cargado, predecir_riesgo

# Fragmentos del perfil que no aparecen por casualidad en otros textos.
VALORES_SENSIBLES = ["123.456", "27.3141", "7.7777", "11.7"]


def _sin_valores(texto):
    for valor in VALORES_SENSIBLES:
        assert valor not in texto, "se filtro un valor de entrada"


def test_prediccion_exitosa_no_registra_valores(artefactos, caplog, capsys):
    with caplog.at_level(logging.DEBUG):
        predecir_riesgo(PERFIL, str(artefactos))

    _sin_valores(caplog.text)
    salida = capsys.readouterr()
    _sin_valores(salida.out + salida.err)


def test_fallo_de_carga_registra_solo_el_motivo(artefactos, caplog):
    (artefactos / NOMBRE_MODELO).unlink()

    with caplog.at_level(logging.DEBUG):
        with pytest.raises(ModeloNoDisponible) as info:
            predecir_riesgo(PERFIL, str(artefactos))

    _sin_valores(caplog.text)
    _sin_valores(str(info.value))
    assert str(artefactos) not in caplog.text, "el log no debe incluir rutas"
    assert "artefacto_ausente" in caplog.text


def test_health_con_modelo_sano_no_registra_advertencias(artefactos, caplog):
    with caplog.at_level(logging.DEBUG):
        modelo_cargado(str(artefactos))

    assert all(r.levelno < logging.WARNING for r in caplog.records)
