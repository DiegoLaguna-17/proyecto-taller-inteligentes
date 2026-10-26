# design.md
> GlucoTracker — Version 1.15.1 — 2026-11-03

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
12. **ADR-0011:** [Integración del backend con el servicio de ML](docs/adr/0011-integracion-backend-ml.md) (disparo en el registro del médico, `riesgo_ml` aditivo, regla tipo 2, supuestos y duración por defecto)

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

## Integración backend ↔ ML (TASK-017, ADR-0011)
Decisión y alternativas en [ADR-0011](docs/adr/0011-integracion-backend-ml.md); auditoría y correspondencias de variables en `docs/ml/integracion_backend_ml.md`. **Sin cambios de esquema en Supabase** y sin guardar el riesgo en la base.

- **Disparo:** `POST /api/medicos/registrar/glucosa`, **después** de guardar la lectura y solo si `ML_ENABLED=true`. Con `ML_ENABLED=false` (por defecto) la respuesta es idéntica a la anterior. El registro del paciente no cambia.
- **Respuesta (campo aditivo de primer nivel):** `riesgo_ml: {riesgo_hipoglucemia: number|null, version_modelo: string|null, motivo: string|null, supuestos: string[], faltantes: string[]}`. `faltantes` (Fase ML-1b) lista, solo con `motivo = datos_insuficientes`, los códigos de lo que impidió calcular (`glucosa`, `genero`, `edad`, `imc`, `medicacion`, `paciente`); `[]` en los demás casos; sin valores. Cada cálculo registra en el log una línea con el motivo y los códigos, sin datos personales ni ids. Motivos: `no_aplica_tipo`, `datos_insuficientes`, `momento_no_cubierto`, `no_disponible`. Supuestos: `duracion_estimada`, `comorbilidades_no_capturadas`, `hba1c_no_disponible` (`[]` cuando no se calcula). Informativo y experimental: sin alertas automáticas.
- **Módulos (aislados, sin importar código del ML):** `backend/app/services/ml_reglas.py` (funciones puras: regla tipo 2, género, edad, IMC, medicación, momento, armado de la entrada y supuestos; punto de extensión para comorbilidades y `anio_diagnostico`), `backend/app/services/ml_client.py` (cliente `httpx` con timeout, errores controlados) y la integración mínima en `api/medicos.py`.
- **Configuración del backend** (`core/config.py`, `.env.example`): `ML_ENABLED=false`, `ML_URL=http://ml_service:8002`, `ML_TIMEOUT=2.0` (segundos) y `ML_DURACION_DEFECTO_ANIOS=6.5` (mediana del conjunto sintético de entrenamiento; estimada, ver ADR-0011).
- **Datos del paciente:** una consulta con relaciones (`paciente` → `usuario.fecha_nac`, `paciente_enfermedad`, `tratamiento_enfermedad`); nunca viaja un identificador al ML.
- **Compose:** el backend ya está en `red_ml`; se añaden sus variables `ML_*` y `ML_MODELO=demo` al `ml_service`, que **no publica puertos**.
- **Modelo sintético:** `ML_MODELO=demo`; su `version_modelo` pasa a `1.1.0` (sin «demo»; la trazabilidad queda en `entrenado_con: "sintetico"`). El contrato público de `POST /api/riesgo/hipoglucemia` no cambia.
- **Pendiente (TASK-017h):** capturar `paciente.anio_diagnostico` y las comorbilidades (cambio de esquema); entonces se calcula la duración real y se omiten los supuestos.
- **Riesgos:** el endpoint no autentica (RB-01) y el riesgo es experimental y no clínico.

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
- **Artefactos propios** en `app/artefactos/demo/`: `modelo_hipoglucemia_demo.pkl` (ignorado por git) y `modelo_hipoglucemia_demo.json` (versionado) con los campos del JSON real más `version_modelo: "1.1.0"` (antes `1.0.0-demo`, ADR-0011), `entrenado_con: "sintetico"`, `version_reglas`, `semilla` del dataset, huella del CSV y una `advertencia` ("sus métricas NO son desempeño clínico"). Las métricas del JSON son las del split y se rotulan "validación sintética, no clínica".
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
4. El modelo de demo y sus metadatos llevan versión propia (`1.1.0`, neutra: ver ADR-0011) y `entrenado_con: "sintetico"`; el dataset lleva la columna `origen = "sintetico"`.

## App móvil: integración con el backend
La app (`mobile/`, Expo SDK 58, React Native, TypeScript) dejó de ser solo maqueta: cuatro flujos hablan con los servicios reales y el resto sigue simulado. Esta sección es la fuente de verdad de esa integración (TASK-031, TASK-032, TASK-021 a TASK-024, TASK-033).

### Capa de servicios (`mobile/src/services/`)
| Módulo | Responsabilidad |
|---|---|
| `config.ts` | `API_BASE_URL` y `NLP_API_BASE_URL` desde `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_NLP_URL`; `USE_MOCK` desde `EXPO_PUBLIC_USE_MOCK` (solo `true` lo activa). Sin valores por defecto reales: si falta la URL, el servicio responde un error de configuración en español. |
| `http.ts` | Cliente mínimo con `fetch`: timeout con `AbortController`, JSON, y un único tipo de error (`ErrorApi`) con mensaje en español para el usuario. Lee `{"error": "..."}` del backend; ignora `detail` (el 422 por defecto de FastAPI repite el cuerpo enviado, incluida la contraseña). Nunca registra cuerpos ni respuestas. |
| `sesion.ts` | Guarda `id_usuario`, `id_rol` y `rol` en `expo-secure-store`; los borra al cerrar sesión. **No hay token**: el backend no lo emite ni lo exige (RB-01); la app no inventa uno. El correo y la contraseña nunca se persisten. |
| `auth.ts` | `iniciarSesion(correo, contrasena)` → `POST /api/login`; `verificarOtp(id_usuario, codigo)` → `POST /api/verify-otp`. |
| `glucosa.ts` | `obtenerMomentos`, `obtenerDatosPaciente` (`GET /api/registro/datosGlucosa/{id_rol}`), `registrarGlucosa`, `registrarAlerta` y `obtenerRegistros` (`GET /api/pacientes/registros/{id_rol}`). |
| `clasificacionGlucosa.ts` | Funciones puras (sin red ni React): port fiel de `glucosa.service.ts` del front web. Ver "Clasificación en el cliente". |
| `chatbot.ts` | `consultarChatbot(texto)` → `POST {NLP_API_BASE_URL}/api/chatbot/consulta`. |

**URLs.** En un celular `localhost` apunta al propio celular. Hay que usar la IP local de la PC en la misma red Wi-Fi (`EXPO_PUBLIC_API_URL=http://<IP-de-la-PC>:8000`, `EXPO_PUBLIC_NLP_URL=http://<IP-de-la-PC>:8001`; si `NLP_PORT` o `BACKEND_PORT` del compose cambian, usar esos). La IP real nunca se versiona: `mobile/.env.example` lleva valores de ejemplo y `mobile/.env` está en `.gitignore`. Expo lee las variables `EXPO_PUBLIC_*` al iniciar el empaquetador (reiniciar `expo start` tras cambiarlas). El servicio de ML **no** se consume desde la app.

### Flujos conectados
| Flujo | Pantalla | Llamadas |
|---|---|---|
| Login con OTP (REQ-001) | `InicioSesion` (dos pasos: correo y contraseña → código de 6 dígitos) | `POST /api/login` → `POST /api/verify-otp` → sesión; `App.tsx` navega según `rol` (`medico`, `administrador`, otro = paciente) |
| Registro de toma (REQ-003, REQ-005) | `RegistroToma` + `ResultadoClasificacionModal` | `GET /api/general/momentos`, `GET /api/registro/datosGlucosa/{id_rol}`, clasificación local, `POST /api/pacientes/registrarGlucosa` y, si no es NORMAL, `POST /api/registro/registrarAlerta` |
| Historial (REQ-007) | `HistorialPaciente` | `GET /api/pacientes/registros/{id_rol}`; filtros por periodo y promedio calculados en el cliente |
| Chatbot (REQ-006) | `ChatBot` | `POST {NLP}/api/chatbot/consulta` con `{texto}`; sin estado en el servidor, el historial del chat vive en la pantalla |

Campos que usa la app del historial (nombres reales del backend): `id`, `fecha` (YYYY-MM-DD), `hora`, `nivelGlucosa`, `momentoDia`, `observaciones`, `tipo_alerta`. Tipo de paciente: si `embarazo` es `true` → `Diabetes Gestacional` si `enfermedades` lo incluye, si no `Embarazada`; si no, `enfermedades[0]`.

**Chatbot.** El contrato del NLP solo acepta `{"texto": "..."}` (≤ `CHATBOT_MAX_INPUT_CHARS`, 1000 por defecto): **no hay campo de contexto clínico**, así que la app envía únicamente el texto del usuario (ni id, ni valores de glucosa, ni perfil). El aviso obligatorio lo añade el propio servicio al texto de `respuesta` (`NLP_ENFORCE_DISCLAIMER`); la app muestra la respuesta completa y mantiene visible el aviso fijo de la pantalla. Errores: 422 (entrada inválida), 429 (demasiadas consultas; cabecera `Retry-After`), 401 (si el NLP exige autenticación, `CHATBOT_REQUIRE_AUTH=true`: la app no tiene token que enviar), 502/503/504 (no disponible) y fallo de red/timeout, todos con mensaje amable y sin repetir la consulta.

### Clasificación en el cliente
**Decisión del equipo:** la app clasifica la lectura en el celular, portando `glucosa.service.ts` del front web (repositorio `GlucoTracker_Front`, rama `main`) en funciones puras con pruebas. Es una **desviación** de § "Clasificación ADA (lógica de negocio del backend)", que sigue vigente como objetivo (TASK-012a) y no se toca.

Riesgos aceptados:
- **Lógica clínica duplicada** (front web, app móvil y, a futuro, `reglas_ada.py`): cualquier corrección debe hacerse en todos los clientes.
- **Rangos distintos de `docs/nlp/umbrales_ada_v1.json`**, que usa el chatbot (ayunas 70–130, postprandial máx. 180): el servicio de glucosa del front usa rangos por grupo de edad y tipo (p. ej. adulto normal ayunas máx. 100, después máx. 150). La app y el chatbot pueden discrepar sobre si un mismo valor es alto.
- **El backend no verifica la clasificación**: confía en lo que envía el cliente (la alerta la dispara el cliente con `registrarAlerta`).
- Los mínimos de cada rango no se usan: la hipoglucemia es siempre `< 70`.

