# tasks.md
> GlucoTracker — Version 1.0.0 — 2026-08-24

## Legend
- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked — reason noted inline

---

## Phase 1: Infraestructura
*Goal*: Tener el esqueleto de proyecto, entorno de Azure y conexión a Supabase funcionando antes de escribir lógica de negocio.

- [ ] **TASK-001** [NFR-002]: Crear proyecto Supabase (PostgreSQL) y configurar credenciales de conexión seguras.
  - _Refs rationale_: NFR-002 exige uptime del 95% sobre Azure/Supabase; primero se necesita la instancia.
  - _Output_: Instancia Supabase activa, string de conexión en variables de entorno (no en código).
  - _Verify_: Conexión de prueba desde un script local retorna `SELECT 1`.
- [ ] **TASK-002** [NFR-002]: Provisionar recursos en Azure para el backend (App Service o Container Apps) con HTTPS/SSL habilitado.
  - _Refs rationale_: NFR-002 (disponibilidad) y NFR-001 (tráfico cifrado) dependen de esta infraestructura base.
  - _Output_: Servicio en Azure accesible por HTTPS con certificado válido.
  - _Verify_: `curl -I https://<url>` retorna 200 y certificado válido (sin warnings de SSL).
- [ ] **TASK-002a** [NFR-001, NFR-002]: Provisionar en Azure un recurso propio para el servicio NLP (`backend/nlp_service/`), separado del backend, con HTTPS/SSL y sus propias variables de entorno (ADR-0006). No bloquea las tareas TASK-013; el servicio no se expone públicamente hasta TASK-014.
  - _Refs rationale_: ADR-0006 (segundo despliegue): NFR-001 exige tráfico cifrado y NFR-002 disponibilidad también para el servicio NLP.
  - _Output_: Servicio NLP accesible por HTTPS con certificado válido; `NLP_PROVIDER_API_KEY` configurada como secreto del recurso, no en el repositorio.
  - _Verify_: `curl -I https://<url-nlp>/health` retorna 200 y certificado válido (sin warnings de SSL). Si hay un proxy delante (Azure), uvicorn arranca con `--proxy-headers --forwarded-allow-ips=<IP del proxy>`, para que el límite de tasa vea la IP real del cliente (design.md § `app/rate_limit.py`).
- [ ] **TASK-003** []: Scaffolding del proyecto FastAPI (`backend/app/`) con estructura de carpetas de design.md (api, ml, nlp, models, core).
  - _Refs rationale_: Estructura base descrita en design.md § File Structure.
  - _Output_: Proyecto FastAPI ejecutable localmente con endpoint `/health`.
  - _Verify_: `GET /health` retorna 200 en entorno local.
- [ ] **TASK-004** []: Scaffolding del proyecto React Native (`mobile/`) con navegación base y estructura de screens/components/services.
  - _Refs rationale_: Estructura base descrita en design.md § File Structure.
  - _Output_: App React Native que compila y muestra una pantalla de login vacía.
  - _Verify_: `npx react-native run-android` (o iOS) levanta la app sin errores.

## Phase 2: Capa de Datos
*Goal*: Modelar y persistir todas las entidades de design.md § Data Models en Supabase.

- [ ] **TASK-005** [REQ-001, REQ-002]: Crear tabla T_Usuario con contraseña hasheada y rol.
  - _Refs rationale_: Base de autenticación para REQ-001 y alta de usuarios para REQ-002.
  - _Output_: Migración SQL para T_Usuario según el esquema de design.md.
  - _Verify_: Insertar un usuario de prueba y confirmar que `contrasena_hash` nunca almacena texto plano.
- [ ] **TASK-006** [REQ-002]: Crear tablas T_Paciente, T_Medico y T_Administrador con sus relaciones a T_Usuario.
  - _Refs rationale_: Extensiones de usuario descritas en design.md.
  - _Output_: Migraciones SQL para las tres tablas con FKs correctas.
  - _Verify_: Insertar un paciente y un médico de prueba, confirmar integridad referencial.
