"""
GlucoTracker — Backend de negocio (FastAPI)
Monolito modular (ADR-0001). El modelo de ML (ADR-0008) y el chatbot (ADR-0006) son servicios
independientes: este backend no los incluye ni los importa.

Punto de entrada de la aplicación. Ver /requirements.md, /design.md y
/tasks.md en la raíz del proyecto antes de agregar cualquier lógica:
este proyecto sigue Spec Driven Development.

"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Routers portados del backend
from app.api import auth, medicos, pacientes, administradores, registro, general, pdf

app = FastAPI(
    title="GlucoTracker API",
    version="1.0.0",
    description="Backend de GlucoTracker: autenticación, médicos, pacientes, "
                "administradores, registros de glucosa, alertas y auditoría.",
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Endpoint de salud
@app.get("/health", tags=["sistema"])
def health_check():
    """Endpoint de salud — usado para verificar TASK-002/TASK-003."""
    return {"status": "ok", "service": "glucotracker-backend"}

# Registro de routers
app.include_router(auth.router)
app.include_router(medicos.router)
app.include_router(pacientes.router)
app.include_router(administradores.router)
app.include_router(registro.router)
app.include_router(general.router)
app.include_router(pdf.router)
