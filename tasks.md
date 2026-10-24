# tasks.md
> GlucoTracker — Version 1.0.0 — 2026-08-24

## Legend
- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked — reason noted inline

---

## Phase 1: Infraestructura
*Goal*: Tener el esqueleto de proyecto, entorno de Azure y conexión a Supabase funcionando antes de escribir lógica de negocio.

- [ ] **TASK-001** [NFR-002]: Crear proyecto Supabase (PostgreSQL) y configurar credenciales de conexión seguras.
  - _Refs rationale_: NFR-002 exige uptime del 95% sobre Azure/Supabase; primero se necesita la instancia.
  - _Output_: Instancia Supabase activa, string de conexión en variables de entorno (no en código).
  - _Verify_: Conexión de prueba desde un script local retorna `SELECT 1`.
- [ ] **TASK-002** [NFR-002]: Provisionar recursos en Azure para el backend (App Service o Container Apps) con HTTPS/SSL habilitado.
  - _Refs rationale_: NFR-002 (disponibilidad) y NFR-001 (tráfico cifrado) dependen de esta infraestructura base.
  - _Output_: Servicio en Azure accesible por HTTPS con certificado válido.
  - _Verify_: `curl -I https://<url>` retorna 200 y certificado válido (sin warnings de SSL).
- [ ] **TASK-002a** [NFR-001, NFR-002]: Provisionar en Azure un recurso propio para el servicio NLP (`backend/nlp_service/`), separado del backend, con HTTPS/SSL y sus propias variables de entorno (ADR-0006). No bloquea las tareas TASK-013; el servicio no se expone públicamente hasta TASK-014.
  - _Refs rationale_: ADR-0006 (segundo despliegue): NFR-001 exige tráfico cifrado y NFR-002 disponibilidad también para el servicio NLP.
  - _Output_: Servicio NLP accesible por HTTPS con certificado válido; `NLP_PROVIDER_API_KEY` configurada como secreto del recurso, no en el repositorio.
  - _Verify_: `curl -I https://<url-nlp>/health` retorna 200 y certificado válido (sin warnings de SSL). Si hay un proxy delante (Azure), uvicorn arranca con `--proxy-headers --forwarded-allow-ips=<IP del proxy>`, para que el límite de tasa vea la IP real del cliente (design.md § `app/rate_limit.py`).
- [ ] **TASK-002b** [NFR-001, NFR-002]: Provisionar en Azure un recurso propio para el servicio de ML (`backend/ml_service/`) **sin ingreso público**, alcanzable solo desde el backend por red interna (ADR-0008, ML-D8). No bloquea las tareas del modelo (TASK-010, TASK-010a/b, TASK-011a–d).
  - _Refs rationale_: ADR-0008: el servicio no tiene autenticación propia en v1, así que su protección es la red; riesgo de exposición accidental.
  - _Output_: Recurso del servicio de ML en la red interna del despliegue, sin endpoint público; `ML_SERVICE_URL` configurada en el backend como variable de entorno (no en el repositorio).
  - _Verify_: Desde Internet, la URL o IP del servicio no responde (timeout o conexión rechazada). Desde el backend, `GET /health` → 200 por la red interna.
- [ ] **TASK-003** []: Scaffolding del proyecto FastAPI (`backend/app/`) con estructura de carpetas de design.md (api, ml, nlp, models, core).
  - _Refs rationale_: Estructura base descrita en design.md § File Structure.
  - _Output_: Proyecto FastAPI ejecutable localmente con endpoint `/health`.
  - _Verify_: `GET /health` retorna 200 en entorno local.
- [ ] **TASK-004** []: Scaffolding del proyecto React Native (`mobile/`) con navegación base y estructura de screens/components/services.
  - _Refs rationale_: Estructura base descrita en design.md § File Structure.
  - _Output_: App React Native que compila y muestra una pantalla de login vacía.
  - _Verify_: `npx react-native run-android` (o iOS) levanta la app sin errores.

## Phase 2: Capa de Datos
*Goal*: Modelar y persistir todas las entidades de design.md § Data Models en Supabase.

- [ ] **TASK-005** [REQ-001, REQ-002]: Crear tabla T_Usuario con contraseña hasheada y rol.
  - _Refs rationale_: Base de autenticación para REQ-001 y alta de usuarios para REQ-002.
  - _Output_: Migración SQL para T_Usuario según el esquema de design.md.
  - _Verify_: Insertar un usuario de prueba y confirmar que `contrasena_hash` nunca almacena texto plano.
- [ ] **TASK-006** [REQ-002]: Crear tablas T_Paciente, T_Medico y T_Administrador con sus relaciones a T_Usuario.
  - _Refs rationale_: Extensiones de usuario descritas en design.md.
  - _Output_: Migraciones SQL para las tres tablas con FKs correctas.
  - _Verify_: Insertar un paciente y un médico de prueba, confirmar integridad referencial.
- [ ] **TASK-007** [REQ-003, REQ-004, REQ-005]: Crear tabla T_Registro_glucosa con `clasificacion_ada` (lógica de negocio) y los campos de riesgo del ML (`riesgo_hipoglucemia`, `riesgo_modelo_version`, `riesgo_calculado_en`), según design.md 1.4.0.
  - _Refs rationale_: Soporta el registro de glucosa (REQ-003), la clasificación ADA que dispara alertas (REQ-005) y la probabilidad informativa del ML (REQ-004).
  - _Output_: Migración SQL para T_Registro_glucosa.
  - _Verify_: Insertar un registro de prueba sin `clasificacion_ada` ni `riesgo_hipoglucemia` y confirmar que ambos aceptan NULL; insertar `riesgo_hipoglucemia = 1.5` y confirmar que el CHECK lo rechaza.
- [ ] **TASK-008** [REQ-005]: Crear tablas T_Tipo_alerta y T_Alertas.
  - _Refs rationale_: Necesarias para notificaciones automáticas al médico (REQ-005).
  - _Output_: Migraciones SQL con FK de T_Alertas a T_Registro_glucosa y T_Tipo_alerta.
  - _Verify_: Insertar un tipo de alerta y una alerta asociada a un registro de prueba.
- [ ] **TASK-009** [NFR-001]: Crear tabla T_Auditoria_Endpoints.
  - _Refs rationale_: Trazabilidad de seguridad exigida en NFR-001.
  - _Output_: Migración SQL para T_Auditoria_Endpoints.
  - _Verify_: Insertar un registro de auditoría de prueba manualmente.

## Phase 3: Lógica de Negocio
*Goal*: Implementar el modelo de ML, el chatbot y las reglas de negocio centrales.

*Orden sugerido para ML (fase M2 y siguientes)*: TASK-011c → TASK-011a → TASK-011b → TASK-010a → TASK-010b; luego TASK-011d → TASK-011e. Clasificación y alertas: TASK-012a → TASK-012 → TASK-017.

