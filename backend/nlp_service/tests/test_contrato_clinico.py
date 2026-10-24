"""
Test de contrato clínico (TASK-013j, ADR-0006).

Compara las constantes de app/clinical.py con:
1. el archivo de referencia versionado docs/nlp/umbrales_ada_v1.json, y
2. el corpus vigente app/corpus/reglas_ada_v1.1.txt.
Cualquier diferencia de umbral o del texto del descargo hace fallar el test.
"""
import json
import re
from pathlib import Path

import pytest

from app import clinical
from app.prompt_builder import CORPUS_VIGENTE, cuerpo_del_corpus

REPO_ROOT = Path(__file__).resolve().parents[3]
REFERENCIA = REPO_ROOT / "docs" / "nlp" / "umbrales_ada_v1.json"

CLAVES_NUMERICAS = (
    "hipoglucemia_umbral_mg_dl",
    "ayunas_min_mg_dl",
    "ayunas_max_mg_dl",
    "postprandial_max_mg_dl",
    "carbohidratos_rapidos_g",
    "espera_remedicion_min",
)


@pytest.fixture(scope="module")
def referencia():
    return json.loads(REFERENCIA.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def corpus():
    return cuerpo_del_corpus(CORPUS_VIGENTE.read_text(encoding="utf-8"))


@pytest.mark.parametrize("clave", CLAVES_NUMERICAS)
def test_constante_igual_a_la_referencia(referencia, clave):
    assert getattr(clinical, clave.upper()) == referencia[clave]


def test_descargo_igual_a_la_referencia(referencia):
    assert clinical.DESCARGO_MEDICO == referencia["descargo_medico"]


def test_referencia_en_mg_dl(referencia):
    assert referencia["unidad_glucosa"] == "mg/dL"


def test_corpus_cita_los_umbrales(corpus):
    citas_esperadas = [
        f"<{clinical.HIPOGLUCEMIA_UMBRAL_MG_DL} mg/dL",
        f"debajo de {clinical.HIPOGLUCEMIA_UMBRAL_MG_DL}",
        f"{clinical.AYUNAS_MIN_MG_DL} a {clinical.AYUNAS_MAX_MG_DL} mg/dL",
        f"menor a {clinical.POSTPRANDIAL_MAX_MG_DL} mg/dL",
        f"{clinical.CARBOHIDRATOS_RAPIDOS_G} gramos",
        f"{clinical.ESPERA_REMEDICION_MIN} minutos",
    ]

    faltantes = [cita for cita in citas_esperadas if cita not in corpus]
    assert faltantes == []


def test_corpus_no_cita_umbrales_de_glucosa_desconocidos(corpus):
    citados = {int(n) for n in re.findall(r"(\d+)\s*mg/dL", corpus)}
    conocidos = {
        clinical.HIPOGLUCEMIA_UMBRAL_MG_DL,
        clinical.AYUNAS_MIN_MG_DL,
        clinical.AYUNAS_MAX_MG_DL,
        clinical.POSTPRANDIAL_MAX_MG_DL,
    }

    assert citados <= conocidos


def test_corpus_incluye_el_descargo_literal_en_una_linea(corpus):
    lineas = [linea.strip() for linea in corpus.splitlines()]

    assert any(clinical.DESCARGO_MEDICO in linea for linea in lineas)
