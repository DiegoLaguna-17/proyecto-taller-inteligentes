# 4. Selección de Algoritmo Baseline para Clasificación de Riesgo Glucémico

* **Estado:** Aceptado
* **Fecha de decisión:** 2026-08-17
* **Autores:** Equipo GlucoTracker

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