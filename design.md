# design.md
> GlucoTracker — Version 1.7.0 — 2026-10-26

## Architecture Overview
El backend principal es un monolito modular en FastAPI (ver ADR-0001). Centraliza la lógica de negocio: auth, registros, la **clasificación ADA** Normal/Hipo/Hiper de cada lectura y las alertas al médico. Hay dos servicios independientes:
- El **chatbot (NLP)**, en `backend/nlp_service/` (ver ADR-0006).
- El **modelo de ML de riesgo de hipoglucemia**, en `backend/ml_service/` (ver ADR-0008 y § Servicio de ML). El backend de negocio ya no contiene código de ML (retirado en TASK-011e).

Cada servicio tiene su propia app FastAPI, dependencias, configuración y despliegue, y no importa nada de `backend/app/`. La app móvil (React Native) llama directamente al backend y al servicio NLP, sin pasarela y con una URL base propia por servicio. El servicio de ML **no es público**: solo lo llama el backend por red interna (ML-D8). La persistencia se resuelve con Supabase/PostgreSQL gestionado (ver ADR-0002), al que accede solo el backend principal. Los tres se despliegan en Azure (ver ADR-0003).

**Stack**: React Native (frontend móvil) · FastAPI/Python (backend) · FastAPI/Python (servicio NLP) · FastAPI/Python + scikit-learn (servicio de ML) · Supabase/PostgreSQL (base de datos) · LLM externo Gemini (ADR-0005)
**Deployment**: Azure, con backend, servicio NLP y servicio de ML como despliegues separados. Backend y NLP se exponen con HTTPS/SSL. El servicio de ML se despliega sin ingreso público, dentro de la red interna.

| Componente | Ubicación | Responsabilidad | Habla con |
|---|---|---|---|
| App móvil | `mobile/` | UI de paciente, médico y administrador | Backend (`API_BASE_URL`) y servicio NLP (`NLP_API_BASE_URL`) por HTTPS. **No** llama al servicio de ML |
| Backend API | `backend/app/` | Auth, usuarios, registros, clasificación ADA, alertas (REQ-005), historial, reportes | Supabase, notificaciones push y servicio de ML (red interna) |
| Servicio NLP | `backend/nlp_service/` | `POST /api/chatbot/consulta` (REQ-006), sin estado | LLM externo (Gemini) por HTTPS; **no** accede a Supabase |
| Servicio de ML | `backend/ml_service/` | `POST /api/riesgo/hipoglucemia` (REQ-004): probabilidad informativa, sin estado | Nadie; solo recibe llamadas del backend. **No** accede a Supabase |
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
  |-- Clasificación ADA (reglas)     |-- corpus + system prompt
  |-- Alertas (REQ-005)              |
  |                                  v  HTTPS
  |-- red interna -->              [LLM externo: Gemini - ver ADR-0005]
  |        [Servicio de ML - FastAPI, sin ingreso público] (ADR-0007, ADR-0008)
  |          POST /api/riesgo/hipoglucemia
  v
[Supabase / PostgreSQL]
  |
  v
