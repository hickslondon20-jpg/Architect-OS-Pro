from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID

from fastapi.testclient import TestClient

from services.artifact_service import ArtifactService
from services.citations.models import CitationRef, Locator
from services.citations.verify import CitationVerifierService


USER_ID = "00000000-0000-0000-0000-000000000001"


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, client, table_name, rows):
        self.client = client
        self.table_name = table_name
        self.rows = rows
        self.filters = []
        self.single = False
        self.limit_value = None
        self.update_values = None

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

    def limit(self, value):
        self.limit_value = value
        return self

    def update(self, values):
        self.update_values = values
        return self

    def insert(self, values):
        self.client.inserts.append((self.table_name, values))
        return self

    def execute(self):
        rows = list(self.rows)
        for column, value in self.filters:
            if isinstance(value, set):
                rows = [row for row in rows if str(row.get(column)) in value]
            else:
                rows = [row for row in rows if str(row.get(column)) == value]
        if self.limit_value is not None:
            rows = rows[: self.limit_value]
        if self.update_values is not None:
            for row in rows:
                row.update(self.update_values)
            return FakeResponse(rows)
        return FakeResponse((rows[0] if rows else None) if self.single else rows)


class FakeStorage:
    def __init__(self, objects):
        self.objects = objects

    def from_(self, _bucket):
        return self

    def download(self, path):
        return self.objects[path]

    def create_signed_url(self, path, _expires):
        return {"signedURL": f"https://signed.local/{path}"}


class FakeClient:
    def __init__(self, tables, objects=None):
        self.tables = tables
        self.inserts = []
        self.storage = FakeStorage(objects or {})

    def table(self, name):
        return FakeQuery(self, name, self.tables.setdefault(name, []))


class FakeStore:
    def __init__(self, tables=None, objects=None, model_name="claude-3-5-haiku-latest"):
        self.client = FakeClient(tables or {}, objects=objects)
        self.model_name = model_name
        self.model_requests = []

    def resolve_platform_model(self, **kwargs):
        self.model_requests.append(kwargs)
        return {"provider": "anthropic", "model_name": self.model_name}


class FakeAnthropic:
    def __init__(self, verdicts):
        self.verdicts = list(verdicts)
        self.calls = []
        self.messages = self

    def create(self, **kwargs):
        self.calls.append(kwargs)
        verdict = self.verdicts.pop(0)
        return SimpleNamespace(
            content=[SimpleNamespace(text=f'{{"verdict":"{verdict}","summary":"{verdict} summary"}}')],
            usage=SimpleNamespace(input_tokens=10, output_tokens=5),
        )


