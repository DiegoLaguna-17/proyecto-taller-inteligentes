# design.md
> GlucoTracker — Version 1.3.2 — 2026-10-24

## Architecture Overview
El backend principal es un monolito modular en FastAPI (ver ADR-0001). Centraliza la lógica de negocio y el módulo de Machine Learning (clasificación de glucosa, en `backend/app/ml/`). El **chatbot (NLP) es un servicio independiente** en `backend/nlp_service/` (ver ADR-0006): tiene su propia app FastAPI, dependencias, configuración y despliegue, y no importa nada de `backend/app/`. La app móvil (React Native) llama a cada servicio directamente, sin pasarela, con una URL base propia por servicio. La persistencia se resuelve con Supabase/PostgreSQL gestionado (ver ADR-0002), al que accede solo el backend principal. Ambos servicios se despliegan en Azure (ver ADR-0003).

**Stack**: React Native (frontend móvil) · FastAPI/Python (backend + ML) · FastAPI/Python (servicio NLP) · Supabase/PostgreSQL (base de datos) · LLM externo Gemini (ADR-0005)
**Deployment**: Azure: backend con ML y servicio NLP como dos despliegues separados, ambos con HTTPS/SSL.

| Componente | Ubicación | Responsabilidad | Habla con |
|---|---|---|---|
| App móvil | `mobile/` | UI de paciente, médico y administrador | Backend (`API_BASE_URL`) y servicio NLP (`NLP_API_BASE_URL`) por HTTPS |
| Backend API | `backend/app/` | Auth, usuarios, registros, ML, alertas, historial, reportes | Supabase y notificaciones push |
| Servicio NLP | `backend/nlp_service/` | `POST /api/chatbot/consulta` (REQ-006), sin estado | LLM externo (Gemini) por HTTPS; **no** accede a Supabase |
| Supabase / PostgreSQL | gestionado | Persistencia (§ Data Models) | — |
| LLM externo | Gemini (ADR-0005) | Generación de la respuesta | — |

## System Diagram (C4 Model Reference)

La arquitectura formal del sistema está documentada mediante el estándar C4:
- **Nivel 1 (Contexto):** [Ver Diagrama de Contexto](docs/architecture/c4_context.md) — Muestra la interacción de Pacientes, Médicos y Administradores con GlucoTracker, y del sistema con el proveedor LLM externo.
- **Nivel 2 (Contenedores):** [Ver Diagrama de Contenedores](docs/architecture/c4_container.md) — Detalla la App Móvil, la API FastAPI (con el módulo de ML), el servicio NLP independiente, Supabase y el proveedor LLM externo.

Resumen visual del flujo de contenedores:

```
                 [App Móvil - React Native]
                  |                      |
   HTTPS/REST     |                      |  HTTPS/REST (POST /api/chatbot/consulta)
   API_BASE_URL   v                      v  NLP_API_BASE_URL
[Backend API - FastAPI en Azure]   [Servicio NLP - FastAPI en Azure]  (ADR-0006)
  |-- Módulo ML (ver ADR-0004)       |-- corpus + system prompt
  |                                  |
  v                                  v  HTTPS
[Supabase / PostgreSQL]            [LLM externo: Gemini - ver ADR-0005]
  |
  v
[Notificaciones push -> dispositivo del Médico]
```
El servicio NLP no llama al backend ni a Supabase, y el backend no llama al servicio NLP.

