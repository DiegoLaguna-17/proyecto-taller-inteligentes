# CONTEXT.md
> GlucoTracker — Live session journal
> Last updated: 2026-10-25 — Session 19

## ⚡ Resume from here

**Active task:** Integración — fusionado el backend de negocio de Adrian (`adriang-backend`: login con OTP, médicos, pacientes, administradores, registros, PDF; 74 pruebas con Supabase simulado) con los servicios independientes. Corregido tras el diagnóstico: `requirements` del backend (faltaba `pydantic-settings`; sin `passlib`/`pytest-mock`/duplicados), resto de ML en `app/main.py`, `.env.example` alineado con `config.py`, `backend/tests/test_aislamiento.py`. Pendiente de decisión del equipo: autenticación (el backend no emite ni comprueba tokens, RB-01), CORS (RB-02), alcance de `seguimiento_embarazo` y reconciliar rutas y esquema con design.md (TASK-029). ML: servicio completo (`backend/ml_service`, 237 pruebas); el modelo real sigue **experimental, solo informativo y visible solo para el médico**; TASK-010b en espera; falta TASK-017 (el backend aún no llama al servicio de ML; bloqueada por el perfil clínico). Otras: lo que falta de TASK-011a y 011d, TASK-012a/012, TASK-002b. El chatbot sigue con TASK-013f/013g.
**Phase:** Phase 3-4: Lógica de Negocio y API (backend de Adrian fusionado; ML y NLP como servicios aparte)
**Status:** in progress — backend fusionado y verificado (87 + 237 + 90 pruebas); contrato y esquema del backend por reconciliar con design.md (TASK-029)
**Blocker (if any):** TASK-017 necesita resolver la Open Question del perfil clínico en Data Models (los campos que pide el modelo no existen en T_Paciente)

> On session start: read this file first, then requirements.md,
> design.md, and tasks.md. Do not ask what to work on — resume
> the active task above unless the user says otherwise.

---

## Session log

