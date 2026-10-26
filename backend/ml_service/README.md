# Servicio de ML — GlucoTracker

Servicio FastAPI independiente que estima la **probabilidad informativa de hipoglucemia observada en el registro** (REQ-004; Regresión Logística con SMOTE-NC, ADR-0007). No clasifica Normal/Hipo/Hiper ni dispara alertas: eso es la clasificación ADA del backend. Es un servicio separado del backend y del servicio NLP (ADR-0008): tiene su propio código, dependencias, entorno y pruebas, y **no importa nada de `backend/app/` ni de `backend/nlp_service/`**. No tiene ingreso público: solo lo llama el backend, por red interna (ML-D8).

> **Estado:** es el único lugar del repositorio con código de ML (el backend de negocio no tiene ninguno). Expone `GET /health` y `POST /api/riesgo/hipoglucemia`, y contiene el entrenamiento, la validación cruzada y la inferencia. El modelo es **experimental, solo informativo y visible solo para el médico**: la validación cruzada no muestra que supere el azar (`docs/model_baseline.md` §4.1). Ver `design.md` § Servicio de ML y `tasks.md` (TASK-011a, 011d).

## Estructura

```
backend/ml_service/
├── app/
│   ├── main.py            # crear_app(): GET /health (informa si el modelo está cargado y verificado) + router de riesgo
│   ├── api/riesgo.py      # POST /api/riesgo/hipoglucemia: contrato, validación y errores genéricos
│   ├── config.py          # variables de entorno del servicio
│   ├── errors.py          # ModeloNoDisponible, ConfiguracionInvalida (mensajes genéricos)
│   ├── metadatos.py       # huella SHA-256, versiones y lectura/verificación del JSON de metadatos
│   ├── data_prep.py       # limpieza clínica y features
│   ├── train_baseline.py  # entrena y escribe .pkl + JSON de metadatos
│   ├── cv_evaluacion.py   # validación cruzada agrupada + bootstrap + referencias y lift
│   ├── predict.py         # carga única y verificada del artefacto, e inferencia
│   ├── exportar_dataset.py
│   ├── sintetico/         # generador de datos SINTETICOS del modelo de demo (reglas.py, generador.py, generar.py, adaptador.py)
│   ├── train_demo.py      # entrena el modelo de DEMO con el dataset sintetico y escribe su validacion sintetica
│   └── artefactos/        # modelo_hipoglucemia.pkl (fuera de git) + modelo_hipoglucemia.json y cv_metrics.json (en git)
├── data/raw/ShanghaiT2DM_Summary.xlsx
├── data/sintetico/        # dataset sintético (CSV fuera de git) + JSON de metadatos (en git); nunca se mezcla con data/raw/
├── tests/
├── test_ml.sh             # prueba end-to-end: levanta el servicio, prueba un paciente simulado y se apaga solo
├── requirements.txt       # versiones exactas
├── requirements-dev.txt
└── .env.example           # solo nombres de variables
```

## Puesta en marcha

Todo se ejecuta **desde `backend/ml_service/`**, con su propio entorno virtual (Python 3.13):

```bash
cd backend/ml_service
python -m venv .venv
source .venv/Scripts/activate        # Windows (Git Bash); en PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
pip check

cp .env.example .env                 # opcional: las variables vacías usan su valor por defecto
python -m app.train_baseline         # genera app/artefactos/modelo_hipoglucemia.pkl y .json
uvicorn app.main:app --env-file .env --port 8002
curl http://127.0.0.1:8002/health    # {"status":"ok","service":"glucotracker-ml","modelo_cargado":true}
```

Prueba completa con un solo comando (no reentrena si ya existe el `.pkl`, levanta `uvicorn` y se apaga solo): `./test_ml.sh`.

## Variables de entorno

Solo nombres; los valores van en `.env` (nunca en el repositorio). Una variable vacía usa el valor por defecto de `app/config.py`.

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `ML_ARTEFACTOS_DIR` | Carpeta con el `.pkl` y su JSON de metadatos | `app/artefactos/` |
| `ML_LOG_LEVEL` | Nivel de log | `INFO` |
| `ML_MODELO` | Modelo que se sirve: `real` o `demo` (modelo de DEMO con datos sintéticos, no clínico) | `real` |
| `ML_ENABLE_DOCS` | Enciende `/docs`, `/redoc` y `/openapi.json` (`true`/`false`). Con `false` responden 404 | `false` |

## Docker

La imagen se construye con `backend/ml_service/Dockerfile` (`python:3.13-slim`, solo `requirements.txt` de producción, usuario no root) y se levanta con el `docker-compose.yml` de la raíz. Ver el README raíz, § "Levantar todo con Docker", y ADR-0010.

