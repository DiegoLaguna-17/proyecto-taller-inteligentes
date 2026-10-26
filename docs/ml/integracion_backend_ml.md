# Integración backend ↔ ML — auditoría (Fase ML-0, solo lectura)

> **Estado:** auditoría y propuesta; **no se implementó nada** (ni backend, ni ML, ni app). Fecha: 2026-11-01. Evidencia: código de `backend/ml_service/`, `backend/app/`, design.md, ADR-0008/0009/0010, `docs/ml/generador_sintetico.md`, `docs/data_ecosystem.md` y **solo lecturas (GET)** de la base real, impresas únicamente como catálogos, conteos y categorías (nunca nombres, correos, teléfonos, C.I. ni valores clínicos individuales).

## 0. Resumen ejecutivo

- El ML recibe **una lectura + el perfil clínico** (15 campos). **No usa variables derivadas del historial** (ni ventanas, ni variabilidad): la «lectura que se acaba de registrar» es toda la parte dinámica.
- De las 9 variables obligatorias, **6 están disponibles o son derivables hoy** (`glucosa`, `genero`, `edad`, `bmi`, `categoria_medicacion` y `momento`, esta última ambigua porque «antes de dormir» no existe en el modelo). **`duracion_diabetes` (obligatoria) NO existe en la base**, las **6 comorbilidades no se capturan** (el contrato permite `false`) y `hba1c` es opcional (`null`). Hoy **0 pacientes** tienen todos los datos reales necesarios.
- Regla «tipo 2» propuesta: el paciente tiene **exactamente una** fila en `paciente_enfermedad` y su `enfermedades_base.nombre_enfermedad` normalizado es `diabetes tipo 2`. Hoy cumplen la regla **7 de 31** pacientes activos (22,6 %).
- El hueco decisivo es `duracion_diabetes` (cambio de esquema en Supabase + captura en la app) y la **decisión clínica** de enviar las comorbilidades como `false` mientras no se capturan.
- Campo nuevo propuesto en la respuesta del registro del médico: `riesgo_ml` (objeto aditivo, no se guarda).

## 1. Contrato del servicio de ML

`POST /api/riesgo/hipoglucemia` (`backend/ml_service/app/api/riesgo.py`). Cualquier campo extra → **422**; los mensajes de error son genéricos (sin valores de entrada). Sin autenticación propia (ADR-0008), sin ingreso público.

| Variable | Tipo | Unidad / valores | Rango | Obligatoria | Definición en el entrenamiento |
|---|---|---|---|---|---|
| `glucosa` | float | mg/dL | > 0 y ≤ 700 | sí | Real: glucosa plasmática de **laboratorio** (en ayunas `FPG` o a las 2 h `2h-PPG`) de la visita. Sintético: lectura continua de la regla R4 (`−1,8·ln(g/130)`, recortada a 45–300) |
| `momento` | str | `ayunas` \| `postprandial` | solo esos 2 | sí | Real: `FPG` → ayunas, `2h-PPG` → postprandial (**2 horas** tras la comida). Codificado 0/1 |
| `genero` | str | `femenino` \| `masculino` | solo esos 2 | sí | Real: `Gender (Female=1, Male=2)`. Sintético: control sin efecto |
| `edad` | int | años | 1–120 | sí | `Age (years)` en la visita |
| `bmi` | float | kg/m² | > 0 y ≤ 80 | sí | `BMI (kg/m2)` del dataset |
| `duracion_diabetes` | float | años | 0–80 | **sí** | `Duration of diabetes (years)`: años desde el diagnóstico |
| `categoria_medicacion` | str | `ninguno` \| `metformina_u_otros` \| `sulfonilurea` \| `insulina` | 4 valores | sí | Del texto libre `Hypoglycemic Agents`: **insulina** si menciona insulina/análogos; si no, **sulfonilurea** (glimepirida, glipizida, gliclazida, glibenclamida); si no, `metformina_u_otros`; vacío/«none» → `ninguno`. Prioridad: insulina > sulfonilurea > otros. Codificado 0–3 |
| `com_hipertension` | bool | | def. `false` | no | Texto de `Comorbidities` contiene «hypertension» |
| `com_dislipidemia` | bool | | def. `false` | no | contiene «hyperlipidemia» o «dyslipidemia» |
| `com_renal` | bool | | def. `false` | no | contiene «renal», «kidney» o «nephro» (en `Comorbidities`) |
| `com_neuropatia` | bool | | def. `false` | no | `Microvascular Complications` contiene «neuropathy» |
| `com_nefropatia` | bool | | def. `false` | no | `Microvascular Complications` contiene «nephropathy» |
| `com_cardiovascular` | bool | | def. `false` | no | `Macrovascular Complications` contiene «coronary», «cerebrovascular» o «arterial» |
| `hba1c` | float \| null | % | > 0 y ≤ 20 | no | `HbA1c (%)`. Si falta: bandera `hba1c_faltante` + mediana del entrenamiento |

