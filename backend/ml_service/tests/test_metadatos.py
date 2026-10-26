"""El JSON de metadatos (ML-D7) tiene todos sus campos y solo agregados."""
import json

from app.metadatos import CAMPOS_OBLIGATORIOS, LIBRERIAS, NOMBRE_METADATOS, NOMBRE_MODELO, sha256_archivo


def test_el_json_tiene_todos_los_campos(artefactos):
    metadatos = json.loads((artefactos / NOMBRE_METADATOS).read_text(encoding="utf-8"))

    assert set(CAMPOS_OBLIGATORIOS) <= set(metadatos)
    assert set(metadatos["versiones"]) == {"python", *LIBRERIAS}
    assert all(version for version in metadatos["versiones"].values())
    assert set(metadatos["conteos"]) >= {"filas", "filas_positivas", "pacientes", "filas_train", "filas_test"}
    assert set(metadatos["dataset"]) == {"archivo", "sha256"}
    assert metadatos["random_state"] == 42
    assert metadatos["version_modelo"]
    assert metadatos["fecha_entrenamiento"]


def test_la_huella_del_json_es_la_del_pkl(artefactos):
    metadatos = json.loads((artefactos / NOMBRE_METADATOS).read_text(encoding="utf-8"))

    assert metadatos["sha256_pkl"] == sha256_archivo(str(artefactos / NOMBRE_MODELO))
    assert len(metadatos["sha256_pkl"]) == 64


def test_el_json_no_lleva_ids_de_pacientes_ni_valores_de_glucosa(artefactos):
    texto = (artefactos / NOMBRE_METADATOS).read_text(encoding="utf-8")

    assert "sintetico" not in texto
    assert "glucosa" not in texto.lower()
