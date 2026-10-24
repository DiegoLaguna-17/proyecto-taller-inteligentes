# Modelo base (baseline) — Riesgo de hipoglucemia

Documenta el pipeline reproducible, la justificación del modelo elegido y la evidencia cuantitativa de la primera línea base del componente de ML de GlucoTracker.

## 1. Pipeline reproducible

```
backend/ml_service/                         # servicio de ML (ADR-0008); desde la fase M5a el código del modelo vive aquí
├── data/raw/ShanghaiT2DM_Summary.xlsx     # dataset fuente (ver docs/data_ecosystem.md)
└── app/
    ├── data_prep.py        # limpieza clinica + construccion de features (Partes A y B del EDA)
    ├── train_baseline.py   # entrenamiento, evaluacion y persistencia del modelo
    ├── predict.py          # inferencia (carga verificada con huella y versiones)
    ├── cv_evaluacion.py    # validación cruzada agrupada + bootstrap + referencias (M2/M2b)
    └── artefactos/         # modelo_hipoglucemia.pkl (fuera de git), modelo_hipoglucemia.json (metadatos, en git),
                            # cv_metrics.json (solo agregados, en git) y baseline_metrics.json
```

Para reproducir el entrenamiento desde cero, con el dataset fuente ya en `backend/ml_service/data/raw/` y un entorno virtual propio del servicio:

```bash
cd backend/ml_service
python -m venv .venv && source .venv/Scripts/activate
pip install -r requirements-dev.txt
python -m app.train_baseline
```

Esto entrena el modelo y genera, en `app/artefactos/`, `modelo_hipoglucemia.pkl` (fuera de git), `modelo_hipoglucemia.json` (metadatos con la huella SHA-256 del `.pkl` y las versiones de las librerías; en git) y `baseline_metrics.json` — no requiere ningún paso manual ni notebook intermedio. Las versiones están fijadas en `requirements.txt` (ML-D7, RT-06).

## 2. Modelo elegido y justificación

**Regresión Logística**, dentro de un `Pipeline` de `imblearn` (`SMOTE-NC → escalado/one-hot → clasificador`). Se eligió como línea base y no un modelo de mayor capacidad (ej. red neuronal) por tres razones:

1. **Tamaño de muestra pequeño** (100 pacientes, 109 registros, solo 10 registros positivos; 17 filas positivas a nivel de lectura, ver `docs/data_ecosystem.md` §3): la regla de eventos-por-variable de Peduzzi et al. (1996) advierte que modelos complejos con pocos eventos reales sobreajustan más fácilmente que un modelo lineal con pocos parámetros.
2. **Interpretabilidad clínica**: cada coeficiente se traduce a un *odds ratio* — el estándar en modelos de predicción clínica (Steyerberg, *Clinical Prediction Models*, 2019), y un requisito razonable para un modelo de salud que necesita poder explicarse.
3. **Da `predict_proba` de forma nativa**, que es exactamente el contrato que expone el endpoint (`riesgo_hipoglucemia: float`).

El notebook incluye el código de una comparación con un Random Forest bajo el mismo esquema de pipeline: Parte D, celda **D1** (índice 45 del `.ipynb`), y tabla comparativa en la celda **E1** (índice 50). Sin embargo, el notebook está guardado **sin salidas**: ninguna de sus 23 celdas de código tiene resultado registrado. Por eso **no hay evidencia documentada** de cómo se comparan ambos modelos, y este documento no afirma ninguna conclusión al respecto. La comparación formal contra un árbol de decisión y un Random Forest, con las mismas semillas y validación cruzada agrupada, se hizo en la fase M2 y está en la sección 4.1: ninguna variante supera el azar y ninguna se distingue de la línea base (ML-D2; ver ADR-0007).

## 3. Evaluación sin fuga de datos

El split usa `GroupShuffleSplit` **agrupado por `id_paciente_real`** (no por fila). Cada registro aporta hasta 2 filas (ayunas y postprandial), y un paciente puede tener hasta 3 registros. Todas las filas de un paciente quedan siempre del mismo lado del split. Se verifica explícitamente en `train_baseline.py` que ningún paciente aparece simultáneamente en train y test.

`SMOTE-NC` se ejecuta **solo dentro de `.fit()`** (garantía del `Pipeline` de `imblearn`, no de disciplina manual) — el conjunto de test evaluado es **100% real**, nunca contaminado con datos sintéticos.

## 4. Métricas de la línea base actual

