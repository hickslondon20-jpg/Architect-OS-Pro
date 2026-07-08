from __future__ import annotations

from uuid import UUID

from fastapi.testclient import TestClient

from routers.kb_folders import get_current_user_id
from services.vector_store import VectorStoreError


USER_ID = "00000000-0000-0000-0000-000000000001"


def test_document_signed_url_endpoint_owner_scopes_and_signs_raw_document(monkeypatch):
    import main

    calls: dict[str, str] = {}

    class FakeStore:
        def get_document(self, document_id, user_id):
            calls["document_id"] = document_id
            calls["user_id"] = user_id
            return {"id": document_id, "user_id": user_id, "storage_path": f"{user_id}/doc-1/source.pdf"}

        def create_raw_document_signed_url(self, storage_path):
            calls["storage_path"] = storage_path
            return f"https://signed.local/{storage_path}"

    monkeypatch.setattr(main.VectorStore, "from_env", lambda: FakeStore())
    client = TestClient(main.app)
    main.app.dependency_overrides[get_current_user_id] = lambda: UUID(USER_ID)
    response = client.get("/api/documents/doc-1/signed-url")
    main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert calls == {
        "document_id": "doc-1",
        "user_id": USER_ID,
        "storage_path": f"{USER_ID}/doc-1/source.pdf",
    }
    assert response.json() == {
        "document_id": "doc-1",
        "signed_url": f"https://signed.local/{USER_ID}/doc-1/source.pdf",
        "expires_in": 300,
    }


def test_document_signed_url_endpoint_rejects_unowned_document(monkeypatch):
    import main

    class FakeStore:
        def get_document(self, document_id, user_id):
            raise VectorStoreError("Document registry row was not found for this user.")

    monkeypatch.setattr(main.VectorStore, "from_env", lambda: FakeStore())
    client = TestClient(main.app)
    main.app.dependency_overrides[get_current_user_id] = lambda: UUID(USER_ID)
    response = client.get("/api/documents/other-user-doc/signed-url")
    main.app.dependency_overrides.clear()

    assert response.status_code == 404
    assert "not found for this user" in response.json()["detail"]

