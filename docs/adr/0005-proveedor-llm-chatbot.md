# 0005. Proveedor LLM del chatbot: Gemini con interfaz intercambiable

* **Estado:** Aceptado
* **Fecha de decisión:** 2026-10-24
* **Autores:** Equipo GlucoTracker (decisiones D1 y D2 tomadas por el equipo)

## Contexto y Problema
El chatbot educativo (REQ-006) usa un LLM externo con inyección estática de contexto vía system prompt (ver `docs/nlp/adr_system_prompting_vs_rag.md`). Ese ADR fija el *enfoque* pero no el proveedor ("OpenAI/Gemini"). Hace falta elegir un proveedor para:

1. Correr el baseline de la Tasa de Adherencia Clínica (`docs/nlp/baseline_chatbot.md`) con las 20 preguntas sintéticas del Golden Dataset, sin presupuesto asignado.
2. Atender más adelante consultas de pacientes reales, que son datos de salud sensibles (NFR-001).

Estas dos situaciones tienen exigencias distintas de privacidad y costo, por lo que la decisión no puede atar el código a un solo proveedor.

**Criterios de evaluación:**
- **Política de datos:** si el proveedor puede usar los prompts para mejorar sus productos o someterlos a revisión humana. En Gemini esto depende del tier (gratuito vs. de pago).
- **Costo:** si permite correr el baseline sin pago.
- **Latencia:** tiempo de respuesta de un modelo liviano para una consulta corta.
- **SDK mantenido:** SDK oficial en Python con mantenimiento activo.
- **Disponibilidad para el equipo:** si cualquier integrante puede obtener una clave sin trámites ni tarjeta.

## Alternativas Consideradas
1. **Gemini (Google, SDK `google-genai`):**
   * Pros: tiene tier gratuito sin tarjeta, que alcanza para un baseline de 20 preguntas. Hay modelos livianos de baja latencia (`gemini-3.5-flash-lite`). El SDK oficial está mantenido. Cualquier integrante obtiene una clave con su cuenta de Google.
   * Contras: según los términos de Google, en el tier gratuito el contenido enviado puede usarse para mejorar productos y pasar por revisión humana. Por eso no sirve para datos de pacientes reales. El tier de pago no tiene esa restricción, pero cuesta por token. El SDK exige `httpx>=0.28.1`, lo que chocaba con `supabase==2.7.4`; ya está resuelto (ver Consecuencias, D11).
2. **OpenAI (SDK `openai`):**
   * Pros: según sus términos para la API, los datos no se usan para entrenar por defecto. El SDK es maduro y está mantenido. Tiene modelos livianos de baja latencia.
   * Contras: no hay tier gratuito utilizable, así que el baseline requiere crédito pagado. Obtener la clave requiere un medio de pago, lo que limita la disponibilidad para el equipo.
3. **Azure OpenAI:**
   * Pros: alineado con la plataforma de despliegue (ADR-0003). Los datos se quedan dentro de la suscripción Azure y no se usan para entrenar. Es la opción más fuerte para producción con datos clínicos.
   * Contras: requiere suscripción con cuota de Azure OpenAI y el despliegue de un modelo por región, con disponibilidad variable según el tipo de suscripción. Además, cuesta por token. Es la opción con más fricción de configuración para el equipo en esta etapa.

| Criterio | Gemini | OpenAI | Azure OpenAI |
|---|---|---|---|
| Política de datos | Gratuito: no apto para datos reales · De pago: apto | Apto (API sin entrenamiento por defecto) | Apto (datos en la suscripción) |
| Costo del baseline | Sin costo (tier gratuito) | Pagado | Pagado |
| Latencia | Modelo flash-lite liviano (a medir en el baseline) | Modelos livianos (no medido) | Similar a OpenAI más la región (no medido) |
| SDK mantenido | `google-genai` | `openai` | `openai` (cliente Azure) |
| Disponibilidad para el equipo | Alta (cuenta Google) | Media (requiere pago) | Baja (requiere cuota y despliegue) |

*Las políticas de datos se resumen según los términos publicados por cada proveedor al momento de la decisión y deben revisarse otra vez antes de procesar datos de pacientes reales.*

## Decisión Tomada
**D1:** se usa **Gemini** como proveedor detrás de una interfaz intercambiable `LLMClient` (`backend/app/nlp/llm_client.py`) con tres implementaciones: Gemini, OpenAI y `FakeProvider`. El proveedor se selecciona por variable de entorno (`NLP_PROVIDER`).
* El **baseline** se corre con Gemini en **tier gratuito**, usando **solo las 20 preguntas sintéticas** del Golden Dataset. Ningún dato de paciente real pasa por el tier gratuito.
* Para **pacientes reales** se cambia a Gemini de pago u OpenAI, sin cambiar código, solo configuración. Azure OpenAI queda como alternativa futura compatible con la misma interfaz.
* `FakeProvider` es determinístico y no usa red. Todas las pruebas automatizadas lo usan, sin llamar a ninguna API real.

