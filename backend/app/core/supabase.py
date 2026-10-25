from supabase import create_client, Client
from app.core.config import settings

def init_supabase() -> Client:
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        try:
            return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        except Exception:
            return None
    return None

supabase: Client = init_supabase()
