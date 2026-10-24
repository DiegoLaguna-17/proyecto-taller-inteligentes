# Generador de datos sintéticos para el modelo de demo — Especificación (Fase S1)

> **Estado:** especificación. Solo documentación: todavía no existe código (Fases S2 a S4, TASK-011f, 011g y 011h). Todas las reglas clínicas y sus magnitudes están **pendientes de revisión por el equipo**.

## 1. Propósito y advertencia de honestidad

El modelo real de riesgo de hipoglucemia (`backend/ml_service`, Regresión Logística + SMOTE-NC, ADR-0007) se entrenó con 109 registros y 10 positivos, y la validación cruzada muestra que **no supera el azar** (`docs/model_baseline.md` §4.1). Está declarado **experimental, solo informativo y visible solo para el médico**, y **esta especificación no lo modifica ni lo reentrena**.

El equipo no tiene pacientes reales y necesita **mostrar el flujo integrado** (lectura → backend → servicio de ML → probabilidad visible al médico). Para eso se creará un **segundo modelo, claramente separado**, entrenado con datos sintéticos generados a partir de **reglas clínicas escritas por el equipo**, no con un generador estadístico ajustado a los 109 registros.

> **El modelo de demo aprende las reglas que definimos, no la realidad.**
> Sus probabilidades **no son evidencia clínica**, sus métricas **no son desempeño clínico**, y nada de lo que produzca debe presentarse como una estimación validada. Si alguien concluye algo sobre pacientes a partir de él, la conclusión es inválida.

## 2. Reglas de separación (obligatorias)

1. **Nunca** mezclar filas sintéticas con las 109 reales: ni para entrenar, ni para validar, ni en el mismo archivo. El generador no lee ni importa nada de `backend/ml_service/data/raw/`.
2. **Nunca** evaluar el modelo de demo con datos sintéticos y presentar el resultado como desempeño clínico. Las métricas de demo se rotulan siempre "validación sintética, no clínica".
3. **Nunca** usar el modelo de demo salvo con `ML_MODELO=demo` (por defecto es `real`).
4. El modelo de demo y sus metadatos llevan **versión propia** (`1.0.0-demo`) y `entrenado_con: "sintetico"`. El dataset lleva la columna `origen = "sintetico"` en cada fila.
5. Los artefactos de demo viven aparte (`backend/ml_service/app/artefactos/demo/`); nunca se escribe en `app/artefactos/` del modelo real, ni en `baseline_metrics.json` ni en `cv_metrics.json`.
6. El dataset sintético no contiene identificadores ni valores copiados de los registros reales; sus ids tienen el prefijo `sint-`.

## 3. Decisiones cerradas (Fase S1, con el equipo)

| Decisión | Valor | Por qué |
|---|---|---|
| Prevalencia objetivo de la etiqueta | **15 %** | Algo por encima del 9,2 % real: con 2.000 registros quedan ~300 positivos (validación estable) sin ser irreal. |
| Tamaño por defecto | **2.000 registros** | Con 15 % da ~300 positivos; entrena en segundos. Configurable (`--n`). |
| Fuerza de la señal | **Moderada** | Probabilidades creíbles (mediana ~0,10; percentil 95 ~0,47; casos extremos ~0,7). Con señal fuerte se verían llamativas pero irreales. |
| Ruido / AUC | **AUC moderado (0,70 a 0,80) en la validación sintética propia** | La etiqueta se **muestrea** (Bernoulli) de la probabilidad de las reglas, así que ni las reglas ni el modelo pueden ser perfectos. Es una propiedad de las reglas, no evidencia clínica. |
| Reglas dudosas incluidas | **IMC bajo (<20)** y **HbA1c alta (>9)** | Elegidas por el equipo. |
| Reglas dudosas descartadas | **Neuropatía** y **enfermedad cardiovascular** (sin efecto) | Elegidas por el equipo; siguen generándose como variables sin efecto. |
| Interacciones | **2** (HbA1c bajo solo con insulina/sulfonilurea; edad ≥ 75 con insulina) | Algo no trivial que aprender, sin complicar el generador. |
| Dependencia de la glucosa | **Continua y suave** | Sin saltos artificiales. |
| Género, hipertensión, dislipidemia | **Sin efecto (controles)** | Comprueba que el modelo no aprende señal donde no se puso, y evita sesgar por género. |

