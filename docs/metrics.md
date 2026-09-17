# GlucoTracker — Métricas Técnicas y de Negocio (KPIs) por Historia de Usuario

> Documento generado a partir del análisis de las 8 historias de usuario (US-01 a US-08) registradas en el workspace de ClickUp del proyecto GlucoTracker.
> Formato de ficha basado en el modelo "El Puente de Métricas": cada historia incluye una métrica **técnica** (rendimiento del sistema/modelo), una métrica de **negocio/KPI** (impacto real en pacientes, médicos o la operación), y un **criterio de éxito/restricción** con enfoque _human-in-the-loop_ cuando aplica.
> Fecha de elaboración: 2026-09-17

---

## US-01: Inicio de Sesión Seguro

**El Puente de Métricas**

| Técnica                                                                                                                                                                                            | Negocio                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Tasa de autenticación exitosa con credenciales válidas > **99%**; 100% de las conexiones cifradas mediante un protocolo de cifrado estándar; 0 contraseñas almacenadas o logueadas en texto plano. | Reducir a **0 incidentes por trimestre** de acceso no autorizado a información médica sensible (cumplimiento de protección de datos de salud). |

**Historia de Usuario (Inferencia)**
Como usuario del sistema (Paciente, Médico o Administrador), quiero iniciar sesión de forma segura desde la app móvil, para acceder a mi panel protegiendo mi información médica.

**Criterio de Éxito / Restricción (Human-in-the-loop)**
El sistema no debe revelar qué campo (usuario o contraseña) fue incorrecto ante un login fallido, para evitar enumeración de cuentas. Tras **5 intentos fallidos consecutivos**, la cuenta se bloquea y requiere reactivación manual por parte de un Administrador (no reactivación automática).

---

## US-02: Gestión y Aprobación de Médicos

**El Puente de Métricas**

| Técnica                                                                                                                                             | Negocio                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Tiempo medio de verificación de matrícula profesional < **48 horas** desde el registro; tasa de error en la captura de datos de matrícula < **2%**. | Reducir el tiempo de alta de un nuevo médico en la plataforma en **50%** frente al proceso manual actual (papel/correo). |

**Historia de Usuario (Inferencia)**
Como Administrador, quiero registrar y gestionar nuevos usuarios validando obligatoriamente su matrícula, para asegurar que solo profesionales médicos autorizados usen la plataforma.

**Criterio de Éxito / Restricción (Human-in-the-loop)**
El sistema **NO** aprueba automáticamente a un médico solo por completar el formulario. La validación de la matrícula requiere confirmación humana explícita del Administrador antes de habilitar la cuenta; el estado visible debe ser "Pendiente de aprobación" hasta esa confirmación.

---

## US-03: Registro de Tomas de Glucosa

**El Puente de Métricas**

| Técnica                                                                                                                                                      | Negocio                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Tasa de registros rechazados por campos vacíos/formato inválido < **1%**; tiempo de persistencia del registro (guardado + confirmación en app) < **500 ms**. | **80%** de los pacientes activos registran al menos 3 tomas de glucosa por día (adherencia al monitoreo diario). |

**Historia de Usuario (Inferencia)**
Como Paciente, quiero registrar mis niveles de glucosa indicando la hora y el momento del día (ej. Ayunas), para llevar un control exacto de mis tomas.

**Criterio de Éxito / Restricción (Human-in-the-loop)**
Si la tasa de errores de captura de un paciente supera un umbral (ej. **>10% de registros corregidos/repetidos** en una semana), el caso se marca para que un Médico o Administrador revise si la interfaz necesita simplificarse para ese usuario (vinculado al riesgo de usabilidad en adultos mayores, NFR-004).

---

## US-04: Clasificación Automática (Machine Learning)

**El Puente de Métricas**

| Técnica                                                                                                                                                                              | Negocio                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Precisión del clasificador binario (Normal / Riesgo Hipo) > **90%**; Tasa de Falsos Negativos < **5%**; Latencia de inferencia p95 < **2000 ms** (definida en la historia original). | Reducir el tiempo de detección de un evento de riesgo glucémico frente al monitoreo manual/periódico en **90%**. |

**Historia de Usuario (Inferencia)**
Como Sistema, quiero evaluar cada nueva toma de glucosa con un modelo de ML en menos de 2 segundos, para clasificarla automáticamente como Normal o Riesgo Hipo.

**Criterio de Éxito / Restricción (Human-in-the-loop)**
El modelo **NO** notifica directamente a servicios de emergencia ni toma acciones clínicas por sí solo. Si la confianza de la clasificación es **< 70%**, el registro se marca como "revisión requerida" y se prioriza para evaluación humana antes de escalar la alerta como crítica al Médico (evita falsos positivos costosos, en línea con la "Miopía de Precisión" a evitar).

---

## US-05: Alertas Críticas en Tiempo Real

