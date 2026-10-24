# design.md
> GlucoTracker — Version 1.2.0 — 2026-10-24

## Architecture Overview
Arquitectura de monolito modular basada en microservicios lógicos desacoplados. La app móvil (React Native) consume una API REST expuesta por un backend en FastAPI, que centraliza tanto la lógica de negocio como el módulo de Machine Learning (clasificación de glucosa) y el módulo de NLP del chatbot, evitando una complejidad innecesaria de microservicios distribuidos en esta etapa (ver ADR-0001). La persistencia se resuelve con Supabase/PostgreSQL gestionado (ver ADR-0002). El backend se despliega en Azure (ver ADR-0003).

**Stack**: React Native (frontend móvil) · FastAPI/Python (backend + ML + NLP) · Supabase/PostgreSQL (base de datos)
**Deployment**: Azure (hosting del backend y del módulo de ML), con conexión segura vía certificados SSL

## System Diagram (C4 Model Reference)

La arquitectura formal del sistema está documentada mediante el estándar C4:
- **Nivel 1 (Contexto):** [Ver Diagrama de Contexto](docs/architecture/c4-context.md) — Muestra la interacción de Pacientes, Médicos y Administradores con GlucoTracker.
- **Nivel 2 (Contenedores):** [Ver Diagrama de Contenedores](docs/architecture/c4-container.md) — Detalla la App Móvil, la API FastAPI, Supabase y los módulos internos de ML y NLP.

Resumen visual del flujo de contenedores:

```
[App Móvil - React Native]
        |  HTTPS/REST
        v
[Backend API - FastAPI en Azure]
        |-- Módulo ML (clasificación SVC/Árbol de Decisión - ver ADR-0004)
        |-- Módulo NLP (chatbot) --HTTPS--> [LLM externo: Gemini / OpenAI - ver ADR-0005]
        |
        v
[Supabase / PostgreSQL]
        |
        v
[Notificaciones push -> dispositivo del Médico]
```

## Architecture Decision Records (ADR)
Las decisiones técnicas críticas del proyecto han sido formalizadas y justificadas frente a alternativas descartadas:
1. **ADR-0001:** [Uso de Backend Monolítico con FastAPI](docs/adr/0001-backend-monolitico-fastapi.md)
2. **ADR-0002:** [Uso de Supabase / PostgreSQL](docs/adr/0002-supabase-postgresql.md)
3. **ADR-0003:** [Selección de Azure como Entorno Cloud](docs/adr/0003-despliegue-azure.md)
4. **ADR-0004:** [Selección de Modelo Baseline (SVC / Árbol de Decisión)](docs/adr/0004-modelo-clasificacion-baseline.md)
5. **ADR-0005:** [Proveedor LLM del chatbot (Gemini con interfaz intercambiable)](docs/adr/0005-proveedor-llm-chatbot.md)
6. **ADR NLP:** [System Prompting vs. RAG para el chatbot](docs/nlp/adr_system_prompting_vs_rag.md)

## Data Models

### T_Usuario
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | Identificador de usuario |
| nombre | VARCHAR(255) | NOT NULL | |
| correo | VARCHAR(255) | NOT NULL, UNIQUE | |
| contrasena_hash | TEXT | NOT NULL | Hasheada, nunca texto plano (NFR-001) |
| rol | VARCHAR(20) | NOT NULL, CHECK IN ('paciente','medico','administrador') | |
| estado | VARCHAR(20) | NOT NULL DEFAULT 'pendiente' | pendiente / aprobado / rechazado |

**Relationships**: 1—1 con T_Paciente, T_Medico o T_Administrador según `rol`.

### T_Paciente
| Field | Type | Constraints | Notes |
|---|---|---|---|
| usuario_id | UUID | PK, FK → T_Usuario.id | |
| actividad_fisica | VARCHAR(100) | NULL | |
| enfermedades_base | TEXT | NULL | |
| medico_asignado_id | UUID | FK → T_Medico.usuario_id, NULL | Médico responsable para alertas (REQ-005) |

