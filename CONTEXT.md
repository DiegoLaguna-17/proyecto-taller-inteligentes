# CONTEXT.md
> GlucoTracker — Live session journal
> Last updated: 2026-10-24 — Session 4

## ⚡ Resume from here

**Active task:** TASK-013 / TASK-018 — servicio NLP independiente (`backend/nlp_service/`, ADR-0006). Fase C: TASK-018 completada (endpoint `POST /api/chatbot/consulta`). 013b sigue en `[~]` hasta verificar `git log --follow` tras el commit. Siguiente: prueba manual del usuario con Gemini real (curl y 429), luego TASK-013f/013g (Golden Dataset v1.1 y baseline). TASK-013k sigue pendiente y es independiente.
**Phase:** Phase 3/4: Lógica de Negocio / Capa de API
**Status:** in progress — endpoint con 401/429/422/503/502/504; 90 tests verdes; sin despliegue público (auth pendiente de TASK-014)
**Blocker (if any):** none

> On session start: read this file first, then requirements.md,
> design.md, and tasks.md. Do not ask what to work on — resume
> the active task above unless the user says otherwise.

---

## Session log

| # | Date | What was done | Files changed |
|---|---|---|---|
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
| **Servicio NLP independiente** en `backend/nlp_service/` (`app/`, `tests/`, `requirements*.txt`, `.env.example`, README propios); no importa `backend/app/core` ni `backend/app/ml` (ADR-0006) | Decisión del equipo: desacopla dependencias, fallas y despliegue del chatbot. Reemplaza ADR-0001 solo para el chatbot | 4 |
| La app llama **directo** al servicio NLP con `NLP_API_BASE_URL`, sin pasarela; la seguridad del servicio (longitud, tasa, auth reemplazable, HTTPS, sin log de consultas) es propia | Decisión del equipo. Registrada en design.md § Security, no como NFR nuevo (confirmado por el usuario) | 4 |
| Se conserva `POST /api/chatbot/consulta` | Sin colisión con la URL base propia; permite revertir sin tocar el cliente | 4 |
| Solo NLP sale del monolito; ML sigue en `backend/app/ml/` (su migración es una decisión aparte) | Decisión del equipo | 4 |
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

---

## Open questions

Things still to be resolved. Move to design.md once decided.

- [ ] ¿Qué esquema de autenticación se usará (JWT, sesiones con Supabase Auth, OAuth)?
- [ ] ¿El modelo de ML ya está entrenado o se entrena como parte de este proyecto?
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
| 7 | 2026-10-24 | Fase C: TASK-018 completada (endpoint del servicio NLP) |
| 6 | 2026-10-24 | Fase B: servicio NLP sin endpoint público (013a, 013c, 013d, 013i y 013j completadas; 013b en [~]) |
| 4 | 2026-10-24 | Fase A.2: chatbot como servicio independiente (design.md 1.3.0, ADR-0006, tasks 013a–013k) |
| 3 | 2026-10-24 | TASK-013e completada (D11) y nombre de variable de límite de tasa unificado |
| 2 | 2026-10-24 | Fase A del chatbot: especificación documentada (design.md 1.2.0, ADR-0005, tasks 013a–013h) |
| 1 | 2026-08-24 | Sesión abierta — spec inicial generada a partir del documento del usuario |