- [~] **TASK-010** [REQ-004, NFR-003]: Entrenar y serializar el modelo de **probabilidad de hipoglucemia observada en el registro** (Regresión Logística con SMOTE-NC, ADR-0007; reemplaza el alcance original "SVC o Árbol para Normal/Riesgo Hipo/Riesgo Hiper", que queda fuera del ML por ML-D1/ML-D5). Se completa con TASK-010a y TASK-010b.
  - _Refs rationale_: REQ-004 v1.1.0 (probabilidad informativa); NFR-003 (< 2 s).
  - _Output_: Modelo serializado (`.pkl`) cargable por el servicio, con métricas documentadas. Se usa AUC-ROC en lugar de exactitud, que se infla con el desbalance (RD-02).
  - _Verify_: Evaluación con validación cruzada agrupada e intervalos (TASK-010a), y umbral y recall mínimo fijados con revisión clínica (TASK-010b).
  - _Hecho (evidencia, 2026-10-24)_:
    - `backend/ml_service/app/train_baseline.py` entrena y escribe `modelo_hipoglucemia.pkl`, `modelo_hipoglucemia.json` y `baseline_metrics.json` (trasladado desde `backend/app/ml/` en M5a).
    - Métricas documentadas en `docs/model_baseline.md` §4. Reproducidas en memoria con el mismo split (`random_state=42`): AUC 0.640, precisión, recall y F1 de 0.429, matriz `[[25,4],[4,3]]`.
    - Conteos verificados contra el Excel: 109 registros, 100 pacientes, 10 positivos, 4 pacientes mixtos, 193 filas, 17 positivas.
  - _Pendiente_: TASK-010a y TASK-010b. El "umbral aceptable" que pedía el criterio original no existe todavía (ML-D4).
- [x] **TASK-010a** [REQ-004]: Validación cruzada agrupada por paciente con intervalos (ML-D3) y comparación de modelos (ML-D2).
  - _Refs rationale_: ADR-0007; `docs/model_baseline.md` §5. Un solo split con 7 filas positivas de 4 pacientes no permite afirmar mejoras (RIA-01, RD-04).
  - _Output_:
    - Script de validación `backend/ml_service/app/cv_evaluacion.py` (`python -m app.cv_evaluacion` desde `backend/ml_service/`), que escribe `backend/ml_service/app/artefactos/cv_metrics.json` (versionado). Pruebas en `backend/ml_service/tests/`. con `StratifiedGroupKFold` o `GroupKFold` repetido agrupando por `id_paciente_real`, SMOTE-NC dentro de cada fold e intervalos del 95% por bootstrap **sobre pacientes**.
    - Reporte de AUC-ROC, recall, precisión, F1 y Brier por modelo: Regresión Logística (línea base), árbol de decisión y Random Forest, con las mismas semillas y folds.
    - Evaluación de `class_weight` como alternativa o complemento de SMOTE-NC (RD-02).
    - Resultados en el JSON de metadatos y en `docs/model_baseline.md`.
  - _Verify_:
    - Un test comprueba que en ningún fold un paciente aparece en train y validación.
    - El reporte se regenera igual con la misma semilla.
    - La regla de decisión de ML-D2 queda aplicada y documentada: se cambia de modelo solo si el IC de la métrica principal no se solapa con el de la línea base; en empate, gana el más simple.
  - _Hecho (2026-10-24, fase M2)_:
    - `cv_evaluacion.py` reutiliza `construir_pipeline` y `preparar_features`; las variantes solo reemplazan los pasos `smote` y `modelo`.
    - **Esquema** (decisión del usuario): `StratifiedKFold` k=5 sobre **pacientes** (etiqueta: algún registro positivo), mapeado a sus filas, repetido con las semillas 0 a 4. Garantiza 2 pacientes positivos por fold. `StratifiedGroupKFold` k=5 dejó folds sin positivos en 13 de 20 semillas.
    - SMOTE-NC solo dentro del train de cada fold. `assert` sin fuga en cada fold.
    - IC 95% por bootstrap percentil de 1000 remuestreos sobre pacientes.
    - Variantes: RL + SMOTE-NC, RL sin SMOTE-NC, RL `balanced`, árbol `balanced` (max_depth 3, min_samples_leaf 5) y Random Forest `balanced` (300 árboles, max_depth 5, min_samples_leaf 3, valores de la celda D1 del notebook). Ninguno se ajustó.
    - Salida en `backend/ml_service/app/artefactos/cv_metrics.json`, versionada; `baseline_metrics.json` y el `.pkl` no se tocan (huellas verificadas).
    - Pruebas: `python -m pytest tests/ml` desde `backend/` → 11 passed (dataset sintético, sin red ni Excel).
    - Resultado medido: en **ninguna** variante el límite inferior del IC del AUC supera 0.5. Los IC del AUC de todas las variantes se solapan con el de la línea base, así que, según la regla de ML-D2, **no se cambia de modelo**.
  - _Hecho (2026-10-24, fase M2b)_:
    - Dos referencias **sin entrenamiento** en `cv_evaluacion.py`, con los mismos folds, semillas y bootstrap sobre pacientes: puntaje constante (AUC 0.500, recall 1.0, precisión = prevalencia, lift 1.0: comprueba el cálculo de métricas) y regla por medicación (`medicacion_cod`, cortes `>=1`, `>=2`, `>=3`; AUC 0.462 [0.297, 0.640]). Van en la sección `referencias` de `cv_metrics.json`, separada de `variantes`, y no entran en la regla de ML-D2.
    - `cv_metrics.json` reporta además la prevalencia de positivos (global y por fold) y el *lift* (precisión / prevalencia) con IC por umbral. Prevalencia de filas positivas: 0.088 [0.039, 0.146].
    - Pruebas: `python -m pytest tests/ml` → 18 passed. Incluyen la regla por medicación con AUC 1.0 en un caso construido, la constante con AUC 0.5 y lift 1, y que la evaluación completa (variantes y referencias) se regenera idéntica con las mismas semillas.
    - Resultados y su interpretación en `docs/model_baseline.md` §4.1 y §5; fuga leve de la mediana de HbA1c en `docs/risks.md` (RD-05).
    - Conclusión: ninguna variante supera el azar (el límite inferior del IC del AUC no pasa de 0.5 en ninguna); la regla por medicación (0.462) no supera a la línea base (0.631) y los IC se solapan; la precisión de los modelos queda cerca de la prevalencia y todos los IC de lift incluyen 1.0. El modelo se mantiene **experimental**.
  - _Pendiente (fuera de TASK-010a)_: Brier y curva de calibración (pasan a TASK-010b); los resultados con IC quedan en `cv_metrics.json` (design.md 1.4.4).
- [ ] **TASK-010b** [REQ-004]: Umbral y calibración del modelo (ML-D4). Requiere TASK-010a. **En espera: no procede mientras el modelo no supere el azar** (en M2 y M2b ningún límite inferior del IC del AUC supera 0.5).
  - _Refs rationale_: ML-D4: el recall mínimo y el umbral de "Alta" se fijan tras M2 **con revisión clínica**; RIA-06.
  - _Output_:
    - Curva de calibración y Brier; si hace falta, calibración (Platt o isotónica) validada dentro de la validación cruzada agrupada.
    - Propuesta de umbral(es) priorizando recall, revisada por un profesional de la salud.
    - Decisión registrada en un ADR o en ADR-0007 y en design.md. Mientras no exista, el modelo sigue solo informativo y el contrato no devuelve nivel de alerta.
  - _Verify_: El acta o registro de la revisión clínica existe. El recall en validación cruzada con el umbral elegido, con su IC, está documentado. Ningún valor de umbral aparece en el código antes de esta tarea.