## Architecture Decision Records (ADR)
Las decisiones técnicas críticas del proyecto han sido formalizadas y justificadas frente a alternativas descartadas:
1. **ADR-0001:** [Uso de Backend Monolítico con FastAPI](docs/adr/0001-backend-monolitico-fastapi.md)
2. **ADR-0002:** [Uso de Supabase / PostgreSQL](docs/adr/0002-supabase-postgresql.md)
3. **ADR-0003:** [Selección de Azure como Entorno Cloud](docs/adr/0003-despliegue-azure.md)
4. **ADR-0004:** [Selección de Modelo Baseline (SVC / Árbol de Decisión)](docs/adr/0004-modelo-clasificacion-baseline.md)
5. **ADR-0005:** [Proveedor LLM del chatbot (Gemini con interfaz intercambiable)](docs/adr/0005-proveedor-llm-chatbot.md)
6. **ADR-0006:** [Chatbot NLP como servicio independiente](docs/adr/0006-nlp-servicio-independiente.md) (reemplaza a ADR-0001 solo para el chatbot)
7. **ADR NLP:** [System Prompting vs. RAG para el chatbot](docs/nlp/adr_system_prompting_vs_rag.md)

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
| POST | /api/chatbot/consulta | Paciente (pendiente RT-01; ver contrato abajo) | REQ-006 | Envía consulta de texto libre al chatbot. **Servido por el servicio NLP** (`NLP_API_BASE_URL`), no por el backend |
| GET | /pacientes/{id}/historial | Paciente, Médico | REQ-007 | Historial de glucosa filtrable por rango de fechas |
| GET | /pacientes/{id}/reporte-pdf | Médico | REQ-008 | Genera y descarga reporte clínico en PDF |

### Contrato: POST /api/chatbot/consulta (REQ-006)

Lo sirve el **servicio NLP** (`backend/nlp_service/app/api/chatbot.py`), en `{NLP_API_BASE_URL}/api/chatbot/consulta`. Sin estado: una consulta por request, sin historial de conversación ni tabla nueva (no cambia § Data Models). El servicio también expone `GET /health`.

*Por qué se conserva la ruta `/api/chatbot/consulta`:* ya está referida en tasks.md y en la app. Con una URL base propia no puede chocar con rutas del backend, y mantenerla permite volver a montar el router en el monolito sin cambiar el cliente si ADR-0006 se revirtiera. No hay razón para cambiarla.

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

**Autenticación**: dependencia FastAPI reemplazable (`app/auth.py` del servicio). Con `CHATBOT_REQUIRE_AUTH=false` (solo desarrollo) el endpoint no exige token. Cuando exista TASK-014, el servicio **valida por sí mismo** el token de sesión emitido por el backend, sin llamar al backend ni importar su código. El mecanismo concreto depende del esquema que fije RT-01. Sin despliegue público hasta TASK-014 (ver Security Design y CONTEXT.md § Divergences).

## Servicio NLP (chatbot) Design

Servicio independiente en `backend/nlp_service/` (ADR-0006). Enfoque: LLM externo con inyección estática de contexto vía system prompt (ver [ADR System Prompting vs. RAG](docs/nlp/adr_system_prompting_vs_rag.md)); proveedor según [ADR-0005](docs/adr/0005-proveedor-llm-chatbot.md).

**Reglas de aislamiento:**
- No importa nada de `backend/app/` (ni `core/` ni `ml/`) ni comparte `requirements.txt`, `.env` ni configuración con el backend.
- Tiene su propio `requirements.txt` con versiones exactas, independientes de las del backend (por ejemplo, de `supabase`/`httpx`).
- Su paquete interno se llama `app` (igual que el del backend). Por eso se ejecuta y se prueba **desde `backend/nlp_service/`**, nunca desde `backend/`.
- El modelo de ML y su clasificación siguen en `backend/app/ml/`. Su posible migración es una decisión aparte, fuera de este diseño.

Componentes (rutas relativas a `backend/nlp_service/`):