def test_ep7a_lit_family_matrix_vcso_and_artifact_library(monkeypatch):
    import main
    from routers.kb_folders import get_current_user_id
    from services.citations.resolvers import wiki_resolver

    store = _store_with_lit_sources()
    monkeypatch.setattr(main.VectorStore, "from_env", staticmethod(lambda: store))
    monkeypatch.setattr(wiki_resolver.WikiReadService, "get_claim", _fake_get_claim)

    client = TestClient(main.app)
    main.app.dependency_overrides[get_current_user_id] = lambda: UUID(USER_ID)
    try:
        vcso_refs = store.client.tables["vcso_chat_messages"][0]["citations"]
        artifact = ArtifactService(settings=SimpleNamespace(), supabase_client=store.client).get_delivery("artifact-1", USER_ID)
        artifact_refs = artifact.provenance["source_refs"]

        assert _chip_ordinals(vcso_refs) == [1, 2, 3]
        assert _chip_ordinals(artifact_refs) == [1, 2, 3]
        assert "[1]" in store.client.tables["vcso_chat_messages"][0]["content"]
        assert "[1]" in artifact.content

        matrix = {
            ("vcso", "document_chunk"): vcso_refs[0],
            ("vcso", "wiki_page"): vcso_refs[1],
            ("vcso", "platform_record"): vcso_refs[2],
            ("artifact_library", "document_chunk"): artifact_refs[0],
            ("artifact_library", "wiki_page"): artifact_refs[1],
            ("artifact_library", "platform_record"): artifact_refs[2],
        }

        resolved_types = {}
        for key, ref in matrix.items():
            response = client.post("/api/citations/resolve", json={"ref": ref})
            assert response.status_code == 200
            body = response.json()
            assert body["status"] == "ok"
            resolved_types[key] = body["view"]["type"]

        assert resolved_types == {
            ("vcso", "document_chunk"): "chunk",
            ("vcso", "wiki_page"): "wiki",
            ("vcso", "platform_record"): "platform_record",
            ("artifact_library", "document_chunk"): "chunk",
            ("artifact_library", "wiki_page"): "wiki",
            ("artifact_library", "platform_record"): "platform_record",
        }

        vcso_check = CitationVerifierService(store, FakeAnthropic(["supported", "supported", "supported"])).check_message(
            message_id="message-1",
            user_id=USER_ID,
        )
        artifact_check = CitationVerifierService(store, FakeAnthropic(["supported", "supported", "supported"])).check_answer(
            answer=artifact.content or "",
            citations=[CitationRef.from_dict(item) for item in artifact_refs],
            user_id=USER_ID,
            thread_id="artifact-library",
            message_id="artifact-1",
        )

        assert vcso_check.overall == "supported"
        assert artifact_check.overall == "supported"
        assert {item["verdict"] for item in vcso_check.verdicts} == {"supported"}
        assert {item["verdict"] for item in artifact_check.verdicts} == {"supported"}
    finally:
        main.app.dependency_overrides.clear()


def test_ep7a_dark_dormant_and_verifier_acceptance_states(monkeypatch):
    import services.citations.verify as verify_module

    store = FakeStore()

    web = CitationRef(source_kind="web", source_id="web-1", source_metadata={"url": "https://example.com"})
    reflection_review = CitationRef(
        source_kind="platform_record",
        source_id="review-1",
        locator=Locator(kind="record_path", record_path="reflection_reviews/review-1/title"),
    )

    assert verify_module.resolve_citation_ref(web, USER_ID, store)["code"] == "no_citable_web_producer"
    assert verify_module.resolve_citation_ref(reflection_review, USER_ID, store)["code"] == "unresolvable"

    def fake_resolve(ref, user_id, store):
        if ref.source_id == "missing":
            return {"type": "error", "code": "unresolvable"}
        return {"type": "chunk", "verbatim": f"source text for {ref.source_id}"}

    monkeypatch.setattr(verify_module, "resolve_citation_ref", fake_resolve)
    result = CitationVerifierService(store, FakeAnthropic(["supported", "unsupported"])).check_answer(
        answer="Faithful quote [1]. Unsupported claim [2]. Unreadable claim [3].",
        citations=[
            CitationRef(source_kind="document_chunk", source_id="faithful", source_label="Faithful source"),
            CitationRef(source_kind="document_chunk", source_id="unsupported", source_label="Unsupported source"),
            CitationRef(source_kind="document_chunk", source_id="missing", source_label="Unreadable source"),
        ],
        user_id=USER_ID,
        thread_id="thread-1",
        message_id="message-acceptance",
    )

    assert [item["verdict"] for item in result.verdicts] == ["supported", "unsupported", "unresolvable"]
    assert result.overall == "unsupported"


