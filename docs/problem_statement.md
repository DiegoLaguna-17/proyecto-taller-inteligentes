# GlucoTracker — Problem Statements por Historia de Usuario

---

## US-01: Inicio de Sesión Seguro
- **Usuario/afectado:** Paciente, Médico o Administrador
- **Contexto:** Al iniciar sesión desde la app móvil para acceder a su panel
- **Problema observable:** Riesgo de acceso no autorizado a información médica sensible
- **Impacto actual:** Posibles incidentes de seguridad por accesos indebidos
- **Resultado esperado:** Autenticación segura que protege credenciales y datos
- **Métrica de valor:** 0 incidentes de acceso no autorizado por trimestre (vs. baseline)
- **Fuera de alcance:** Reactivación automática de cuentas bloqueadas

---

## US-02: Gestión y Aprobación de Médicos
- **Usuario/afectado:** Administrador
- **Contexto:** Al registrar y aprobar nuevos médicos en la plataforma
- **Problema observable:** Alta manual sin validación ágil de matrícula profesional
- **Impacto actual:** Demoras operativas frente al proceso manual (papel/correo)
- **Resultado esperado:** Alta de médicos con validación y estado de aprobación visible
- **Métrica de valor:** -50% en tiempo de alta de un médico (vs. baseline manual)
- **Fuera de alcance:** Aprobación automática sin confirmación humana

---

## US-03: Registro de Tomas de Glucosa
- **Usuario/afectado:** Paciente
- **Contexto:** Al registrar sus niveles de glucosa diariamente
- **Problema observable:** Falta de un registro exacto y consistente de las tomas
- **Impacto actual:** Monitoreo diario bajo o irregular
- **Resultado esperado:** Registro completo, preciso y persistente de cada toma
- **Métrica de valor:** 80% de pacientes activos registrando ≥3 tomas/día (vs. baseline)
- **Fuera de alcance:** Modificar la interfaz sin revisión humana

---

## US-04: Clasificación Automática (Machine Learning)
- **Usuario/afectado:** Paciente y Médico (a través del Sistema)
- **Contexto:** Al evaluarse cada nueva toma de glucosa registrada
- **Problema observable:** Detección tardía o manual de eventos de hipoglucemia
- **Impacto actual:** Demora frente al monitoreo manual/periódico
- **Resultado esperado:** Clasificación automática (Normal / Riesgo Hipo) en <2 seg
- **Métrica de valor:** -90% en tiempo de detección de riesgo (vs. baseline manual)
- **Fuera de alcance:** Notificar emergencias o actuar clínicamente sin supervisión; clasificación de hiperglucemia

---

## US-05: Alertas Críticas en Tiempo Real
- **Usuario/afectado:** Médico
- **Contexto:** Al presentarse un evento de riesgo (hipoglucemia) en un paciente
- **Problema observable:** Intervención tardía por falta de notificación inmediata
- **Impacto actual:** Mayor Tiempo Medio de Intervención Médica (MTTI) bajo seguimiento manual
- **Resultado esperado:** Notificación push inmediata, con canal de respaldo si falla
- **Métrica de valor:** -20% en MTTI (vs. baseline de seguimiento manual)
- **Fuera de alcance:** Depender de un único canal de notificación

---

## US-06: Chatbot Asistente de Diabetes
- **Usuario/afectado:** Paciente
- **Contexto:** Al tener dudas rápidas sobre nutrición básica o uso de la app
- **Problema observable:** Consultas triviales/repetitivas absorben tiempo médico
- **Impacto actual:** Carga de consultas no clínicas sobre el personal médico
- **Resultado esperado:** Chatbot que resuelve dudas básicas y deriva temas sensibles al Médico
- **Métrica de valor:** -30% en consultas triviales/repetitivas (vs. baseline)
- **Fuera de alcance:** Diagnósticos, ajuste de dosis o reemplazo de indicación médica

---

## US-07: Visualización de Historial y Gráficos
- **Usuario/afectado:** Paciente y Médico
- **Contexto:** Al analizar tendencias de glucosa (diario, semanal, mensual)
- **Problema observable:** Dificultad para revisar el historial completo de forma clara
- **Impacto actual:** Baja frecuencia de revisión del historial
- **Resultado esperado:** Historial visualizable en listas y gráficos filtrables, sin errores de carga
- **Métrica de valor:** +25% en frecuencia semanal de revisión (vs. baseline)
- **Fuera de alcance:** Renderizar todos los puntos sin agregación al superar el umbral definido

---

## US-08: Reportes Clínicos Exportables
- **Usuario/afectado:** Médico
- **Contexto:** Al preparar informes de seguimiento por paciente
- **Problema observable:** Elaboración manual de reportes de evolución
- **Impacto actual:** Alta carga administrativa en la preparación de informes
- **Resultado esperado:** Generación de reporte clínico exportable (PDF) de la evolución del paciente
- **Métrica de valor:** -40% en tiempo administrativo de preparación (vs. baseline)
- **Fuera de alcance:** Enviar el PDF a terceros sin confirmación explícita del Médico