**Salida 200:** `{"riesgo_hipoglucemia": float 0–1 (4 decimales), "version_modelo": str}`. Sin nivel de alerta (ML-D4/D5). Errores: 422 (entrada), 503 (modelo no disponible: artefacto ausente, huella o versiones distintas) y 500. `GET /health` → `{status, service, modelo_cargado}`.

**Qué predice (ML-D6):** probabilidad de **hipoglucemia observada en el registro** (la visita), no «riesgo futuro del paciente». La lectura de entrada es la glucosa de esa visita.

### 1.1 Modelo real frente a sintético (`ML_MODELO`)
| | Real (`ML_MODELO=real`, por defecto) | Sintético (`ML_MODELO=demo`) |
|---|---|---|
| Datos | ShanghaiT2DM: 193 filas, 97 pacientes, 17 filas positivas | 2.000 filas generadas por reglas clínicas escritas por el equipo (15 % positivas) |
| `version_modelo` | `1.0.0` | **`1.0.0-demo`** |
| Rendimiento | AUC 0,640 en el split; validación cruzada agrupada: **no supera el azar** | AUC 0,786 (split) y 0,783 (CV): **mide las reglas del equipo, no la realidad** |
| Técnica | Regresión logística + SMOTE-NC | Regresión logística sin SMOTE-NC ni interacciones |
| Metadatos extra | huella `sha256_pkl`, versiones, conteos, dataset | además `entrenado_con: "sintetico"`, `version_reglas`, `semilla_dataset`, `advertencia`, rótulo «validación sintética, no clínica» |
| Efecto de las variables | todas aprendidas de 10 positivos | solo medicación (+1,2 insulina, +0,9 sulfonilurea, +0,15 metformina), glucosa baja, ayunas, duración, edad, HbA1c baja/alta, IMC < 20, renal/nefropatía; género, hipertensión, dislipidemia, neuropatía y cardiovascular **sin efecto** |

Estado observado hoy: el contenedor en marcha sirve **`ML_MODELO=real`** y responde `/health` con `modelo_cargado: true`; el modelo de demo existe en el repo (`artefactos/demo/`) pero hay que generarlo en el volumen (`docker compose run --rm ml_entrenar_demo`) y arrancar con `ML_MODELO=demo`. **La API no declara el modelo**; el único rastro en la respuesta es el sufijo `-demo` de `version_modelo` (ver decisión 5).

## 2. Esquema real de la base (inferido del código; no hay SQL ni migraciones en el repo)

Los tipos se infieren de cómo escribe y lee el backend; **no se pudo verificar nulabilidad ni tipos exactos** sin acceso al esquema de Supabase.