Rarezas del servicio original, **portadas tal cual** (decisión del usuario: no se corrigen en el port; se documentan y se prueban):
1. El tipo `Normal` no está contemplado en `obtenerRango` (compara `tipo === null`): con un valor ≥ 70 devuelve `PARAM_INVALIDO`, y un paciente cuya `enfermedades[0]` no sea diabetes también.
2. Los mínimos de embarazo (`RANGOS_EMBARAZADAS*.min`) nunca se usan: la hipoglucemia `< 70` se evalúa antes (p. ej. `Diabetes Gestacional` con 50 mg/dL es `HIPOGLUCEMIA` aunque su mínimo sea 40).
3. Edad `< 6` (o ausente) → `PARAM_INVALIDO` salvo que el valor sea `< 70` (entonces `HIPOGLUCEMIA`); en embarazadas la edad no se consulta.

**`PARAM_INVALIDO` en la interfaz (decisión del usuario):** se guarda la toma, **no** se envía alerta, y el modal indica que no se pudo clasificar y que consulte a su médico. No se trata como normal.

**Momentos.** La app usa los de la base (`GET /api/general/momentos`: 1 AYUNAS, 2 DESPUES DE COMER, 3 ANTES DE DORMIR) y los nombres del servicio de glucosa (`ayunas`, `despues`, `dormir`), no "postprandial". Los cuatro botones de la maqueta pasan a tres.

**Fecha y hora.** Se envían la fecha y la hora **locales** del dispositivo (`YYYY-MM-DD`, `HH:MM:SS`). El front web usa la fecha en UTC y la hora local, lo que puede producir fechas distintas cerca de medianoche; no se replica.

### Decisiones de implementación (a revisar por el equipo)
- **Confirmación antes de guardar.** Un modal sencillo ("¿Confirmas esta toma?") precede al guardado: una lectura mal escrita avisaría por error al médico. El front web pide dos confirmaciones; aquí es una.
- **Valor ingresado.** El número grande de `ValorGlucosaCard` pasó a ser un campo editable (mismo aspecto) con − y +. Se acepta de 20 a 600 mg/dL (el rango anterior de los botones era 40–400, que habría bloqueado una hipoglucemia grave). Los límites 20 y 600 los fijó la implementación, no el servicio original: **revisión clínica pendiente**.
- **Alerta honesta.** El mensaje solo afirma "se envió un correo a tu médico" si `registrarAlerta` respondió bien; si falla, o no hay `id_medico`, dice que no se pudo avisar y que lo contacte. El front web solo registra el fallo en consola.
- **Texto corregido.** El texto de hipoglucemia del front web tiene un espacio faltante ("rápiday vuelve"); se corrigió solo el espacio.
- **Periodos del historial.** Diario = hoy; Semanal = 7 días contando hoy; Mensual = 30 días contando hoy (el front web filtraba por un día o un mes calendario). Promedio redondeado; desviación estándar poblacional; "en rango" = lecturas entre 70 y 140 mg/dL (la meta que ya mostraba la pantalla), no la clasificación por edad.
- **Clasificación en la lista.** Usa el tipo de la alerta registrada; sin alerta, solo `< 70` se muestra como hipoglucemia (la app no reclasifica registros antiguos).
- **Errores.** El texto `{error}` del backend solo se muestra en 4xx; en 5xx se usa un mensaje genérico porque el backend devuelve a veces el texto de la excepción (p. ej. `registrarGlucosa`). En el login, un 401 muestra "Correo o contraseña incorrectos." para no revelar cuál falló.
- **`PerfilUsuario` e `InicioPaciente`** muestran un nombre genérico ("Paciente", "Médico", "Administrador") tras un login real.
- **Color `grayPillBg`.** `SolicitudCard` (simulada) usaba un color inexistente (error de `tsc` previo); se añadió el token con el valor de `surfaceMuted` (`#F1F5F9`), lo que da fondo gris a la etiqueta de rol "Paciente" en esa pantalla.
- **Pruebas.** `*.test.ts` se excluyen de `tsc` (no se instaló `@types/node`); el import con extensión `.ts` en `services/` (`allowImportingTsExtensions`) permite ejecutarlas con `node --test` y Metro lo resuelve.

### Fase Móvil 2: pantallas del paciente (TASK-034 a TASK-039)
Se conectan las pantallas del paciente que seguían simuladas: Inicio, Perfil y ficha clínica, edición de datos y solicitud de registro de paciente. La rama de **médico** de la solicitud de registro y las pantallas de médico y administrador siguen simuladas (otra fase).

**URL base sin `/api`.** `EXPO_PUBLIC_API_URL` va sin sufijo `/api` (la app ya agrega `/api/...`). Hallazgo de Móvil 1: con `.../api` la app pedía `/api/api/login` (404) y `http.ts` traducía todo 404 a un mensaje genérico. Decisión del equipo: `config.ts` **tolera** el sufijo (lo quita, con prueba) y se documenta el ejemplo correcto en `mobile/.env.example` y en el README. El timeout de login/verify-otp **se queda en 15 s** (decisión del usuario; el backend envía el OTP por SMTP de forma síncrona y puede tardar más: riesgo conocido).

**Errores 404.** `http.ts` distingue "ruta no encontrada" (cuerpo de FastAPI `{"detail": "Not Found"}`: error de configuración, probablemente la URL base) de "recurso no encontrado" (el backend responde `{"message"}` o `{"error"}`). Ningún mensaje muestra rutas, ids ni detalles técnicos. En desarrollo (`__DEV__`) se registra en consola solo método, ruta, estado HTTP y milisegundos: nunca cuerpos, contraseñas, OTP, correos ni tokens.

**Contrato real del backend (manda sobre el front web).**
| Endpoint | Contrato |
|---|---|
| `GET /api/pacientes/perfil/{id_paciente}` | `{nombre, id (= id_usuario, texto), fechaNac ("dd/mm/aaaa"), genero, altura, peso, telefono, correo, nombre_emergencia, numero_emergencia, foto_perfil (URL pública), nombre_medico, fecha_registro, admitidoPor, actividadFisica {nivel, descripcion}, afecciones [texto], tratamientos [{titulo, descripcion, dosis}], embarazo, semanas_embarazo (semanas al registrarlas, no las actuales), registro_embarazo}`. 400 `{error}`, 404 `{message}`, 500 `{error, code}`. |
| `GET /api/pacientes/obtenerDatosEmbarazo/{id_paciente}` | `{semanas_actuales}` (calculadas en el servidor; `null` si no hay embarazo activo). |
| `PUT /api/pacientes/actualizarPaciente/{id_usuario}` | **Exige todos** estos campos: `nombre, altura, peso, telefono, correo, nombre_emergencia, numero_emergencia` (si falta uno: 400 "Faltan datos obligatorios"). Opcionales: `embarazo` (bool), `semanas_embarazo`, `fecha_terminacion`. Usa el **id_usuario** (no el id_paciente). Cada vez que llega `embarazo: true` con `semanas_embarazo > 0` inserta un seguimiento nuevo. Los errores 5xx traen `details` con el texto de la excepción. |
| `POST /api/pacientes/registrarPaciente` | `multipart/form-data`. Campos obligatorios: `nombre_completo, correo, contrasena, rol ("paciente"), fecha_nac (AAAA-MM-DD), telefono, id_medico, id_actividad, genero, peso, altura, enfermedad_id, tratamiento_id, dosis_, nombre_emergencia, numero_emergencia` y **`foto_perfil` (archivo)**. Opcionales: `embarazada` ("true"/"false"), `semanas`. |
| Catálogos | `GET /api/general/niveles` `[{id_nivel_actividad, descripcion}]`, `/enfermedades` `[{id_enfermedad, nombre_enfermedad}]`, `/tratamientos` `[{id_tratamiento, nombre_tratamiento, descripcion}]`, `GET /api/medicos/ver` `[{id_medico, usuario: {nombre_completo}}]`. |

**Diferencias con el front web (gana el backend) y hallazgos.**
1. **La foto de perfil es obligatoria** en `registrarPaciente` (400 "Archivo de perfil faltante"), aunque el diseño pedía "foto opcional". Se instala `expo-image-picker` (decisión del usuario). Además el backend **sube la foto a Storage antes de validar los demás campos**: un formulario incompleto deja archivos huérfanos, así que la app valida todo antes de enviar.
2. **"Enviar solo los campos modificados" no es posible** en `actualizarPaciente`: el backend exige siempre los siete campos. La app envía siempre esos siete (con el valor actual si no cambió) y los campos de embarazo **solo si cambió el estado de embarazo**, para no duplicar seguimientos.
3. El front web envía `teléfono` (con tilde) en el registro; el backend también acepta `telefono`, que es lo que envía la app. El front pide teléfonos de 7 a 8 dígitos al registrar y de 10 o más caracteres al editar; el backend no valida. La app usa **7 a 8 dígitos en ambos** (pendiente de confirmar con el equipo).
4. Semanas de embarazo: el front web las calcula en el cliente; la app usa `obtenerDatosEmbarazo` (cálculo del servidor).
5. El backend devuelve **500** (no 404) para un id de paciente inexistente en `datosGlucosa`; el front web no lo distingue.
6. No hay estado "pendiente de aprobación" visible: `registrarPaciente` inserta directamente en `usuario` y `paciente`. El texto actual de la pantalla de éxito dice que un administrador revisará la solicitud; **no está verificado** que el backend implemente esa revisión (Open Question).
7. Los errores 5xx de estas rutas incluyen el texto de la excepción; la app solo muestra el `{error}` en 4xx.

**Nombre real.** Tras el login de un paciente, `App.tsx` carga el perfil (`GET /pacientes/perfil/{id_rol}`) y lo comparte con Inicio y Perfil. Si falla, vuelve al texto genérico sin romper la sesión. Los datos del perfil viven solo en memoria; el almacenamiento seguro sigue limitado a `id_usuario`, `id_rol` y `rol`.

**Inicio del paciente (datos reales de `GET /pacientes/registros/{id}`).** Última toma, "hace cuánto", momento, clasificación (por la alerta registrada), lecturas anteriores, tomas de hoy sobre 3 momentos del día (los del catálogo `momento_dia`), promedio de hoy, aviso preventivo (alertas o lecturas < 70 en los últimos 3 días; se oculta si no hay), médico asignado del perfil y fecha de hoy. Sin fuente real y marcado como simulado: el punto de "notificaciones sin leer" del encabezado (solo en modo simulado) y el botón "Ver desglose" que solo navega al historial.

