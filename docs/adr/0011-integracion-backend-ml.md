# 11. Integración del backend con el servicio de ML (riesgo informativo en el registro del médico)

* **Estado:** Aceptado
* **Fecha de decisión:** 2026-11-01
* **Autores:** Equipo GlucoTracker (decisiones tomadas por el equipo en la Fase ML-0; implementadas en la Fase ML-1)

## Contexto y Problema
El servicio de ML (`backend/ml_service/`, ADR-0008) ya expone `POST /api/riesgo/hipoglucemia`, pero nadie lo llama: el backend de negocio no lo usa. La auditoría de la Fase ML-0 (`docs/ml/integracion_backend_ml.md`) mostró que el modelo recibe **una lectura más el perfil clínico**, que la base **no tiene** la duración de la diabetes ni las comorbilidades, y que solo hay 7 de 31 pacientes con diabetes tipo 2. El equipo necesita **mostrar el flujo integrado** (lectura → backend → ML → probabilidad visible al médico) sin cambiar el esquema de Supabase y sin que el ML pueda romper el registro.

## Decisión
1. **Disparo.** Solo cuando el **médico** registra una glucosa para un paciente: `POST /api/medicos/registrar/glucosa`. La lectura **se guarda siempre antes** de llamar al ML. El registro del paciente (`POST /api/pacientes/registrarGlucosa`) no cambia ni recibe riesgo.
2. **Interruptor.** `ML_ENABLED` (apagado por defecto). Apagado, el endpoint responde **exactamente como hoy**, sin clave nueva.
3. **Respuesta.** Clave aditiva de primer nivel `riesgo_ml` (no se guarda en la base; no se quita ni renombra ningún campo existente):
   `{"riesgo_hipoglucemia": number|null, "version_modelo": string|null, "motivo": string|null, "supuestos": string[], "faltantes": string[]}`.
   **Campo aditivo `faltantes: string[]` (Fase ML-1b):** con `motivo = datos_insuficientes` lista los códigos cortos de lo que impidió calcular (`glucosa`, `genero`, `edad`, `imc`, `medicacion`, y `paciente` si el paciente no se encontró); es `[]` en los demás casos. Nunca incluye valores. Cada cálculo deja una línea en el log del backend con el motivo y los códigos, sin datos personales ni id de paciente.
   Motivos: `no_aplica_tipo`, `datos_insuficientes`, `momento_no_cubierto`, `no_disponible`. `supuestos` son códigos cortos de lo que se asumió o se dejó vacío (`duracion_estimada`, `comorbilidades_no_capturadas`, `hba1c_no_disponible`); es `[]` cuando no se calcula.
