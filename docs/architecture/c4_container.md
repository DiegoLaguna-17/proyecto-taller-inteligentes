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
        
        API["<b>API Backend</b><br/>[Contenedor: FastAPI / Python — backend/app/]<br/>Expone endpoints REST, gestiona reglas de negocio y orquesta los módulos."]
        
        Database[("<b>Base de Datos</b><br/>[Contenedor: PostgreSQL / Supabase]<br/>Almacena usuarios, pacientes, registros de glucosa y alertas.")]
        
        MLModule[/"<b>Módulo de Machine Learning</b><br/>[Componente del API Backend: Python / Scikit-learn]<br/>Procesa el modelo predictivo/baseline de clasificación de riesgo."/]
        
        NLPService["<b>Servicio NLP / Chatbot</b><br/>[Contenedor: FastAPI / Python — backend/nlp_service/]<br/>POST /api/chatbot/consulta. Sin estado, sin acceso a la base de datos (ADR-0006)."]
    end

    LLM[["<b>Proveedor LLM externo</b><br/>[Sistema externo: Gemini — ADR-0005]<br/>Genera la respuesta a partir del system prompt con el corpus."]]

    Patient -->|Usa HTTPS / REST| MobileApp
    Doctor -->|Usa HTTPS / REST| MobileApp
    
    MobileApp -->|API_BASE_URL — JSON/REST sobre HTTPS| API
    MobileApp -->|NLP_API_BASE_URL — JSON/REST sobre HTTPS| NLPService
    
    API -->|Lee/Escribe datos| Database
    API -->|Invoca predicciones| MLModule
    NLPService -->|HTTPS — system prompt + texto del usuario| LLM

    style API fill:#bbf,stroke:#333,stroke-width:2px
    style NLPService fill:#bfb,stroke:#333,stroke-width:2px
    style Database fill:#fbb,stroke:#333,stroke-width:2px
```

El servicio NLP es un contenedor separado del API Backend (ADR-0006). La app lo llama directo, sin pasarela, y él es el único que habla con el proveedor LLM externo. No llama al API Backend ni a la base de datos.