## 4. Contrato real que el generador debe reproducir

El generador produce **exactamente** los campos, tipos, rangos y categorías del contrato de `POST /api/riesgo/hipoglucemia` (`backend/ml_service/app/api/riesgo.py`, `design.md` § Servicio de ML):

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
| `hba1c` | número o vacío | opcional, % (> 0 y ≤ 20) |

Más la etiqueta `hipoglucemia_registro` (0/1): **hipoglucemia observada en el registro** (ML-D6), igual que el modelo real.

Umbrales de referencia (`docs/nlp/umbrales_ada_v1.json`): hipoglucemia < 70 mg/dL; ayunas 70 a 130; postprandial hasta 180. El generador **no** usa la clasificación ADA para fabricar la etiqueta (el ML no clasifica, ML-D5); solo usa el 130 como centro de la dependencia continua de la glucosa. `backend/app/core/reglas_ada.py` aún no existe.

## 5. Unidad de generación

- Un **registro** = una lectura de glucosa (con su `momento`) + el perfil clínico del paciente en ese momento. Cada fila es un registro y tiene su propia etiqueta.
- Hay **pacientes sintéticos** con 1, 2 o 3 registros (90 %, 8 % y 2 %; ~1,12 registros por paciente, parecido al 1,09 de los datos reales). Los registros de un paciente comparten su perfil (edad, IMC, duración, medicación, comorbilidades y HbA1c) y difieren en la lectura. Sirve para validar agrupando por paciente, como el modelo real.
- Esto **difiere deliberadamente** del dataset real, donde cada registro se expande en dos filas (ayunas y postprandial) con la misma etiqueta. Aquí la etiqueta depende de la glucosa de la lectura, así que una fila por lectura es lo coherente.
- Se generan pacientes hasta completar `n` registros.

## 6. Distribuciones de las variables

Orden de magnitud tomado de los **agregados** de los 109 registros reales (medias, desviaciones y rangos; ningún dato por paciente). El dataset real es hospitalario y de una región concreta (RD-01), así que se usa solo como referencia de magnitud, no como objetivo.

