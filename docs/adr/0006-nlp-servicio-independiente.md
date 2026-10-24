# 0006. Chatbot NLP como servicio independiente

* **Estado:** Aceptado
* **Fecha de decisión:** 2026-10-24
* **Autores:** Equipo GlucoTracker (decisión tomada por el equipo)

## Contexto y Problema
ADR-0001 fija un backend monolítico en FastAPI que incluía el módulo NLP del chatbot. Al especificar el chatbot (Fase A, design.md 1.2.0) aparecieron dos problemas de acoplamiento:

1. **Dependencias:** el SDK del proveedor (`google-genai`) exige `httpx>=0.28.1` y versiones recientes de `pydantic`. Eso obligó a subir `supabase` en el backend (D11, TASK-013e) por una necesidad que no era del backend. También limitó `google-genai` a 2.8.0 por el pin `pydantic==2.9.2` del backend.
2. **Ciclo de vida distinto:** el chatbot depende de un proveedor externo con costo por token y deriva de modelo, y se evalúa con su propio baseline. El resto del backend depende de Supabase y del modelo de ML. Cambiar uno no debería obligar a redesplegar ni re-verificar el otro.

Por eso hay que decidir dónde vive el chatbot y cómo lo consume la app móvil.

## Alternativas Consideradas
1. **Módulo del monolito (`backend/app/nlp/`, diseño 1.2.0):**
   * Pros: un solo despliegue, una sola configuración y autenticación compartida con el backend. Coherente con ADR-0001.
   * Contras: comparte `requirements.txt` con el backend, así que cualquier pin del SDK del LLM afecta a Supabase y a FastAPI (D11). Una caída o saturación del proveedor LLM comparte proceso con los endpoints clínicos. No se puede escalar ni desplegar por separado.
2. **Servicio independiente en carpeta aislada dentro del repo (`backend/nlp_service/`):**
   * Pros: dependencias, configuración y despliegue propios, sin tocar el backend. Sigue en el mismo repositorio, así que conserva la trazabilidad SDD (requirements/design/tasks únicos), los PRs revisados en un solo lugar y el acceso directo a `docs/nlp/` para el Golden Dataset y el archivo de referencia.
   * Contras: un segundo despliegue, una segunda superficie expuesta y duplicación de las constantes clínicas.
3. **Repositorio separado:**
   * Pros: aislamiento máximo, con CI, permisos y versionado independientes.
   * Contras: rompe la única fuente de verdad SDD (requirements/design/tasks quedarían repartidos). Obliga a sincronizar entre repositorios el Golden Dataset, el archivo de referencia de umbrales y la documentación NLP. Es demasiado overhead para un equipo de 4 personas en un proyecto de taller.

## Decisión Tomada
Se elige la **alternativa 2: servicio independiente en `backend/nlp_service/`**, que reemplaza a ADR-0001 solo para el chatbot.
* Tiene su propio `app/` (FastAPI con `GET /health` y `POST /api/chatbot/consulta`), `tests/`, `requirements.txt`, `requirements-dev.txt`, `.env.example` y `README.md`. **No importa nada de `backend/app/`** (ni `core/` ni `ml/`).
* **La app React Native llama directo al servicio NLP**, sin pasarela, con una URL base propia (`NLP_API_BASE_URL`).
* **Alcance:** solo NLP. El modelo de ML y su clasificación siguen en `backend/app/ml/`; su posible migración es una decisión aparte, no cubierta aquí.
* **Constantes ADA:** cada servicio tiene su propia copia. El servicio NLP las define en `app/clinical.py` (70, 130, 180 mg/dL; 15 g; 15 min) junto con el descargo médico fijo con tildes. Esto reemplaza la decisión de un `backend/app/core/clinical.py` compartido (D4).
* **Corpus:** `reglas_ada_v1.txt` se mueve a `backend/nlp_service/app/corpus/`, lo que reemplaza el destino `backend/app/nlp/corpus/` de D9. Se crea `reglas_ada_v1.1.txt` con tildes como versión vigente. El Golden Dataset se queda en `docs/nlp/`.
* **Proveedores:** `GeminiProvider` (con `google-genai`) y `FakeProvider` ahora; `OpenAIProvider` diferido. `temperature` constante 0.2 en código. El servicio fija sus propias versiones exactas, sin atarse a las del backend.

## Consecuencias
* **Positivas:**
  * El conflicto D11 desaparece para el chatbot: el servicio puede usar versiones recientes de `google-genai`/`pydantic`/`httpx` sin afectar al backend, y el backend puede volver a `supabase==2.7.4` (ver tasks.md).
  * Una falla o latencia del proveedor LLM no afecta a los endpoints clínicos del backend.
  * Despliegue, escalado y evaluación del chatbot quedan independientes del resto del sistema.
* **Negativas / Riesgos asumidos:**
  * **Superficie expuesta adicional:** el servicio NLP recibe tráfico directo de la app, así que sus controles de seguridad son propios: límite de longitud (`CHATBOT_MAX_INPUT_CHARS`), límite de tasa (`CHATBOT_RATE_LIMIT_PER_MINUTE`), autenticación reemplazable (D3, `CHATBOT_REQUIRE_AUTH=false` solo en desarrollo), HTTPS y no registrar el texto de las consultas. Cuando exista TASK-014, deberá **validar por sí mismo** los tokens de sesión emitidos por el backend, sin llamarlo ni importar su código. El mecanismo depende de RT-01. **Sin despliegue público hasta TASK-014** (divergencia registrada en `CONTEXT.md`).
  * **URL propia en la app:** el cliente móvil maneja dos URL base (`API_BASE_URL` y `NLP_API_BASE_URL`) y dos dominios de error (TASK-024).
  * **Duplicación de constantes clínicas:** al no compartir código, los umbrales ADA y el descargo existen en más de un lugar. Se mitiga con un **test de contrato** (`backend/nlp_service/tests/test_contrato_clinico.py`) que compara `app/clinical.py` con el archivo de referencia versionado `docs/nlp/umbrales_ada_v1.json` y con el corpus vigente. El futuro motor de reglas del backend debe compararse contra el mismo archivo de referencia.
  * **Despliegue y observabilidad separados:** un segundo recurso en Azure, con su propio HTTPS, variables de entorno, monitoreo de uptime (NFR-002) y logs. Las llamadas al chatbot no quedan en T_Auditoria_Endpoints porque el servicio no accede a la base de datos; su trazabilidad se limita a logs de metadatos.
  * **Mismo nombre de paquete (`app`)** en backend y servicio: cada uno se ejecuta y se prueba desde su propia carpeta.
  * Un segundo `requirements.txt` que mantener y auditar.