**El Puente de Métricas**

| Técnica                                                                                                                                                                                   | Negocio                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Tasa de entrega exitosa de notificaciones push > **98%**; tiempo desde la clasificación de riesgo hasta la notificación al médico (p95) < **2000 ms** (definida en la historia original). | Reducir el Tiempo Medio de Intervención Médica (**MTTI**) ante un evento crítico en **20%** frente al esquema de seguimiento manual. |

**Historia de Usuario (Inferencia)**
Como Médico, quiero recibir notificaciones push en tiempo real cuando un registro sea riesgoso, para poder intervenir rápidamente ante eventos críticos de mis pacientes.

**Criterio de Éxito / Restricción (Human-in-the-loop)**
Si el servicio de mensajería en la nube falla o no confirma la entrega en **2 segundos**, el sistema debe activar un canal de respaldo (ej. SMS o email) en lugar de asumir silenciosamente que la alerta llegó — ningún evento crítico debe depender de un solo canal de notificación.

---

## US-06: Chatbot Asistente de Diabetes

**El Puente de Métricas**

| Técnica                                                                                                                                         | Negocio                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Tasa de respuestas relevantes/correctas (evaluadas por muestreo humano) > **85%**; tasa de respuestas fuera de dominio o "alucinadas" < **5%**. | Reducir en **30%** las consultas triviales o repetitivas que hoy absorben tiempo de consulta médica presencial/telefónica. |

**Historia de Usuario (Inferencia)**
Como Paciente, quiero interactuar con un chatbot integrado en la app, para resolver mis dudas rápidas sobre nutrición básica y uso de la aplicación.

**Criterio de Éxito / Restricción (Human-in-the-loop)**
El chatbot **NO** debe dar diagnósticos, ajustar dosis ni reemplazar indicación médica. Toda respuesta relacionada con salud debe incluir explícitamente la aclaración de que no sustituye el consejo médico directo, y ante temas sensibles (ej. dosis de insulina, síntomas de emergencia) debe derivar al Médico en lugar de responder.

---

## US-07: Visualización de Historial y Gráficos

**El Puente de Métricas**

| Técnica                                                                                                                                 | Negocio                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tiempo de renderizado del historial/gráfico < **1 segundo** para rangos de hasta 1000 puntos; tasa de error de carga de datos = **0%**. | Aumentar en **25%** la frecuencia semanal de revisión del historial por parte de pacientes y médicos (proxy de mejor seguimiento y toma de decisiones). |

**Historia de Usuario (Inferencia)**
Como Paciente o Médico, quiero visualizar el historial completo de glucosa mediante listas y gráficos filtrables, para analizar las tendencias de salud a lo largo del tiempo (diario, semanal, mensual).

**Criterio de Éxito / Restricción (Human-in-the-loop)**
Si el volumen de datos a graficar supera un umbral definido (ej. **>1000 puntos**), el sistema debe aplicar agregación o muestreo automático en lugar de intentar renderizar todos los puntos y degradar el rendimiento de la app móvil.

---

## US-08: Reportes Clínicos Exportables

**El Puente de Métricas**

| Técnica                                                                                                                    | Negocio                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Tasa de generación exitosa de PDF sin errores de renderizado > **98%**; tiempo de generación del reporte < **5 segundos**. | Reducir en **40%** el tiempo administrativo que el Médico dedica a preparar informes de seguimiento por paciente. |

**Historia de Usuario (Inferencia)**
Como Médico, quiero generar reportes clínicos exportables sobre el estado de un paciente, para tener un documento físico o digital (PDF) de su evolución.

**Criterio de Éxito / Restricción (Human-in-the-loop)**
El reporte generado automáticamente debe pasar por una confirmación visual del Médico (revisión antes de compartir) dado su uso clínico/legal; el sistema no debe enviar o entregar el PDF a terceros sin esa confirmación explícita.

---

## Notas finales

- Los valores numéricos (%, ms, tiempos) son **estimaciones iniciales inferidas** a partir del contexto del proyecto y de los criterios de aceptación ya definidos en cada historia de usuario; deben ajustarse una vez exista una línea base (baseline) real medida sobre el dataset y el pipeline.
- Todas las métricas de negocio están formuladas evitando la "Miopía de Precisión": no se limitan a exactitud del modelo, sino a impacto verificable (tiempo, adherencia, carga administrativa, intervención médica), y cada una se evaluará contra un baseline medido antes de la implementación.
- Los criterios de éxito de US-01, US-02, US-04, US-06 y US-08 incorporan explícitamente una restricción _human-in-the-loop_, evitando que el sistema tome decisiones críticas de forma autónoma sin supervisión humana.
- El alcance del proyecto se limita a hipoglucemia y diabetes tipo 2; por ello, la clasificación de riesgo (US-04) es binaria (Normal / Riesgo Hipo) y no incluye riesgo de hiperglucemia.