**Ficha clínica.** Condiciones (`afecciones`), médico tratante, tratamientos con dosis, nivel de actividad física, semanas de embarazo si aplica y tiempo en rango de la semana (rango meta central de `umbrales.ts`), calculado con el historial. La ficha de médico y administrador sigue simulada.

**Edición.** Formulario con validaciones (nombre, altura y peso numéricos, teléfonos de 7 a 8 dígitos, correo, contacto de emergencia), confirmación (el cambio de correo afecta al login) y mensaje de éxito o error. Al terminar el perfil se vuelve a cargar.

**Solicitud de registro de paciente.** Formulario por secciones con los catálogos reales y `multipart/form-data` (`FormData` con `foto_perfil` como `{uri, name, type}`; booleanos como `"true"`/`"false"`). La contraseña existe solo en el estado del formulario y se limpia tras enviar. Campos de género: `Masculino`/`Femenino` (como el front web); "¿embarazada?" y semanas solo si es `Femenino`. La fecha de nacimiento se escribe como AAAA-MM-DD (sin librería de calendario).

**Decisiones de implementación (a revisar por el equipo).**
- **Subida de la foto:** el timeout del `POST registrarPaciente` es de 60 s (incluye la subida); el resto sigue en 15 s y login/verify-otp **no cambian** (decisión del usuario).
- **Contraseña del registro:** mínimo 8 caracteres (la regla que ya mostraba el formulario; el backend no valida y el front web pide 6).
- **Altura (corregido, unidad confirmada por el equipo):** la base la guarda en **metros** (`numeric(4,2)`, máximo 99.99; p. ej. 1.70). La app la pide y la muestra en **centímetros** y la **envía en metros con dos decimales** (170 → `1.70`, redondeando al centímetro entero); el perfil la trae en metros y se convierte de vuelta (round-trip sin cambios). Rango válido: 50 a 250 cm (0.50 a 2.50 m). La suposición anterior ("cm") causaba `numeric field overflow` (código 22003) en `registrarPaciente`. El front web usa metros en registro y edición (con coma decimal en la edición, lo que probablemente falle en el backend: no afecta a la app, que envía punto).
- **Meta diaria de tomas:** 3, una por momento del catálogo `momento_dia`; el diseño original mostraba "/ 4 meta" sin fuente. La meta glucémica mostrada era 70-140 mg/dL, no "70-130" de la maqueta; **desde la Fase Móvil 5 es 70-180** (`umbrales.ts`).
- **Aviso preventivo:** cuenta lecturas con alerta o menores de 70 en los últimos 3 días; si no hay ninguna, la tarjeta no se muestra. Reemplaza el texto simulado sobre "valores cercanos al límite postprandial".
- **Ficha clínica:** "Diagnosticado en noviembre 2021" y "Clínica Santa María · Endocrinología" no tienen fuente real y se retiraron; en su lugar van los tratamientos con dosis y el nivel de actividad. "Estable / 85 %" pasó a ser el tiempo en rango real de los últimos 7 días.
- **Solicitud de registro:** abre en la pestaña "Paciente"; la de "Médico" conserva el formulario simulado. El modal de éxito del paciente no promete una aprobación que no está verificada: dice que, si no puede iniciar sesión, la cuenta puede estar pendiente.
- **Errores de registro:** `registrarPaciente` devuelve 500 con el texto de la excepción (p. ej. correo duplicado); la app solo puede mostrar "Ocurrió un error en el servidor", sin distinguir un correo ya registrado.
- **Multipart con archivo (corrección posterior):** en Expo SDK 58 el `fetch` global es `expo/fetch`, que **no admite archivos locales `{uri, name, type}`** en un `FormData` (lanza "Unsupported FormDataPart implementation" antes de salir a la red; lo confirman `convertFormData.ts` y su prueba en `node_modules/expo`). La app lo veía como "no se pudo conectar" al instante y el backend no recibía nada. Los `FormData` se envían ahora con `XMLHttpRequest` (que React Native lee de forma nativa, sin fijar `Content-Type`); el resto de las llamadas sigue con `fetch`. Sin dependencias nuevas. La foto se comprime con `quality: 0.5` y se deduce el MIME de la extensión si el selector no lo informa.
- **Diagnóstico en desarrollo:** `http.ts` registra `[http] MÉTODO ruta -> FALLO Nombre: mensaje` (sin URLs, que se sustituyen por `<url>`), `registroPaciente.ts` registra el tipo MIME y los bytes del adjunto (nunca contenido, ruta, correo ni datos personales) y, si el envío falla sin llegar al servidor, ejecuta una sonda multipart sin archivo y con un solo campo no personal (`rol`): el servidor responde 400 "Archivo de perfil faltante" sin escribir nada.
- **Errores 5xx en desarrollo:** `http.ts` registra el texto de `error` y `details` de las respuestas 5xx, enmascarado (`enmascarar`: correos, teléfonos y números largos, contraseñas, hashes, filas y claves de Postgres, URLs, rutas de archivos, tokens) y truncado a 300 caracteres, solo con `__DEV__`; nunca el cuerpo de la petición. En producción el usuario sigue viendo el mensaje genérico.
- **Otros campos numéricos (evidencia):** *peso*: el backend lo convierte con `float()` y el front web lo pide en kg sin tope (`^\d+(\.\d+)?$`); **el tipo de la columna no está documentado en el repositorio** (no hay SQL ni migraciones), así que no se sabe si admite 100 kg o más (con `numeric(4,2)` el máximo sería 99.99 y un paciente de 100 kg desbordaría). La app valida hasta 500 kg y no cambia el formato. *Semanas de embarazo*: el backend usa `int()`; la app valida de 1 a 42. *Dosis*: texto libre en el formulario y el front web; el backend la lee con `str()`, lo que sugiere una columna numérica (sin confirmar). *IMC* y *HbA1c*: no se capturan ni en el registro ni en la edición (HbA1c solo existe en el modelo de ML).
- **Niveles de actividad:** el catálogo devuelve las descripciones en mayúsculas (`SEDENTARIO`); se muestran tal cual.

**Privacidad.** Nada de lo anterior se registra en consola (solo método, ruta, estado y milisegundos en desarrollo). Las contraseñas no se guardan fuera del formulario.

### Fase Móvil 3: pantallas del médico (TASK-040 a TASK-047)
Se conectan las pantallas del médico: lista de pacientes, detalle del paciente, alertas (activas y resueltas, con respuesta), reportes, perfil y edición, y la rama de médico de la solicitud de registro. **Fuera de esta fase:** el administrador y el modelo de ML (no se conecta ni deja huecos visibles para él). No había pantalla móvil para que el médico registre una toma a un paciente (`POST /api/medicos/registrar/glucosa` existe en el backend); **se creó después en TASK-067**.

**Identificadores.** `id_rol` de la sesión es el `id_medico` (lo usan `misPacientes`, `alertasActivas`, `alertasResueltas`, `responder/alerta` y `actualizar`); `id_usuario` es otro id y solo lo usa `GET /medicos/perfil/{idUsuario}`.

**Contrato real del backend (manda sobre el front web).**
| Endpoint | Contrato |
|---|---|
| `GET /api/medicos/perfil/{id_usuario}` | `{id (= id_medico), nombre, fechaNac ("dd/mm/aaaa"), telefono, correo, matricula (URL del PDF), carnet (URL de la imagen), especialidad, departamento, admitidoPor}`. Los datos ausentes llegan como **textos de relleno** (`"No registrado"`, `"N/A"`, `"Sin especialidad"`, `"Sistema"`), que la app trata como vacíos. 400 `{error}`, 404 `{message}`, 500 `{error, code}`. |
| `GET /api/medicos/misPacientes/{id_medico}` | Lista de pacientes **con cuenta activa**: `{id (= id_paciente), nombre, ci (= correo), fechaNac ("dd/mm/aaaa"), genero, peso (texto, kg), altura (texto, **metros**), actividadFisica, telefono, correo, nombre_emergencia, numero_emergencia, foto_perfil, afecciones [{afeccion}], tratamientos [{titulo, desc, dosis}]}`. **No trae lecturas ni `historial` ni `embarazo`.** |
| `GET /api/medicos/alertasActivas/{id_medico}` | `[{id (= id_alerta), nivel (texto del tipo de alerta), idpaciente, paciente, fecha ("aaaa-mm-dd"), hora ("hh:mm"), glucosa (número, mg/dL), momento, observaciones}]` |
| `GET /api/medicos/alertasResueltas/{id_medico}` | Igual que las activas, más `mensaje` (la respuesta del médico). |
| `POST /api/medicos/responder/alerta` | JSON `{id_medico, fecha_registro ("aaaa-mm-dd"), mensaje, alertas_id_alerta}`; los cuatro son obligatorios (400 "Todos los campos son requeridos"). Inserta la retroalimentación y luego pone `estado=false` en la alerta, **sin transacción y sin comprobar que la alerta siga activa ni que sea del médico**. |
| `PUT /api/medicos/actualizar/{id_medico}` | `multipart/form-data`, todos opcionales: `telefono`, `correo`, `departamento`, `carnet` (archivo). Solo actualiza los que llegan **no nulos** (una cadena vacía borraría el dato). 404 `{message}`; 500 `{message, error}`. |
| `POST /api/medicos/registrar` | `multipart/form-data`: `nombre_completo, correo, contrasena, telefono, fecha_nac (aaaa-mm-dd), id_especialidad, departamento` y los archivos **`matriculaProfesional` (PDF)** y **`carnetProfesional` (imagen)**, ambos obligatorios (400 si falta alguno). |
| `GET /api/general/especialidades` | `[{id_especialidad, nombre}]` |
| `GET /api/pacientes/registros/{id_paciente}` | Historial del paciente (ya en uso; ver arriba). |

**Unidades y formatos confirmados.** Altura de `misPacientes`: **metros** como texto (p. ej. `"1.70"`; la base es `numeric(4,2)`); peso en kg como texto; dosis como texto (`str()`); fechas de nacimiento `dd/mm/aaaa`; fechas de alertas y lecturas `aaaa-mm-dd` y horas `hh:mm`; glucosa en mg/dL. La app **no envía ningún campo numérico del paciente** en esta fase: lo único numérico que envía es `id_medico`, `alertas_id_alerta` (enteros) y `id_especialidad`. La altura se muestra en cm (conversión ya existente).

