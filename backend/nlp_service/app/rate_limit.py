"""
Límite de tasa en memoria del servicio NLP (CHATBOT_RATE_LIMIT_PER_MINUTE).

Ventana deslizante de 60 s por IP de cliente. Limitaciones aceptadas
(docs/risks.md, RT-03):
- El estado vive en la memoria del proceso: NO se comparte entre
  instancias ni entre workers de uvicorn (con N procesos, el límite
  efectivo es N veces el configurado) y se pierde al reiniciar.
- La IP es `request.client.host`. Detrás de un proxy (Azure), uvicorn debe
  arrancar con `--proxy-headers --forwarded-allow-ips=<IP del proxy>` para
  que esa IP sea la del cliente real. El código no lee X-Forwarded-For por
  su cuenta, para que nadie pueda falsificarla.
"""
import math
import threading
import time
from collections import deque
from typing import Callable

from fastapi import Depends, HTTPException, Request, status

from app.config import Settings, obtener_settings

VENTANA_SEGUNDOS = 60.0
MENSAJE_LIMITE_EXCEDIDO = "Demasiadas consultas. Intenta de nuevo en un momento."

# Por encima de esta cantidad de IPs registradas se purgan las inactivas,
# para que la memoria no crezca sin límite.
_MAX_CLAVES_ANTES_DE_PURGAR = 10_000


class LimitadorDeTasa:
    def __init__(self, reloj: Callable[[], float] = time.monotonic):
        self._reloj = reloj
        self._solicitudes: dict[str, deque] = {}
        self._lock = threading.Lock()

    def registrar(self, clave: str, limite: int) -> float:
        """
        Registra una solicitud de `clave`. Retorna 0 si se permite o, si se
        excede `limite`, los segundos que faltan para que se libere un cupo.
        """
        ahora = self._reloj()
        with self._lock:
            if len(self._solicitudes) > _MAX_CLAVES_ANTES_DE_PURGAR:
                self._purgar(ahora)
            marcas = self._solicitudes.setdefault(clave, deque())
            while marcas and ahora - marcas[0] >= VENTANA_SEGUNDOS:
                marcas.popleft()
            if len(marcas) >= limite:
                return VENTANA_SEGUNDOS - (ahora - marcas[0])
            marcas.append(ahora)
            return 0.0

    def reiniciar(self) -> None:
        with self._lock:
            self._solicitudes.clear()

    def _purgar(self, ahora: float) -> None:
        inactivas = [c for c, m in self._solicitudes.items() if not m or ahora - m[-1] >= VENTANA_SEGUNDOS]
        for clave in inactivas:
            del self._solicitudes[clave]


limitador = LimitadorDeTasa()


def aplicar_limite_de_tasa(request: Request, settings: Settings = Depends(obtener_settings)) -> None:
    clave = request.client.host if request.client else "desconocido"
    espera = limitador.registrar(clave, settings.chatbot_rate_limit_per_minute)
    if espera > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=MENSAJE_LIMITE_EXCEDIDO,
            headers={"Retry-After": str(max(1, math.ceil(espera)))},
        )