- [ ] **TASK-007** [REQ-003, REQ-004]: Crear tabla T_Registro_glucosa con campos de clasificación ML.
  - _Refs rationale_: Soporta el registro de glucosa (REQ-003) y el resultado de clasificación (REQ-004).
  - _Output_: Migración SQL para T_Registro_glucosa.
  - _Verify_: Insertar un registro de prueba sin `clasificacion_ml` y confirmar que el campo acepta NULL.
- [ ] **TASK-008** [REQ-005]: Crear tablas T_Tipo_alerta y T_Alertas.
  - _Refs rationale_: Necesarias para notificaciones automáticas al médico (REQ-005).
  - _Output_: Migraciones SQL con FK de T_Alertas a T_Registro_glucosa y T_Tipo_alerta.
  - _Verify_: Insertar un tipo de alerta y una alerta asociada a un registro de prueba.
- [ ] **TASK-009** [NFR-001]: Crear tabla T_Auditoria_Endpoints.
  - _Refs rationale_: Trazabilidad de seguridad exigida en NFR-001.
  - _Output_: Migración SQL para T_Auditoria_Endpoints.
  - _Verify_: Insertar un registro de auditoría de prueba manualmente.

## Phase 3: Lógica de Negocio
*Goal*: Implementar el modelo de ML, el chatbot y las reglas de negocio centrales.

- [ ] **TASK-010** [REQ-004, NFR-003]: Entrenar y serializar el modelo de clasificación (SVC o Árbol de Decisión) para Normal/Riesgo Hipo/Riesgo Hiper.
  - _Refs rationale_: REQ-004 exige la clasificación; NFR-003 exige que responda en <2s.
  - _Output_: Modelo serializado (ej. `.pkl`) cargable por el backend, con métricas de ROC-AUC y Exactitud documentadas.
  - _Verify_: Evaluación offline del modelo con un dataset de validación reporta ROC-AUC y Exactitud aceptables (definir umbral con el equipo clínico).
- [ ] **TASK-011** [REQ-004, NFR-003]: Implementar el módulo `app/ml/` que carga el modelo y expone una función de clasificación interna.
  - _Refs rationale_: REQ-004; la latencia debe cumplir NFR-003.
  - _Output_: Función `clasificar_registro(registro)` que retorna la clasificación en <2s.
  - _Verify_: Test de latencia local mide el tiempo de respuesta y confirma p95 < 2000ms.
- [ ] **TASK-012** [REQ-005]: Implementar lógica de generación de alertas cuando la clasificación es de riesgo.
  - _Refs rationale_: REQ-005 — toda clasificación riesgosa debe generar una alerta.
  - _Output_: Función que, dada una clasificación de riesgo, crea un registro en T_Alertas.
  - _Verify_: Test unitario: clasificación "Riesgo Hipo" produce exactamente una fila nueva en T_Alertas.
- [ ] **TASK-013** [REQ-006]: Implementar el chatbot como **servicio NLP independiente** en `backend/nlp_service/` (ADR-0006; design.md § Servicio NLP (chatbot) Design). Se completa al cerrar TASK-013a, 013b, 013c, 013d, 013i, 013j, 013f y 013g. Todas las rutas de las subtareas son relativas a `backend/nlp_service/`, salvo que se indique otra cosa.
  - _Refs rationale_: REQ-006 requiere respuestas informativas sobre diabetes, nutrición y niveles de glucosa.
  - _Output_: Función `responder_consulta(texto)` que retorna una respuesta con aclaración de que no reemplaza consejo médico.
  - _Verify_: Consulta de prueba ("¿Qué debo comer si mi glucosa está en 70 mg/dL?") retorna una respuesta no vacía con el disclaimer incluido (con `FakeProvider` en pruebas automatizadas).
  - Orden sugerido: 013a → 013b → 013c → 013j → 013d → 013i → TASK-018 → 013f → 013g. TASK-013k es independiente y conviene hacerla antes de TASK-001. TASK-013h es post-v1.