| Tabla | Columnas vistas en el código | Notas |
|---|---|---|
| `usuario` | `id_usuario`, `nombre_completo`, `correo`, `contrasena` (hash), `rol`, `fecha_nac` (fecha), `teléfono` (con tilde), `fecha_registro` | `fecha_nac` permite calcular la edad (ya hay `calcular_edad` en `api/registro.py`). **No** hay fecha de diagnóstico: `fecha_registro` es la del alta en la app |
| `paciente` | `id_paciente`, `id_usuario`, `id_medico`, `id_nivel_actividad`, `genero` (**texto libre**), `peso` (kg, se guarda con `float()`), `altura` (**METROS**, `numeric(4,2)` confirmado por el equipo), `embarazo` (bool), `nombre_emergencia`, `numero_emergencia`, `foto_perfil` | El tipo de `peso` no está documentado |
| `registro_glucosa` | `id_registro`, `id_paciente`, `id_medico` (**solo lo llena el registro del médico**), `id_momento`, `fecha`, `hora`, `nivel_glucosa` (mg/dL), `observaciones` | Sin marca de origen ni `clasificacion_ada` ni campos de riesgo |
| `momento_dia` | `id_momento`, `momento` | `1 AYUNAS`, `2 DESPUES DE COMER`, `3 ANTES DE DORMIR` (leído de la base real) |
| `enfermedades_base` | `id_enfermedad`, `nombre_enfermedad` | **Solo 3 filas:** Diabetes Tipo 1, Diabetes Tipo 2, Diabetes Gestacional |
| `paciente_enfermedad` | `id_paciente`, `id_enfermedad` | El registro inserta **una** fila (`enfermedad_id` único) |
| `tratamientos` | `id_tratamiento`, `nombre_tratamiento`, `descripcion` | **Solo 2 filas:** Insulina, Metformina |
| `tratamiento_enfermedad` | `id_paciente`, `id_tratamiento`, `dosis` (texto) | El registro inserta **una** fila, obligatoria |
| `seguimiento_embarazo` | `id_seguimiento`, `id_paciente`, `fecha_registro`, `semanas_embarazo`, `fecha_terminacion` | |
| `medico` | `id_medico`, `id_usuario`, especialidad, departamento, matrícula y carnet (URL) | `paciente.id_medico` = médico asignado |
| `alertas` | `id_tipo_alerta`, `id_registro`, `id_medico`, `fecha_alerta`, `estado` | La crea el cliente con `registrarAlerta` |
| `perfiles_pacientes` | — | En el código es el **bucket de Storage** de las fotos, no una tabla (design.md lo lista como tabla: corregir) |

## 3. Correspondencias variable del modelo ↔ base

| Variable del modelo | Fuente en la base | Transformación | Estado |
|---|---|---|---|
| `glucosa` | cuerpo del registro del médico (`nivel_glucosa`) = fila recién insertada | ninguna (mg/dL) | **DISPONIBLE** |
| `momento` | `registro_glucosa.id_momento` → `momento_dia` | `1` → `ayunas`; `2` → `postprandial`; **`3` (antes de dormir) no tiene equivalente** | **AMBIGUA** (2 de 3 momentos) |
| `genero` | `paciente.genero` (texto libre) | minúsculas; `masculino`/`hombre` → `masculino`; `femenino`/`mujer` → `femenino`; otro → sin datos. Hoy hay valores `Masculino`, `Femenino`, `MASCULINO` y `mujer` | **DERIVABLE** (normalizar) |
| `edad` | `usuario.fecha_nac` | años cumplidos a la **fecha de la lectura**; descartar ≤ 0 o > 120 | **DERIVABLE** |
| `bmi` | `paciente.peso` (kg) y `paciente.altura` (**m**) | `peso / altura²`; exigir altura 1,0–2,5 m y peso 20–300 kg y resultado ≤ 80. **Nunca dividir por centímetros** | **DERIVABLE** (6 de 7 tipo 2 con altura plausible) |
| `duracion_diabetes` | — (no hay fecha ni año de diagnóstico) | — | **FALTA** (obligatoria) |
| `categoria_medicacion` | `tratamiento_enfermedad` → `tratamientos.nombre_tratamiento` | nombre contiene «insulin» → `insulina`; contiene sulfonilurea/glimepirida/glibenclamida/glipizida/gliclazida → `sulfonilurea`; otro → `metformina_u_otros`; sin filas → `ninguno`. Si hay varias: insulina > sulfonilurea > otros (como en el entrenamiento) | **DERIVABLE** (el catálogo solo tiene Insulina y Metformina: `sulfonilurea` nunca aparece y «metformina» no distingue «otros») |
| `com_hipertension`, `com_dislipidemia`, `com_renal`, `com_neuropatia`, `com_nefropatia`, `com_cardiovascular` | — (`enfermedades_base` solo tiene tipos de diabetes) | — | **FALTA** (el contrato permite `false` por defecto) |
| `hba1c` | — | enviar `null` | **FALTA**, pero es opcional |