| Componente | Responsabilidad |
|---|---|
| `app/main.py` | App FastAPI del servicio: `GET /health` y montaje del router del chatbot. |
| `app/config.py` | Lee y valida las variables de entorno del servicio (tabla abajo). Ninguna clave tiene valor por defecto en código; las variables no secretas tienen valores por defecto documentados en el módulo y en el README del servicio. No carga `.env` por sí mismo: lo hacen los puntos de entrada (`uvicorn --env-file .env`, `app/dev_chat.py`), así las pruebas no leen la clave del desarrollador. |
| `app/clinical.py` | Copia propia del servicio de las constantes ADA: 70, 130 y 180 mg/dL; 15 g de carbohidratos rápidos; 15 min de espera, y el descargo médico fijo con tildes: «Consulta siempre a tu médico tratante para cambios en tu medicación.». No son configurables por entorno. |
| `app/llm_client.py` | Interfaz `LLMClient` (`generar(system_prompt, texto, temperature) -> RespuestaLLM(texto, modelo)`, con `modelo` = id exacto devuelto por el proveedor; `system_prompt=None` es la corrida sin contexto) con `GeminiProvider` (SDK `google-genai`) y `FakeProvider` (determinístico, sin red, usado por todas las pruebas). `OpenAIProvider` queda diferido. Selección por `NLP_PROVIDER`. |
| `app/prompt_builder.py` | Construye el system prompt con el corpus vigente (`app/corpus/reglas_ada_v1.1.txt`), completo y sin recuperación. Se inyecta solo el cuerpo posterior al separador `---`; el encabezado de metadatos (versión, fuente, notas pendientes) no se envía al LLM. |
| `app/service.py` | `responder_consulta(texto, *, con_contexto=True)`: arma el prompt (o ninguno, con `con_contexto=False`, para la corrida neutra) y llama al `LLMClient` con `TEMPERATURE = 0.2` (constante en código, no variable de entorno). Si `NLP_ENFORCE_DISCLAIMER=true`, agrega `clinical.DESCARGO_MEDICO` cuando falta. |
| `app/errors.py` | Excepciones del dominio (proveedor no configurado, fallo del proveedor, timeout), que el router traduce a 503, 502 y 504. Sus mensajes nunca contienen el texto de la consulta. |
| `app/auth.py` | Dependencia de autenticación reemplazable (D3). Con `CHATBOT_REQUIRE_AUTH=false` deja pasar; con `true`, mientras no exista TASK-014, responde **401** (la validación local del token queda como TODO de TASK-014). |
| `app/rate_limit.py` | Límite de tasa en memoria por proceso: ventana deslizante de 60 s, **por IP de cliente** (`request.client.host`). No se comparte entre instancias ni sobrevive a reinicios (RT-03). Detrás de un proxy, la IP real la resuelve uvicorn con `--proxy-headers --forwarded-allow-ips=<IP del proxy>`; el código no lee `X-Forwarded-For` por su cuenta. Sin tabla ni dependencia externa. |
| `app/api/chatbot.py` | Router `POST /api/chatbot/consulta` (contrato arriba). Orden: auth (401) → límite de tasa (429) → validación de la entrada (422) → proveedor (503 / 502 / 504). Los 422 usan un manejador propio con mensaje genérico, porque el de FastAPI repetiría el texto recibido. |
| `app/dev_chat.py` | Herramienta de prueba manual, no es parte del endpoint: chat de consola (`python -m app.dev_chat [--sin-contexto]`) que llama a `responder_consulta` con el proveedor del `.env`. Imprime la respuesta solo por stdout, no escribe archivos ni logs y termina con línea vacía. Si falta configuración, nombra solo la variable que falta. |
| `app/checks.py` | Evaluador determinístico de `checks_esperados` (`contiene:` / `NO_contiene:`) del Golden Dataset, sin LLM como juez. |
| `app/evaluation.py` | Script del baseline: corre las 20 preguntas sintéticas del Golden Dataset v1.1 (`docs/nlp/`), sin y con contexto, y genera `app/nlp_baseline_metrics.json`. |
| `app/corpus/` | `reglas_ada_v1.txt` (movido desde `docs/nlp/` con `git mv`, se conserva sin cambios) y `reglas_ada_v1.1.txt` (mismo contenido con tildes y descargo idéntico a `clinical.DESCARGO_MEDICO`; es el que se inyecta). El Golden Dataset permanece en `docs/nlp/`. |

**Test de contrato de constantes clínicas** (`tests/test_contrato_clinico.py`): compara `app/clinical.py` contra dos fuentes y falla ante cualquier diferencia.
1. El **archivo de referencia versionado** `docs/nlp/umbrales_ada_v1.json` (valores y descargo exactos).
2. El **corpus vigente** `app/corpus/reglas_ada_v1.1.txt`: cada umbral aparece citado y el descargo aparece literal, con tildes y en una sola línea (sin normalizar acentos ni espacios).