- [x] **TASK-013a** [REQ-006]: Scaffolding del servicio — `backend/nlp_service/` con `app/main.py` (`GET /health`), `tests/`, `requirements.txt` (versiones exactas propias: fastapi, uvicorn, pydantic, google-genai), `requirements-dev.txt` (pytest y lo necesario para `TestClient`), `.env.example` (solo nombres de variables de design.md) y `README.md` (instalar, configurar, correr desde `backend/nlp_service/`, probar).
  - _Refs rationale_: ADR-0006: servicio aislado, sin importar `backend/app/` ni compartir requirements. Las versiones no dependen de las de supabase del backend.
  - _Output_: Servicio ejecutable con `uvicorn app.main:app` desde `backend/nlp_service/`. Las versiones de `requirements.txt` se verifican con `pip index versions` y no se suponen.
  - _Verify_: En un venv limpio fuera del repo: `pip install -r requirements.txt -r requirements-dev.txt` y `pip check` → sin conflictos. `pytest` (desde `backend/nlp_service/`) cubre `GET /health` → 200. `git grep -nE "from app\.(core|ml)|import app\.(core|ml)|backend/app" backend/nlp_service` no retorna resultados.
  - _Resultado (2026-10-24)_: versiones de `pip index versions` → fastapi 0.162.0, pydantic 2.14.1, uvicorn 0.54.0, google-genai 2.33.0, python-dotenv 1.2.4 (dev: pytest 9.1.1, httpx 0.28.1). `pip check` → "No broken requirements found." en un venv limpio del scratchpad y en `backend/nlp_service/.venv`. `tests/test_health.py` pasa; `uvicorn app.main:app --port 8001` + `curl /health` → 200. `git grep --untracked` de aislamiento sin resultados, más `tests/test_aislamiento.py`. Se agregaron `.venv/` y `.pytest_cache/` del servicio a `.gitignore`.
- [~] **TASK-013b** [REQ-006]: Corpus — `git mv docs/nlp/reglas_ada_v1.txt backend/nlp_service/app/corpus/reglas_ada_v1.txt` (sin cambios de contenido); crear `app/corpus/reglas_ada_v1.1.txt` (mismo contenido con tildes, descargo literal «Consulta siempre a tu médico tratante para cambios en tu medicación.» en una sola línea (en v1 está partido por un salto de línea) y encabezado que ya no atribuya el motor de reglas a `app/ml/riesgo.py`); crear `docs/nlp/umbrales_ada_v1.json` con el formato de design.md; actualizar las referencias en `docs/` y `README.md`. Requiere TASK-013a.
  - _Refs rationale_: ADR-0006 (corpus dentro del servicio, reemplaza el destino de D9); corpus_conocimiento.md §4 (un archivo nuevo por versión, nunca sobrescribir); el Golden Dataset permanece en `docs/nlp/`.
  - _Output_: v1 movido con historial; v1.1 como corpus vigente; archivo de referencia JSON versionado; ninguna referencia a `docs/nlp/reglas_ada_v1.txt` en el repositorio.
  - _Verify_: `git grep "docs/nlp/reglas_ada_v1.txt"` no retorna resultados; `git log --follow backend/nlp_service/app/corpus/reglas_ada_v1.txt` muestra el historial previo; `git diff --no-index` entre v1 y v1.1 muestra solo tildes y el encabezado; `python -m json.tool docs/nlp/umbrales_ada_v1.json` lo valida.
  - _Resultado parcial (2026-10-24)_: `git mv` hecho (git status: `R docs/nlp/… -> backend/nlp_service/app/corpus/reglas_ada_v1.txt`); v1.1 y JSON creados; referencias actualizadas (solo quedan las de esta misma tarea en tasks.md). El diff v1 → v1.1 muestra tildes, el descargo en una línea, el encabezado y la nota "[PENDIENTE…]" movida del cuerpo al encabezado para que no llegue al LLM; las reglas no cambian. **Falta:** `git log --follow` solo se puede verificar después del commit.
