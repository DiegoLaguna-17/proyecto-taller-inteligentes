"""
GlucoTracker — Servicio NLP (chatbot educativo).

Servicio FastAPI independiente del backend principal (ADR-0006): tiene su
propia configuración y dependencias y no importa nada de él. Ver
design.md § Servicio NLP (chatbot) Design antes de agregar lógica.

Se ejecuta desde backend/nlp_service/:
    uvicorn app.main:app --env-file .env --port 8001
"""
from fastapi import FastAPI

from app.api import chatbot

app = FastAPI(
    title="GlucoTracker NLP Service",
    version="0.1.0",
    description="Chatbot educativo sobre diabetes tipo 2 (REQ-006).",
)


@app.get("/health")
def health_check():
    """Endpoint de salud — usado por el monitoreo de uptime (TASK-026a)."""
    return {"status": "ok", "service": "glucotracker-nlp"}


# POST /api/chatbot/consulta y manejadores de error genéricos (TASK-018).
chatbot.registrar(app)