## 4. Regla «solo diabetes tipo 2»

**Cómo lo representa la base:** el tipo es una fila de `paciente_enfermedad` que apunta a `enfermedades_base` (catálogo de 3 nombres). La app y la clasificación de glucosa ya usan el **nombre** (`enfermedades[0]`, `«Diabetes Tipo 2»`). Los ids del catálogo no están versionados.

**Regla propuesta (exacta):** el paciente es tipo 2 si y solo si
1. tiene **exactamente una** fila en `paciente_enfermedad`, y
2. el `nombre_enfermedad` de esa fila, normalizado (minúsculas, sin tildes, espacios colapsados), es `diabetes tipo 2`, y
3. `paciente.embarazo` no es verdadero (la propuesta excluye a las embarazadas: el modelo se entrenó con adultos de un hospital sin embarazo; **decisión clínica**, §6).

| Caso | Resultado | Motivo devuelto |
|---|---|---|
| 0 filas (sin tipo) | no se llama al ML | `no_aplica_tipo` |
| Tipo 1 o gestacional | no se llama | `no_aplica_tipo` |
| 2 o más filas (p. ej. tipo 1 + tipo 2) | no se llama (ambiguo) | `no_aplica_tipo` |
| Nombre desconocido (catálogo ampliado) | no se llama | `no_aplica_tipo` |
| Tipo 2 con embarazo | no se llama | `no_aplica_tipo` (a confirmar) |
| Tipo 2 pero faltan datos obligatorios | no se llama | `datos_insuficientes` |

**Conteos reales (GET, sin datos individuales; pacientes con cuenta activa de médicos activos, 31 en total — `misPacientes` de los 16 médicos activos, sin duplicados):**

| Medida | Pacientes |
|---|---|
| Diabetes Tipo 1 | 22 |
| **Diabetes Tipo 2 (cumplen la regla)** | **7** (22,6 %) |
| Diabetes Gestacional | 1 |
| Sin ninguna enfermedad | 1 |
| Con más de una enfermedad | 0 |
| Tipo 2 con edad válida / género reconocible / tratamiento | 7 / 7 / 7 |
| Tipo 2 con IMC derivable y plausible (altura 1,2–2,2 m) | 6 |
| **Tipo 2 con TODOS los datos obligatorios del modelo** | **0** (falta `duracion_diabetes` en la base) |

Si se aceptara `duracion_diabetes` desconocida y las comorbilidades como `false`, **6 de 7** podrían calcularse hoy (el séptimo, por altura implausible). Esa opción se descarta como recomendación (§6).

## 5. Variables derivadas de las lecturas

**El modelo no usa ninguna.** Su entrada tiene una sola lectura (`glucosa`, `momento`) y el perfil; no hay ventana de tiempo, promedio, variabilidad ni conteo de lecturas, por lo que **no hay mínimo de lecturas ni zona horaria que definir** y la decisión «todas las lecturas del paciente, con o sin `id_medico`» **no tiene efecto con el contrato actual**. La lectura recién registrada es la entrada (`nivel_glucosa` del cuerpo, `id_momento`). La zona horaria solo interviene al calcular la edad a la fecha de la lectura (fecha local que envía el cliente).

**Diferencias entre lo que el modelo espera y lo que la base entrega (se documentan, no se corrigen):**
1. **Origen de la glucosa:** entrenamiento = glucosa plasmática de laboratorio en una visita hospitalaria; GlucoTracker = lectura capilar o de glucómetro. Distinta medición y contexto.
2. **Momento:** el modelo solo conoce `ayunas` y `postprandial` (2 h tras la comida). La app tiene tres momentos y «después de comer» puede medirse a otras horas (la recomendación de 2 horas es solo un aviso).
3. **Etiqueta:** «hipoglucemia observada en la visita». Una lectura < 70 ya es hipoglucemia observada (en el modelo sintético la regla R4 la convierte en riesgo alto): el número será alto para lecturas bajas, coincidiendo con la alerta ADA, y **no aporta información nueva** en ese caso.
4. **Población:** adultos con diabetes tipo 2 de un hospital de Shanghái (real) o reglas escritas por el equipo (sintético). Los pacientes de GlucoTracker pueden ser otros.
5. **Contexto futuro:** si un modelo posterior usa historial (variabilidad, tiempo bajo 70), habrá que **definir ventana, mínimo de lecturas y zona horaria** y decidir si cuentan las lecturas del médico (`id_medico` no nulo). Mientras tanto se recomienda no filtrar por origen, como decidió el equipo.

