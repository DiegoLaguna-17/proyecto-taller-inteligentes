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
        
        API["<b>API Backend</b><br/>[Contenedor: FastAPI / Python]<br/>Expone endpoints REST, gestiona reglas de negocio y orquesta los módulos."]
        
        Database[("<b>Base de Datos</b><br/>[Contenedor: PostgreSQL / Supabase]<br/>Almacena usuarios, pacientes, registros de glucosa y alertas.")]
        
        MLModule[/"<b>Módulo de Machine Learning</b><br/>[Contenedor: Python / Scikit-learn]<br/>Procesa el modelo predictivo/baseline de clasificación de riesgo."/]
        
        NLPModule[/"<b>Módulo NLP / Chatbot</b><br/>[Contenedor: Python]<br/>Procesa consultas en lenguaje natural orientadas a salud."/]
    end

    Patient -->|Usa HTTPS / REST| MobileApp
    Doctor -->|Usa HTTPS / REST| MobileApp
    
    MobileApp -->|Consumo de API JSON/REST| API
    
    API -->|Lee/Escribe datos| Database
    API -->|Invoca predicciones| MLModule
    API -->|Invoca procesamiento| NLPModule

    style API fill:#bbf,stroke:#333,stroke-width:2px
    style Database fill:#fbb,stroke:#333,stroke-width:2px