# requirements.md
> GlucoTracker — Version 1.2.0 — 2026-10-24

## Overview
GlucoTracker es una aplicación móvil para el monitoreo continuo de niveles de glucosa en pacientes con diabetes. Integra un modelo de Machine Learning que estima, para cada registro de glucosa, la probabilidad de hipoglucemia (información visible solo al médico, no diagnóstica ni disparadora de alertas), notifica en tiempo real a los médicos ante registros clasificados como críticos según umbrales clínicos, y ofrece un chatbot asistente para resolver consultas del paciente sobre diabetes, nutrición y uso de la app.

## Actors
- **Paciente**: Usuario final. Registra niveles de glucosa, consulta su historial, interactúa con el chatbot y recibe alertas sobre su estado de salud.
- **Médico**: Supervisa a sus pacientes asignados, recibe alertas automáticas ante registros clasificados como de riesgo según umbrales clínicos, consulta la probabilidad informativa de hipoglucemia estimada por el modelo de ML, visualiza historiales y genera reportes clínicos.
- **Administrador**: Gestiona usuarios (aprobación de pacientes y médicos), roles, mantenimiento del sistema y auditoría.
- **Sistema (Backend/ML)**: Actor no humano — el backend clasifica cada registro según umbrales clínicos y dispara las notificaciones automáticas; el modelo de ML solo estima la probabilidad informativa de hipoglucemia, visible solo al médico, y no dispara alertas.

## Functional Requirements

### Autenticación y Gestión de Usuarios
- **REQ-001**: Todos los actores shall iniciar sesión de forma segura desde la app móvil.
  - _Acceptance_: Un usuario con credenciales válidas accede a su panel correspondiente según su rol; credenciales inválidas son rechazadas sin revelar cuál campo falló.
- **REQ-002**: El Administrador shall registrar nuevos usuarios, incluyendo validación de matrícula profesional para médicos.
  - _Acceptance_: Un médico no puede completar el registro sin una matrícula válida; el administrador puede aprobar o rechazar solicitudes de alta.

### Registro y Clasificación de Glucosa
- **REQ-003**: El Paciente shall ingresar los datos de su toma de glucosa (nivel, hora, momento del día — ej. Ayunas, Postprandial).
  - _Acceptance_: Un registro se guarda con nivel de glucosa, timestamp y momento del día; campos obligatorios no pueden quedar vacíos.
- **REQ-004**: El Sistema shall estimar, para cada nueva toma de glucosa, la probabilidad (0–1) de hipoglucemia observada en el registro, a partir de la lectura (nivel y momento del día) y del perfil clínico del paciente, mediante el modelo de ML.
  - _Acceptance_: Cada registro evaluado tiene una probabilidad asociada, visible al médico, generada en menos de 2 segundos (ver NFR-003); hasta su calibración con revisión clínica se presenta como información, no como diagnóstico ni como disparador automático de alertas.
- **REQ-005**: El Sistema shall generar y enviar una notificación push en tiempo real al médico responsable cuando un registro se clasifique como riesgoso/crítico.
  - _Acceptance_: Al guardar un registro con clasificación de riesgo, el médico asignado recibe una notificación push dentro de los siguientes 2 segundos.

### Chatbot Asistente
- **REQ-006**: El Paciente shall poder interactuar con un chatbot integrado para consultas sobre diabetes, nutrición básica y niveles de glucosa.
  - _Acceptance_: El chatbot responde a una consulta de texto libre relacionada con diabetes y aclara explícitamente que no reemplaza el consejo médico directo.

### Historial y Reportes
- **REQ-007**: El Paciente y el Médico shall poder visualizar el historial completo de niveles de glucosa (diario, semanal, mensual) mediante listas y gráficos.
  - _Acceptance_: El historial se puede filtrar por rango de fechas y se muestra tanto en formato lista como gráfico.
- **REQ-008**: El Médico shall poder generar reportes clínicos exportables en PDF sobre el estado de un paciente.
  - _Acceptance_: El médico puede descargar un PDF con la evolución clínica del paciente para un rango de fechas dado.

## Non-Functional Requirements
- **NFR-001**: Privacidad y Seguridad — Las contraseñas deben estar hasheadas y los datos médicos deben transmitirse cifrados (HTTPS/SSL).
  - _Measurement_: Auditoría de que ningún endpoint acepta tráfico HTTP plano; contraseñas almacenadas nunca en texto plano (verificable en la base de datos).
- **NFR-002**: Disponibilidad — La infraestructura en Azure/Supabase debe garantizar un uptime del 95%.
  - _Measurement_: Monitoreo de uptime mensual ≥ 95% medido por el servicio de monitoreo de Azure.
- **NFR-003**: Rendimiento (Latencia ML) — La estimación de la probabilidad de hipoglucemia de una toma de glucosa debe retornar en menos de 2 segundos.
  - _Measurement_: Tiempo de respuesta del endpoint de estimación de riesgo del modelo de ML medido en p95 < 2000ms bajo carga normal.
- **NFR-004**: Usabilidad — La interfaz móvil debe ser intuitiva y adaptada a personas de diversas edades.
  - _Measurement_: Pruebas de usabilidad con al menos 5 usuarios de distintos rangos etarios sin necesidad de ayuda externa para completar el flujo de registro de glucosa.

## Out of Scope (1.0.0)
- Integración directa con dispositivos médicos (glucómetros, CGMs) vía Bluetooth/NFC — el ingreso de datos es manual en esta versión.
- Telemedicina o videollamadas entre paciente y médico.
- Soporte multi-idioma (la versión 1.0.0 asume español).
- Facturación o gestión de pagos dentro de la app.
- Versión web para pacientes (la app móvil es el único canal de paciente en esta versión).

## Changelog
| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-08-24 | Initial spec, derivado de Especificacion_Sistema_GlucoTracker.md |
| 1.1.0 | 2026-10-24 | REQ-004 redefinido (ML-D1, aprobado por el equipo): el ML estima la probabilidad de hipoglucemia observada en el registro, visible al médico y solo informativa hasta su calibración; la clasificación Normal/Hipo/Hiper sale del alcance del ML. |
| 1.2.0 | 2026-10-24 | Overview, Actores (Médico, Sistema) y NFR-003 alineados con REQ-004: el ML solo estima la probabilidad informativa de hipoglucemia, visible solo al médico; las alertas salen de la clasificación por umbrales clínicos del backend. Decisión del equipo. |
