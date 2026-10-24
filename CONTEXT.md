# CONTEXT.md
> GlucoTracker — Live session journal
> Last updated: 2026-10-24 — Session 2

## ⚡ Resume from here

**Active task:** TASK-013 — Módulo NLP del chatbot. Fase A (especificación) y TASK-013e (D11) completadas; siguiente: TASK-013d (mover corpus), luego TASK-013a.
**Phase:** Phase 3: Lógica de Negocio
**Status:** in progress — especificación lista, dependencias resueltas, código del chatbot sin empezar
**Blocker (if any):** none. Nota para TASK-013a: con `pydantic==2.9.2`, la versión máxima compatible de `google-genai` es 2.8.0 (ADR-0005, D11)

> On session start: read this file first, then requirements.md,
> design.md, and tasks.md. Do not ask what to work on — resume
> the active task above unless the user says otherwise.

---

## Session log

| # | Date | What was done | Files changed |
|---|---|---|---|
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
| D4: constantes ADA únicas en `backend/app/core/clinical.py` + test del corpus contra ellas | Módulo neutral: lo usan ml/ (motor de reglas futuro) y nlp/ sin acoplarse entre sí | 2 |
| D5/D6: checks ejecutables sin LLM juez (Golden Dataset v1.1, mismas 20 preguntas); métrica sobre salida cruda, descargo forzado reportado aparte | Reproducibilidad; no inflar la métrica con correcciones del backend | 2 |
| D7: emergencias fuera de alcance v1 → TASK-013h (corpus v2 con revisión clínica) | Requiere revisión clínica | 2 |
| D8/D10: sin estado, sin tabla nueva; ruta `/api/chatbot/consulta` | Coherente con `/api/riesgo` | 2 |
| D9: solo `reglas_ada_v1.txt` se mueve a `backend/app/nlp/corpus/`; Golden Dataset queda en `docs/nlp/` | Confirmado por el usuario en la sesión 2 | 2 |
| D11: conflicto httpx documentado en ADR-0005; `requirements.txt` sin cambios hasta TASK-013e | Opción recomendada: subir supabase | 2 |
| D11 resuelto: `supabase==2.16.0` + `httpx==0.28.1`; `pydantic==2.9.2` se mantiene | supabase 2.33.0 exige pydantic>=2.11.7 (vía realtime); 2.16.0 es la máxima que resuelve con los pines actuales. Ningún código importa supabase hoy | 3 |

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
| Endpoint `/api/chatbot/consulta` sin autenticación hasta TASK-014 | design.md § API indica Auth = Paciente, pero el esquema de auth (RT-01) no está decidido; se usa una dependencia reemplazable con `CHATBOT_REQUIRE_AUTH=false` solo en desarrollo y sin despliegue público | TASK-014 implementada y la dependencia conectada al token real |

---

## Changelog

| Session | Date | Summary |
|---|---|---|
| 3 | 2026-10-24 | TASK-013e completada (D11) y nombre de variable de límite de tasa unificado |
| 2 | 2026-10-24 | Fase A del chatbot: especificación documentada (design.md 1.2.0, ADR-0005, tasks 013a–013h) |
| 1 | 2026-08-24 | Sesión abierta — spec inicial generada a partir del documento del usuario |
