"""
Chat de consola para prueba manual del chatbot (no es parte del endpoint).

Uso, desde backend/nlp_service/:
    python -m app.dev_chat                 # con el corpus inyectado
    python -m app.dev_chat --sin-contexto  # corrida neutra, sin corpus

Usa el proveedor definido en backend/nlp_service/.env. Imprime las
respuestas solo por stdout; no escribe archivos ni logs. Una línea vacía
termina el chat.
"""
import argparse
import sys
from pathlib import Path
from typing import Callable, Optional, Sequence

from dotenv import load_dotenv

from app.config import load_settings
from app.errors import ConfiguracionInvalida, ProveedorError, ProveedorNoConfigurado, ProveedorTimeout
from app.llm_client import get_llm_client
from app.service import responder_consulta

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


def main(
    argv: Optional[Sequence[str]] = None,
    env_file: Optional[Path] = ENV_FILE,
    entrada: Callable[[str], str] = input,
) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.dev_chat", description="Chat de consola del servicio NLP.")
    parser.add_argument("--sin-contexto", action="store_true", help="no inyecta el corpus (corrida neutra)")
    args = parser.parse_args(argv)

    if env_file is not None and env_file.exists():
        load_dotenv(env_file, override=False)

    try:
        settings = load_settings()
        cliente = get_llm_client(settings)
    except (ProveedorNoConfigurado, ConfiguracionInvalida) as exc:
        # El mensaje solo nombra la variable, nunca su valor.
        print(f"{exc} Defínela en backend/nlp_service/.env (ver .env.example).", file=sys.stderr)
        return 1

    modo = "SIN contexto (corrida neutra)" if args.sin_contexto else "con contexto (corpus v1.1)"
    print(f"Proveedor: {settings.nlp_provider} | modo: {modo}")
    print("Escribe una pregunta (línea vacía para salir).")

    while True:
        try:
            texto = entrada("> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not texto:
            break
        try:
            respuesta = responder_consulta(
                texto, con_contexto=not args.sin_contexto, cliente=cliente, settings=settings
            )
        except (ProveedorError, ProveedorTimeout) as exc:
            print(str(exc), file=sys.stderr)
            continue
        print(f"{respuesta}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
