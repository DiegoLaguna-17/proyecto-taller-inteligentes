# Corpus de conocimiento — Chatbot educativo de GlucoTracker

Documenta el "dataset" del componente de NLP: no es un corpus vectorizado para RAG, sino un documento de texto curado que se inyecta en el system prompt del LLM externo (OpenAI/Gemini). Ver `docs/nlp/adr_system_prompting_vs_rag.md` para la justificación arquitectónica completa de por qué se eligió este enfoque en vez de RAG.

## 1. Inventario del corpus

| Campo | Detalle |
|---|---|
| Archivo | `docs/nlp/reglas_ada_v1.txt` |
| Versión | v1 |
| Fuente | American Diabetes Association, *Standards of Care in Diabetes*, *Diabetes Care* — **⚠️ pendiente de confirmar la edición/año exacto: debe ser la MISMA fuente ya citada en la propuesta técnica original para el motor de reglas ADA del backend, no una cita nueva independiente** |
| Naturaleza del contenido | Paráfrasis propia de reglas clínicas puntuales (Regla del 15-15, metas de control, restricciones de dosificación) — **no es una reproducción literal** del documento fuente |
| Alcance cubierto | Hipoglucemia (<70 mg/dL) y metas de control glicémico básicas en adultos con diabetes tipo 2 |
| Alcance NO cubierto | Hiperglucemia severa/cetoacidosis, diabetes tipo 1, población pediátrica, ajuste de cualquier medicación |

## 2. Por qué es paráfrasis y no copia literal

Las guías de la ADA tienen su propio copyright (a diferencia de ShanghaiT2DM, que está bajo CC BY 4.0 — ver `docs/data_ecosystem.md`). Reproducir párrafos textuales del documento original en un archivo de un repositorio público sería, en el mejor caso, una zona gris de derechos de autor. Por eso `reglas_ada_v1.txt` contiene resúmenes propios de las reglas clínicas relevantes, con la fuente citada explícitamente, no el texto original copiado.

## 3. Consistencia con el resto del sistema

Este corpus **no puede tener números distintos** a los que usa el motor de reglas if/else del backend (el que clasifica Normal/Hipo/Hiper en `app/ml/riesgo.py` y el resto del sistema de clasificación instantánea). Si en algún punto se actualiza un umbral en el motor de reglas, `reglas_ada_v1.txt` debe actualizarse en el mismo commit — de lo contrario, el chatbot y el resto de la app terminarían dando información clínica contradictoria a un mismo usuario, lo cual es un defecto de producto grave en un contexto de salud, no solo un detalle de documentación.

**Acción pendiente:** verificar contra el código del motor de reglas del backend que los rangos "70-130 mg/dL en ayunas" y "menor a 180 mg/dL postprandial" citados en el corpus son exactamente los mismos que usa ese motor.

## 4. Versionado

Cualquier cambio al contenido de las reglas (ya sea porque la ADA publica una nueva edición de sus *Standards of Care*, o porque el equipo ajusta el alcance clínico cubierto) debe crear un archivo nuevo (`reglas_ada_v2.txt`, etc.) en vez de sobrescribir el anterior — esto permite tener trazabilidad de qué versión del corpus estuvo en producción en cada momento, algo que un tribunal de tesis (o un auditor de un sistema de salud real) va a esperar ver.

## 5. Relación con el Golden Dataset

`docs/nlp/golden_dataset.csv` contiene las preguntas de evaluación que verifican que el LLM, con este corpus inyectado, responde de acuerdo a las reglas aquí definidas. Ver `docs/nlp/baseline_chatbot.md` para la metodología de medición.
