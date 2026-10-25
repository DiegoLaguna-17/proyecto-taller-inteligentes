# GlucoTracker

## 1. Resumen del proyecto

GlucoTracker es una plataforma de monitoreo y análisis inteligente de glucosa dirigida a pacientes y médicos, construida bajo un enfoque de *Spec Driven Development* (ver `requirements.md`, `design.md` y `tasks.md` en la raíz del repositorio). El sistema registra y centraliza mediciones de glucosa, y ofrece dos componentes de Inteligencia Artificial complementarios (ver `docs/product_goal.md`):

- **Modelo de riesgo de hipoglucemia (ML):** un modelo de Regresión Logística (ADR-0007) que estima, a partir de una lectura de glucosa y el perfil clínico del paciente, la probabilidad de hipoglucemia observada en el registro (REQ-004). Es **informativa**, visible solo al médico, y **no dispara alertas**. Es un modelo **experimental**: la validación cruzada muestra que no supera el azar con los datos disponibles (`docs/model_baseline.md` §4.1). Vive en el servicio independiente `backend/ml_service/`, sin ingreso público y llamado solo por el backend (ADR-0008); el backend de negocio no contiene código de ML. No clasifica lecturas: la clasificación Normal/Hipo/Hiper con umbrales ADA, que es la que dispara las alertas al médico, está **especificada** en la lógica de negocio del backend (`backend/app/core/reglas_ada.py`, TASK-012a; `design.md` § Clasificación ADA) y **aún no está implementada** (ver `docs/model_baseline.md`).
- **Chatbot educativo (NLP):** un asistente conversacional para consultas de pacientes sobre diabetes tipo 2, basado en inyección de contexto (system prompting) sobre un LLM externo (Gemini), con alcance restringido a hipoglucemia y metas básicas de control glicémico. Corre como **servicio independiente** en `backend/nlp_service/` (ver `docs/nlp/` y `docs/adr/0006-nlp-servicio-independiente.md`).

El backend de negocio es un monolito modular en FastAPI/Python (`backend/app/`: login con OTP por correo, médicos, pacientes, administradores, registros de glucosa, alertas manuales, auditoría y reporte PDF), con persistencia en Supabase/PostgreSQL. **Hoy no emite ni comprueba tokens** (ningún endpoint exige autenticación; ver `design.md` § Estado real del backend de negocio y `docs/risks.md`), y la clasificación ADA que dispara las alertas está especificada y pendiente (TASK-012a). El chatbot (`backend/nlp_service/`) y el modelo de ML (`backend/ml_service/`) son servicios FastAPI aparte, con dependencias y configuración propias y sin acceso a la base de datos. Los tres tienen despliegue previsto en Azure. El cliente es una app móvil en React Native (`mobile/`), que llama a cada servicio con su propia URL base. Ver las decisiones de arquitectura completas en `docs/adr/` y los diagramas C4 en `docs/architecture/`.

## 2. Tecnologías utilizadas

Tabla basada exclusivamente en lo que está configurado o implementado en el repositorio (dependencias declaradas, código fuente y ADR aceptados). Las filas marcadas como *pendiente de confirmación* corresponden a Open Questions documentadas — ver la subsección siguiente para el detalle.