**Diferencias con el front web (gana el backend) y hallazgos para el responsable del backend.**
1. `misPacientes` consulta **todas** las lecturas de cada paciente y las descarta; tampoco devuelve el `historial` que espera el detalle del front web y el generador de PDF (`/api/paciente/pdf` lee `historial[].registros[]`). La app obtiene el historial con `GET /pacientes/registros/{id}` (una llamada al abrir el detalle).
2. `registrar` **no guarda `estado` ni `fecha_solicitud`** (el front web los envía, el backend los ignora): no hay estado "pendiente" visible. Tampoco valida los campos antes de subir los archivos (`contrasena` ausente se convierte en el texto "None" al aplicar el hash), no usa transacciones (un fallo deja un `usuario` suelto) y fija `administrador_id_admin: 1`.
3. `responder/alerta` no es idempotente: un segundo envío duplica la retroalimentación. La app impide el doble envío y refresca la lista.
4. Sin autenticación (RB-01): cualquier cliente puede leer pacientes y alertas de cualquier médico cambiando el id. **Estas pantallas exponen datos de pacientes sin autenticación real; solo es aceptable en una red local de desarrollo.**
5. `actualizar` responde 500 con `error: str(err)` (texto de la excepción); la app solo lo muestra enmascarado en desarrollo.
6. El front web edita al médico con los datos del perfil, incluidos los textos de relleno (`"No registrado"`): la app no los rellena en los formularios.
7. Reglas de teléfono distintas en el front web (8 dígitos exactos al registrar, 8 o más caracteres al editar): la app usa **8 dígitos** en ambos (pendiente de confirmar).

**Lista de pacientes.** Estado por paciente derivado de `alertasActivas` (decisión del usuario): "En riesgo" = tiene una alerta activa; la tarjeta muestra el valor, la hora y la clasificación de su alerta activa más reciente, o "Sin alertas activas". "Estables" = el resto. Métricas superiores: pacientes asignados y casos con alerta activa (el "88.4 % en rango" de la maqueta no tiene fuente sin una llamada por paciente, así que se sustituye por el número de pacientes). Búsqueda por nombre o id, y filtros Todos / En riesgo / Estables, como la maqueta. Los pacientes se cargan una vez tras el login y se comparten con Alertas y Reportes.

**Detalle del paciente.** Cabecera con nombre, id, edad (de `fechaNac`), afecciones, teléfono y última toma; última telemetría, curva (semanal/mensual) y registros recientes desde `GET /pacientes/registros/{id}` con las funciones de `historial.ts`; tratamientos reales con dosis. Se retiran los textos inventados de la maqueta ("Última visita", la vía "Oral/Subcutánea", "Se notificó al paciente ingerir 15 g…").

**Alertas.** Pestañas Activas y Resueltas. Al tocar una activa se abre un modal con el detalle, el campo de respuesta (obligatorio, 3 a 500 caracteres: **límite elegido por la implementación**, el backend no lo valida) y la acción de enviar con confirmación; al terminar se recargan las listas. Las resueltas muestran la respuesta. Filtros Todas / Hipo / Hiper por el texto de `nivel` (contiene "hipo" o "hiper"). El aviso superior se muestra solo si hay una alerta activa y usa la más reciente.

**Reportes.** Métricas reales por paciente asignado y rango (últimos 7 o 30 días): promedio, tiempo en rango, hipoglucemias (< 70), hiperglucemias (> 180) y distribución. **Rango del reporte: 70-180 mg/dL**, el que ya mostraba la maqueta (entonces distinto del 70-140 del paciente; **unificado en 70-180 en la Fase Móvil 5**). **El PDF se difirió** en esta fase y se resolvió en la Fase Móvil 5 (generado en el dispositivo con `expo-print` y `expo-sharing`).

**Perfil y edición del médico.** Datos reales (especialidad, departamento, matrícula cargada o no, carnet). Edición con los únicos campos que acepta el backend: teléfono, correo, departamento y carnet (imagen JPG/PNG de hasta 2 MB); solo se envían los campos cambiados y no vacíos, por `multipart` con `PUT`, con validación y confirmación.

**Solicitud de registro de médico.** Especialidades reales; matrícula en **PDF de hasta 5 MB** (`expo-document-picker`, dependencia nueva aprobada) y carnet en **JPG/PNG de hasta 2 MB**; todo se valida en el cliente **antes** de enviar porque el backend sube los archivos antes de validar. Teléfono de 8 dígitos, contraseña de 8 o más caracteres (como el formulario de paciente), fecha `aaaa-mm-dd`. La app no envía `estado` ni `fecha_solicitud`.

**Privacidad.** No se registra en consola ningún dato personal ni de pacientes (nombres, glucosas, correos). Los multipart reutilizan `XMLHttpRequest` de `http.ts` (sin `Content-Type` manual). El almacenamiento seguro sigue limitado a `id_usuario`, `id_rol` y `rol`.

### Fase Móvil 4: pantallas del administrador (TASK-048 a TASK-054)
Se conectan las pantallas del administrador: solicitudes de registro (pacientes y médicos), detalle de solicitud con la acción de **activar**, usuarios, auditoría y su perfil. Con esto **ninguna pantalla queda simulada**; lo que el backend no soporta queda deshabilitado con aviso (ver abajo). El ML sigue fuera de esta fase.

**Identificadores.** `id_rol` de la sesión es el `id_admin` (lo exigen `activar` y `obtenerAdmins`); `id_usuario` solo se usa en `perfilAdmin`.

**Contrato real del backend (manda sobre el front web).**
| Endpoint | Contrato |
|---|---|
| `GET /api/administradores/medicos/solicitantes` y `/medicos/activos` | `[{id (= id_medico), nombre, fechaNac (**aaaa-mm-dd**), telefono, correo, matricula (URL del PDF), departamento, carnet (URL de la imagen), admitidoPor}]`. Los datos ausentes llegan como `"No registrado"`, `"N/A"` o `"Sistema"`. *Solicitantes* = cuentas con `usuario.estado = false`; *activos* = `estado = true`. |
| `GET /api/administradores/pacientes/solicitantes` y `/pacientes/activos` | `[{id (= id_paciente), nombre, ci (= correo), fechaNac (**dd/mm/aaaa**), genero, peso (texto, kg), altura (texto, **metros**), actividadFisica, telefono, correo, nombre_emergencia, numero_emergencia, medico (nombre del médico asignado), foto_perfil, afecciones [{afeccion}], tratamientos [{titulo, desc, dosis}], admitidoPor}]`; los solicitantes añaden `embarazo` y `semanas_embarazo`. |
| `PUT /api/administradores/medico/activar/{id_medico}` y `/paciente/activar/{id_paciente}` | JSON `{"idAdmin": <id_admin>}` (obligatorio y distinto de cero: 400 "No hay administrador"). Pone `usuario.estado = true` y guarda el administrador. 404 `{error}` si no existe; 500 `{error, detalles}` (con el texto de la excepción). **Solo activa**: no hay rechazo, desactivación ni edición. |
| `GET /api/administradores/perfilAdmin/{id_usuario}` | `{id (= id_admin), nombre, correo, fechaNac ("dd/mm/aaaa"), telefono, cargo, fechaIn ("dd/mm/aaaa"), admitidoPor}`. 404 `{message}`. |
| `GET /api/administradores/obtenerAdmins/{id_admin}` | Los demás administradores, **excluyendo al `id_admin = 1` y al propio**, con la forma de `perfilAdmin`. |
| `POST /api/administradores/agregar` | JSON `{nombre, correo, contrasena, fechaNacimiento, telefono, cargo, fecha_registro, administrador_id_admin}`, todos obligatorios; crea un administrador **ya activo**. Existe en el backend pero la maqueta móvil no tiene pantalla para agregar administradores, así que **no se crea**. |
| `GET /api/general/auditoria` | Toda la tabla `auditoria_endpoints` sin paginar: `[{id, id_usuario, rol, id_rol, endpoint, operacion, exito, codigo_http, ip_origen, fecha, usuario: {nombre_completo}}]`. |

**Qué hace realmente "activar" y qué no existe.** Los estados son solo `usuario.estado` verdadero o falso. No hay endpoint para **rechazar** una solicitud (el front web simula el éxito en el cliente), **desactivar**, **cambiar el rol**, **editar** ni **eliminar** usuarios, ni para **exportar** la auditoría. Por decisión de diseño la app **no inventa** esas acciones: los botones quedan **deshabilitados con un aviso** ("el backend no ofrece esta acción").

**Diferencias con el front web y hallazgos para el responsable del backend.**
1. **Sin autenticación (RB-01): cualquiera puede activar cuentas.** `activar` solo exige un `idAdmin` cualquiera; no se comprueba que exista ni que sea administrador. **Estas pantallas permiten activar cuentas sin autenticación real; solo es aceptable en una red local de desarrollo.**
2. No hay rechazo, desactivación ni edición de usuarios (el "rechazar" del front web solo muestra un modal de éxito).
3. Los solicitantes **no traen fecha de solicitud**: el front web envía `estado` y `fecha_solicitud` al registrar, pero el backend los ignora. La maqueta mostraba "Recibido hace…" y la app no puede calcularlo.
4. `fechaNac` es `aaaa-mm-dd` en médicos y `dd/mm/aaaa` en pacientes y administradores. La app normaliza a `dd/mm/aaaa`.
5. `activar` es idempotente en la práctica (activar una cuenta ya activa responde 200; el front web espera un 409 que no existe) y devuelve `detalles` con el texto de la excepción en el 500.
6. `/general/auditoria` no tiene paginación ni filtro, devuelve `select *` con nombres e IP de origen y no exige autenticación: puede crecer sin límite y expone datos personales a cualquier cliente.
7. `pacientes/activos` usa `administrador!inner`: un paciente activo **sin** administrador asignado no aparece en la lista.
8. `medicos/activos` clasifica como 403 cualquier error cuyo texto contenga "28" (comprobación de subcadena frágil).
9. `obtenerAdmins` oculta al administrador 1 (valor fijo en el código).
10. **`/general/auditoria` devuelve como máximo 1000 filas y sin orden** (verificado contra el backend real: exactamente 1000 filas, con ids no ascendentes y fechas que llegan solo hasta mayo de 2026), así que la actividad reciente puede faltar. La app lo avisa. Además `ip_origen` llega a veces como IPv4 mapeada en IPv6 (`::ffff:a.b.c.d`), que el enmascarado también cubre, y a veces `null`.

