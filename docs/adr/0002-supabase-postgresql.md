# 2. Uso de Supabase / PostgreSQL como Base de Datos y Backend-as-a-Service

* **Estado:** Aceptado
* **Fecha de decisión:** 2026-08-17
* **Autores:** Equipo GlucoTracker

## Contexto y Problema
Se necesita una solución de almacenamiento relacional segura y robusta que soporte el modelo de datos definido (`Usuario`, `Paciente`, `Registro_glucosa`, `Alertas`, etc.) cumpliendo criterios de integridad y facilitando la autenticación.

## Alternativas Consideradas
1. **Base de datos relacional tradicional autogestionada (MySQL / PostgreSQL en servidor propio):** Requiere configuración manual de infraestructura, respaldos y capas de seguridad.
2. **Supabase (PostgreSQL gestionado + herramientas de auth y APIs):** Proporciona una base de datos PostgreSQL robusta junto con utilidades nativas de autenticación y gestión de esquemas listos para producción con gestión via web de fácil acceso.

## Decisión Tomada
Se selecciona **Supabase / PostgreSQL** para la persistencia de datos.

## Consecuencias
* **Positivas:** Aceleración notable en la configuración inicial, seguridad integrada y soporte nativo para consultas relacionales complejas sobre los registros médicos.
* **Negativas / Riesgos asumidos:** Acoplamiento inicial al ecosistema de Supabase, mitigado por el uso de migraciones SQL estándar.