# design.md
> GlucoTracker — Version 1.4.6 — 2026-10-24

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
- **Configuración del servicio** (solo nombres, ver `.env.example`): `ML_ARTEFACTOS_DIR` (carpeta de los artefactos; por defecto `app/artefactos/`), `ML_LOG_LEVEL` y `ML_ENABLE_DOCS` (por defecto `false`). Puerto de desarrollo 8002.
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
│   │   ├── models/             # Esquemas / ORM
│   │   └── core/                # Config, seguridad, conexión a Supabase
│   │       └── reglas_ada.py   # Clasificación ADA Normal/Hipo/Hiper (lógica de negocio, no ML) + constantes propias
│   ├── tests/               # Pruebas del backend (incluirá el contrato de reglas_ada.py vs docs/nlp/umbrales_ada_v1.json); las de ML pasaron a ml_service/tests/
│   ├── requirements-dev.txt # Dependencias de pruebas del backend (pytest)
│   ├── requirements.txt     # Solo del backend
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
│   │   │   ├── exportar_dataset.py # Utilidad opcional: exporta el dataset limpio a data/dataset_inputs_hipoglucemia.csv
│   │   │   └── artefactos/     # modelo_hipoglucemia.pkl (fuera de git) + modelo_hipoglucemia.json (metadatos, en git) + cv_metrics.json (salida de cv_evaluacion.py, solo agregados, en git) + baseline_metrics.json
│   │   ├── data/raw/           # ShanghaiT2DM_Summary.xlsx (movido con git mv desde backend/data/raw/)
│   │   ├── tests/              # pytest: preparación de features, predicción con modelo sintético, metadatos, huella, aislamiento, logs, cv_evaluacion (sin red ni Excel real)
│   │   ├── requirements.txt    # Versiones exactas (incluidas numpy, scipy, imbalanced-learn, joblib, openpyxl)
│   │   ├── requirements-dev.txt
│   │   ├── .env.example        # Solo nombres de variables
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

### Servicio de ML (`POST /api/riesgo/hipoglucemia`)
- **No público (ML-D8):** solo tráfico de la red interna desde el backend, sin ingreso público ni CORS; la app no lo llama. El mecanismo de autenticación entre servicios es una Open Question.
- **No registrar valores clínicos** (glucosa ni perfil) en logs, prints, excepciones ni `detail` de errores (NFR-001). El 422 usa un mensaje genérico propio.
- **Minimización:** el backend le envía solo la lectura y el perfil clínico, nunca nombre, correo ni ids.
- **Integridad del artefacto:** antes de predecir se verifican la huella SHA-256 del `.pkl` y las versiones de librerías contra el JSON de metadatos; si no coinciden, responde 503 (RT-06).
- **Sin efecto clínico automático:** la probabilidad es informativa y no dispara alertas hasta la calibración (ML-D4, REQ-004). Las alertas las decide la clasificación ADA del backend (REQ-005).

## Open Questions
- [ ] ¿Qué esquema de autenticación se usará (JWT, sesiones con Supabase Auth, OAuth)? El documento original no lo especifica.
- [x] ¿El modelo de ML (SVC vs Árbol de Decisión) ya está entrenado y con qué dataset, o se entrena como parte de este proyecto? — **Resuelta (2026-10-24):** se entrena en el proyecto con ShanghaiT2DM (`docs/data_ecosystem.md`). Es una Regresión Logística con SMOTE-NC (ADR-0007, reemplaza a ADR-0004), reproducible con `train_baseline.py`, y estima la probabilidad de hipoglucemia observada en el registro (REQ-004 v1.1.0).
- [ ] **Perfil clínico para el ML (sin lugar en Data Models):** el contrato del servicio de ML necesita género, edad, BMI, años de diabetes, categoría de medicación, seis comorbilidades y HbA1c (opcional). § Data Models no tiene esos campos: T_Paciente solo tiene `actividad_fisica` y `enfermedades_base`. ¿Dónde y cómo se capturan?
  - **Bloquea TASK-017** (el backend no tiene de dónde armar la llamada al servicio de ML). **No bloquea el servicio de ML** (TASK-010a/b, TASK-011a–e): su contrato recibe el perfil en cada petición y no depende de cómo lo persista el backend.
  - Opciones, sin resolver:
    1. **Ampliar T_Paciente** con columnas propias: género, fecha de nacimiento (la edad se deriva), peso y talla o BMI, año de diagnóstico, categoría de medicación, banderas de comorbilidad, último HbA1c y su fecha. Es lo más simple, pero sobrescribe el perfil anterior y pierde el historial: un cambio de medicación borra el valor que se usó en predicciones pasadas.
    2. **Tabla nueva `T_Perfil_clinico`** (N—1 con T_Paciente, con `vigente_desde`): conserva el historial y permite saber qué perfil estaba vigente en cada registro. Es más compleja de mantener y de presentar en la app.
    3. **Instantánea por predicción**: guardar junto al registro (o en una tabla de predicciones) el perfil exacto enviado al modelo. Da trazabilidad y reproducibilidad completas, a cambio de duplicar datos clínicos sensibles (NFR-001). Es complementaria a la 1 o la 2.
    4. **Sin persistir**: la app envía el perfil con cada lectura y el backend solo lo reenvía. No requiere cambios de esquema, pero el paciente tendría que reingresarlo, el médico no lo ve y no hay trazabilidad.
  - También hay que definir quién carga y actualiza el perfil (paciente, médico o ambos) y cómo se mapea `enfermedades_base` (texto libre) a las banderas de comorbilidad.
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
| 1.4.1 | 2026-10-24 | Respuestas del equipo a M1: ADR-0008 (servicio de ML independiente; reemplaza a ADR-0001 para el ML). JSON de metadatos del modelo versionado en git, con la huella del `.pkl` dentro (`sha256_pkl`) y sus campos definidos. Open Question del perfil clínico ampliada con 4 opciones; bloquea TASK-017, no el servicio de ML. Sin cambios en Data Models. |
