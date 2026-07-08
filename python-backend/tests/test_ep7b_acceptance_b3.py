from __future__ import annotations

from uuid import UUID

from fastapi.testclient import TestClient

from routers.kb_folders import get_current_user_id
from services.citations.models import CitationRef
from services.citations.resolvers import resolve


USER_ID = "00000000-0000-0000-0000-000000000001"


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows
        self.filters = []
        self.single = False

    def select(self, _columns):
        return self

    def eq(self, column, value):
        self.filters.append((column, str(value)))
        return self

    def maybe_single(self):
        self.single = True
        return self

    def execute(self):
        rows = list(self.rows)
        for column, value in self.filters:
            rows = [row for row in rows if str(row.get(column)) == value]
        return FakeResponse((rows[0] if rows else None) if self.single else rows)


class FakeClient:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return FakeQuery(list(self.tables.get(name, [])))


class FakeStore:
    def __init__(self, tables):
        self.client = FakeClient(tables)
        self.signed_url_calls = []

    def get_document(self, document_id, user_id):
        response = (
            self.client.table("ose_raw_document_registry")
            .select("*")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not response.data:
            raise RuntimeError("Document registry row was not found for this user.")
        return response.data

    def create_raw_document_signed_url(self, storage_path):
        self.signed_url_calls.append(storage_path)
        return f"https://signed.local/{storage_path}"


def test_b3_geometry_resolve_signed_url_and_transform_contract(monkeypatch):
    import main

    bbox = {
        "page_no": 2,
        "l": 72,
        "t": 144,
        "r": 288,
        "b": 216,
        "coord_origin": "TOPLEFT",
        "charspan": [0, 32],
        "page_w": 612,
        "page_h": 792,
    }
    store = FakeStore(
        {
            "document_chunks": [
                {
                    "id": "chunk-b3",
                    "user_id": USER_ID,
                    "document_id": "doc-b3",
                    "chunk_index": 1,
                    "content": "Serialized retrieval context.",
                    "metadata": {"document_title": "B3 Geometry Brief"},
                    "page_number": 2,
                    "bbox": bbox,
                    "verbatim": "Raw PDF face for B3.",
                }
            ],
            "ose_raw_document_registry": [
                {
                    "id": "doc-b3",
                    "user_id": USER_ID,
                    "file_name": "B3 Geometry Brief.pdf",
                    "file_type": "application/pdf",
                    "storage_path": f"{USER_ID}/doc-b3/source.pdf",
                    "status": "processed",
                    "parser_status": "complete",
                    "metadata_document_type": "brief",
                    "metadata_business_domain": "operations",
                }
            ],
        }
    )

    view = resolve(CitationRef(source_kind="document_chunk", source_id="chunk-b3"), USER_ID, store)

    assert view["type"] == "chunk"
    assert view["verbatim"] == "Raw PDF face for B3."
    assert view["locator"]["kind"] == "bbox"
    assert view["locator"]["page_number"] == 2
    assert view["locator"]["bbox"] == bbox
    assert view["document"]["id"] == "doc-b3"
    assert view["document"]["file_type"] == "application/pdf"

    monkeypatch.setattr(main.VectorStore, "from_env", lambda: store)
    client = TestClient(main.app)
    main.app.dependency_overrides[get_current_user_id] = lambda: UUID(USER_ID)
    try:
        response = client.get("/api/documents/doc-b3/signed-url")
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "document_id": "doc-b3",
        "signed_url": f"https://signed.local/{USER_ID}/doc-b3/source.pdf",
        "expires_in": 300,
    }
    assert store.signed_url_calls == [f"{USER_ID}/doc-b3/source.pdf"]

    assert _transform_bbox_to_canvas_rect(bbox, canvas_width=306, canvas_height=396) == {
        "left": 36,
        "top": 72,
        "width": 108,
        "height": 36,
    }


def _transform_bbox_to_canvas_rect(bbox, *, canvas_width, canvas_height):
    sx = canvas_width / bbox["page_w"]
    sy = canvas_height / bbox["page_h"]
    x0 = min(bbox["l"], bbox["r"])
    x1 = max(bbox["l"], bbox["r"])
    y0 = min(bbox["t"], bbox["b"])
    y1 = max(bbox["t"], bbox["b"])
    coord_origin = str(bbox.get("coord_origin") or "TOPLEFT").upper().replace("_", "").replace("-", "").replace(" ", "")
    is_bottom_left = coord_origin in {"BOTTOMLEFT", "BOTTOM"}
    return {
        "left": x0 * sx,
        "top": (bbox["page_h"] - y1) * sy if is_bottom_left else y0 * sy,
        "width": (x1 - x0) * sx,
        "height": (y1 - y0) * sy,
    }