| Variable | Distribución propuesta | Referencia real (agregados) | Notas |
|---|---|---|---|
| `edad` | Normal(60; 13), recortada a 25-90, entera | media 60,3; sd 14,0; rango 22-97 | |
| `duracion_diabetes` | Gamma(forma 1,4; escala 6,0) (media ~8,4), recortada a 0-40 y a `edad − 18` | media 8,7; sd 8,3; rango 0-40 | Correlación gaussiana ~0,4 con la edad (real: 0,42). |
| `bmi` | Normal(24,5; 3,5), recortada a 17-38 | media 24,1; sd 3,3; rango 17-37 | Correlación ~−0,3 con la edad (real: −0,35). |
| `genero` | femenino 46 %, masculino 54 % | femenino 45,9 % | Control: sin efecto. |
| `categoria_medicacion` | Depende de la duración: <3 años → ninguno 22 %, metformina 55 %, sulfonilurea 8 %, insulina 15 %; 3 a 10 años → 5 / 44 / 13 / 38 %; >10 años → 2 / 28 / 12 / 58 % | insulina 48,6 %; metformina u otros 38,5 %; sulfonilurea 8,3 %; ninguno 4,6 % | Marginal resultante ~ninguno 8 %, metformina 42 %, sulfonilurea 12 %, insulina 39 %. Menos insulina que la real (muestra hospitalaria). |
| `hba1c` | Normal(8,3; 1,9), recortada a 5,0-14,0; **falta en el 10 %** de los pacientes | media 9,0; sd 2,4; disponible en 93 % | La HbA1c ausente se trata como faltante, igual que el modelo real. |
| `glucosa` (ayunas) | `0,85 × eAG × exp(N(0; 0,22))`, recortada a 40-600 | media 164,9; rango 56-432 | `eAG = 28,7 × HbA1c − 46,7` (relación ADAG, cita por verificar). Se usa la HbA1c del paciente aunque esté oculta. |
| `glucosa` (postprandial) | `1,5 × 0,85 × eAG × exp(N(0; 0,20))`, recortada a 40-600 | media 264,8; rango 97-610 | La correlación ayunas-postprandial real es 0,76. |
| `momento` | ayunas 50 %, postprandial 50 % | | |
| `com_hipertension` | logística: `−0,4 + 0,03 × (edad − 60)` (~40 %) | 40,4 % | Control: sin efecto. |
| `com_dislipidemia` | logística constante `−1,2` (~23 %) | 22,9 % | Control: sin efecto. |
| `com_renal` | logística: `−2,4 + 0,03 × (edad − 60) + 0,04 × (duración − 8)` (~9 %) | 10,1 % | |
| `com_nefropatia` | 40 % si `com_renal`, 3 % si no (~6,5 %) | 6,4 % | |
| `com_neuropatia` | logística: `−1,7 + 0,06 × (duración − 8)` (~19 %) | 20,2 % | Sin efecto (decisión). |
| `com_cardiovascular` | logística: `−0,8 + 0,04 × (edad − 60)` (~35 %) | 36,7 % | Sin efecto (decisión). |

Todos los valores se redondean a la precisión del contrato (edad entera; IMC, duración, HbA1c y glucosa con 1 decimal).

## 7. Reglas clínicas

La probabilidad de la etiqueta es `P = sigmoide(escala_señal × S + b0)`, con `S` la suma de los términos de abajo (en log-odds), `escala_señal = 0,8` (ajuste global de la señal moderada) y `b0` un intercepto calibrado por bisección para obtener la prevalencia objetivo (15 %). La etiqueta es `Bernoulli(P)`.

**Sobre las fuentes:** en las filas "respaldada" la **dirección** del efecto es un consenso clínico general (los Standards of Care de la ADA, en su sección de metas glucémicas e hipoglucemia, mencionan insulina y secretagogos, mayor edad, mayor duración de la diabetes, insuficiencia renal y metas de HbA1c intensivas como factores de riesgo; edición y texto exacto **por verificar**, igual que en `docs/nlp/corpus_conocimiento.md`). **Las magnitudes son siempre un supuesto del equipo**: no vienen de ningún estudio. No se cita ningún estudio concreto como respaldo de un coeficiente.

### 7.1 Reglas incluidas

