"""
GlucoTracker — Backend API (FastAPI)

Punto de entrada de la aplicación. Ver /requirements.md, /design.md y
/tasks.md en la raíz del proyecto antes de agregar cualquier lógica:
este proyecto sigue Spec Driven Development.
"""
from fastapi import FastAPI

app = FastAPI(
    title="GlucoTracker API",
    version="1.0.0",
    description="Backend de GlucoTracker: autenticación, registros de glucosa, "
                 "clasificación ML, alertas y chatbot.",
)


@app.get("/health")
def health_check():
    """Endpoint de salud — usado para verificar TASK-002/TASK-003."""
    return {"status": "ok", "service": "glucotracker-backend"}


# Los routers reales (auth, pacientes, alertas, chatbot) se registran aquí
# a medida que se completan las tareas de tasks.md, ej.:
# from app.api import auth, pacientes, alertas, chatbot
# app.include_router(auth.router, prefix="/auth", tags=["auth"])