**Relationships**: N—1 con T_Medico (médico asignado); 1—N con T_Registro_glucosa.

### T_Medico
| Field | Type | Constraints | Notes |
|---|---|---|---|
| usuario_id | UUID | PK, FK → T_Usuario.id | |
| especialidad | VARCHAR(100) | NOT NULL | |
| matricula | VARCHAR(50) | NOT NULL, UNIQUE | Validada en el registro (REQ-002) |

**Relationships**: 1—N con T_Paciente (pacientes asignados).

### T_Administrador
| Field | Type | Constraints | Notes |
|---|---|---|---|
| usuario_id | UUID | PK, FK → T_Usuario.id | |

**Relationships**: Ninguna adicional — hereda de T_Usuario.

### T_Registro_glucosa
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| paciente_id | UUID | FK → T_Paciente.usuario_id, NOT NULL | |
| fecha | DATE | NOT NULL | |
| hora | TIME | NOT NULL | |
| momento_dia | VARCHAR(30) | NOT NULL, CHECK IN ('ayunas','postprandial','otro') | |
| nivel_glucosa | NUMERIC(5,1) | NOT NULL | mg/dL |
| clasificacion_ml | VARCHAR(20) | NULL | Normal / Riesgo Hipo / Riesgo Hiper (REQ-004) |
| clasificado_en | TIMESTAMP | NULL | Cuándo el modelo emitió la clasificación |

**Relationships**: N—1 con T_Paciente; 1—N con T_Alertas.

### T_Alertas
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| registro_glucosa_id | UUID | FK → T_Registro_glucosa.id, NOT NULL | |
| tipo_alerta_id | UUID | FK → T_Tipo_alerta.id, NOT NULL | |
| vista | BOOLEAN | NOT NULL DEFAULT false | |
| respuesta_medico | TEXT | NULL | |
| creada_en | TIMESTAMP | NOT NULL DEFAULT now() | |

**Relationships**: N—1 con T_Registro_glucosa; N—1 con T_Tipo_alerta.

### T_Tipo_alerta
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| nombre | VARCHAR(50) | NOT NULL | ej. 'Hipoglucemia crítica' |
| nivel_criticidad | VARCHAR(20) | NOT NULL | |

**Relationships**: 1—N con T_Alertas.

### T_Auditoria_Endpoints
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| usuario_id | UUID | FK → T_Usuario.id, NULL | Null si la llamada no está autenticada |
| endpoint | VARCHAR(255) | NOT NULL | |
| metodo_http | VARCHAR(10) | NOT NULL | |
| timestamp | TIMESTAMP | NOT NULL DEFAULT now() | |
| resultado | VARCHAR(20) | NOT NULL | éxito / error / no autorizado |

**Relationships**: N—1 con T_Usuario (opcional).

## API / Interface Design

| Method | Path | Auth | REQ | Description |
|---|---|---|---|---|
| POST | /auth/login | Público | REQ-001 | Inicio de sesión, retorna token |
| POST | /auth/registro | Administrador | REQ-002 | Alta de paciente o médico, valida matrícula |
| POST | /pacientes/{id}/registros-glucosa | Paciente | REQ-003 | Registrar nueva toma de glucosa |
| GET | /ml/clasificar/{registro_id} | Sistema (interno) | REQ-004 | Clasifica un registro con el modelo ML |
| POST | /alertas | Sistema (interno) | REQ-005 | Crea alerta y dispara notificación push al médico |
| POST | /api/chatbot/consulta | Paciente (pendiente RT-01; ver contrato abajo) | REQ-006 | Envía consulta de texto libre al chatbot |
| GET | /pacientes/{id}/historial | Paciente, Médico | REQ-007 | Historial de glucosa filtrable por rango de fechas |
| GET | /pacientes/{id}/reporte-pdf | Médico | REQ-008 | Genera y descarga reporte clínico en PDF |

### Contrato: POST /api/chatbot/consulta (REQ-006)

Router en `backend/app/api/chatbot.py`, prefijo `/api/chatbot` (mismo patrón `/api/...` que `/api/riesgo`). Sin estado: una consulta por request, sin historial de conversación ni tabla nueva (no cambia § Data Models).