[Notificaciones push -> dispositivo del Médico]
```
Los servicios NLP y de ML no llaman al backend ni a Supabase. El backend no llama al servicio NLP y es el único cliente del servicio de ML.

## Architecture Decision Records (ADR)
Las decisiones técnicas críticas del proyecto han sido formalizadas y justificadas frente a alternativas descartadas:
1. **ADR-0001:** [Uso de Backend Monolítico con FastAPI](docs/adr/0001-backend-monolitico-fastapi.md)
2. **ADR-0002:** [Uso de Supabase / PostgreSQL](docs/adr/0002-supabase-postgresql.md)
3. **ADR-0003:** [Selección de Azure como Entorno Cloud](docs/adr/0003-despliegue-azure.md)
4. **ADR-0004:** [Selección de Modelo Baseline (SVC / Árbol de Decisión)](docs/adr/0004-modelo-clasificacion-baseline.md) — **Reemplazado por ADR-0007**
5. **ADR-0005:** [Proveedor LLM del chatbot (Gemini con interfaz intercambiable)](docs/adr/0005-proveedor-llm-chatbot.md)
6. **ADR-0006:** [Chatbot NLP como servicio independiente](docs/adr/0006-nlp-servicio-independiente.md) (reemplaza a ADR-0001 solo para el chatbot)
7. **ADR NLP:** [System Prompting vs. RAG para el chatbot](docs/nlp/adr_system_prompting_vs_rag.md)
8. **ADR-0007:** [Regresión Logística con SMOTE-NC como línea base del riesgo de hipoglucemia](docs/adr/0007-regresion-logistica-baseline.md) (ML-D1 a ML-D4; reemplaza a ADR-0004)
9. **ADR-0008:** [Modelo de ML como servicio independiente](docs/adr/0008-servicio-ml-independiente.md) (ML-D8; reemplaza a ADR-0001 para el ML)
10. **ADR-0009:** [Modelo de demo con datos sintéticos](docs/adr/0009-modelo-demo-datos-sinteticos.md) (segundo modelo separado, entrenado con datos generados por reglas clínicas; no cambia el contrato de ADR-0008)
11. **ADR-0010:** [Contenerización con Docker Compose](docs/adr/0010-contenerizacion-docker-compose.md) (una imagen y un requirements por servicio; el modelo de ML por volumen; el ML solo en una red interna)

## Data Models

> **Estado real en Supabase (2026-10-25):** el backend de negocio usa tablas con otros nombres que las `T_*` de abajo, que siguen siendo el modelo objetivo: `usuario`, `paciente`, `medico`, `administrador`, `registro_glucosa`, `alertas`, `auditoria_endpoints`. Usa además tablas que este diseño aún no define: `seguimiento_embarazo`, `perfiles_pacientes`, `enfermedades_base`, `paciente_enfermedad`, `tratamientos`, `tratamiento_enfermedad`, `nivel_actividad_fisica`, `momento_dia`, `especialidad`, `retroalimentacion`, `Carnets_IMG` y `Matriculas_PDF`. El esquema se creó en Supabase fuera de este repositorio (no hay migraciones versionadas), así que TASK-005 a TASK-009 no se pueden verificar aquí. Este documento no se altera hasta reconciliar el esquema (TASK-029 y Open Question), porque CLAUDE.md exige actualizar design.md antes de cambiar el modelo de datos.


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
| clasificacion_ada | VARCHAR(20) | NULL, CHECK IN ('Normal','Riesgo Hipo','Riesgo Hiper') | Clasificación por **umbrales ADA** de la lógica de negocio del backend, no del ML (§ Clasificación ADA). Antes se llamaba `clasificacion_ml` (renombrada en design 1.4.0) |
| clasificado_en | TIMESTAMP | NULL | Cuándo la lógica de negocio emitió la clasificación ADA |
| riesgo_hipoglucemia | NUMERIC(5,4) | NULL, CHECK (riesgo_hipoglucemia BETWEEN 0 AND 1) | Probabilidad del servicio de ML (REQ-004). **Solo informativa**: visible al médico, no dispara alertas hasta la calibración (ML-D4). NULL si el servicio no respondió o el momento no está cubierto por el modelo |
| riesgo_modelo_version | VARCHAR(20) | NULL | `version_modelo` devuelta por el servicio de ML, para trazabilidad |
| riesgo_calculado_en | TIMESTAMP | NULL | Cuándo se obtuvo la probabilidad |

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
| POST | /api/riesgo/hipoglucemia | Sistema (interno: solo el backend, por red interna) | REQ-004 | Probabilidad informativa de hipoglucemia. **Servido por el servicio de ML**, no por el backend ni accesible desde la app (ver contrato en § Servicio de ML). Reemplaza a `GET /ml/clasificar/{registro_id}`: la clasificación ADA es lógica interna del backend y no tiene endpoint |
| POST | /alertas | Sistema (interno) | REQ-005 | Crea alerta y dispara notificación push al médico |
| POST | /api/chatbot/consulta | Paciente (pendiente RT-01; ver contrato abajo) | REQ-006 | Envía consulta de texto libre al chatbot. **Servido por el servicio NLP** (`NLP_API_BASE_URL`), no por el backend |
| GET | /pacientes/{id}/historial | Paciente, Médico | REQ-007 | Historial de glucosa filtrable por rango de fechas |
| GET | /pacientes/{id}/reporte-pdf | Médico | REQ-008 | Genera y descarga reporte clínico en PDF |

### Estado real del backend de negocio (fusión con `adriang-backend`, 2026-10-25)
El backend de negocio (`backend/app/`) ya tiene implementados los routers de la tabla siguiente (código de Adrian; 74 pruebas con Supabase simulado). **Sus rutas no son las de la tabla de arriba**, que sigue siendo el contrato objetivo, y hoy **no exigen autenticación**: `POST /api/login` verifica la contraseña y envía un OTP por correo (`POST /api/verify-otp`), pero no emite ningún token y ningún endpoint lo comprueba (los ajustes `JWT_*` de `core/config.py` no se usan). La convergencia con el contrato objetivo (TASK-014 a TASK-016, 019, 020 y TASK-029) está pendiente.

| Router | Prefijo | Qué expone (resumen) |
|---|---|---|
| auth | (sin prefijo) | `POST /api/login`, `POST /api/verify-otp`, `PUT /usuario/{id_usuario}/password` |
| medicos | `/api/medicos` | registrar (con matrícula y carnet), ver, perfil, misPacientes, alertasActivas, alertasResueltas, responder/alerta, registrar/glucosa, actualizar |
| pacientes | `/api/pacientes` | registrarPaciente, perfil, registros, registrarGlucosa, actualizarPaciente, obtenerDatosEmbarazo |
| administradores | `/api/administradores` | médicos y pacientes activos y solicitantes, activar médico y paciente, perfilAdmin, agregar, obtenerAdmins |
| registro | `/api/registro` | datosGlucosa, registrarAlerta |
| general | `/api/general` | momentos, niveles, enfermedades, tratamientos, especialidades, auditoria |
| pdf | `/api` | `POST /paciente/pdf` |

El backend **no** expone `POST /api/riesgo/hipoglucemia` (vive solo en el servicio de ML), **no** contiene la clasificación ADA (TASK-012a) y **todavía no llama** al servicio de ML (TASK-017).

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
- El modelo de ML vive en el servicio independiente `backend/ml_service/` (ADR-0008) y el backend de negocio no contiene código de ML. La clasificación ADA es lógica de negocio del backend (`backend/app/core/reglas_ada.py`, TASK-012a).

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

Formato propuesto de `docs/nlp/umbrales_ada_v1.json`: JSON plano, legible con la librería estándar. Cualquier otro componente puede compararse contra este mismo archivo, como la clasificación ADA del backend (`backend/app/core/reglas_ada.py`, TASK-012a, aún no implementada).
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

## Servicio de ML (riesgo de hipoglucemia) Design

Modelo: Regresión Logística con SMOTE-NC (ADR-0007). Datos y etiqueta en `docs/data_ecosystem.md`; métricas y limitaciones en `docs/model_baseline.md`.

**Dónde vive:** todo el ML está en el servicio independiente `backend/ml_service/` (mismo esquema de aislamiento que `backend/nlp_service/`, ADR-0006, ADR-0008): `data_prep.py`, `train_baseline.py`, `predict.py`, `cv_evaluacion.py`, `exportar_dataset.py`, el dataset, las pruebas y el endpoint `POST /api/riesgo/hipoglucemia`. `backend/app/` (el backend de negocio) no contiene código de ML ni monta ningún router de riesgo; solo lo llamará el cliente de TASK-017.

**Estado del modelo: experimental.** La validación cruzada agrupada (M2 y M2b, `docs/model_baseline.md` §4.1) muestra que ninguna variante supera el azar con los datos disponibles. La probabilidad es **solo informativa, visible solo para el médico (REQ-004) y no dispara alertas**; TASK-010b (umbral y calibración) queda en espera.

**Qué predice (ML-D1, ML-D6, REQ-004):**
- La probabilidad (0–1) de **hipoglucemia observada en el registro**, dado un perfil clínico y una lectura (glucosa y momento: `ayunas` o `postprandial`).
- No clasifica Normal/Hipo/Hiper, no diagnostica y no decide alertas (ML-D5).
- Es **solo informativa** y el modelo es experimental: el recall mínimo y el umbral solo se fijarían (ML-D4) si el modelo llegara a superar el azar, con revisión clínica.

**Quién lo llama (ML-D8):** solo la lógica de negocio del backend, al guardar un registro (TASK-017), por red interna, con una URL configurada en el backend por variable de entorno `ML_SERVICE_URL` (solo el nombre). La app móvil **no** lo llama y el servicio **no** tiene ingreso público. Si el servicio no responde, el backend guarda el registro igual, con `riesgo_hipoglucemia = NULL`, porque la probabilidad no es bloqueante.

### Contrato propuesto: POST /api/riesgo/hipoglucemia

**Entrada** (`application/json`; mismos campos y rangos que el contrato original del endpoint, con los valores permitidos de `momento`, `genero` y `categoria_medicacion` validados; sin nombre, correo ni ids). **Cualquier campo no listado → 422** (así un nombre o un id enviado por error no se procesa):

| Campo | Tipo | Restricción |
|---|---|---|
| glucosa | float | mg/dL, > 0 y ≤ 700 |
| momento | str | `ayunas` \| `postprandial` (los únicos cubiertos por el modelo; otro valor → 422) |
| genero | str | `femenino` \| `masculino` |
| edad | int | > 0 y ≤ 120 |
| bmi | float | > 0 y ≤ 80 |
| duracion_diabetes | float | años, ≥ 0 y ≤ 80 |
| categoria_medicacion | str | `ninguno` \| `metformina_u_otros` \| `sulfonilurea` \| `insulina` |
| com_hipertension, com_dislipidemia, com_renal, com_neuropatia, com_nefropatia, com_cardiovascular | bool | por defecto `false` |
| hba1c | float \| null | opcional, % (> 0 y ≤ 20) |

**Salida 200**: `{"riesgo_hipoglucemia": float (0–1, redondeado a 4 decimales), "version_modelo": str (campo `version_modelo` del JSON de metadatos)}`. **No incluye nivel de alerta**: ningún umbral de la probabilidad tiene validez clínica (ML-D4) y las alertas las decide solo la clasificación ADA del backend (ML-D5).

**Errores** (mensajes genéricos en español; nunca repiten valores de entrada ni detalles internos, NFR-001):

| Código | Causa |
|---|---|
| 422 | Entrada inválida: campo faltante, tipo o rango incorrecto, valor no permitido, campo adicional, JSON malformado o cuerpo que no es UTF-8. Manejador propio: el de FastAPI devolvería los valores recibidos, incluida la glucosa. El servicio no emite 400 |
| 503 | Modelo no disponible (`ModeloNoDisponible`): artefacto ausente, huella SHA-256 distinta a la del JSON de metadatos o versiones de librerías incompatibles con las del entrenamiento |
| 500 | Cualquier otro error inesperado de inferencia |

Todos los errores responden `{"detail": "<mensaje genérico en español>"}` y nunca incluyen el texto de una excepción, rutas ni valores de entrada.

`GET /health` informa si el modelo está cargado.

**Documentación interactiva:** `/docs`, `/redoc` y `/openapi.json` responden 404 salvo que `ML_ENABLE_DOCS=true` (apagada por defecto, porque el servicio no es público y la documentación solo hace falta en desarrollo). Encendida, documenta los cuatro códigos de respuesta con su esquema real y un ejemplo con valores sintéticos, en español.

### Aislamiento, artefactos y seguridad
- **Aislamiento:** `backend/ml_service/` tiene su propio `app/`, `tests/`, `requirements.txt` con versiones exactas (incluidas numpy, imbalanced-learn, joblib y openpyxl, ML-D7), `requirements-dev.txt`, `.env.example` (solo nombres) y README. No importa nada de `backend/app/` y se ejecuta desde su propia carpeta, como el servicio NLP. El dataset fuente se traslada con él.
- **Artefactos (ML-D7, decisión del equipo):**
  - `modelo_hipoglucemia.pkl` sigue **fuera de git** (`.gitignore`).
  - Junto a él, `modelo_hipoglucemia.json` (metadatos) **se versiona en git**.
  - **La huella del `.pkl` va dentro del JSON**, en el campo `sha256_pkl`, calculada sobre los bytes del archivo al terminar de entrenar.
  - Campos del JSON: `version_modelo`, `fecha_entrenamiento`, `sha256_pkl`, `versiones` (python, scikit-learn, imbalanced-learn, numpy, scipy, pandas, joblib, openpyxl), `metricas` (hoy las del split de `train_baseline.py`; los resultados de la validación cruzada con IC viven en `cv_metrics.json`), `random_state`, `dataset` (nombre y huella SHA-256 del Excel fuente) y `conteos` (filas, filas positivas y pacientes del dataset, y filas de train y de test). Solo agregados: sin valores de glucosa ni ids de pacientes.
  - Al cargar el modelo, el servicio recalcula el SHA-256 del `.pkl` y lo compara con `sha256_pkl`, y compara las versiones instaladas con `versiones` (librerías exactas; de Python, solo mayor.minor). Si no coinciden, lanza `ModeloNoDisponible` (mensaje genérico, sin rutas) y el endpoint responde 503 en lugar de predecir con un modelo dudoso (RT-06). La carga y la verificación ocurren una sola vez por proceso.
  - `train_baseline.py` sigue escribiendo también `baseline_metrics.json` en `artefactos/` (sin cambios en el modelo ni en las métricas).
- **Versiones fijadas (ML-D7):** pandas 2.2.3, numpy 2.4.6, scikit-learn 1.5.2, imbalanced-learn 0.14.2, scipy 1.15.3, joblib 1.6.0, openpyxl 3.1.5. scikit-learn 1.5.2 reproduce las métricas de la línea base; con scipy 1.16 o posterior emite el aviso "`disp` and `iprint` options of the L-BFGS-B solver are deprecated" (o "Unknown solver options: iprint" desde 1.18), por lo que scipy 1.15.3 es la versión más reciente sin aviso, y numpy 2.4.6 la más reciente que scipy 1.15.3 admite (`numpy<2.5`).
- **Configuración del servicio** (solo nombres, ver `.env.example`): `ML_ARTEFACTOS_DIR` (carpeta de los artefactos; por defecto `app/artefactos/`), `ML_LOG_LEVEL` y `ML_ENABLE_DOCS` (por defecto `false`) y `ML_MODELO` (`real` por defecto | `demo`, S3). Puerto de desarrollo 8002.
  - Como el JSON está en git y el `.pkl` no, quien reentrena publica en el PR el JSON nuevo, y su huella es la evidencia de qué modelo se evaluó.
- **Red y autenticación:** solo tráfico de la red interna, sin CORS ni ingreso público. Sin autenticación propia en v1 (ADR-0008); el endpoint lo deja anotado y remite a TASK-002b. El mecanismo de autenticación entre servicios (identidad administrada de Azure, mTLS o token) queda como **Open Question** para el despliegue.
- **Datos:** no registra en logs valores de glucosa ni del perfil (NFR-001), solo metadatos (código, latencia, versión del modelo). No persiste nada.
- **Latencia:** NFR-003 (p95 < 2000 ms) aplica a la llamada backend → servicio de ML.

### Clasificación ADA (lógica de negocio del backend, no ML)
- **Qué hace:** clasifica cada lectura como `Normal`, `Riesgo Hipo` o `Riesgo Hiper` con umbrales ADA, la guarda en `T_Registro_glucosa.clasificacion_ada` y es el **único disparador de alertas** al médico (REQ-005, TASK-012). La probabilidad del ML no dispara alertas.
- **Dónde vive:** `backend/app/core/reglas_ada.py`, con constantes propias del backend (70, 130 y 180 mg/dL). Un test de contrato las compara con `docs/nlp/umbrales_ada_v1.json`, igual que el servicio NLP.
- **Reglas:**
  - `< 70` → `Riesgo Hipo`, en cualquier momento.
  - Ayunas `> 130` → `Riesgo Hiper`.
  - Postprandial `≥ 180` → `Riesgo Hiper`.
  - En cualquier otro caso → `Normal`.
- **Pendiente:** para el momento `otro`, la regla de hiperglucemia queda **pendiente de revisión clínica** (Open Question). Las etiquetas y los cortes también están sujetos a esa revisión.

## Modelo de demo con datos sintéticos Design

**Principio de honestidad:** el modelo de demo **aprende las reglas que escribió el equipo, no la realidad**. Existe solo para poder mostrar el flujo integrado (app → backend → servicio de ML → médico) mientras no haya pacientes reales. Sus probabilidades y sus métricas **no son evidencia clínica** y no deben presentarse como tal. El modelo real (`backend/ml_service`, Regresión Logística + SMOTE-NC, ADR-0007) **no se modifica ni se reentrena**: sigue siendo experimental, solo informativo y visible solo para el médico. El detalle de las reglas, distribuciones y esquemas está en [docs/ml/generador_sintetico.md](docs/ml/generador_sintetico.md); aquí solo el diseño de las fases.

**Fases** (la S1 es solo documentación; S2 a S4 están pendientes en tasks.md como TASK-011f, 011g y 011h):

| Fase | Qué entrega | Dónde |
|---|---|---|
| S1 | Especificación: decisiones, reglas clínicas, distribuciones y esquemas | `docs/ml/generador_sintetico.md` |
| S2 | Generador reproducible de un dataset sintético a partir de reglas clínicas escritas (no de un modelo estadístico ajustado a los 109 registros reales) | `backend/ml_service/app/sintetico/` (`reglas.py`, `generador.py`, `generar.py`), `backend/ml_service/data/sintetico/` |
| S3 | Entrenamiento del modelo de demo con ese dataset (reutilizando la tubería, con el origen de datos como parámetro), artefactos y metadatos propios, validación sintética aparte, y selección `ML_MODELO=real\|demo` al cargar | `backend/ml_service/app/train_demo.py`, `train_baseline.py`, `predict.py`, `config.py`, `app/sintetico/adaptador.py`, `backend/ml_service/app/artefactos/demo/` |
| S4 (reducida) | **Sin cambio de contrato** (decisión del equipo): se fijan con pruebas las claves de la respuesta y de `/health`, y se añade la variante `demo` a `test_ml.sh` | `backend/ml_service/tests/test_contrato_publico.py`, `test_ml.sh` |

**Decisiones cerradas (S1, tomadas con el equipo):** prevalencia objetivo 15 %; 2.000 registros por defecto; señal moderada; el ruido es el muestreo Bernoulli de la probabilidad de las reglas, de modo que el modelo de demo alcance un AUC moderado (0,70 a 0,80) en su propia validación sintética; reglas dudosas incluidas: IMC bajo y HbA1c alta (neuropatía y enfermedad cardiovascular quedan sin efecto); dos interacciones; dependencia continua de la glucosa; género, hipertensión y dislipidemia sin efecto (controles).

**Generador (S2).** Genera registros (una lectura + perfil) con el mismo esquema de entrada que el contrato del servicio. Muestrea el perfil de distribuciones plausibles con correlaciones mínimas, calcula la probabilidad con las reglas clínicas (suma de log-odds), calibra el intercepto para lograr la prevalencia objetivo, muestrea la etiqueta y escribe un CSV (ignorado por git, regenerable) y un JSON de metadatos (versionado, con la huella del CSV). Es determinista dada la semilla.

*Módulos:* `reglas.py` (coeficientes, `escala_senal`, `version_reglas` y la suma de log-odds), `generador.py` (muestreo, calibración, escritura) y `generar.py` (CLI: `python -m app.sintetico.generar --n 2000 --semilla <n> --salida <ruta.csv> [--escala-senal 0.8]`, desde `backend/ml_service/`). Solo usa numpy, pandas y scipy ya fijadas; no importa `sklearn` ni nada de `data_prep.py`, `backend/app` o `nlp_service`.

*Detalles de implementación (decididos en S2):*
- **Una sola corriente de aleatoriedad** (`numpy.random.default_rng(semilla)`) en orden fijo: mismo resultado con la misma semilla.
- **Pacientes:** se sortean 1, 2 o 3 registros por paciente (90 %, 8 %, 2 %) hasta completar `n` registros; el último paciente se recorta para que haya exactamente `n`.
- **Valores redondeados a la precisión del contrato antes de aplicar las reglas** (edad entera; IMC, duración, HbA1c y glucosa con 1 decimal), de modo que la etiqueta dependa de lo que verá el modelo. La HbA1c oculta (10 % de los pacientes) vale 0 en las reglas y solo se usa para derivar la glucosa.
- **Calibración del intercepto sobre la prevalencia realizada:** se sortean `n` uniformes fijos y la etiqueta es `uniforme < sigmoide(escala_senal × S + b0)`; `b0` se busca por bisección hasta que el número de positivos sea el de la prevalencia objetivo. Sigue siendo un muestreo Bernoulli (el ruido), pero la prevalencia del dataset cae en 15 % con una diferencia de a lo sumo un registro, en vez de variar con el azar del muestreo. El AUC se calcula con las probabilidades verdaderas resultantes.
- **Ventana de AUC de las reglas: 0,70 a 0,80** (criterio de la Fase S2). Si queda fuera, se ajusta solo `escala_senal` (0,8 de partida) o el intercepto, nunca las reglas, y se documenta el cambio aquí.
- **Salida:** el CSV va a la ruta de `--salida` (por defecto `data/sintetico/dataset_sintetico.csv`, ignorado por git) y el JSON de metadatos al lado, con el mismo nombre y extensión `.json` (versionable). Se rechaza escribir en `data/raw/` o sobre un `.xlsx`.
- **Metadatos del dataset:** semilla, `version_reglas`, `escala_senal`, `intercepto`, fecha, `n_registros`, `n_pacientes`, prevalencia objetivo y obtenida, AUC de las probabilidades verdaderas, percentiles de la probabilidad, tasa de positivos por categoría de medicación (agregados), huella SHA-256 del CSV y versiones de Python, numpy, pandas y scipy. Sin valores ni ids por registro. Sus reglas llevan versión propia (`version_reglas`). No lee ni mezcla nada de `backend/ml_service/data/raw/`.

**Modelo de demo (S3).** Reutiliza la tubería del modelo real sin duplicar su lógica:
- **Origen de los datos como parámetro:** `train_baseline.entrenar_y_evaluar(artefactos_dir, origen="real" | "sintetico", ruta_dataset=...)`. Con `real` se comporta exactamente como hoy (Excel, `baseline_metrics.json`). Con `sintetico` lee el CSV sintético, lo adapta con `app/sintetico/adaptador.py` a las columnas que espera `preparar_features(..., expandir_lecturas=False)` y sigue el mismo camino (split agrupado por paciente 80/20 con `GroupShuffleSplit`, `construir_pipeline`, regresión logística, `guardar_artefactos`). No llama a `cargar_summary_crudo` ni lee los 109 registros reales.
- **Sin SMOTE-NC** (`construir_pipeline(X, y, usar_smote=False)`; el modelo real mantiene `usar_smote=True`). Medido en validación cruzada agrupada con el dataset canónico: con SMOTE-NC el AUC baja de 0,783 a 0,722 y la probabilidad media predicha sube de 0,150 (la prevalencia real) a 0,340 (p95 0,86), es decir, distorsiona la escala de las probabilidades que la demo va a mostrar. Con 15 % de prevalencia y ~300 positivos no hace falta. Tampoco se usa `class_weight`.
- **Sin términos de interacción** (decisión del usuario, S3). La regresión logística no aprende las 2 interacciones, pero añadirlas no mejora el AUC de forma medible (0,782 con ellas frente a 0,783 sin ellas; con toda la forma no lineal de las reglas, 0,786; reglas verdaderas, 0,794). Se pierde ~0,010 de AUC respecto de las reglas verdaderas, atribuible sobre todo a ruido de estimación.
- **Artefactos propios** en `app/artefactos/demo/`: `modelo_hipoglucemia_demo.pkl` (ignorado por git) y `modelo_hipoglucemia_demo.json` (versionado) con los campos del JSON real más `version_modelo: "1.0.0-demo"`, `entrenado_con: "sintetico"`, `version_reglas`, `semilla` del dataset, huella del CSV y una `advertencia` ("sus métricas NO son desempeño clínico"). Las métricas del JSON son las del split y se rotulan "validación sintética, no clínica".
- **Validación sintética aparte:** `app/train_demo.py` (`python -m app.train_demo`) entrena y además corre la validación cruzada agrupada por paciente (el mismo esquema y el mismo bootstrap que `cv_evaluacion.py`), y escribe `app/artefactos/demo/cv_metrics_demo.json`, rotulado "no es desempeño clínico": AUC del modelo con intervalo, AUC de las reglas verdaderas con intervalo (recalculadas desde el CSV y los metadatos del dataset), cuánto recupera el modelo, y los coeficientes aprendidos con intervalo por bootstrap de pacientes. **No toca `cv_metrics.json` ni `baseline_metrics.json`.**
- **Controles:** los coeficientes de género, hipertensión, dislipidemia, neuropatía y cardiovascular no tienen sesgo (media ≈ 0 en datasets independientes), pero con n = 2.000 su desviación es 0,13 a 0,18, así que en una muestra concreta pueden superar |0,15|. El reporte los publica con su intervalo; no se cambia el tamaño ni la semilla del dataset canónico para que salgan mejor.
- **Rechazos:** `origen="sintetico"` solo acepta un CSV cuyas filas tengan `origen == "sintetico"` e ids `sint-`, y escribe solo en `artefactos/demo/`.

**Selección del modelo (S3).**
- Variable `ML_MODELO` con valores `real` (por defecto) o `demo`, en `config.py` y `.env.example`. Un valor distinto es `ConfiguracionInvalida` (→ 503 genérico). El modelo de demo **solo se usa con `ML_MODELO=demo`**.
- `predict.py` carga del directorio que corresponde al modo (`artefactos/` para `real`, `artefactos/demo/` para `demo`) y verifica huella y versiones como hoy (RT-06). En modo `demo` exige además `entrenado_con == "sintetico"` y una `version_modelo` que termine en `-demo`; en modo `real` exige que `entrenado_con` no sea `sintetico` (el JSON real actual no lo trae y se interpreta como real). Si no coincide, `ModeloNoDisponible` (→ 503). Con `real` nunca se carga el modelo de demo y con `demo` nunca se carga el real. Si falta el artefacto de demo, `ModeloNoDisponible`.
- **Configuración inválida:** un valor inválido de `ML_MODELO` (o de cualquier otra variable) no tumba el servicio: arranca igual y `GET /health` y `POST /api/riesgo/hipoglucemia` responden 503 genérico, sin repetir el valor ni nombrar la variable en la respuesta (solo el log del servicio nombra la variable).
- **Sin cambio de contrato público.** Con `ML_MODELO=demo` la respuesta de `POST /api/riesgo/hipoglucemia` sigue siendo `{riesgo_hipoglucemia, version_modelo}`; lo único que la distingue es el sufijo `-demo` de `version_modelo`, que sale de los metadatos.

**Contrato público (S4 reducida): no cambia.** Decisión del equipo (ADR-0009): no se añade el campo `modo` ni ningún aviso a la respuesta de `POST /api/riesgo/hipoglucemia` (sigue siendo `{riesgo_hipoglucemia, version_modelo}`) ni a `GET /health` (sigue siendo `{status, service, modelo_cargado}`). Ningún mensaje de la API contiene las palabras "demo" ni "sintético"; la única huella es el sufijo `-demo` de `version_modelo`, que sale de los metadatos del modelo. **Consecuencia aceptada:** la respuesta no distingue entre el modelo real y el entrenado con datos sintéticos; la trazabilidad queda en los metadatos, en `ML_MODELO` (por defecto `real`), en la verificación de huella y de modo, y en la documentación. **Riesgo:** si el servicio llegara a usuarios reales habría que reponer la marca (ver Open Questions). Esto reemplaza la propuesta original de S1, que añadía `modo`.

**Reglas de separación (obligatorias):**
1. Nunca mezclar filas sintéticas con las 109 reales (ni en entrenamiento, ni en validación, ni en archivos).
2. Nunca evaluar el modelo de demo con datos sintéticos y presentarlo como desempeño clínico.
3. Nunca usar el modelo de demo salvo con `ML_MODELO=demo` (por defecto, `real`).
4. El modelo de demo y sus metadatos llevan versión propia (`1.0.0-demo`) y `entrenado_con: "sintetico"`; el dataset lleva la columna `origen = "sintetico"`.

## Contenedores (Docker Compose)

Los tres servicios del backend se empaquetan en imágenes separadas y se levantan con un solo `docker compose up -d` desde la raíz (decisión del equipo, [ADR-0010](docs/adr/0010-contenerizacion-docker-compose.md)). La app móvil **no** va en Docker. Las versiones de los servicios chocan entre sí (fastapi 0.115.0 frente a 0.162.0, pydantic 2.9.2 frente a 2.14.1), por eso cada uno lleva **su** imagen y **su** `requirements.txt`.

| Servicio | Dockerfile | Contexto de build | Puerto | En el host |
|---|---|---|---|---|
| `backend` | `backend/Dockerfile` | `backend/` (su `.dockerignore` excluye `ml_service/` y `nlp_service/`) | 8000 | **publicado** (`BACKEND_PORT`, por defecto 8000) |
| `nlp_service` | `backend/nlp_service/Dockerfile` | `backend/nlp_service/` | 8001 | **publicado** (`NLP_PORT`, por defecto 8001; la app móvil lo llama directamente) |
| `ml_service` | `backend/ml_service/Dockerfile` | `backend/ml_service/` | 8002 | **no publicado** (solo `expose`, ADR-0008) |

**Imágenes.** `python:3.13-slim` (la versión con la que se verificaron las dependencias del ML), solo el `requirements.txt` de producción, usuario no root (uid 10001), sin `.env`, `.pkl`, pruebas ni entornos virtuales. Etapas: `deps`, `test` (con `requirements-dev.txt` y las pruebas) y `runtime` (la que se despliega). Cada contexto lleva su `.dockerignore`, que no excluye lo que el servicio usa en ejecución (por ejemplo, el corpus del NLP).

**Arranque.** `uvicorn` escucha en `0.0.0.0` en el puerto de cada servicio. El NLP arranca con `--proxy-headers --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-127.0.0.1}"`: detrás de un proxy hay que poner su IP, porque el límite de tasa usa `request.client.host`. Cada servicio tiene `HEALTHCHECK` sobre su `GET /health`.

