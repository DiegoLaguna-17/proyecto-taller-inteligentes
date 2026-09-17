#!/usr/bin/env bash
# GlucoTracker - script de prueba end-to-end del modelo de riesgo de hipoglucemia.
#
# Que hace:
#   1. Entrena el modelo baseline (Regresion Logistica) y genera
#      app/ml/modelo_hipoglucemia.pkl + app/ml/baseline_metrics.json.
#   2. Levanta la API (si no esta corriendo, avisa como levantarla).
#   3. Prueba el endpoint POST /api/riesgo/hipoglucemia con un paciente simulado.
#
# Uso:
#   cd backend
#   ./test_ml.sh
#
# Requisitos: dependencias instaladas (pip install -r requirements.txt) y
# el archivo backend/data/raw/ShanghaiT2DM_Summary.xlsx presente.

set -e

echo "== 1. Entrenando el modelo baseline =="
python -m app.ml.train_baseline

echo ""
echo "== 2. Verificando que la API este corriendo en http://localhost:8000 =="
if ! curl -s -o /dev/null -w "" http://localhost:8000/health; then
    echo "La API no responde en localhost:8000."
    echo "Levantala en otra terminal con:"
    echo "    uvicorn app.main:app --reload"
    exit 1
fi
echo "API activa."

echo ""
echo "== 3. Probando POST /api/riesgo/hipoglucemia con un paciente simulado =="
curl -s -X POST "http://localhost:8000/api/riesgo/hipoglucemia" \
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
      }' | python -m json.tool

echo ""
echo "Listo."
