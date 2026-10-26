import bcrypt

def hash_password(password: str) -> str:
    """Genera un hash bcrypt con salt rounds = 10 compatible con Node.js bcrypt."""
    salt = bcrypt.gensalt(rounds=10)
    return bcrypt.hashpw(str(password).encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña coincide con el hash bcrypt."""
    try:
        return bcrypt.checkpw(
            str(plain_password).encode('utf-8'),
            str(hashed_password).encode('utf-8')
        )
    except Exception:
        return False
