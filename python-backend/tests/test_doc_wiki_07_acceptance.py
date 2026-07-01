"""
Sub-phase 07 - Layer 2 Document Wiki Acceptance Harness.

Exercises the Layer 2 stack against live Supabase with a dedicated test user.
All Claude synthesis calls are mocked; live Claude is explicitly deferred.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

_BACKEND_DIR = Path(__file__).parents[1]
_PROJECT_ROOT = _BACKEND_DIR.parents[0]
sys.path.insert(0, str(_BACKEND_DIR))

_env_file = _PROJECT_ROOT / ".env.local"
if _env_file.exists():
    try:
        from dotenv import dotenv_values

        _vals = dotenv_values(str(_env_file))
        if not os.environ.get("SUPABASE_URL"):
            os.environ["SUPABASE_URL"] = _vals.get("VITE_SUPABASE_URL") or ""
        if not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
            for _k in ("service_role", "SUPABASE_SERVICE_KEY"):
                _v = _vals.get(_k)
                if _v:
                    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = _v
                    break
        if not os.environ.get("OPENAI_API_KEY"):
            os.environ["OPENAI_API_KEY"] = _vals.get("OPENAI_API_KEY") or ""
        if not os.environ.get("ANTHROPIC_API_KEY"):
            os.environ["ANTHROPIC_API_KEY"] = _vals.get("ANTHROPIC_API_KEY") or ""
    except ImportError:
        pass

_DW_TEST_EMAIL = "docwiki07-acceptance@architectos.internal"
_DW_TEST_PASS = "DocWiki07AcceptanceTest!99"
_LONG_TEXT = (
    "ArchitectOS agency founder strategic context document for acceptance testing. "
    + " ".join(["Strategic planning context placeholder word"] * 20)
)

_STEP2_CANONICAL_KEY = "dw07_acceptance_client_xyz"
_STEP2_PAGE_TITLE = "Client XYZ - Agency Relationship"
_STEP7_CONTRADICTS_KEY = "dw07_accept_contradicts_target"


def _fake_outputs(
    page_title: str,
    canonical_key: str,
    page_kind: str,
    content: str = "",
    contradictory_canonical_keys: list[str] | None = None,
) -> list[dict[str, Any]]:
    return [
        {
            "page_title": page_title,
            "page_kind": page_kind,
            "canonical_key": canonical_key,
            "content": content or f"## {page_title}\n\nSynthesized content for acceptance testing.\n",
            "confidence": 0.8,
            "category": "client_market",
            "domain": None,
            "effective_date": None,
            "topics_mentioned": [],
            "suggested_links": [],
            "page_worthiness": "worthy",
            "split_recommended": False,
            "contradictory_canonical_keys": contradictory_canonical_keys or [],
        }
    ]


_DW_CLEANUP_TABLES = [
    "ose_page_links",
    "ose_page_corrections",
    "ose_activity_log",
]
_DW_CLEANUP_TABLES_POST = ["ose_knowledge_pages"]


def _dw_purge(store: Any, user_id: str, extra_doc_ids: list[str] | None = None) -> None:
    if not user_id:
        return
    for table in _DW_CLEANUP_TABLES:
        try:
            store.client.table(table).delete().eq("user_id", user_id).execute()
        except Exception:
            pass
    for table in _DW_CLEANUP_TABLES_POST:
        try:
            store.client.table(table).delete().eq("user_id", user_id).execute()
        except Exception:
            pass
    for doc_id in extra_doc_ids or []:
        try:
            store.client.table("ose_raw_document_registry").delete().eq("id", doc_id).eq("user_id", user_id).execute()
        except Exception:
            pass


@pytest.fixture(scope="session")
def dw_store():
    try:
        from core.config import get_settings

        get_settings.cache_clear()
    except Exception:
        pass

    try:
        from services.vector_store import VectorStore

        store = VectorStore.from_env()
    except Exception as exc:
        pytest.skip(f"VectorStore unavailable: {exc}")

    yield store


@pytest.fixture(scope="session")
def dw_user_id(dw_store):
    user_id = ""
    try:
        resp = dw_store.client.auth.admin.create_user(
            {"email": _DW_TEST_EMAIL, "password": _DW_TEST_PASS, "email_confirm": True}
        )
        user_id = resp.user.id
    except Exception:
        try:
            users = dw_store.client.auth.admin.list_users()
            for user in users.users if hasattr(users, "users") else users:
                if getattr(user, "email", None) == _DW_TEST_EMAIL:
                    user_id = user.id
                    break
        except Exception as exc:
            pytest.skip(f"Could not resolve doc wiki test auth user: {exc}")

    if not user_id:
        pytest.skip("Doc wiki test user UUID could not be determined")

    _dw_purge(dw_store, user_id)
    yield user_id
    _dw_purge(dw_store, user_id)


@pytest.fixture(scope="session")
def dw_openai_available(dw_store, dw_user_id) -> bool:
    try:
        vec = dw_store.embed_query("agency revenue growth")
        return isinstance(vec, list) and len(vec) == 1536
    except Exception:
        return False


@pytest.fixture(scope="session")
def dw_synthesis_svc(dw_store):
    try:
        import anthropic
        from services.doc_wiki_synthesis import DocWikiSynthesisService
    except Exception as exc:
        pytest.skip(f"DocWikiSynthesisService unavailable: {exc}")

    return DocWikiSynthesisService(
        store=dw_store,
        anthropic_client=anthropic.Anthropic(api_key="test-key-never-called"),
    )


def _make_source_payload(
    user_id: str,
    source_kind: str = "sprint",
    source_id: str | None = None,
    canonical_key_suffix: str = "",
) -> Any:
    from services.doc_wiki_synthesis import SourcePayload

    return SourcePayload(
        user_id=user_id,
        source_kind=source_kind,
        source_id=source_id or str(uuid.uuid4()),
        source_title=f"Test Source {canonical_key_suffix or 'default'}",
        full_text=_LONG_TEXT,
        chunk_refs=[],
        metadata={"forced_page_kind": None},
        synthesis_job_id=str(uuid.uuid4()),
    )


def _synthesize_one(svc: Any, user_id: str, page_title: str, canonical_key: str, page_kind: str, content: str = ""):
    payload = _make_source_payload(user_id, source_kind="sprint", canonical_key_suffix=canonical_key)
    fake_out = _fake_outputs(page_title, canonical_key, page_kind, content=content)
    with patch.object(type(svc), "_call_synthesis_claude", return_value=fake_out):
        return svc.synthesize(payload)


def _page_rows(store: Any, user_id: str, canonical_key: str) -> list[dict[str, Any]]:
    return (
        store.client.table("ose_knowledge_pages")
        .select("*")
        .eq("user_id", user_id)
        .eq("canonical_key", canonical_key)
        .execute()
        .data
        or []
    )


class TestStep1MigrationsLive:
    def test_match_ose_knowledge_pages_rpc_exists(self, dw_store, dw_user_id):
        zero_vec = [0.0] * 1536
        try:
            resp = dw_store.client.rpc(
                "match_ose_knowledge_pages",
                {
                    "query_embedding": zero_vec,
                    "match_count": 1,
                    "target_user_id": dw_user_id,
                    "match_threshold": 0.99,
                },
            ).execute()
            assert isinstance(resp.data, list)
        except Exception as exc:
            pytest.fail(f"match_ose_knowledge_pages RPC not callable: {exc}")

    def test_ose_page_corrections_table_exists(self, dw_store, dw_user_id):
        resp = (
            dw_store.client.table("ose_page_corrections")
            .select("id")
            .eq("user_id", dw_user_id)
            .limit(1)
            .execute()
        )
        assert isinstance(resp.data, list)

    def test_ose_activity_log_table_exists(self, dw_store, dw_user_id):
        resp = (
            dw_store.client.table("ose_activity_log")
            .select("id")
            .eq("user_id", dw_user_id)
            .limit(1)
            .execute()
        )
        assert isinstance(resp.data, list)


class TestStep2DocumentSynthesis:
    def test_synthesis_creates_page(self, dw_synthesis_svc, dw_store, dw_user_id):
        result = _synthesize_one(dw_synthesis_svc, dw_user_id, _STEP2_PAGE_TITLE, _STEP2_CANONICAL_KEY, "client")
        assert result.pages_created == 1 or result.pages_updated == 1
        assert result.page_ids
        assert _page_rows(dw_store, dw_user_id, _STEP2_CANONICAL_KEY)

    def test_synthesis_sets_correct_fields(self, dw_store, dw_user_id):
        rows = _page_rows(dw_store, dw_user_id, _STEP2_CANONICAL_KEY)
        assert rows, "Step2 page must exist"
        row = rows[0]
        assert row["page_kind"] == "client"
        assert row["canonical_key"] == _STEP2_CANONICAL_KEY
        assert row["page_title"] == _STEP2_PAGE_TITLE
        assert row["page_type"] == "custom"

    def test_synthesis_writes_activity_log(self, dw_store, dw_user_id):
        rows = (
            dw_store.client.table("ose_activity_log")
            .select("text,kind,icon")
            .eq("user_id", dw_user_id)
            .ilike("text", "%SYNTHESIS_COMPLETE%")
            .execute()
            .data
            or []
        )
        assert rows
        assert any(row["kind"] == "activity" for row in rows)

    def test_synthesis_updates_manifest(self, dw_synthesis_svc, dw_store, dw_user_id):
        fake_doc_id = str(uuid.uuid4())
        try:
            dw_store.client.table("ose_raw_document_registry").insert(
                {
                    "id": fake_doc_id,
                    "user_id": dw_user_id,
                    "file_name": "test_document_07.pdf",
                    "file_type": "pdf",
                    "storage_path": f"acceptance/{dw_user_id}/{fake_doc_id}.pdf",
                    "status": "ingested",
                    "record_state": "active",
                    "connected_pages": [],
                }
            ).execute()
        except Exception as exc:
            pytest.skip(f"Could not insert fake registry row for manifest test: {exc}")

        payload = _make_source_payload(dw_user_id, source_kind="document", source_id=fake_doc_id)
        fake_out = _fake_outputs("Manifest Test Page", "dw07_manifest_page", "offer")
        with patch.object(type(dw_synthesis_svc), "_call_synthesis_claude", return_value=fake_out):
            result = dw_synthesis_svc.synthesize(payload)
        try:
            assert result.page_ids
            doc = dw_store.get_document(fake_doc_id, dw_user_id)
            assert result.page_ids[0] in (doc.get("connected_pages") or [])
        finally:
            for page_id in result.page_ids:
                try:
                    dw_store.client.table("ose_knowledge_pages").delete().eq("id", page_id).eq(
                        "user_id", dw_user_id
                    ).execute()
                except Exception:
                    pass
            try:
                dw_store.client.table("ose_raw_document_registry").delete().eq("id", fake_doc_id).eq(
                    "user_id", dw_user_id
                ).execute()
            except Exception:
                pass


class TestStep3Idempotency:
    def test_resynthesis_updates_not_creates(self, dw_synthesis_svc, dw_store, dw_user_id):
        before = len(_page_rows(dw_store, dw_user_id, _STEP2_CANONICAL_KEY))
        result = _synthesize_one(
            dw_synthesis_svc,
            dw_user_id,
            _STEP2_PAGE_TITLE,
            _STEP2_CANONICAL_KEY,
            "client",
            content="## Updated\n\nUpdated acceptance harness content.",
        )
        after = len(_page_rows(dw_store, dw_user_id, _STEP2_CANONICAL_KEY))
        assert before == 1
        assert after == 1
        assert result.pages_updated == 1

    def test_canonical_key_stable_on_resynthesis(self, dw_store, dw_user_id):
        rows = _page_rows(dw_store, dw_user_id, _STEP2_CANONICAL_KEY)
        assert len(rows) == 1
        assert rows[0]["canonical_key"] == _STEP2_CANONICAL_KEY


class TestStep4AlternateSourcePaths:
    def test_sprint_source_creates_sprint_history_page(self, dw_synthesis_svc, dw_store, dw_user_id):
        key = "dw07_accept_sprint_history"
        _synthesize_one(dw_synthesis_svc, dw_user_id, "Sprint History", key, "sprint_history")
        assert _page_rows(dw_store, dw_user_id, key)[0]["page_kind"] == "sprint_history"

    def test_cso_thread_source_creates_thread_synthesis_page(self, dw_synthesis_svc, dw_store, dw_user_id):
        key = "dw07_accept_thread_synthesis"
        _synthesize_one(dw_synthesis_svc, dw_user_id, "Thread Synthesis", key, "thread_synthesis")
        assert _page_rows(dw_store, dw_user_id, key)[0]["page_kind"] == "thread_synthesis"

    def test_agent_artifact_source_creates_artifact_page(self, dw_synthesis_svc, dw_store, dw_user_id):
        key = "dw07_accept_agent_artifact"
        _synthesize_one(dw_synthesis_svc, dw_user_id, "Agent Artifact", key, "agent_artifact")
        assert _page_rows(dw_store, dw_user_id, key)[0]["page_kind"] == "agent_artifact"


class TestStep5EmbeddingSearch:
    def test_embed_page_writes_embedding(self, dw_store, dw_user_id, dw_openai_available):
        if not dw_openai_available:
            pytest.skip("OpenAI embedding quota/key unavailable; structural embedding smoke deferred")
        rows = _page_rows(dw_store, dw_user_id, _STEP2_CANONICAL_KEY)
        assert rows and rows[0].get("embedding") is not None

    def test_search_returns_page(self, dw_store, dw_user_id, dw_openai_available):
        if not dw_openai_available:
            pytest.skip("OpenAI embedding quota/key unavailable; semantic search smoke deferred")
        from services.doc_wiki_read_service import DocWikiReadService

        result = DocWikiReadService(dw_store).search(dw_user_id, "Client XYZ agency relationship", limit=5)
        keys = {finding["canonical_key"] for finding in result.get("findings") or []}
        assert _STEP2_CANONICAL_KEY in keys

    def test_get_page_by_canonical_key(self, dw_store, dw_user_id):
        from services.doc_wiki_read_service import DocWikiReadService

        result = DocWikiReadService(dw_store).get_page(dw_user_id, canonical_key=_STEP2_CANONICAL_KEY)
        assert result["schema_version"] == "agent_result_v1"
        assert result["findings"][0]["canonical_key"] == _STEP2_CANONICAL_KEY

    def test_list_pages_by_user(self, dw_store, dw_user_id):
        from services.doc_wiki_read_service import DocWikiReadService

        result = DocWikiReadService(dw_store).list_pages(dw_user_id, limit=20)
        keys = {finding["canonical_key"] for finding in result.get("findings") or []}
        assert _STEP2_CANONICAL_KEY in keys


class TestStep6CorrectionsLifecycle:
    _CORRECTION_BODY = "Founder correction: Client XYZ is now a retained advisory account."
    _KEY = "dw07_accept_correction_page"

    def test_correction_preserved_in_resynthesized_content(self, dw_synthesis_svc, dw_store, dw_user_id):
        _synthesize_one(dw_synthesis_svc, dw_user_id, "Correction Page", self._KEY, "client")
        page = _page_rows(dw_store, dw_user_id, self._KEY)[0]
        dw_store.client.table("ose_page_corrections").insert(
            {"user_id": dw_user_id, "page_id": page["id"], "body": self._CORRECTION_BODY, "status": "pending"}
        ).execute()
        _synthesize_one(
            dw_synthesis_svc,
            dw_user_id,
            "Correction Page",
            self._KEY,
            "client",
            content="## Correction Page\n\nFresh synthesis content.",
        )
        updated = _page_rows(dw_store, dw_user_id, self._KEY)[0]
        assert "## Founder Corrections Preserved" in updated["content"]
        assert self._CORRECTION_BODY in updated["content"]

    def test_correction_marked_applied_after_resynthesis(self, dw_store, dw_user_id):
        rows = (
            dw_store.client.table("ose_page_corrections")
            .select("status,body")
            .eq("user_id", dw_user_id)
            .eq("body", self._CORRECTION_BODY)
            .execute()
            .data
            or []
        )
        assert rows
        assert all(row["status"] == "applied" for row in rows)


class TestStep7ContradictionFlagging:
    def _seed_target_page(self, dw_synthesis_svc, dw_store, dw_user_id):
        _synthesize_one(dw_synthesis_svc, dw_user_id, "Client Context Target Page", _STEP7_CONTRADICTS_KEY, "client")
        rows = _page_rows(dw_store, dw_user_id, _STEP7_CONTRADICTS_KEY)
        if not rows:
            pytest.skip("Target contradiction page was not created")
        return rows[0]["id"]

    def test_contradiction_written_to_page_links(self, dw_synthesis_svc, dw_store, dw_user_id):
        target_id = self._seed_target_page(dw_synthesis_svc, dw_store, dw_user_id)
        payload = _make_source_payload(dw_user_id, source_kind="sprint")
        fake_out = _fake_outputs(
            page_title="Contradicting Market Page",
            canonical_key="dw07_accept_contradicting_page",
            page_kind="market_trend",
            contradictory_canonical_keys=[_STEP7_CONTRADICTS_KEY],
        )
        with patch.object(type(dw_synthesis_svc), "_call_synthesis_claude", return_value=fake_out):
            result = dw_synthesis_svc.synthesize(payload)
        assert result.page_ids

        rows = (
            dw_store.client.table("ose_page_links")
            .select("relation,from_page_id,to_page_id")
            .eq("user_id", dw_user_id)
            .eq("from_page_id", result.page_ids[0])
            .eq("to_page_id", target_id)
            .execute()
            .data
            or []
        )
        assert rows
        assert rows[0]["relation"] == "contradicts"

    def test_contradiction_written_to_activity_log(self, dw_store, dw_user_id):
        rows = (
            dw_store.client.table("ose_activity_log")
            .select("text,kind,icon")
            .eq("user_id", dw_user_id)
            .ilike("text", "%CONTRADICTION_FLAGGED%")
            .execute()
            .data
            or []
        )
        assert rows
        assert rows[0]["kind"] == "decision"
        assert rows[0]["icon"] == "alert-triangle"


class TestStep8HealthService:
    def test_health_returns_valid_schema(self, dw_store, dw_user_id):
        from services.doc_wiki_health_service import DocWikiHealthService

        health = DocWikiHealthService(dw_store).health(dw_user_id)
        assert health["schema_version"] == "doc_wiki_health_v1"
        assert health["user_id"] == dw_user_id
        assert health["checked_at"]

    def test_health_counts_all_present(self, dw_store, dw_user_id):
        from services.doc_wiki_health_service import DocWikiHealthService

        counts = DocWikiHealthService(dw_store).health(dw_user_id).get("counts") or {}
        expected = {
            "pages_total",
            "pages_with_embedding",
            "pages_without_embedding",
            "pages_with_pending_corrections",
            "contradiction_count",
            "orphan_pages",
            "recent_errors_7d",
        }
        assert not (expected - set(counts))
        assert all(counts[key] is None or isinstance(counts[key], int) for key in expected)

    def test_health_status_is_valid_value(self, dw_store, dw_user_id):
        from services.doc_wiki_health_service import DocWikiHealthService

        health = DocWikiHealthService(dw_store).health(dw_user_id)
        assert health["status"] in ("healthy", "needs_attention", "degraded")

    def test_health_surfaces_pending_corrections(self, dw_store, dw_user_id):
        from services.doc_wiki_health_service import DocWikiHealthService

        counts = DocWikiHealthService(dw_store).health(dw_user_id).get("counts") or {}
        assert counts.get("pages_with_pending_corrections") == 0

    def test_health_contradiction_count_positive(self, dw_store, dw_user_id):
        from services.doc_wiki_health_service import DocWikiHealthService

        counts = DocWikiHealthService(dw_store).health(dw_user_id).get("counts") or {}
        assert (counts.get("contradiction_count") or 0) >= 1


class TestStep9UIDataAvailable:
    def test_wiki_pages_readable_by_user(self, dw_store, dw_user_id):
        rows = (
            dw_store.client.table("ose_knowledge_pages")
            .select("id,page_title,page_kind,canonical_key,last_updated")
            .eq("user_id", dw_user_id)
            .neq("status", "deleted")
            .execute()
            .data
            or []
        )
        assert rows
        assert all(row.get("page_title") and row.get("canonical_key") and row.get("page_kind") for row in rows)

    def test_activity_log_readable_by_user(self, dw_store, dw_user_id):
        rows = (
            dw_store.client.table("ose_activity_log")
            .select("id,kind,text,icon,created_at")
            .eq("user_id", dw_user_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
            .data
            or []
        )
        assert rows
        assert all(row.get("kind") in ("activity", "decision") and row.get("text") for row in rows)


class TestStep10Layer1Bridge:
    def test_page_type_field_set_correctly(self, dw_store, dw_user_id):
        rows = (
            dw_store.client.table("ose_knowledge_pages")
            .select("canonical_key,page_kind,page_type")
            .eq("user_id", dw_user_id)
            .neq("status", "deleted")
            .execute()
            .data
            or []
        )
        assert rows
        schema = json.loads((_PROJECT_ROOT / "src" / "config" / "doc_wiki_schema.json").read_text())
        kind_to_page_type = schema.get("kind_to_page_type", {})
        for row in rows:
            expected = kind_to_page_type.get(row.get("page_kind") or "", "custom")
            assert row.get("page_type") == expected

    def test_no_wiki_claims_written_by_synthesis(self, dw_store, dw_user_id):
        try:
            rows = (
                dw_store.client.table("wiki_claims")
                .select("id")
                .eq("user_id", dw_user_id)
                .execute()
                .data
                or []
            )
        except Exception:
            rows = []
        assert len(rows) == 0


class TestDeferredLiveItems:
    @pytest.mark.skip(
        reason=(
            "DL-01: Real Claude synthesis smoke deferred. Harness always mocks "
            "_call_synthesis_claude; remove this skip only for an intentional paid live smoke."
        )
    )
    def test_dl_01_real_claude_synthesis(self, dw_synthesis_svc, dw_store, dw_user_id):
        pass

    @pytest.mark.skip(
        reason=(
            "DL-02: Real embedding semantic ranking quality deferred. Structural search "
            "runs only when OpenAI quota/key are available."
        )
    )
    def test_dl_02_real_embedding_semantic_ranking(self, dw_store, dw_user_id):
        pass
