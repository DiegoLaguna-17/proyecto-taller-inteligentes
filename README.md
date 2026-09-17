# GlucoTracker

## 1. Resumen del proyecto

GlucoTracker es una plataforma de monitoreo y análisis inteligente de glucosa dirigida a pacientes y médicos, construida bajo un enfoque de *Spec Driven Development* (ver `requirements.md`, `design.md` y `tasks.md` en la raíz del repositorio). El sistema registra y centraliza mediciones de glucosa, y ofrece dos componentes de Inteligencia Artificial complementarios (ver `docs/product_goal.md`):

- **Modelo de riesgo de hipoglucemia (ML):** un modelo de Regresión Logística que estima, a partir de una lectura de glucosa y el perfil clínico del paciente, la probabilidad de un episodio de hipoglucemia, expuesto vía un endpoint REST del backend. Corre en paralelo (no reemplaza) al motor de reglas ADA que clasifica cada lectura puntual como Normal/Hipo/Hiper (ver `docs/model_baseline.md`).
- **Chatbot educativo (NLP):** un asistente conversacional para consultas de pacientes sobre diabetes tipo 2, basado en inyección de contexto (system prompting) sobre un LLM externo, con alcance restringido a hipoglucemia y metas básicas de control glicémico (ver `docs/nlp/`).

El backend es un monolito modular en FastAPI/Python, con persistencia en Supabase/PostgreSQL y despliegue previsto en Azure; el cliente es una app móvil en React Native (`mobile/`). Ver las decisiones de arquitectura completas en `docs/adr/` y los diagramas C4 en `docs/architecture/`.

## 2. Tecnologías utilizadas

Tabla basada exclusivamente en lo que está configurado o implementado en el repositorio (dependencias declaradas, código fuente y ADR aceptados). Las filas marcadas como *pendiente de confirmación* corresponden a Open Questions documentadas — ver la subsección siguiente para el detalle.

| Categoría | Tecnología | Uso en el proyecto |
|---|---|---|
| Lenguaje (backend) | Python | Implementación completa del backend, del módulo ML y (a futuro) del módulo NLP (`backend/app/`, `backend/requirements.txt`) |
| Framework backend | FastAPI | Expone la API REST; define el router del endpoint de riesgo (`backend/app/main.py`, `backend/app/ml/riesgo.py`; ADR-0001) |
| Servidor ASGI | Uvicorn | Ejecuta la aplicación FastAPI (`uvicorn app.main:app --reload`, `backend/requirements.txt`, `backend/app/test_ml.sh`) |
| Validación de datos | Pydantic | Esquemas de entrada/salida del endpoint de riesgo de hipoglucemia (`backend/app/ml/riesgo.py`) |
| Base de datos | PostgreSQL (gestionado vía Supabase) | Persistencia de usuarios, pacientes, registros de glucosa y alertas (ADR-0002; `design.md` § Data Models) |
| Backend-as-a-Service | Supabase | Cliente `supabase` en `backend/requirements.txt`; variables `SUPABASE_URL` / `SUPABASE_KEY` en `backend/.env.example` |
| Autenticación (librerías presentes) | `passlib[bcrypt]`, `python-jose[cryptography]` | Declaradas en `backend/requirements.txt` para hashing de contraseñas y JWT, pero el esquema de autenticación final **no está confirmado** (ver Open Questions) |
| Machine Learning | scikit-learn | Modelo de Regresión Logística dentro de un `Pipeline`, implementado en `backend/app/ml/train_baseline.py` (ver `docs/model_baseline.md` y nota de evidencia más abajo) |
| Machine Learning — balanceo de clases | imbalanced-learn (SMOTE-NC) | Balanceo de clases dentro del `Pipeline` de entrenamiento, solo sobre el conjunto de train (`docs/model_baseline.md` §3, `backend/requirements.txt`) |
| Procesamiento de datos | pandas, numpy | Limpieza clínica y construcción de features (`backend/app/ml/data_prep.py`) |
| Lectura de datos fuente | openpyxl | Lectura de `ShanghaiT2DM_Summary.xlsx` (`backend/app/ml/exportar_dataset.py`, `backend/requirements.txt`) |
| Persistencia del modelo | joblib | Serialización de `app/ml/modelo_hipoglucemia.pkl` (`backend/app/ml/train_baseline.py`) |
| Generación de reportes | reportlab | Generación de reportes clínicos en PDF (REQ-008; `backend/requirements.txt`) |
| NLP / LLM | LLM externo vía system prompting (proveedor específico **no confirmado**, referenciado como "OpenAI/Gemini") | Inyección del corpus `docs/nlp/reglas_ada_v1.txt` en el system prompt (`docs/nlp/adr_system_prompting_vs_rag.md`, `docs/nlp/corpus_conocimiento.md`); variable de entorno genérica `NLP_PROVIDER_API_KEY` en `backend/.env.example` |
| Mobile — lenguaje | TypeScript | `mobile/App.tsx`, `mobile/src/services/api.ts` |
| Mobile — framework | React Native 0.75.4 + React 18.3.1 | App cliente del sistema (`mobile/package.json`) |
| Mobile — testing / linting | Jest, ESLint | Scripts `test` y `lint` de `mobile/package.json` |
| Cloud | Microsoft Azure | Plataforma oficial de despliegue del backend (ADR-0003) |
| Cloud — notificaciones push (referenciado, no confirmado) | Azure Notification Hubs | Variable `AZURE_NOTIFICATION_HUB_CONNECTION_STRING` en `backend/.env.example`, pero el servicio específico **no está confirmado formalmente** (ver Open Questions) |
| Control de versiones | Git / GitHub | Repositorio remoto en GitHub; flujo de revisión por Pull Request obligatorio (`docs/team_charter.md`) |
| Gestión de proyecto | ClickUp | Seguimiento de historias de usuario, riesgos y tareas del proyecto (`docs/clickup_estructura.md`) |