- **Sin ingreso público (ADR-0008):** el servicio **no publica ningún puerto** en el host. Está solo en la red interna `red_ml` (sin salida a Internet) y solo el backend lo alcanza, por `http://ml_service:8002`.
- **El modelo entra por volumen:** el volumen `ml_artefactos` se monta en `/artefactos` (`ML_ARTEFACTOS_DIR=/artefactos`, de solo lectura en el servicio). El `.pkl` no está en git ni en la imagen. Primera vez: `docker compose run --rm ml_entrenar_real` (modelo real; monta `backend/ml_service/data` de solo lectura para leer el Excel) y `docker compose run --rm ml_entrenar_demo` (modelo entrenado con datos sintéticos, para `ML_MODELO=demo`). Sin modelo, el servicio sigue vivo: `/health` informa `modelo_cargado: false` y el `POST` responde 503 genérico.
- **Qué modelo se sirve:** `ML_MODELO` (`real` por defecto o `demo`) en el `.env` de la raíz.
- **Pruebas en un contenedor:** `docker compose --profile pruebas run --rm ml_test`.

## Endpoint: `POST /api/riesgo/hipoglucemia`

Devuelve la probabilidad **informativa** de hipoglucemia observada en el registro. No devuelve nivel de alerta: la clasificación Normal/Hipo/Hiper es del backend (ML-D5).

**Entrada** (JSON; sin nombre, correo ni ids; **cualquier campo no listado → 422**):

| Campo | Tipo | Restricción |
|---|---|---|
| `glucosa` | número | mg/dL, > 0 y ≤ 700 |
| `momento` | texto | `ayunas` \| `postprandial` |
| `genero` | texto | `femenino` \| `masculino` |
| `edad` | entero | > 0 y ≤ 120 |
| `bmi` | número | > 0 y ≤ 80 |
| `duracion_diabetes` | número | años, ≥ 0 y ≤ 80 |
| `categoria_medicacion` | texto | `ninguno` \| `metformina_u_otros` \| `sulfonilurea` \| `insulina` |
| `com_hipertension`, `com_dislipidemia`, `com_renal`, `com_neuropatia`, `com_nefropatia`, `com_cardiovascular` | booleano | por defecto `false` |
| `hba1c` | número o `null` | opcional, % (> 0 y ≤ 20). Si falta, se trata como dato faltante (bandera + mediana del entrenamiento) |

**Salida 200:** `{"riesgo_hipoglucemia": 0.3171, "version_modelo": "1.0.0"}` (probabilidad entre 0 y 1 con 4 decimales; la versión sale del JSON de metadatos).

**Errores** (siempre `{"detail": "<mensaje genérico en español>"}`; nunca repiten lo enviado, rutas ni el texto de una excepción):

| Código | Cuándo |
|---|---|
| 422 | Campo faltante o adicional, tipo, rango o valor no permitido, JSON malformado o cuerpo que no es UTF-8 (el servicio no emite 400) |
| 503 | Modelo no disponible: `.pkl` ausente, huella distinta o versiones de librerías distintas a las del entrenamiento; o configuración inválida |
| 500 | Cualquier otro error al calcular el riesgo |

```bash
curl -X POST http://127.0.0.1:8002/api/riesgo/hipoglucemia -H "Content-Type: application/json"   -d '{"glucosa":68,"momento":"ayunas","genero":"femenino","edad":61,"bmi":26.4,"duracion_diabetes":12,"categoria_medicacion":"insulina","hba1c":8.1}'
```

**Documentación interactiva:** arranca con `ML_ENABLE_DOCS=true` y abre `http://127.0.0.1:8002/docs`. Documenta los cuatro códigos de respuesta con su esquema y un ejemplo con valores sintéticos. Apagada (por defecto), `/docs`, `/redoc` y `/openapi.json` responden 404.

**Latencia (NFR-003):** con el modelo real, 200 peticiones secuenciales contra `uvicorn` dieron p50 6.7 ms y p95 8.8 ms (muy por debajo de 2000 ms).

## Modelo real y modelo entrenado con datos sintéticos

El servicio puede servir **dos modelos distintos**, y nunca los mezcla:

| | Modelo real (por defecto) | Modelo entrenado con datos sintéticos |
|---|---|---|
| Cómo se activa | `ML_MODELO=real` (o sin definir la variable) | `ML_MODELO=demo` |
| Con qué datos se entrenó | Los 109 registros de ShanghaiT2DM (`data/raw/`) | Un dataset **sintético** generado por reglas clínicas escritas por el equipo (`data/sintetico/`), sin pacientes reales |
| Artefactos | `app/artefactos/modelo_hipoglucemia.pkl` y `.json` | `app/artefactos/demo/modelo_hipoglucemia_demo.pkl` y `.json` |
| `version_modelo` | `1.0.0` | `1.1.0` (neutra, sin «demo»; `entrenado_con: "sintetico"` en sus metadatos, ADR-0011) |
| Qué significan sus métricas | Validación con datos reales; el modelo es **experimental** y no supera el azar | Validación **sintética: NO es desempeño clínico**. Aprende las reglas del equipo, no la realidad |
| Para qué sirve | Línea base real, solo informativa y visible solo para el médico | Mostrar el flujo integrado sin pacientes reales |

- **No se mezclan:** nunca se usan filas sintéticas para entrenar o validar el modelo real, ni los 109 registros reales para el otro. Con `real` jamás se carga el modelo sintético y con `demo` jamás el real, aunque alguien copie los archivos a la carpeta equivocada (se verifica el modo, la huella y las versiones al cargar).
- **La API no distingue el modelo.** Decisión del equipo (ADR-0009): el contrato público no cambia. `POST /api/riesgo/hipoglucemia` sigue devolviendo solo `{riesgo_hipoglucemia, version_modelo}` y `GET /health` solo `{status, service, modelo_cargado}`; ningún mensaje de la API dice "demo" ni "sintético" (la versión del modelo sintético, `1.1.0`, es neutra: la trazabilidad está en `entrenado_con` de los metadatos, ADR-0011). La trazabilidad está en los metadatos de cada modelo, en `ML_MODELO` (por defecto `real`), en la verificación de huella y en esta documentación.
- **Riesgo declarado:** como la respuesta no lo dice, una probabilidad del modelo sintético podría confundirse con una estimación clínica. Si el servicio llegara a usuarios reales habría que reponer la marca. Hasta decidir qué modelo se usa en producción (Open Question de `design.md`), el modelo sintético es solo para desarrollo y presentaciones.
- Un `ML_MODELO` distinto de `real` o `demo`, o un artefacto ausente o alterado, deja el endpoint en **503** genérico.
- Para probar cada uno de punta a punta: `./test_ml.sh` (real) y `./test_ml.sh demo`.

## Datos sintéticos para el modelo de demo (Fase S2)

> **Advertencia de honestidad:** el modelo real (este servicio, ADR-0007) es experimental y no supera el azar. Para poder **mostrar el flujo integrado** sin pacientes reales se prepara un **modelo de demo**, entrenado con datos **sintéticos** generados desde **reglas clínicas escritas por el equipo** (ADR-0009). **El modelo de demo aprende esas reglas, no la realidad:** sus probabilidades y métricas no son evidencia clínica, y las reglas están pendientes de revisión por el equipo. Nunca se mezclan filas sintéticas con las 109 reales ni se presenta una métrica sintética como desempeño clínico. El modelo real no se modifica.

Estado: el **generador** (TASK-011f), el **modelo de demo** (TASK-011g) y las pruebas de contrato (TASK-011h) existen. Especificación y resultados: `docs/ml/generador_sintetico.md`.

```bash
# desde backend/ml_service/, con el entorno virtual activado
python -m app.sintetico.generar --n 2000 --semilla 20261024 --salida data/sintetico/dataset_sintetico.csv
```

- Escribe el CSV (**ignorado por git**, regenerable) y, al lado, `dataset_sintetico.json` (**versionable**): semilla, versión de las reglas, escala de señal, intercepto, fecha, `n`, prevalencia obtenida, AUC de las probabilidades verdaderas, percentiles, tasa de positivos por medicación, huella del CSV y versiones de librerías. Solo agregados.
- Es determinista: la misma semilla produce el mismo CSV. Opciones: `--escala-senal` (0,8 por defecto) y `--prevalencia` (0,15).
- Todas las filas llevan `origen = "sintetico"` y ids con prefijo `sint-`. Rechaza escribir en `data/raw/` o sobre un `.xlsx`.
- **No lee los datos reales** y no importa nada de `backend/app` ni `nlp_service`.
- Una consulta rápida del resultado: el AUC del JSON es el de las **probabilidades verdaderas de las reglas**, no el de un modelo entrenado.

### Entrenar y usar el modelo de demo

```bash
# desde backend/ml_service/ (genera antes el dataset sintético, ver arriba)
python -m app.train_demo                 # ~1 minuto; escribe app/artefactos/demo/
ML_MODELO=demo uvicorn app.main:app --port 8002   # sirve el modelo de DEMO (por defecto: ML_MODELO=real)
```

