"""
Errores del dominio del servicio de ML.

Ningún mensaje incluye rutas, valores de entrada (glucosa, perfil) ni detalles
internos (NFR-001): el endpoint (M5b) los traduce a 503/500 con mensajes
genéricos. `motivo` es una categoría fija pensada para los logs del servicio
(nunca un texto libre), no para la respuesta HTTP.
"""


class ErrorML(Exception):
    """Base de los errores del servicio de ML."""


class ConfiguracionInvalida(ErrorML):
    """Una variable de entorno tiene un valor que no se puede interpretar."""

    def __init__(self, variable: str):
        self.variable = variable
        super().__init__(f"La variable de entorno {variable} tiene un valor inválido.")


class ModeloNoDisponible(ErrorML):
    """
    El artefacto del modelo no se puede usar (→ 503): falta, está alterado o
    se entrenó con otras versiones de librerías (RT-06).
    """

    MENSAJE = "El modelo de riesgo no está disponible."

    MOTIVOS = (
        "artefacto_ausente",
        "metadatos_ausentes",
        "metadatos_invalidos",
        "huella_distinta",
        "versiones_distintas",
        "artefacto_ilegible",
        "modo_incompatible",
    )

    def __init__(self, motivo: str):
        assert motivo in self.MOTIVOS, "motivo desconocido"
        self.motivo = motivo
        super().__init__(self.MENSAJE)