def _store_with_lit_sources() -> FakeStore:
    chunk_ref = {
        "ordinal": 1,
        "source_kind": "document_chunk",
        "source_id": "chunk-1",
        "source_label": "Delivery brief chunk",
        "verbatim": "Delivery capacity is the constraint.",
        "locator": {"kind": "lines", "path": None, "lines": {"start": 5, "end": 6}},
        "source_metadata": {},
    }
    wiki_ref = {
        "ordinal": 2,
        "source_kind": "wiki_page",
        "source_id": "claim-1",
        "source_label": "Growth constraint claim",
        "verbatim": None,
        "locator": {"kind": "page_key", "page_key": "growth_constraints"},
        "source_metadata": {"raw_source_kind": "wiki_claim"},
    }
    platform_ref = {
        "ordinal": 3,
        "source_kind": "platform_record",
        "source_id": "goal-1",
        "source_label": "Q3 focus",
        "verbatim": None,
        "locator": {"kind": "record_path", "record_path": "sp_sprint_goals/goal-1/goal_text"},
        "source_metadata": {},
    }
    artifact_path = f"{USER_ID}/artifact-1/report.md"
    return FakeStore(
        tables={
            "document_chunks": [
                {
                    "id": "chunk-1",
                    "user_id": USER_ID,
                    "document_id": "doc-1",
                    "chunk_index": 1,
                    "content": "Delivery capacity is the constraint.",
                    "metadata": {"document_title": "Delivery Brief", "lines": {"start": 5, "end": 6}},
                }
            ],
            "ose_raw_document_registry": [
                {
                    "id": "doc-1",
                    "user_id": USER_ID,
                    "file_name": "Delivery Brief.pdf",
                    "file_type": "application/pdf",
                    "status": "processed",
                    "parser_status": "complete",
                    "metadata_document_type": "brief",
                    "metadata_business_domain": "operations",
                }
            ],
            "sp_sprint_goals": [
                {
                    "id": "goal-1",
                    "user_id": USER_ID,
                    "name": "Q3 Focus",
                    "goal_text": "Improve delivery reliability.",
                    "quarter": "2026-Q3",
                    "status": "active",
                    "kickoff_date": "2026-07-01",
                    "updated_at": "2026-07-06",
                }
            ],
            "vcso_chat_messages": [
                {
                    "id": "message-1",
                    "thread_id": "thread-1",
                    "user_id": USER_ID,
                    "role": "assistant",
                    "content": "Delivery capacity is the constraint [1]. The wiki names it [2]. The sprint goal is active [3].",
                    "citations": [chunk_ref, wiki_ref, platform_ref],
                }
            ],
            "artifacts": [
                {
                    "id": "artifact-1",
                    "user_id": USER_ID,
                    "source_kind": "domain_agent_task",
                    "source_id": "task-1",
                    "filename": "report.md",
                    "mime_type": "text/markdown",
                    "size": 80,
                    "storage_path": artifact_path,
                    "renderable": True,
                    "description": "Acceptance report",
                    "provenance": {
                        "schema_version": "domain_agent_artifact_provenance_v1",
                        "source_refs": [
                            _stored_provenance_ref(chunk_ref, raw_source_kind="document_chunk"),
                            _stored_provenance_ref(wiki_ref, raw_source_kind="wiki_claim"),
                            _stored_provenance_ref(platform_ref, raw_source_kind="founder_dataset"),
                        ],
                    },
                }
            ],
        },
        objects={
            artifact_path: b"Artifact cites delivery capacity [1], the wiki claim [2], and the sprint goal [3]."
        },
    )


def _fake_get_claim(self, user_id, claim_id):
    assert user_id == USER_ID
    assert claim_id == "claim-1"
    return {
        "summary": "Retrieved wiki claim.",
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


def _chip_ordinals(refs):
    return [ref.get("ordinal") for ref in refs]


def _stored_provenance_ref(ref, *, raw_source_kind):
    return {
        "source_kind": raw_source_kind,
        "source_id": ref["source_id"],
        "source_label": ref["source_label"],
        "source_metadata": {
            **(ref.get("source_metadata") or {}),
            **({"record_path": ref["locator"]["record_path"]} if raw_source_kind == "founder_dataset" else {}),
        },
        "citation_payload": {
            "citation_version": "citation-1.0",
            "verbatim": ref.get("verbatim"),
            "locator": ref.get("locator"),
        },
    }
