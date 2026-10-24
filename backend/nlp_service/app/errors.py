"""
Errores del dominio del servicio NLP.

El router (TASK-018) los traduce a 503 (no configurado), 502 (fallo del
proveedor) y 504 (timeout). Ningún mensaje incluye el texto de la consulta
ni la respuesta del proveedor (NFR-001): solo nombres de variables, códigos
HTTP o nombres de clase de excepción.
"""
from typing import Optional


class ErrorNLP(Exception):
    """Base de los errores del servicio NLP."""


class ConfiguracionInvalida(ErrorNLP):
    """Una variable de entorno tiene un valor que no se puede interpretar."""

    def __init__(self, variable: str):
        self.variable = variable
        super().__init__(f"La variable de entorno {variable} tiene un valor inválido.")


class ProveedorNoConfigurado(ErrorNLP):
    """Falta configuración del proveedor LLM (→ 503)."""

    def __init__(self, variable: str, no_soportado: bool = False):
        self.variable = variable
        if no_soportado:
            mensaje = f"Proveedor LLM no configurado: la variable de entorno {variable} tiene un valor no soportado."
        else:
            mensaje = f"Proveedor LLM no configurado: falta la variable de entorno {variable}."
        super().__init__(mensaje)


class ProveedorError(ErrorNLP):
    """La llamada al proveedor falló o devolvió una respuesta vacía (→ 502)."""

    def __init__(self, detalle: Optional[str] = None):
        self.detalle = detalle
        mensaje = "Fallo del proveedor LLM."
        if detalle:
            mensaje = f"Fallo del proveedor LLM ({detalle})."
        super().__init__(mensaje)


class ProveedorTimeout(ErrorNLP):
    """La llamada al proveedor superó NLP_TIMEOUT_SECONDS (→ 504)."""

    def __init__(self):
        super().__init__("El proveedor LLM no respondió dentro del tiempo límite.")
