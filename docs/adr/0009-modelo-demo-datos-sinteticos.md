# 9. Modelo de demo con datos sintéticos

* **Estado:** Aceptado
* **Fecha de decisión:** 2026-10-25 (actualizada el mismo día en la Fase S4: el contrato público no cambia)
* **Autores:** Equipo GlucoTracker (aprobada por el equipo en las Fases S2 y S4)

## Contexto y Problema
1. **El modelo real no tiene señal.** El modelo de riesgo de hipoglucemia (Regresión Logística + SMOTE-NC, ADR-0007) se entrenó con 109 registros y 10 positivos, y la validación cruzada agrupada por paciente muestra que ninguna variante supera el azar (`docs/model_baseline.md` §4.1). Está declarado **experimental, solo informativo y visible solo para el médico**.
2. **El equipo no tiene pacientes reales.** Aun así necesita mostrar el flujo integrado (lectura → backend → servicio de ML → probabilidad visible al médico), y con un modelo que no discrimina esa demostración no enseña nada.
3. **Hay que evitar la confusión.** Un modelo que luce bien porque aprendió reglas inventadas no puede confundirse con el modelo real ni con evidencia clínica.

La especificación del generador está en `docs/ml/generador_sintetico.md` (Fase S1) y el diseño en `design.md` § Modelo de demo con datos sintéticos.

## Alternativas Consideradas
1. **No hacer demo con ML, o mostrar solo el modelo real:**
   * Pros: no añade nada que pueda confundirse.
   * Contras: la demostración mostraría probabilidades casi planas, sin relación visible con el perfil del paciente.
2. **Generador estadístico (por ejemplo, cópulas o redes generativas) ajustado a los 109 registros reales:**
   * Pros: aparenta "parecerse" a los datos reales.
   * Contras: con 10 positivos no hay señal que imitar; el generador reproduciría el ruido y daría la falsa impresión de un modelo validado con datos reales. Además mezcla, de forma indirecta, datos reales con datos sintéticos.
3. **Datos sintéticos generados por reglas clínicas escritas por el equipo, con un modelo separado (elegida):**
   * Pros: las reglas son explícitas, auditables y revisables por un profesional de la salud; el modelo de demo aprende lo que escribimos y eso se declara; no toca el modelo real ni los 109 registros.
   * Contras: las reglas y sus magnitudes son supuestos del equipo (pendientes de revisión) y el resultado no es evidencia clínica.

Sobre cómo distinguir los dos modelos en la API, se consideró **añadir un campo `modo` (`real` | `demo`)** a `GET /health` y a la respuesta de `POST /api/riesgo/hipoglucemia`. **El equipo decidió no hacerlo** (Fase S4): el contrato público no cambia.

## Decisión Tomada
Se elige la **alternativa 3**: un **segundo modelo, claramente separado, entrenado con datos sintéticos** generados a partir de reglas clínicas escritas por el equipo.
* **El modelo real no se modifica ni se reentrena.** Sigue siendo el modelo por defecto.
* **Generador (TASK-011f):** `backend/ml_service/app/sintetico/`, reproducible por semilla, sin leer ni importar nada de `data/raw/`. Escribe un CSV (fuera de git) y un JSON de metadatos (versionado).
* **Modelo de demo (TASK-011g):** artefactos propios en `backend/ml_service/app/artefactos/demo/`, con `version_modelo` `1.0.0-demo` y `entrenado_con: "sintetico"`.
* **Activación (TASK-011g):** solo con `ML_MODELO=demo`; el valor por defecto es `real`.
* **El contrato público de la API no cambia (TASK-011h, decisión del equipo).** La respuesta de `POST /api/riesgo/hipoglucemia` sigue siendo `{riesgo_hipoglucemia, version_modelo}` y `GET /health` no revela qué modelo se sirve. No se añade el campo `modo` ni ningún aviso, y ningún mensaje de la API contiene las palabras "demo" o "sintético" (la única huella es el sufijo `-demo` de `version_modelo`, que sale de los metadatos del modelo).
* **Reglas de separación:** nunca mezclar filas sintéticas con las 109 reales; nunca evaluar el modelo de demo con datos sintéticos y presentarlo como desempeño clínico; nunca usar el modelo de demo salvo con `ML_MODELO=demo`.

## Consecuencias
* **Sin cambio de contrato respecto de ADR-0008.** ADR-0008 define la respuesta como "solo la probabilidad y `version_modelo`" y eso se mantiene.
* **Consecuencia aceptada y declarada: la respuesta no distingue entre el modelo real y el entrenado con datos sintéticos.** Quien reciba una probabilidad no puede saber, solo por el cuerpo de la respuesta, de cuál viene (salvo por el sufijo `-demo` de `version_modelo`). La trazabilidad queda en:
  * los **metadatos** del modelo (`entrenado_con: "sintetico"`, `version_modelo` con sufijo `-demo`, advertencia),
  * la variable **`ML_MODELO`**, cuyo valor por defecto es `real`,
  * la **verificación de huella y de modo al cargar**: un modelo de demo no se carga en modo `real` ni al revés, aunque se copie a la carpeta equivocada,
  * la **documentación**: README del servicio, `docs/ml/generador_sintetico.md` y esta ADR.
* **Positivas:**
  * Se puede mostrar el flujo integrado con probabilidades que varían de forma explicable con el perfil.
  * Las reglas quedan escritas y se pueden revisar y corregir.
  * El modelo real y sus métricas (`baseline_metrics.json`, `cv_metrics.json`) quedan intactos.
  * El backend y la app no necesitan cambios: el contrato es el mismo.
* **Negativas / Riesgos asumidos:**
  * **Riesgo de confusión:** alguien podría tomar una probabilidad del modelo entrenado con datos sintéticos por una estimación clínica, porque la respuesta no lo dice. Se mitiga con `ML_MODELO=real` por defecto, la comprobación de modo al cargar, la rotulación "validación sintética, no clínica" de sus métricas y la documentación, pero **ninguna de esas medidas es visible para quien consume la API**.
  * **Si el servicio llegara a usuarios reales, habría que reponer la marca** (el campo `modo` u otra señal equivalente en la respuesta, el contrato de ADR-0008 se ampliaría con una ADR nueva) o impedir que `ML_MODELO=demo` se use fuera de desarrollo y presentaciones. Qué modelo se usa en producción es una Open Question de `design.md`; hasta resolverla, el modelo de demo es solo para entornos de desarrollo y presentaciones.
  * **Las reglas son supuestos.** Todas están pendientes de revisión por el equipo; quién las valida (un profesional de la salud) es una Open Question.
  * **Una métrica sintética alta no dice nada del mundo real.** El AUC del modelo de demo en su propia validación depende solo de las reglas y del ruido que se pusieron.

## Relación con otras decisiones
* **ADR-0007 (Regresión Logística + SMOTE-NC):** no la reemplaza. El modelo real sigue siendo el de ADR-0007, experimental. El modelo de demo es un segundo modelo con la misma familia de tubería, pero otros datos y otra finalidad.
* **ADR-0008 (servicio de ML independiente):** no cambia su contrato, su aislamiento ni su política de red. Añade solo una carpeta de artefactos (`demo/`) y una variable de entorno (`ML_MODELO`).