**D2:** el modelo se configura por `NLP_MODEL` (valor probado: `gemini-3.5-flash-lite`) con `temperature` 0.2. Cada corrida de evaluación guarda el **id exacto del modelo** devuelto por el proveedor (`modelo_llm` en `nlp_baseline_metrics.json`) para detectar deriva silenciosa del proveedor.

## Consecuencias
* **Positivas:**
  * El baseline no cuesta nada y cualquier integrante puede reproducirlo.
  * Cambiar de proveedor es un cambio de configuración, no de código. Esto mitiga parcialmente RIA-04 (dependencia de un proveedor).
  * Las pruebas son reproducibles y no consumen cuota, porque usan `FakeProvider`.
  * Guardar el id exacto del modelo permite comparar corridas en el tiempo.
* **Negativas / Riesgos asumidos:**
  * **Tier gratuito restringido a datos sintéticos:** la regla depende de la disciplina del equipo y de la configuración. Antes de cualquier uso con pacientes reales, se debe cambiar de tier o de proveedor y revisar sus términos.
  * **Autenticación diferida (D3):** el endpoint `POST /api/chatbot/consulta` usa una dependencia de autenticación reemplazable. `CHATBOT_REQUIRE_AUTH=false` se permite solo en desarrollo y se aplican límites de longitud (`CHATBOT_MAX_INPUT_CHARS`) y de tasa (`CHATBOT_RATE_LIMIT_PER_MINUTE`). Mientras RT-01 siga abierto y no exista TASK-014, el endpoint **no se despliega públicamente**. Queda registrado como divergencia en `CONTEXT.md`.
  * **Descargo médico medido sobre la salida cruda (D6):** la Tasa de Adherencia del baseline se mide sobre la respuesta cruda del LLM. En producción, el endpoint agrega el descargo por código si falta (`NLP_ENFORCE_DISCLAIMER`). La adherencia con descargo forzado se reporta aparte, para no inflar la métrica del modelo con una corrección determinística del backend.
  * **Conflicto de dependencias (D11) — Resuelto el 2026-10-24 (TASK-013e) con la opción 1: `supabase==2.16.0` + `httpx==0.28.1`.** `google-genai` exige `httpx>=0.28.1`, pero `supabase==2.7.4` declaraba `httpx<0.28 and >=0.24`. Evidencia, obtenida en venvs temporales fuera del repositorio con Python 3.13.3:
    * Las versiones disponibles se consultaron con `pip index versions` (supabase hasta 2.33.0, httpx hasta 0.28.1, google-genai hasta 2.33.0).
    * Conflicto reproducido: `pip install supabase==2.7.4 httpx==0.28.1` → `ResolutionImpossible: supabase 2.7.4 depends on httpx<0.28 and >=0.24`.
    * `supabase==2.33.0` (la última) se descartó: arrastra `realtime 2.33.0`, que exige `pydantic>=2.11.7`, y eso choca con `pydantic==2.9.2` fijado en `requirements.txt`.
    * Con el resto de pines intactos, el resolutor de pip elige `supabase 2.16.0`, que arrastra `postgrest 1.1.1`, `realtime 2.5.3`, `storage3 0.12.1`, `gotrue 2.12.4` y `supafunc 0.10.2`.
    * En un venv limpio, `pip install -r requirements.txt google-genai` → `pip check`: `No broken requirements found.`. `import supabase, google.genai` funciona, y `TestClient(app).get('/health')` → 200 (FastAPI 0.115.0 / Starlette 0.38.6 con httpx 0.28.1).
    * Hoy ningún módulo de `backend/` importa `supabase` (verificado con grep), así que el cambio de versión no rompe código existente.

    **Consecuencia para TASK-013a:** las versiones recientes de `google-genai` (ej. 2.33.0) exigen `pydantic>=2.12.5`. Con `pydantic==2.9.2`, el resolutor cae a `google-genai 2.8.0`. Si se instala `google-genai` por separado, pip sube pydantic en silencio (a 2.14.1 en la prueba) y `pip check` no lo detecta. TASK-013a debe elegir entre fijar `google-genai==2.8.0` o subir `pydantic`/`fastapi` con su propia verificación.

    Opciones evaluadas originalmente:
    1. **Subir `supabase`** a una versión cuyas dependencias acepten `httpx>=0.28.1`. Antes hay que revisar los cambios de API del cliente, aunque hoy ningún código del backend usa `supabase`.
    2. **Llamar a la API de Gemini por REST con `httpx` directamente**, sin `google-genai`. Así se evita el SDK y su restricción, pero se pierde el mantenimiento del SDK y el cliente HTTP queda a cargo del equipo.
    3. **Usar OpenAI como proveedor del baseline** (su SDK es compatible con el `httpx` actual). Contradice D1 (tier gratuito) y añade costo.
    4. **Aislar el cliente Gemini en un entorno o proceso separado.** Resuelve el conflicto, pero contradice el monolito de ADR-0001 y no se recomienda.

    Se eligió la opción 1, porque mantiene D1 y el SDK oficial con el menor costo de cambio.
  * Se mantienen las limitaciones del ADR de system prompting: no determinismo, deriva del proveedor, dependencia de conectividad y costo por token en el tier de pago.