4. **Regla «tipo 2».** Exactamente **una** fila en `paciente_enfermedad`, con `nombre_enfermedad` normalizado (minúsculas, sin tildes, espacios colapsados) igual a `diabetes tipo 2`, y **sin embarazo activo**. Cualquier otro caso (sin tipo, tipo 1, gestacional, varias filas, tipo 2 con embarazo) → `no_aplica_tipo` y no se llama al ML.
5. **Entrada al ML** (15 campos del contrato real; **ningún identificador**): `glucosa`; `genero` por lista estricta (desconocido → `datos_insuficientes`); `edad` desde `usuario.fecha_nac` a la fecha de la lectura; `bmi` con peso en kg y altura en **metros** (no plausible → `datos_insuficientes`); `categoria_medicacion` desde el catálogo de tratamientos (sin equivalente → `datos_insuficientes`); `momento` solo `ayunas` y `postprandial` (otro, p. ej. «antes de dormir» → `momento_no_cubierto`); comorbilidades en `false` con el supuesto `comorbilidades_no_capturadas`; `hba1c` nula con `hba1c_no_disponible`. Si falta cualquier dato obligatorio distinto de la duración, **no se llama** al ML.
6. **Duración de la diabetes.** No existe en la base y **esta fase no toca el esquema**. Se usa un valor por defecto configurable, `ML_DURACION_DEFECTO_ANIOS = 6,5` años, la **mediana del conjunto sintético** con que se entrenó el modelo de demostración (dataset canónico de 2.000 registros, semilla 20261024, `backend/ml_service/data/sintetico/dataset_sintetico.csv`; media 8,2; percentiles 5 y 95 = 0,9 y 21,9; rango 0 a 40, dentro del 0 a 80 que acepta el contrato). Cuando se usa se añade el supuesto `duracion_estimada`. **La falta de duración nunca produce `datos_insuficientes`.** Punto de extensión (TASK-017h, pendiente): si en el futuro existe `paciente.anio_diagnostico`, se calcula la duración real y se omite el supuesto.
7. **El registro nunca falla ni se demora por el ML.** Cliente `httpx` con timeout corto y configurable (`ML_TIMEOUT`, 2 s por defecto), sin reintentos; cualquier excepción, 5xx, código distinto de 200 o respuesta inválida → `riesgo_hipoglucemia: null`, `motivo: no_disponible`, con un log que solo lleva el nombre de la excepción o el código (nunca cuerpos ni datos personales).
8. **Modelo.** Se usa el entrenado con datos sintéticos: `ML_MODELO=demo` en Docker Compose y en el `.env.example` de la raíz (el valor por defecto del **código** del servicio sigue siendo `real`, ADR-0009). Para que la respuesta no mencione «demo», la versión del modelo sintético pasa de `1.0.0-demo` a **`1.1.0`** (distinta del `1.0.0` del modelo real, para no confundir la trazabilidad); la trazabilidad real queda en los metadatos (`entrenado_con: "sintetico"`, `version_reglas`, `advertencia`). La protección contra cargar el modelo equivocado se conserva usando `entrenado_con` (ya no el sufijo de la versión).
9. **Red.** El `ml_service` **no publica puertos**: sigue solo en la red interna `red_ml` (`internal: true`), a la que ya pertenece el backend. El backend lo llama por `http://ml_service:8002`.

## Alternativas Consideradas
1. **Guardar el riesgo en `registro_glucosa` (como decía la TASK-017 original):** descartada; exige cambiar el esquema de Supabase, que esta fase no toca.
2. **Calcular el riesgo también en el registro del paciente:** descartada por decisión del equipo (el resultado es para el médico).
3. **Pedir la duración en el registro del paciente antes de integrar (TASK-017h):** es lo correcto a largo plazo, pero bloquearía la demostración; queda pendiente y el valor estimado se declara con un supuesto.
4. **Devolver `datos_insuficientes` cuando falta la duración:** descartada por decisión del equipo (ningún paciente tendría riesgo hoy).
5. **Mantener `1.0.0-demo` y ocultarlo en la app:** descartada; el equipo prefirió que el servicio no mencione «demo».

## Consecuencias
* **Positivas:** el flujo completo funciona sin cambios de esquema; el ML es opcional y aislado; el registro del médico conserva su respuesta y su disponibilidad.
* **Advertencia (obligatoria, se repite donde se muestre el riesgo):** el valor de la **duración es estimado** (mediana de datos sintéticos, no un dato del paciente), las **comorbilidades no se capturan** (se envían como `false` y pueden subestimar el riesgo) y la HbA1c falta. Además el modelo sintético **aprende las reglas escritas por el equipo, no la realidad**, y el real no supera el azar. **El riesgo es experimental, informativo y no clínico: no es un diagnóstico, no reemplaza el criterio del médico y no genera alertas.**
* **Riesgos aceptados:** el endpoint `POST /api/medicos/registrar/glucosa` sigue **sin autenticación ni validación de pertenencia** (RB-01): cualquiera podría obtener un riesgo calculado de un paciente con solo su id. Solo es aceptable en una red local de desarrollo. Hallazgo para el responsable del backend.
* **Cambia en el ML (mínimo y sin tocar el contrato público):** la versión del modelo sintético (`1.1.0`), el chequeo de modo al cargar (`entrenado_con`) y las pruebas y la documentación afectadas.

## Relación con otras ADR
* **ADR-0008:** el backend por fin llama al servicio por la red interna; no cambia su contrato ni su aislamiento (el backend no importa código del ML).
* **ADR-0009:** no cambia el valor por defecto `real` ni la separación de modelos; **sustituye el sufijo `-demo` de la versión** por la comprobación de `entrenado_con`.
* **ADR-0010:** solo añade variables al servicio `backend` y `ML_MODELO=demo` al `ml_service` en Compose.
