#!/usr/bin/env bash
# GlucoTracker - script de prueba end-to-end del servicio de ML (riesgo de hipoglucemia).
#
# Que hace:
#   1. Entrena el modelo (python -m app.train_baseline) SOLO si no existe ya
#      app/artefactos/modelo_hipoglucemia.pkl.
#   2. Levanta el servicio con uvicorn en el puerto 8002 (sin --env-file: no
#      lee el .env) y espera a que /health responda.
#   3. Prueba GET /health y POST /api/riesgo/hipoglucemia con un paciente
#      SIMULADO (valores inventados) y comprueba 200, el rango de la
#      probabilidad, la version del modelo y que no haya campo 'alerta'.
#   4. Se apaga solo al terminar (tambien si algo falla).
#
# Uso:
#   cd backend/ml_service
#   ./test_ml.sh              # puerto 8002 por defecto
#   PORT=8012 ./test_ml.sh
#
# Requisitos: venv del servicio con requirements-dev.txt instalado (.venv/),
# curl disponible y, si el modelo no esta entrenado, el Excel en
# data/raw/ShanghaiT2DM_Summary.xlsx.

set -euo pipefail

cd "$(dirname "$0")"
PORT="${PORT:-8002}"
BASE_URL="http://127.0.0.1:${PORT}"

if [ -x .venv/Scripts/python.exe ]; then
    PYTHON=.venv/Scripts/python.exe   # Windows (Git Bash)
elif [ -x .venv/bin/python ]; then
    PYTHON=.venv/bin/python           # Linux/macOS
else
    echo "No se encontro el venv del servicio en backend/ml_service/.venv (ver README.md)."
    exit 1
fi

echo "== 1. Modelo =="
if [ -f app/artefactos/modelo_hipoglucemia.pkl ]; then
    echo "Ya existe app/artefactos/modelo_hipoglucemia.pkl: no se vuelve a entrenar."
else
    echo "No existe el .pkl: entrenando el modelo baseline."
    "$PYTHON" -m app.train_baseline
fi

if curl -s -o /dev/null "${BASE_URL}/health"; then
    echo "El puerto ${PORT} ya esta en uso (otro servicio corriendo). Detenlo o usa PORT=<otro> ./test_ml.sh"
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

echo ""
echo "== 2. Levantando el servicio de ML en ${BASE_URL} =="
"$PYTHON" -m uvicorn app.main:app --port "$PORT" --log-level warning &
SERVER_PID=$!
trap detener_servidor EXIT

for _ in $(seq 1 60); do
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
echo "== 3. GET /health =="
HEALTH=$(curl -s -w "\n%{http_code}" "${BASE_URL}/health")
echo "$HEALTH"
if [ "$(echo "$HEALTH" | tail -n 1)" != "200" ]; then
    echo "FALLO: /health no respondio 200."
    exit 1
fi

echo ""
echo "== 4. POST /api/riesgo/hipoglucemia con un paciente simulado =="
BODY_FILE=$(mktemp)
STATUS=$(curl -s -o "$BODY_FILE" -w "%{http_code}" -X POST "${BASE_URL}/api/riesgo/hipoglucemia" \
  -H "Content-Type: application/json" \
  -d '{
        "glucosa": 68,
        "momento": "ayunas",
        "genero": "femenino",
        "edad": 61,
        "bmi": 26.4,
        "duracion_diabetes": 12,
        "categoria_medicacion": "insulina",
        "com_hipertension": true,
        "com_dislipidemia": false,
        "com_renal": false,
        "com_neuropatia": true,
        "com_nefropatia": false,
        "com_cardiovascular": false,
        "hba1c": 8.1
      }')
BODY=$(cat "$BODY_FILE")
rm -f "$BODY_FILE"
echo "HTTP ${STATUS}"
echo "$BODY" | "$PYTHON" -m json.tool

if [ "$STATUS" != "200" ]; then
    echo "FALLO: se esperaba HTTP 200."
    exit 1
fi
if ! echo "$BODY" | "$PYTHON" -c "import json, sys; r = json.load(sys.stdin); ok = set(r) == {'riesgo_hipoglucemia', 'version_modelo'} and 0 <= r['riesgo_hipoglucemia'] <= 1 and r['version_modelo']; sys.exit(0 if ok else 1)"; then
    echo "FALLO: la respuesta no tiene la forma {riesgo_hipoglucemia (0-1), version_modelo} o incluye campos de mas."
    exit 1
fi

echo ""
echo "== 5. Entrada invalida: 422 generico =="
STATUS_422=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/riesgo/hipoglucemia" \
  -H "Content-Type: application/json" -d '{"glucosa": 68, "momento": "madrugada"}')
echo "HTTP ${STATUS_422}"
if [ "$STATUS_422" != "422" ]; then
    echo "FALLO: se esperaba HTTP 422."
    exit 1
fi

echo ""
echo "OK: /health 200, riesgo 200 con la forma correcta (sin alerta) y 422 ante entrada invalida."
