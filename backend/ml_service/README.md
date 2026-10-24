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
│   └── artefactos/        # modelo_hipoglucemia.pkl (fuera de git) + modelo_hipoglucemia.json y cv_metrics.json (en git)
├── data/raw/ShanghaiT2DM_Summary.xlsx
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
| `ML_ENABLE_DOCS` | Enciende `/docs`, `/redoc` y `/openapi.json` (`true`/`false`). Con `false` responden 404 | `false` |

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