**Entrada** (`application/json`):

| Campo | Tipo | Restricción |
|---|---|---|
| texto | str | Obligatorio; longitud de 1 a `CHATBOT_MAX_INPUT_CHARS` caracteres |

**Salida 200**:

| Campo | Tipo | Notas |
|---|---|---|
| respuesta | str | Texto del LLM; si `NLP_ENFORCE_DISCLAIMER=true` y falta el descargo médico, el endpoint lo agrega por código |

**Errores** (el `detail` nunca incluye el texto de la consulta ni la respuesta del proveedor):

| Código | Causa |
|---|---|
| 422 | Entrada inválida (falta `texto`, vacío, o supera `CHATBOT_MAX_INPUT_CHARS`) |
| 429 | Límite de tasa superado |
| 503 | Proveedor LLM no configurado (falta `NLP_PROVIDER`, `NLP_MODEL` o `NLP_PROVIDER_API_KEY`) |
| 502 | Fallo del proveedor (error de la API externa o respuesta vacía) |
| 504 | Timeout de la llamada al proveedor (`NLP_TIMEOUT_SECONDS`) |

**Autenticación**: dependencia FastAPI reemplazable. Con `CHATBOT_REQUIRE_AUTH=false` (solo desarrollo) el endpoint no exige token; el valor real de la dependencia se conecta cuando exista TASK-014. Sin despliegue público hasta TASK-014 (ver Security Design y CONTEXT.md § Divergences).

## Chatbot (Módulo NLP) Design

Enfoque: LLM externo con inyección estática de contexto vía system prompt (ver [ADR System Prompting vs. RAG](docs/nlp/adr_system_prompting_vs_rag.md)); proveedor según [ADR-0005](docs/adr/0005-proveedor-llm-chatbot.md).

| Componente | Responsabilidad |
|---|---|
| `app/core/config.py` | Lee y valida las variables de entorno del chatbot (tabla abajo). Ninguna clave tiene valor por defecto en código. |
| `app/core/clinical.py` | Constantes ADA únicas del backend: 70, 130 y 180 mg/dL; 15 g de carbohidratos; 15 min. Las usan el futuro motor de reglas ADA y el test de consistencia del corpus. No son configurables por entorno. |
| `app/nlp/llm_client.py` | Interfaz `LLMClient` (`generar(system_prompt, texto) -> str` + id exacto del modelo) con implementaciones Gemini, OpenAI y `FakeProvider` (determinístico, sin red, usado por todas las pruebas). Selección por `NLP_PROVIDER`. |
| `app/nlp/prompt_builder.py` | Construye el system prompt a partir de `app/nlp/corpus/reglas_ada_v1.txt` (corpus completo, sin recuperación). |
| `app/nlp/service.py` | `responder_consulta(texto)`: arma el prompt, llama al `LLMClient` con `temperature` 0.2 y, si `NLP_ENFORCE_DISCLAIMER=true`, agrega el descargo médico cuando falta. |
| `app/nlp/errors.py` | Excepciones del dominio (proveedor no configurado, fallo del proveedor, timeout) que el router traduce a 503 / 502 / 504. Sus mensajes nunca contienen el texto de la consulta. |
| `app/nlp/checks.py` | Evaluador determinístico de `checks_esperados` (`contiene:` / `NO_contiene:`) del Golden Dataset; sin LLM como juez. |
| `app/nlp/evaluation.py` | Script del baseline: corre las 20 preguntas sintéticas del Golden Dataset v1.1 (`docs/nlp/`) sin y con contexto, y genera `app/nlp/nlp_baseline_metrics.json`. |
| `app/nlp/corpus/` | `reglas_ada_v1.txt`, movido desde `docs/nlp/` (D9). El Golden Dataset permanece en `docs/nlp/`. |

**Variables de entorno** (solo nombres; los valores van en `backend/.env`, nunca en el repositorio):