- [x] **TASK-013c** [REQ-006, NFR-001]: Config propia y constantes — `app/config.py` (variables del servicio de design.md; ninguna clave con valor por defecto) y `app/clinical.py` (70, 130, 180 mg/dL; 15 g; 15 min; `DESCARGO_MEDICO` con tildes). Requiere TASK-013a.
  - _Refs rationale_: ADR-0006 (cada servicio tiene su copia de constantes; reemplaza `backend/app/core/clinical.py`); D3 (auth, longitud, tasa por entorno); NFR-001 (clave solo por entorno).
  - _Output_: Settings validados. La configuración incompleta del proveedor levanta el error que el router mapea a 503. Temperature no es variable de entorno.
  - _Verify_: `pytest` cubre: configuración completa con `NLP_PROVIDER=fake` carga sin clave; con `NLP_PROVIDER=gemini` sin `NLP_PROVIDER_API_KEY`, levanta "no configurado"; `NLP_TEMPERATURE` no es leída por `config.py`.
  - _Resultado (2026-10-24)_: `tests/test_config.py` pasa (fake sin clave; gemini sin `NLP_MODEL` o sin `NLP_PROVIDER_API_KEY` nombra solo la variable; valores inválidos; `NLP_TEMPERATURE` ignorada; la clave no aparece en `repr`). Valores por defecto: timeout 30 s, descargo forzado `true`, auth `true`, 1000 caracteres, 10/min.
- [x] **TASK-013d** [REQ-006, NFR-001]: Proveedores — `app/llm_client.py` (interfaz `LLMClient`, `GeminiProvider` con `google-genai`, `FakeProvider`; `OpenAIProvider` diferido) y `app/errors.py`. Requiere TASK-013c.
  - _Refs rationale_: ADR-0005 (D1, D2): proveedor por `NLP_PROVIDER`, modelo por `NLP_MODEL`, id exacto del modelo disponible por corrida.
  - _Output_: `get_llm_client()` retorna la implementación según `NLP_PROVIDER`; fallos y timeouts del SDK se traducen a los errores de `errors.py`, sin el texto de la consulta en el mensaje.
  - _Verify_: `pytest` cubre `NLP_PROVIDER=fake` → `FakeProvider`, valor desconocido → error de configuración, y `GeminiProvider` con el cliente del SDK sustituido por un doble (sin red) que traduce excepción → fallo del proveedor y timeout → timeout. Ningún test hace llamadas de red.
  - _Resultado (2026-10-24)_: `tests/test_llm_client.py` pasa. Los errores del SDK (`ServerError`, `ClientError`, `httpx.ReadTimeout`, otros) se traducen sin el texto de la consulta y sin excepción encadenada. El timeout se pasa en milisegundos (`HttpOptions`) y el SDK no reintenta (sin `retry_options`). No se probó contra la API real.
- [x] **TASK-013e** []: Resolver el conflicto de dependencias D11 (`google-genai` exige `httpx>=0.28.1`; `supabase==2.7.4` exige `httpx<0.28`). Elegir una opción de ADR-0005 § Consecuencias con aprobación del equipo y actualizar `requirements.txt`. **Superada por ADR-0006** (el chatbot tiene su propio `requirements.txt`; ver TASK-013k).
  - _Refs rationale_: ADR-0005 (D11).
  - _Output_: `backend/requirements.txt` instalable con el SDK del proveedor y el cliente de Supabase en el mismo entorno; decisión registrada en ADR-0005.
  - _Verify_: En un venv limpio, `pip install -r backend/requirements.txt` termina sin conflictos, `pip check` no reporta incompatibilidades y `python -c "import supabase, google.genai"` no falla.
  - _Resultado (2026-10-24)_: opción 1 — `supabase==2.16.0` + `httpx==0.28.1`. Venv limpio con `-r requirements.txt google-genai`: `pip check` → "No broken requirements found."; imports OK; `GET /health` vía TestClient → 200. Evidencia en ADR-0005. Se revierte en TASK-013k.
