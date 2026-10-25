import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any, Optional
from app.core.config import settings

def get_hipo_template(data: Dict[str, Any]) -> Dict[str, str]:
    nombre_paciente = data.get("nombrePaciente", "")
    nombre_medico = data.get("nombreMedico", "")
    valor = data.get("valor", "")
    fecha = data.get("fecha", "")
    hora = data.get("hora", "")
    observaciones = data.get("observaciones", "")
    
    subject = f"Alerta de Hipoglucemia - {nombre_paciente}"
    html = f"""
    <p>Estimado/a Doctor/a {nombre_medico},</p>
    <p>Se detectó una medición baja de glucosa en el paciente <strong>{nombre_paciente}</strong>.</p>

    <p><strong>Detalles:</strong></p>
    <ul>
      <li><strong>Valor:</strong> {valor} mg/dL</li>
      <li><strong>Fecha:</strong> {fecha}</li>
      <li><strong>Hora:</strong> {hora}</li>
      <li><strong>Observaciones durante la muestra:</strong> {observaciones}</li>
    </ul>

    <p>Atentamente,<br>GlucoTracker</p>
    """
    return {"subject": subject, "html": html}


def get_hiper_template(data: Dict[str, Any]) -> Dict[str, str]:
    nombre_paciente = data.get("nombrePaciente", "")
    valor = data.get("valor", "")
    fecha = data.get("fecha", "")
    hora = data.get("hora", "")
    observaciones = data.get("observaciones", "")

    subject = f"Alerta de Hiperglucemia - {nombre_paciente}"
    html = f"""
    <p>Estimado/a Doctor/a,</p>
    <p>Se registró una medición elevada de glucosa en el paciente <strong>{nombre_paciente}</strong>.</p>

    <p><strong>Detalles:</strong></p>
    <ul>
      <li><strong>Valor:</strong> {valor} mg/dL</li>
      <li><strong>Fecha:</strong> {fecha}</li>
      <li><strong>Hora:</strong> {hora}</li>
      <li><strong>Observaciones durante la muestra:</strong> {observaciones}</li>
    </ul>

    <p>Atentamente,<br>GlucoTracker</p>
    """
    return {"subject": subject, "html": html}


def get_otp_template(data: Dict[str, Any]) -> Dict[str, str]:
    nombre_usuario = data.get("nombreUsuario", "")
    codigo = data.get("codigo", "")

    subject = "Código de verificación para GlucoTracker"
    html = f"""
    <p>Hola {nombre_usuario},</p>
    <p>Tu código de verificación para completar el inicio de sesión es:</p>
    <h2>{codigo}</h2>
    <p>Este código expirará en 5 minutos.</p>
    <p>Si no solicitaste este código, ignora este correo.</p>
    <p>Atentamente,<br>GlucoTracker</p>
    """
    return {"subject": subject, "html": html}


class EmailService:
    @classmethod
    async def send_email(cls, to: str, subject: str, html: str) -> bool:
        if not settings.EMAIL_USER or not settings.EMAIL_PASS:
            # En entorno de pruebas sin credenciales de correo
            return True

        msg = MIMEMultipart("alternative")
        msg["From"] = f'"GlucoTracker" <{settings.EMAIL_USER}>'
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))

        try:
            # Conexión SMTP a Gmail
            server = smtplib.SMTP("smtp.gmail.com", 587)
            server.ehlo()
            server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASS)
            server.sendmail(settings.EMAIL_USER, [to], msg.as_string())
            server.quit()
            return True
        except Exception as e:
            print(f"Error enviando email: {e}")
            raise e