## 6. Brechas y opciones

| Brecha | Opciones | Recomendación | Impacto | ¿Decisión clínica? |
|---|---|---|---|---|
| `duracion_diabetes` **FALTA** (obligatoria) | A) pedir «años con diabetes» (o año de diagnóstico) en el registro de paciente y en la edición; B) derivarla de `usuario.fecha_registro` (no es el diagnóstico: **incorrecto**); C) enviar un valor fijo (inventado); D) excluir a los pacientes sin el dato | **A + D**: columna nueva `paciente.anio_diagnostico` (entero, nullable); sin dato → `datos_insuficientes`. No inventar | Cambio de **esquema en Supabase**, de `registrarPaciente`/`actualizarPaciente` y de las pantallas de registro y edición de la app. No cambia el contrato del ML | Pregunta al equipo: ¿se pide el año de diagnóstico al paciente (puede no saberlo) o lo registra el médico? |
| Comorbilidades (6) **FALTAN** | A) `false` por defecto (contrato) y declararlo; B) capturarlas (lista de comorbilidades en el registro o ficha del médico; tabla `paciente_comorbilidad` o 6 booleanos); C) excluir | **A en la primera fase** (declarar en la pantalla del médico «sin comorbilidades capturadas»), **B después** si el equipo valida el modelo | A: ninguno. B: esquema Supabase + app + backend. En el modelo sintético solo `com_renal` y `com_nefropatia` mueven el resultado (+0,6/+0,3): enviar `false` **subestima** el riesgo | **Sí:** ¿es aceptable que «no capturado» se envíe como «no tiene»? |
| `hba1c` | `null` (opcional) | `null`; capturarla en una fase futura | Ninguno ahora | No |
| `momento` = antes de dormir | A) no calcular (`datos_insuficientes` u otro motivo); B) tratarlo como `ayunas` (no es equivalente); C) ampliar el modelo (fuera de alcance) | **A**, con un motivo propio **`momento_no_cubierto`** (el contrato pedía tres motivos; este caso no encaja en ninguno) | Cambio solo en el backend | Menor |
| `categoria_medicacion`: `sulfonilurea` imposible y `ninguno` casi imposible | Ampliar el catálogo `tratamientos` o aceptar la limitación | Aceptar la limitación en la primera fase y documentarla; ampliar el catálogo si se quiere cubrir | Catálogo en Supabase + formularios (ya cargan el catálogo real) | Sí: ¿qué tratamientos debe ofrecer la app? |
| `genero` texto libre | normalizar en el backend; corregir los datos existentes (`mujer`, `MASCULINO`) o validar en el registro | Normalizar en el backend ahora; validar la entrada del registro más adelante | Ninguno en esquema | No |
| Altura implausible (1 de 7 tipo 2) | `datos_insuficientes` si altura fuera de 1,0–2,5 m | Hacerlo; avisar a Adrian del dato | Ninguno | No |
| Embarazo con tipo 2 | excluir / permitir | Excluir en la primera fase | Ninguno | **Sí** |

## 7. Diseño propuesto (sin implementar)

**Módulo cliente ML, aislado:** `backend/app/services/ml_client.py` con:
- `ML_ENABLED` (por defecto **`false`**), `ML_SERVICE_URL` (por defecto vacía; en Compose `http://ml_service:8002`) y `ML_TIMEOUT_SECONDS` (por defecto **1,0**, con conexión 0,3), leídas de variables de entorno en `core/config.py`.
- `httpx` (ya está en `requirements.txt`) con `AsyncClient` y `timeout`; **cualquier excepción o código ≠ 200 → `riesgo = null`, motivo `no_disponible`**, registrando solo el nombre de la clase de la excepción y el código HTTP (nunca el cuerpo, ni glucosa, ni ids).
- Funciones puras testeables: `es_tipo_2(enfermedades, embarazo)`, `normalizar_genero`, `calcular_edad(fecha_nac, fecha_lectura)`, `calcular_bmi(peso, altura_m)`, `categoria_medicacion(tratamientos)`, `armar_entrada(datos_paciente, glucosa, id_momento, fecha)` → `dict` del contrato o `(None, motivo)`.