- [ ] **TASK-013f** [REQ-006]: Golden Dataset v1.1 en `docs/nlp/` — mismas 20 preguntas que v1, con todos los checks ejecutables por código, sin LLM como juez (D5), más `app/checks.py` en el servicio. Requiere TASK-013a.
  - _Refs rationale_: D5; docs/nlp/baseline_chatbot.md §3. Los checks semánticos de v1 (`descargo_medico`, `no_puedo_recomendar_dosis`, `no_tengo_informacion`, `consulta_profesional`, `aumentar_dosis`) no son evaluables literalmente.
  - _Output_: `docs/nlp/golden_dataset_v1.1.csv` (v1 se conserva sin cambios) con la regla de coincidencia documentada (mayúsculas, acentos, límites de palabra), y `descargo_medico` definido como `clinical.DESCARGO_MEDICO`; `checks.py` evalúa `contiene:` / `NO_contiene:`.
  - _Verify_: Las preguntas y categorías de v1.1 son idénticas a v1 (test o diff); los tests de `checks.py` cubren un caso que pasa y uno que falla por cada pregunta.
- [ ] **TASK-013g** [REQ-006]: Script de evaluación del baseline `app/evaluation.py`: corridas sin contexto y con contexto (corpus v1.1) sobre Golden Dataset v1.1 → `app/nlp_baseline_metrics.json`. Requiere TASK-013i y TASK-013f.
  - _Refs rationale_: docs/nlp/baseline_chatbot.md §4; D2 (id exacto del modelo, temperature 0.2); D6 (métrica sobre salida cruda; descargo forzado aparte). Gemini tier gratuito solo con las 20 preguntas sintéticas (D1).
  - _Output_: JSON con adherencia por categoría y global, `modelo_llm` exacto, `temperature`, versión del corpus y del Golden Dataset, y adherencia con descargo forzado reportada aparte; `baseline_chatbot.md` §4 actualizado con estos campos.
  - _Verify_: Corrida con `FakeProvider` produce un JSON válido con todos los campos (en pruebas automatizadas); una corrida manual con Gemini registra el id del modelo devuelto por el proveedor.
- [ ] **TASK-013h** [REQ-006]: *(Post-v1, no bloquea TASK-013)* Corpus v2 con manejo de emergencias (síntomas severos, pérdida de conciencia, etc.), con revisión clínica (D7).
  - _Refs rationale_: D7: emergencias fuera de alcance de v1; corpus_conocimiento.md §4 exige un archivo nuevo por versión.
  - _Output_: `app/corpus/reglas_ada_v2.txt` revisado por un profesional de la salud, con preguntas de emergencia agregadas a una nueva versión del Golden Dataset.
  - _Verify_: Revisión clínica firmada/documentada; el test de contrato de TASK-013j pasa también con v2.
- [x] **TASK-013i** [REQ-006, NFR-001]: Prompt y servicio — `app/prompt_builder.py` y `app/service.py` con `responder_consulta(texto, *, con_contexto=True)`, `TEMPERATURE = 0.2` y el descargo por código con `NLP_ENFORCE_DISCLAIMER`; más la herramienta de prueba manual `app/dev_chat.py` (`python -m app.dev_chat [--sin-contexto]`, solo stdout, sin archivos ni logs, nombra solo la variable faltante). Requiere TASK-013b y TASK-013d.
  - _Refs rationale_: ADR System Prompting vs. RAG (corpus completo en el system prompt); D6 (descargo por código, reportado aparte); D8 (sin estado).
  - _Output_: El system prompt contiene íntegro el cuerpo de `app/corpus/reglas_ada_v1.1.txt` (sin el encabezado de metadatos); al proveedor solo se envían el system prompt y el texto del usuario.
  - _Verify_: Test con `FakeProvider` que captura la llamada: el prompt contiene el cuerpo del corpus, no contiene el encabezado y no incluye ningún otro dato; `temperature` enviada = 0.2; con `NLP_ENFORCE_DISCLAIMER=true` una respuesta sin descargo sale con `DESCARGO_MEDICO` y con `false` sale intacta; los mensajes de excepción no contienen el texto de la consulta.
  - _Resultado (2026-10-24)_: `tests/test_service.py`, `tests/test_prompt_builder.py` y `tests/test_dev_chat.py` pasan. Con FakeProvider, `responder_consulta('¿Qué debo comer si mi glucosa está en 70 mg/dL?')` → texto no vacío con descargo (también verificado fuera de pytest). El descargo no se duplica si el LLM ya lo escribió (comparación sin tildes, mayúsculas ni saltos de línea). `dev_chat` con proveedor real no se probó.
