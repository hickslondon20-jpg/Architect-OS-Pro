from __future__ import annotations

from services.citations.models import CitationRef
from services.citations.resolvers import resolve


USER_ID = "user-1"


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
    def __init__(self, tables=None):
        self.client = FakeClient(tables or {})


def test_post_b0_chunk_resolves_bbox_page_number_and_raw_verbatim():
    bbox = {
        "page_no": 2,
        "l": 10.0,
        "t": 20.0,
        "r": 110.0,
        "b": 75.0,
        "coord_origin": "BOTTOMLEFT",
        "charspan": [0, 28],
        "page_w": 612.0,
        "page_h": 792.0,
    }
    store = _store_with_chunk(
        {
            "id": "chunk-geometry",
            "user_id": USER_ID,
            "document_id": "doc-1",
            "chunk_index": 7,
            "content": "Heading context :: Raw founder quote.",
            "verbatim": "Raw founder quote.",
            "page_number": 2,
            "bbox": bbox,
            "metadata": {"document_title": "Geometry Brief", "lines": {"start": 12, "end": 14}},
        }
    )

    view = resolve(CitationRef(source_kind="document_chunk", source_id="chunk-geometry"), USER_ID, store)

    assert view["type"] == "chunk"
    assert view["verbatim"] == "Raw founder quote."
    assert view["locator"]["kind"] == "bbox"
    assert view["locator"]["page_number"] == 2
    assert view["locator"]["bbox"] is bbox
    assert view["locator"]["lines"] == {"start": 12, "end": 14}


def test_pre_b0_chunk_falls_back_to_line_locator_without_geometry():
    store = _store_with_chunk(
        {
            "id": "chunk-lines",
            "user_id": USER_ID,
            "document_id": "doc-1",
            "chunk_index": 3,
            "content": "Legacy exact source text.",
            "metadata": {"document_title": "Legacy Brief", "lines": {"start": 5, "end": 9}, "section_label": "Delivery"},
        }
    )

    view = resolve(CitationRef(source_kind="document_chunk", source_id="chunk-lines"), USER_ID, store)

    assert view["verbatim"] == "Legacy exact source text."
    assert view["locator"] == {
        "kind": "lines",
        "lines": {"start": 5, "end": 9},
        "section": "Delivery",
        "page_number": None,
        "bbox": None,
    }


def test_verbatim_falls_back_to_content_when_raw_face_missing():
    store = _store_with_chunk(
        {
            "id": "chunk-content-fallback",
            "user_id": USER_ID,
            "document_id": None,
            "chunk_index": 1,
            "content": "Only content exists.",
            "verbatim": None,
            "metadata": {},
        }
    )

    view = resolve(CitationRef(source_kind="document_chunk", source_id="chunk-content-fallback"), USER_ID, store)

    assert view["verbatim"] == "Only content exists."
    assert view["locator"]["kind"] == "section"
    assert view["locator"]["page_number"] is None
    assert view["locator"]["bbox"] is None


def test_geometry_payload_is_additive_for_a3_sidecar_back_compat():
    bbox = {
        "page_no": 1,
        "l": 1,
        "t": 2,
        "r": 3,
        "b": 4,
        "coord_origin": "TOPLEFT",
        "charspan": [0, 4],
        "page_w": 100,
        "page_h": 200,
        "multi_page": True,
        "pages": [{"page_no": 1, "l": 1, "t": 2, "r": 3, "b": 4}],
    }
    store = _store_with_chunk(
        {
            "id": "chunk-additive",
            "user_id": USER_ID,
            "document_id": "doc-1",
            "chunk_index": 4,
            "content": "Serialized content.",
            "verbatim": "Raw content.",
            "page_number": 1,
            "bbox": bbox,
            "metadata": {"section": "Evidence"},
        }
    )

    view = resolve(CitationRef(source_kind="document_chunk", source_id="chunk-additive"), USER_ID, store)

    assert {"type", "source_kind", "source_id", "label", "verbatim", "locator", "document", "chunk"} <= set(view)
    assert {"kind", "lines", "section", "page_number", "bbox"} <= set(view["locator"])
    assert view["locator"]["section"] == "Evidence"
    assert view["locator"]["bbox"] == bbox
    assert view["chunk"]["chunk_index"] == 4


def _store_with_chunk(chunk):
    return FakeStore(
        {
            "document_chunks": [chunk],
            "ose_raw_document_registry": [
                {
                    "id": "doc-1",
                    "user_id": USER_ID,
                    "file_name": "Geometry Brief.pdf",
                    "file_type": "application/pdf",
                    "status": "processed",
                    "parser_status": "complete",
                    "metadata_document_type": "brief",
                    "metadata_business_domain": "operations",
                }
            ],
        }
    )