**Dónde se inserta:** en `registrar_glucosa_medico` (`api/medicos.py:427`), **después** de que el `insert` en `registro_glucosa` tiene éxito y **antes** del `return`: `riesgo_ml = await calcular_riesgo_ml(...)`, envuelto en `try/except Exception` y en `asyncio.wait_for` (tope total, p. ej. 1,5 s), de modo que **ningún fallo del ML puede cambiar el 200 ni el cuerpo existente**. `ML_ENABLED=false` → el campo no se añade (o `null` con `no_disponible`; ver forma abajo). El registro del paciente no se toca.

**Consultas a Supabase:** caben en **una sola consulta con relaciones**, igual que `datosGlucosa` (`registro.py:37`): `paciente(genero, peso, altura, embarazo, usuario(fecha_nac), paciente_enfermedad(enfermedades_base(nombre_enfermedad)), tratamiento_enfermedad(tratamientos(nombre_tratamiento)))` filtrada por `id_paciente`. (Si se añade `anio_diagnostico`, se incluye en la misma consulta.) Latencia del paso de datos: **no medida** (no se midió la consulta real; se estima de decenas a pocos cientos de ms, como las demás consultas del backend). Latencia del ML: p95 de unos 9 ms declarado por el equipo; medido ahora, `GET /health` del backend al `ml_service` por la red interna: **mediana 1,4 ms, p95 2,6 ms** (20 llamadas). NFR-003 (p95 < 2000 ms) se cumple holgadamente.

**Forma del campo nuevo (aditivo):** clave nueva de primer nivel, **no** dentro de `registro_glucosa` (que es la fila de la base y no tiene esas columnas):
```json
{
  "message": "Registro insertado correctamente",
  "id_registro": 123,
  "registro_glucosa": { "...": "sin cambios" },
  "riesgo_ml": {
    "riesgo_hipoglucemia": 0.1234,
    "version_modelo": "1.0.0-demo",
    "motivo": null
  }
}
```
Cuando no se calcula: `{"riesgo_hipoglucemia": null, "version_modelo": null, "motivo": "no_aplica_tipo" | "datos_insuficientes" | "no_disponible" | "momento_no_cubierto"}`. No se guarda en la base.
**Compatibilidad:** el front web de Angular solo lee `registro_glucosa.id_registro` (`registrar-glucosa.ts:187`) y la app móvil `registro_glucosa.id_registro` o `id_registro` (`services/glucosa.ts`): una clave nueva no los rompe. No se quita ni renombra ningún campo.

**Pruebas (ML simulado):** `pytest` con `httpx.MockTransport` o `monkeypatch` del cliente: caso feliz (cuerpo exacto enviado al ML, sin ids ni nombres), tipo 1/gestacional/múltiple/sin tipo → sin llamada, datos faltantes → sin llamada, ML con 503/422/500, timeout y excepción de red → `no_disponible` y **el registro responde igual**, `ML_ENABLED=false` → sin llamada, y que el cuerpo previo del endpoint no cambia. Los endpoints del médico hoy no tienen prueba de `registrar/glucosa` (se añade).

**Compose (`docker-compose.yml`):** el `backend` **ya está en la red interna `red_ml`** (`internal: true`, sin salida a Internet ni acceso desde el host) y alcanza `http://ml_service:8002` (comprobado desde el contenedor: 200). Solo hace falta añadir al servicio `backend`: `environment: ML_ENABLED: ${ML_ENABLED:-false}`, `ML_SERVICE_URL: http://ml_service:8002` y `ML_TIMEOUT_SECONDS`; **no** añadir `ports` al `ml_service` ni `depends_on` bloqueante. Para el modelo sintético: `ML_MODELO=demo` en el `.env` de la raíz y haber ejecutado `ml_entrenar_demo`.

## 8. Riesgos