- [x] **TASK-013j** [REQ-006]: Test de contrato clínico — `tests/test_contrato_clinico.py` compara `app/clinical.py` con `docs/nlp/umbrales_ada_v1.json` y con `app/corpus/reglas_ada_v1.1.txt`. Requiere TASK-013b y TASK-013c.
  - _Refs rationale_: ADR-0006 (duplicación de constantes mitigada por contrato); corpus_conocimiento.md §3.
  - _Output_: Test que falla ante cualquier diferencia de umbral o del texto del descargo entre las tres fuentes.
  - _Verify_: `pytest tests/test_contrato_clinico.py` pasa sin red; alterar un valor en `clinical.py`, en el JSON o en el corpus (en una copia temporal) hace fallar el test.
  - _Resultado (2026-10-24)_: pasa (11 casos). Mutaciones en copias temporales fuera del repo: `clinical.py` 130→131 → 3 fallan; JSON 180→190 → 1 falla; descargo sin tilde en el corpus → 1 falla; corpus "70 a 125" → 2 fallan.
- [ ] **TASK-013k** []: Desacoplar el backend del chatbot — revertir en `backend/requirements.txt` `supabase==2.16.0` a `supabase==2.7.4` y quitar `httpx==0.28.1`; retirar `NLP_PROVIDER_API_KEY` de `backend/.env.example`; quitar "chatbot" del comentario de routers de `backend/app/main.py`.
  - _Refs rationale_: ADR-0006 y ADR-0005 (D11 superado): el backend ya no necesita `httpx>=0.28.1` y vuelve a su pin original, sin adoptar cambios del cliente Supabase que no necesita (hoy ningún código importa `supabase`).
  - _Output_: Backend sin dependencias ni variables del chatbot.
  - _Verify_: En un venv limpio fuera del repo: `pip install -r backend/requirements.txt` y `pip check` → sin conflictos; `python -c "import supabase"` funciona; `TestClient(app).get('/health')` → 200; `git grep NLP_ backend/.env.example` no retorna resultados.

## Phase 4: Capa de API
*Goal*: Exponer la lógica de negocio como endpoints REST autenticados, según design.md § API / Interface Design.

- [ ] **TASK-014** [REQ-001]: Implementar `POST /auth/login` con verificación de hash y emisión de token.
  - _Refs rationale_: REQ-001.
  - _Output_: Endpoint funcional que retorna token válido para credenciales correctas y 401 para incorrectas.
  - _Verify_: Test de integración cubre login exitoso y fallido.
- [ ] **TASK-015** [REQ-002]: Implementar `POST /auth/registro` restringido a Administrador, con validación de matrícula para médicos.
  - _Refs rationale_: REQ-002.
  - _Output_: Endpoint que rechaza alta de médico sin matrícula válida.
  - _Verify_: Test de integración: alta de médico sin matrícula retorna error de validación.
- [ ] **TASK-016** [REQ-003]: Implementar `POST /pacientes/{id}/registros-glucosa`.
  - _Refs rationale_: REQ-003.
  - _Output_: Endpoint que persiste un nuevo registro de glucosa.
  - _Verify_: Test de integración crea un registro y lo recupera vía GET.
- [ ] **TASK-017** [REQ-004, REQ-005]: Conectar el guardado de un registro de glucosa con la clasificación ML y, si es riesgoso, con la creación de alerta y notificación push.
  - _Refs rationale_: REQ-004 y REQ-005 — el flujo completo descrito en la Especificación § 8.A.
  - _Output_: Al llamar TASK-016, el registro queda clasificado y, si aplica, se dispara una notificación push al médico asignado.
  - _Verify_: Test end-to-end: registro con nivel crítico genera alerta en T_Alertas y una notificación push simulada/mockeada.