Formato propuesto de `docs/nlp/umbrales_ada_v1.json`: JSON plano, legible con la librería estándar. Cualquier otro servicio, como el futuro motor de reglas del backend, puede compararse contra este mismo archivo.
```json
{
  "version": "v1",
  "fuente": "American Diabetes Association, Standards of Care in Diabetes (edición pendiente de confirmar, ver corpus_conocimiento.md §1)",
  "unidad_glucosa": "mg/dL",
  "hipoglucemia_umbral_mg_dl": 70,
  "ayunas_min_mg_dl": 70,
  "ayunas_max_mg_dl": 130,
  "postprandial_max_mg_dl": 180,
  "carbohidratos_rapidos_g": 15,
  "espera_remedicion_min": 15,
  "descargo_medico": "Consulta siempre a tu médico tratante para cambios en tu medicación."
}
```
Como el corpus, este archivo no se sobrescribe: cualquier cambio crea `umbrales_ada_v2.json`.

**Variables de entorno** (solo nombres; van en `backend/nlp_service/.env`, a partir de `backend/nlp_service/.env.example`, nunca en el repositorio):

| Variable | Uso |
|---|---|
| `NLP_PROVIDER` | `gemini` \| `fake` (`openai` diferido) |
| `NLP_MODEL` | Id del modelo del proveedor. Valor probado por el equipo para el baseline: `gemini-3.5-flash-lite` |
| `NLP_PROVIDER_API_KEY` | Clave del proveedor (se retira de `backend/.env.example`) |
| `NLP_TIMEOUT_SECONDS` | Timeout de la llamada al proveedor → 504 |
| `NLP_ENFORCE_DISCLAIMER` | Si el endpoint agrega el descargo médico por código cuando falta |
| `CHATBOT_REQUIRE_AUTH` | `false` solo en desarrollo |
| `CHATBOT_MAX_INPUT_CHARS` | Longitud máxima de `texto` → 422 |
| `CHATBOT_RATE_LIMIT_PER_MINUTE` | Límite de tasa → 429 |

**Evaluación del baseline** (ver `docs/nlp/baseline_chatbot.md`):
- La Tasa de Adherencia se mide sobre la **salida cruda del LLM** (sin el descargo agregado por código). La adherencia con descargo forzado (`NLP_ENFORCE_DISCLAIMER`) se reporta aparte en el mismo JSON.
- Cada corrida guarda el id exacto del modelo devuelto por el proveedor (`modelo_llm`), `temperature`, versión del corpus (v1.1) y versión del Golden Dataset.
- El baseline se corre con Gemini en tier gratuito **solo con las 20 preguntas sintéticas**. Ningún dato de paciente real pasa por el tier gratuito; para pacientes reales se cambia a Gemini de pago u OpenAI (este último requiere implementar `OpenAIProvider`, hoy diferido; ADR-0005).
- Golden Dataset v1.1: mismas 20 preguntas que v1; los checks semánticos (`descargo_medico`, `no_puedo_recomendar_dosis`, `no_tengo_informacion`, `consulta_profesional`, `aumentar_dosis`) se reemplazan por condiciones ejecutables por código, y se define la regla de coincidencia (mayúsculas, acentos, límites de palabra).

**Fuera de alcance v1**: manejo de emergencias (síntomas severos, pérdida de conciencia, etc.); queda para un corpus v2 con revisión clínica (ver tasks.md).