Generadas automáticamente en `backend/ml_service/app/artefactos/baseline_metrics.json` (y dentro de `modelo_hipoglucemia.json`) al correr `train_baseline.py` (`random_state=42`). Reproducidas el 2026-10-24 entrenando en memoria, sin escribir artefactos, con scikit-learn 1.5.2, pandas 2.2.3, numpy 2.5.4, imbalanced-learn 0.14.2, joblib 1.6.0 y openpyxl 3.1.5: mismos valores y misma matriz. Reproducidas de nuevo en el entorno del servicio de ML (fase M5a: numpy 2.4.6, scipy 1.15.3, resto igual): AUC 0.6404, recall 0.4286 y la misma matriz de confusión.

| Métrica | Valor |
|---|---|
| AUC-ROC | 0.640 |
| Precision (clase hipoglucemia) | 0.429 |
| Recall (clase hipoglucemia) | 0.429 |
| F1 (clase hipoglucemia) | 0.429 |
| Train | **157 filas** (lecturas), 10 filas positivas reales antes de SMOTE-NC, de 77 pacientes (6 con alguna fila positiva) |
| Test | **36 filas** (lecturas), 7 filas positivas, 100% reales, de 20 pacientes (4 con alguna fila positiva) |

Todos los conteos de esta tabla son **filas a nivel de lectura**, no pacientes ni registros. El total es de 193 filas y 97 pacientes: los 3 registros sin ninguna glucosa no generan filas.

Matriz de confusión (test):

| | Predicho: no | Predicho: hipo |
|---|---|---|
| **Real: no** | 25 | 4 |
| **Real: hipo** | 4 | 3 |

**Lectura honesta de estos números:** son los de **un único split** con 7 filas positivas de 4 pacientes. Un AUC de 0.64 en un split así es compatible con el azar, y la validación cruzada de la sección 4.1 lo confirma: el intervalo del AUC incluye 0.5. Estas cifras se conservan (no se cambian) porque son reproducibles y documentan el punto de partida, pero **no son evidencia de que el modelo discrimine**. El dataset tiene solo 10 registros positivos, de 10 pacientes (17 filas positivas en total).

### 4.1 Validación cruzada agrupada por paciente (fases M2 y M2b)

Generada por `python -m app.cv_evaluacion` desde `backend/ml_service/` (`app/artefactos/cv_metrics.json`, versionado). Esquema: `StratifiedKFold` k=5 sobre **pacientes** (etiqueta: algún registro positivo), cada paciente entero de un lado, repetido con 5 semillas de partición (0 a 4), SMOTE-NC solo dentro del train de cada fold (cuando la variante lo usa). Cada fold de test tiene exactamente 2 pacientes con algún registro positivo. Métricas calculadas sobre las predicciones fuera de fold y promediadas entre repeticiones; **intervalo de 95% por bootstrap percentil de 1000 remuestreos de pacientes**. Dataset: 193 filas (17 positivas), 97 pacientes (10 con algún registro positivo); prevalencia de filas positivas 0.088 [0.039, 0.146].

`StratifiedGroupKFold` k=5 no se usó: estratifica por filas y, en 13 de 20 semillas probadas, dejó folds de test sin ningún positivo.

Formato: media [IC 95%]. "Lift" = precisión / prevalencia; 1.0 equivale a marcar filas al azar.

| Fila | Tipo | AUC-ROC | Límite inferior del AUC > 0.5 |
|---|---|---|---|
| `rl_smote` — Regresión Logística + SMOTE-NC (línea base) | modelo | 0.631 [0.421, 0.796] | no |
| `rl_sin_smote` — Regresión Logística sin SMOTE-NC | modelo | 0.639 [0.405, 0.838] | no |
| `rl_balanced` — Regresión Logística, `class_weight='balanced'` | modelo | 0.571 [0.352, 0.767] | no |
| `arbol_balanced` — Árbol (max_depth 3, min_samples_leaf 5), `balanced` | modelo | 0.551 [0.415, 0.686] | no |
| `rf_balanced` — Random Forest (300 árboles, max_depth 5, min_samples_leaf 3), `balanced` | modelo | 0.589 [0.406, 0.762] | no |
| `ref_prevalencia` — puntaje constante | referencia | 0.500 [0.500, 0.500] | no (no puede) |
| `ref_medicacion` — puntaje = `medicacion_cod`, sin ajustar | referencia | 0.462 [0.297, 0.640] | no |

Recall, precisión y lift por umbral (los modelos usan los cortes 0.25 y 0.5, **sin validez clínica**, ver ML-D4; la regla por medicación usa sus cortes naturales `>=1`, `>=2`, `>=3`):

