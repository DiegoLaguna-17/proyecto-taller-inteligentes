# 6. Regresión Logística como Modelo Baseline (supera a ADR-0004)

* **Estado:** Aceptado
* **Fecha de decisión:** 2026-09-17
* **Autores:** Equipo GlucoTracker
* **Supera a:** ADR-0004 (Selección de Algoritmo Baseline para Clasificación de Riesgo Glucémico)

## Contexto y Problema

ADR-0004 había fijado como decisión un modelo de **Árbol de Decisión / SVC**. Durante la implementación del componente de ML (`backend/app/ml/train_baseline.py`) y el análisis exploratorio del dataset (ver `docs/data_ecosystem.md`), se identificó que el dataset real obtenido (ShanghaiT2DM, 109 pacientes, solo 17 con hipoglucemia registrada) cambia las condiciones bajo las cuales se había tomado la decisión original, por lo que el algoritmo efectivamente implementado y documentado en `docs/model_baseline.md` es una **Regresión Logística**, no un Árbol de Decisión ni un SVC. Este ADR formaliza y cierra esa divergencia.

## Alternativas Consideradas

1. **Árbol de Decisión / SVC (decisión original de ADR-0004):** Adecuados en general como modelos ligeros e interpretables, pero con mayor riesgo de sobreajuste que un modelo lineal cuando el número de eventos positivos reales es muy bajo (17 pacientes positivos).
2. **Random Forest:** Evaluado en el notebook de EDA (Parte D, ver `docs/model_baseline.md` §2) bajo el mismo esquema de pipeline, sin evidencia de que supere a la Regresión Logística en la métrica clínicamente relevante (recall).
3. **Regresión Logística:** Modelo lineal con menos parámetros, mayor robustez frente al sobreajuste en muestras pequeñas (regla de eventos-por-variable de Peduzzi et al., 1996), interpretabilidad clínica directa vía *odds ratio*, y soporte nativo de `predict_proba`, que es el contrato que expone el endpoint (`riesgo_hipoglucemia: float`).

## Decisión Tomada

Se confirma **Regresión Logística** (dentro de un `Pipeline` de `imblearn` con SMOTE-NC) como el algoritmo baseline del componente de riesgo de hipoglucemia, en reemplazo de la decisión de ADR-0004. La justificación completa, el pipeline reproducible y las métricas de esta línea base están documentados en `docs/model_baseline.md` y `docs/data_ecosystem.md` §5.

## Consecuencias

* **Positivas:** El registro de decisiones (ADR) queda consistente con el código y la documentación de métricas ya existentes (`docs/model_baseline.md`); se resuelve la discrepancia entre ADR-0004 y la implementación real.
* **Negativas / Riesgos asumidos:** Se hereda la limitación ya declarada en `docs/model_baseline.md` §5 — con un dataset tan pequeño, cualquier mejora entre iteraciones debe validarse con `GroupKFold`, no con un solo split.

## Referencias

* `docs/model_baseline.md` — pipeline, métricas y justificación técnica completa.
* `docs/data_ecosystem.md` §5 — justificación frente a la escasez de datos.
* Peduzzi et al. (1996). *Journal of Clinical Epidemiology*.
