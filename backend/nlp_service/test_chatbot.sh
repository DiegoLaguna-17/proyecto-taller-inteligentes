#!/usr/bin/env bash
# GlucoTracker - script de prueba end-to-end del servicio NLP (TASK-018).
#
# Que hace:
#   1. Levanta el servicio con NLP_PROVIDER=fake y CHATBOT_REQUIRE_AUTH=false
#      (sin --env-file: no lee el .env ni la clave real, no llama a Gemini).
#   2. Verifica GET /health.
#   3. Prueba POST /api/chatbot/consulta con curl y comprueba 200, respuesta
#      no vacia y descargo medico.
#   4. Detiene el servicio al terminar (tambien si algo falla).
#
# Uso:
#   cd backend/nlp_service
#   ./test_chatbot.sh            # puerto 8001 por defecto
#   PORT=8002 ./test_chatbot.sh
#
# Requisitos: venv del servicio con requirements-dev.txt instalado (.venv/)
# y curl disponible.

set -euo pipefail

cd "$(dirname "$0")"
PORT="${PORT:-8001}"
BASE_URL="http://127.0.0.1:${PORT}"
# stdin/stdout de Python en UTF-8 (en Windows usaria la codepage local).
export PYTHONUTF8=1

if [ -x .venv/Scripts/python.exe ]; then
    PYTHON=.venv/Scripts/python.exe   # Windows (Git Bash)
elif [ -x .venv/bin/python ]; then
    PYTHON=.venv/bin/python           # Linux/macOS
else
    echo "No se encontro el venv del servicio en backend/nlp_service/.venv (ver README.md)."
    exit 1
fi

if curl -s -o /dev/null "${BASE_URL}/health"; then
    echo "El puerto ${PORT} ya esta en uso (otro servicio corriendo). Detenlo o usa PORT=<otro> ./test_chatbot.sh"
    exit 1
fi

detener_servidor() {
    # En Windows, python.exe del venv es un lanzador con un proceso hijo:
    # se detiene el arbol completo con taskkill /T.
    if [ -r "/proc/${SERVER_PID}/winpid" ] && command -v taskkill >/dev/null 2>&1; then
        taskkill //T //F //PID "$(cat "/proc/${SERVER_PID}/winpid")" >/dev/null 2>&1 || true
    else
        kill "$SERVER_PID" 2>/dev/null || true
    fi
}

echo "== 1. Levantando el servicio NLP con FakeProvider en ${BASE_URL} =="
NLP_PROVIDER=fake CHATBOT_REQUIRE_AUTH=false \
    "$PYTHON" -m uvicorn app.main:app --port "$PORT" --log-level warning &
SERVER_PID=$!
trap detener_servidor EXIT

for _ in $(seq 1 40); do
    if curl -s -o /dev/null "${BASE_URL}/health"; then
        break
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "FALLO: el servicio no pudo arrancar."
        exit 1
    fi
    sleep 0.25
done

echo ""
echo "== 2. GET /health =="
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health")
echo "HTTP ${HEALTH_STATUS}"
if [ "$HEALTH_STATUS" != "200" ]; then
    echo "FALLO: /health no respondio 200."
    exit 1
fi

echo ""
echo "== 3. POST /api/chatbot/consulta =="
# El cuerpo lo genera Python con json.dumps (salida ASCII pura) y llega a
# curl por stdin: en Windows, Git Bash pasa los argumentos a curl en la
# codepage local y rompe el UTF-8 de las tildes si van en la linea de comandos.
BODY_FILE=$(mktemp)
STATUS=$("$PYTHON" -c 'import json, sys
texto = "%sQu%s debo comer si mi glucosa est%s en 70 mg/dL?" % (chr(191), chr(233), chr(225))
sys.stdout.write(json.dumps({"texto": texto}))' \
    | curl -s -o "$BODY_FILE" -w "%{http_code}" -X POST "${BASE_URL}/api/chatbot/consulta" \
        -H "Content-Type: application/json" --data-binary @-)
BODY=$(cat "$BODY_FILE")
rm -f "$BODY_FILE"
echo "HTTP ${STATUS}"
echo "$BODY" | "$PYTHON" -c "import json, sys; print(json.dumps(json.load(sys.stdin), ensure_ascii=False, indent=2))"

if [ "$STATUS" != "200" ]; then
    echo "FALLO: se esperaba HTTP 200."
    exit 1
fi
# El descargo se toma de app/clinical.py (no de la linea de comandos, por la
# misma razon de codificacion).
if ! echo "$BODY" | "$PYTHON" -c "import json, sys; from app.clinical import DESCARGO_MEDICO; r = json.load(sys.stdin)['respuesta']; sys.exit(0 if r.strip() and DESCARGO_MEDICO in r else 1)"; then
    echo "FALLO: la respuesta esta vacia o no incluye el descargo medico."
    exit 1
fi

echo ""
echo "OK: 200, respuesta no vacia y con descargo medico."