| # | Date | What was done | Files changed |
|---|---|---|---|
| 19 | 2026-10-25 | Diagnóstico y corrección tras fusionar `adriang-backend` (código del backend de negocio de Adrian). Backend: `requirements.txt` (con `pydantic-settings`, sin `passlib`/`pytest-mock`/duplicados, versiones exactas), `main.py` sin el bloque `has_ml_riesgo`, carpeta `app/ml` vacía eliminada, `.env.example` alineado con `config.py`, `tests/test_aislamiento.py` (13 pruebas). Documentación: design.md 1.6.0 (estado real de rutas y tablas, estructura, autenticación), tasks.md (TASK-003 y 013k cerradas; 014, 015, 016, 019 y 020 en curso; TASK-029 nueva), `docs/risks.md` § 5 (RB-01 a RB-06), README y CLAUDE.md. Pruebas: backend 74 → 87, `ml_service` 237, `nlp_service` 90. No se tocó la lógica de Adrian (`api`, `schemas`, `services`). | backend/{requirements.txt,requirements-dev.txt,.env.example,app/main.py,tests/test_aislamiento.py}, design.md, tasks.md, CONTEXT.md, README.md, CLAUDE.md, docs/risks.md |
| 18 | 2026-10-25 | Fase S4 reducida (TASK-011h): decisión del equipo de no cambiar el contrato público. ADR-0009 reescrita (sin `modo`; consecuencia y riesgo declarados), ADR-0008 sin cambio de contrato, design.md 1.5.3; `tests/test_contrato_publico.py` (11 pruebas); `test_ml.sh` con variante `demo`; README del servicio con la sección de los dos modelos. 237 pruebas. Open Question del rótulo cerrada; queda la de qué modelo usar en producción. No se tocaron `backend/app`, `nlp_service`, los modelos ni `cv_metrics.json`. | docs/adr/0008-servicio-ml-independiente.md, docs/adr/0009-modelo-demo-datos-sinteticos.md, design.md, tasks.md, CONTEXT.md, README.md, docs/ml/generador_sintetico.md, backend/ml_service/{README.md,test_ml.sh,tests/test_contrato_publico.py} |
| 17 | 2026-10-25 | Fase S3 (TASK-011g): modelo de demo entrenado con el dataset sintético reutilizando la tubería (`entrenar_y_evaluar(origen=...)`, `construir_pipeline(usar_smote=...)`, adaptador), sin SMOTE-NC y sin interacciones; artefactos y `cv_metrics_demo.json` en `artefactos/demo/`; `ML_MODELO=real|demo` con verificación de modo, huella y versiones; el servicio arranca y responde 503 con configuración inválida; 226 pruebas; `.pkl` del modelo real restaurado (huella idéntica al JSON versionado). design.md 1.5.2. Sin cambio de contrato público. | backend/ml_service/app/{train_baseline,train_demo,predict,metadatos,config,errors,main}.py, backend/ml_service/app/sintetico/adaptador.py, backend/ml_service/app/artefactos/demo/*.json, backend/ml_service/tests/**, backend/ml_service/{README.md,.env.example}, .gitignore, design.md, tasks.md, CONTEXT.md, docs/ml/generador_sintetico.md |
| 16 | 2026-10-25 | Fase S2 (TASK-011f): ADR-0009 (aprobada por el equipo); generador de datos sintéticos en `backend/ml_service/app/sintetico/` con CLI `python -m app.sintetico.generar`, 58 pruebas, dataset canónico (n = 2.000, semilla 20261024: prevalencia 15,0 %, AUC de las reglas 0,794) y su JSON de metadatos; `.gitignore` del CSV; README del servicio con la advertencia de honestidad; design.md 1.5.1. No se tocó el modelo real, `backend/app` ni el chatbot. | docs/adr/0009-modelo-demo-datos-sinteticos.md, backend/ml_service/app/sintetico/**, backend/ml_service/tests/sintetico/**, backend/ml_service/data/sintetico/dataset_sintetico.json, backend/ml_service/README.md, .gitignore, design.md, tasks.md, CONTEXT.md, README.md, docs/ml/generador_sintetico.md, docs/adr/0008-servicio-ml-independiente.md |
| 15 | 2026-10-24 | Fase S1 (solo documentación): especificación del generador de datos sintéticos para un modelo de demo del servicio de ML; decisiones cerradas con el equipo; reglas clínicas, distribuciones y esquemas; design.md 1.5.0 (sección "Modelo de demo con datos sintéticos") y TASK-011f/011g/011h; nuevas Open Questions. No se escribió código ni se tocó el modelo real, `backend/app` ni el chatbot. | docs/ml/generador_sintetico.md, design.md, tasks.md, CONTEXT.md |
| 14 | 2026-10-24 | Fase M6 (TASK-011e): retirado `backend/app/ml/` y el router de riesgo de `backend/app/main.py`; `backend/requirements.txt` sin librerías de ML; `cv_metrics.json` regenerado (solo cambian fecha, versiones y `generado_por`); README §2 con ADR-0004 reemplazado por ADR-0007; ADR-0006 sin "futuro motor de reglas"; design.md 1.4.6; documentación sin referencias al endpoint antiguo. | backend/app/main.py, backend/requirements.txt, backend/app/ml (eliminado), backend/ml_service/app/artefactos/cv_metrics.json, README.md, CLAUDE.md, .gitignore, design.md, tasks.md, CONTEXT.md, docs/** |
| 13 | 2026-10-24 | Fase M5b: `backend/ml_service/app/api/riesgo.py` (contrato sin `alerta`, 422/503/500 genéricos), `crear_app()` con `ML_ENABLE_DOCS`, corrección de `hba1c` ausente en `predict.py`, `test_ml.sh` movido con `git mv`, 116 pruebas. Latencia real p50 6.7 ms / p95 8.8 ms. design.md 1.4.5. | backend/ml_service/**, design.md, tasks.md, CONTEXT.md |
| 12 | 2026-10-24 | Fase M5a: scaffolding de `backend/ml_service/` (main con `/health`, config, errors, metadatos; requirements con versiones exactas incl. scipy 1.15.3; `.env.example`; README; `.venv`). Movidos con `git mv` `data_prep.py`, `train_baseline.py`, `predict.py`, `exportar_dataset.py` y el Excel; movidos `cv_evaluacion.py`, `cv_metrics.json` y las pruebas de M2. `train_baseline.py` escribe `modelo_hipoglucemia.json` con `sha256_pkl`; `predict.py` verifica huella y versiones antes de cargar. Reentrenamiento reproduce AUC 0.640 / recall 0.429. 59 pruebas. RT-06 en mitigación. design.md 1.4.4. | backend/ml_service/**, backend/app/ml/data_prep.py y predict.py (copias transitorias), design.md, tasks.md, CONTEXT.md, README.md, .gitignore, docs/risks.md, docs/model_baseline.md |
| 11 | 2026-10-24 | Fase M2b: referencias sin entrenamiento (constante, regla por medicación) y lift en `cv_evaluacion.py`; pruebas 18 passed; `cv_metrics.json` regenerado con el Excel real; `docs/model_baseline.md` §4.1 y §5 con la tabla de 7 filas; RD-05 (mediana de HbA1c) en risks.md; TASK-010a cerrada, TASK-010b en espera; design.md 1.4.3. Ninguna variante supera el azar. | backend/app/ml/cv_evaluacion.py, backend/app/ml/cv_metrics.json, backend/tests/ml/test_cv_evaluacion.py, docs/model_baseline.md, docs/risks.md, design.md, tasks.md, CONTEXT.md |
| 10 | 2026-10-24 | Fase M2 (TASK-010a, en curso): `backend/app/ml/cv_evaluacion.py` + `cv_metrics.json`; pruebas en `backend/tests/ml/` (11 passed); `backend/requirements-dev.txt`. Validación estratificada por paciente (k=5 × 5 semillas) y bootstrap de 1000 sobre pacientes. Ninguna variante tiene el límite inferior del IC del AUC sobre 0.5; no se cambia de modelo. design.md 1.4.2 (nombres de archivo). | backend/app/ml/cv_evaluacion.py, backend/app/ml/cv_metrics.json, backend/tests/ml/test_cv_evaluacion.py, backend/requirements-dev.txt, design.md, tasks.md, CONTEXT.md |
| 9 | 2026-10-24 | Respuestas del equipo a M1 (solo docs): requirements 1.2.0 (Overview, Actores, NFR-003); ADR-0008 y ADR-0001 reemplazado parcialmente; TASK-002b/025b/026b para el servicio de ML; TASK-013b cerrada con evidencia del commit `de9e753`; Open Question del perfil clínico con 4 opciones; README, C4 (servicio de ML como contenedor, bloques mermaid cerrados), corpus_conocimiento y baseline_chatbot apuntan a `reglas_ada.py`/TASK-012a; JSON de metadatos en git con `sha256_pkl` (design 1.4.1, `.gitignore`). | requirements.md, design.md, tasks.md, CONTEXT.md, README.md, .gitignore, docs/adr/0001-backend-monolitico-fastapi.md, docs/adr/0008-servicio-ml-independiente.md, docs/architecture/c4_container.md, docs/architecture/c4_context.md, docs/nlp/corpus_conocimiento.md, docs/nlp/baseline_chatbot.md |
| 8 | 2026-10-24 | Fase M1 (solo docs): conteos verificados contra el Excel (109 registros, 100 pacientes, 10 positivos, 4 mixtos, 193 filas, 17 positivas) y métricas reproducidas en memoria. data_ecosystem.md y model_baseline.md corregidos; la comparación con Random Forest del notebook no tiene salidas guardadas, así que se retiró su conclusión. REQ-004 redefinido (aprobado). ADR-0004 reemplazado por ADR-0007. design.md 1.4.0 (servicio de ML, clasificación ADA en el backend, Data Models). Tareas 010a/b, 011a–e y 012a; TASK-012/017/027 ajustadas. Riesgos RIA-01, RD-02, RD-04, RIA-06 y RT-06. | requirements.md, design.md, tasks.md, CONTEXT.md, docs/data_ecosystem.md, docs/model_baseline.md, docs/adr/0004-modelo-clasificacion-baseline.md, docs/adr/0007-regresion-logistica-baseline.md, docs/risks.md |
| 7 | 2026-10-24 | Fase C (TASK-018): `app/api/chatbot.py`, `auth.py` (401 con auth requerida hasta TASK-014), `rate_limit.py` (ventana de 60 s por IP, en memoria), manejadores de 422 genérico (incluido el 400 de cuerpo no UTF-8) y 503 por configuración inválida, `test_chatbot.sh`. 90 tests verdes; script end-to-end OK con FakeProvider. Sin llamadas a Gemini. | backend/nlp_service/app/{api/,auth.py,rate_limit.py,config.py,main.py}, backend/nlp_service/tests/, backend/nlp_service/test_chatbot.sh, backend/nlp_service/README.md, design.md, tasks.md, CONTEXT.md |
| 6 | 2026-10-24 | Fase B: scaffolding de `backend/nlp_service/` (venv propio, versiones verificadas con `pip index` + `pip check`), corpus v1 movido con `git mv` + v1.1 con tildes, `umbrales_ada_v1.json`, `config.py`, `clinical.py`, `errors.py`, `llm_client.py` (Gemini + Fake), `prompt_builder.py`, `service.py`, `dev_chat.py`, 59 tests (FakeProvider, sin red). `/health` → 200 con uvicorn. Sin llamadas reales a Gemini. | backend/nlp_service/**, docs/nlp/umbrales_ada_v1.json, .gitignore, design.md, tasks.md, CONTEXT.md, README.md, docs/nlp/corpus_conocimiento.md, docs/nlp/adr_system_prompting_vs_rag.md |
| 5 | 2026-10-24 | Respuestas del equipo a la Fase A.2 (solo docs): ADR-0001 reemplazado parcialmente; TASK-002a/025a/026a para el servicio NLP; RT-01 prefiere clave pública/JWKS; riesgos RT-03 (superficie expuesta), RT-04 (segundo despliegue) y RT-05 (sin auditoría en BD, aceptado y pendiente de confirmar en la revisión del PR); C4 con el servicio NLP separado; links C4 corregidos; CLAUDE.md y README actualizados. | docs/adr/0001-backend-monolitico-fastapi.md, tasks.md, design.md, docs/risks.md, CLAUDE.md, docs/architecture/c4_container.md, docs/architecture/c4_context.md, README.md, CONTEXT.md |
| 4 | 2026-10-24 | Fase A.2 (solo documentación): el chatbot pasa a servicio independiente `backend/nlp_service/` (ADR-0006). design.md 1.3.0 incluye arquitectura, File Structure, contrato, diseño del servicio, seguridad propia y formato de `umbrales_ada_v1.json`. ADR-0005 ajustado (D11 superado). TASK-013/018/024 reorganizadas (013a–013k). Referencias del corpus actualizadas. | design.md, tasks.md, CONTEXT.md, docs/adr/0005-proveedor-llm-chatbot.md, docs/adr/0006-nlp-servicio-independiente.md, docs/nlp/corpus_conocimiento.md, README.md |
| 3 | 2026-10-24 | TASK-013e: D11 resuelto con `supabase==2.16.0` + `httpx==0.28.1` (pip check limpio en venv temporal, con google-genai incluido); nombre del límite de tasa unificado a `CHATBOT_RATE_LIMIT_PER_MINUTE`. | backend/requirements.txt, docs/adr/0005-proveedor-llm-chatbot.md, tasks.md, CONTEXT.md |
| 2 | 2026-10-24 | Fase A del chatbot (solo documentación): Open Question del chatbot resuelta; contrato `POST /api/chatbot/consulta`; sección de diseño NLP y seguridad; ADR-0005 (proveedor LLM); TASK-013 dividida en 013a–013h; TASK-018/024 con ruta nueva; corrección de corpus_conocimiento.md §3. | design.md, tasks.md, CONTEXT.md, docs/adr/0005-proveedor-llm-chatbot.md, docs/nlp/corpus_conocimiento.md |
| 1 | 2026-08-24 | Se generaron requirements.md, design.md, tasks.md, CLAUDE.md a partir de la especificación original en Markdown. Deployment confirmado en Azure; herramienta de IA confirmada: Claude Code. | requirements.md, design.md, tasks.md, CLAUDE.md, CONTEXT.md |

*(most recent first — add a row at the start of each session)*

---

## Key decisions

| Decision | Rationale | Session |
|---|---|---|
| Deployment en Azure (no AWS EC2) | El documento original mencionaba ambas opciones; el usuario confirmó Azure. | 1 |
| Claude Code como herramienta de IA principal | Confirmado por el usuario en la entrevista inicial. | 1 |
| D1/D2: Gemini con interfaz intercambiable (Gemini/OpenAI/FakeProvider); `NLP_MODEL` (probado `gemini-3.5-flash-lite`), temperature 0.2, id exacto del modelo por corrida | Decisión del equipo; baseline gratis solo con las 20 preguntas sintéticas; pago u OpenAI para pacientes reales (ADR-0005) | 2 |
| D3: auth reemplazable, `CHATBOT_REQUIRE_AUTH=false` solo en desarrollo, límites de longitud (`CHATBOT_MAX_INPUT_CHARS`) y tasa (`CHATBOT_RATE_LIMIT_PER_MINUTE`); sin despliegue público hasta TASK-014 | RT-01 sigue abierto | 2 |
| ~~D4: constantes ADA únicas en `backend/app/core/clinical.py` + test del corpus contra ellas~~ **Reemplazada en sesión 4 (ADR-0006)** | Módulo neutral: lo usan ml/ (motor de reglas futuro) y nlp/ sin acoplarse entre sí | 2 |
| D5/D6: checks ejecutables sin LLM juez (Golden Dataset v1.1, mismas 20 preguntas); métrica sobre salida cruda, descargo forzado reportado aparte | Reproducibilidad; no inflar la métrica con correcciones del backend | 2 |
| D7: emergencias fuera de alcance v1 → TASK-013h (corpus v2 con revisión clínica) | Requiere revisión clínica | 2 |
| D8/D10: sin estado, sin tabla nueva; ruta `/api/chatbot/consulta` | Coherente con `/api/riesgo` | 2 |
| ~~D9: solo `reglas_ada_v1.txt` se mueve a `backend/app/nlp/corpus/`~~; Golden Dataset queda en `docs/nlp/`. **Destino reemplazado en sesión 4 (ADR-0006)** | Confirmado por el usuario en la sesión 2 | 2 |
| D11: conflicto httpx documentado en ADR-0005; `requirements.txt` sin cambios hasta TASK-013e | Opción recomendada: subir supabase | 2 |
| D11 resuelto: `supabase==2.16.0` + `httpx==0.28.1`; `pydantic==2.9.2` se mantiene | supabase 2.33.0 exige pydantic>=2.11.7 (vía realtime); 2.16.0 es la máxima que resuelve con los pines actuales. Ningún código importa supabase hoy | 3 |
| **Servicio NLP independiente** en `backend/nlp_service/` (`app/`, `tests/`, `requirements*.txt`, `.env.example`, README propios); no importa nada de `backend/app/` (ADR-0006) | Decisión del equipo: desacopla dependencias, fallas y despliegue del chatbot. Reemplaza ADR-0001 solo para el chatbot | 4 |
| La app llama **directo** al servicio NLP con `NLP_API_BASE_URL`, sin pasarela; la seguridad del servicio (longitud, tasa, auth reemplazable, HTTPS, sin log de consultas) es propia | Decisión del equipo. Registrada en design.md § Security, no como NFR nuevo (confirmado por el usuario) | 4 |
| Se conserva `POST /api/chatbot/consulta` | Sin colisión con la URL base propia; permite revertir sin tocar el cliente | 4 |
| ~~Solo NLP sale del monolito; ML sigue en `backend/app/ml/` (su migración es una decisión aparte)~~ **Reemplazada en sesiones 9 y 14 (ADR-0008, TASK-011e):** el ML también es un servicio independiente y `backend/app/ml/` se retiró | Decisión del equipo | 4 |
| Constantes ADA + descargo con tildes en `nlp_service/app/clinical.py`; test de contrato contra `docs/nlp/umbrales_ada_v1.json` (JSON, elegido por el usuario) y el corpus. **Reemplaza D4** (`backend/app/core/clinical.py`) | Cada servicio con su copia; el contrato evita la deriva | 4 |
| Corpus en `nlp_service/app/corpus/`: v1 movido sin cambios y `reglas_ada_v1.1.txt` con tildes como vigente. **Reemplaza el destino de D9** | El descargo con tildes no coincidía con v1; corpus_conocimiento.md §4 prohíbe sobrescribir (elegido por el usuario) | 4 |
| GeminiProvider (`google-genai`) + FakeProvider; OpenAIProvider diferido; temperature constante 0.2 (no env); versiones propias del servicio | Decisión del equipo | 4 |
| Servicio NLP: fastapi 0.162.0, pydantic 2.14.1, uvicorn 0.54.0, google-genai 2.33.0, python-dotenv 1.2.4; dev: pytest 9.1.1, httpx 0.28.1 | Últimas versiones según `pip index versions`, con `pip check` limpio; independientes del backend (ADR-0006) | 6 |
| `config.py` no carga `.env`: lo cargan `uvicorn --env-file .env` y `dev_chat` | Las pruebas nunca leen la clave real del desarrollador | 6 |
| Valores por defecto: timeout 30 s, `NLP_ENFORCE_DISCLAIMER=true`, `CHATBOT_REQUIRE_AUTH=true`, 1000 caracteres, 10/min | design.md delegaba los valores a config.py; seguros por defecto (auth exigida salvo en desarrollo) | 6 |
| El descargo se detecta sin distinguir tildes, mayúsculas ni saltos de línea antes de agregarlo | Evita duplicarlo cuando el LLM lo escribe con otra ortografía | 6 |
| En v1.1, la nota "[PENDIENTE…]" del cuerpo de v1 pasa al encabezado | Era metadato y se habría enviado al LLM; las reglas no cambian | 6 |
| Router en `app/api/chatbot.py` (no `app/router.py`) | Decisión del usuario en la sesión 7; design.md 1.3.2 actualizado antes del código | 7 |
| Límite de tasa por `request.client.host`; detrás de un proxy, `uvicorn --proxy-headers --forwarded-allow-ips` en el despliegue, sin variable nueva | Decisión del usuario; el código no confía en X-Forwarded-For (evita falsificación) | 7 |
| Orden: auth (401) → tasa (429) → entrada (422) → proveedor (503/502/504); las peticiones inválidas también cuentan para el límite | Que un cliente sin auth no llegue a validar ni a gastar cuota; abuso con cuerpos inválidos también limitado | 7 |
| El 400 de FastAPI por cuerpo no decodificable se responde como 422 genérico | El contrato no tiene 400 y el mensaje original estaba en inglés | 7 |
| **D11 superado** para el chatbot. Se propone revertir `backend/requirements.txt` a `supabase==2.7.4` sin el pin de httpx (TASK-013k, no aplicado) | El backend ya no comparte entorno con google-genai | 4 |
| **ML-D1:** el modelo solo estima la probabilidad de hipoglucemia observada en el registro; Normal/Hipo/Hiper sale del ML. REQ-004 v1.1.0: probabilidad visible **solo al médico**, informativa | Decisión del equipo; redacción aprobada por el usuario | 8 |
| **ML-D2:** Regresión Logística con SMOTE-NC es la línea base; se compara con árbol y Random Forest con las mismas semillas; se cambia solo con margen claro, y en empate gana el más simple (ADR-0007) | Decisión del equipo | 8 |
| **ML-D3:** `StratifiedGroupKFold` o `GroupKFold` repetido por paciente, SMOTE-NC dentro de cada fold, IC por bootstrap sobre pacientes (TASK-010a) | Decisión del equipo | 8 |
| **ML-D4:** el recall mínimo y el umbral de "Alta" se fijan tras M2 con revisión clínica; hasta entonces el modelo es solo informativo y el contrato no devuelve nivel de alerta (el modelo es experimental y TASK-010b está en espera) | Decisión del equipo; contrato elegido por el usuario | 8 |
| **ML-D5:** el servicio de ML no clasifica ni decide alertas. La **clasificación ADA** la hace la lógica de negocio del backend (`backend/app/core/reglas_ada.py`) y es el único disparador de alertas. Data Models: `clasificacion_ml` → `clasificacion_ada` y campos de riesgo nuevos | Decisión del equipo + opción elegida por el usuario (backend clasifica con umbrales ADA) | 8 |
| **ML-D6:** la etiqueta es "hipoglucemia observada en el registro", no del paciente | Decisión del equipo; 4 pacientes tienen visitas con etiquetas distintas | 8 |
| **ML-D7:** `.pkl` fuera de git; junto a él, un JSON de metadatos versionado (versión, fecha, SHA-256, versiones, métricas); versiones exactas de numpy, imbalanced-learn, joblib y openpyxl (TASK-011b) | Decisión del equipo. En la sesión 9 se confirmó que el JSON va en git, con la huella del `.pkl` dentro (`sha256_pkl`); `.gitignore` excluye `backend/ml_service/app/artefactos/*.pkl` | 8, 9 |
| **ADR-0008:** modelo de ML como servicio independiente `backend/ml_service/` (alternativas: monolito, carpeta aislada, repo separado). Solo lo llama el backend por red interna, sin autenticación propia en v1 y sin ingreso público. ADR-0001 queda reemplazado parcialmente por ADR-0006 y ADR-0008 | Decisión del equipo | 9 |
| requirements.md 1.2.0: Overview, Actores y NFR-003 describen el ML solo como estimador informativo, visible solo al médico | Decisión del equipo | 9 |
| Script de M2 `cv_evaluacion.py` y salida `cv_metrics.json` (versionada), en lugar de `validacion.py` | Decisión del usuario; design.md 1.4.2 actualizado antes del código | 10 |
| Validación: `StratifiedKFold` k=5 sobre **pacientes** (etiqueta: algún registro positivo), 5 semillas de partición. Es una forma de "GroupKFold repetido" (ML-D3) estratificada en la unidad correcta | `StratifiedGroupKFold` k=5 dejó folds sin positivos en 13/20 semillas (estratifica por filas); decisión del usuario | 10 |
| ML-D2 aplicada sobre M2: se mantiene la RL + SMOTE-NC (todos los IC del AUC se solapan; ninguno tiene el límite inferior > 0.5) | Regla de ML-D2; los resultados no muestran que otra variante sea mejor | 10 |
| M2b: dos referencias sin entrenamiento (constante y regla por `medicacion_cod`) y lift (precisión / prevalencia) en `cv_metrics.json`, sección `referencias` aparte de `variantes`; no entran en ML-D2. Resultado: la regla por medicación (AUC 0.462) no supera a la línea base (0.631) ni al azar; el modelo sigue experimental y TASK-010b queda en espera | Petición del usuario (fase M2b); design.md 1.4.3 actualizado antes del código. Fuga leve de la mediana de HbA1c registrada como RD-05, sin corregir | 11 |
| **Modelo de demo con datos sintéticos (S1):** segundo modelo separado, entrenado con datos generados desde reglas clínicas escritas por el equipo (no con un generador ajustado a los 109 registros). Aprende las reglas, no la realidad; sus métricas no son evidencia clínica. El modelo real no se modifica | Petición del usuario: el equipo no tiene pacientes reales y necesita una demo del flujo integrado | 15 |
| S1: prevalencia 15 %; 2.000 registros por defecto; señal moderada; AUC propio moderado (0,70 a 0,80) con ruido por muestreo Bernoulli; incluidas las reglas dudosas IMC bajo y HbA1c alta; neuropatía y cardiovascular sin efecto; 2 interacciones; glucosa continua; género, hipertensión y dislipidemia como controles sin efecto | Respuestas del usuario a las preguntas de la fase S1 | 15 |
| S3: el modelo de demo no usa SMOTE-NC (medido: AUC 0,722 frente a 0,783 y probabilidades infladas) ni interacciones (decisión del usuario: no mejoran el AUC); se deja el dataset canónico y se reporta el ruido de los coeficientes de control (neuropatía −0,44, hipertensión +0,21) en vez de cambiar n o la semilla | Medición con el dataset canónico y respuestas del usuario a las preguntas de la fase S3; design.md 1.5.2 | 17 |
| S3: `ML_MODELO` (carga selectiva) pasa de S4 a S3 | Petición del usuario (S3); design.md 1.5.2 | 17 |
| S2: CLI `python -m app.sintetico.generar` (no `generador`); calibración del intercepto sobre la prevalencia realizada con uniformes fijos; ventana de AUC de las reglas 0,70 a 0,80 (S1 decía 0,75 a 0,82) | Indicación del usuario y decisión de implementación; design.md 1.5.1; las reglas siguen pendientes de revisión por el equipo | 16 |
| S1: `escala_senal = 0,8` (ajuste global de la señal) y unidad de generación = un registro por lectura, con pacientes de 1 a 3 registros | Decisión de diseño de la especificación, tras una simulación numérica desechable (AUC de las reglas ≈ 0,78 con 0,8 frente a ≈ 0,83 con 1,0); pendiente de revisión por el equipo | 15 |
| Integración del backend de Adrian: se conserva su lógica sin cambios (`api`, `schemas`, `services`); solo se corrigen dependencias, el resto de ML en `main.py`, `.env.example` y se añade una prueba de aislamiento. CORS, el secreto JWT por defecto y la falta de autenticación se reportan como riesgos (RB-01 a RB-05), no se cambian | Decisión del usuario (respuestas al diagnóstico posterior a la fusión) | 19 |
| ADR-0009 "Modelo de demo con datos sintéticos" aprobada: segundo modelo separado, activable con `ML_MODELO=demo` (por defecto `real`); **no cambia el contrato de ADR-0008** | Equipo; actualizada en S4 | 16 |
| **S4 reducida: el contrato público NO cambia.** No se añade `modo` ni aviso a la respuesta ni a `/health`; la API no distingue el modelo real del entrenado con datos sintéticos (trazabilidad en metadatos `entrenado_con`, `ML_MODELO`, huella y documentación). Riesgo: si llegara a usuarios reales habría que reponer la marca | Decisión del equipo (Fase S4); ADR-0009 y design.md 1.5.3 | 18 |
| M5a: `backend/app/ml/` conservó `riesgo.py` y copias idénticas de `data_prep.py` y `predict.py` solo hasta TASK-011e (retiradas en la sesión 14); el Excel solo se movió | Decisión del usuario (respuesta a un conflicto entre "no mover riesgo.py" y "dejar el backend funcionando") | 12 |
| M5a: scipy 1.15.3 y numpy 2.4.6 (con scikit-learn 1.5.2 y pandas 2.2.3), la combinación más reciente sin el aviso `iprint`; `baseline_metrics.json` se ignora en git (derivado del JSON versionado); `exportar_dataset.py` escribe en `ml_service/data/` | Petición del usuario ("la combinación compatible más reciente y justificada"); design.md 1.4.4 | 12 |
| M5b: campos adicionales en la entrada → 422 (`extra=forbid`) y configuración inválida → 503 | Decisión de implementación (minimización: un nombre o id enviado por error no se procesa); design.md 1.4.5 | 13 |
| **ML-D8:** solo el backend llama al servicio de ML (`backend/ml_service/`, destino) por red interna; ni público ni llamado por la app. La autenticación entre servicios es una Open Question | Decisión del equipo; opción "red interna + Open Question" elegida por el usuario | 8 |

---

## Open questions

Things still to be resolved. Move to design.md once decided.

- [ ] ¿Qué esquema de autenticación se usará (JWT, sesiones con Supabase Auth, OAuth)?
- [x] ¿El modelo de ML ya está entrenado o se entrena como parte de este proyecto? → Resuelta en design.md 1.4.0 (se entrena aquí; Regresión Logística con SMOTE-NC, ADR-0007)
- [ ] Perfil clínico del ML sin lugar en Data Models (género, edad, BMI, duración, medicación, comorbilidades, HbA1c): ¿dónde se capturan? **Bloquea TASK-017, no el servicio de ML.** Opciones, sin resolver (detalle en design.md § Open Questions):
  1. Ampliar T_Paciente.
  2. Tabla nueva `T_Perfil_clinico` con vigencia.
  3. Instantánea del perfil por predicción (complementaria).
  4. No persistir: la app lo envía con cada lectura.
- [ ] Autenticación del backend de negocio: hoy hay login con OTP por correo, sin token y sin endpoints autenticados (RB-01); decidir el esquema (RT-01) e implementarlo (TASK-014)
- [ ] Alcance de `seguimiento_embarazo`: el backend lo implementa y no está en requirements.md, design.md ni tasks.md
- [ ] Reconciliar rutas y esquema reales del backend con design.md (TASK-029)
- [ ] CORS del backend: `allow_origins` con `"*"` y credenciales (RB-02)
- [ ] Qué modelo usar en producción: ¿se permite `ML_MODELO=demo` fuera de desarrollo y presentaciones, o el despliegue debe rechazarlo? La API no marca el modelo (decisión del equipo), así que si llegara a usuarios reales habría que reponer la marca o impedir ese valor
- [ ] Validación de las reglas clínicas del generador sintético: ¿quién (profesional de la salud) las revisa y aprueba? Hoy están pendientes de revisión por el equipo
- [ ] Despliegue del servicio de ML sin ingreso público, solo por red interna (TASK-002b); es la única protección del endpoint en v1
- [ ] Autenticación backend → servicio de ML (identidad administrada, mTLS o token)
- [ ] Regla de hiperglucemia ADA para el momento `otro`, y revisión clínica de etiquetas y cortes
- [x] ¿El chatbot usa un LLM externo o un modelo NLP propio? → Resuelta en design.md (LLM externo + inyección estática; ADR-0005)
- [ ] ¿Qué servicio de Azure se usará para notificaciones push?
- [ ] ¿Cómo se valida la matrícula médica — contra un registro externo o solo formato?

---

## Divergences from design.md

Any place where implementation differs from design.md, pending
a formal design.md update.

| Divergencia | Motivo | Se cierra cuando |
|---|---|---|
| Servicio NLP sin autenticación hasta TASK-014 | design.md § API indica Auth = Paciente y el servicio está expuesto directamente a la app (ADR-0006), pero el esquema de auth (RT-01) no está decidido. Se usa una dependencia reemplazable con `CHATBOT_REQUIRE_AUTH=false` solo en desarrollo, con límites de longitud y tasa, y sin despliegue público | TASK-014 implementada y el servicio NLP validando localmente el token de sesión |

---

## Changelog

| Session | Date | Summary |
|---|---|---|
| 8 | 2026-10-24 | Fase M1: documentación del ML corregida y especificación del servicio de ML (design.md 1.4.0, ADR-0007, REQ-004 v1.1.0) |
| 7 | 2026-10-24 | Fase C: TASK-018 completada (endpoint del servicio NLP) |
| 6 | 2026-10-24 | Fase B: servicio NLP sin endpoint público (013a, 013c, 013d, 013i y 013j completadas; 013b en [~]) |
| 4 | 2026-10-24 | Fase A.2: chatbot como servicio independiente (design.md 1.3.0, ADR-0006, tasks 013a–013k) |
| 3 | 2026-10-24 | TASK-013e completada (D11) y nombre de variable de límite de tasa unificado |
| 2 | 2026-10-24 | Fase A del chatbot: especificación documentada (design.md 1.2.0, ADR-0005, tasks 013a–013h) |
| 1 | 2026-08-24 | Sesión abierta — spec inicial generada a partir del documento del usuario |