## File Structure
```
glucotracker/
├── mobile/                  # App React Native
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   └── services/        # Clientes de la API REST (API_BASE_URL backend, NLP_API_BASE_URL servicio NLP)
│   └── app.json
├── backend/
│   ├── app/                 # Backend API FastAPI (monolito, ADR-0001)
│   │   ├── api/              # Routers (auth, pacientes, alertas)
│   │   ├── ml/                # Modelo de clasificación (SVC/Árbol de Decisión)
│   │   ├── models/             # Esquemas / ORM
│   │   └── core/                # Config, seguridad, conexión a Supabase
│   ├── requirements.txt     # Solo del backend
│   └── nlp_service/         # Servicio NLP independiente (ADR-0006); no importa nada de backend/app/
│       ├── app/
│       │   ├── main.py         # FastAPI: GET /health + router del chatbot
│       │   ├── config.py       # Settings desde variables de entorno del servicio
│       │   ├── clinical.py     # Copia propia de constantes ADA + descargo médico fijo
│       │   ├── llm_client.py   # LLMClient + GeminiProvider / FakeProvider (OpenAIProvider diferido)
│       │   ├── prompt_builder.py # System prompt desde corpus/
│       │   ├── service.py      # responder_consulta(texto), TEMPERATURE = 0.2
│       │   ├── errors.py       # Errores de proveedor → 503 / 502 / 504
│       │   ├── auth.py         # Dependencia de autenticación reemplazable
│       │   ├── rate_limit.py   # Límite de tasa en memoria
│       │   ├── api/
│       │   │   └── chatbot.py  # POST /api/chatbot/consulta (REQ-006)
│       │   ├── dev_chat.py     # Chat de consola para prueba manual (python -m app.dev_chat)
│       │   ├── checks.py       # Checks determinísticos del Golden Dataset
│       │   ├── evaluation.py   # Script del baseline → nlp_baseline_metrics.json
│       │   └── corpus/         # reglas_ada_v1.txt (movido desde docs/nlp/) y reglas_ada_v1.1.txt (vigente)
│       ├── tests/              # Unitarias, contrato clínico y contrato HTTP (FakeProvider, sin red)
│       ├── requirements.txt    # Versiones exactas propias (fastapi, uvicorn, pydantic, google-genai)
│       ├── requirements-dev.txt # Dependencias de pruebas (pytest, etc.)
│       ├── .env.example        # Solo nombres de variables
│       ├── README.md           # Cómo instalar, configurar, correr y probar el servicio
│       └── test_chatbot.sh     # Script end-to-end del servicio (análogo a test_ml.sh)
├── docs/
│   ├── architecture/        # Diagramas C4 (Contexto y Contenedores)
│   ├── adr/                 # Architecture Decision Records
│   └── nlp/                 # Metodología del chatbot, Golden Dataset (v1, v1.1) y umbrales_ada_v1.json
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

### Servicio NLP (`POST /api/chatbot/consulta`)
El servicio NLP queda **expuesto directamente a la app**, sin pasarela ni backend delante. Por eso sus controles de seguridad son propios y no se heredan del backend. Se justifican bajo NFR-001; requirements.md no cambia.
- **No registrar el texto de las consultas** ni las respuestas del LLM en logs, prints, mensajes de excepción ni `detail` de errores HTTP (NFR-001). Solo se pueden registrar metadatos: código de estado, latencia y proveedor/modelo.
- **Sin acceso a la base de datos (limitación aceptada, ver `docs/risks.md` RT-05):** el servicio no accede a Supabase ni escribe en T_Auditoria_Endpoints. Su trazabilidad se limita a logs de metadatos en su propio despliegue. *Pendiente de confirmar por otro integrante en la revisión del PR.*
- **Límite de longitud**: `texto` acepta de 1 a `CHATBOT_MAX_INPUT_CHARS` caracteres; fuera de rango → 422.
- **Límite de tasa**: `CHATBOT_RATE_LIMIT_PER_MINUTE` por cliente; excedido → 429. Va en memoria por proceso, sin tabla nueva. Con varias instancias, el límite es por instancia; se revisa al desplegar.
- **Autenticación pendiente (RT-01)**: dependencia reemplazable; `CHATBOT_REQUIRE_AUTH=false` solo en desarrollo. Cuando exista TASK-014, el servicio debe validar el token de sesión por sí mismo, con material de verificación configurado por entorno y sin consultar al backend. **El servicio no se despliega públicamente hasta TASK-014.**
- **HTTPS obligatorio** en su despliegue propio (NFR-001). No habilita CORS: el único cliente es la app nativa, y la versión web está fuera de alcance.
- **Minimización de datos hacia el proveedor**: al LLM externo solo se envían el system prompt (corpus) y el texto del usuario; nunca nombre, correo, ids ni otros datos de T_Usuario / T_Paciente / T_Registro_glucosa.
- **Tier gratuito solo con datos sintéticos**: el tier gratuito de Gemini se usa únicamente para el baseline con las 20 preguntas del Golden Dataset; con pacientes reales se usa Gemini de pago u OpenAI (ADR-0005).
- `NLP_PROVIDER_API_KEY` solo por variable de entorno del servicio NLP; nunca en código, logs ni repositorio. El backend no la necesita.

## Open Questions
- [ ] ¿Qué esquema de autenticación se usará (JWT, sesiones con Supabase Auth, OAuth)? El documento original no lo especifica.
- [ ] ¿El modelo de ML (SVC vs Árbol de Decisión) ya está entrenado y con qué dataset, o se entrena como parte de este proyecto?
- [x] ¿El chatbot usa un LLM externo (API de terceros) o un modelo NLP propio entrenado in-house? — **Resuelta (2026-10-24):** LLM externo con inyección estática de contexto vía system prompt (ver [docs/nlp/adr_system_prompting_vs_rag.md](docs/nlp/adr_system_prompting_vs_rag.md)); proveedor Gemini con interfaz intercambiable (ver [ADR-0005](docs/adr/0005-proveedor-llm-chatbot.md)), desplegado como servicio independiente (ver [ADR-0006](docs/adr/0006-nlp-servicio-independiente.md)).
- [ ] ¿Qué servicio de Azure se usará específicamente para notificaciones push (Azure Notification Hubs u otro)?
- [ ] ¿Cómo se calcula/valida la matrícula médica en REQ-002 — contra un registro externo o solo formato?

## Changelog
| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-08-24 | Initial design, derivado de Especificacion_Sistema_GlucoTracker.md; deployment confirmado en Azure |
| 1.1.0 | 2026-03-01 | Actualización para integrar formalmente Modelos C4 y registros ADR |
| 1.2.0 | 2026-10-24 | Especificación del chatbot (Fase A): Open Question del chatbot resuelta (LLM externo + inyección estática); ADR-0005 (proveedor Gemini intercambiable); ruta `/api/chatbot/consulta` con contrato y códigos de error; sección Chatbot (Módulo NLP) Design; constantes ADA en `app/core/clinical.py`; corpus movido a `app/nlp/corpus/`; nuevos archivos en File Structure; reglas de seguridad del chatbot. Sin cambios en Data Models. |
| 1.3.0 | 2026-10-24 | Fase A.2: el chatbot pasa a **servicio independiente** `backend/nlp_service/` (ADR-0006), con app, requirements, `.env.example`, tests y README propios, sin importar nada de `backend/app/`. Arquitectura con tabla de componentes y diagrama; la app llama directo al servicio NLP (`NLP_API_BASE_URL`). Se conserva `POST /api/chatbot/consulta`. Constantes ADA y descargo con tildes en `nlp_service/app/clinical.py`, con test de contrato contra `docs/nlp/umbrales_ada_v1.json` y el corpus (reemplaza `app/core/clinical.py`). Corpus en `nlp_service/app/corpus/`, con v1.1 con tildes como vigente (reemplaza el destino `app/nlp/corpus/`). GeminiProvider y FakeProvider ahora, OpenAIProvider diferido; temperature constante 0.2. Seguridad propia del servicio expuesto. Sin cambios en Data Models. |
| 1.3.2 | 2026-10-24 | Fase C (TASK-018): el router pasa de `app/router.py` a `app/api/chatbot.py` (decisión del usuario). El límite de tasa es por IP (`request.client.host`); detrás de un proxy se usa `uvicorn --proxy-headers --forwarded-allow-ips` en el despliegue, sin variable nueva (decisión del usuario). `auth.py` responde 401 con `CHATBOT_REQUIRE_AUTH=true` hasta TASK-014. Orden de validaciones y 422 genérico documentados. Sin cambios en Data Models. |
| 1.3.1 | 2026-10-24 | Fase B (implementación parcial del servicio NLP): firmas reales de `LLMClient.generar(..., temperature) -> RespuestaLLM(texto, modelo)` y `responder_consulta(texto, *, con_contexto=True)`; carga de `.env` solo en los puntos de entrada; nueva herramienta `app/dev_chat.py` en File Structure y Componentes. Sin cambios en Data Models ni en el contrato HTTP. |