| Categoría | Tecnología | Uso en el proyecto |
|---|---|---|
| Lenguaje (backend) | Python | Implementación del backend y del módulo ML (`backend/app/`, `backend/requirements.txt`) y, a futuro, del servicio NLP (`backend/nlp_service/`, con `requirements.txt` propio) |
| Framework backend | FastAPI | Expone la API REST del backend de negocio (`backend/app/main.py`; ADR-0001) y, en servicios independientes, el endpoint de riesgo (`backend/ml_service/app/api/riesgo.py`; ADR-0008) y el chatbot (`backend/nlp_service/`; ADR-0006) |
| Servidor ASGI | Uvicorn | Ejecuta la aplicación FastAPI (`uvicorn app.main:app --reload`, `backend/requirements.txt`; `backend/ml_service/test_ml.sh` para el servicio de ML) |
| Validación de datos | Pydantic | Esquemas de entrada/salida del endpoint de riesgo de hipoglucemia (`backend/ml_service/app/api/riesgo.py`) |
| Base de datos | PostgreSQL (gestionado vía Supabase) | Persistencia de usuarios, pacientes, registros de glucosa y alertas (ADR-0002; `design.md` § Data Models) |
| Backend-as-a-Service | Supabase | Cliente `supabase` en `backend/requirements.txt`; variables `SUPABASE_URL` / `SUPABASE_KEY` en `backend/.env.example` |
| Autenticación (librerías presentes) | `passlib[bcrypt]`, `python-jose[cryptography]` | Declaradas en `backend/requirements.txt` para hashing de contraseñas y JWT, pero el esquema de autenticación final **no está confirmado** (ver Open Questions) |
| Machine Learning | scikit-learn | Modelo de Regresión Logística dentro de un `Pipeline`, implementado en `backend/ml_service/app/train_baseline.py` (ver `docs/model_baseline.md` y nota de evidencia más abajo) |
| Machine Learning — balanceo de clases | imbalanced-learn (SMOTE-NC) | Balanceo de clases dentro del `Pipeline` de entrenamiento, solo sobre el conjunto de train (`docs/model_baseline.md` §3, `backend/ml_service/requirements.txt`) |
| Procesamiento de datos | pandas, numpy | Limpieza clínica y construcción de features (`backend/ml_service/app/data_prep.py`) |
| Lectura de datos fuente | openpyxl | Lectura de `ShanghaiT2DM_Summary.xlsx` (`backend/ml_service/app/exportar_dataset.py`, `backend/ml_service/requirements.txt`) |
| Persistencia del modelo | joblib | Serialización de `backend/ml_service/app/artefactos/modelo_hipoglucemia.pkl` (`backend/ml_service/app/train_baseline.py`) |
| Generación de reportes | reportlab | Generación de reportes clínicos en PDF (REQ-008; `backend/requirements.txt`) |
| NLP / LLM | LLM externo vía system prompting; proveedor Gemini (SDK `google-genai`) con interfaz intercambiable (ADR-0005) | Servicio independiente `backend/nlp_service/` (ADR-0006), **en implementación**: configuración, proveedores, prompt y servicio listos; el endpoint queda para TASK-018 (ver `backend/nlp_service/README.md`). Inyecta el corpus `backend/nlp_service/app/corpus/reglas_ada_v1.1.txt` en el system prompt (`docs/nlp/adr_system_prompting_vs_rag.md`, `docs/nlp/corpus_conocimiento.md`). Su clave va en `backend/nlp_service/.env` (`NLP_PROVIDER_API_KEY`), no en el backend |
| Mobile — lenguaje | TypeScript | `mobile/App.tsx`, `mobile/src/services/api.ts` |
| Mobile — framework | React Native 0.75.4 + React 18.3.1 | App cliente del sistema (`mobile/package.json`) |
| Mobile — testing / linting | Jest, ESLint | Scripts `test` y `lint` de `mobile/package.json` |
| Cloud | Microsoft Azure | Plataforma oficial de despliegue del backend (ADR-0003) |
| Cloud — notificaciones push (referenciado, no confirmado) | Azure Notification Hubs | Mencionado en la propuesta del proyecto (antes figuraba la variable `AZURE_NOTIFICATION_HUB_CONNECTION_STRING` en `backend/.env.example`; ningún código la lee y se retiró); el servicio específico **no está confirmado formalmente** (ver Open Questions) |
| Control de versiones | Git / GitHub | Repositorio remoto en GitHub; flujo de revisión por Pull Request obligatorio (`docs/team_charter.md`) |
| Gestión de proyecto | ClickUp | Seguimiento de historias de usuario, riesgos y tareas del proyecto (`docs/clickup_estructura.md`) |

### Nota de evidencia — modelo de Machine Learning

`docs/adr/0004-modelo-clasificacion-baseline.md` (Árbol de Decisión / SVC) fue **reemplazado por `docs/adr/0007-regresion-logistica-baseline.md`**: Regresión Logística con SMOTE-NC, que es lo que implementa el código (`backend/ml_service/app/train_baseline.py`) y lo que documenta `docs/model_baseline.md`. El ADR-0004 se conserva solo como registro histórico, con una nota que remite al ADR-0007. La tabla anterior refleja lo implementado.

### Decisiones tecnológicas pendientes (Open Questions)

Documentadas formalmente en `design.md` § Open Questions y reflejadas también en `CONTEXT.md` § Open questions y `CLAUDE.md`:

| Tecnología documentada | Decisión pendiente | Dónde está la Open Question | Impacto sobre la tabla de tecnologías |
|---|---|---|---|
| Esquema de autenticación | ¿JWT, sesiones de Supabase Auth, u OAuth? | `design.md` § Open Questions, `CONTEXT.md` § Open questions, `docs/risks.md` (RT-01) | Las librerías `python-jose` y `passlib[bcrypt]` están instaladas, pero no puede listarse "JWT" como el mecanismo de autenticación confirmado del sistema |
| Proveedor de LLM del chatbot | **Cerrada:** Gemini con interfaz intercambiable (FakeProvider para pruebas; OpenAI diferido), decidido en `docs/adr/0005-proveedor-llm-chatbot.md` | `docs/adr/0005-proveedor-llm-chatbot.md`; Open Question del chatbot marcada como resuelta en `design.md` y `CONTEXT.md` | La tabla de tecnologías ya lista Gemini (SDK `google-genai`) como proveedor |
| Servicio de Azure para notificaciones push | ¿Azure Notification Hubs u otro servicio? | `design.md` § Open Questions, `CONTEXT.md` § Open questions | No hay variable ni código para notificaciones push en el backend actual; la decisión sigue sin confirmarse formalmente en `design.md` |
| Algoritmo de ML baseline | **Cerrada:** ADR-0004 (Árbol de Decisión/SVC) fue reemplazado por ADR-0007 (Regresión Logística + SMOTE-NC), que coincide con el código. El modelo es experimental: no supera el azar con los datos actuales | `docs/adr/0007-regresion-logistica-baseline.md`; `docs/model_baseline.md` §4.1 | La tabla de tecnologías lista scikit-learn e imbalanced-learn sin discrepancia entre documentos |
| Validación de matrícula médica | ¿Contra un registro externo o solo validación de formato? | `design.md` § Open Questions, `CONTEXT.md` § Open questions | No tiene impacto sobre tecnologías de la tabla (es una regla de negocio, no una elección de stack) |

## 3. Mapa de la documentación

Este README es un índice navegable y una guía de reproducción; el detalle completo de cada tema vive en su documento correspondiente dentro de `docs/`.

| Documento | Contenido | Ruta |
|---|---|---|
| Objetivo del producto | Declaración del Product Goal del proyecto | `docs/product_goal.md` |
| Priorización de casos | Comparación de casos de proyecto evaluados y decisión tomada | `docs/priorizacion_casos.md` |
| Team Charter | Roles, disponibilidad, canales, revisión de PR, reglas de uso de IA y Definition of Done | `docs/team_charter.md` |
| Estructura de ClickUp | Organización del workspace de gestión (espacios, listas, estados, campos) | `docs/clickup_estructura.md` |
| Métricas técnicas y KPIs | Puente de métricas técnica/negocio y criterios human-in-the-loop por historia de usuario (US-01 a US-08) | `docs/metrics.md` |
| Registro de riesgos | Riesgos técnicos, de datos y de IA, con mitigación y estado | `docs/risks.md` |
| ADR 0001 — Backend monolítico FastAPI | Justificación de la arquitectura de backend | `docs/adr/0001-backend-monolitico-fastapi.md` |
| ADR 0002 — Supabase/PostgreSQL | Justificación de la base de datos y BaaS | `docs/adr/0002-supabase-postgresql.md` |
| ADR 0003 — Despliegue en Azure | Justificación del proveedor cloud | `docs/adr/0003-despliegue-azure.md` |
| ADR 0004 — Modelo baseline de clasificación (**reemplazado por el ADR 0007**) | Registro histórico del Árbol de Decisión/SVC descartado | `docs/adr/0004-modelo-clasificacion-baseline.md` |
| ADR 0009 — Modelo de demo con datos sintéticos | Segundo modelo separado, entrenado con datos generados por reglas clínicas; sin cambio de contrato (la API no distingue el modelo) | `docs/adr/0009-modelo-demo-datos-sinteticos.md` |
| Generador de datos sintéticos (modelo de demo) | Reglas clínicas, distribuciones y esquemas del dataset sintético. Modelo de demo: aprende reglas del equipo, no la realidad | `docs/ml/generador_sintetico.md` |
| ADR 0007 — Regresión Logística + SMOTE-NC | Decisión vigente del algoritmo del modelo de riesgo | `docs/adr/0007-regresion-logistica-baseline.md` |
| ADR 0005 — Proveedor LLM del chatbot | Gemini con interfaz intercambiable; política de datos por tier | `docs/adr/0005-proveedor-llm-chatbot.md` |
| ADR 0006 — Servicio NLP independiente | Por qué el chatbot sale del monolito a `backend/nlp_service/` | `docs/adr/0006-nlp-servicio-independiente.md` |
| C4 — Contexto del sistema | Diagrama de actores y sistema (Nivel 1) | `docs/architecture/c4_context.md` |
| C4 — Contenedores | Diagrama de contenedores de software (Nivel 2) | `docs/architecture/c4_container.md` |
| Ecosistema de datos | Inventario de fuentes, privacidad/licenciamiento y resumen del EDA del componente ML | `docs/data_ecosystem.md` |
| Línea base del modelo ML | Pipeline reproducible, justificación del modelo, métricas y limitaciones | `docs/model_baseline.md` |
| ADR — System Prompting vs. RAG | Justificación arquitectónica del enfoque del chatbot | `docs/nlp/adr_system_prompting_vs_rag.md` |
| Corpus de conocimiento del chatbot | Inventario y versionado del corpus inyectado en el system prompt | `docs/nlp/corpus_conocimiento.md` |
| Línea base del chatbot (NLP) | Metodología de evaluación, Golden Dataset y métrica de Tasa de Adherencia Clínica | `docs/nlp/baseline_chatbot.md` |