- [x] **TASK-018** [REQ-006, NFR-001]: Implementar `POST /api/chatbot/consulta` **en el servicio NLP**: `backend/nlp_service/app/api/chatbot.py`, `app/auth.py` (dependencia reemplazable; 401 con `CHATBOT_REQUIRE_AUTH=true` hasta TASK-014), `app/rate_limit.py` (en memoria, por IP), montaje en `app/main.py` y `backend/nlp_service/test_chatbot.sh`, según el contrato de design.md § API (sin estado, límites de longitud y tasa). Requiere TASK-013i.
  - _Refs rationale_: REQ-006; D3, D8, D10; ADR-0006 (servicio expuesto directamente a la app, seguridad propia). Sin despliegue público hasta TASK-014 (divergencia registrada en CONTEXT.md). Cuando exista TASK-014, `auth.py` se conecta a la validación local del token de sesión.
  - _Output_: Endpoint que recibe `{texto}` y retorna `{respuesta}`; errores 422 / 429 (`CHATBOT_RATE_LIMIT_PER_MINUTE`) / 503 / 502 / 504.
  - _Verify_: `pytest` desde `backend/nlp_service/` con `FakeProvider` cubre 200 con respuesta no vacía, 422 (vacío y mayor a `CHATBOT_MAX_INPUT_CHARS`), 429, 503, 502 y 504; con `CHATBOT_REQUIRE_AUTH=true` y sin token, la dependencia rechaza la llamada; comprueba que el texto de la consulta no aparece en logs capturados (`caplog`) ni en el `detail` de errores.
  - _Resultado (2026-10-24)_: `tests/test_api_chatbot.py` y `tests/test_rate_limit.py` pasan; la suite completa da 90 passed.
    - Casos cubiertos: 200 con descargo; 422 (vacío, solo espacios, sin campo, no string, demasiado largo, JSON malformado, cuerpo no UTF-8); 429 con `Retry-After`; 503 (cinco configuraciones); 502; 504; 401 (también por defecto); orden auth → tasa → entrada → proveedor; el texto no aparece en `caplog` ni en las respuestas.
    - Además, FastAPI respondía **400** en inglés ante un cuerpo no UTF-8; se mapea al 422 genérico del contrato.
    - `./test_chatbot.sh` (PORT=8002) con `NLP_PROVIDER=fake` y `CHATBOT_REQUIRE_AUTH=false` → 200, respuesta no vacía y con descargo. No se probó contra Gemini real.
- [ ] **TASK-019** [REQ-007]: Implementar `GET /pacientes/{id}/historial` con filtro por rango de fechas.
  - _Refs rationale_: REQ-007.
  - _Output_: Endpoint que retorna registros filtrados por fecha, accesible por Paciente y Médico.
  - _Verify_: Test de integración filtra correctamente por rango diario/semanal/mensual.
- [ ] **TASK-020** [REQ-008]: Implementar `GET /pacientes/{id}/reporte-pdf`.
  - _Refs rationale_: REQ-008.
  - _Output_: Endpoint que genera y retorna un PDF con la evolución clínica del paciente.
  - _Verify_: Test de integración descarga un PDF válido (content-type `application/pdf`, tamaño > 0).

## Phase 5: Frontend Móvil
*Goal*: Construir las pantallas de React Native que consumen la API de la Fase 4.

- [ ] **TASK-021** [REQ-001]: Pantalla de login conectada a `POST /auth/login`.
  - _Refs rationale_: REQ-001.
  - _Output_: Pantalla funcional que almacena el token de sesión.
  - _Verify_: Login manual exitoso navega a la pantalla principal; login fallido muestra error.
- [ ] **TASK-022** [REQ-003]: Pantalla de registro de toma de glucosa.
  - _Refs rationale_: REQ-003.
  - _Output_: Formulario que envía nivel, hora y momento del día al backend.
  - _Verify_: Registro manual desde la app aparece reflejado en el historial (TASK-023).