| Variable | Uso |
|---|---|
| `NLP_PROVIDER` | `gemini` \| `openai` \| `fake` |
| `NLP_MODEL` | Id del modelo del proveedor. Valor probado por el equipo para el baseline: `gemini-3.5-flash-lite` |
| `NLP_PROVIDER_API_KEY` | Clave del proveedor (ya existe en `.env.example`) |
| `NLP_TIMEOUT_SECONDS` | Timeout de la llamada al proveedor → 504 |
| `NLP_ENFORCE_DISCLAIMER` | Si el endpoint agrega el descargo médico por código cuando falta |
| `CHATBOT_REQUIRE_AUTH` | `false` solo en desarrollo |
| `CHATBOT_MAX_INPUT_CHARS` | Longitud máxima de `texto` → 422 |
| `CHATBOT_RATE_LIMIT_PER_MINUTE` | Límite de tasa → 429 |

**Evaluación del baseline** (ver `docs/nlp/baseline_chatbot.md`):
- La Tasa de Adherencia se mide sobre la **salida cruda del LLM** (sin el descargo agregado por código). La adherencia con descargo forzado (`NLP_ENFORCE_DISCLAIMER`) se reporta aparte en el mismo JSON.
- Cada corrida guarda el id exacto del modelo devuelto por el proveedor (`modelo_llm`), `temperature`, versión del corpus y versión del Golden Dataset.
- El baseline se corre con Gemini en tier gratuito **solo con las 20 preguntas sintéticas**. Ningún dato de paciente real pasa por el tier gratuito; para pacientes reales se cambia a Gemini de pago u OpenAI (ADR-0005).
- Golden Dataset v1.1: mismas 20 preguntas que v1; los checks semánticos (`descargo_medico`, `no_puedo_recomendar_dosis`, `no_tengo_informacion`, `consulta_profesional`, `aumentar_dosis`) se reemplazan por condiciones ejecutables por código, y se define la regla de coincidencia (mayúsculas, acentos, límites de palabra).

**Fuera de alcance v1**: manejo de emergencias (síntomas severos, pérdida de conciencia, etc.); queda para un corpus v2 con revisión clínica (ver tasks.md).

## File Structure
```
glucotracker/
├── mobile/                  # App React Native
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   └── services/        # Clientes de la API REST
│   └── app.json
├── backend/                 # API FastAPI
│   ├── app/
│   │   ├── api/              # Routers (auth, pacientes, alertas, chatbot)
│   │   │   └── chatbot.py    # POST /api/chatbot/consulta (REQ-006)
│   │   ├── ml/                # Modelo de clasificación (SVC/Árbol de Decisión)
│   │   ├── nlp/                # Lógica del chatbot
│   │   │   ├── llm_client.py   # Interfaz LLMClient + Gemini / OpenAI / FakeProvider
│   │   │   ├── prompt_builder.py # System prompt desde corpus/
│   │   │   ├── service.py      # responder_consulta(texto)
│   │   │   ├── errors.py       # Errores de proveedor → 503 / 502 / 504
│   │   │   ├── checks.py       # Checks determinísticos del Golden Dataset
│   │   │   ├── evaluation.py   # Script del baseline → nlp_baseline_metrics.json
│   │   │   └── corpus/         # reglas_ada_v1.txt (movido desde docs/nlp/)
│   │   ├── models/             # Esquemas / ORM
│   │   ├── core/                # Config, seguridad, conexión a Supabase
│   │   │   ├── config.py       # Settings desde variables de entorno
│   │   │   └── clinical.py     # Constantes ADA compartidas (70/130/180 mg/dL, 15 g, 15 min)
│   │   └── test_chatbot.sh     # Script end-to-end del chatbot (análogo a test_ml.sh)
│   ├── tests/
│   │   ├── nlp/                # Pruebas unitarias del módulo NLP (FakeProvider)
│   │   └── api/                # Pruebas del contrato HTTP (FakeProvider)
│   ├── requirements.txt
│   └── requirements-dev.txt    # Dependencias de pruebas (pytest, etc.)
├── docs/
│   ├── architecture/        # Diagramas C4 (Contexto y Contenedores)
│   ├── adr/                 # Architecture Decision Records
│   └── nlp/                 # Metodología del chatbot y Golden Dataset (v1, v1.1)
├── requirements.md
├── design.md
├── tasks.md
└── CLAUDE.md
```