**Decisiones de la app.**
- **Solicitudes:** lista unificada de pacientes y médicos solicitantes con filtro Todos / Pacientes / Médicos. La tarjeta muestra nombre, rol, afección o departamento y correo (no hay fecha de solicitud). Se retiró el aviso de la maqueta "las matrículas se contrastan con el Registro Nacional" (no existe).
- **Detalle de solicitud:** datos del solicitante; para médicos, matrícula (PDF) y carnet (imagen) como **URL de Storage**: el carnet se previsualiza y ambos se abren con `Linking` (navegador), **sin dependencias nuevas**; solo se abren URL `http(s)`. La maqueta de "acreditación verificada en padrón nacional" y "permisos a otorgar" no tiene fuente real y se sustituyó por lo que sí ocurre: la cuenta quedará activa y podrá iniciar sesión. **Activar** pide confirmación, bloquea el doble envío, envía `{idAdmin: id_rol}` y recarga las listas; **Rechazar** queda deshabilitado con aviso.
- **Usuarios:** activos (médicos, pacientes y administradores) e inactivos (= solicitantes pendientes), con búsqueda por nombre, correo o rol y filtro de estado. El modal de gestión es de **solo lectura** salvo "Activar cuenta" en los inactivos; el cambio de rol y de estado queda deshabilitado con aviso. Las identidades se distinguen por rol (los ids de `medico` y `paciente` se solapan).
- **Auditoría:** carga única, orden por fecha descendente y **carga parcial en el cliente** (páginas de 20 con "Ver más"). Filtros Todos / Accesos (`login`) / Modificaciones (operaciones distintas de `GET`), y alternancia Hoy / Todo el historial. KPIs reales (registros hoy, con error hoy, total). **Datos sensibles:** no se muestran nombres; la IP se enmascara (`a.b.c.xxx`) y los números del endpoint se sustituyen por `{id}`. Se retiraron las afirmaciones sin fuente de la maqueta ("cumplimiento HIPAA / GDPR", "cifrado SHA-256", "bloque de auditoría #84920", "integridad 100 %", "en vivo") y la **exportación CSV/PDF** queda deshabilitada con aviso.
- **Perfil del administrador:** nombre, correo, teléfono, cargo, fecha de ingreso y quién lo admitió, desde `perfilAdmin`. Si falla, nombre genérico sin romper la sesión.

**Privacidad.** No se registra en consola ningún dato personal (nombres, correos, IP). El almacenamiento seguro sigue limitado a `id_usuario`, `id_rol` y `rol`.

### Fase Móvil 5: cierre de pendientes previos a ML y chatbot (TASK-055 a TASK-060)
Fase de la app (`mobile/`) sin tocar `backend/`, `nlp_service/` ni `ml_service/`, sin seguridad (RB-01 a RB-06 siguen documentados) y sin ML ni chatbot (solo se corrigen problemas visuales del chatbot). Todo lo que exige un cambio del backend queda en CONTEXT.md § Hallazgos para Adrian.

**Umbrales clínicos centralizados (TASK-055).** Hasta ahora había tres definiciones de "en rango": 70-140 en el paciente (historial, inicio, perfil, gráficos y textos), 70-180 en el reporte del médico y, aparte, los rangos por edad y tipo del port de `glucosa.service.ts` (que deciden la alerta, no el resumen). Se crea `mobile/src/services/umbrales.ts` (funciones y constantes puras, con el origen de cada valor en comentarios): hipoglucemia (< 70), rango meta (**70-180 mg/dL, decisión del usuario: consenso de tiempo en rango**), límites de captura (20-600 mg/dL) y lecturas diarias esperadas (3, los tres momentos del catálogo). Todos los consumidores (historial, inicio, perfil, gráficos, reporte, PDF y textos "Meta 70-…") leen de ahí; cambiar el rango es tocar un solo lugar. **No se tocan** los rangos por edad y tipo de `clasificacionGlucosa.ts` (deciden las alertas; siguen pendientes de revisión clínica, ver Open Questions). Efecto visible del cambio de rango: el paciente pasa a ver "Meta 70-180" y su tiempo en rango sube; las alertas no cambian.

**PDF del reporte del médico (TASK-056).** Se elige **(b) generar el PDF en el dispositivo** con `expo-print` (HTML → PDF) y `expo-sharing` (hoja del sistema); ambas dependencias aprobadas por el usuario, instaladas con `npx expo install`. Motivos frente a `POST /api/paciente/pdf`:
1. Exige que el cliente arme un objeto `paciente` con **C.I., género, peso, altura, teléfono y correo** además de `historial[].registros[]` con las alertas: más datos personales de los necesarios para un reporte de glucemia (NFR-001), y la app no tiene varios de ellos (C.I. y género no vienen de `misPacientes`).
2. Enviaría datos clínicos por POST a un endpoint **sin autenticación** (RB-01) y sin restricción de rol; la verificación del endpoint contra el servidor real no es posible sin ese POST.
3. Devuelve un binario `application/pdf`; el cliente HTTP de la app es JSON-only. Habría que escribir un archivo para compartirlo de todos modos, así que no se ahorra ninguna dependencia.
4. El diseño objetivo (`GET /pacientes/{id}/reporte-pdf`, TASK-020) sigue sin existir; no se puede depender de él.
La función pura `reportePdf.ts` genera el resumen y el HTML (sin red ni módulos nativos, con pruebas): paciente (nombre, edad y condición; no teléfono, correo ni documento), periodo, promedio, mínimo, máximo, **% en rango con `umbrales.ts`**, hipo/hiper y número de lecturas, tabla de lecturas y de alertas, fecha de generación y la leyenda de que es informativo y no reemplaza el criterio clínico. Todo texto del servidor se escapa. Estados: cargando (generando), error con reintento, **sin lecturas no se genera PDF** (botón deshabilitado con aviso) y compartir con la hoja del sistema; si el dispositivo no puede compartir, se avisa. No se registra en consola nada del contenido.

**Restos estáticos o simulados (TASK-057).** Auditoría por búsqueda de texto: se corrige lo claramente falso o sin respaldo y lo que parecía funcionar y no hacía nada. `ConfiguracionMenu` (3 filas con alertas estáticas: "recordatorios activos", "biometría", "conexión segura establecida con el portal clínico") se **elimina**: no existe endpoint de notificaciones, biometría ni portal, y las alertas afirmaban cosas falsas. Se retiran el banner "Protocolo de Glucemia Activo / Ver Guía" del médico (la guía no tiene contenido), el botón "Exportar registros" del historial del paciente ("Generando exportación…" sin hacer nada), la fila "Cambiar" de la fecha de la toma (la app usa siempre la hora del dispositivo) y la campana sin acción del encabezado cuando no tiene destino. Se corrige "GlucoTracker v1.0.4" (la versión real es la de `app.json`) y la nota "cumplimiento estricto con normativas" (afirmación sin respaldo). Con `EXPO_PUBLIC_USE_MOCK=false` ningún módulo de datos simulados se usa en tiempo de ejecución (solo se importan tipos desde `mockData.ts`; los datos de ejemplo se leen únicamente tras la rama `USE_MOCK`). Quedan fuera de esta fase, por la regla de no tocar el chatbot, la tarjeta "Guía de carbohidratos" y el botón de dictado por voz del chatbot (alertas estáticas): se reportan.

**Medidas y escalado (TASK-058).** Criterio común en `mobile/src/utils/medidas.ts`: escala de espaciado, radios, alturas de botón e input y tamaños de fuente (cuerpo 14-16, títulos 20-24); funciones puras `factorEscala(ancho)` (acotado entre 0,9 y 1,15 respecto a un teléfono de 360 dp) y `escalar(valor, ancho, tope)`, y `ANCHO_MAXIMO_CONTENIDO` (contenido centrado y limitado en tablets). Se aplican de forma central: el contenido autenticado y el login se limitan al ancho máximo desde `App.tsx`, `BottomNavBar` respeta la zona segura inferior (barra de gestos), los textos del sistema no crecen más de 1,3× (`maxFontSizeMultiplier`) y las cifras grandes (de 40-56 pt) se reducen a un tamaño razonable y se ajustan al ancho (`adjustsFontSizeToFit`, una línea). Textos largos (correos, nombres, rutas) llevan `numberOfLines`. **No cambian textos, lógica ni `testID`.** La revisión visual se hace con capturas de la exportación web con `react-native-web` (dependencias de solo revisión, aprobadas por el usuario) y Playwright fuera del repositorio; el aspecto real en el celular queda por verificar.

**Robustez y experiencia de uso (TASK-059).**
- *Sesión:* cerrar sesión borra el almacenamiento seguro y reinicia la navegación (pestaña y subpantallas); al abrir con una sesión guardada, si el servidor responde 404 al cargar el perfil del rol guardado (rol o id que ya no corresponden), se cierra la sesión y se avisa en el login. Un error de red o un 5xx no cierran la sesión. **Limitación comprobada con un GET real:** el backend responde **500** (no 404) para un id de perfil inexistente, así que contra el backend actual un rol o id inválido no se distingue de un fallo del servidor y la sesión no se cierra sola: el perfil muestra el error con «Reintentar» y el usuario puede cerrar sesión. La rama del 404 queda probada con respuestas simuladas y lista para cuando el backend devuelva 404 (hallazgo para el responsable del backend).
- *Red:* todas las llamadas tienen tiempo límite (15 s por defecto; 30 s en la auditoría y 60 s en los envíos con archivos) con mensajes claros de sin conexión, sin respuesta y servidor; las pantallas que cargan datos ofrecen **Reintentar**.
- *Estados vacío / cargando / error:* se revisan todas las pantallas y se corrigen las que no los tienen (lista en tasks.md).
- *Doble envío:* los botones que escriben se bloquean con el estado de envío (registrar glucosa, alerta, responder alerta, actualizar perfil, registrar paciente o médico, activar) y hay una prueba de la guarda.
- *Teclado y accesibilidad:* tipo de teclado por campo; formularios largos con `KeyboardAvoidingView` y desplazamiento; `accessibilityLabel` y `accessibilityRole` en botones de solo icono y de acción; el contraste de los textos de estado se revisa contra WCAG AA.
- *Registro con fallo parcial:* el backend no es transaccional (crea el usuario antes de subir archivos y puede fallar a mitad). Si el envío del registro falla con error del servidor, de red o de tiempo, la app avisa que pudo quedar un registro incompleto y que, si el correo aparece como ya usado al reintentar, debe usar otro correo o pedir ayuda. No se arregla en el backend.

### Fase Chatbot-Front: pantalla del chatbot terminada (TASK-061 a TASK-066)
Solo `mobile/`. **No cambia** el contrato de `POST /api/chatbot/consulta` (`{texto}` → `{respuesta}`), ni el servicio NLP, ni el backend, ni el ML. La lógica de red de `services/chatbot.ts` y el tratamiento de errores no cambian.