- [~] **TASK-011** [REQ-004, NFR-003]: Módulo que carga el modelo y expone la predicción de probabilidad (`predecir_riesgo`, reemplaza a `clasificar_registro`, porque el ML ya no clasifica). Se completa con TASK-011a, 011c y 011d.
  - _Refs rationale_: REQ-004; la latencia debe cumplir NFR-003.
  - _Output_: Función que retorna la probabilidad en < 2 s, expuesta por `POST /api/riesgo/hipoglucemia`.
  - _Verify_: Test de latencia local mide el tiempo de respuesta y confirma p95 < 2000ms.
  - _Hecho (evidencia)_: `backend/ml_service/app/predict.py` (`predecir_riesgo`) carga el bundle del `.pkl` verificando huella y versiones, y `backend/ml_service/app/api/riesgo.py` expone `POST /api/riesgo/hipoglucemia`. El backend de negocio ya no contiene código de ML (TASK-011e). Latencia medida con el modelo real: p50 6.7 ms, p95 8.8 ms.
  - _Pendiente_: lo que falta de TASK-011a (conteos sobre el Excel real, split agrupado y SMOTE-NC ausente en `predict`) y de TASK-011d (verificar `git log --follow` tras el commit).
- [~] **TASK-011a** [REQ-004, NFR-003]: Pruebas pytest del componente ML, sin red y sin el `.pkl` real cuando no haga falta.
  - _Refs rationale_: Hoy no hay pruebas automatizadas del ML; `docs/model_baseline.md` §3 (split sin fuga).
  - _Output_: Tests que cubren:
    - Conteos de `data_prep` sobre el Excel: 109 registros, 100 pacientes, 10 positivos, 193 filas, 17 positivas.
    - El split agrupado sin pacientes compartidos.
    - Que SMOTE-NC no se aplica en `predict`.
    - El contrato de `predecir_riesgo` (probabilidad entre 0 y 1).
    - La latencia p95 < 2000 ms sobre N predicciones locales.
  - _Verify_: `python -m pytest` pasa, y los conteos fallan si se altera el dataset (en una copia temporal).
  - _Hecho (2026-10-24, fase M5a)_: las pruebas viven en `backend/ml_service/tests/` y `python -m pytest` desde esa carpeta da **59 passed**, sin red ni Excel real. Cubren `preparar_features` y `predecir_riesgo` con un modelo pequeño entrenado sobre datos sintéticos dentro de la sesión de pruebas (`test_prediccion.py`), el JSON de metadatos (`test_metadatos.py`), la verificación de huella y versiones (`test_huella.py`), el aislamiento de imports (`test_aislamiento.py`), que ningún log ni excepción contenga valores de entrada (`test_logs.py`), `/health`, la configuración y la validación cruzada (`test_cv_evaluacion.py`, movida desde `backend/tests/ml/`).
  - _Hecho (2026-10-24, fase M5b)_: prueba de latencia sobre el endpoint con el modelo pequeño de prueba (p95 < 2000 ms en 200 predicciones) y pruebas del endpoint; `hba1c` ausente o `None` se trata como faltante (corregido en `predict.py`). Total: 116 passed. Con el modelo real contra `uvicorn`, 200 peticiones: p50 6.7 ms, p95 8.8 ms.
  - _Pendiente_: conteos sobre el Excel real (109 registros, 10 positivos…), el split agrupado, y SMOTE-NC ausente en `predict` (los dos primeros requieren el Excel; en las pruebas se usa solo el sintético).
- [x] **TASK-011b** [REQ-004]: Fijar versiones exactas y metadatos del artefacto (ML-D7).
  - _Refs rationale_: ML-D7; RT-06 (un `.pkl` puede no cargar o cambiar de comportamiento con otras versiones de librerías).
  - _Output_:
    - Versiones exactas de numpy, imbalanced-learn, joblib y openpyxl en el `requirements.txt` que ejecute el modelo, verificadas con `pip index versions` y `pip check`. Candidatas con las que se reprodujeron las métricas: numpy 2.5.4, imbalanced-learn 0.14.2, joblib 1.6.0 y openpyxl 3.1.5, con scikit-learn 1.5.2 y pandas 2.2.3.
    - `train_baseline.py` escribe junto al `.pkl`, que sigue fuera de git, un JSON de metadatos versionado: versión, fecha, SHA-256 del `.pkl`, versiones de librerías y métricas.
  - _Verify_: En un venv limpio, `pip check` sin conflictos. El reentrenamiento reproduce las métricas de `docs/model_baseline.md` §4. El JSON contiene la huella del `.pkl` generado. `git status` no muestra el `.pkl`.
  - _Hecho (2026-10-24, fase M5a)_:
    - `backend/ml_service/requirements.txt` fija pandas 2.2.3, numpy 2.4.6, scikit-learn 1.5.2, imbalanced-learn 0.14.2, scipy 1.15.3, joblib 1.6.0, openpyxl 3.1.5, fastapi 0.162.0, uvicorn 0.54.0, pydantic 2.14.1 y python-dotenv 1.2.4 (pytest 9.1.1 y httpx 0.28.1 en `requirements-dev.txt`), elegidas con `pip index versions`. scipy 1.15.3 es la más reciente sin el aviso `iprint` de scikit-learn 1.5.2 (con 1.16 y 1.17 avisa de deprecación y con 1.18 "Unknown solver options"); numpy 2.4.6 es la más reciente que scipy 1.15.3 admite. No se silenció ningún aviso.
    - `pip check`: sin conflictos, en un venv limpio fuera del repositorio y en `backend/ml_service/.venv`.
    - `python -m app.train_baseline` en ese entorno reproduce AUC 0.6404, recall 0.4286 y la matriz de confusión [[25, 4], [4, 3]] de `docs/model_baseline.md` §4.
    - Escribe `backend/ml_service/app/artefactos/modelo_hipoglucemia.json` (versión, fecha, `sha256_pkl`, versiones, métricas, `random_state`, dataset con su huella, conteos); `git check-ignore` confirma que el `.pkl` queda ignorado.
    - Las métricas con IC de la validación cruzada quedan en `cv_metrics.json`, no en este JSON (design.md 1.4.4).
- [x] **TASK-011c** [REQ-004, NFR-001]: Errores genéricos del endpoint de riesgo. **Se implementa en el endpoint del servicio** (`backend/ml_service/app/api/riesgo.py`, fase M5b); el router antiguo del backend se retiró en TASK-011e sin corregirlo.
  - _Refs rationale_: Hoy responde 400 con `f"No se pudo calcular el riesgo: {exc}"` y 503 con `str(exc)`, que incluye la ruta del archivo. Esto puede filtrar detalles internos o valores. Además, el 422 de FastAPI devuelve los valores recibidos, glucosa incluida (NFR-001).
  - _Output_: 503 y 500 con mensajes genéricos en español; manejador propio de 422 sin eco de la entrada; sin la excepción encadenada en la respuesta.
  - _Verify_: Tests con TestClient: modelo ausente → 503 genérico sin rutas; error de inferencia simulado → 500 genérico; entrada inválida → 422 sin el valor de glucosa en el cuerpo.
  - _Hecho (2026-10-24, fase M5b)_: `backend/ml_service/app/api/riesgo.py` y `tests/test_api_riesgo.py`. 422 con manejador propio (13 casos de entrada inválida, JSON malformado, cuerpo no UTF-8 y cuerpo vacío, ninguno repite lo enviado; el 400 de FastAPI se convierte en 422); 503 con `ModeloNoDisponible` o configuración inválida (también con un `.pkl` alterado real); 500 genérico para cualquier otro error, sin el texto de la excepción (el log solo lleva el nombre de la clase). El router antiguo del backend, que sí repetía la entrada, se eliminó en TASK-011e.
