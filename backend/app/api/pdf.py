from typing import Dict, Any
from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse
from app.services.pdf_service import PdfService

router = APIRouter(prefix="/api", tags=["pdf"])

@router.post("/paciente/pdf")
async def generate_patient_pdf(paciente: Dict[str, Any]):
    if not paciente:
        return JSONResponse(status_code=400, content={"error": "Debes enviar el objeto paciente"})

    try:
        pdf_bytes = PdfService.generate_patient_pdf(paciente)
        paciente_id = paciente.get("id", "paciente")
        headers = {
            "Content-Disposition": f"attachment; filename=paciente_{paciente_id}.pdf"
        }
        return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
    except Exception as err:
        print("Error generando PDF:", err)
        return JSONResponse(status_code=500, content={"error": "Error generando PDF"})