**Red.** Dos redes de Compose: `publica` (backend y NLP) y `red_ml` (`internal: true`: backend y ML). El ML solo está en `red_ml`, sin puertos y sin salida a Internet, y solo el backend lo alcanza por el nombre `ml_service`. El backend **no** declara `depends_on` del ML (hoy no lo llama; TASK-017).

**Modelo de ML por volumen.** Un volumen con nombre (`ml_artefactos`) montado en `/artefactos` (`ML_ARTEFACTOS_DIR=/artefactos`) guarda el `.pkl` y su JSON de metadatos, tanto del modelo real como del de demo (subcarpeta `demo/`). Nada de eso entra en la imagen ni en git. Se genera la primera vez con servicios de una sola ejecución del perfil `entrenamiento` (`ml_entrenar_real`, `ml_entrenar_demo`), que reutilizan `python -m app.train_baseline` y `python -m app.sintetico.generar` + `python -m app.train_demo`; el Excel de entrenamiento se monta de solo lectura en esa ejecución y no forma parte de la imagen. Si el modelo falta, el ML sigue vivo: `/health` informa `modelo_cargado: false` y el `POST` responde 503 genérico.

**Configuración y secretos.** Cada servicio lee su propio `.env` (`env_file`, no obligatorio para poder levantar sin claves); nada de secretos en el YAML ni en las imágenes. Un `.env` en la raíz (solo si hace falta) define las variables de Compose que no son secretas: `ML_MODELO` (`real` por defecto o `demo`), `FORWARDED_ALLOW_IPS`, `BACKEND_PORT` y `NLP_PORT` (puertos del host, por si los de por defecto están ocupados). `docker-compose.prueba.yml` es un override sin secretos para probar el chatbot sin gastar la clave (`NLP_PROVIDER=fake`, `CHATBOT_REQUIRE_AUTH=false`).

