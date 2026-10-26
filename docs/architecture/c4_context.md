# C4 - Nivel 1: Diagrama de Contexto del Sistema (GlucoTracker)

El siguiente diagrama muestra el contexto del sistema GlucoTracker y cómo interactúa con los diferentes usuarios y actores externos.

```mermaid
graph TD
    %% Actores
    Patient([Paciente / Usuario])
    Doctor([Médico / Especialista])
    Admin([Administrador del Sistema])

    %% Sistema Principal
    GlucoTracker("<b>GlucoTracker</b><br>[Sistema Principal]<br>Plataforma de monitoreo de glucosa: clasificación ADA y alertas al médico, probabilidad informativa de hipoglucemia (ML) y chatbot educativo")

    %% Sistemas externos
    LLM("<b>Proveedor LLM externo</b><br>[Sistema externo: Gemini]<br>Genera las respuestas del chatbot educativo (ADR-0005)")

    %% Relaciones
    Patient -->|Registra glucosa, consulta alertas y recibe recomendaciones| GlucoTracker
    Doctor -->|Monitorea pacientes, revisa alertas críticas y valida reportes| GlucoTracker
    Admin -->|Gestiona usuarios, roles y parámetros del sistema| GlucoTracker
    GlucoTracker -->|Envía consultas del chatbot sobre HTTPS, sin datos personales| LLM

    style GlucoTracker fill:#f9f,stroke:#333,stroke-width:2px
```

A este nivel, el servicio de ML es parte interna de GlucoTracker y no un sistema externo: no tiene ingreso público y solo lo llama el backend (ADR-0008). Su detalle está en el diagrama de contenedores (`c4_container.md`). El único sistema externo es el proveedor LLM del chatbot.