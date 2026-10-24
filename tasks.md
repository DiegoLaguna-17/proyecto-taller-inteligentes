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
- [ ] **TASK-013** [REQ-006]: Implementar el módulo `app/nlp/` del chatbot. Open Question resuelta (design.md § Chatbot (Módulo NLP) Design, ADR-0005). Se completa al cerrar TASK-013a a TASK-013g.
  - _Refs rationale_: REQ-006 requiere respuestas informativas sobre diabetes, nutrición y niveles de glucosa.
  - _Output_: Función `responder_consulta(texto)` que retorna una respuesta con aclaración de que no reemplaza consejo médico.
  - _Verify_: Consulta de prueba ("¿Qué debo comer si mi glucosa está en 70 mg/dL?") retorna una respuesta no vacía con el disclaimer incluido (con `FakeProvider` en pruebas automatizadas).
  - Orden sugerido: 013e → 013d → 013a → 013b → 013c → 013f → 013g.
- [ ] **TASK-013a** [REQ-006, NFR-001]: Config y proveedor — `app/core/config.py` y `app/nlp/llm_client.py` (interfaz `LLMClient` + Gemini, OpenAI y `FakeProvider`); `app/nlp/errors.py`; nombres de variables nuevas en `backend/.env.example` (solo nombres). Requiere TASK-013e (completada). Al agregar `google-genai` a `requirements.txt`: fijar `google-genai==2.8.0` (máxima compatible con `pydantic==2.9.2`) o subir `pydantic`/`fastapi` con verificación propia (ADR-0005, D11).
  - _Refs rationale_: ADR-0005 (D1, D2): proveedor intercambiable por `NLP_PROVIDER`, modelo por `NLP_MODEL`, temperature 0.2, id exacto del modelo disponible para cada corrida. NFR-001: la clave solo por entorno.
  - _Output_: `config.py` valida las variables de design.md § Chatbot; `get_llm_client()` retorna la implementación según `NLP_PROVIDER`; la falta de configuración levanta el error que el router mapea a 503.
  - _Verify_: `pytest backend/tests/nlp` cubre: `NLP_PROVIDER=fake` retorna `FakeProvider`; configuración incompleta levanta el error de "no configurado"; ningún test hace llamadas de red.
- [ ] **TASK-013b** [REQ-006, NFR-001]: Prompt y servicio — `app/nlp/prompt_builder.py` y `app/nlp/service.py` con `responder_consulta(texto)`, incluido el descargo por código con `NLP_ENFORCE_DISCLAIMER`. Requiere TASK-013a y TASK-013d.
  - _Refs rationale_: ADR System Prompting vs. RAG (corpus completo en el system prompt); D6 (descargo por código, reportado aparte); D8 (sin estado).
  - _Output_: El system prompt contiene íntegro `app/nlp/corpus/reglas_ada_v1.txt`; al proveedor solo se envían el system prompt y el texto del usuario; los timeouts y fallos del proveedor se traducen a los errores de `errors.py`.
  - _Verify_: Test con `FakeProvider` que captura la llamada: el prompt contiene el corpus y no incluye ningún otro dato; con `NLP_ENFORCE_DISCLAIMER=true` una respuesta sin descargo sale con descargo y con `false` sale intacta; los mensajes de excepción no contienen el texto de la consulta.
- [ ] **TASK-013c** [REQ-006, NFR-001]: Pruebas — `backend/tests/nlp/`, `backend/requirements-dev.txt`, `app/core/clinical.py` (constantes ADA: 70, 130, 180 mg/dL; 15 g; 15 min) y test de consistencia del corpus contra esas constantes (D4). Requiere TASK-013b.
  - _Refs rationale_: D4: una sola fuente de verdad de los umbrales ADA en el backend; corpus_conocimiento.md §3.
  - _Output_: Suite de pruebas unitarias del módulo NLP con `FakeProvider`; test que falla si `reglas_ada_v1.txt` cita un umbral distinto a `clinical.py`.
  - _Verify_: `pytest backend/tests/nlp` pasa sin red y sin `NLP_PROVIDER_API_KEY`; cambiar un valor en `clinical.py` hace fallar el test de consistencia.
- [ ] **TASK-013d** [REQ-006]: Mover el corpus a `backend/app/nlp/corpus/reglas_ada_v1.txt` (D9) y actualizar las referencias en `docs/` y `README.md`. El Golden Dataset permanece en `docs/nlp/`.
  - _Refs rationale_: D9; design.md § File Structure.
  - _Output_: Archivo movido con `git mv` (historial preservado); ninguna referencia a `docs/nlp/reglas_ada_v1.txt` queda en el repositorio.
  - _Verify_: `git grep "docs/nlp/reglas_ada_v1.txt"` no retorna resultados; `git log --follow backend/app/nlp/corpus/reglas_ada_v1.txt` muestra el historial previo.