| Fila | Umbral | Recall | Precisión | Lift |
|---|---|---|---|---|
| `rl_smote` | 0.25 | 0.412 [0.150, 0.660] | 0.141 [0.037, 0.255] | 1.598 [0.635, 2.689] |
| `rl_smote` | 0.5 | 0.235 [0.062, 0.433] | 0.139 [0.028, 0.275] | 1.580 [0.436, 2.915] |
| `rl_sin_smote` | 0.25 | 0.118 [0.050, 0.178] | 0.148 [0.038, 0.304] | 1.679 [0.682, 3.204] |
| `rl_sin_smote` | 0.5 | 0.000 [0.000, 0.000] | 0.000 [0.000, 0.000] | 0.000 [0.000, 0.000] |
| `rl_balanced` | 0.25 | 0.612 [0.316, 0.877] | 0.099 [0.034, 0.168] | 1.129 [0.592, 1.603] |
| `rl_balanced` | 0.5 | 0.435 [0.185, 0.678] | 0.139 [0.042, 0.242] | 1.574 [0.702, 2.437] |
| `arbol_balanced` | 0.25 | 0.329 [0.067, 0.567] | 0.117 [0.018, 0.221] | 1.332 [0.298, 2.278] |
| `arbol_balanced` | 0.5 | 0.329 [0.067, 0.567] | 0.118 [0.018, 0.223] | 1.344 [0.300, 2.300] |
| `rf_balanced` | 0.25 | 0.388 [0.116, 0.640] | 0.138 [0.033, 0.246] | 1.566 [0.515, 2.541] |
| `rf_balanced` | 0.5 | 0.012 [0.000, 0.037] | 0.067 [0.000, 0.200] | 0.757 [0.000, 2.614] |
| `ref_prevalencia` | 0.25 / 0.5 | 1.000 [1.000, 1.000] | 0.088 [0.039, 0.146] | 1.000 [1.000, 1.000] |
| `ref_medicacion` | >=1 | 1.000 [1.000, 1.000] | 0.092 [0.040, 0.150] | 1.043 [1.010, 1.089] |
| `ref_medicacion` | >=2 | 0.471 [0.154, 0.792] | 0.070 [0.016, 0.133] | 0.790 [0.271, 1.304] |
| `ref_medicacion` | >=3 | 0.471 [0.154, 0.792] | 0.079 [0.019, 0.151] | 0.899 [0.306, 1.505] |

La referencia constante marca a todas las filas como positivas: su AUC es 0.5, su recall 1.0 y su precisión es exactamente la prevalencia (lift 1.0). Eso confirma que el cálculo de métricas, del lift y del bootstrap es correcto. Las dos referencias **no entran en la regla de cambio de modelo de ML-D2**: son solo contexto.

**Interpretación honesta**

- **Ninguna variante supera el azar con estos datos.** En las cinco variantes el límite inferior del IC del AUC queda por debajo de 0.5 (de 0.352 a 0.421). Los IC del AUC de todas se solapan con el de la línea base, así que, por la regla de ML-D2, **no se cambia de modelo**: no hay evidencia de que otro gane, ni de que la línea base discrimine.
- **La precisión es cercana a la prevalencia.** La prevalencia de filas positivas es 0.088 y las precisiones de los modelos van de 0.07 a 0.15 (0 cuando no marcan nada): el lift medio va de 0.76 a 1.68, pero **el IC de lift de todo umbral que marca casos incluye 1.0** (el más ajustado, `rl_balanced` a 0.25, es [0.592, 1.603]). Marcar filas con el modelo no es distinguible de marcarlas al azar.
- **El recall alto no es mérito del modelo.** `rl_balanced` a 0.25 alcanza recall 0.612 porque marca una fracción grande de filas; su precisión (0.099) y su lift (1.129) están en el nivel del azar. `rl_sin_smote` a 0.5 y `rf_balanced` a 0.5 casi nunca marcan nada (recall 0.000 y 0.012).
- **La regla por medicación no supera a la línea base.** Su AUC es 0.462 [0.297, 0.640] frente a 0.631 [0.421, 0.796]: la media es menor y los IC se solapan. Tampoco supera el azar (su IC incluye 0.5). Su corte `>=1` marca a casi todas las filas (lift 1.043) y los cortes `>=2` y `>=3` quedan con lift por debajo de 1. Un criterio clínico trivial no hace mejor que el modelo, y el modelo no hace mejor que el azar de forma demostrable.
- **El AUC por fold es muy inestable** (por ejemplo, de 0.15 a 0.91 en la línea base): con 2 pacientes positivos por fold de test, un solo paciente mueve la métrica por completo.