## 4. Reproducción del componente ML — riesgo de hipoglucemia

Pasos concretos para reproducir el entrenamiento del modelo y levantar el endpoint que lo expone, tal como están documentados en `docs/model_baseline.md` y en `backend/app/test_ml.sh`.

> **Dónde vive el ML:** el entrenamiento, la validación cruzada, la inferencia y el endpoint `POST /api/riesgo/hipoglucemia` están en el servicio `backend/ml_service/`, con su propio venv y sin ingreso público (ADR-0008); su README tiene la guía completa. El backend de negocio (`backend/app/`) no contiene código de ML. El modelo **no** clasifica Normal/Hipo/Hiper: eso es la clasificación ADA especificada en `backend/app/core/reglas_ada.py` (TASK-012a), aún no implementada.

### 4.1 Requisitos previos

- Python 3.13 (versión con la que se fijaron y verificaron las dependencias del servicio de ML).
- El dataset fuente ya presente en `backend/ml_service/data/raw/ShanghaiT2DM_Summary.xlsx` (ver `docs/data_ecosystem.md` para su origen y licencia).

### 4.2 Clonar el repositorio e instalar dependencias

```bash
git clone <URL-del-repositorio>
cd proyecto-taller-inteligentes/backend/ml_service
python -m venv .venv && source .venv/Scripts/activate   # Windows (Git Bash); el entorno es propio del servicio
pip install -r requirements-dev.txt
```

El backend principal tiene su propio `backend/requirements.txt` y entorno.

### 4.3 Entrenar el modelo baseline

```bash
python -m app.train_baseline        # desde backend/ml_service/
```

Este comando genera en `app/artefactos/` el modelo (`modelo_hipoglucemia.pkl`, fuera de git), sus metadatos con la huella y las versiones (`modelo_hipoglucemia.json`, en git) y `baseline_metrics.json`, sin pasos manuales ni notebooks intermedios (ver `docs/model_baseline.md` §1).

### 4.4 Levantar el servicio de ML

```bash
uvicorn app.main:app --env-file .env --port 8002   # desde backend/ml_service/
```

Verificación rápida de que el servicio está activo (informa si el modelo está cargado y verificado):

```bash
curl http://localhost:8002/health
```

El backend de negocio se levanta aparte, desde `backend/` con su propio entorno (`uvicorn app.main:app --reload`, puerto 8000).

### 4.5 Probar el endpoint de riesgo

El endpoint es `POST /api/riesgo/hipoglucemia` del servicio de ML (`backend/ml_service/app/api/riesgo.py`). Devuelve `riesgo_hipoglucemia` (0 a 1) y `version_modelo`; la probabilidad es **solo informativa**, visible solo para el médico, y no dispara alertas. Contrato completo en `design.md` § Servicio de ML y en `backend/ml_service/README.md`. Puede probarse manualmente:

```bash
curl -s -X POST "http://localhost:8002/api/riesgo/hipoglucemia" \
  -H "Content-Type: application/json" \
  -d '{
        "glucosa": 68,
        "momento": "ayunas",
        "genero": "femenino",
        "edad": 61,
        "bmi": 26.4,
        "duracion_diabetes": 12,
        "categoria_medicacion": "insulina",
        "com_hipertension": true,
        "com_dislipidemia": false,
        "com_renal": false,
        "com_neuropatia": true,
        "com_nefropatia": false,
        "com_cardiovascular": false,
        "hba1c": 8.1
      }' | python -m json.tool
```

