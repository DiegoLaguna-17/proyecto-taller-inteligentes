# CONTEXT.md
> GlucoTracker — Live session journal
> Last updated: 2026-08-24 — Session 1

## ⚡ Resume from here

**Active task:** TASK-001 — Crear proyecto Supabase (PostgreSQL) y configurar credenciales de conexión seguras
**Phase:** Phase 1: Infraestructura
**Status:** ready for next task
**Blocker (if any):** none

> On session start: read this file first, then requirements.md,
> design.md, and tasks.md. Do not ask what to work on — resume
> the active task above unless the user says otherwise.

---

## Session log

| # | Date | What was done | Files changed |
|---|---|---|---|
| 1 | 2026-08-24 | Se generaron requirements.md, design.md, tasks.md, CLAUDE.md a partir de la especificación original en Markdown. Deployment confirmado en Azure; herramienta de IA confirmada: Claude Code. | requirements.md, design.md, tasks.md, CLAUDE.md, CONTEXT.md |

*(most recent first — add a row at the start of each session)*

---

## Key decisions

| Decision | Rationale | Session |
|---|---|---|
| Deployment en Azure (no AWS EC2) | El documento original mencionaba ambas opciones; el usuario confirmó Azure. | 1 |
| Claude Code como herramienta de IA principal | Confirmado por el usuario en la entrevista inicial. | 1 |

---

## Open questions

Things still to be resolved. Move to design.md once decided.

- [ ] ¿Qué esquema de autenticación se usará (JWT, sesiones con Supabase Auth, OAuth)?
- [ ] ¿El modelo de ML ya está entrenado o se entrena como parte de este proyecto?
- [ ] ¿El chatbot usa un LLM externo o un modelo NLP propio?
- [ ] ¿Qué servicio de Azure se usará para notificaciones push?
- [ ] ¿Cómo se valida la matrícula médica — contra un registro externo o solo formato?

---

## Divergences from design.md

Any place where implementation differs from design.md, pending
a formal design.md update.

(ninguna registrada aún)

---

## Changelog

| Session | Date | Summary |
|---|---|---|
| 1 | 2026-08-24 | Sesión abierta — spec inicial generada a partir del documento del usuario |