- [ ] **TASK-023** [REQ-007]: Pantalla de historial con lista y gráfico (diario/semanal/mensual).
  - _Refs rationale_: REQ-007.
  - _Output_: Vista con toggle entre lista y gráfico, filtrable por período.
  - _Verify_: Cambiar el filtro de período actualiza correctamente los datos mostrados.
- [ ] **TASK-024** [REQ-006]: Pantalla de Chatbot.
  - _Refs rationale_: REQ-006.
  - _Output_: Interfaz de chat conectada a `POST /api/chatbot/consulta` del servicio NLP, con una URL base propia `NLP_API_BASE_URL` en `mobile/src/services/` (separada de `API_BASE_URL` del backend, configurable por ambiente). Mensajes de error para 422, 429 y 502/503/504.
  - _Verify_: Enviar una consulta manual muestra la respuesta del servicio NLP en pantalla; con `NLP_API_BASE_URL` apuntando a un servicio caído se muestra un error amigable sin el texto de la consulta.

## Phase 6: Tests y Validación
*Goal*: Verificar que el sistema cumple los NFR y que el flujo completo funciona de punta a punta.

- [ ] **TASK-025** [NFR-001]: Auditoría de seguridad — confirmar hash de contraseñas y HTTPS forzado en todos los endpoints.
  - _Refs rationale_: NFR-001.
  - _Output_: Reporte de auditoría manual o automatizada.
  - _Verify_: Ningún endpoint acepta HTTP plano; intento de conexión HTTP es rechazado o redirigido.
- [ ] **TASK-025a** [NFR-001]: Incluir el servicio NLP en la auditoría de seguridad: HTTPS forzado, límites de longitud y tasa, autenticación activa (`CHATBOT_REQUIRE_AUTH=true`) y ausencia del texto de las consultas en logs. No bloquea las tareas TASK-013.
  - _Refs rationale_: NFR-001; ADR-0006 (superficie expuesta); design.md § Security Design — Servicio NLP; docs/risks.md RT-03.
  - _Output_: Sección del reporte de auditoría dedicada al servicio NLP.
  - _Verify_: Una petición HTTP plana a la URL del servicio NLP es rechazada o redirigida; una petición sin token se rechaza; superar `CHATBOT_RATE_LIMIT_PER_MINUTE` devuelve 429; los logs del despliegue muestran solo metadatos tras una consulta de prueba.
- [ ] **TASK-026** [NFR-002]: Prueba de disponibilidad — monitoreo configurado en Azure con alertas de caída.
  - _Refs rationale_: NFR-002.
  - _Output_: Dashboard de monitoreo de uptime activo.
  - _Verify_: Simulación de caída del servicio dispara una alerta de monitoreo.
- [ ] **TASK-026a** [NFR-002]: Monitoreo de uptime propio del servicio NLP en Azure, sobre `GET /health`, con alertas de caída independientes de las del backend. No bloquea las tareas TASK-013.
  - _Refs rationale_: NFR-002; ADR-0006 (despliegue y observabilidad separados); docs/risks.md RT-04.
  - _Output_: Monitor de uptime del servicio NLP activo en el mismo dashboard que el backend.
  - _Verify_: Detener el servicio NLP dispara una alerta de monitoreo sin afectar la del backend.
- [ ] **TASK-027** [NFR-003]: Prueba de carga sobre el endpoint de clasificación ML.
  - _Refs rationale_: NFR-003.
  - _Output_: Reporte de latencia bajo carga simulada (ej. con Locust o k6).
  - _Verify_: p95 de latencia < 2000ms bajo carga esperada.
- [ ] **TASK-028** [NFR-004]: Prueba de usabilidad con al menos 5 usuarios de distintos rangos etarios.
  - _Refs rationale_: NFR-004.
  - _Output_: Reporte de usabilidad con hallazgos y ajustes de UX.
  - _Verify_: Los 5 usuarios completan el flujo de registro de glucosa sin ayuda externa.

---

## Completed Tasks Archive
<!-- Move [x] tasks here at end of each sprint to keep active list clean -->
