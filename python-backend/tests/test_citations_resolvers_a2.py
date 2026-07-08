from __future__ import annotations

from fastapi.testclient import TestClient

from services.citations.models import CitationRef, Locator
from services.citations.resolvers import resolve
from services.citations.resolvers.platform_record_resolver import PLATFORM_RECORD_RENDERERS


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

    def in_(self, column, values):
        allowed = {str(value) for value in values}
        self.filters.append((column, allowed))
        return self

    def maybe_single(self):
        self.single = True
        return self

    def execute(self):
        rows = self.rows
        for column, value in self.filters:
            if isinstance(value, set):
                rows = [row for row in rows if str(row.get(column)) in value]
            else:
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


def test_chunk_resolver_reads_owner_scoped_chunk_and_document_metadata():
    store = FakeStore(
        {
            "document_chunks": [
                {
                    "id": "chunk-1",
                    "user_id": "user-1",
                    "document_id": "doc-1",
                    "chunk_index": 2,
                    "content": "Exact source text.",
                    "metadata": {"document_title": "Ops Brief", "lines": {"start": 5, "end": 9}, "section_label": "Delivery"},
                }
            ],
            "ose_raw_document_registry": [
                {
                    "id": "doc-1",
                    "user_id": "user-1",
                    "file_name": "Ops Brief.pdf",
                    "file_type": "application/pdf",
                    "status": "processed",
                    "parser_status": "complete",
                    "metadata_document_type": "brief",
                    "metadata_business_domain": "operations",
                }
            ],
        }
    )
    ref = CitationRef(source_kind="document_chunk", source_id="chunk-1")

    view = resolve(ref, "user-1", store)

    assert view["type"] == "chunk"
    assert view["verbatim"] == "Exact source text."
    assert view["locator"]["lines"] == {"start": 5, "end": 9}
    assert view["locator"]["bbox"] is None
    assert view["document"]["title"] == "Ops Brief.pdf"


def test_wiki_resolver_claim_uses_wiki_read_service(monkeypatch):
    from services.citations.resolvers import wiki_resolver

    def fake_get_claim(self, user_id, claim_id):
        assert user_id == "user-1"
        assert claim_id == "claim-1"
        return {
            "summary": "Claim text",
            "findings": [
                {
                    "type": "wiki_claim",
                    "claim": {
                        "id": "claim-1",
                        "page_key": "growth_constraints",
                        "text": "Delivery capacity is the constraint.",
                        "evidence": [{"source_id": "chunk-1", "source_kind": "document_chunk"}],
                    },
                }
            ],
        }

    monkeypatch.setattr(wiki_resolver.WikiReadService, "get_claim", fake_get_claim)
    ref = CitationRef(
        source_kind="wiki_page",
        source_id="claim-1",
        source_metadata={"raw_source_kind": "wiki_claim"},
    )

    view = resolve(ref, "user-1", FakeStore())

    assert view["type"] == "wiki"
    assert view["wiki_kind"] == "claim"
    assert view["prose"] == "Delivery capacity is the constraint."
    assert view["evidence"][0]["source_id"] == "chunk-1"


def test_wiki_resolver_docwiki_page_uses_canonical_key(monkeypatch):
    from services.citations.resolvers import wiki_resolver

    def fake_get_page(self, user_id, canonical_key=None, page_id=None):
        assert user_id == "user-1"
        assert canonical_key == "offer-positioning"
        assert page_id is None
        return {
            "summary": "Retrieved wiki page: Offer Positioning",
            "findings": [
                {
                    "page_id": "page-1",
                    "title": "Offer Positioning",
                    "canonical_key": "offer-positioning",
                    "page_kind": "offer",
                    "content": "Page prose.",
                    "source_file_ids": ["doc-1"],
                }
            ],
        }

    monkeypatch.setattr(wiki_resolver.DocWikiReadService, "get_page", fake_get_page)
    ref = CitationRef(source_kind="wiki_page", source_id="offer-positioning")

    view = resolve(ref, "user-1", FakeStore())

    assert view["type"] == "wiki"
    assert view["tier"] == "tier_2"
    assert view["prose"] == "Page prose."
    assert view["locator"]["page_key"] == "offer-positioning"


