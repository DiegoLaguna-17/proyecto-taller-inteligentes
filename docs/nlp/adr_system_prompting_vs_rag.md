# ADR: System Prompting vs. RAG para el chatbot educativo de GlucoTracker

**Estado:** Aceptado (v1.0.0)

## Contexto

GlucoTracker necesita un módulo de NLP para responder consultas educativas de pacientes sobre diabetes tipo 2 (ej. "mi glucosa está en 65, ¿qué hago?"), garantizando que las respuestas sean clínicamente seguras — sin inventar dosis de medicación, sin contradecir las reglas ADA que ya usa el resto del sistema, y reconociendo cuándo una pregunta está fuera de su alcance.

La opción "por defecto" para este tipo de problema suele ser RAG (Retrieval-Augmented Generation): vectorizar un corpus de documentos médicos, indexarlos en una base de datos vectorial, y recuperar los fragmentos más relevantes para cada pregunta antes de mandarlos al LLM.

## Decisión

Se implementa **Inyección Estática de Contexto vía System Prompting**: un archivo de texto curado (`docs/nlp/reglas_ada_v1.txt`) se concatena completo en el system message de cada llamada a la API del LLM externo (OpenAI/Gemini), en vez de construir un pipeline de RAG con base de datos vectorial.

## Por qué (justificación)

1. **El alcance de la v1.0.0 es acotado a propósito:** solo hipoglucemia y metas básicas de control glicémico en diabetes tipo 2 en adultos. Ese conocimiento cabe completo en unos pocos párrafos — no hay cientos de páginas de guías que requieran recuperación selectiva.
2. **Menor complejidad operativa:** no hay que mantener una base de datos vectorial, un pipeline de embeddings, ni lógica de recuperación — menos piezas que puedan fallar en un proyecto de alcance de tesis con un equipo pequeño.
3. **Control determinístico sobre las reglas de seguridad:** al inyectar el corpus completo siempre, no hay riesgo de que un paso de recuperación "no encuentre" el fragmento relevante (una falla común de RAG mal ajustado) y el LLM responda sin la regla de seguridad necesaria.
4. **Menor latencia:** una sola llamada a la API del LLM, sin el paso adicional de búsqueda vectorial.

## Consecuencias

**Positivas:**
- Arquitectura simple, fácil de auditar (el corpus completo es legible por cualquiera, no está fragmentado en vectores).
- Reduce significativamente el riesgo de respuestas fuera de las reglas clínicas definidas, medible con la Tasa de Adherencia (ver `docs/nlp/baseline_chatbot.md`).

**Negativas / limitaciones aceptadas:**
- **No escala a un corpus grande.** Si el alcance crece (ej. cubrir todas las complicaciones de diabetes, o múltiples enfermedades), el corpus dejaría de caber en la ventana de contexto de forma económica, y en ese punto RAG sí seria necesario. Esta decisión es válida para v1.0.0, no es una posición permanente.
- **No garantiza cumplimiento absoluto.** El LLM puede ignorar el system prompt ante entradas adversariales — mitigado parcialmente (no eliminado) y medido explícitamente con los casos `adversarial` del Golden Dataset.
- **Dependencia de un proveedor externo:** costo por token, latencia de red, y riesgo de que el proveedor cambie el modelo sin aviso.

## Alternativas consideradas

| Alternativa | Por qué no, por ahora |
|---|---|
| RAG con base de datos vectorial | Complejidad injustificada para un corpus que cabe en el contexto del LLM sin recuperación selectiva |
| Fine-tuning de un modelo propio | Costo y esfuerzo de entrenamiento no justificado para el alcance de v1.0.0; además requeriría su propio dataset etiquetado de conversaciones |
| Modelo local (sin API externa) | Fuera de alcance de tiempo/recursos del taller; se documenta como posible trabajo futuro si la dependencia de un proveedor externo resulta un problema en producción |

## Revisión futura

Esta decisión debe revisarse si: (a) el corpus de reglas crece más allá de lo que cabe cómodamente en el contexto del LLM sin encarecer cada llamada, o (b) la Tasa de Adherencia en casos `adversarial` (ver `docs/nlp/baseline_chatbot.md`) resulta consistentemente baja, lo que indicaría que el system prompting por sí solo no es suficiente control de seguridad.
