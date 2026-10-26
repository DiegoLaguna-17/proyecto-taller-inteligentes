import time
from typing import Optional, Dict, Any

class OtpCacheService:
    _otp_map: Dict[Any, Dict[str, Any]] = {}

    @classmethod
    def set_otp(cls, id_usuario: Any, codigo: str, expires_in_ms: int = 5 * 60 * 1000) -> None:
        expiracion = (time.time() * 1000) + expires_in_ms
        cls._otp_map[str(id_usuario)] = {
            "codigo": str(codigo),
            "expiracion": expiracion
        }

    @classmethod
    def get_otp(cls, id_usuario: Any) -> Optional[str]:
        data = cls._otp_map.get(str(id_usuario))
        if not data:
            return None
        
        now = time.time() * 1000
        if now > data["expiracion"]:
            cls._otp_map.pop(str(id_usuario), None)
            return None

        return data["codigo"]

    @classmethod
    def delete_otp(cls, id_usuario: Any) -> None:
        cls._otp_map.pop(str(id_usuario), None)

    @classmethod
    def clear(cls) -> None:
        cls._otp_map.clear()