### Nota de evidencia — modelo de Machine Learning

`docs/adr/0004-modelo-clasificacion-baseline.md` documenta como decisión aceptada un modelo de **Árbol de Decisión / SVC**. Sin embargo, el código realmente implementado (`backend/app/ml/train_baseline.py`, `backend/app/ml/riesgo.py`) y `docs/model_baseline.md` usan **Regresión Logística**. La tabla anterior refleja lo que efectivamente está implementado en el código (evidencia verificada directamente en `backend/app/ml/`), no lo declarado en el ADR. Esta discrepancia entre documentos no se resuelve aquí — se reporta como parte de la evidencia usada para esta sección.

### Decisiones tecnológicas pendientes (Open Questions)

Documentadas formalmente en `design.md` § Open Questions y reflejadas también en `CONTEXT.md` § Open questions y `CLAUDE.md`:

| Tecnología documentada | Decisión pendiente | Dónde está la Open Question | Impacto sobre la tabla de tecnologías |
|---|---|---|---|
| Esquema de autenticación | ¿JWT, sesiones de Supabase Auth, u OAuth? | `design.md` § Open Questions, `CONTEXT.md` § Open questions, `docs/risks.md` (RT-01) | Las librerías `python-jose` y `passlib[bcrypt]` están instaladas, pero no puede listarse "JWT" como el mecanismo de autenticación confirmado del sistema |
| Proveedor de LLM del chatbot | ¿OpenAI o Gemini (u otro)? El ADR `docs/nlp/adr_system_prompting_vs_rag.md` ya fija el *enfoque* (system prompting sobre LLM externo), pero no el proveedor concreto | `docs/nlp/adr_system_prompting_vs_rag.md`, `docs/nlp/corpus_conocimiento.md`, `docs/nlp/baseline_chatbot.md` (campo `modelo_llm` sin valor fijo); listada también, de forma más general ("LLM externo vs. modelo propio"), en `design.md` § Open Questions y `CONTEXT.md` § Open questions | No puede confirmarse un proveedor específico de LLM en la tabla de tecnologías, solo que el enfoque es "LLM externo" |
| Servicio de Azure para notificaciones push | ¿Azure Notification Hubs u otro servicio? | `design.md` § Open Questions, `CONTEXT.md` § Open questions | `backend/.env.example` ya nombra `AZURE_NOTIFICATION_HUB_CONNECTION_STRING`, pero esto no equivale a una confirmación formal de la decisión en `design.md` |
| Algoritmo de ML baseline | ADR-0004 dice Árbol de Decisión/SVC; el código implementado usa Regresión Logística | `docs/adr/0004-modelo-clasificacion-baseline.md` vs. `docs/model_baseline.md` y `backend/app/ml/train_baseline.py` | No es una Open Question declarada como tal, pero es una discrepancia directamente relevante para no presentar el algoritmo de ML como una tecnología inequívocamente confirmada por todos los documentos (ver nota de evidencia arriba) |
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
| ADR 0004 — Modelo baseline de clasificación | Justificación del algoritmo elegido para el riesgo glucémico | `docs/adr/0004-modelo-clasificacion-baseline.md` |
| C4 — Contexto del sistema | Diagrama de actores y sistema (Nivel 1) | `docs/architecture/c4_context.md` |
| C4 — Contenedores | Diagrama de contenedores de software (Nivel 2) | `docs/architecture/c4_container.md` |
| Ecosistema de datos | Inventario de fuentes, privacidad/licenciamiento y resumen del EDA del componente ML | `docs/data_ecosystem.md` |
| Línea base del modelo ML | Pipeline reproducible, justificación del modelo, métricas y limitaciones | `docs/model_baseline.md` |
| ADR — System Prompting vs. RAG | Justificación arquitectónica del enfoque del chatbot | `docs/nlp/adr_system_prompting_vs_rag.md` |
| Corpus de conocimiento del chatbot | Inventario y versionado del corpus inyectado en el system prompt | `docs/nlp/corpus_conocimiento.md` |
| Línea base del chatbot (NLP) | Metodología de evaluación, Golden Dataset y métrica de Tasa de Adherencia Clínica | `docs/nlp/baseline_chatbot.md` |