- [~] **TASK-011d** [REQ-004, NFR-001]: Scaffolding del servicio `backend/ml_service/` (design.md § Servicio de ML).
  - _Refs rationale_: Aislamiento tipo `nlp_service` (ADR-0006); ML-D8 (sin ingreso público, solo el backend lo llama).
  - _Output_:
    - Servicio con `GET /health`, que informa si el modelo está cargado.
    - `POST /api/riesgo/hipoglucemia` con el contrato propuesto: solo `riesgo_hipoglucemia` y `version_modelo`, **sin `alerta`**.
    - Verificación de huella y versiones al cargar el artefacto (→ 503).
    - Archivos propios: `requirements*.txt`, `.env.example`, README, `tests/` y `test_ml.sh`.
    - Código y dataset trasladados con `git mv` desde `backend/app/ml/` y `backend/data/raw/`.
  - _Verify_: `pytest` desde `backend/ml_service/` en verde. `pip check` limpio. `GET /health` → 200 con uvicorn. Un grep no encuentra imports de `backend/app`. `git log --follow` del dataset muestra su historial. El reentrenamiento en el servicio reproduce las métricas.
  - _Hecho (2026-10-24, fase M5a)_:
    - `backend/ml_service/` con `app/` (`main.py` con `GET /health` e indicador `modelo_cargado`, `config.py`, `errors.py`, `metadatos.py`), `tests/`, `requirements.txt` y `requirements-dev.txt` propios, `.env.example` (solo nombres), README, `.venv` propio y puerto 8002.
    - Traslado con `git mv` (git status los muestra como renombrados) de `data_prep.py`, `train_baseline.py`, `predict.py`, `exportar_dataset.py` y `ShanghaiT2DM_Summary.xlsx`. `cv_evaluacion.py`, `cv_metrics.json` y las pruebas de M2 no tenían historial en git: se movieron sin `git mv`. Imports del servicio relativos a su propio paquete (`app.data_prep`, no `app.ml...`).
    - `predict.py` verifica huella y versiones antes de deserializar, una sola vez por proceso, y lanza `ModeloNoDisponible` genérico (→ 503 en M5b).
    - Decisión del usuario (M5a): `backend/app/ml/` conservó temporalmente `riesgo.py` y copias idénticas de `data_prep.py` y `predict.py`; se retiraron en TASK-011e.
    - Verificado: `pytest` en `backend/ml_service` → 59 passed; `pip check` limpio; `GET /health` del servicio → 200; `GET /health` del backend → 200 y `POST /api/riesgo/hipoglucemia` del backend sigue respondiendo.
  - _Hecho (2026-10-24, fase M5b)_: `POST /api/riesgo/hipoglucemia` en el servicio con el contrato sin `alerta` (valores permitidos validados, campos adicionales → 422, 4 decimales, `version_modelo` del JSON); `ML_ENABLE_DOCS` (404 en `/docs`, `/redoc` y `/openapi.json` por defecto; encendida documenta 200/422/500/503 con esquema y ejemplo sintético en español); `test_ml.sh` movido con `git mv` y adaptado al servicio (puerto 8002, no reentrena si existe el `.pkl`, se apaga solo). Verificado con `uvicorn` en el 8002: `curl` real → 200 con `{riesgo_hipoglucemia, version_modelo}`; `GET /health` → 200.
  - _Pendiente_: comprobar `git log --follow` del dataset y de los módulos movidos una vez hecho el commit (no se puede verificar antes); el despliegue sin ingreso público (TASK-002b) y la autenticación entre servicios (Open Question).
- [x] **TASK-011e** [REQ-004]: Retirar `backend/app/ml/` del backend. Requiere TASK-011d.
  - _Refs rationale_: Evitar dos implementaciones del modelo; design.md § Servicio de ML (estado actual vs. destino).
  - _Output_:
    - `backend/app/main.py` sin el router de riesgo.
    - `backend/app/ml/` y `backend/app/test_ml.sh` eliminados (ya trasladados).
    - Dependencias de ML (scikit-learn, imbalanced-learn, pandas, numpy, joblib, openpyxl) retiradas de `backend/requirements.txt` si el backend ya no las usa.
    - README y `docs/model_baseline.md` §1 con las rutas nuevas.
  - _Verify_: `git grep "app.ml"` en `backend/app` no retorna resultados. El backend arranca y `/health` → 200. `pip check` del backend sin conflictos.
  - _Hecho (2026-10-24, fase M6)_:
    - Eliminados `backend/app/ml/` completo (`riesgo.py`, las copias transitorias de `data_prep.py` y `predict.py`, `__init__.py`, `dataset_inputs_hipoglucemia.csv` y el `.pkl` local ignorado por git) y, antes, `backend/app/test_ml.sh` (movido a `backend/ml_service/` en M5b). No quedaba ningún test del backend que cubrir: las pruebas de ML ya vivían en `backend/ml_service/tests/`.
    - `backend/app/main.py` sin el router de riesgo; `POST /api/riesgo/hipoglucemia` en el backend responde 404. No se tocó supabase, auth ni `core/`.
    - `backend/requirements.txt` sin scikit-learn, pandas, numpy, imbalanced-learn, openpyxl y joblib (ningún módulo de `backend/app` las usa). En un venv limpio fuera del repo: `pip check` sin conflictos y ninguna librería de ML instalada.
    - `uvicorn app.main:app` del backend con ese venv: `GET /health` → 200. `pytest` en `backend/ml_service` → 116 passed y en `backend/nlp_service` → 90 passed. El backend no tiene pruebas propias todavía.
    - `backend/ml_service/app/artefactos/cv_metrics.json` regenerado con numpy 2.4.6 y scipy 1.15.3: solo cambian la fecha, las versiones y `generado_por`; todas las cifras son idénticas.
    - Documentación sin referencias al endpoint antiguo ni al campo `alerta` como estado actual (README, design.md 1.4.6, ADR-0004/0006/0007/0008, `docs/`, CLAUDE.md, CONTEXT.md).
- [ ] **TASK-012a** [REQ-005]: Clasificación ADA en la lógica de negocio del backend: `backend/app/core/reglas_ada.py` (design.md § Clasificación ADA), con constantes propias y test de contrato contra `docs/nlp/umbrales_ada_v1.json`.
  - _Refs rationale_: ML-D5 (el ML no clasifica); decisión del usuario (M1): el backend clasifica Normal/Hipo/Hiper con umbrales ADA.
  - _Output_: `clasificar_lectura(nivel, momento)` → `Normal` \| `Riesgo Hipo` \| `Riesgo Hiper`. La regla para el momento `otro` queda según lo que resuelva la Open Question de design.md.
  - _Verify_: Tests de valores límite: 69, 70, 130, 131, 179 y 180 en ayunas y postprandial. El test de contrato falla si cambia una constante o el JSON de referencia.