O bien, ejecutar el flujo completo (entrenar solo si falta el `.pkl`, levantar el servicio, probar el endpoint y apagarlo) con el script incluido en el repositorio:

```bash
cd backend/ml_service
./test_ml.sh
```

### 4.6 Variables de entorno

Copiar `backend/.env.example` a `backend/.env` y completar con valores reales (Supabase, secreto JWT, cuenta de correo para el OTP). Cada servicio tiene su propio `.env`: la API key del proveedor de NLP va en `backend/nlp_service/.env` (a partir de su `.env.example`) y las variables `ML_*` en `backend/ml_service/.env`; el backend no las necesita. El backend se prueba con `PYTHONPATH=. python -m pytest tests` desde `backend/`, con un entorno creado con `pip install -r requirements-dev.txt`. El archivo `.env` real nunca debe commitearse (ver `docs/team_charter.md`).

```bash
cp backend/.env.example backend/.env
```

### 4.7 Resultados de la línea base actual

Métricas generadas automáticamente al entrenar (`random_state=42`), documentadas en `docs/model_baseline.md` §4:

| Métrica | Valor |
|---|---|
| AUC-ROC | 0.640 |
| Precision (clase hipoglucemia) | 0.429 |
| Recall (clase hipoglucemia) | 0.429 |
| F1 (clase hipoglucemia) | 0.429 |
| Train | 157 **filas** (lecturas), 10 filas positivas reales antes de SMOTE-NC, de 77 pacientes |
| Test | 36 **filas** (lecturas), 7 filas positivas 100% reales, de solo 4 pacientes positivos (20 pacientes en total) |

Es un único split con muy pocos positivos: sirve como punto de comparación, no como estimación estable (validación cruzada agrupada pendiente, TASK-010a). Conteos del dataset: 100 pacientes, 109 registros, 10 registros positivos, 193 filas y 17 filas positivas (`docs/data_ecosystem.md` §3).

Justificación del modelo elegido, tratamiento del desbalance de clases y limitaciones conocidas: ver `docs/model_baseline.md` §2, §3 y §5; inventario de datos y análisis exploratorio: ver `docs/data_ecosystem.md`.

## 5. Estado del componente NLP (chatbot educativo)

El componente de chatbot está actualmente en etapa de **especificación de diseño y metodología de evaluación**, no cuenta todavía con un script de ejecución ni resultados medidos en este repositorio. Lo que existe documentado es:

- La decisión arquitectónica de usar inyección estática de contexto (system prompting) sobre un LLM externo en vez de RAG, con sus alternativas consideradas y condiciones de revisión futura (ver `docs/nlp/adr_system_prompting_vs_rag.md`).
- La arquitectura del chatbot como servicio independiente `backend/nlp_service/`, al que la app llama directamente (ver `docs/adr/0006-nlp-servicio-independiente.md` y `design.md` § Servicio NLP (chatbot) Design).
- El corpus de conocimiento que se inyecta en el system prompt (`backend/nlp_service/app/corpus/`, con `reglas_ada_v1.1.txt` como versión vigente) y su política de versionado (ver `docs/nlp/corpus_conocimiento.md`).
- La metodología de evaluación propuesta: la métrica de Tasa de Adherencia Clínica, el diseño del Golden Dataset (`docs/nlp/golden_dataset.csv`, 20 preguntas en 4 categorías) y el formato esperado de `nlp_baseline_metrics.json` (ver `docs/nlp/baseline_chatbot.md`). El propio documento aclara explícitamente que "la implementación del script que ejecuta las llamadas al LLM y calcula estos valores es un paso de código separado, no cubierto aquí".

No implementar TASK-010 ni TASK-013 (módulo de ML y chatbot respectivamente) sin antes consultar las Open Questions pendientes en `design.md` y en `CONTEXT.md` (ver también `CLAUDE.md`).

## 6. Estructura de carpetas relevante

