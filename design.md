# design.md
> GlucoTracker — Version 1.0.0 — 2026-08-24

## Architecture Overview
Arquitectura cliente-servidor distribuida. La app móvil (React Native) consume una API REST expuesta por un backend en FastAPI, que centraliza tanto la lógica de negocio como el módulo de Machine Learning (clasificación de glucosa) y el módulo de NLP del chatbot, evitando microservicios adicionales. La persistencia se resuelve con Supabase (PostgreSQL gestionado). El backend se despliega en Azure.

**Stack**: React Native (frontend móvil) · FastAPI/Python (backend + ML + NLP) · Supabase/PostgreSQL (base de datos)
**Deployment**: Azure (hosting del backend y del módulo de ML), con conexión segura vía certificados SSL

## System Diagram
```
[App Móvil - React Native]
        |  HTTPS/REST
        v
[Backend API - FastAPI en Azure]
        |-- Módulo ML (clasificación SVC/Árbol de Decisión)
        |-- Módulo NLP (chatbot)
        |
        v
[Supabase / PostgreSQL]
        |
        v
[Notificaciones push -> dispositivo del Médico]
```

## Data Models

### T_Usuario
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | Identificador de usuario |
| nombre | VARCHAR(255) | NOT NULL | |
| correo | VARCHAR(255) | NOT NULL, UNIQUE | |
| contrasena_hash | TEXT | NOT NULL | Hasheada, nunca texto plano (NFR-001) |
| rol | VARCHAR(20) | NOT NULL, CHECK IN ('paciente','medico','administrador') | |
| estado | VARCHAR(20) | NOT NULL DEFAULT 'pendiente' | pendiente / aprobado / rechazado |

**Relationships**: 1—1 con T_Paciente, T_Medico o T_Administrador según `rol`.

### T_Paciente
| Field | Type | Constraints | Notes |
|---|---|---|---|
| usuario_id | UUID | PK, FK → T_Usuario.id | |
| actividad_fisica | VARCHAR(100) | NULL | |
| enfermedades_base | TEXT | NULL | |
| medico_asignado_id | UUID | FK → T_Medico.usuario_id, NULL | Médico responsable para alertas (REQ-005) |

**Relationships**: N—1 con T_Medico (médico asignado); 1—N con T_Registro_glucosa.

### T_Medico
| Field | Type | Constraints | Notes |
|---|---|---|---|
| usuario_id | UUID | PK, FK → T_Usuario.id | |
| especialidad | VARCHAR(100) | NOT NULL | |
| matricula | VARCHAR(50) | NOT NULL, UNIQUE | Validada en el registro (REQ-002) |

**Relationships**: 1—N con T_Paciente (pacientes asignados).

### T_Administrador
| Field | Type | Constraints | Notes |
|---|---|---|---|
| usuario_id | UUID | PK, FK → T_Usuario.id | |

**Relationships**: Ninguna adicional — hereda de T_Usuario.

### T_Registro_glucosa
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| paciente_id | UUID | FK → T_Paciente.usuario_id, NOT NULL | |
| fecha | DATE | NOT NULL | |
| hora | TIME | NOT NULL | |
| momento_dia | VARCHAR(30) | NOT NULL, CHECK IN ('ayunas','postprandial','otro') | |
| nivel_glucosa | NUMERIC(5,1) | NOT NULL | mg/dL |
| clasificacion_ml | VARCHAR(20) | NULL | Normal / Riesgo Hipo / Riesgo Hiper (REQ-004) |
| clasificado_en | TIMESTAMP | NULL | Cuándo el modelo emitió la clasificación |

**Relationships**: N—1 con T_Paciente; 1—N con T_Alertas.

### T_Alertas
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| registro_glucosa_id | UUID | FK → T_Registro_glucosa.id, NOT NULL | |
| tipo_alerta_id | UUID | FK → T_Tipo_alerta.id, NOT NULL | |
| vista | BOOLEAN | NOT NULL DEFAULT false | |
| respuesta_medico | TEXT | NULL | |
| creada_en | TIMESTAMP | NOT NULL DEFAULT now() | |