- [ ] **TASK-012** [REQ-005]: Lógica de negocio del backend que genera alertas al médico cuando la **clasificación ADA** (TASK-012a) es de riesgo. **El modelo de ML no interviene** (ML-D5): su probabilidad es informativa y no dispara alertas (REQ-004, ML-D4).
  - _Refs rationale_: REQ-005 — toda clasificación riesgosa debe generar una alerta; la decide la lógica de negocio, no el modelo.
  - _Output_: Función que, dada una `clasificacion_ada` de riesgo, crea un registro en T_Alertas.
  - _Verify_: Test unitario: clasificación "Riesgo Hipo" produce exactamente una fila nueva en T_Alertas. Un registro con `riesgo_hipoglucemia` alto y clasificación "Normal" no produce ninguna.
- [ ] **TASK-013** [REQ-006]: Implementar el chatbot como **servicio NLP independiente** en `backend/nlp_service/` (ADR-0006; design.md § Servicio NLP (chatbot) Design). Se completa al cerrar TASK-013a, 013b, 013c, 013d, 013i, 013j, 013f y 013g. Todas las rutas de las subtareas son relativas a `backend/nlp_service/`, salvo que se indique otra cosa.
  - _Refs rationale_: REQ-006 requiere respuestas informativas sobre diabetes, nutrición y niveles de glucosa.
  - _Output_: Función `responder_consulta(texto)` que retorna una respuesta con aclaración de que no reemplaza consejo médico.
  - _Verify_: Consulta de prueba ("¿Qué debo comer si mi glucosa está en 70 mg/dL?") retorna una respuesta no vacía con el disclaimer incluido (con `FakeProvider` en pruebas automatizadas).
  - Orden sugerido: 013a → 013b → 013c → 013j → 013d → 013i → TASK-018 → 013f → 013g. TASK-013k es independiente y conviene hacerla antes de TASK-001. TASK-013h es post-v1.
- [x] **TASK-013a** [REQ-006]: Scaffolding del servicio — `backend/nlp_service/` con `app/main.py` (`GET /health`), `tests/`, `requirements.txt` (versiones exactas propias: fastapi, uvicorn, pydantic, google-genai), `requirements-dev.txt` (pytest y lo necesario para `TestClient`), `.env.example` (solo nombres de variables de design.md) y `README.md` (instalar, configurar, correr desde `backend/nlp_service/`, probar).
  - _Refs rationale_: ADR-0006: servicio aislado, sin importar `backend/app/` ni compartir requirements. Las versiones no dependen de las de supabase del backend.
  - _Output_: Servicio ejecutable con `uvicorn app.main:app` desde `backend/nlp_service/`. Las versiones de `requirements.txt` se verifican con `pip index versions` y no se suponen.
  - _Verify_: En un venv limpio fuera del repo: `pip install -r requirements.txt -r requirements-dev.txt` y `pip check` → sin conflictos. `pytest` (desde `backend/nlp_service/`) cubre `GET /health` → 200. `git grep -nE "from app\.(core|ml)|import app\.(core|ml)|backend/app" backend/nlp_service` no retorna resultados.
  - _Resultado (2026-10-24)_: versiones de `pip index versions` → fastapi 0.162.0, pydantic 2.14.1, uvicorn 0.54.0, google-genai 2.33.0, python-dotenv 1.2.4 (dev: pytest 9.1.1, httpx 0.28.1). `pip check` → "No broken requirements found." en un venv limpio del scratchpad y en `backend/nlp_service/.venv`. `tests/test_health.py` pasa; `uvicorn app.main:app --port 8001` + `curl /health` → 200. `git grep --untracked` de aislamiento sin resultados, más `tests/test_aislamiento.py`. Se agregaron `.venv/` y `.pytest_cache/` del servicio a `.gitignore`.
- [x] **TASK-013b** [REQ-006]: Corpus — `git mv docs/nlp/reglas_ada_v1.txt backend/nlp_service/app/corpus/reglas_ada_v1.txt` (sin cambios de contenido); crear `app/corpus/reglas_ada_v1.1.txt` (mismo contenido con tildes, descargo literal «Consulta siempre a tu médico tratante para cambios en tu medicación.» en una sola línea (en v1 está partido por un salto de línea) y encabezado que ya no atribuya el motor de reglas a `app/ml/riesgo.py`); crear `docs/nlp/umbrales_ada_v1.json` con el formato de design.md; actualizar las referencias en `docs/` y `README.md`. Requiere TASK-013a.
  - _Refs rationale_: ADR-0006 (corpus dentro del servicio, reemplaza el destino de D9); corpus_conocimiento.md §4 (un archivo nuevo por versión, nunca sobrescribir); el Golden Dataset permanece en `docs/nlp/`.
  - _Output_: v1 movido con historial; v1.1 como corpus vigente; archivo de referencia JSON versionado; ninguna referencia a `docs/nlp/reglas_ada_v1.txt` en el repositorio.
  - _Verify_: `git grep "docs/nlp/reglas_ada_v1.txt"` no retorna resultados; `git log --follow backend/nlp_service/app/corpus/reglas_ada_v1.txt` muestra el historial previo; `git diff --no-index` entre v1 y v1.1 muestra solo tildes y el encabezado; `python -m json.tool docs/nlp/umbrales_ada_v1.json` lo valida.
  - _Resultado parcial (2026-10-24)_: `git mv` hecho (git status: `R docs/nlp/… -> backend/nlp_service/app/corpus/reglas_ada_v1.txt`); v1.1 y JSON creados; referencias actualizadas (solo quedan las de esta misma tarea en tasks.md). El diff v1 → v1.1 muestra tildes, el descargo en una línea, el encabezado y la nota "[PENDIENTE…]" movida del cuerpo al encabezado para que no llegue al LLM; las reglas no cambian.
  - _Cierre (2026-10-24)_: commit `de9e753`. `git log --follow backend/nlp_service/app/corpus/reglas_ada_v1.txt` muestra `de9e753` y el historial previo `c80225f` ("docs(nlp): corpus de conocimiento…"), y `git show --stat de9e753` registra el renombre con 0 líneas cambiadas. Con esto se cumplen todos los puntos de _Verify_.
- [x] **TASK-013c** [REQ-006, NFR-001]: Config propia y constantes — `app/config.py` (variables del servicio de design.md; ninguna clave con valor por defecto) y `app/clinical.py` (70, 130, 180 mg/dL; 15 g; 15 min; `DESCARGO_MEDICO` con tildes). Requiere TASK-013a.
  - _Refs rationale_: ADR-0006 (cada servicio tiene su copia de constantes; reemplaza `backend/app/core/clinical.py`); D3 (auth, longitud, tasa por entorno); NFR-001 (clave solo por entorno).
  - _Output_: Settings validados. La configuración incompleta del proveedor levanta el error que el router mapea a 503. Temperature no es variable de entorno.
  - _Verify_: `pytest` cubre: configuración completa con `NLP_PROVIDER=fake` carga sin clave; con `NLP_PROVIDER=gemini` sin `NLP_PROVIDER_API_KEY`, levanta "no configurado"; `NLP_TEMPERATURE` no es leída por `config.py`.
  - _Resultado (2026-10-24)_: `tests/test_config.py` pasa (fake sin clave; gemini sin `NLP_MODEL` o sin `NLP_PROVIDER_API_KEY` nombra solo la variable; valores inválidos; `NLP_TEMPERATURE` ignorada; la clave no aparece en `repr`). Valores por defecto: timeout 30 s, descargo forzado `true`, auth `true`, 1000 caracteres, 10/min.
