# 13. Escrituras reales en los recorridos E2E (suite C)

* **Estado:** Propuesto (pendiente de revisión del equipo)
* **Fecha de decisión:** 2026-11-05
* **Autores:** Equipo GlucoTracker (rama `pruebas-e2e`)

## Contexto y Problema
La suite A (simulada) y la suite B (lectura contra el backend real) no prueban lo que más importa del flujo integrado: que una lectura se **guarde**, que la **alerta** se cree, que el **riesgo de ML** llegue a la pantalla del médico y que el **chatbot con el proveedor real** responda. Eso exige escribir en la base de Supabase de desarrollo (sin datos productivos) y llamar a Gemini, cuyo plan gratuito tiene cuota.

## Decisión
1. **Suite C separada** (`mobile/.maestro/flows/real-escritura/`, etiqueta `escritura-real`), con cuatro flujos como máximo: C1 el médico registra una glucosa normal (93 mg/dL) y ve el riesgo de ML; C2 el médico registra una glucosa baja (57 mg/dL) con alerta y riesgo; C3 el paciente registra una glucosa propia (97 mg/dL) y la ve en el historial; C4 el chatbot con el proveedor real (una sola pregunta corta).
2. **Compose aparte:** `docker-compose.e2e-real.yml` (override; no se edita el principal): OTP apagado como en `docker-compose.prueba.yml`, `ML_ENABLED=true`, chatbot con proveedor real y límite de tasa bajo, marca `E2E_REAL=true`, sin puertos nuevos y **sin secretos** (la clave sale del `.env` del servicio NLP).
3. **Guardas:** la suite C no corre sin `-ConfirmoEscrituras`; imprime qué escribirá; comprueba que el backend y el chatbot están en modo e2e-real leyendo 5 variables no secretas del contenedor (sin imprimirlas); exige `E2E_CUENTAS_DE_PRUEBA=si` y que `PACIENTE_CORREO` sea el del paciente `E2E_PACIENTE_ID` (un GET de solo lectura, sin imprimir datos). El flujo C4 solo corre con `E2E_CHAT_ACTIVO=si`: máximo **1 llamada a Gemini por ejecución**.
4. **Cifras identificables** (93, 57, 97) para ubicar las filas en la limpieza.
5. **Limpieza manual** con `docs/sql/limpiar_datos_e2e.sql`: primero un SELECT de vista previa y después un DELETE acotado por paciente, médico, ventana de fechas y esas cifras, en el orden de claves foráneas (retroalimentacion → alertas → registro_glucosa). Nada lo ejecuta automáticamente.
6. **Aislamiento:** las suites A y B no incluyen los flujos C (cada una corre su carpeta) y hay pruebas automáticas que lo vigilan y que impiden que el compose principal o los `.env.example` activen el modo e2e-real.

## Alternativas Consideradas
1. **No probar escrituras reales:** deja sin verificar el flujo principal de punta a punta.
2. **Una base de pruebas aparte:** lo correcto a largo plazo, pero hoy no existe; el equipo trabaja con una única base de desarrollo.
3. **Borrado automático al final:** descartada; un `DELETE` ejecutado por un script contra la base real es más peligroso que un paso manual revisado.
4. **Gemini en cada ejecución:** descartada por la cuota del plan gratuito.

## Consecuencias
* **Positivas:** se prueba el camino real (lectura guardada, alerta, riesgo, chatbot) con barreras explícitas.
* **Qué escribe una ejecución completa:** 3 filas en `registro_glucosa`, 1 en `alertas` (más un **correo real** al médico asignado, que envía el backend) y unas 10 a 40 en `auditoria_endpoints` (cada login y cada llamada que audita el backend; no las controlan los flujos). C4 hace 1 llamada a Gemini.
* **Riesgos aceptados:** escribe en la base real de desarrollo (hay que limpiar a mano); el OTP está apagado (ADR-0012) y el backend sigue sin autenticación (RB-01), así que **no debe usarse fuera de una red local de desarrollo**; las credenciales pasan a Maestro como variables `-e` y pueden verse en su salida: solo cuentas de prueba.
* **Límites conocidos:** el paciente de prueba debe ser tipo 2 con datos completos (peso 20–300 kg, altura, género, fecha de nacimiento y tratamiento) y tener asignado al médico de prueba; si faltan datos, el bloque de riesgo no trae porcentaje y el flujo solo comprueba lo que exista (con `E2E_ESPERA_RIESGO=si` lo exige).

## Relación con otras ADR
* **ADR-0010:** otro override de Compose más. **ADR-0011:** usa el riesgo de ML. **ADR-0012:** reutiliza el interruptor de OTP solo en archivos de prueba.