- [x] **TASK-013e** []: Resolver el conflicto de dependencias D11 (`google-genai` exige `httpx>=0.28.1`; `supabase==2.7.4` exige `httpx<0.28`). Elegir una opción de ADR-0005 § Consecuencias con aprobación del equipo y actualizar `requirements.txt`.
  - _Refs rationale_: ADR-0005 (D11). Bloquea la implementación Gemini de TASK-013a.
  - _Output_: `backend/requirements.txt` instalable con el SDK del proveedor y el cliente de Supabase en el mismo entorno; decisión registrada en ADR-0005.
  - _Verify_: En un venv limpio, `pip install -r backend/requirements.txt` termina sin conflictos, `pip check` no reporta incompatibilidades y `python -c "import supabase, google.genai"` no falla.
  - _Resultado (2026-10-24)_: opción 1 — `supabase==2.16.0` + `httpx==0.28.1`. Venv limpio con `-r requirements.txt google-genai`: `pip check` → "No broken requirements found."; imports OK; `GET /health` vía TestClient → 200. `google-genai` queda en 2.8.0 por `pydantic==2.9.2` (ver TASK-013a). Evidencia en ADR-0005.
- [ ] **TASK-013f** [REQ-006]: Golden Dataset v1.1 en `docs/nlp/` — mismas 20 preguntas que v1, con todos los checks ejecutables por código, sin LLM como juez (D5), más `app/nlp/checks.py`.
  - _Refs rationale_: D5; docs/nlp/baseline_chatbot.md §3. Los checks semánticos de v1 (`descargo_medico`, `no_puedo_recomendar_dosis`, `no_tengo_informacion`, `consulta_profesional`, `aumentar_dosis`) no son evaluables literalmente.
  - _Output_: `golden_dataset_v1.1.csv` (v1 se conserva sin cambios) con la regla de coincidencia documentada (mayúsculas, acentos, límites de palabra); `checks.py` evalúa `contiene:` / `NO_contiene:`.
  - _Verify_: Las preguntas y categorías de v1.1 son idénticas a v1 (test o diff); los tests de `checks.py` cubren un caso que pasa y uno que falla por cada pregunta.
- [ ] **TASK-013g** [REQ-006]: Script de evaluación del baseline `app/nlp/evaluation.py`: corridas sin contexto y con contexto sobre Golden Dataset v1.1 → `app/nlp/nlp_baseline_metrics.json`. Requiere TASK-013c y TASK-013f.
  - _Refs rationale_: docs/nlp/baseline_chatbot.md §4; D2 (id exacto del modelo, temperature 0.2); D6 (métrica sobre salida cruda; descargo forzado aparte). Gemini tier gratuito solo con las 20 preguntas sintéticas (D1).
  - _Output_: JSON con adherencia por categoría y global, `modelo_llm` exacto, `temperature`, versión del corpus y del Golden Dataset, y adherencia con descargo forzado reportada aparte; `baseline_chatbot.md` §4 actualizado con estos campos.
  - _Verify_: Corrida con `FakeProvider` produce un JSON válido con todos los campos (en pruebas automatizadas); una corrida manual con Gemini registra el id del modelo devuelto por el proveedor.
- [ ] **TASK-013h** [REQ-006]: *(Post-v1, no bloquea TASK-013)* Corpus v2 con manejo de emergencias (síntomas severos, pérdida de conciencia, etc.), con revisión clínica (D7).
  - _Refs rationale_: D7: emergencias fuera de alcance de v1; corpus_conocimiento.md §4 exige un archivo nuevo por versión.
  - _Output_: `reglas_ada_v2.txt` revisado por un profesional de la salud, con preguntas de emergencia agregadas a una nueva versión del Golden Dataset.
  - _Verify_: Revisión clínica firmada/documentada; el test de consistencia de TASK-013c pasa también con v2.

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
- [ ] **TASK-018** [REQ-006, NFR-001]: Implementar `POST /api/chatbot/consulta` en `app/api/chatbot.py`, según el contrato de design.md § API (sin estado, dependencia de auth reemplazable, límites de longitud y tasa), y `app/test_chatbot.sh`. Requiere TASK-013b.
  - _Refs rationale_: REQ-006; D3, D8, D10. Sin despliegue público hasta TASK-014 (divergencia registrada en CONTEXT.md).
  - _Output_: Endpoint que recibe `{texto}` y retorna `{respuesta}`; errores 422 / 429 (`CHATBOT_RATE_LIMIT_PER_MINUTE`) / 503 / 502 / 504.
  - _Verify_: `pytest backend/tests/api` con `FakeProvider` cubre 200 con respuesta no vacía, 422 (vacío y mayor a `CHATBOT_MAX_INPUT_CHARS`), 429, 503, 502 y 504, y comprueba que el texto de la consulta no aparece en logs capturados (`caplog`) ni en el `detail` de errores.
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
  - _Output_: Interfaz de chat conectada a `POST /api/chatbot/consulta`.
  - _Verify_: Enviar una consulta manual muestra la respuesta del backend en pantalla.

## Phase 6: Tests y Validación
*Goal*: Verificar que el sistema cumple los NFR y que el flujo completo funciona de punta a punta.

- [ ] **TASK-025** [NFR-001]: Auditoría de seguridad — confirmar hash de contraseñas y HTTPS forzado en todos los endpoints.
  - _Refs rationale_: NFR-001.
  - _Output_: Reporte de auditoría manual o automatizada.
  - _Verify_: Ningún endpoint acepta HTTP plano; intento de conexión HTTP es rechazado o redirigido.
- [ ] **TASK-026** [NFR-002]: Prueba de disponibilidad — monitoreo configurado en Azure con alertas de caída.
  - _Refs rationale_: NFR-002.
  - _Output_: Dashboard de monitoreo de uptime activo.
  - _Verify_: Simulación de caída del servicio dispara una alerta de monitoreo.
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
