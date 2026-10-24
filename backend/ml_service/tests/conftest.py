"""
Fixtures comunes. Ninguna prueba usa red ni el Excel real. Las variables de
entorno del servicio se limpian antes de cada prueba para no leer la
configuracion del desarrollador, y la cache de carga del modelo se vacia para
que cada prueba verifique su propio artefacto.
"""
import pytest
from datos_sinteticos import entrenar_modelo_sintetico

from app import predict

VARIABLES_DEL_SERVICIO = ("ML_ARTEFACTOS_DIR", "ML_LOG_LEVEL", "ML_ENABLE_DOCS")


@pytest.fixture(autouse=True)
def entorno_limpio(monkeypatch):
    for variable in VARIABLES_DEL_SERVICIO:
        monkeypatch.delenv(variable, raising=False)
    predict._cargar_bundle.cache_clear()
    yield
    predict._cargar_bundle.cache_clear()


@pytest.fixture(scope="session")
def _artefactos_sinteticos(tmp_path_factory):
    carpeta = tmp_path_factory.mktemp("artefactos_sinteticos")
    metadatos = entrenar_modelo_sintetico(str(carpeta))
    return carpeta, metadatos


@pytest.fixture
def artefactos(tmp_path, _artefactos_sinteticos):
    """Copia fresca (modificable por la prueba) del modelo sintetico ya entrenado."""
    import shutil

    origen, _ = _artefactos_sinteticos
    destino = tmp_path / "artefactos"
    shutil.copytree(origen, destino)
    return destino


@pytest.fixture(scope="session")
def metadatos_sinteticos(_artefactos_sinteticos):
    return _artefactos_sinteticos[1]