- [x] **TASK-013d** [REQ-006, NFR-001]: Proveedores — `app/llm_client.py` (interfaz `LLMClient`, `GeminiProvider` con `google-genai`, `FakeProvider`; `OpenAIProvider` diferido) y `app/errors.py`. Requiere TASK-013c.
  - _Refs rationale_: ADR-0005 (D1, D2): proveedor por `NLP_PROVIDER`, modelo por `NLP_MODEL`, id exacto del modelo disponible por corrida.
  - _Output_: `get_llm_client()` retorna la implementación según `NLP_PROVIDER`; fallos y timeouts del SDK se traducen a los errores de `errors.py`, sin el texto de la consulta en el mensaje.
  - _Verify_: `pytest` cubre `NLP_PROVIDER=fake` → `FakeProvider`, valor desconocido → error de configuración, y `GeminiProvider` con el cliente del SDK sustituido por un doble (sin red) que traduce excepción → fallo del proveedor y timeout → timeout. Ningún test hace llamadas de red.
  - _Resultado (2026-10-24)_: `tests/test_llm_client.py` pasa. Los errores del SDK (`ServerError`, `ClientError`, `httpx.ReadTimeout`, otros) se traducen sin el texto de la consulta y sin excepción encadenada. El timeout se pasa en milisegundos (`HttpOptions`) y el SDK no reintenta (sin `retry_options`). No se probó contra la API real.
- [x] **TASK-013e** []: Resolver el conflicto de dependencias D11 (`google-genai` exige `httpx>=0.28.1`; `supabase==2.7.4` exige `httpx<0.28`). Elegir una opción de ADR-0005 § Consecuencias con aprobación del equipo y actualizar `requirements.txt`. **Superada por ADR-0006** (el chatbot tiene su propio `requirements.txt`; ver TASK-013k).
  - _Refs rationale_: ADR-0005 (D11).
  - _Output_: `backend/requirements.txt` instalable con el SDK del proveedor y el cliente de Supabase en el mismo entorno; decisión registrada en ADR-0005.
  - _Verify_: En un venv limpio, `pip install -r backend/requirements.txt` termina sin conflictos, `pip check` no reporta incompatibilidades y `python -c "import supabase, google.genai"` no falla.
  - _Resultado (2026-10-24)_: opción 1 — `supabase==2.16.0` + `httpx==0.28.1`. Venv limpio con `-r requirements.txt google-genai`: `pip check` → "No broken requirements found."; imports OK; `GET /health` vía TestClient → 200. Evidencia en ADR-0005. Se revierte en TASK-013k.
- [ ] **TASK-013f** [REQ-006]: Golden Dataset v1.1 en `docs/nlp/` — mismas 20 preguntas que v1, con todos los checks ejecutables por código, sin LLM como juez (D5), más `app/checks.py` en el servicio. Requiere TASK-013a.
  - _Refs rationale_: D5; docs/nlp/baseline_chatbot.md §3. Los checks semánticos de v1 (`descargo_medico`, `no_puedo_recomendar_dosis`, `no_tengo_informacion`, `consulta_profesional`, `aumentar_dosis`) no son evaluables literalmente.
  - _Output_: `docs/nlp/golden_dataset_v1.1.csv` (v1 se conserva sin cambios) con la regla de coincidencia documentada (mayúsculas, acentos, límites de palabra), y `descargo_medico` definido como `clinical.DESCARGO_MEDICO`; `checks.py` evalúa `contiene:` / `NO_contiene:`.
  - _Verify_: Las preguntas y categorías de v1.1 son idénticas a v1 (test o diff); los tests de `checks.py` cubren un caso que pasa y uno que falla por cada pregunta.
- [ ] **TASK-013g** [REQ-006]: Script de evaluación del baseline `app/evaluation.py`: corridas sin contexto y con contexto (corpus v1.1) sobre Golden Dataset v1.1 → `app/nlp_baseline_metrics.json`. Requiere TASK-013i y TASK-013f.
  - _Refs rationale_: docs/nlp/baseline_chatbot.md §4; D2 (id exacto del modelo, temperature 0.2); D6 (métrica sobre salida cruda; descargo forzado aparte). Gemini tier gratuito solo con las 20 preguntas sintéticas (D1).
  - _Output_: JSON con adherencia por categoría y global, `modelo_llm` exacto, `temperature`, versión del corpus y del Golden Dataset, y adherencia con descargo forzado reportada aparte; `baseline_chatbot.md` §4 actualizado con estos campos.
  - _Verify_: Corrida con `FakeProvider` produce un JSON válido con todos los campos (en pruebas automatizadas); una corrida manual con Gemini registra el id del modelo devuelto por el proveedor.
- [ ] **TASK-013h** [REQ-006]: *(Post-v1, no bloquea TASK-013)* Corpus v2 con manejo de emergencias (síntomas severos, pérdida de conciencia, etc.), con revisión clínica (D7).
  - _Refs rationale_: D7: emergencias fuera de alcance de v1; corpus_conocimiento.md §4 exige un archivo nuevo por versión.
  - _Output_: `app/corpus/reglas_ada_v2.txt` revisado por un profesional de la salud, con preguntas de emergencia agregadas a una nueva versión del Golden Dataset.
  - _Verify_: Revisión clínica firmada/documentada; el test de contrato de TASK-013j pasa también con v2.
- [x] **TASK-013i** [REQ-006, NFR-001]: Prompt y servicio — `app/prompt_builder.py` y `app/service.py` con `responder_consulta(texto, *, con_contexto=True)`, `TEMPERATURE = 0.2` y el descargo por código con `NLP_ENFORCE_DISCLAIMER`; más la herramienta de prueba manual `app/dev_chat.py` (`python -m app.dev_chat [--sin-contexto]`, solo stdout, sin archivos ni logs, nombra solo la variable faltante). Requiere TASK-013b y TASK-013d.
  - _Refs rationale_: ADR System Prompting vs. RAG (corpus completo en el system prompt); D6 (descargo por código, reportado aparte); D8 (sin estado).
  - _Output_: El system prompt contiene íntegro el cuerpo de `app/corpus/reglas_ada_v1.1.txt` (sin el encabezado de metadatos); al proveedor solo se envían el system prompt y el texto del usuario.
  - _Verify_: Test con `FakeProvider` que captura la llamada: el prompt contiene el cuerpo del corpus, no contiene el encabezado y no incluye ningún otro dato; `temperature` enviada = 0.2; con `NLP_ENFORCE_DISCLAIMER=true` una respuesta sin descargo sale con `DESCARGO_MEDICO` y con `false` sale intacta; los mensajes de excepción no contienen el texto de la consulta.
  - _Resultado (2026-10-24)_: `tests/test_service.py`, `tests/test_prompt_builder.py` y `tests/test_dev_chat.py` pasan. Con FakeProvider, `responder_consulta('¿Qué debo comer si mi glucosa está en 70 mg/dL?')` → texto no vacío con descargo (también verificado fuera de pytest). El descargo no se duplica si el LLM ya lo escribió (comparación sin tildes, mayúsculas ni saltos de línea). `dev_chat` con proveedor real no se probó.
