# Corpus de conocimiento — Chatbot educativo de GlucoTracker

Documenta el "dataset" del componente de NLP: no es un corpus vectorizado para RAG, sino un documento de texto curado que el **servicio NLP independiente** (`backend/nlp_service/`, ver `docs/adr/0006-nlp-servicio-independiente.md`) inyecta en el system prompt del LLM externo (Gemini, ver `docs/adr/0005-proveedor-llm-chatbot.md`). Ver `docs/nlp/adr_system_prompting_vs_rag.md` para la justificación arquitectónica completa de por qué se eligió este enfoque en vez de RAG.

## 1. Inventario del corpus

| Campo | Detalle |
|---|---|
| Ubicación | `backend/nlp_service/app/corpus/` (dentro del servicio NLP; v1 se trasladó desde `docs/nlp/` con `git mv` en TASK-013b) |
| Archivos | `reglas_ada_v1.txt` (original, se conserva sin cambios) y `reglas_ada_v1.1.txt` (mismo contenido con tildes y descargo médico idéntico a `nlp_service/app/clinical.py`; **versión vigente**, la que se inyecta) |
| Versión | v1.1 vigente (v1 conservada por trazabilidad, §4) |
| Fuente | American Diabetes Association, *Standards of Care in Diabetes*, *Diabetes Care* — **⚠️ pendiente de confirmar la edición/año exacto: debe ser la MISMA fuente ya citada en la propuesta técnica original para el motor de reglas ADA del backend, no una cita nueva independiente** |
| Naturaleza del contenido | Paráfrasis propia de reglas clínicas puntuales (Regla del 15-15, metas de control, restricciones de dosificación) — **no es una reproducción literal** del documento fuente |
| Alcance cubierto | Hipoglucemia (<70 mg/dL) y metas de control glicémico básicas en adultos con diabetes tipo 2 |
| Alcance NO cubierto | Hiperglucemia severa/cetoacidosis, diabetes tipo 1, población pediátrica, ajuste de cualquier medicación |

## 2. Por qué es paráfrasis y no copia literal

Las guías de la ADA tienen su propio copyright (a diferencia de ShanghaiT2DM, que está bajo CC BY 4.0 — ver `docs/data_ecosystem.md`). Reproducir párrafos textuales del documento original en un archivo de un repositorio público sería, en el mejor caso, una zona gris de derechos de autor. Por eso `reglas_ada_v1.txt` (y su versión v1.1) contiene resúmenes propios de las reglas clínicas relevantes, con la fuente citada explícitamente, no el texto original copiado.

## 3. Consistencia con el resto del sistema

Este corpus **no puede tener números distintos** a los que use la clasificación ADA de la lógica de negocio del backend, que clasificará cada lectura como Normal/Hipo/Hiper y disparará las alertas. Está especificada en `design.md` § Clasificación ADA (`backend/app/core/reglas_ada.py`, TASK-012a), pero aún no está implementada. No forma parte del modelo de ML (ADR-0007, ADR-0008). Si en algún punto se actualiza un umbral, el corpus vigente debe actualizarse (con una versión nueva, §4) en el mismo commit — de lo contrario, el chatbot y el resto de la app terminarían dando información clínica contradictoria a un mismo usuario, lo cual es un defecto de producto grave en un contexto de salud, no solo un detalle de documentación.

**Acción pendiente:** la clasificación ADA del backend **todavía no existe en el código**: está especificada para `backend/app/core/reglas_ada.py` (TASK-012a). El servicio de ML (`backend/ml_service/`) no es esa clasificación y no contiene estos umbrales. Por eso la verificación no se hace contra él. Como los servicios no comparten código (ADR-0006, ADR-0008), cada uno tiene su propia copia de los umbrales:
- El servicio NLP define los suyos en `backend/nlp_service/app/clinical.py` (70, 130 y 180 mg/dL; 15 g; 15 min) junto con el descargo médico fijo con tildes.
- Un **test de contrato** compara esas constantes con el archivo de referencia versionado `docs/nlp/umbrales_ada_v1.json` y con el corpus vigente (ver design.md § Servicio NLP (chatbot) Design y TASK-013j en tasks.md).
- La clasificación ADA del backend (`backend/app/core/reglas_ada.py`) tendrá su propia copia de los umbrales y su propio test de contrato contra el mismo archivo de referencia (criterio de verificación de TASK-012a).

## 4. Versionado

Cualquier cambio al contenido de las reglas (ya sea porque la ADA publica una nueva edición de sus *Standards of Care*, o porque el equipo ajusta el alcance clínico cubierto) debe crear un archivo nuevo (`reglas_ada_v1.1.txt`, `reglas_ada_v2.txt`, etc.) en vez de sobrescribir el anterior. Lo mismo vale para el archivo de referencia `umbrales_ada_v1.json` — esto permite tener trazabilidad de qué versión del corpus estuvo en producción en cada momento, algo que un tribunal de tesis (o un auditor de un sistema de salud real) va a esperar ver.

## 5. Relación con el Golden Dataset

`docs/nlp/golden_dataset.csv` contiene las preguntas de evaluación que verifican que el LLM, con este corpus inyectado, responde de acuerdo a las reglas aquí definidas. Ver `docs/nlp/baseline_chatbot.md` para la metodología de medición.