- Escribe en `app/artefactos/demo/`: `modelo_hipoglucemia_demo.pkl` (**ignorado por git**), `modelo_hipoglucemia_demo.json` (metadatos, versión `1.1.0`, `entrenado_con: "sintetico"`, huella del `.pkl`) y `cv_metrics_demo.json` (validación sintética, rotulada **"NO ES DESEMPEÑO CLÍNICO"**). Nunca escribe en `artefactos/` del modelo real ni toca `baseline_metrics.json` ni `cv_metrics.json`.
- Reutiliza la misma tubería del modelo real (mismo `preparar_features`, split agrupado por paciente) con el origen de datos como parámetro. Es una regresión logística **sin SMOTE-NC** (medido: lo empeora e infla las probabilidades) y **sin términos de interacción**. No lee los 109 registros reales y rechaza datasets cuyo `origen` no sea `sintetico`.
- Resultado (dataset canónico): AUC 0,783 [0,758, 0,814] frente a 0,794 de las reglas verdaderas. Es una propiedad de las reglas y del ruido que pusimos, **no desempeño clínico**. Los coeficientes de los controles (sin efecto en las reglas) salen con ruido de muestreo (neuropatía −0,44, hipertensión +0,21); el reporte los publica con su intervalo.
- `ML_MODELO` solo acepta `real` o `demo`; otro valor, o un artefacto de demo ausente o alterado, deja el endpoint en **503** genérico. Con `real` jamás se carga el modelo de demo y con `demo` jamás el real, aunque alguien copie los archivos a la carpeta equivocada.
- **El contrato no marca el modelo** (decisión del equipo, ADR-0009): ver la sección anterior.

## Artefactos, huella y versiones (ML-D7, RT-06)

- `modelo_hipoglucemia.pkl` **no se versiona** (`.gitignore`).
- `modelo_hipoglucemia.json` **sí se versiona** y lleva: `version_modelo`, `fecha_entrenamiento`, `sha256_pkl`, `versiones` de las librerías, `metricas`, `random_state`, `dataset` (nombre y huella del Excel) y `conteos`. Solo agregados: sin glucosa ni ids de pacientes.
- Al cargar el modelo (una sola vez por proceso), `predict.py` recalcula el SHA-256 del `.pkl` y compara las versiones instaladas con las del JSON **antes de deserializar nada**. Si algo no coincide lanza `ModeloNoDisponible` (mensaje genérico, sin rutas) y `/health` informa `modelo_cargado: false`.
- Quien reentrena (`python -m app.train_baseline`) publica en el PR el JSON nuevo: su huella es la evidencia de qué modelo se evaluó.

## Versiones fijadas

pandas 2.2.3, numpy 2.4.6, scikit-learn 1.5.2, imbalanced-learn 0.14.2, scipy 1.15.3, joblib 1.6.0, openpyxl 3.1.5. scikit-learn 1.5.2 reproduce las métricas de la línea base (AUC 0.640, recall 0.429). Con scipy 1.16 o posterior emite un aviso de `iprint` del solver L-BFGS-B, así que scipy 1.15.3 es la más reciente sin aviso, y numpy 2.4.6 la más reciente que scipy 1.15.3 admite (`numpy<2.5`). No se silencia ningún aviso con filtros.

## Pruebas

```bash
python -m pytest
```

Sin red y sin el Excel real: usan datos sintéticos y un modelo pequeño entrenado dentro de la sesión de pruebas. Cubren features y predicción (incluido `hba1c` ausente o `null`), el JSON de metadatos, la verificación de huella y versiones, el aislamiento de imports, el endpoint (200, cada 422, 503, 500, documentación apagada y encendida, latencia p95 < 2000 ms con el modelo pequeño), que ningún log contenga valores de entrada, y la validación cruzada (`cv_evaluacion.py`).

## Validación cruzada

```bash
python -m app.cv_evaluacion          # ~5 minutos; escribe app/artefactos/cv_metrics.json
```

Resultados e interpretación en `docs/model_baseline.md` §4.1: ninguna variante supera el azar con estos datos y el modelo se mantiene como experimental.

## Seguridad (NFR-001)

- No se registran valores de glucosa ni del perfil en logs, prints, excepciones ni respuestas; los logs solo llevan categorías fijas (por ejemplo `huella_distinta`).
- **Sin ingreso público ni CORS.** El servicio solo debe ser alcanzable por el backend, por red interna (ML-D8). No expone la documentación salvo que se active `ML_ENABLE_DOCS` en desarrollo.
- **Sin autenticación propia en v1** (ADR-0008): la protección es el aislamiento de red que se provisiona en TASK-002b. La autenticación entre servicios (identidad administrada de Azure, mTLS o token) es una Open Question de `design.md`.
- Los errores inesperados solo registran el nombre de la clase de la excepción, nunca su texto.