def test_platform_record_resolver_reads_registered_table_field_and_deep_link():
    store = FakeStore(
        {
            "sp_sprint_goals": [
                {
                    "id": "goal-1",
                    "user_id": "user-1",
                    "name": "Q3 Focus",
                    "goal_text": "Improve delivery reliability.",
                    "quarter": "2026-Q3",
                    "status": "active",
                    "kickoff_date": "2026-07-01",
                    "updated_at": "2026-07-06",
                }
            ]
        }
    )
    ref = CitationRef(
        source_kind="platform_record",
        source_id="goal-1",
        locator=Locator(kind="record_path", record_path="sp_sprint_goals/goal-1/goal_text"),
    )

    view = resolve(ref, "user-1", store)

    assert view["type"] == "platform_record"
    assert view["table"] == "sp_sprint_goals"
    assert view["fields"] == [{"key": "goal_text", "label": "Goal Text", "value": "Improve delivery reliability."}]
    assert view["deep_link"] == "/pro/planning/sprint-planning?sourceTable=sp_sprint_goals&sourceId=goal-1&field=goal_text"


def test_derived_and_web_return_decided_non_source_views():
    derived = resolve(CitationRef(source_kind="derived", source_id="run-1", source_label="Tool run"), "user-1", FakeStore())
    web = resolve(CitationRef(source_kind="web", source_id="web-1", source_metadata={"url": "https://example.com"}), "user-1", FakeStore())

    assert derived["type"] == "not_citable"
    assert derived["code"] == "trace_only"
    assert web["type"] == "web_dark"
    assert web["code"] == "no_citable_web_producer"


def test_unauthorized_and_unresolvable_return_typed_errors():
    wrong_owner = resolve(
        CitationRef(source_kind="document_chunk", source_id="chunk-1", source_metadata={"user_id": "other-user"}),
        "user-1",
        FakeStore(),
    )
    missing_chunk = resolve(CitationRef(source_kind="document_chunk", source_id="missing"), "user-1", FakeStore({"document_chunks": []}))
    unsupported_table = resolve(
        CitationRef(
            source_kind="platform_record",
            source_id="row-1",
            locator=Locator(kind="record_path", record_path="private_table/row-1"),
        ),
        "user-1",
        FakeStore(),
    )

    assert wrong_owner["type"] == "error"
    assert wrong_owner["code"] == "unauthorized"
    assert missing_chunk["type"] == "error"
    assert missing_chunk["code"] == "unresolvable"
    assert unsupported_table["code"] == "unsupported_table"


def test_endpoint_resolves_with_user_session_dependency(monkeypatch):
    import main
    from routers.kb_folders import get_current_user_id
    from uuid import UUID

    store = FakeStore(
        {
            "document_chunks": [
                {
                    "id": "chunk-1",
                    "user_id": "00000000-0000-0000-0000-000000000001",
                    "document_id": None,
                    "chunk_index": 1,
                    "content": "Endpoint text.",
                    "metadata": {},
                }
            ]
        }
    )
    monkeypatch.setattr(main.VectorStore, "from_env", staticmethod(lambda: store))
    monkeypatch.setattr(main.settings, "ingest_secret", "test-secret")

    client = TestClient(main.app)
    secret_only = client.post(
        "/api/citations/resolve",
        headers={"x-ingest-secret": "test-secret"},
        json={"ref": {"source_kind": "document_chunk", "source_id": "chunk-1"}},
    )
    main.app.dependency_overrides[get_current_user_id] = lambda: UUID("00000000-0000-0000-0000-000000000001")
    resolved = client.post(
        "/api/citations/resolve",
        json={"ref": {"source_kind": "document_chunk", "source_id": "chunk-1"}},
    )

    main.app.dependency_overrides.clear()

    assert secret_only.status_code == 401
    assert resolved.status_code == 200
    assert resolved.json()["view"]["type"] == "chunk"
    assert resolved.json()["view"]["verbatim"] == "Endpoint text."


def test_platform_registry_covers_a2_table_families():
    covered = set(PLATFORM_RECORD_RENDERERS)

    assert "mra_checkpoints" in covered
    assert {"ae_assessments", "ae_dimension_scores", "ae_assessment_insights"} <= covered
    assert {"sp_sprint_goals", "sp_sprint_initiatives", "sp_sprint_milestones"} <= covered
    assert "quarter_map_selections" in covered
    assert {"cc_versions", "cc_synthesis", "clarity_compass_versions"} <= covered
    assert "reflection_reviews" in covered
    assert {"founder_dataset_rows", "founder_dataset_rows_v"} <= covered
