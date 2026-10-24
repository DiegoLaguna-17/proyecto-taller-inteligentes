"""
System prompt del chatbot: inyección estática del corpus completo
(docs/nlp/adr_system_prompting_vs_rag.md), sin recuperación.

Solo se inyecta el cuerpo posterior al separador `---`; el encabezado de
metadatos (versión, fuente, notas pendientes) no se envía al LLM.
"""
from functools import lru_cache
from pathlib import Path

CORPUS_DIR = Path(__file__).resolve().parent / "corpus"
VERSION_CORPUS = "v1.1"
CORPUS_VIGENTE = CORPUS_DIR / f"reglas_ada_{VERSION_CORPUS}.txt"
SEPARADOR = "\n---\n"


def cuerpo_del_corpus(contenido: str) -> str:
    if SEPARADOR not in contenido:
        raise ValueError("El corpus no tiene el separador '---' entre encabezado y cuerpo.")
    return contenido.split(SEPARADOR, 1)[1].strip()


@lru_cache(maxsize=None)
def construir_system_prompt(ruta: Path = CORPUS_VIGENTE) -> str:
    # read_text normaliza CRLF a LF, así el separador funciona en Windows.
    return cuerpo_del_corpus(ruta.read_text(encoding="utf-8"))