**Efecto de escritura (TASK-061).** El servicio responde completo (no hay streaming), así que el efecto es **solo de presentación**: mientras se espera, un indicador «escribiendo…» (tres puntos animados) y, al llegar la respuesta, el texto se revela por palabras. Lógica en `services/revelado.ts` (funciones puras con pruebas): trocea por palabras conservando espacios y saltos de línea (una palabra muy larga se parte por puntos de código sin separar emojis compuestos ni marcas de acento), calcula un ritmo (45 ms por paso por defecto) y **limita la duración total a 4 s** agrupando fragmentos cuando el texto es largo; el último paso siempre es el texto íntegro. `CHAT_ANIMACION` (`'escritura'` | `'inmediato'`) vive en `services/config.ts` y se sobrescribe con `EXPO_PUBLIC_CHAT_ANIMACION`; con `'inmediato'` todo se muestra de golpe, sin esperas. También es inmediato si el sistema tiene activado **reducir movimiento**. Solo se anima la última respuesta recién recibida; tocar la burbuja la completa; al enviar otra consulta o desmontar se limpian los temporizadores y no hay actualizaciones de estado posteriores. **Aviso médico:** el servicio añade como último párrafo «Consulta siempre a tu médico tratante…» (`DESCARGO_MEDICO`). La app lo separa del cuerpo (`separarAviso`), anima solo el cuerpo y lo muestra **completo** al terminar (`chat-aviso-medico`); si la respuesta no trae ese párrafo, la app **no inventa** uno. El scroll baja solo mientras escribe y solo si el usuario no subió a mano. Con error de red, 429 o 5xx no aparece «escribiendo…» ni se anima nada (el indicador se oculta al terminar la llamada).

**Retiro de lo falso (TASK-062).** Se eliminan la tarjeta «Guía de carbohidratos» (alerta «Abriendo material educativo…» sin contenido ni servicio) y el botón de dictado (alerta «El dictado por voz está listo» sin función). Con el mismo criterio se retiran las marcas de «leído» (doble check azul) de los mensajes del usuario (el servicio no confirma lectura) y se corrigen la insignia «IA Activa» (parecía un estado en línea; ahora «Asistente de IA») y el subtítulo «Orientación **personalizada**» (la app solo envía el texto de la consulta, sin datos del paciente; ahora «Orientación general»). Las **consultas sugeridas** pasan de rellenar el campo con una plantilla a **enviar directamente una pregunta completa al servicio**. Se conserva la leyenda de que el asistente es informativo y no reemplaza al médico. Se reportan, sin cambiar: el título «Asistente Clínico» (suena a diagnóstico) y el saludo inicial fijo, que no viene del servicio.

**Accesibilidad y vistas (TASK-063).** Rol y etiqueta en el botón de enviar y en las consultas sugeridas; el campo de texto con etiqueta; envío deshabilitado con texto vacío o con un envío en curso, con guarda síncrona (`turno.ts`) contra el doble toque; el campo no queda tapado por el teclado (`KeyboardAvoidingView`, en Android con `behavior="height"`). Las burbujas usan `useMedidas`: ancho máximo según `anchoBurbuja(ancho)` (85 % del contenido, tope 480 dp), fuente del cuerpo de 14 a 16 con el factor de escala y saltos de línea sin desbordar. No se empeora el contraste validado.

**testID estables (TASK-064).** `utils/testId.ts` (`normalizarTestId`: sin acentos, minúsculas, solo `[a-z0-9-]`) se aplica a los `testID` dinámicos que llevan texto libre: las tarjetas de solicitud del administrador pasan de `solicitud-Médico-1` a `solicitud-medico-1` (y `solicitud-paciente-1`); las demás se revisan y se normalizan igual. Nuevos: `chat-escribiendo`, `chat-aviso-medico` (existen ya `chat-entrada`, `chat-enviar`, `chat-aviso`, `chat-mensaje-usuario-<n>` y `chat-mensaje-asistente-<n>`). No cambia ningún otro `testID`.

**Recomendación «2 horas exactas» (TASK-065, decisión del usuario).** Se muestra **solo cuando el momento seleccionado es posterior a una comida**. El momento sale del catálogo real (`GET /api/general/momentos`, ya cargado): cada opción conserva su `clave` derivada del id del catálogo, y la tarjeta se muestra únicamente si la clave es `despues`. No hay una lista fija de textos.

**Verificación (TASK-066).** `tsc`, pruebas, `expo export`, una consulta de humo al servicio NLP con proveedor falso (`docker-compose.prueba.yml`, sin claves reales) comprobando solo claves, tipos y longitud, y capturas web del chat (fuera del commit). No verificable sin celular: la animación real, el scroll, el teclado, el lector de pantalla y el servicio con proveedor real.

### Registro de glucosa por el médico (TASK-067)
Solo `mobile/`. Cierra la excepción de la Fase Móvil 3 («no hay pantalla para que el médico registre una toma»). **No cambia el backend**: usa `POST /api/medicos/registrar/glucosa` (`{fecha "aaaa-mm-dd", hora "hh:mm:ss", id_medico, id_momento, id_paciente, nivel_glucosa (mg/dL), observaciones?}`), que escribe en `registro_glucosa` con `id_medico`, no genera alertas, no valida que el paciente sea del médico y no exige autenticación (RB-01); y `POST /api/registro/registrarAlerta` para la alerta, como hace el front web (`Pages/Medico/paginas/registrar-glucosa`).

- **Entrada.** Botón «Registrar toma» en `DetallePaciente`, **solo si el paciente está en la lista `misPacientes` del médico** (el backend no lo comprueba). Abre `RegistroTomaMedico`, con el mismo diseño que el registro del paciente (valor, fecha y hora del dispositivo, momento del catálogo real) y un encabezado que nombra al paciente y dice que la lectura se registra **por** él.
- **Datos.** Valor entero de 20 a 600 mg/dL (`umbrales.ts`; se rechaza 0, vacío y no numérico antes de enviar, aunque el backend los acepte), momento del catálogo (`GET /api/general/momentos`) y observaciones opcionales de hasta **200 caracteres** (límite elegido por la implementación: el backend no lo valida). Fecha y hora **locales del dispositivo** (`fechaLocal`/`horaLocal`), sin edición manual.
- **Clasificación.** En el cliente, con el port existente y la edad y el tipo del paciente (`GET /api/registro/datosGlucosa/{id_paciente}`). `PARAM_INVALIDO`: la lectura se guarda **sin alerta** y se avisa.
- **Envío.** Confirmación con el resumen (valor, momento y paciente) y guarda síncrona contra el doble toque (`turno.ts`). Si la lectura se guarda y no es NORMAL, se crea la alerta con el `id_medico` **asignado al paciente** (como el web: el correo va al médico del paciente, que puede no ser quien registra). Si la alerta falla, la lectura **no se repite**: se avisa que quedó guardada sin alerta.
- **Textos para el médico.** «Lectura baja/alta registrada por el médico para <paciente>», no «Tu glucosa está baja». Los errores (red, tiempo, 400, 5xx) usan los mensajes genéricos de `http.ts` (nunca el texto de la excepción del backend); ante un fallo sin respuesta clara (red, tiempo, 5xx) se añade que **la lectura pudo haberse guardado** y que conviene revisar el historial antes de reintentar.
- **Después de guardar** vuelve al detalle del paciente, que recarga su historial.
- **Modo simulado:** `registrarGlucosaMedico` no llama a la red con `EXPO_PUBLIC_USE_MOCK=true`.
- **Pendiente para el backend (CONTEXT.md § Hallazgos para Adrian):** marca de origen explícita, validar la pertenencia del paciente, tipar los campos, rechazar `nivel_glucosa` 0 y generar la alerta en el servidor. Las lecturas con `id_medico` no nulo son del médico: dato para la decisión del ML.

### Riesgo de hipoglucemia en la pantalla del médico (TASK-017g, ADR-0011)
Solo `mobile/`. **No cambia el backend ni el contrato del ML.** Lee la clave aditiva `riesgo_ml` que `POST /api/medicos/registrar/glucosa` devuelve solo si el backend tiene `ML_ENABLED=true` (forma en `docs/ml/integracion_backend_ml.md` §10 y §10.1).

