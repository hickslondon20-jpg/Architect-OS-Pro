from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID

from fastapi.testclient import TestClient

from services.citations.models import CitationRef
from services.citations.verify import CitationVerifierService, UTILITY_FALLBACK_MODEL


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
        self.update_values = None

    def select(self, _columns):
        return self

    def eq(self, column, value):
        self.filters.append((column, str(value)))
        return self

    def maybe_single(self):
        self.single = True
        return self

    def limit(self, _value):
        return self

    def update(self, values):
        self.update_values = values
        return self

    def insert(self, values):
        self.client.inserts.append((self.table_name, values))
        return self

    def execute(self):
        rows = self.rows
        for column, value in self.filters:
            rows = [row for row in rows if str(row.get(column)) == value]
        if self.update_values is not None:
            for row in rows:
                row.update(self.update_values)
            return FakeResponse(rows)
        return FakeResponse((rows[0] if rows else None) if self.single else rows)


class FakeClient:
    def __init__(self, tables):
        self.tables = tables
        self.inserts = []

    def table(self, name):
        return FakeQuery(self, name, self.tables.setdefault(name, []))


class FakeStore:
    def __init__(self, tables=None, model_name="claude-3-5-haiku-latest"):
        self.client = FakeClient(tables or {})
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
        text = f'{{"verdict":"{verdict}","summary":"{verdict} summary"}}'
        return SimpleNamespace(
            content=[SimpleNamespace(text=text)],
            usage=SimpleNamespace(input_tokens=11, output_tokens=7),
        )


def test_verifier_grades_supported_unsupported_and_unresolvable(monkeypatch):
    import services.citations.verify as verify_module

    def fake_resolve(ref, user_id, store):
        if ref.source_id == "missing":
            return {"type": "error", "code": "unresolvable"}
        return {"type": "chunk", "verbatim": f"source text for {ref.source_id}"}

    monkeypatch.setattr(verify_module, "resolve_citation_ref", fake_resolve)
    store = FakeStore()
    anthropic = FakeAnthropic(["supported", "unsupported"])
    service = CitationVerifierService(store, anthropic)

    result = service.check_answer(
        answer="Claim one [1]. Claim two [2]. Claim three [3].",
        citations=[
            CitationRef(source_kind="document_chunk", source_id="one"),
            CitationRef(source_kind="document_chunk", source_id="two"),
            CitationRef(source_kind="document_chunk", source_id="missing"),
            CitationRef(source_kind="derived", source_id="trace-only"),
        ],
        user_id="user-1",
        thread_id="thread-1",
        message_id="message-1",
    )

    assert [item["verdict"] for item in result.verdicts] == ["supported", "unsupported", "unresolvable"]
    assert result.overall == "unsupported"
    assert len(anthropic.calls) == 2
    assert all("rewrite" in call["system"].lower() for call in anthropic.calls)
    assert store.model_requests[0]["setting_key"] == "citation_verifier"
    assert store.model_requests[0]["fallback_model_name"] == UTILITY_FALLBACK_MODEL
    usage_rows = [row for table, row in store.client.inserts if table == "ai_usage_log"]
    assert usage_rows
    assert all(row["role"] == "utility" and row["capability_key"] == "citation_verifier" for row in usage_rows)


def test_check_message_persists_verdicts_on_message_citations(monkeypatch):
    import services.citations.verify as verify_module

    monkeypatch.setattr(
        verify_module,
        "resolve_citation_ref",
        lambda ref, user_id, store: {"type": "chunk", "verbatim": "Source supports the answer."},
    )
    citation = {
        "source_kind": "document_chunk",
        "source_id": "chunk-1",
        "source_label": "Chunk",
        "source_metadata": {},
        "ordinal": 1,
    }
    store = FakeStore(
        {
            "vcso_chat_messages": [
                {
                    "id": "message-1",
                    "thread_id": "thread-1",
                    "user_id": "user-1",
                    "role": "assistant",
                    "content": "Supported claim [1].",
                    "citations": [citation],
                }
            ]
        }
    )
    service = CitationVerifierService(store, FakeAnthropic(["supported"]))

    result = service.check_message(message_id="message-1", user_id="user-1")

    assert result.overall == "supported"
    persisted = store.client.tables["vcso_chat_messages"][0]["citations"][0]
    assert persisted["verdict"]["verdict"] == "supported"
    assert persisted["verdict"]["summary"] == "supported summary"


def test_citation_check_endpoint_uses_user_session(monkeypatch):
    import main
    from routers.kb_folders import get_current_user_id

    class FakeService:
        def check_message(self, message_id, user_id):
            assert message_id == "message-1"
            assert user_id == "00000000-0000-0000-0000-000000000001"
            return SimpleNamespace(
                to_dict=lambda: {
                    "overall": "supported",
                    "summary": "Checked 1 citation.",
                    "verdicts": [{"ordinal": 1, "verdict": "supported"}],
                    "model": "claude-3-5-haiku-latest",
                }
            )

    monkeypatch.setattr(main.CitationVerifierService, "from_env", staticmethod(lambda: FakeService()))
    client = TestClient(main.app)
    secret_only = client.post(
        "/api/citations/check",
        headers={"x-ingest-secret": "test-secret"},
        json={"message_id": "message-1"},
    )
    main.app.dependency_overrides[get_current_user_id] = lambda: UUID("00000000-0000-0000-0000-000000000001")
    checked = client.post("/api/citations/check", json={"message_id": "message-1"})
    main.app.dependency_overrides.clear()

    assert secret_only.status_code == 401
    assert checked.status_code == 200
    assert checked.json()["overall"] == "supported"