```
proyecto-taller-inteligentes/
├── requirements.md, design.md, tasks.md   # fuentes de verdad del proyecto (Spec Driven Development)
├── CONTEXT.md                             # estado de sesión y decisiones vigentes
├── backend/
│   ├── app/
│   │   ├── main.py                        # punto de entrada FastAPI
│   │   ├── ml/                            # modelo de riesgo de hipoglucemia (datos, entrenamiento, predicción, endpoint)
│   │   ├── api/, core/, models/           # capas del backend a completar según tasks.md
│   │   └── test_ml.sh                     # script end-to-end de prueba del componente ML
│   ├── data/raw/                          # dataset fuente (ShanghaiT2DM)
│   ├── requirements.txt
│   ├── .env.example
│   └── nlp_service/                       # servicio NLP independiente del chatbot (venv, requirements y README propios)
├── mobile/                                # app cliente en React Native
└── docs/
    ├── adr/                               # decisiones de arquitectura (ADR)
    ├── architecture/                      # diagramas C4
    ├── nlp/                               # documentación y corpus del chatbot
    └── *.md                               # ecosistema de datos, métricas, riesgos, team charter, etc.
```

## 7. Próximos pasos pendientes

Recopilados de los `.md` existentes y de tasks.md:

- Validación cruzada agrupada por paciente con IC por bootstrap sobre pacientes, comparando con árbol de decisión y Random Forest (TASK-010a, ML-D2/D3). Después, calibración y umbral con revisión clínica, priorizando recall (TASK-010b, ML-D4). Hasta entonces el modelo es solo informativo (ver `docs/model_baseline.md` §5 y ADR-0007).
- Implementar la clasificación ADA de la lógica de negocio del backend (`backend/app/core/reglas_ada.py`, TASK-012a) y las alertas que dispara (TASK-012), y migrar el modelo al servicio `backend/ml_service/` (TASK-011d/011e, ADR-0008).
- Conseguir datos que cubran el momento "antes de dormir", no representado en el dataset fuente actual (ver `docs/model_baseline.md` §5).
- Reentrenar el modelo cuando existan datos reales propios de la app, dado que el dataset base (ShanghaiT2DM) no necesariamente representa a la población de usuarios de GlucoTracker (ver `docs/risks.md`, RD-01).
- Evaluar `class_weight` (sigue sin evaluarse) o técnicas de remuestreo adicionales frente al desbalance de clases, dentro de TASK-010a (ver `docs/risks.md`, RD-02).
- El servicio NLP ya compara con un test de contrato los umbrales del corpus ("70-130 mg/dL en ayunas", "menor a 180 mg/dL postprandial") contra sus constantes y contra `docs/nlp/umbrales_ada_v1.json` (TASK-013j). La clasificación ADA del backend, especificada en `backend/app/core/reglas_ada.py` (TASK-012a) y aún no implementada, deberá pasar el mismo contrato (ver `docs/nlp/corpus_conocimiento.md` §3).
- Confirmar la edición/año exacto de la fuente ADA citada en el corpus del chatbot y en `umbrales_ada_v1.json`, que será también la fuente de la clasificación ADA del backend (TASK-012a) (ver `docs/nlp/corpus_conocimiento.md` §1).
- Resolver la Open Question del perfil clínico en Data Models (bloquea TASK-017, no el servicio de ML) y la de autenticación entre el backend y el servicio de ML (ver `design.md` § Open Questions).
- Implementar el script que ejecuta las llamadas al LLM y calcula las métricas de adherencia del chatbot (`nlp_baseline_metrics.json`), descrito pero no cubierto por la metodología (ver `docs/nlp/baseline_chatbot.md` §4).
- Considerar un filtro adicional de palabras clave sobre la salida del LLM como trabajo futuro si la adherencia en casos `adversarial` no resulta aceptable (ver `docs/nlp/baseline_chatbot.md` §6 y `docs/risks.md`, RIA-03).
- Evaluar un modelo LLM local como trabajo futuro si la dependencia de un proveedor externo se vuelve un problema en producción (ver `docs/nlp/adr_system_prompting_vs_rag.md` y `docs/risks.md`, RIA-04).
- Decidir y documentar por ADR el esquema de autenticación (JWT vs. Supabase Auth vs. OAuth) antes de implementar cualquier endpoint que dependa de sesión de usuario (ver `docs/risks.md`, RT-01, y `CONTEXT.md`).
- Crear campos personalizados dedicados para "Evidencia" y "Riesgo" en ClickUp, en vez de mantenerlos solo en la descripción de las tareas (ver `docs/clickup_estructura.md` §5.3).
- Verificar en la práctica que los PR del repositorio efectivamente declaran qué se generó con IA y qué verificación se ejecutó, conforme a `docs/team_charter.md` (ver `docs/risks.md`, RIA-05).