- **Servicio (`services/riesgoMl.ts`, puro).** `leerRiesgoMl(crudo): RiesgoMl | null`, defensivo y que **nunca lanza**: ausencia, `null` o forma inválida (no objeto, arreglo) → `null` (sin UI de riesgo); `riesgo_hipoglucemia` no numérico, no finito, booleano o fuera de [0, 1] → motivo `no_disponible`; `0` y `1` exactos son válidos; campos desconocidos se ignoran; `faltantes` ausente → `[]` (backend anterior a la Fase ML-1b). `version_modelo`, `supuestos` y `faltantes` se sanean: solo `[A-Za-z0-9._+-]` en la versión (hasta 20 caracteres, si no, se omite), códigos `[a-z0-9_]` de hasta 40 caracteres, sin repetidos y hasta 8 elementos, descartando lo que no sea texto. Un motivo, supuesto o faltante desconocido se muestra con **texto genérico**.
- **Probabilidad.** `riesgo_hipoglucemia` es una **probabilidad de 0 a 1** (contrato del `ml_service`: `0 <= riesgo <= 1`, 4 decimales). Se muestra como porcentaje con **1 decimal y coma** (`0.1712` → «17,1 %»). **Sin categorías, semáforos, colores de alarma ni umbrales** de bajo/medio/alto: no hay umbral clínico validado.
- **Integración con el registro.** `registrarGlucosaMedico` devuelve `{id_registro, riesgoMl}`; la lectura de `riesgo_ml` va en un `try/catch` propio: **el registro no puede fallar por culpa de `riesgo_ml`**. `registrarTomaMedico` añade `riesgoMl` a `ResultadoToma` **solo cuando no es `null`** (las claves existentes no cambian). Las alertas se siguen decidiendo solo por la clasificación de glucosa.
- **Pantalla.** En el modal «Toma registrada» de `RegistroTomaMedico`, **debajo** del mensaje del resultado (si la alerta falló, ese aviso va primero y el bloque no lo tapa), un bloque «Estimación de riesgo de hipoglucemia (experimental)» (`RiesgoMlBloque`). **Estado actual de la pantalla (simplificada a mano por el autor tras la Fase ML-2):** con riesgo muestra el título, el porcentaje, la versión del modelo y la leyenda fija; sin riesgo muestra solo el título y la leyenda. **No muestra el motivo, los faltantes ni los supuestos** (siguen llegando, se leen y se sanean en `riesgoMl.ts`, pero la pantalla no los pinta). Siempre lleva la **leyenda fija**: «Modelo experimental, no validado clínicamente. Es solo orientativo y no sustituye el criterio del médico.» (sin la palabra «demo»). El modal admite contenido adicional con desplazamiento para que los botones queden visibles en 360 dp. Usa `useMedidas`/`medidas.ts` y no desborda en 360 y 412 dp. **Accesibilidad:** la etiqueta del bloque (`resumenAccesible`) todavía incluye el motivo cuando no hay riesgo, de modo que un lector de pantalla lo leería aunque no se vea (pendiente de decidir junto con la Decisión abierta de CONTEXT.md).
- **Alcance.** Solo esa vista del médico: el riesgo **no se guarda, no se vuelve a mostrar** al salir, no aparece en pantallas del paciente ni en el historial y no se envía al chatbot. No se registra en logs ni el valor ni el id del paciente.
- **Textos (definidos en `riesgoMl.ts` y probados, pero hoy NO mostrados: solo se usan en la etiqueta de accesibilidad y quedan listos si el equipo restituye motivo, faltantes y supuestos).** Motivos: `no_aplica_tipo` «No aplica: la estimación se calcula solo para pacientes con diabetes tipo 2»; `datos_insuficientes` «Faltan datos del paciente para estimar el riesgo» + faltantes (`genero` «género», `edad` «edad», `imc` «IMC (peso o altura)», `medicacion` «tratamiento», `glucosa` «valor de glucosa», `paciente` «datos del paciente»); `momento_no_cubierto` «La estimación solo cubre mediciones en ayunas o después de comer»; `no_disponible` «La estimación no está disponible en este momento». Supuestos: `duracion_estimada` «Duración de la diabetes estimada, no registrada»; `comorbilidades_no_capturadas` «Sin comorbilidades capturadas»; `hba1c_no_disponible` «Sin HbA1c».
- **Modo simulado.** `registrarGlucosaMedico` devuelve de forma determinista un caso según la **última cifra** del valor de glucosa ingresado (0 → sin `riesgo_ml`, ML apagado; 1 → con riesgo y supuestos; 2 → un faltante; 3 → varios faltantes; 4 → `datos_insuficientes` sin faltantes; 5 → `no_aplica_tipo`; 6 → `momento_no_cubierto`; 7 → `no_disponible`; 8 → riesgo 0; 9 → riesgo 1); el dato simulado pasa por el mismo `leerRiesgoMl`. Documentado en `mobile/README.md`.
- **`testID` existentes:** `ml-riesgo-bloque`, `ml-riesgo-valor` (solo con riesgo), `ml-riesgo-version` (solo con riesgo y versión válida) y `ml-riesgo-leyenda`. **Ya no existen** (retirados con la simplificación): `ml-riesgo-motivo`, `ml-riesgo-faltantes` y `ml-riesgo-supuestos`.
- **Decisión abierta:** sin motivo ni supuestos en pantalla, el médico no ve las limitaciones del cálculo (duración estimada, comorbilidades no capturadas, falta de HbA1c, por qué no hay valor); decidir con el equipo si se restituyen (CONTEXT.md § Open questions).
- **Pendiente:** redacción definitiva de la leyenda por el equipo clínico; ningún umbral de interpretación hasta que exista validación.

### Pantallas simuladas (siguen con `mockData.ts`)
Tras la Fase Móvil 4 **no queda ninguna pantalla simulada**: login, paciente, médico y administrador están conectados. Lo que no tiene endpoint en el backend queda **deshabilitado con aviso** (rechazar solicitudes, cambiar rol o estado de un usuario, desactivar, eliminar, exportar la auditoría, descargar el PDF del reporte) y no cuenta como simulado. Siguen siendo estáticos dos elementos sin fuente real: el botón "Ver Guía" del protocolo de glucemia (médico) y el punto de notificaciones del encabezado (solo en modo simulado, `EXPO_PUBLIC_USE_MOCK=true`). `mockData.ts` solo alimenta ese modo. Sin banners visibles (pendiente de decisión del equipo).

### Modo simulado (`EXPO_PUBLIC_USE_MOCK=true`)
Restaura las credenciales fijas y los botones de acceso rápido por rol, para demostrar sin backend. Por defecto está apagado. En ese modo los cuatro flujos conectados no llaman a la red: login, registro, historial y chatbot usan datos locales.

### Pruebas
`node --test` (Node ≥ 22.18, extracción de tipos nativa, sin dependencias nuevas) sobre `clasificacionGlucosa.ts` y los módulos puros de `services/`. `npx tsc --noEmit` y `npx expo export` comprueban el tipado y que el bundle compila sin dispositivo. El OTP por correo y el registro real de glucosa no se pueden probar sin celular y sin Supabase real.

### Identificadores de prueba (`testID`)
Estables y en español en las pantallas conectadas (login, registro, chat, mensajes de error), para pruebas de interfaz; la lista vive en `mobile/README.md`. No alteran el diseño ni la lógica.

## Pruebas E2E y interruptor de OTP (TASK-068 a TASK-070, ADR-0012)
Rama `feature/pruebas-e2e`. **Backend de Adrian: cambios mínimos, aditivos y con el comportamiento actual por defecto.**

### Interruptor de OTP (backend)
- `OTP_ACTIVADO` (`core/config.py`, por defecto `true`, leído con `_bool_env`). Con `true`, `POST /api/login` responde como siempre: `{id_usuario, id_rol, message: "OTP enviado al correo"}` y envía el OTP.
- Con `false`: mismas validaciones y mismos 401/500; **no** genera OTP ni envía correo y responde `{id_usuario, id_rol, rol, message}` (`rol` es el texto del backend: `paciente`, `medico` o `administrador`). `POST /api/verify-otp` no cambia.
- **Aviso al arrancar:** `main.py` (función `avisar_otp_desactivado`, ejecutada en el `lifespan`) registra un WARNING si `OTP_ACTIVADO=false`.
- **Configuración:** `OTP_ACTIVADO=true` en `backend/.env.example` y en `docker-compose.yml` (servicio `backend`, `environment`); `OTP_ACTIVADO: "false"` **solo** en `docker-compose.prueba.yml`. Prueba automática en `backend/tests/test_aislamiento.py`: ningún compose principal ni `.env.example` fija `false`.

### Login de la app con y sin OTP
- `iniciarSesion` devuelve `{id_usuario, sesion?}`: `sesion` solo si la respuesta trae `id_rol` (> 0) y `rol` (uno de los tres textos del backend); un `rol` desconocido o un `id_rol` ≤ 0 es un error (`MENSAJES.respuesta` o «No se encontró tu perfil…»). Sin `rol` sigue el flujo con OTP (`verificarOtp`). Sin cambios de `testID`.
- **Modo simulado:** sin `EXPO_PUBLIC_SIN_OTP` (o con cualquier valor distinto de `false`) conserva el acceso directo y los accesos rápidos de siempre. Con `EXPO_PUBLIC_SIN_OTP=false` y `EXPO_PUBLIC_USE_MOCK=true` el login simula el paso del OTP (credenciales fijas del README, código `123456`). Con el backend real la variable no tiene efecto.

