# 7. Regresión Logística con SMOTE-NC como línea base del riesgo de hipoglucemia

* **Estado:** Aceptado (reemplaza a [ADR-0004](0004-modelo-clasificacion-baseline.md))
* **Fecha de decisión:** 2026-10-24
* **Autores:** Equipo GlucoTracker (decisiones ML-D1, ML-D2 y ML-D3)

## Contexto y Problema
ADR-0004 eligió un Árbol de Decisión o un SVC para **clasificar** cada lectura como Normal, Riesgo Hipo o Riesgo Hiper. Dos cosas cambiaron:

1. **El problema** (ML-D1, REQ-004 v1.1.0). El modelo ya no clasifica lecturas: estima la **probabilidad de hipoglucemia observada en el registro** (ML-D6) a partir de una lectura (glucosa y momento del día) y del perfil clínico del paciente. La clasificación Normal/Hipo/Hiper con umbrales ADA la hace la lógica de negocio del backend, no el ML (ML-D5).
2. **El código.** Lo que está implementado y es reproducible (`backend/ml_service/app/train_baseline.py`) es una Regresión Logística dentro de un `Pipeline` de `imblearn` (SMOTE-NC, escalado y one-hot, y el clasificador). Las métricas están documentadas en `docs/model_baseline.md` §4.

**Datos disponibles** (ShanghaiT2DM, verificado el 2026-10-24; `docs/data_ecosystem.md` §3):
- 100 pacientes, 109 registros y 10 registros positivos (10 pacientes con alguno).
- 193 filas a nivel de lectura, de las cuales 17 son positivas.
- 4 pacientes tienen visitas con etiquetas distintas.
- Con tan pocos eventos, la regla de eventos por variable (Peduzzi et al., 1996) pesa más que cualquier otra consideración.

## Alternativas Consideradas
1. **Regresión Logística + SMOTE-NC (elegida):**
   * Pros: pocos parámetros, más robusta con pocos eventos. Sus coeficientes se leen como *odds ratios* (estándar en modelos de predicción clínica, Steyerberg 2019). Entrega `predict_proba` de forma nativa, que es justo lo que exige REQ-004. Ya está implementada y es reproducible.
   * Contras: es lineal, así que no captura interacciones (por ejemplo, medicación con comorbilidades) salvo que se agreguen explícitamente. Las probabilidades se distorsionan por SMOTE-NC y hay que calibrarlas.
2. **SVC:**
   * Pros: buen margen de separación en espacios pequeños.
   * Contras: no da probabilidades nativas (requiere calibración de Platt, con validación interna adicional y pocos datos). Es poco interpretable con kernels no lineales y sensible a hiperparámetros con n pequeño.
3. **Árbol de decisión:**
   * Pros: reglas legibles.
   * Contras: con 10 registros positivos es muy inestable (cambios mínimos en los datos alteran el árbol), sus probabilidades son escalonadas y mal calibradas, y tiende a sobreajustar.
4. **Random Forest:**
   * Pros: captura no linealidades e interacciones, y es robusto a escalas.
   * Contras: tiene más capacidad de la que soportan 17 filas positivas, es menos interpretable y sus probabilidades suelen estar mal calibradas. El notebook tiene el código de una comparación (Parte D, celda D1, y tabla E1), pero **sin resultados guardados**, así que no hay evidencia a favor ni en contra.
5. **Redes neuronales:**
   * Contras: necesitan muchos más eventos de los disponibles, son las más propensas al sobreajuste y las menos explicables. Se descartan para esta etapa.

## Decisión Tomada
**ML-D2:** la **Regresión Logística con SMOTE-NC es la línea base de referencia.**
* En la validación (fase M2) se compara con un **árbol de decisión** y un **Random Forest**, con las mismas semillas, los mismos folds y el mismo pipeline.
* **Solo se cambia de modelo si otro gana con margen claro**, es decir, si el intervalo de confianza de la métrica principal no se solapa con el de la línea base. **En empate gana el más simple** (la Regresión Logística).

**ML-D3, protocolo de validación:**
* `StratifiedGroupKFold` o `GroupKFold` repetido, **agrupando por paciente** (`id_paciente_real`).
* **SMOTE-NC dentro de cada fold**, solo sobre el train de ese fold (lo garantiza el `Pipeline` de `imblearn`).
* **Intervalos de confianza por bootstrap sobre pacientes**: se remuestrean pacientes, no filas, porque las filas de un mismo paciente no son independientes.

**ML-D4:** el recall mínimo y el umbral de "Alta" **no se fijan en este ADR**. Se fijan después de ver los resultados de M2, con revisión clínica. Hasta entonces el modelo es **solo informativo**: no dispara alertas (REQ-004) y el servicio de ML devuelve solo la probabilidad.

## Consecuencias
* **Positivas:**
  * La documentación queda alineada con el código implementado (ADR-0004 decía otro algoritmo).
  * El modelo es interpretable para el médico y la probabilidad llega de forma nativa.
  * Hay un criterio explícito y verificable para cambiar de modelo, sin decisiones por intuición sobre un solo split.
* **Negativas / Riesgos asumidos:**
  * La métrica actual (AUC 0.640, recall 0.429) sale de **un solo split** con 7 filas positivas de 4 pacientes en test. Tiene una varianza muy alta y no permite afirmar mejoras (RIA-01, RD-04).
  * Las probabilidades no están calibradas (efecto de SMOTE-NC) y no hay umbral clínico (RIA-06). El modelo no puede usarse para decisiones automáticas.
  * La linealidad puede dejar señal sin capturar. Lo verifica M2 contra el árbol y el Random Forest.

**Limitaciones de datos (aceptadas, no resueltas por este ADR):**
* **Cohorte pequeña y de otra población** (Shanghái, diabetes tipo 2, entorno hospitalario). Puede no representar a los usuarios de GlucoTracker (RD-01). Hay que reentrenar con datos propios cuando existan.
* **La etiqueta es por registro**, no por lectura: las lecturas de un mismo registro comparten etiqueta aunque una sea baja y otra alta. El modelo aprende "perfil más lectura en un registro con hipoglucemia observada", no "esta lectura es una hipoglucemia".
* **Cobertura de `momento`:** solo hay ayunas y postprandial; "antes de dormir" no está representado.
* **Faltantes:** 3 registros no tienen ninguna glucosa y quedan fuera del entrenamiento. HbA1c es opcional (bandera más imputación).
* **Desbalance severo** (~9% positivos). `class_weight` sigue sin evaluarse como alternativa o complemento de SMOTE-NC (RD-02).

## Referencias
* Peduzzi et al. (1996). *Journal of Clinical Epidemiology*.
* Steyerberg, E. (2019). *Clinical Prediction Models*. Springer.
* `docs/model_baseline.md`, `docs/data_ecosystem.md`, `docs/risks.md`.