## 4. Reproducción del componente ML — riesgo de hipoglucemia

Pasos concretos para reproducir el entrenamiento del modelo y levantar el endpoint que lo expone, tal como están documentados en `docs/model_baseline.md` y en `backend/app/test_ml.sh`.

### 4.1 Requisitos previos

- Python 3.13 (el entorno del proyecto incluye artefactos compilados para esta versión en `backend/app/ml/__pycache__/`).
- El dataset fuente ya presente en `backend/data/raw/ShanghaiT2DM_Summary.xlsx` (ver `docs/data_ecosystem.md` para su origen y licencia).

### 4.2 Clonar el repositorio e instalar dependencias

```bash
git clone <URL-del-repositorio>
cd proyecto-taller-inteligentes/backend
pip install -r requirements.txt
```

### 4.3 Entrenar el modelo baseline

```bash
python -m app.ml.train_baseline
```

Este comando genera `app/ml/modelo_hipoglucemia.pkl` (modelo entrenado) y `app/ml/baseline_metrics.json` (métricas), sin pasos manuales ni notebooks intermedios (ver `docs/model_baseline.md` §1).

### 4.4 Levantar la API

```bash
uvicorn app.main:app --reload
```

Verificación rápida de que el servicio está activo:

```bash
curl http://localhost:8000/health
```

### 4.5 Probar el endpoint de riesgo

El endpoint expuesto es `POST /api/riesgo/hipoglucemia` (`backend/app/ml/riesgo.py`). Puede probarse manualmente:

```bash
curl -s -X POST "http://localhost:8000/api/riesgo/hipoglucemia" \
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

O bien, ejecutar el flujo completo (entrenar + verificar salud de la API + probar el endpoint) con el script incluido en el repositorio:

```bash
cd backend
./app/test_ml.sh
```

### 4.6 Variables de entorno

Copiar `backend/.env.example` a `backend/.env` y completar con valores reales (credenciales de Supabase, JWT, Azure Notification Hub, API key del proveedor de NLP). El archivo `.env` real nunca debe commitearse (ver `docs/team_charter.md`).

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
| Filas de entrenamiento | 157 (10 positivos reales antes de SMOTE-NC) |
| Filas de test | 36 (7 positivos, 100% reales) |

Justificación del modelo elegido, tratamiento del desbalance de clases y limitaciones conocidas: ver `docs/model_baseline.md` §2, §3 y §5; inventario de datos y análisis exploratorio: ver `docs/data_ecosystem.md`.

## 5. Estado del componente NLP (chatbot educativo)

El componente de chatbot está actualmente en etapa de **especificación de diseño y metodología de evaluación**, no cuenta todavía con un script de ejecución ni resultados medidos en este repositorio. Lo que existe documentado es:

- La decisión arquitectónica de usar inyección estática de contexto (system prompting) sobre un LLM externo en vez de RAG, con sus alternativas consideradas y condiciones de revisión futura (ver `docs/nlp/adr_system_prompting_vs_rag.md`).
- El corpus de conocimiento que se inyectaría en el system prompt (`docs/nlp/reglas_ada_v1.txt`) y su política de versionado (ver `docs/nlp/corpus_conocimiento.md`).
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
│   │   ├── nlp/                           # módulo del chatbot (en desarrollo)
│   │   ├── api/, core/, models/           # capas del backend a completar según tasks.md
│   │   └── test_ml.sh                     # script end-to-end de prueba del componente ML
│   ├── data/raw/                          # dataset fuente (ShanghaiT2DM)
│   ├── requirements.txt
│   └── .env.example
├── mobile/                                # app cliente en React Native
└── docs/
    ├── adr/                               # decisiones de arquitectura (ADR)
    ├── architecture/                      # diagramas C4
    ├── nlp/                               # documentación y corpus del chatbot
    └── *.md                               # ecosistema de datos, métricas, riesgos, team charter, etc.
```

## 7. Próximos pasos pendientes

Recopilados tal como están documentados en los `.md` existentes, sin agregar pendientes nuevos:

- Recalibrar el umbral de decisión del modelo de riesgo ("Alta"/"Media"/"Baja") priorizando recall, e incorporar validación cruzada agrupada (`GroupKFold`) antes de declarar mejoras entre iteraciones (ver `docs/model_baseline.md` §5).
- Conseguir datos que cubran el momento "antes de dormir", no representado en el dataset fuente actual (ver `docs/model_baseline.md` §5).
- Reentrenar el modelo cuando existan datos reales propios de la app, dado que el dataset base (ShanghaiT2DM) no necesariamente representa a la población de usuarios de GlucoTracker (ver `docs/risks.md`, RD-01).
- Evaluar `class_weight` o técnicas de remuestreo adicionales frente al desbalance de clases (ver `docs/risks.md`, RD-02).
- Verificar contra el código del motor de reglas del backend que los umbrales citados en `reglas_ada_v1.txt` ("70-130 mg/dL en ayunas", "menor a 180 mg/dL postprandial") coinciden exactamente con los usados por dicho motor (ver `docs/nlp/corpus_conocimiento.md` §3).
- Confirmar la edición/año exacto de la fuente ADA citada en el corpus del chatbot, asegurando que sea la misma ya citada en la propuesta técnica original del motor de reglas (ver `docs/nlp/corpus_conocimiento.md` §1).
- Implementar el script que ejecuta las llamadas al LLM y calcula las métricas de adherencia del chatbot (`nlp_baseline_metrics.json`), descrito pero no cubierto por la metodología (ver `docs/nlp/baseline_chatbot.md` §4).
- Considerar un filtro adicional de palabras clave sobre la salida del LLM como trabajo futuro si la adherencia en casos `adversarial` no resulta aceptable (ver `docs/nlp/baseline_chatbot.md` §6 y `docs/risks.md`, RIA-03).
- Evaluar un modelo LLM local como trabajo futuro si la dependencia de un proveedor externo se vuelve un problema en producción (ver `docs/nlp/adr_system_prompting_vs_rag.md` y `docs/risks.md`, RIA-04).
- Decidir y documentar por ADR el esquema de autenticación (JWT vs. Supabase Auth vs. OAuth) antes de implementar cualquier endpoint que dependa de sesión de usuario (ver `docs/risks.md`, RT-01, y `CONTEXT.md`).
- Crear campos personalizados dedicados para "Evidencia" y "Riesgo" en ClickUp, en vez de mantenerlos solo en la descripción de las tareas (ver `docs/clickup_estructura.md` §5.3).
- Verificar en la práctica que los PR del repositorio efectivamente declaran qué se generó con IA y qué verificación se ejecutó, conforme a `docs/team_charter.md` (ver `docs/risks.md`, RIA-05).
