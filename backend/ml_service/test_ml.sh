#!/usr/bin/env bash
# GlucoTracker - script de prueba end-to-end del servicio de ML (riesgo de hipoglucemia).
#
# Dos variantes:
#   ./test_ml.sh         modelo REAL   (ML_MODELO=real, por defecto)
#   ./test_ml.sh demo    modelo entrenado con datos SINTETICOS (ML_MODELO=demo, ADR-0009).
#                        Aprende las reglas del equipo, no la realidad: no es una
#                        estimacion clinica.
# (tambien: MODELO=demo ./test_ml.sh)
#
# Que hace:
#   1. Entrena el modelo de la variante SOLO si falta su .pkl:
#        real -> python -m app.train_baseline
#        demo -> python -m app.sintetico.generar (si falta el CSV) y python -m app.train_demo
#   2. Levanta el servicio con uvicorn en el puerto 8002 (sin --env-file: no lee el .env)
#      y espera a que /health responda.
#   3. Prueba GET /health y POST /api/riesgo/hipoglucemia con un paciente SIMULADO
#      (valores inventados): 200, solo las claves del contrato {riesgo_hipoglucemia,
#      version_modelo}, probabilidad entre 0 y 1, y que el cuerpo no diga "demo" ni
#      "sintetico" (el contrato publico no revela el modelo; la version del sintetico es neutra, 1.1.0
#      como version_modelo).
#   4. Prueba una entrada invalida: 422 generico que no repite lo enviado.
#   5. Se apaga solo al terminar (tambien si algo falla).
#
# Uso:
#   cd backend/ml_service
#   ./test_ml.sh [real|demo]            # puerto 8002 por defecto
#   PORT=8012 ./test_ml.sh demo
#
# Requisitos: venv del servicio con requirements-dev.txt instalado (.venv/),
# curl disponible y, si el modelo real no esta entrenado, el Excel en
# data/raw/ShanghaiT2DM_Summary.xlsx.

set -euo pipefail

cd "$(dirname "$0")"
PORT="${PORT:-8002}"
BASE_URL="http://127.0.0.1:${PORT}"
MODELO="${1:-${MODELO:-real}}"

if [ "$MODELO" != "real" ] && [ "$MODELO" != "demo" ]; then
    echo "Uso: ./test_ml.sh [real|demo]"
    exit 2
fi

if [ -x .venv/Scripts/python.exe ]; then
    PYTHON=.venv/Scripts/python.exe   # Windows (Git Bash)
elif [ -x .venv/bin/python ]; then
    PYTHON=.venv/bin/python           # Linux/macOS
else
    echo "No se encontro el venv del servicio en backend/ml_service/.venv (ver README.md)."
    exit 1
fi

echo "== 1. Modelo (${MODELO}) =="
if [ "$MODELO" = "real" ]; then
    if [ -f app/artefactos/modelo_hipoglucemia.pkl ]; then
        echo "Ya existe app/artefactos/modelo_hipoglucemia.pkl: no se vuelve a entrenar."
    else
        echo "No existe el .pkl: entrenando el modelo baseline."
        "$PYTHON" -m app.train_baseline
    fi
else
    if [ -f app/artefactos/demo/modelo_hipoglucemia_demo.pkl ]; then
        echo "Ya existe app/artefactos/demo/modelo_hipoglucemia_demo.pkl: no se vuelve a entrenar."
    else
        if [ ! -f data/sintetico/dataset_sintetico.csv ]; then
            echo "No existe el dataset sintetico: generandolo (semilla 20261024)."
            "$PYTHON" -m app.sintetico.generar --n 2000 --semilla 20261024 --salida data/sintetico/dataset_sintetico.csv
        fi
        echo "No existe el .pkl del modelo entrenado con datos sinteticos: entrenando."
        "$PYTHON" -m app.train_demo
    fi
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
echo "== 2. Levantando el servicio de ML (ML_MODELO=${MODELO}) en ${BASE_URL} =="
ML_MODELO="$MODELO" "$PYTHON" -m uvicorn app.main:app --port "$PORT" --log-level warning &
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
if ! echo "$HEALTH" | head -n 1 | "$PYTHON" -c "import json, sys; r = json.load(sys.stdin); sys.exit(0 if set(r) == {'status', 'service', 'modelo_cargado'} and r['modelo_cargado'] is True else 1)"; then
    echo "FALLO: /health debe tener solo {status, service, modelo_cargado} y el modelo cargado."
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
# Forma exacta del contrato; el cuerpo (sin version_modelo) no dice demo ni sintetico.
if ! echo "$BODY" | MODELO="$MODELO" "$PYTHON" -c "
import json, os, re, sys
r = json.load(sys.stdin)
version = r.pop('version_modelo', None)
claves_ok = set(r) == {'riesgo_hipoglucemia'} and version
rango_ok = claves_ok and isinstance(r['riesgo_hipoglucemia'], float) and 0 <= r['riesgo_hipoglucemia'] <= 1
sin_palabras = not re.search(r'demo|sint[eé]tic', json.dumps(r), re.I)
sufijo_ok = 'demo' not in str(version).lower() and (str(version) == '1.1.0') == (os.environ['MODELO'] == 'demo')
sys.exit(0 if rango_ok and sin_palabras and sufijo_ok else 1)
"; then
    echo "FALLO: la respuesta no tiene la forma {riesgo_hipoglucemia (0-1), version_modelo}, trae campos de mas, o la version no corresponde al modelo (${MODELO})."
    exit 1
fi

echo ""
echo "== 5. Entrada invalida: 422 generico =="
RESP_422=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/riesgo/hipoglucemia" \
  -H "Content-Type: application/json" -d '{"glucosa": 68, "momento": "madrugada"}')
echo "$RESP_422"
if [ "$(echo "$RESP_422" | tail -n 1)" != "422" ]; then
    echo "FALLO: se esperaba HTTP 422."
    exit 1
fi
if echo "$RESP_422" | head -n 1 | grep -qiE "madrugada|demo|sint[eé]tic"; then
    echo "FALLO: el 422 repite lo enviado o nombra el modelo."
    exit 1
fi

echo ""
echo "OK (${MODELO}): /health 200, riesgo 200 con la forma del contrato y 422 generico ante entrada invalida."