- [x] **TASK-013j** [REQ-006]: Test de contrato clínico — `tests/test_contrato_clinico.py` compara `app/clinical.py` con `docs/nlp/umbrales_ada_v1.json` y con `app/corpus/reglas_ada_v1.1.txt`. Requiere TASK-013b y TASK-013c.
  - _Refs rationale_: ADR-0006 (duplicación de constantes mitigada por contrato); corpus_conocimiento.md §3.
  - _Output_: Test que falla ante cualquier diferencia de umbral o del texto del descargo entre las tres fuentes.
  - _Verify_: `pytest tests/test_contrato_clinico.py` pasa sin red; alterar un valor en `clinical.py`, en el JSON o en el corpus (en una copia temporal) hace fallar el test.
  - _Resultado (2026-10-24)_: pasa (11 casos). Mutaciones en copias temporales fuera del repo: `clinical.py` 130→131 → 3 fallan; JSON 180→190 → 1 falla; descargo sin tilde en el corpus → 1 falla; corpus "70 a 125" → 2 fallan.
- [ ] **TASK-013k** []: Desacoplar el backend del chatbot — revertir en `backend/requirements.txt` `supabase==2.16.0` a `supabase==2.7.4` y quitar `httpx==0.28.1`; retirar `NLP_PROVIDER_API_KEY` de `backend/.env.example`; quitar "chatbot" del comentario de routers de `backend/app/main.py`.
  - _Refs rationale_: ADR-0006 y ADR-0005 (D11 superado): el backend ya no necesita `httpx>=0.28.1` y vuelve a su pin original, sin adoptar cambios del cliente Supabase que no necesita (hoy ningún código importa `supabase`).
  - _Output_: Backend sin dependencias ni variables del chatbot.
  - _Verify_: En un venv limpio fuera del repo: `pip install -r backend/requirements.txt` y `pip check` → sin conflictos; `python -c "import supabase"` funciona; `TestClient(app).get('/health')` → 200; `git grep NLP_ backend/.env.example` no retorna resultados.

## Phase 4: Capa de API
*Goal*: Exponer la lógica de negocio como endpoints REST autenticados, según design.md § API / Interface Design.

- [ ] **TASK-014** [REQ-001]: Implementar `POST /auth/login` con verificación de hash y emisión de token.
  - _Refs rationale_: REQ-001.
  - _Output_: Endpoint funcional que retorna token válido para credenciales correctas y 401 para incorrectas.
  - _Verify_: Test de integración cubre login exitoso y fallido.
- [ ] **TASK-015** [REQ-002]: Implementar `POST /auth/registro` restringido a Administrador, con validación de matrícula para médicos.
  - _Refs rationale_: REQ-002.
  - _Output_: Endpoint que rechaza alta de médico sin matrícula válida.
  - _Verify_: Test de integración: alta de médico sin matrícula retorna error de validación.
- [ ] **TASK-016** [REQ-003]: Implementar `POST /pacientes/{id}/registros-glucosa`.
  - _Refs rationale_: REQ-003.
  - _Output_: Endpoint que persiste un nuevo registro de glucosa.
  - _Verify_: Test de integración crea un registro y lo recupera vía GET.
- [ ] **TASK-017** [REQ-004, REQ-005]: Conectar el guardado de un registro de glucosa con la clasificación ADA (TASK-012a) y, si es de riesgo, con la alerta y la notificación push (TASK-012). Además, pedir la probabilidad informativa al servicio de ML (`ML_SERVICE_URL`, red interna) y guardarla. Requiere resolver la Open Question del perfil clínico en Data Models.
  - _Refs rationale_: REQ-004 v1.1.0 y REQ-005; ML-D5 (las alertas las decide la lógica de negocio) y ML-D8 (solo el backend llama al servicio de ML).
  - _Output_: Al llamar TASK-016, el registro queda con `clasificacion_ada` y, si aplica, se dispara una notificación push al médico asignado. `riesgo_hipoglucemia` y `riesgo_modelo_version` se guardan si el servicio responde. Si el servicio de ML falla, el registro se guarda igual con NULL, sin bloquear ni alterar la alerta.
  - _Verify_: Tests end-to-end: un registro con nivel crítico genera alerta en T_Alertas y una notificación push mockeada; con el servicio de ML caído (mock), el registro se guarda y la alerta se genera igual; la probabilidad nunca crea alertas.
- [x] **TASK-018** [REQ-006, NFR-001]: Implementar `POST /api/chatbot/consulta` **en el servicio NLP**: `backend/nlp_service/app/api/chatbot.py`, `app/auth.py` (dependencia reemplazable; 401 con `CHATBOT_REQUIRE_AUTH=true` hasta TASK-014), `app/rate_limit.py` (en memoria, por IP), montaje en `app/main.py` y `backend/nlp_service/test_chatbot.sh`, según el contrato de design.md § API (sin estado, límites de longitud y tasa). Requiere TASK-013i.
  - _Refs rationale_: REQ-006; D3, D8, D10; ADR-0006 (servicio expuesto directamente a la app, seguridad propia). Sin despliegue público hasta TASK-014 (divergencia registrada en CONTEXT.md). Cuando exista TASK-014, `auth.py` se conecta a la validación local del token de sesión.
  - _Output_: Endpoint que recibe `{texto}` y retorna `{respuesta}`; errores 422 / 429 (`CHATBOT_RATE_LIMIT_PER_MINUTE`) / 503 / 502 / 504.
  - _Verify_: `pytest` desde `backend/nlp_service/` con `FakeProvider` cubre 200 con respuesta no vacía, 422 (vacío y mayor a `CHATBOT_MAX_INPUT_CHARS`), 429, 503, 502 y 504; con `CHATBOT_REQUIRE_AUTH=true` y sin token, la dependencia rechaza la llamada; comprueba que el texto de la consulta no aparece en logs capturados (`caplog`) ni en el `detail` de errores.
  - _Resultado (2026-10-24)_: `tests/test_api_chatbot.py` y `tests/test_rate_limit.py` pasan; la suite completa da 90 passed.
    - Casos cubiertos: 200 con descargo; 422 (vacío, solo espacios, sin campo, no string, demasiado largo, JSON malformado, cuerpo no UTF-8); 429 con `Retry-After`; 503 (cinco configuraciones); 502; 504; 401 (también por defecto); orden auth → tasa → entrada → proveedor; el texto no aparece en `caplog` ni en las respuestas.
    - Además, FastAPI respondía **400** en inglés ante un cuerpo no UTF-8; se mapea al 422 genérico del contrato.
    - `./test_chatbot.sh` (PORT=8002) con `NLP_PROVIDER=fake` y `CHATBOT_REQUIRE_AUTH=false` → 200, respuesta no vacía y con descargo. No se probó contra Gemini real.