## Security Design
- Contraseñas hasheadas (ej. bcrypt) antes de persistir en T_Usuario (NFR-001).
- Todo el tráfico entre la app móvil y el backend en Azure viaja sobre HTTPS/SSL.
- Autenticación basada en tokens (tipo a definir — ver Open Questions) para todos los endpoints salvo `/auth/login`.
- T_Auditoria_Endpoints registra cada llamada relevante para trazabilidad y detección de accesos indebidos.
- Los endpoints de administración (alta de usuarios, aprobación) están restringidos por rol.

### Chatbot (`POST /api/chatbot/consulta`)
- **No registrar el texto de las consultas** ni las respuestas del LLM en logs, prints, mensajes de excepción, `detail` de errores HTTP ni T_Auditoria_Endpoints (NFR-001). Solo se pueden registrar metadatos (código de estado, latencia, proveedor/modelo).
- **Límite de longitud**: `texto` acepta de 1 a `CHATBOT_MAX_INPUT_CHARS` caracteres; fuera de rango → 422.
- **Límite de tasa**: `CHATBOT_RATE_LIMIT_PER_MINUTE` por cliente; excedido → 429. Sin tabla nueva.
- **Autenticación pendiente (RT-01)**: dependencia reemplazable; `CHATBOT_REQUIRE_AUTH=false` solo en desarrollo. El endpoint no se despliega públicamente hasta TASK-014.
- **Minimización de datos hacia el proveedor**: al LLM externo solo se envían el system prompt (corpus) y el texto del usuario; nunca nombre, correo, ids ni otros datos de T_Usuario / T_Paciente / T_Registro_glucosa.
- **Tier gratuito solo con datos sintéticos**: el tier gratuito de Gemini se usa únicamente para el baseline con las 20 preguntas del Golden Dataset; con pacientes reales se usa Gemini de pago u OpenAI (ADR-0005).
- `NLP_PROVIDER_API_KEY` solo por variable de entorno; nunca en código, logs ni repositorio.

## Open Questions
- [ ] ¿Qué esquema de autenticación se usará (JWT, sesiones con Supabase Auth, OAuth)? El documento original no lo especifica.
- [ ] ¿El modelo de ML (SVC vs Árbol de Decisión) ya está entrenado y con qué dataset, o se entrena como parte de este proyecto?
- [x] ¿El chatbot usa un LLM externo (API de terceros) o un modelo NLP propio entrenado in-house? — **Resuelta (2026-10-24):** LLM externo con inyección estática de contexto vía system prompt (ver [docs/nlp/adr_system_prompting_vs_rag.md](docs/nlp/adr_system_prompting_vs_rag.md)); proveedor Gemini con interfaz intercambiable (ver [ADR-0005](docs/adr/0005-proveedor-llm-chatbot.md)).
- [ ] ¿Qué servicio de Azure se usará específicamente para notificaciones push (Azure Notification Hubs u otro)?
- [ ] ¿Cómo se calcula/valida la matrícula médica en REQ-002 — contra un registro externo o solo formato?

## Changelog
| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-08-24 | Initial design, derivado de Especificacion_Sistema_GlucoTracker.md; deployment confirmado en Azure |
| 1.1.0 | 2026-03-01 | Actualización para integrar formalmente Modelos C4 y registros ADR |
| 1.2.0 | 2026-10-24 | Especificación del chatbot (Fase A): Open Question del chatbot resuelta (LLM externo + inyección estática); ADR-0005 (proveedor Gemini intercambiable); ruta `/api/chatbot/consulta` con contrato y códigos de error; sección Chatbot (Módulo NLP) Design; constantes ADA en `app/core/clinical.py`; corpus movido a `app/nlp/corpus/`; nuevos archivos en File Structure; reglas de seguridad del chatbot. Sin cambios en Data Models. |