1. **Privacidad (NFR-001):** al ML solo viajan los 15 campos del contrato (edad, género, IMC, duración, medicación, comorbilidades, HbA1c, glucosa, momento): **sin nombre, correo, teléfono, C.I. ni ids** (el esquema rechaza campos extra con 422). El backend no debe registrar el cuerpo ni la respuesta. Son datos de salud sensibles aunque no identifiquen: red interna sin salida a Internet.
2. **Unidades:** altura en **metros** (no dividir por 100 de más), peso en kg, glucosa en mg/dL, edad entera.
3. **Limitación del modelo:** el real (AUC 0,640, validación cruzada sin señal sobre el azar) **no debe presentarse como predicción**; el sintético (AUC 0,78) mide las reglas escritas por el equipo, no la realidad. Redacción propuesta para la pantalla del médico: «**Estimación experimental, no clínica.** Se calcula con un modelo en evaluación y con datos incompletos del paciente. No es un diagnóstico, no reemplaza el criterio clínico y no genera alertas.» Sin mostrar el número como porcentaje exacto (p. ej. «baja / media / alta» solo cuando el equipo defina cortes: hoy no existen, ML-D4).
4. **Sin autenticación (RB-01):** el endpoint `POST /api/medicos/registrar/glucosa` no autentica ni valida que el paciente sea del médico; con esta integración, **cualquiera podría obtener un riesgo calculado de cualquier paciente con solo su id** (y escribir lecturas en su historial). Hallazgo para Adrian (anotado en CONTEXT.md).
5. **Doble envío:** el endpoint no es idempotente; cada reintento duplica la lectura y vuelve a llamar al ML (barato). La app ya bloquea el doble toque.
6. **Interpretación:** sin alertas automáticas por riesgo (decisión 7); el número no debe alterar la clasificación ADA ni el correo.
7. **Estado actual del servicio:** hoy corre el modelo real; si se activa sin cambiar `ML_MODELO` el médico vería el del AUC 0,64 en lugar del sintético.

## 9. Decisiones abiertas (pregunta exacta y recomendación)

| # | Pregunta para el equipo | Recomendación |
|---|---|---|
| 1 | `duracion_diabetes` no existe en la base y el modelo la exige: ¿se pide **el año de diagnóstico** al registrar y editar al paciente (columna nueva en Supabase) o se deja el riesgo en `datos_insuficientes` hasta tenerla? | Columna `paciente.anio_diagnostico` nullable + captura en registro y edición; mientras tanto `datos_insuficientes`. No inventar valores |
| 2 | Las 6 comorbilidades no se capturan: ¿es aceptable enviarlas como `false` (el contrato lo permite) y declararlo en pantalla, o no se calcula nada hasta capturarlas? | Aceptable solo en la primera fase y con el rótulo «sin comorbilidades capturadas»; capturarlas después (requiere decisión clínica) |
| 3 | ¿Se excluye a las pacientes con diabetes tipo 2 **y embarazo**? | Sí, excluirlas (`no_aplica_tipo`) |
| 4 | «Antes de dormir» no existe en el modelo: ¿se devuelve un motivo propio `momento_no_cubierto` (cuarto motivo, además de los tres acordados)? | Sí |
| 5 | La `version_modelo` del sintético es `1.0.0-demo` y llegaría a la respuesta, contra la decisión de no mencionar «demo». ¿La app lo oculta, el backend lo reenvía tal cual para trazabilidad, o se renombra la versión en el ML (cambio fuera de esta fase)? | Reenviarla tal cual y que la app **no la muestre**; renombrar solo si el equipo lo pide |
| 6 | ¿Qué hacer con los datos de género inconsistentes (`mujer`, `MASCULINO`)? | Normalizar en el backend; validar la entrada en el registro más adelante |
| 7 | ¿Se amplía el catálogo `tratamientos` (hoy Insulina y Metformina) para poder representar sulfonilureas y «ninguno»? | Sí, si se quiere que el modelo distinga la medicación; si no, aceptar la limitación |
| 8 | ¿Cómo se redacta y se presenta el resultado al médico (número, categorías o solo texto)? | Texto de la sección 8.3, sin cortes ni porcentajes hasta definir ML-D4 |
| 9 | ¿Se activa antes de resolver la autenticación (RB-01)? | No en un despliegue real; sí solo en una red local de desarrollo y con el modelo sintético |