| # | Variable | Sentido | Magnitud | Término (log-odds, antes de la escala) | Justificación clínica | Estado |
|---|---|---|---|---|---|---|
| R1 | `categoria_medicacion = insulina` | sube | fuerte | +1,2 | La insulina es una causa principal de hipoglucemia iatrogénica. | Dirección: respaldada (consenso general, ADA). Magnitud: supuesto del equipo |
| R2 | `categoria_medicacion = sulfonilurea` | sube | moderada a fuerte | +0,9 | Los secretagogos pueden causar hipoglucemia prolongada. | Dirección: respaldada. Magnitud: supuesto |
| R3 | `categoria_medicacion = metformina_u_otros` | sube | leve | +0,15 | La metformina sola rara vez causa hipoglucemia; "u otros" mezcla fármacos. `ninguno` es la referencia (0). | Dirección: respaldada. Magnitud: supuesto |
| R4 | `glucosa` (continua) | baja cuanto mayor la lectura | fuerte | `−1,8 × ln(glucosa / 130)`, con `glucosa` recortada a 45-300 | Una lectura baja indica cercanía a la hipoglucemia. Equivale a ~+1,1 con 70 mg/dL, 0 con 130 y ~−0,8 con 200. | Supuesto del equipo (coherente con la definición de la etiqueta) |
| R5 | `momento = ayunas` | sube | leve | +0,3 | Las hipoglucemias con insulina o secretagogos son más frecuentes en ayunas o antes de comidas. | Supuesto del equipo |
| R6 | `duracion_diabetes` | sube | moderada | `+0,05 × (min(duración, 25) − 8)` | Más años de diabetes se asocian a peor contrarregulación. | Dirección: respaldada. Magnitud: supuesto |
| R7 | `edad` | sube | moderada | `+0,03 × (clip(edad, 40, 90) − 60)` | Los adultos mayores tienen mayor riesgo. | Dirección: respaldada. Magnitud: supuesto |
| R8 | `hba1c` baja (**interacción 1**) | sube | moderada | Con HbA1c observada: < 7 → +0,7 si insulina o sulfonilurea (+0,1 en otro caso); 7 a 8 → +0,3 si insulina o sulfonilurea (0 en otro caso) | Un control intensivo con fármacos de riesgo aumenta la hipoglucemia. Sin HbA1c: 0. | Dirección: respaldada. Magnitud e interacción: supuesto |
| R9 | `hba1c` alta (> 9) | baja | leve | −0,4 | Un control muy deficiente se asocia a menos hipoglucemias. | **Supuesto del equipo (regla dudosa, incluida por decisión)** |
| R10 | `bmi` bajo (< 20) | sube | leve | +0,4 | Bajo peso o fragilidad con la misma dosis. | **Supuesto del equipo (regla dudosa, incluida por decisión)** |
| R11 | `com_renal` | sube | moderada | +0,6 | La función renal reducida disminuye el aclaramiento de insulina y de algunos fármacos. | Dirección: respaldada. Magnitud: supuesto |
| R12 | `com_nefropatia` | sube | leve a moderada | +0,3 (se suma a R11 si ambas) | Misma razón que R11. | Dirección: respaldada. Magnitud: supuesto |
| R13 | `edad ≥ 75` con `insulina` (**interacción 2**) | sube | leve a moderada | +0,4 adicional | Adultos mayores con insulina son el grupo de mayor riesgo. | Supuesto del equipo |

### 7.2 Variables sin efecto (controles)

| Variable | Por qué |
|---|---|
| `genero` | Decisión: evitar sesgo por género; sirve de control. |
| `com_hipertension`, `com_dislipidemia` | Decisión: controles sin efecto. |
| `com_neuropatia` | Regla dudosa **descartada** por el equipo (sin efecto). |
| `com_cardiovascular` | Regla dudosa **descartada** por el equipo (sin efecto). |

Una prueba de S2 debe comprobar que variar solo una de estas variables no altera la probabilidad verdadera.

### 7.3 Resultado esperado (comprobación numérica previa)

Una simulación desechable de 400.000 registros, hecha solo para comprobar que la especificación es coherente (no es el generador y no entra al repositorio), dio con `escala_señal = 0,8`: intercepto ≈ −2,35, prevalencia 15,0 %, **AUC de las probabilidades verdaderas ≈ 0,78**, probabilidad mediana ≈ 0,10, percentil 95 ≈ 0,47, percentil 99 ≈ 0,69, y ~4 % de los registros con P > 0,5. Riesgo medio por medicación: ninguno 0,06; metformina 0,08; sulfonilurea 0,17; insulina 0,23. Con `escala_señal = 1,0` el AUC subía a ≈ 0,83 (fuera de lo pedido), por eso la escala 0,8. Estos números son **esperados, no garantizados**: S2 mide los reales y los registra en los metadatos. Solo ~1,7 % de las lecturas en ayunas quedan bajo 70 mg/dL: la etiqueta es "hipoglucemia en el registro", no "esta lectura es < 70".

Si el AUC de las probabilidades verdaderas queda fuera de **0,75 a 0,82**, se ajusta solo `escala_señal` (no las reglas) y se registra el valor usado.

## 8. Esquema de columnas del dataset

