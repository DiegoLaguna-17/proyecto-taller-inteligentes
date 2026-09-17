# Modelo base (baseline) — Riesgo de hipoglucemia

Documenta el pipeline reproducible, la justificación del modelo elegido y la evidencia cuantitativa de la primera línea base del componente de ML de GlucoTracker.

## 1. Pipeline reproducible

```
backend/
├── data/raw/ShanghaiT2DM_Summary.xlsx     # dataset fuente (ver docs/data_ecosystem.md)
└── app/ml/
    ├── data_prep.py        # limpieza clinica + construccion de features (Partes A y B del EDA)
    ├── train_baseline.py   # entrenamiento, evaluacion y persistencia del modelo
    ├── predict.py          # inferencia en produccion (usado por el endpoint)
    ├── riesgo.py            # endpoint FastAPI POST /api/riesgo/hipoglucemia
    └── baseline_metrics.json  # métricas generadas automáticamente al entrenar
```

Para reproducir el entrenamiento desde cero, con el dataset fuente ya en `backend/data/raw/`:

```bash
cd backend
pip install -r requirements.txt
python -m app.ml.train_baseline
```

Esto entrena el modelo y genera `app/ml/modelo_hipoglucemia.pkl` y `app/ml/baseline_metrics.json` — no requiere ningún paso manual ni notebook intermedio.

## 2. Modelo elegido y justificación

**Regresión Logística**, dentro de un `Pipeline` de `imblearn` (`SMOTE-NC → escalado/one-hot → clasificador`). Se eligió como línea base y no un modelo de mayor capacidad (ej. red neuronal) por tres razones:

1. **Tamaño de muestra pequeño** (109 pacientes reales, 17 positivos): la regla de eventos-por-variable de Peduzzi et al. (1996) advierte que modelos complejos con pocos eventos reales sobreajustan más fácilmente que un modelo lineal con pocos parámetros.
2. **Interpretabilidad clínica**: cada coeficiente se traduce a un *odds ratio* — el estándar en modelos de predicción clínica (Steyerberg, *Clinical Prediction Models*, 2019), y un requisito razonable para un modelo de salud que necesita poder explicarse.
3. **Da `predict_proba` de forma nativa**, que es exactamente el contrato que expone el endpoint (`riesgo_hipoglucemia: float`).

Se comparó además contra un Random Forest bajo el mismo esquema de pipeline (ver notebook, Parte D) — sin evidencia de que supere al baseline en la métrica clínicamente relevante (recall), lo que refuerza la elección de la Regresión Logística en esta etapa.

## 3. Evaluación sin fuga de datos

El split usa `GroupShuffleSplit` **agrupado por `id_paciente_real`** (no por fila): un mismo paciente puede aportar hasta 2 lecturas (ayunas/postprandial), y ambas quedan siempre del mismo lado del split. Se verifica explícitamente en `train_baseline.py` que ningún paciente aparece simultáneamente en train y test.

`SMOTE-NC` se ejecuta **solo dentro de `.fit()`** (garantía del `Pipeline` de `imblearn`, no de disciplina manual) — el conjunto de test evaluado es **100% real**, nunca contaminado con datos sintéticos.

## 4. Métricas de la línea base actual

Generadas automáticamente en `app/ml/baseline_metrics.json` al correr `train_baseline.py` (`random_state=42`):

| Métrica | Valor |
|---|---|
| AUC-ROC | 0.640 |
| Precision (clase hipoglucemia) | 0.429 |
| Recall (clase hipoglucemia) | 0.429 |
| F1 (clase hipoglucemia) | 0.429 |
| Filas de entrenamiento | 157 (10 positivos reales antes de SMOTE-NC) |
| Filas de test | 36 (7 positivos, 100% reales) |

Matriz de confusión (test):

| | Predicho: no | Predicho: hipo |
|---|---|---|
| **Real: no** | 25 | 4 |
| **Real: hipo** | 4 | 3 |

**Lectura honesta de estos números:** un AUC de 0.64 indica una señal discriminativa modesta pero real (por encima de 0.5 = azar). No es un resultado sobresaliente, y no se presenta como tal — es la línea base cuantitativa esperable dado que el dataset tiene solo 17 pacientes positivos en total. El valor de este resultado no es "el número en sí", sino que **existe, es reproducible, y sirve como punto de comparación** contra cualquier iteración futura (más datos, ajuste de umbral, otro modelo).

## 5. Limitaciones conocidas y próximos pasos

- **n pequeño → alta varianza de las métricas.** Con solo 7 positivos en test, mover la clasificación de un solo paciente cambia el recall en ~14 puntos porcentuales. Antes de declarar cualquier mejora "real" entre iteraciones, se necesita validación cruzada agrupada (`GroupKFold`), no un solo split.
- **Cobertura de `momento`:** el modelo cubre `ayunas` y `postprandial` (los dos momentos con dato real en ShanghaiT2DM). `antes de dormir` no tiene equivalente en este dataset — para esa franja, el sistema se apoya únicamente en el motor de reglas ADA hasta conseguir datos que la cubran.
- **Umbral de decisión sin calibrar:** el endpoint usa 0.5/0.25 como cortes iniciales para "Alta"/"Media"/"Baja" (ver `_clasificar_alerta` en `app/ml/riesgo.py`) — pendiente de recalibrar priorizando recall (en un contexto de salud, un falso negativo es más costoso que una falsa alarma).
- **HbA1c como campo opcional:** decisión de producto documentada en `docs/data_ecosystem.md` §4 — el modelo funciona sin este dato (bandera de faltante + imputación), pero se beneficia de él cuando está disponible.

## Referencias

- Peduzzi et al. (1996). *Journal of Clinical Epidemiology*.
- Steyerberg, E. (2019). *Clinical Prediction Models*. Springer.
