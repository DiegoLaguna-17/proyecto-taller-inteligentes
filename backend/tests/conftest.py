import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.main import app
import app.core.supabase as supabase_module
import app.services.email_service as email_module

class MockMutationBuilder:
    """Respuesta de insert/update/delete en el cliente real: solo filtros y
    execute (sin select/single), y `data` siempre es una lista de filas."""

    def __init__(self, data=None, error=None):
        if data is None:
            data = []
        self._data = data if isinstance(data, list) else [data]
        self._error = error

    def eq(self, *args, **kwargs):
        return self

    def neq(self, *args, **kwargs):
        return self

    def is_(self, *args, **kwargs):
        return self

    def execute(self):
        if self._error:
            raise self._error
        mock_response = MagicMock()
        mock_response.data = self._data
        return mock_response


class MockQueryBuilder:
    def __init__(self, data=None, error=None):
        self._data = data if data is not None else []
        self._error = error

    def select(self, *args, **kwargs):
        return self

    def insert(self, *args, **kwargs):
        return MockMutationBuilder(self._data, self._error)

    def update(self, *args, **kwargs):
        return MockMutationBuilder(self._data, self._error)

    def delete(self, *args, **kwargs):
        return MockMutationBuilder(self._data, self._error)

    def eq(self, *args, **kwargs):
        return self

    def neq(self, *args, **kwargs):
        return self

    def is_(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def single(self):
        return self

    def maybe_single(self):
        return self

    def execute(self):
        if self._error:
            raise self._error
        mock_response = MagicMock()
        mock_response.data = self._data
        return mock_response


class MockStorageBucket:
    def __init__(self):
        pass

    def upload(self, path, file, file_options=None):
        return {"data": {"path": path}, "error": None}

    def get_public_url(self, path):
        return f"https://mock-supabase.co/storage/v1/object/public/{path}"


class MockSupabaseClient:
    def __init__(self):
        self.tables = {}
        self.storage_mock = MagicMock()
        self.storage_mock.from_ = MagicMock(return_value=MockStorageBucket())

    @property
    def storage(self):
        return self.storage_mock

    def from_(self, table_name: str):
        if table_name in self.tables:
            return self.tables[table_name]
        return MockQueryBuilder()

    def set_table_mock(self, table_name: str, builder: MockQueryBuilder):
        self.tables[table_name] = builder


@pytest.fixture
def mock_supabase(monkeypatch):
    client = MockSupabaseClient()
    monkeypatch.setattr(supabase_module, "supabase", client)
    return client


@pytest.fixture
def mock_email(monkeypatch):
    mock_send = MagicMock()
    async def fake_send(*args, **kwargs):
        return True
    mock_send.side_effect = fake_send
    monkeypatch.setattr(email_module.EmailService, "send_email", fake_send)
    return mock_send


@pytest.fixture
def client(mock_supabase, mock_email):
    return TestClient(app)