| Columna | Tipo | Descripción |
|---|---|---|
| `id_paciente_sintetico` | texto | `sint-00001`, … Para agrupar en la validación. |
| `id_registro_sintetico` | texto | `sint-reg-000001`, … |
| `origen` | texto | Siempre `sintetico`. |
| `genero`, `edad`, `bmi`, `duracion_diabetes`, `categoria_medicacion` | | Como el contrato (sección 4). |
| `com_hipertension`, `com_dislipidemia`, `com_renal`, `com_neuropatia`, `com_nefropatia`, `com_cardiovascular` | booleano | Como el contrato. |
| `hba1c` | número o vacío | Vacío cuando falta. |
| `glucosa`, `momento` | | Como el contrato. |
| `hipoglucemia_registro` | 0/1 | Etiqueta. |

La probabilidad verdadera de las reglas **no** es una columna (sería una fuga si alguien la usara como feature); solo se resume en los metadatos.

## 9. Metadatos del dataset (JSON, versionado)

Junto al CSV (ignorado por git, regenerable) se escribe un JSON versionado. Ejemplo con valores **ilustrativos** (no medidos):

```json
{
  "origen": "sintetico",
  "advertencia": "Dataset sintético generado a partir de reglas clínicas del equipo (pendientes de revisión). No contiene pacientes reales. No es evidencia clínica.",
  "version_esquema": "1.0",
  "version_reglas": "1.0.0-reglas",
  "semilla": 20261024,
  "fecha": "2026-10-24T00:00:00+00:00",
  "n_registros": 2000,
  "n_pacientes": 1790,
  "prevalencia_objetivo": 0.15,
  "prevalencia_obtenida": 0.151,
  "escala_senal": 0.8,
  "intercepto": -2.35,
  "auc_oraculo": 0.78,
  "sha256_csv": "<huella del CSV>",
  "versiones": {"python": "3.13.x", "numpy": "2.4.6", "pandas": "2.2.3", "scipy": "1.15.3"}
}
```

El JSON no contiene valores ni ids por registro, solo agregados.

## 10. Metadatos del modelo de demo (Fase S3)

El JSON junto al `.pkl` de demo (`backend/ml_service/app/artefactos/demo/`) tiene los mismos campos que el del modelo real (`version_modelo`, `fecha_entrenamiento`, `sha256_pkl`, `versiones`, `metricas`, `random_state`, `dataset`, `conteos`) más:

| Campo | Valor |
|---|---|
| `version_modelo` | `1.0.0-demo` |
| `entrenado_con` | `sintetico` |
| `version_reglas` | la del dataset |
| `dataset.sha256` | huella del CSV sintético |
| `metricas` | rotuladas "validación sintética, no clínica" |
| `advertencia` | "Modelo de demostración entrenado con datos sintéticos. No es una estimación clínica." |

Al cargar, `predict.py` exige `entrenado_con == "sintetico"` en modo `demo` y rechaza ese valor en modo `real` (el JSON real actual no trae el campo y se interpreta como real). Ver `design.md` § Modelo de demo con datos sintéticos.

## 11. Pendiente y límites

- **Reglas pendientes de revisión por el equipo.** Quién las valida (un profesional de la salud) es una Open Question de `design.md` y `CONTEXT.md`.
- **Qué se muestra en producción** y si se permite `ML_MODELO=demo` fuera de desarrollo es otra Open Question.
- **Cambio de contrato (campo `modo`):** requiere una ADR nueva antes de implementar S4 (propuesta: ADR-0009, "Modelo de demo con datos sintéticos"); ADR-0008 describe el contrato como "solo la probabilidad y `version_modelo`".
- Las distribuciones son plausibles y de orden de magnitud parecido al dataset real, pero **no están validadas** contra ninguna población.
- La etiqueta sintética depende de la glucosa de la lectura; la real, no (es una etiqueta del registro). El modelo de demo puede por eso parecer mejor de lo que cualquier modelo real podría ser.
