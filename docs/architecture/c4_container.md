# C4 - Nivel 2: Diagrama de Contenedores (GlucoTracker)

El siguiente diagrama detalla los contenedores de software que componen la arquitectura de GlucoTracker.

```mermaid
flowchart TB
    subgraph Usuarios
        Patient([Paciente])
        Doctor([Médico])
    end

    subgraph Sistema["Sistema: GlucoTracker"]
        MobileApp["<b>App Móvil/Frontend</b><br/>[Contenedor: React Native]<br/>Permite al paciente registrar datos, visualizar gráficos y recibir alertas."]
        
        API["<b>API Backend</b><br/>[Contenedor: FastAPI / Python — backend/app/]<br/>Expone endpoints REST y aplica las reglas de negocio: clasificación ADA (backend/app/core/reglas_ada.py, especificada en TASK-012a) y alertas al médico (REQ-005)."]
        
        Database[("<b>Base de Datos</b><br/>[Contenedor: PostgreSQL / Supabase]<br/>Almacena usuarios, pacientes, registros de glucosa y alertas.")]
        
        MLService["<b>Servicio de ML — riesgo de hipoglucemia</b><br/>[Contenedor: FastAPI / Python / scikit-learn — backend/ml_service/]<br/>POST /api/riesgo/hipoglucemia: probabilidad informativa (REQ-004). Sin ingreso público, sin acceso a la base de datos (ADR-0008)."]
        
        NLPService["<b>Servicio NLP / Chatbot</b><br/>[Contenedor: FastAPI / Python — backend/nlp_service/]<br/>POST /api/chatbot/consulta. Sin estado, sin acceso a la base de datos (ADR-0006)."]
    end

    LLM[["<b>Proveedor LLM externo</b><br/>[Sistema externo: Gemini — ADR-0005]<br/>Genera la respuesta a partir del system prompt con el corpus."]]

    Patient -->|Usa HTTPS / REST| MobileApp
    Doctor -->|Usa HTTPS / REST| MobileApp
    
    MobileApp -->|API_BASE_URL — JSON/REST sobre HTTPS| API
    MobileApp -->|NLP_API_BASE_URL — JSON/REST sobre HTTPS| NLPService
    
    API -->|Lee/Escribe datos| Database
    API -->|Red interna — JSON/REST: lectura + perfil clínico, sin ids| MLService
    NLPService -->|HTTPS — system prompt + texto del usuario| LLM

    style API fill:#bbf,stroke:#333,stroke-width:2px
    style NLPService fill:#bfb,stroke:#333,stroke-width:2px
    style MLService fill:#ffd,stroke:#333,stroke-width:2px
    style Database fill:#fbb,stroke:#333,stroke-width:2px
```

- **Servicio NLP:** es un contenedor separado del API Backend (ADR-0006). La app lo llama directo, sin pasarela, y él es el único que habla con el proveedor LLM externo. No llama al API Backend ni a la base de datos.
- **Servicio de ML:** es un contenedor separado del API Backend (ADR-0008). **Solo el API Backend lo llama**, por red interna. La app no lo llama, no tiene ingreso público ni autenticación propia en v1 (ver la Open Question de design.md), y no accede a la base de datos. Su probabilidad es informativa y no dispara alertas: las alertas salen de la clasificación ADA del API Backend. Su código vive solo en `backend/ml_service/`; el API Backend no contiene código de ML. El modelo es experimental y su probabilidad se muestra únicamente al médico.