"""
app.dev_chat con entradas simuladas. Nunca lee el .env real: cada prueba
pasa su propio archivo (o ninguno).
"""
from app import dev_chat
from app.clinical import DESCARGO_MEDICO


def entradas(*lineas):
    pendientes = list(lineas)
    return lambda _prompt: pendientes.pop(0)


def test_chat_con_fake_imprime_respuesta_y_termina_con_linea_vacia(monkeypatch, capsys):
    monkeypatch.setenv("NLP_PROVIDER", "fake")

    codigo = dev_chat.main([], env_file=None, entrada=entradas("¿Qué es la hipoglucemia?", ""))

    salida = capsys.readouterr()
    assert codigo == 0
    assert DESCARGO_MEDICO in salida.out
    assert salida.err == ""


def test_sin_clave_muestra_solo_el_nombre_de_la_variable(tmp_path, capsys):
    env_file = tmp_path / ".env"
    env_file.write_text("NLP_PROVIDER=gemini\nNLP_MODEL=modelo-de-prueba\n", encoding="utf-8")

    codigo = dev_chat.main([], env_file=env_file, entrada=entradas(""))

    salida = capsys.readouterr()
    assert codigo == 1
    assert "NLP_PROVIDER_API_KEY" in salida.err
    assert "modelo-de-prueba" not in salida.err
    assert salida.out == ""


def test_sin_contexto_indica_el_modo(monkeypatch, capsys):
    monkeypatch.setenv("NLP_PROVIDER", "fake")

    dev_chat.main(["--sin-contexto"], env_file=None, entrada=entradas(""))

    assert "SIN contexto" in capsys.readouterr().out