**El modelo se mantiene como experimental**: su probabilidad es solo informativa (REQ-004, ML-D4), no dispara alertas y no debe presentarse al médico como una predicción validada. TASK-010b (umbral y calibración) queda en espera: no procede mientras el modelo no supere el azar.

Límites de esta evidencia: ver la sección 5 (n pequeño, mediana de HbA1c calculada con todo el dataset, hiperparámetros del árbol y el Random Forest fijados sin ajustar).

## 5. Limitaciones conocidas y próximos pasos

- **n pequeño → alta varianza de las métricas.** El test tiene 7 filas positivas que vienen de solo 4 pacientes. Mover una sola fila cambia el recall en ~14 puntos porcentuales, y un paciente puede aportar varias filas positivas, así que las filas no son independientes. La validación cruzada agrupada de la sección 4.1 mejora esto (cada fold de test tiene 2 pacientes positivos reales), pero sigue siendo muy poco: el AUC por fold varía de 0.15 a 0.91 y los intervalos son anchos. Cualquier mejora futura debe medirse con ese mismo esquema (ML-D3) y con intervalos, no con un split.
- **Comparación de modelos (ML-D2), hecha en M2:** la Regresión Logística con SMOTE-NC es la línea base. Se comparó con la misma regresión sin SMOTE-NC y con `class_weight='balanced'`, un árbol de decisión y un Random Forest bajo las mismas semillas y folds. Los IC se solapan con los de la línea base y ninguno supera el azar: no se cambia de modelo. Los hiperparámetros del árbol y del Random Forest se fijaron antes de ver resultados y no se ajustaron; un árbol o bosque ajustado con tan pocos positivos tendría más riesgo de sobreajuste que de mejora, pero esto no se probó. Ver ADR-0007.
- **Mediana de HbA1c calculada con todo el dataset (fuga leve heredada, RD-05):** `preparar_features` imputa la mediana de HbA1c antes de partir en folds, así que esa mediana incluye filas de test. No se corrigió para no cambiar la semántica de `data_prep.py`. El efecto sobre las métricas no se midió; si existe, las infla, por lo que no cambia la conclusión de que ninguna variante supera el azar. Las referencias sin entrenamiento no usan HbA1c.
- **Brier y calibración:** no se calcularon. Pasan a TASK-010b, que queda en espera porque no procede mientras el modelo no supere el azar.
- **Cobertura de `momento`:** el modelo cubre `ayunas` y `postprandial` (los dos momentos con dato real en ShanghaiT2DM). `antes de dormir` no tiene equivalente en este dataset: para esa franja el modelo no tiene datos, y la única señal es la clasificación ADA de la lógica de negocio del backend (no ML) hasta conseguir datos que la cubran.
- **Umbral de decisión sin calibrar (ML-D4):** el endpoint antiguo del backend usaba 0.5/0.25 como cortes iniciales para "Alta"/"Media"/"Baja"; esos cortes **no tenían validez clínica** y se retiraron junto con el endpoint (TASK-011e). El recall mínimo y el umbral de "Alta" solo se fijarían con revisión clínica, priorizando recall (un falso negativo es más costoso que una falsa alarma), y solo si el modelo llegara a superar el azar (TASK-010b, en espera). El modelo es **experimental, solo informativo y visible solo para el médico** (REQ-004), y el servicio de ML devuelve solo la probabilidad y la versión, sin nivel de alerta (`design.md` § Servicio de ML).
- **Calibración de probabilidades:** SMOTE-NC cambia la prevalencia vista en el entrenamiento, así que `predict_proba` sobreestima la probabilidad real. Hay que evaluar la calibración (curva de calibración, Brier) en M2 antes de presentar la probabilidad como tal.
- **Etiqueta por registro (ML-D6):** el target es "hipoglucemia observada en el registro" (ver `docs/data_ecosystem.md` §4), no un atributo del paciente.
- **HbA1c como campo opcional:** decisión de producto documentada en `docs/data_ecosystem.md` §4 — el modelo funciona sin este dato (bandera de faltante + imputación), pero se beneficia de él cuando está disponible.

## Referencias

- Peduzzi et al. (1996). *Journal of Clinical Epidemiology*.
- Steyerberg, E. (2019). *Clinical Prediction Models*. Springer.