- [ ] **TASK-019** [REQ-007]: Implementar `GET /pacientes/{id}/historial` con filtro por rango de fechas.
  - _Refs rationale_: REQ-007.
  - _Output_: Endpoint que retorna registros filtrados por fecha, accesible por Paciente y Médico.
  - _Verify_: Test de integración filtra correctamente por rango diario/semanal/mensual.
- [ ] **TASK-020** [REQ-008]: Implementar `GET /pacientes/{id}/reporte-pdf`.
  - _Refs rationale_: REQ-008.
  - _Output_: Endpoint que genera y retorna un PDF con la evolución clínica del paciente.
  - _Verify_: Test de integración descarga un PDF válido (content-type `application/pdf`, tamaño > 0).

## Phase 5: Frontend Móvil
*Goal*: Construir las pantallas de React Native que consumen la API de la Fase 4.

- [ ] **TASK-021** [REQ-001]: Pantalla de login conectada a `POST /auth/login`.
  - _Refs rationale_: REQ-001.
  - _Output_: Pantalla funcional que almacena el token de sesión.
  - _Verify_: Login manual exitoso navega a la pantalla principal; login fallido muestra error.
- [ ] **TASK-022** [REQ-003]: Pantalla de registro de toma de glucosa.
  - _Refs rationale_: REQ-003.
  - _Output_: Formulario que envía nivel, hora y momento del día al backend.
  - _Verify_: Registro manual desde la app aparece reflejado en el historial (TASK-023).
- [ ] **TASK-023** [REQ-007]: Pantalla de historial con lista y gráfico (diario/semanal/mensual).
  - _Refs rationale_: REQ-007.
  - _Output_: Vista con toggle entre lista y gráfico, filtrable por período.
  - _Verify_: Cambiar el filtro de período actualiza correctamente los datos mostrados.
- [ ] **TASK-024** [REQ-006]: Pantalla de Chatbot.
  - _Refs rationale_: REQ-006.
  - _Output_: Interfaz de chat conectada a `POST /api/chatbot/consulta` del servicio NLP, con una URL base propia `NLP_API_BASE_URL` en `mobile/src/services/` (separada de `API_BASE_URL` del backend, configurable por ambiente). Mensajes de error para 422, 429 y 502/503/504.
  - _Verify_: Enviar una consulta manual muestra la respuesta del servicio NLP en pantalla; con `NLP_API_BASE_URL` apuntando a un servicio caído se muestra un error amigable sin el texto de la consulta.

## Phase 6: Tests y Validación
*Goal*: Verificar que el sistema cumple los NFR y que el flujo completo funciona de punta a punta.

- [ ] **TASK-025** [NFR-001]: Auditoría de seguridad — confirmar hash de contraseñas y HTTPS forzado en todos los endpoints.
  - _Refs rationale_: NFR-001.
  - _Output_: Reporte de auditoría manual o automatizada.
  - _Verify_: Ningún endpoint acepta HTTP plano; intento de conexión HTTP es rechazado o redirigido.
- [ ] **TASK-025a** [NFR-001]: Incluir el servicio NLP en la auditoría de seguridad: HTTPS forzado, límites de longitud y tasa, autenticación activa (`CHATBOT_REQUIRE_AUTH=true`) y ausencia del texto de las consultas en logs. No bloquea las tareas TASK-013.
  - _Refs rationale_: NFR-001; ADR-0006 (superficie expuesta); design.md § Security Design — Servicio NLP; docs/risks.md RT-03.
  - _Output_: Sección del reporte de auditoría dedicada al servicio NLP.
  - _Verify_: Una petición HTTP plana a la URL del servicio NLP es rechazada o redirigida; una petición sin token se rechaza; superar `CHATBOT_RATE_LIMIT_PER_MINUTE` devuelve 429; los logs del despliegue muestran solo metadatos tras una consulta de prueba.
- [ ] **TASK-025b** [NFR-001]: Incluir el servicio de ML en la auditoría de seguridad: sin ingreso público, solo el backend lo alcanza, sin valores clínicos (glucosa ni perfil) en logs ni en errores, y verificación de huella y versiones del artefacto. No bloquea las tareas del modelo.
  - _Refs rationale_: NFR-001; ADR-0008 (sin autenticación propia en v1, riesgo de exposición accidental); design.md § Security Design — Servicio de ML; docs/risks.md RT-06.
  - _Output_: Sección del reporte de auditoría dedicada al servicio de ML, que incluye el estado de la Open Question de autenticación entre servicios.
  - _Verify_: Un intento de conexión desde fuera de la red interna falla. Una petición inválida devuelve 422 sin la glucosa en el cuerpo. Los logs del despliegue tras una predicción de prueba no contienen valores clínicos. Con un `.pkl` cuya huella no coincide con el JSON de metadatos, el servicio responde 503.
- [ ] **TASK-026** [NFR-002]: Prueba de disponibilidad — monitoreo configurado en Azure con alertas de caída.
  - _Refs rationale_: NFR-002.
  - _Output_: Dashboard de monitoreo de uptime activo.
  - _Verify_: Simulación de caída del servicio dispara una alerta de monitoreo.
- [ ] **TASK-026a** [NFR-002]: Monitoreo de uptime propio del servicio NLP en Azure, sobre `GET /health`, con alertas de caída independientes de las del backend. No bloquea las tareas TASK-013.
  - _Refs rationale_: NFR-002; ADR-0006 (despliegue y observabilidad separados); docs/risks.md RT-04.
  - _Output_: Monitor de uptime del servicio NLP activo en el mismo dashboard que el backend.
  - _Verify_: Detener el servicio NLP dispara una alerta de monitoreo sin afectar la del backend.
- [ ] **TASK-026b** [NFR-002]: Monitoreo de uptime propio del servicio de ML sobre `GET /health`, que indica también si el modelo está cargado, sondeado desde dentro de la red interna, con alertas independientes. No bloquea las tareas del modelo.
  - _Refs rationale_: NFR-002; ADR-0008 (tercer despliegue). Como la probabilidad no es bloqueante, una caída del servicio de ML pasaría inadvertida en el flujo del backend.
  - _Output_: Monitor de uptime del servicio de ML en el mismo dashboard que el backend y el servicio NLP.
  - _Verify_: Detener el servicio de ML, o arrancarlo sin el artefacto, dispara una alerta de monitoreo sin afectar las del backend ni las del NLP.
- [ ] **TASK-027** [NFR-003]: Prueba de carga sobre `POST /api/riesgo/hipoglucemia` del servicio de ML, en la llamada backend → servicio de ML.
  - _Refs rationale_: NFR-003.
  - _Output_: Reporte de latencia bajo carga simulada (ej. con Locust o k6).
  - _Verify_: p95 de latencia < 2000ms bajo carga esperada.
- [ ] **TASK-028** [NFR-004]: Prueba de usabilidad con al menos 5 usuarios de distintos rangos etarios.
  - _Refs rationale_: NFR-004.
  - _Output_: Reporte de usabilidad con hallazgos y ajustes de UX.
  - _Verify_: Los 5 usuarios completan el flujo de registro de glucosa sin ayuda externa.

---

## Completed Tasks Archive
<!-- Move [x] tasks here at end of each sprint to keep active list clean -->
