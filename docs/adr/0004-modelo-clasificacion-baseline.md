# 4. Selección de Algoritmo Baseline para Clasificación de Riesgo Glucémico

* **Estado:** Reemplazado por [ADR-0007](0007-regresion-logistica-baseline.md)
* **Fecha de decisión:** 2026-08-17
* **Autores:** Equipo GlucoTracker

> **Nota (2026-10-24): este ADR fue reemplazado por [ADR-0007](0007-regresion-logistica-baseline.md) (Regresión Logística + SMOTE-NC).** El modelo implementado (`backend/ml_service/app/train_baseline.py`) es una Regresión Logística con SMOTE-NC, no un Árbol de Decisión ni un SVC, y el problema cambió: ya no se clasifica Normal/Hipo/Hiper, sino que se estima la probabilidad de hipoglucemia observada en el registro (REQ-004, ML-D1). La decisión vigente está en ADR-0007. El texto de abajo se conserva sin cambios como registro histórico.

## Contexto y Problema
Se requiere establecer un modelo predictivo inicial (línea base o *baseline*) capaz de clasificar el estado de glucosa del paciente cumpliendo con las exigencias de la rúbrica de datos y ML.

## Alternativas Consideradas
1. **Redes Neuronales Profundas:** Demasiado complejas y propensas a sobreajuste (overfitting) dado que no se cuenta inicialmente con un volumen masivo de datos reales propios.
2. **Árbol de Decisión / SVC  como Baseline:** Modelos ligeros, altamente interpretables y sencillos de integrar mediante `scikit-learn`.

## Decisión Tomada
Implementar un modelo ML Clásico basado en **Árbol de Decisión / SVC** como línea base reproducible inicial.

## Consecuencias
* **Positivas:** Facilidad de implementación, métricas interpretables y bajo costo computacional.
* **Negativas / Riesgos asumidos:** Capacidad predictiva limitada frente a dinámicas temporales complejas, lo cual es totalmente esperado y válido para una etapa de *baseline*.