### Recorridos de Maestro (`mobile/.maestro/`)
- **Cómo se abre la app:** con Expo Go no se usa `launchApp` con un appId propio (la documentación de Maestro para React Native lo dice: la app corre dentro del contenedor de Expo). Los flujos declaran `appId: host.exp.exponent` (paquete de Expo Go en Android) y abren la app con `openLink` y la URL `exp://<IP de la PC>:8081` pasada por la variable `EXPO_URL` (nunca escrita en el repositorio). Las pantallas propias de Expo Go (menú de desarrollo, aviso de primera vez) se descartan con `runFlow` + `when: visible`. Más adelante, con un APK propio, bastaría `launchApp` con su paquete.
- **Estructura:** `config.yaml`, `flows/simulado/` (suite A), `flows/real/` (suite B, solo lectura), `subflows/` (abrir la app, cerrar sesión, iniciar sesión por rol), `scripts/` (PowerShell), `reports/` y `screenshots/` (ignoradas por git).
- **Suite A (simulado, escribe de mentira):** login de paciente; registrar glucosa normal y baja (con aviso de alerta); historial; chatbot; login de médico, pacientes y detalle; el médico registra una toma por el paciente con el bloque de riesgo (la última cifra de la glucosa elige el caso: ver `mobile/README.md`); el médico responde una alerta; administrador (solicitudes, detalle, activar simulado, auditoría); formularios de registro con validaciones sin enviar; login con OTP simulado (etiqueta `otp`, requiere `EXPO_PUBLIC_SIN_OTP=false`).
- **Suite B (backend real local con `docker-compose.prueba.yml`, SOLO LECTURA):** login con un usuario de prueba (credenciales por `-e`), historial o lista y detalle, y el chatbot con el proveedor falso. **Prohibido** registrar, activar, editar o responder alertas.
- **Bloque de riesgo:** `ml-riesgo-bloque` y `ml-riesgo-leyenda` con y sin riesgo; `ml-riesgo-valor` y `ml-riesgo-version` solo con riesgo; sin `riesgo_ml` (ML apagado) el bloque no existe. Los `testID` `ml-riesgo-motivo`, `-faltantes` y `-supuestos` no existen y no se usan.
- **`testID` nuevos (barra de pestañas y encabezado):** `nav-<pestana>` (`nav-inicio`, `nav-historial`, `nav-chatbot`, `nav-perfil`, `nav-pacientes`, `nav-alertas`, `nav-reportes`, `nav-solicitudes`, `nav-usuarios`, `nav-auditoria`), imprescindibles para cerrar sesión y navegar; no cambian los existentes.
- **Conexión (receta del equipo):** Metro con `npx expo start -c --port 8081` (sin `--localhost`); la app se abre con la URL manual `exp://<IP de la PC>:8081` (la autodetección de Expo Go dejó un spinner infinito); backend y chatbot por USB con `adb reverse tcp:8000 tcp:8000` y `adb reverse tcp:8001 tcp:8001`, con `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000` y `EXPO_PUBLIC_NLP_URL=http://127.0.0.1:8001`. Los scripts reciben la URL por parámetro o detectan la IPv4 de la PC al ejecutar, sin guardarla; comprueban `GET /status` de Metro y `adb devices` antes de lanzar Maestro.
- **Documentación:** `docs/e2e.md` (requisitos, ejecución, reportes, limitaciones de Expo Go, paso a APK).
- **No verificable sin teléfono ni Maestro:** que los flujos pasen, el manejo real de las pantallas de Expo Go y los tiempos de carga.

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
│   │   ├── utils/           # Colores, tipografía y mockData.ts (datos simulados de las pantallas aún no conectadas)
│   │   └── services/        # Capa de servicios (§ App móvil: integración): config.ts, http.ts, sesion.ts, auth.ts, glucosa.ts, clasificacionGlucosa.ts, chatbot.ts y pruebas (*.test.ts). API_BASE_URL backend, NLP_API_BASE_URL servicio NLP
│   ├── .env.example         # EXPO_PUBLIC_API_URL, EXPO_PUBLIC_NLP_URL, EXPO_PUBLIC_USE_MOCK (valores de ejemplo; el .env real no se versiona)
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
- [x] **Rango «en rango» de la app:** el usuario decidió 70-180 mg/dL (consenso de tiempo en rango) para paciente y médico, centralizado en `mobile/src/services/umbrales.ts` (Fase Móvil 5). **Sigue abierto** si ese rango debe depender de la edad o la condición (embarazo, niños), y la revisión clínica de los rangos por edad y tipo del port de `glucosa.service.ts`.
- [ ] **Clasificación de glucosa en el cliente (app móvil y front web):** el equipo decidió clasificar en el cliente con el servicio de glucosa del front web, que usa rangos por edad y tipo distintos de `docs/nlp/umbrales_ada_v1.json` y no valida el backend. ¿Se unifica después con `reglas_ada.py` (TASK-012a) y se corrigen las rarezas (tipo `Normal` → `PARAM_INVALIDO`, mínimos de embarazo sin uso, edad < 6)? Ver § App móvil: integración.
- [x] **Perfil y nombre del usuario en la app:** `POST /api/verify-otp` solo devuelve ids y rol. **Resuelta para el paciente (Fase Móvil 2):** se carga `GET /api/pacientes/perfil/{id}`. Sigue pendiente para médico y administrador.
- [ ] **Administración sin autenticación y acciones faltantes:** `activar` acepta cualquier `idAdmin`, no hay endpoints para rechazar, desactivar, editar o eliminar usuarios, los solicitantes no traen fecha de solicitud y `/general/auditoria` no pagina. Ver § Fase Móvil 4.
- [ ] **Registro de médico: estado pendiente y validación:** `POST /medicos/registrar` no guarda `estado` ni `fecha_solicitud` (el front web los envía), no valida antes de subir los archivos y no es transaccional; además `responder/alerta` no es idempotente y `misPacientes` carga lecturas que descarta (y no trae `historial`). Ver § Fase Móvil 3.
- [ ] **Registro de paciente: foto y estado de la cuenta:** `registrarPaciente` exige foto y sube el archivo antes de validar el resto; además no hay estado "pendiente de aprobación" visible, aunque la pantalla promete revisión de un administrador. ¿Se ajusta el backend (validar antes de subir, foto opcional, cuenta inactiva hasta aprobar) o el texto de la app?
- [ ] **`actualizarPaciente`:** exige los siete campos aunque solo cambie uno, e inserta un seguimiento de embarazo nuevo en cada llamada con semanas; el equipo debería permitir actualizaciones parciales.
- [ ] **Reglas de teléfono:** la app usa 7 a 8 dígitos; ¿es la regla definitiva del producto?
- [ ] **Transporte en producción de la app:** en desarrollo la app usa `http://` a la IP de la PC; en producción hace falta HTTPS (Android bloquea tráfico en claro en compilaciones de lanzamiento). Pendiente con TASK-002.
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
| 1.8.0 | 2026-10-26 | Fase Móvil 1 (TASK-031, TASK-032, TASK-021 a TASK-024, TASK-033): nueva sección "App móvil: integración con el backend" (capa de servicios, URLs `EXPO_PUBLIC_*`, sesión sin token en `expo-secure-store`, flujos conectados y pantallas simuladas, modo `EXPO_PUBLIC_USE_MOCK`). Decisión del equipo de **clasificar la glucosa en el cliente** (desviación declarada de § Clasificación ADA del backend; riesgos y tres rarezas del servicio original portadas tal cual). Hallazgo: el contrato del NLP no admite contexto clínico, solo `{texto}`. Estructura de archivos y Open Questions actualizadas. Sin cambios en backend, NLP ni ML ni en Data Models. |
| 1.9.0 | 2026-10-27 | Fase Móvil 2 (TASK-034 a TASK-039): se conectan las pantallas del paciente (Inicio, Perfil y ficha clínica, edición y solicitud de registro de paciente). Cierra el hallazgo de la URL con `/api` (`config.ts` lo tolera; documentado), 404 distinguido (ruta vs recurso) y registro de desarrollo sin datos sensibles. Contrato real de perfil, actualizarPaciente, registrarPaciente y catálogos, con diferencias frente al front web y hallazgos del backend (foto obligatoria y subida antes de validar, `actualizarPaciente` exige los siete campos, sin estado pendiente visible). Nueva dependencia `expo-image-picker`. Open Questions actualizadas. Sin cambios en backend, NLP ni ML ni en Data Models. |
| 1.10.0 | 2026-10-28 | Fase Móvil 3 (TASK-040 a TASK-047): se conectan las pantallas del médico (pacientes, detalle, alertas activas y resueltas con respuesta, reportes, perfil y edición, solicitud de registro de médico con matrícula en PDF y carnet en imagen). Contrato real de perfil, misPacientes, alertas, responder, actualizar, registrar y especialidades, con diferencias frente al front web y hallazgos del backend (sin `historial` ni lecturas en misPacientes, `registrar` no guarda estado pendiente, `responder` no idempotente). Decisiones del usuario: PDF del reporte para después, `expo-document-picker` (nuevo), límites PDF 5 MB e imagen 2 MB, estado de la lista con alertas activas. Fuera de la fase: administrador y ML. Sin cambios en backend, NLP ni ML ni en Data Models. |
| 1.11.0 | 2026-10-29 | Fase Móvil 4 (TASK-048 a TASK-054): se conectan las pantallas del administrador (solicitudes de pacientes y médicos, detalle con documentos y activación, usuarios activos e inactivos, auditoría con carga parcial y datos enmascarados, perfil). Contrato real de los endpoints de `administradores` y de `/general/auditoria`, con diferencias frente al front web y hallazgos del backend (activar sin autenticación, sin rechazar/desactivar/editar/eliminar, sin fecha de solicitud, auditoría sin paginar). Las acciones sin endpoint quedan deshabilitadas con aviso; no queda ninguna pantalla simulada. Sin dependencias nuevas. Sin cambios en backend, NLP ni ML ni en Data Models. |
| 1.12.0 | 2026-10-30 | Fase Móvil 5 (TASK-055 a TASK-060): cierre de pendientes de la app antes de ML y chatbot. Umbrales clínicos en un solo módulo con **70-180 mg/dL como rango oficial** (decisión del usuario); PDF del reporte del médico generado en el dispositivo (`expo-print` + `expo-sharing`) en lugar de `POST /api/paciente/pdf`; retirada de restos estáticos (`ConfiguracionMenu`, banner de protocolo, exportar, versión falsa); módulo de medidas y escalado con ancho máximo, zona segura y límite de fuente; robustez de sesión, red, doble envío, teclado y accesibilidad; aviso de registro con fallo parcial. Sin cambios en backend, NLP ni ML. |
| 1.13.0 | 2026-10-31 | Fase Chatbot-Front (TASK-061 a TASK-066): efecto de escritura de presentación (`revelado.ts`, `CHAT_ANIMACION`, aviso médico siempre completo), retiro de lo falso del chat (guía de carbohidratos, dictado, «leído», «personalizada»), accesibilidad y vistas, `testID` normalizados (`normalizarTestId`) y recomendación «2 horas» solo después de comer (decisión del usuario). Sin cambios en el contrato del NLP ni en el backend. |
| 1.14.0 | 2026-11-01 | Registro de glucosa por el médico (TASK-067): pantalla `RegistroTomaMedico` desde el detalle del paciente, `registrarGlucosaMedico` (`POST /api/medicos/registrar/glucosa`), clasificación en el cliente, alerta atribuida al médico asignado con texto para el médico y aviso de lectura posiblemente guardada. Sin cambios en el backend. |
| 1.15.0 | 2026-11-02 | Fase ML-1 (TASK-017, ADR-0011): integración backend ↔ ML en el registro de glucosa del médico: `riesgo_ml` aditivo (con motivos y supuestos), regla tipo 2, duración por defecto de 6,5 años (mediana del conjunto sintético, estimada), cliente `httpx` aislado con timeout, `ML_ENABLED` apagado por defecto, `ML_MODELO=demo` en Compose y versión del modelo sintético `1.1.0`. Sin cambios de esquema ni del contrato público del ML. |
| 1.15.1 | 2026-11-03 | Fase ML-1b (TASK-017i): `riesgo_ml.faltantes` (códigos de los datos que impidieron calcular) y línea de log por cálculo, sin datos personales. Aditivo; sin cambios en el ML ni en el esquema. |
| 1.16.0 | 2026-11-03 | Fase ML-2 (TASK-017g, ADR-0011): pantalla del médico con el riesgo de hipoglucemia (`riesgoMl.ts`, `RiesgoMlBloque`, modal con contenido adicional, modo simulado por última cifra). Solo `mobile/`; sin cambios en el backend ni en el ML. |
| 1.16.1 | 2026-11-03 | Alineación documental de la Fase ML-2 con la pantalla simplificada: el bloque ya no muestra motivo, faltantes ni supuestos (testIDs retirados) y queda una Decisión abierta. Sin cambios de código. |
| 1.17.0 | 2026-11-04 | Fase E2E (TASK-068 a 070, ADR-0012): interruptor `OTP_ACTIVADO` (login sin OTP solo en `docker-compose.prueba.yml`), login de la app con ambos caminos y `EXPO_PUBLIC_SIN_OTP` en modo simulado, recorridos de Maestro en `mobile/.maestro/`, `testID` `nav-*` y `docs/e2e.md`. Cambios mínimos y aditivos en el backend de Adrian. |
| 1.4.1 | 2026-10-24 | Respuestas del equipo a M1: ADR-0008 (servicio de ML independiente; reemplaza a ADR-0001 para el ML). JSON de metadatos del modelo versionado en git, con la huella del `.pkl` dentro (`sha256_pkl`) y sus campos definidos. Open Question del perfil clínico ampliada con 4 opciones; bloquea TASK-017, no el servicio de ML. Sin cambios en Data Models. |