**Contextos de build.** El contexto del backend de negocio es `backend/` (el Dockerfile debe vivir ahí), que contiene las carpetas de los otros servicios; su `.dockerignore` las excluye, así que no se envían al builder. `tests/` no se excluye en ningún `.dockerignore` porque la etapa `test` los necesita; la etapa `runtime` no los copia.

**Pruebas en contenedores.** El perfil `pruebas` define `backend_test`, `nlp_test` y `ml_test`, que construyen la etapa `test` de cada Dockerfile y ejecutan `pytest`. La prueba de contrato clínico del NLP necesita `docs/nlp/umbrales_ada_v1.json`: entra solo en la etapa `test` mediante un contexto de build adicional (`docs_nlp`), no en la imagen de ejecución.

**Azure (ADR-0003, TASK-002 y TASK-002b).** Las imágenes `runtime` son el artefacto de despliegue. Falta decidir el servicio de Azure (App Service o Container Apps), el registro de imágenes, el ingreso interno del ML y los secretos (Key Vault o variables del servicio).

## File Structure
```
glucotracker/
├── docker-compose.yml       # Los tres servicios del backend (ADR-0010); ML sin puertos publicados
├── docker-compose.prueba.yml # Override sin secretos: NLP con proveedor fake y sin autenticación, para probar sin la clave
├── .env.example             # Solo variables de Compose no secretas (ML_MODELO, FORWARDED_ALLOW_IPS)
├── mobile/                  # App React Native
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   └── services/        # Clientes de la API REST (API_BASE_URL backend, NLP_API_BASE_URL servicio NLP)
│   └── app.json
├── backend/
│   ├── app/                 # Backend de negocio FastAPI (monolito modular, ADR-0001; el ML y el chatbot son servicios aparte: ADR-0006 y ADR-0008)
│   │   ├── api/              # Routers: auth, medicos, pacientes, administradores, registro, general, pdf
│   │   ├── schemas/            # Modelos pydantic de entrada
│   │   ├── services/           # Correo (OTP), caché de OTP y generación de PDF
│   │   ├── models/             # (vacío, sin uso)
│   │   ├── nlp/                # (vacío, sin uso: el chatbot vive en nlp_service/)
│   │   └── core/                # Config (carga backend/.env), seguridad (bcrypt), conexión a Supabase, auditoría
│   │       └── reglas_ada.py   # (pendiente, TASK-012a) Clasificación ADA Normal/Hipo/Hiper (lógica de negocio, no ML) + constantes propias
│   ├── tests/               # Pruebas del backend con Supabase simulado (conftest.py y test_*.py) y test_aislamiento.py (el backend no incluye ni importa el ML ni el chatbot; incluirá el contrato de reglas_ada.py vs docs/nlp/umbrales_ada_v1.json); las de ML pasaron a ml_service/tests/
│   ├── requirements-dev.txt # Dependencias de pruebas del backend (pytest)
│   ├── requirements.txt     # Solo del backend
│   ├── Dockerfile           # Imagen del backend de negocio (etapas deps, test, runtime); contexto backend/
│   ├── .dockerignore        # Excluye ml_service/, nlp_service/, venvs, .env, etc.
│   ├── ml_service/          # Servicio de ML independiente (ADR-0008): no importa nada de backend/app/ ni de nlp_service/; sin ingreso público; puerto de desarrollo 8002
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py         # FastAPI (crear_app): GET /health (informa si el modelo está cargado) + router de riesgo; documentación solo con ML_ENABLE_DOCS=true
│   │   │   ├── config.py       # Settings desde variables de entorno del servicio (ML_ARTEFACTOS_DIR, ML_LOG_LEVEL)
│   │   │   ├── errors.py       # ErrorML, ModeloNoDisponible, ConfiguracionInvalida (mensajes genéricos)
│   │   │   ├── api/
│   │   │   │   ├── __init__.py
│   │   │   │   └── riesgo.py   # POST /api/riesgo/hipoglucemia (REQ-004): contrato sin `alerta`, 422/503/500 genéricos
│   │   │   ├── data_prep.py    # Limpieza clínica y features
│   │   │   ├── train_baseline.py # Entrena y escribe el .pkl + JSON de metadatos + baseline_metrics.json; python -m app.train_baseline
│   │   │   ├── cv_evaluacion.py # Validación cruzada agrupada + bootstrap por pacientes + referencias y lift (M2/M2b, ML-D3); python -m app.cv_evaluacion
│   │   │   ├── metadatos.py    # Huella SHA-256, versiones instaladas y lectura/escritura del JSON de metadatos (compartido por train_baseline.py y predict.py)
│   │   │   ├── predict.py      # Carga única del artefacto (verifica huella y versiones) e inferencia
│   │   │   ├── sintetico/      # (S2) reglas.py: reglas clínicas y su versión; generador.py: dataset sintético reproducible; generar.py: CLI (python -m app.sintetico.generar); adaptador.py (S3): columnas sintéticas -> columnas que espera preparar_features
│   │   │   ├── train_demo.py   # (S3) entrena el modelo de demo con el dataset sintético y escribe su validación sintética (python -m app.train_demo)
│   │   │   ├── exportar_dataset.py # Utilidad opcional: exporta el dataset limpio a data/dataset_inputs_hipoglucemia.csv
│   │   │   └── artefactos/     # demo/ (S3): modelo_hipoglucemia_demo.pkl fuera de git + modelo_hipoglucemia_demo.json y cv_metrics_demo.json en git; modelo_hipoglucemia.pkl (fuera de git) + modelo_hipoglucemia.json (metadatos, en git) + cv_metrics.json (salida de cv_evaluacion.py, solo agregados, en git) + baseline_metrics.json
│   │   ├── data/raw/           # ShanghaiT2DM_Summary.xlsx (movido con git mv desde backend/data/raw/)
│   │   ├── data/sintetico/     # (S2, planeado) CSV sintético (fuera de git, regenerable) + JSON de metadatos del dataset (en git); nunca se mezcla con data/raw/
│   │   ├── tests/              # pytest: preparación de features, predicción con modelo sintético, metadatos, huella, aislamiento, logs, cv_evaluacion (sin red ni Excel real)
│   │   ├── requirements.txt    # Versiones exactas (incluidas numpy, scipy, imbalanced-learn, joblib, openpyxl)
│   │   ├── requirements-dev.txt
│   │   ├── .env.example        # Solo nombres de variables
│   │   ├── Dockerfile          # Imagen del servicio de ML (el modelo entra por volumen en /artefactos)
│   │   ├── .dockerignore
│   │   ├── README.md
│   │   └── test_ml.sh          # script end-to-end del servicio (movido con git mv desde backend/app/test_ml.sh)
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
│       ├── Dockerfile          # Imagen del servicio NLP (--proxy-headers, --forwarded-allow-ips configurable)
│       ├── .dockerignore
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
- Autenticación basada en tokens (tipo a definir — ver Open Questions) para todos los endpoints salvo `/auth/login`. **Estado actual:** el backend implementado no emite ni comprueba tokens; el login envía un OTP por correo y los endpoints no exigen autenticación (RT-01, TASK-014).
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

### Servicio de ML (`POST /api/riesgo/hipoglucemia`)
- **No público (ML-D8):** solo tráfico de la red interna desde el backend, sin ingreso público ni CORS; la app no lo llama. El mecanismo de autenticación entre servicios es una Open Question.
- **No registrar valores clínicos** (glucosa ni perfil) en logs, prints, excepciones ni `detail` de errores (NFR-001). El 422 usa un mensaje genérico propio.
- **Minimización:** el backend le envía solo la lectura y el perfil clínico, nunca nombre, correo ni ids.
- **Integridad del artefacto:** antes de predecir se verifican la huella SHA-256 del `.pkl` y las versiones de librerías contra el JSON de metadatos; si no coinciden, responde 503 (RT-06).
- **Sin efecto clínico automático:** la probabilidad es informativa y no dispara alertas hasta la calibración (ML-D4, REQ-004). Las alertas las decide la clasificación ADA del backend (REQ-005).

### Modelo de demo
- **Trazabilidad sin marca en la API:** un modelo entrenado con datos sintéticos no puede presentarse como estimación clínica, pero la API **no** lo declara (decisión del equipo, ADR-0009): la respuesta y `/health` no distinguen el modelo real del entrenado con datos sintéticos y ningún mensaje de la API contiene "demo" ni "sintético". La trazabilidad queda en los metadatos (`entrenado_con`), en `ML_MODELO` (por defecto `real`), en la verificación de huella y de modo al cargar y en la documentación. Si el servicio llegara a usuarios reales habría que reponer la marca.
- **Sin datos reales ni identificadores:** el dataset sintético se genera desde reglas y semillas; no contiene filas, valores ni ids de los 109 registros reales (los ids sintéticos tienen el prefijo `sint-`).
- **Mismas garantías que el modelo real:** huella SHA-256 y versiones verificadas al cargar, errores genéricos y nada de valores de entrada en logs (NFR-001).

## Open Questions
- [ ] ¿Qué esquema de autenticación se usará (JWT, sesiones con Supabase Auth, OAuth)? El documento original no lo especifica. **Estado tras la fusión:** hoy hay login con OTP por correo, sin token y sin ningún endpoint autenticado.
- [ ] **Alcance de `seguimiento_embarazo`:** el backend fusionado implementa seguimiento de embarazo (tabla `seguimiento_embarazo`, `GET /api/pacientes/obtenerDatosEmbarazo/{id}`), que no figura en requirements.md, design.md ni tasks.md. ¿Entra en el alcance (y entonces se añade un requisito y se define su modelo de datos) o se retira?
- [ ] **Reconciliar el contrato y el esquema del backend de negocio con este diseño** (rutas reales vs. la tabla de API, tablas reales de Supabase vs. las `T_*`): ver TASK-029.
- [x] ¿El modelo de ML (SVC vs Árbol de Decisión) ya está entrenado y con qué dataset, o se entrena como parte de este proyecto? — **Resuelta (2026-10-24):** se entrena en el proyecto con ShanghaiT2DM (`docs/data_ecosystem.md`). Es una Regresión Logística con SMOTE-NC (ADR-0007, reemplaza a ADR-0004), reproducible con `train_baseline.py`, y estima la probabilidad de hipoglucemia observada en el registro (REQ-004 v1.1.0).
- [ ] **Perfil clínico para el ML (sin lugar en Data Models):** el contrato del servicio de ML necesita género, edad, BMI, años de diabetes, categoría de medicación, seis comorbilidades y HbA1c (opcional). § Data Models no tiene esos campos: T_Paciente solo tiene `actividad_fisica` y `enfermedades_base`. ¿Dónde y cómo se capturan?
  - **Bloquea TASK-017** (el backend no tiene de dónde armar la llamada al servicio de ML). **No bloquea el servicio de ML** (TASK-010a/b, TASK-011a–e): su contrato recibe el perfil en cada petición y no depende de cómo lo persista el backend.
  - Opciones, sin resolver:
    1. **Ampliar T_Paciente** con columnas propias: género, fecha de nacimiento (la edad se deriva), peso y talla o BMI, año de diagnóstico, categoría de medicación, banderas de comorbilidad, último HbA1c y su fecha. Es lo más simple, pero sobrescribe el perfil anterior y pierde el historial: un cambio de medicación borra el valor que se usó en predicciones pasadas.
    2. **Tabla nueva `T_Perfil_clinico`** (N—1 con T_Paciente, con `vigente_desde`): conserva el historial y permite saber qué perfil estaba vigente en cada registro. Es más compleja de mantener y de presentar en la app.
    3. **Instantánea por predicción**: guardar junto al registro (o en una tabla de predicciones) el perfil exacto enviado al modelo. Da trazabilidad y reproducibilidad completas, a cambio de duplicar datos clínicos sensibles (NFR-001). Es complementaria a la 1 o la 2.
    4. **Sin persistir**: la app envía el perfil con cada lectura y el backend solo lo reenvía. No requiere cambios de esquema, pero el paciente tendría que reingresarlo, el médico no lo ve y no hay trazabilidad.
  - También hay que definir quién carga y actualiza el perfil (paciente, médico o ambos) y cómo se mapea `enfermedades_base` (texto libre) a las banderas de comorbilidad.
- [ ] **Qué modelo usar en producción:** ¿se permite `ML_MODELO=demo` fuera de desarrollo y de las demostraciones, o el despliegue de producción debe rechazarlo? Como la API no marca el modelo (decisión del equipo, ADR-0009), si el servicio llegara a usuarios reales habría que reponer la marca o impedir ese valor. Sin resolver: hasta decidirlo, el modelo entrenado con datos sintéticos es solo para desarrollo y presentaciones.
- [ ] **Validación de las reglas clínicas del generador:** ¿quién (un profesional de la salud del equipo o externo) revisa y aprueba las reglas y sus magnitudes antes de usar el modelo de demo en una presentación? Hoy todas las reglas están **pendientes de revisión por el equipo** y las magnitudes son supuestos.
- [ ] **Despliegue en Azure de las imágenes (TASK-002, TASK-002b):** las imágenes de Docker (ADR-0010) se reutilizan, pero falta decidir App Service o Container Apps, el registro de imágenes, el ingreso interno del ML y los secretos. Ver § Contenedores.
- [ ] **Despliegue del servicio de ML sin ingreso público:** hay que provisionar el recurso en Azure alcanzable solo desde el backend por red interna (TASK-002b). Hasta entonces el aislamiento de red, que es la única protección del endpoint en v1, no está verificado en un entorno real.
- [ ] **Autenticación backend → servicio de ML:** ¿identidad administrada de Azure, mTLS o token de servicio? En v1 solo hay red interna (ML-D8). Hay que resolverlo antes del despliegue (TASK-002).
- [ ] **Clasificación ADA para el momento `otro`:** ¿qué regla de hiperglucemia aplica cuando la lectura no es en ayunas ni postprandial? Las etiquetas y los cortes de `reglas_ada.py` también requieren revisión clínica.
- [ ] **Recall mínimo y umbral de "Alta" del ML (ML-D4):** se fijan tras la fase M2, con revisión clínica; no se inventan.
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
| 1.3.1 | 2026-10-24 | Fase B (implementación parcial del servicio NLP): firmas reales de `LLMClient.generar(..., temperature) -> RespuestaLLM(texto, modelo)` y `responder_consulta(texto, *, con_contexto=True)`; carga de `.env` solo en los puntos de entrada; nueva herramienta `app/dev_chat.py` en File Structure y Componentes. Sin cambios en Data Models ni en el contrato HTTP. |
| 1.3.2 | 2026-10-24 | Fase C (TASK-018): el router pasa de `app/router.py` a `app/api/chatbot.py` (decisión del usuario). El límite de tasa es por IP (`request.client.host`); detrás de un proxy se usa `uvicorn --proxy-headers --forwarded-allow-ips` en el despliegue, sin variable nueva (decisión del usuario). `auth.py` responde 401 con `CHATBOT_REQUIRE_AUTH=true` hasta TASK-014. Orden de validaciones y 422 genérico documentados. Sin cambios en Data Models. |
| 1.4.0 | 2026-10-24 | Fase M1 (ML, solo documentación):<br>• Nueva sección "Servicio de ML (riesgo de hipoglucemia) Design": qué predice (ML-D1, ML-D6), contrato propuesto de `POST /api/riesgo/hipoglucemia` (solo probabilidad + `version_modelo`, sin alerta hasta M2, ML-D4), aislamiento tipo `nlp_service` en `backend/ml_service/` (destino; hoy `backend/app/ml/`), artefactos (ML-D7), seguridad y llamada solo desde el backend por red interna (ML-D8).<br>• Clasificación ADA Normal/Hipo/Hiper movida a la lógica de negocio del backend (`backend/app/core/reglas_ada.py`), único disparador de alertas (ML-D5, decisión del usuario).<br>• **Data Models:** `T_Registro_glucosa.clasificacion_ml` → `clasificacion_ada`, y nuevos `riesgo_hipoglucemia`, `riesgo_modelo_version` y `riesgo_calculado_en`.<br>• API: `GET /ml/clasificar/{registro_id}` reemplazado por `POST /api/riesgo/hipoglucemia` (interno).<br>• ADR-0007 reemplaza a ADR-0004.<br>• Open Questions: ML resuelta; nuevas (perfil clínico en Data Models, autenticación entre servicios, regla para el momento `otro`, umbral ML). |
| 1.4.2 | 2026-10-24 | Fase M2 (decisión del usuario): el script de validación se llama `cv_evaluacion.py`, no `validacion.py`. Vive en `backend/app/ml/` hasta TASK-011d y escribe `cv_metrics.json`, que se versiona en git. Nuevos `backend/tests/ml/` y `backend/requirements-dev.txt`. Sin cambios en Data Models ni contratos. |
| 1.4.3 | 2026-10-24 | Fase M2b: `cv_evaluacion.py` suma dos referencias sin entrenamiento (puntaje constante y regla por medicación `medicacion_cod`), evaluadas con los mismos folds, semillas y bootstrap sobre pacientes, y reporta prevalencia de positivos y *lift* (precisión / prevalencia) con IC. `cv_metrics.json` gana la sección `referencias`, separada de `variantes`: las referencias son contexto y no entran en la regla de cambio de modelo de ML-D2. Sin cambios en Data Models ni contratos. |
| 1.4.4 | 2026-10-24 | Fase M5a: `backend/ml_service/` pasa de destino a existente con `GET /health`. El código del modelo (`data_prep.py`, `train_baseline.py`, `predict.py`, `cv_evaluacion.py`, `exportar_dataset.py`), el dataset y las pruebas se mueven allí con `git mv`; `backend/app/ml/` conserva `riesgo.py` y copias transitorias de `data_prep.py` y `predict.py` hasta M5b/TASK-011e (decisión del usuario). Versiones fijadas con scipy 1.15.3 (última sin el aviso `iprint` de scikit-learn 1.5.2). Metadatos del modelo: se añaden scipy y `conteos`; verificación de huella y versiones al cargar, una sola vez. Variables `ML_ARTEFACTOS_DIR` y `ML_LOG_LEVEL`; puerto 8002. Sin cambios en Data Models ni contratos. |
| 1.4.5 | 2026-10-24 | Fase M5b: el servicio de ML expone `POST /api/riesgo/hipoglucemia` con el contrato definitivo (valores permitidos validados, campos adicionales → 422, salida con 4 decimales y `version_modelo` del JSON, sin `alerta`; 422/503/500 con `{"detail"}` genérico). Variable `ML_ENABLE_DOCS` (documentación apagada por defecto). `test_ml.sh` pasa al servicio. Sin cambios en Data Models. |
| 1.4.6 | 2026-10-24 | Fase M6 (TASK-011e): se retira `backend/app/ml/` del backend de negocio y el router de riesgo de `backend/app/main.py`; `backend/requirements.txt` sin dependencias de ML. El texto de § Servicio de ML y de la estructura de archivos deja de describir un estado "actual vs. destino". Estado del modelo declarado: experimental, solo informativo y visible solo para el médico. Open Questions sin cambios (perfil clínico, autenticación entre servicios, despliegue sin ingreso público). Sin cambios en Data Models ni contratos. |
| 1.5.0 | 2026-10-24 | Fase S1 (solo documentación): nueva sección "Modelo de demo con datos sintéticos" con el diseño de las fases S2 (generador a partir de reglas clínicas), S3 (entrenamiento del modelo de demo con artefactos y metadatos propios) y S4 (`ML_MODELO`, marca `modo` en `/health` y en la respuesta). Decisiones cerradas con el equipo: prevalencia 15 %, 2.000 registros, señal moderada, AUC propio moderado. El cambio de contrato de S4 (campo `modo`) queda pendiente de una ADR nueva. Nuevas Open Questions (modelo de demo en producción; validación de las reglas clínicas). El modelo real no cambia. Sin cambios en Data Models. |
| 1.5.1 | 2026-10-25 | Fase S2 (TASK-011f): el generador se implementa en `app/sintetico/` (`reglas.py`, `generador.py`, `generar.py`); CLI `python -m app.sintetico.generar` (nombre elegido por el usuario). Detalles de implementación documentados (una corriente de aleatoriedad, pacientes de 1 a 3 registros, redondeo previo a las reglas, calibración del intercepto sobre la prevalencia realizada, metadatos). Ventana de AUC de las reglas fijada en 0,70 a 0,80. Se aprueba ADR-0009 (equipo): S4 desbloqueada. Sin cambios en Data Models ni en el contrato real hasta S4. |
| 1.5.2 | 2026-10-25 | Fase S3 (TASK-011g): el modelo de demo se entrena reutilizando la tubería con el origen de datos como parámetro (`entrenar_y_evaluar(origen=...)`, `construir_pipeline(usar_smote=...)`, adaptador `app/sintetico/adaptador.py`). Decisiones medidas con el dataset canónico: **sin SMOTE-NC** (AUC 0,722 con SMOTE-NC frente a 0,783 sin él, y probabilidades infladas: media 0,340 frente a 0,150) y **sin términos de interacción** (decisión del usuario: no mejoran el AUC de forma medible). Artefactos propios en `artefactos/demo/` y validación sintética en `cv_metrics_demo.json`. La carga selectiva `ML_MODELO=real\|demo` pasa de S4 a S3; S4 queda reducida a la marca `modo` en `/health` y en la respuesta (cambio de contrato de ADR-0009). Sin cambios en Data Models ni en el contrato público. |
| 1.5.3 | 2026-10-25 | Fase S4 reducida (TASK-011h): decisión del equipo de **no cambiar el contrato público**. Se retira la propuesta del campo `modo` en la respuesta y en `/health` (y el aviso asociado); ADR-0009 y ADR-0008 lo declaran. La consecuencia aceptada es que la API no distingue entre el modelo real y el entrenado con datos sintéticos; la trazabilidad queda en los metadatos, en `ML_MODELO` (por defecto `real`), en la verificación de huella y de modo, y en la documentación. S4 queda en pruebas de contrato y en la variante `demo` de `test_ml.sh`. La Open Question del rótulo se cierra; queda abierta solo la de qué modelo usar en producción. Sin cambios en Data Models ni en el contrato. |
| 1.6.0 | 2026-10-25 | Fusión del backend de negocio de Adrian (`adriang-backend`) con los servicios independientes. Se documenta el **estado real** sin alterar el contrato objetivo: rutas implementadas (§ Estado real del backend de negocio), tablas reales de Supabase (nota en § Data Models), estructura de `backend/app/` (`schemas/`, `services/`; `models/` y `nlp/` vacíos; sin `ml/`) y que el backend no emite ni comprueba tokens (login con OTP). Nuevas Open Questions: alcance de `seguimiento_embarazo` y reconciliación del contrato y el esquema (TASK-029). Se retira el resto de ML de `app/main.py`; las dependencias y `.env.example` del backend se alinean con su código. Sin cambios en los servicios de ML y NLP. |
| 1.7.0 | 2026-10-26 | Fase Docker (TASK-030, ADR-0010): nueva sección "Contenedores (Docker Compose)". Un Dockerfile y un contexto por servicio (`python:3.13-slim`, solo `requirements.txt` de producción, usuario no root, etapas `deps`/`test`/`runtime`), `docker-compose.yml` con red interna para el ML sin puertos publicados, volumen `ml_artefactos` para el modelo (nunca en la imagen), perfiles `entrenamiento` y `pruebas`, y `docker-compose.prueba.yml` sin secretos. Estructura de archivos y Open Question de despliegue en Azure actualizadas. Puertos del host configurables (`BACKEND_PORT`, `NLP_PORT`). Sin cambios en la lógica de los servicios ni en sus contratos. |
| 1.4.1 | 2026-10-24 | Respuestas del equipo a M1: ADR-0008 (servicio de ML independiente; reemplaza a ADR-0001 para el ML). JSON de metadatos del modelo versionado en git, con la huella del `.pkl` dentro (`sha256_pkl`) y sus campos definidos. Open Question del perfil clínico ampliada con 4 opciones; bloquea TASK-017, no el servicio de ML. Sin cambios en Data Models. |