**Relationships**: N—1 con T_Registro_glucosa; N—1 con T_Tipo_alerta.

### T_Tipo_alerta
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| nombre | VARCHAR(50) | NOT NULL | ej. 'Hipoglucemia crítica' |
| nivel_criticidad | VARCHAR(20) | NOT NULL | |

**Relationships**: 1—N con T_Alertas.

### T_Auditoria_Endpoints
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| usuario_id | UUID | FK → T_Usuario.id, NULL | Null si la llamada no está autenticada |
| endpoint | VARCHAR(255) | NOT NULL | |
| metodo_http | VARCHAR(10) | NOT NULL | |
| timestamp | TIMESTAMP | NOT NULL DEFAULT now() | |
| resultado | VARCHAR(20) | NOT NULL | éxito / error / no autorizado |

**Relationships**: N—1 con T_Usuario (opcional).

## API / Interface Design

| Method | Path | Auth | REQ | Description |
|---|---|---|---|---|
| POST | /auth/login | Público | REQ-001 | Inicio de sesión, retorna token |
| POST | /auth/registro | Administrador | REQ-002 | Alta de paciente o médico, valida matrícula |
| POST | /pacientes/{id}/registros-glucosa | Paciente | REQ-003 | Registrar nueva toma de glucosa |
| GET | /ml/clasificar/{registro_id} | Sistema (interno) | REQ-004 | Clasifica un registro con el modelo ML |
| POST | /alertas | Sistema (interno) | REQ-005 | Crea alerta y dispara notificación push al médico |
| POST | /chatbot/consulta | Paciente | REQ-006 | Envía consulta de texto libre al chatbot |
| GET | /pacientes/{id}/historial | Paciente, Médico | REQ-007 | Historial de glucosa filtrable por rango de fechas |
| GET | /pacientes/{id}/reporte-pdf | Médico | REQ-008 | Genera y descarga reporte clínico en PDF |

## File Structure
```
glucotracker/
├── mobile/                  # App React Native
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   └── services/        # Clientes de la API REST
│   └── app.json
├── backend/                 # API FastAPI
│   ├── app/
│   │   ├── api/              # Routers (auth, pacientes, alertas, chatbot)
│   │   ├── ml/                # Modelo de clasificación (SVC/Árbol de Decisión)
│   │   ├── nlp/                # Lógica del chatbot
│   │   ├── models/             # Esquemas / ORM
│   │   └── core/                # Config, seguridad, conexión a Supabase
│   └── requirements.txt
├── requirements.md
├── design.md
├── tasks.md
└── CLAUDE.md
```

## Security Design
- Contraseñas hasheadas (ej. bcrypt) antes de persistir en T_Usuario (NFR-001).
- Todo el tráfico entre la app móvil y el backend en Azure viaja sobre HTTPS/SSL.
- Autenticación basada en tokens (tipo a definir — ver Open Questions) para todos los endpoints salvo `/auth/login`.
- T_Auditoria_Endpoints registra cada llamada relevante para trazabilidad y detección de accesos indebidos.
- Los endpoints de administración (alta de usuarios, aprobación) están restringidos por rol.

## Open Questions
- [ ] ¿Qué esquema de autenticación se usará (JWT, sesiones con Supabase Auth, OAuth)? El documento original no lo especifica.
- [ ] ¿El modelo de ML (SVC vs Árbol de Decisión) ya está entrenado y con qué dataset, o se entrena como parte de este proyecto?
- [ ] ¿El chatbot usa un LLM externo (API de terceros) o un modelo NLP propio entrenado in-house?
- [ ] ¿Qué servicio de Azure se usará específicamente para notificaciones push (Azure Notification Hubs u otro)?
- [ ] ¿Cómo se calcula/valida la matrícula médica en REQ-002 — contra un registro externo o solo formato?

## Changelog
| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-08-24 | Initial design, derivado de Especificacion_Sistema_GlucoTracker.md; deployment confirmado en Azure |
