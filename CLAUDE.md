# CLAUDE.md
> Configuración de Claude Code para GlucoTracker

═══════════════════════════════════════════════════════════
SPEC DRIVEN DEVELOPMENT — PROJECT CONSTITUTION
Project: GlucoTracker
Version: 1.0.0
═══════════════════════════════════════════════════════════

This project uses Spec Driven Development. All work is
governed by three source-of-truth files:

  requirements.md  — What the system must do
  design.md        — How the system is structured
  tasks.md         — The ordered implementation plan

MANDATORY BEFORE ANY ACTION:
  0. If CONTEXT.md exists, read it first — it has session state
  1. Read requirements.md in full
  2. Read design.md in full
  3. Read tasks.md — identify the next incomplete [ ] task

HARD CONSTRAINTS:
  ✗ Never implement requirements not in requirements.md
  ✗ Never alter the data model without updating design.md first
  ✗ Never create files not listed or implied in design.md
  ✗ Never mark a task [x] without verifying its acceptance criterion
  ✗ Never guess when a requirement is ambiguous — ask instead

AFTER COMPLETING A TASK:
  1. Run the verification step listed in tasks.md
  2. Mark the task [x] in tasks.md
  3. Report what was done and which REQ/NFR it satisfies

DIVERGENCE PROTOCOL:
  If implementation must deviate from design.md:
    → Stop immediately
    → Describe the conflict clearly
    → Wait for explicit user approval
    → Update design.md BEFORE writing code
═══════════════════════════════════════════════════════════

## Notas específicas de Claude Code para GlucoTracker

- Stack: React Native (`mobile/`) + FastAPI/Python (`backend/app/`, backend de negocio: login con OTP, médicos, pacientes, administradores, registros, PDF; sin ML ni chatbot) + servicio de ML independiente (`backend/ml_service/`, ADR-0008) + servicio NLP independiente FastAPI/Python (`backend/nlp_service/`, ADR-0006) + Supabase/PostgreSQL, desplegado en Azure.
- Datos médicos son sensibles (NFR-001) — nunca loguear niveles de glucosa ni datos personales en texto plano en consola; en el servicio NLP tampoco el texto de las consultas.
- El modelo de ML vive en el servicio independiente `backend/ml_service/` (ADR-0008; no importa nada de `backend/app/` ni de `nlp_service/`; se ejecuta y prueba desde su propia carpeta). Es experimental y solo informativo. Tiene Open Questions sin resolver en design.md (perfil clínico, autenticación entre servicios, despliegue sin ingreso público) — consultarlas antes de tocar TASK-010b o TASK-017. El chatbot vive en `backend/nlp_service/` (no importa nada de `backend/app/`; se ejecuta y prueba desde su propia carpeta); ver design.md § Servicio NLP (chatbot) Design antes de implementar TASK-013.
- Cualquier cambio al esquema de T_Registro_glucosa, T_Alertas o T_Usuario requiere actualizar design.md § Data Models primero.
