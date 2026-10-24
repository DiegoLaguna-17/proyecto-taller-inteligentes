# 8. Modelo de ML como servicio independiente

* **Estado:** Aceptado
* **Fecha de decisión:** 2026-10-24
* **Autores:** Equipo GlucoTracker (decisión tomada por el equipo; ML-D8)

## Contexto y Problema
ADR-0006 sacó el chatbot del monolito (ADR-0001) y dejó explícitamente la migración del modelo de ML como "una decisión aparte". Desde entonces cambiaron tres cosas:

1. **El alcance del ML se redujo (ML-D1, ML-D5, REQ-004 v1.1.0).** El modelo solo estima una probabilidad informativa de hipoglucemia. No clasifica Normal/Hipo/Hiper ni decide alertas: eso lo hace la lógica de negocio del backend (`backend/app/core/reglas_ada.py`, TASK-012a). El ML deja de ser parte del flujo crítico de alertas.
2. **Dependencias pesadas y frágiles.** scikit-learn, imbalanced-learn, pandas, numpy, joblib y openpyxl, con un `.pkl` que depende de las versiones exactas con que se entrenó (RT-06, ML-D7). Compartir `requirements.txt` con el backend ata la actualización de cualquier librería del backend a reentrenar o volver a verificar el modelo. Es el mismo problema que D11 causó con el chatbot.
3. **Ciclo de vida propio.** Validación cruzada, calibración, umbral con revisión clínica (ML-D2 a ML-D4) y reentrenamiento con datos propios en el futuro (RD-01).

Al decidirlo, el código vivía en `backend/app/ml/` y el router `riesgo.py` estaba montado en el backend.

## Alternativas Consideradas
1. **Mantener el ML en el monolito (`backend/app/ml/`):**
   * Pros: un despliegue menos, sin llamada de red y sin un segundo `requirements.txt`.
   * Contras: el `requirements.txt` compartido ata las versiones del modelo a las del backend (RT-06). Una carga o falla del modelo comparte proceso con los endpoints clínicos. Además, se mezclan dos ciclos de vida.
2. **Servicio independiente en carpeta aislada dentro del repo (`backend/ml_service/`):**
   * Pros: aplica el mismo patrón ya probado con `backend/nlp_service/` (ADR-0006): venv, `requirements.txt` con versiones exactas, configuración, pruebas y README propios. Conserva la trazabilidad SDD en un solo repositorio y permite verificar el artefacto (huella y versiones) al arrancar, de forma aislada.
   * Contras: suma un despliegue y una llamada de red backend → ML, y aparece el riesgo de exposición accidental (ver Consecuencias).
3. **Repositorio separado:**
   * Pros: aislamiento máximo, con CI y permisos propios.
   * Contras: rompe la fuente de verdad SDD única y obliga a sincronizar entre repositorios el dataset, las métricas, `docs/model_baseline.md` y los ADR. Es demasiado overhead para el tamaño del equipo, igual que se concluyó en ADR-0006.

## Decisión Tomada
Se elige la **alternativa 2: servicio independiente en `backend/ml_service/`**, que reemplaza a ADR-0001 para el modelo de ML.
* Expone `GET /health` y `POST /api/riesgo/hipoglucemia`, con el contrato de `design.md` § Servicio de ML: solo la probabilidad y `version_modelo`, sin nivel de alerta (el modelo es experimental y ningún umbral tiene validez clínica).
* No importa nada de `backend/app/`. El código y el dataset se trasladaron con `git mv` (TASK-011d) y `backend/app/ml/` se retiró (TASK-011e, fase M6).
* **Solo el backend lo llama, por red interna (ML-D8).** La app móvil no lo llama.
* **Sin ingreso público.** El servicio no se publica en Internet; solo es alcanzable desde la red interna del despliegue.
* **Sin autenticación propia en v1.** La protección es de red. El mecanismo de autenticación entre servicios (identidad administrada de Azure, mTLS o token) queda como Open Question de `design.md`.

## Consecuencias
* **Positivas:**
  * Las versiones del modelo quedan fijadas en su propio `requirements.txt` sin afectar al backend, y viceversa (RT-06).
  * Una falla del modelo no tumba el backend. Como la probabilidad no es bloqueante, el registro se guarda igual con `riesgo_hipoglucemia = NULL`.
  * Mismo patrón operativo que el servicio NLP: el equipo ya lo conoce.
* **Negativas / Riesgos asumidos:**
  * **Riesgo de exposición accidental:** como no tiene autenticación propia en v1, toda su protección depende de la configuración de red. Si por error se le asigna ingreso público, cualquiera podría llamarlo y enviarle perfiles clínicos. Se mitiga con el recurso de Azure sin ingreso público (TASK-002b), su inclusión en la auditoría de seguridad (TASK-025b) y la Open Question de autenticación entre servicios, a resolver antes de cualquier despliegue con datos reales.
  * **Tercer despliegue:** más operación, más variables de entorno y otro monitoreo de uptime (TASK-026b).
  * **Latencia de red:** NFR-003 pasa a medir la llamada backend → servicio de ML (TASK-027).
  * **Duplicación temporal (resuelta):** entre las fases M5a y M6 convivieron `backend/app/ml/` y `backend/ml_service/`; el retiro se hizo en TASK-011e.
  * El servicio tampoco accede a la base de datos ni escribe en T_Auditoria_Endpoints. La trazabilidad de qué registro se evaluó la conserva el backend, con `riesgo_modelo_version` y `riesgo_calculado_en`.
