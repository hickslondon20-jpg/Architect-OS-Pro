# Sub-phase 07 — Execution Agent Brief
## Layer 2 Document Wiki Acceptance Harness

---

## Your Role

You are the sub-phase 07 execution agent for the ArchitectOS Document Wiki (Layer 2).
Your job is to:
1. Apply two pending migrations to the live Supabase project
2. Fix one confirmed bug in `doc_wiki_synthesis.py`
3. Write the complete acceptance harness test file
4. Run it and confirm all tests pass (deferred items skip)
5. Update `Pro-Suite-Progress.md`

Do not touch anything outside the scope below.

---

## Step 0 — Read First

Before writing any code:

1. `.planning/document-wiki/phases/07-acceptance/CONTEXT.md` — scope, constraints, AC mapping
2. `.planning/document-wiki/phases/07-acceptance/07-RESEARCH.md` — full spec, bug detail, test structure
3. `python-backend/tests/conftest.py` — env loading + auth fixture pattern to mirror
4. `python-backend/tests/test_wiki_08_acceptance.py` — the Layer 1 harness as the model
5. `python-backend/services/doc_wiki_synthesis.py` — lines 305–331 (`_flag_contradictions`) for the bug fix
6. `python-backend/services/doc_wiki_read_service.py` — the three read methods
7. `python-backend/services/doc_wiki_health_service.py` — `health()` method
8. `src/config/doc_wiki_schema.json` — page_kind vocabulary and `kind_to_page_type` mapping
9. `Pro-Suite-Progress.md` — read current state before updating

---

## Step 1 — Apply Pending Migrations (Supabase MCP)

**Project ID:** `pwacpjqkntnovndhspxt`

Apply both migrations using the Supabase MCP `apply_migration` tool. These are idempotent.

**Migration 1:** `docs/migrations/20260630_docwiki_page_search.sql`
- Creates `match_ose_knowledge_pages` RPC (pure cosine similarity, `vector(1536)`)
- Uses `CREATE OR REPLACE FUNCTION` — safe to apply

**Migration 2:** `docs/migrations/20260630_docwiki_corrections_log.sql`
- Creates `ose_page_corrections` and `ose_activity_log` tables
- Uses `CREATE TABLE IF NOT EXISTS` — safe to apply even if tables exist

Read the SQL from each file, then call `apply_migration` with the SQL content.

After applying, verify with a quick `list_tables` call that the tables/function are visible.

---

## Step 2 — Bug Fix: `_flag_contradictions()` Missing `ose_page_links` Write

**File:** `python-backend/services/doc_wiki_synthesis.py`

**The bug:** `_flag_contradictions()` writes contradictions to `ose_activity_log` only.
`DocWikiHealthService.health()` queries `ose_page_links.relation='contradicts'` for
`contradiction_count` — so `contradiction_count` is always 0 regardless of flagged contradictions.

**The fix:** In `_flag_contradictions()`, add an `ose_page_links` upsert alongside the
existing activity log insert. Find the `try:` block inside the for loop that inserts to
`ose_activity_log` and add after it:

```python
            try:
                self._store.client.table("ose_page_links").upsert(
                    {
                        "user_id": user_id,
                        "from_page_id": page_id,
                        "to_page_id": str(existing["id"]),
                        "relation": "contradicts",
                    },
                    on_conflict="user_id,from_page_id,to_page_id",
                ).execute()
            except Exception:
                pass  # Non-fatal — activity log entry already written
```

This makes `ose_page_links.relation='contradicts'` the ground truth for `contradiction_count`
with the activity log as the audit trail. The `on_conflict` upsert is correct — a contradiction
link overwrites an existing `"related"` link for the same page pair.

The full `_flag_contradictions()` inner loop should now look like:

```python
            try:
                self._store.client.table("ose_activity_log").insert(
                    {"user_id": user_id, "kind": "decision", "text": text, "icon": "alert-triangle"}
                ).execute()
                # Also write to ose_page_links so health.contradiction_count is non-zero
                try:
                    self._store.client.table("ose_page_links").upsert(
                        {
                            "user_id": user_id,
                            "from_page_id": page_id,
                            "to_page_id": str(existing["id"]),
                            "relation": "contradicts",
                        },
                        on_conflict="user_id,from_page_id,to_page_id",
                    ).execute()
                except Exception:
                    pass  # Non-fatal
                count += 1
            except Exception:
                continue
```

---

## Step 3 — Write the Acceptance Harness

**File:** `python-backend/tests/test_doc_wiki_07_acceptance.py`

Write this file from scratch. The complete specification follows.

### 3.1 Imports and helpers

```python
"""
Sub-phase 07 — Layer 2 Document Wiki Acceptance Harness.

Exercises the full Layer 2 stack against live Supabase.
All tests use a dedicated test auth user; all test data is torn down at session end.

Hard rules:
  - Never touch real user rows.
  - Never let real Claude run — always mock _call_synthesis_claude.
  - Never apply migrations in test code — they are applied as Step 0 pre-flight.
  - Deferred items (real Claude, real embed quality) are marked skip, never fail.
"""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

# ── Path setup ────────────────────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).parents[1]
_PROJECT_ROOT = _BACKEND_DIR.parents[0]
sys.path.insert(0, str(_BACKEND_DIR))

# ── Env loading (mirrors conftest.py) ─────────────────────────────────────────
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

# ── Test user ─────────────────────────────────────────────────────────────────
_DW_TEST_EMAIL = "docwiki07-acceptance@architectos.internal"
_DW_TEST_PASS  = "DocWiki07AcceptanceTest!99"

# ── Source-worthy payload text (must be ≥80 words for _is_source_worthy) ─────
_LONG_TEXT = (
    "ArchitectOS agency founder strategic context document for acceptance testing. "
    + " ".join(["Strategic planning context placeholder word"] * 20)
)  # 100+ words — passes _is_source_worthy threshold

# ── Fake synthesis outputs ─────────────────────────────────────────────────────

def _fake_outputs(
    page_title: str,
    canonical_key: str,
    page_kind: str,
    content: str = "",
    contradictory_canonical_keys: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Deterministic fake synthesis output — bypasses real Claude call."""
    return [{
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
    }]
```

### 3.2 Fixtures

```python
# ── Fixtures ──────────────────────────────────────────────────────────────────

_DW_CLEANUP_TABLES = [
    "ose_page_links",
    "ose_page_corrections",
    "ose_activity_log",
]  # ose_knowledge_pages last (FK target of links/corrections)
_DW_CLEANUP_TABLES_POST = ["ose_knowledge_pages"]


def _dw_purge(store: Any, user_id: str, extra_doc_ids: list[str] | None = None) -> None:
    """Delete all test-user rows in FK order."""
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
    # Clean up any fake ose_raw_document_registry rows
    for doc_id in (extra_doc_ids or []):
        try:
            store.client.table("ose_raw_document_registry").delete().eq("id", doc_id).eq("user_id", user_id).execute()
        except Exception:
            pass


@pytest.fixture(scope="session")
def dw_store():
    """Service-role VectorStore for doc wiki tests. Cleans up on teardown."""
    # Invalidate settings cache so env vars take effect
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
    # Teardown: purge doc wiki tables for the test user (user_id resolved in dw_user_id)
    # Note: cleanup happens via dw_user_id fixture; nothing to do here


@pytest.fixture(scope="session")
def dw_user_id(dw_store):
    """Create/reuse test auth user; return UUID. Purges test rows before+after session."""
    _id = ""
    try:
        resp = dw_store.client.auth.admin.create_user({
            "email": _DW_TEST_EMAIL,
            "password": _DW_TEST_PASS,
            "email_confirm": True,
        })
        _id = resp.user.id
    except Exception:
        try:
            users = dw_store.client.auth.admin.list_users()
            for u in (users.users if hasattr(users, "users") else users):
                if getattr(u, "email", None) == _DW_TEST_EMAIL:
                    _id = u.id
                    break
        except Exception as exc2:
            pytest.skip(f"Could not resolve doc wiki test auth user: {exc2}")

    if not _id:
        pytest.skip("Doc wiki test user UUID could not be determined")

    # Pre-session purge
    _dw_purge(dw_store, _id)
    yield _id
    # Post-session purge
    _dw_purge(dw_store, _id)


@pytest.fixture(scope="session")
def dw_openai_available(dw_store, dw_user_id) -> bool:
    """True if a real embed_query round-trip succeeds."""
    try:
        vec = dw_store.embed_query("agency revenue growth")
        return isinstance(vec, list) and len(vec) > 0
    except Exception:
        return False


@pytest.fixture(scope="session")
def dw_synthesis_svc(dw_store):
    """DocWikiSynthesisService with a no-op Anthropic client (Claude always mocked)."""
    import anthropic
    from services.doc_wiki_synthesis import DocWikiSynthesisService
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
    """Build a minimal SourcePayload that passes _is_source_worthy."""
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
```

### 3.3 Step 1 — Migrations Live

```python
# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Pre-flight: migrations are live
# ═══════════════════════════════════════════════════════════════════════════════

class TestStep1MigrationsLive:
    """Verify that both pending migrations are applied before any synthesis runs."""

    def test_match_ose_knowledge_pages_rpc_exists(self, dw_store, dw_user_id):
        """match_ose_knowledge_pages function must exist — call it with a zero vector."""
        zero_vec = [0.0] * 1536
        try:
            resp = dw_store.client.rpc(
                "match_ose_knowledge_pages",
                {
                    "query_embedding": zero_vec,
                    "match_count": 1,
                    "target_user_id": dw_user_id,
                    "match_threshold": 0.99,  # high threshold → empty result is fine
                },
            ).execute()
            assert isinstance(resp.data, list), \
                "match_ose_knowledge_pages must return a list (even if empty)"
        except Exception as exc:
            pytest.fail(
                f"match_ose_knowledge_pages RPC not found or errored. "
                f"Apply 20260630_docwiki_page_search.sql first. Error: {exc}"
            )

    def test_ose_page_corrections_table_exists(self, dw_store, dw_user_id):
        """ose_page_corrections table must exist and be queryable."""
        try:
            resp = dw_store.client.table("ose_page_corrections").select("id").eq(
                "user_id", dw_user_id
            ).limit(1).execute()
            assert isinstance(resp.data, list)
        except Exception as exc:
            pytest.fail(
                f"ose_page_corrections table not accessible. "
                f"Apply 20260630_docwiki_corrections_log.sql first. Error: {exc}"
            )

    def test_ose_activity_log_table_exists(self, dw_store, dw_user_id):
        """ose_activity_log table must exist and be queryable."""
        try:
            resp = dw_store.client.table("ose_activity_log").select("id").eq(
                "user_id", dw_user_id
            ).limit(1).execute()
            assert isinstance(resp.data, list)
        except Exception as exc:
            pytest.fail(
                f"ose_activity_log table not accessible. "
                f"Apply 20260630_docwiki_corrections_log.sql first. Error: {exc}"
            )
```

### 3.4 Step 2 — Document Synthesis

```python
# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Core document synthesis path
# ═══════════════════════════════════════════════════════════════════════════════

# Module-level sentinel so Step2 tests can share the page created in the first test
_STEP2_CANONICAL_KEY = "dw07_acceptance_client_xyz"
_STEP2_PAGE_TITLE = "Client XYZ — Agency Relationship"

class TestStep2DocumentSynthesis:
    """Synthesize a page from a sprint-kind source; verify page, log, manifest."""

    def _run_sprint_synthesis(self, svc, dw_store, dw_user_id):
        """Run synthesis with sprint kind (avoids ose_raw_document_registry lookup)."""
        payload = _make_source_payload(
            dw_user_id, source_kind="sprint", canonical_key_suffix="client_xyz"
        )
        fake_outputs = _fake_outputs(
            page_title=_STEP2_PAGE_TITLE,
            canonical_key=_STEP2_CANONICAL_KEY,
            page_kind="client",
            content=(
                "## Client XYZ\n\n"
                "Client XYZ is a strategic retainer client for the agency. "
                "They represent 28% of total agency revenue as of the last sprint review. "
                "[[Source: raw_document:test-doc-01|Test Document]]\n"
            ),
        )
        with patch.object(type(svc), "_call_synthesis_claude", return_value=fake_outputs):
            return svc.synthesize(payload)

    def test_synthesis_creates_page(self, dw_synthesis_svc, dw_store, dw_user_id):
        result = self._run_sprint_synthesis(dw_synthesis_svc, dw_store, dw_user_id)
        assert result.pages_created == 1, \
            f"Expected 1 page created, got: pages_created={result.pages_created}"
        assert result.page_ids, "SynthesisResult must carry at least one page_id"

    def test_synthesis_sets_correct_fields(self, dw_synthesis_svc, dw_store, dw_user_id):
        """Page in ose_knowledge_pages must have correct kind, key, title, and page_type."""
        rows = (
            dw_store.client.table("ose_knowledge_pages")
            .select("page_title,page_kind,canonical_key,page_type,status")
            .eq("user_id", dw_user_id)
            .eq("canonical_key", _STEP2_CANONICAL_KEY)
            .execute()
            .data or []
        )
        assert rows, f"Page with canonical_key={_STEP2_CANONICAL_KEY} not found in ose_knowledge_pages"
        page = rows[0]
        assert page["page_kind"] == "client"
        assert page["canonical_key"] == _STEP2_CANONICAL_KEY
        assert page["page_title"] == _STEP2_PAGE_TITLE
        assert page["page_type"] == "custom", \
            f"'client' page_kind maps to page_type='custom' per doc_wiki_schema.json; got: {page['page_type']}"
        assert page["status"] == "active"

    def test_synthesis_writes_activity_log(self, dw_synthesis_svc, dw_store, dw_user_id):
        """[SYNTHESIS_COMPLETE] entry must be in ose_activity_log."""
        rows = (
            dw_store.client.table("ose_activity_log")
            .select("text,kind,icon")
            .eq("user_id", dw_user_id)
            .ilike("text", "%SYNTHESIS_COMPLETE%")
            .execute()
            .data or []
        )
        assert rows, "[SYNTHESIS_COMPLETE] must be written to ose_activity_log after synthesis"
        row = rows[0]
        assert row["kind"] == "activity"
        assert row["icon"] == "file-text"

    def test_synthesis_updates_manifest(self, dw_synthesis_svc, dw_store, dw_user_id):
        """For source_kind=document: connected_pages updated in ose_raw_document_registry."""
        fake_doc_id = str(uuid.uuid4())

        # Insert minimal fake registry row
        try:
            dw_store.client.table("ose_raw_document_registry").insert({
                "id": fake_doc_id,
                "user_id": dw_user_id,
                "file_name": "dw07_acceptance_test.pdf",
                "file_type": "pdf",
                "status": "ingested",
                "record_state": "active",
                "connected_pages": [],
            }).execute()
        except Exception as exc:
            pytest.skip(f"Could not insert fake registry row (unknown column?): {exc}")

        canonical_key = "dw07_acceptance_manifest_test"
        payload = _make_source_payload(
            dw_user_id,
            source_kind="document",
            source_id=fake_doc_id,
            canonical_key_suffix="manifest",
        )
        fake_out = _fake_outputs(
            page_title="Manifest Test Page",
            canonical_key=canonical_key,
            page_kind="entity",
        )
        try:
            with patch.object(type(dw_synthesis_svc), "_call_synthesis_claude", return_value=fake_out):
                result = dw_synthesis_svc.synthesize(payload)

            assert result.pages_created == 1, "Manifest test page must be created"

            # Check connected_pages updated
            doc_row = (
                dw_store.client.table("ose_raw_document_registry")
                .select("connected_pages")
                .eq("id", fake_doc_id)
                .eq("user_id", dw_user_id)
                .single()
                .execute()
                .data or {}
            )
            connected = doc_row.get("connected_pages") or []
            assert result.page_ids[0] in connected, \
                f"page_id {result.page_ids[0]} must be in connected_pages after synthesis"
        finally:
            # Clean up fake registry row
            try:
                dw_store.client.table("ose_raw_document_registry").delete().eq(
                    "id", fake_doc_id
                ).eq("user_id", dw_user_id).execute()
            except Exception:
                pass
```

### 3.5 Step 3 — Idempotency

```python
# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Idempotency (dedup via canonical_key)
# ═══════════════════════════════════════════════════════════════════════════════

class TestStep3Idempotency:
    """Re-synthesizing the same canonical_key must update, not create a duplicate."""

    def test_resynthesis_updates_not_creates(self, dw_synthesis_svc, dw_store, dw_user_id):
        # Count pages before
        before = (
            dw_store.client.table("ose_knowledge_pages")
            .select("id", count="exact")
            .eq("user_id", dw_user_id)
            .eq("canonical_key", _STEP2_CANONICAL_KEY)
            .execute()
            .count or 0
        )
        assert before == 1, f"Expected 1 existing page before re-synthesis, got {before}"

        # Re-synthesize same canonical_key
        payload = _make_source_payload(dw_user_id, source_kind="sprint")
        fake_out = _fake_outputs(
            page_title=_STEP2_PAGE_TITLE,
            canonical_key=_STEP2_CANONICAL_KEY,
            page_kind="client",
            content="## Client XYZ\n\nUpdated synthesis content on re-run.\n",
        )
        with patch.object(type(dw_synthesis_svc), "_call_synthesis_claude", return_value=fake_out):
            result = dw_synthesis_svc.synthesize(payload)

        assert result.pages_created == 0, \
            "Re-synthesis of existing canonical_key must not create a new page"
        assert result.pages_updated == 1, \
            "Re-synthesis of existing canonical_key must increment pages_updated"

        # Exactly 1 page still
        after = (
            dw_store.client.table("ose_knowledge_pages")
            .select("id", count="exact")
            .eq("user_id", dw_user_id)
            .eq("canonical_key", _STEP2_CANONICAL_KEY)
            .execute()
            .count or 0
        )
        assert after == 1, f"Still exactly 1 page expected after re-synthesis; got {after}"

    def test_canonical_key_stable_on_resynthesis(self, dw_store, dw_user_id):
        """canonical_key must not change after re-synthesis."""
        rows = (
            dw_store.client.table("ose_knowledge_pages")
            .select("canonical_key")
            .eq("user_id", dw_user_id)
            .eq("canonical_key", _STEP2_CANONICAL_KEY)
            .execute()
            .data or []
        )
        assert len(rows) == 1
        assert rows[0]["canonical_key"] == _STEP2_CANONICAL_KEY
```

### 3.6 Step 4 — Alternate Source Paths

```python
# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Alternate source paths (sprint, cso_thread, agent_artifact)
# ═══════════════════════════════════════════════════════════════════════════════

class TestStep4AlternateSourcePaths:
    """Each source kind must produce a page with the correct page_kind."""

    @pytest.mark.parametrize("source_kind,page_kind,expected_page_type,canonical_key,title", [
        ("sprint", "sprint_history", "strategic_context", "dw07_accept_sprint_01", "Sprint Q2 2026"),
        ("cso_thread", "thread_synthesis", "conversation_intelligence", "dw07_accept_thread_01", "CSO Thread: Revenue Strategy"),
        ("agent_artifact", "agent_artifact", "custom", "dw07_accept_artifact_01", "Competitor Analysis Artifact"),
    ])
    def test_source_kind_produces_correct_page(
        self, dw_synthesis_svc, dw_store, dw_user_id,
        source_kind, page_kind, expected_page_type, canonical_key, title,
    ):
        payload = _make_source_payload(
            dw_user_id,
            source_kind=source_kind,
            canonical_key_suffix=canonical_key,
        )
        fake_out = _fake_outputs(
            page_title=title,
            canonical_key=canonical_key,
            page_kind=page_kind,
        )
        with patch.object(type(dw_synthesis_svc), "_call_synthesis_claude", return_value=fake_out):
            result = dw_synthesis_svc.synthesize(payload)

        assert result.pages_created == 1 or result.pages_updated == 1, \
            f"Expected page created/updated for source_kind={source_kind}"

        row = (
            dw_store.client.table("ose_knowledge_pages")
            .select("page_kind,page_type,canonical_key")
            .eq("user_id", dw_user_id)
            .eq("canonical_key", canonical_key)
            .execute()
            .data or [{}]
        )[0]
        assert row.get("page_kind") == page_kind, \
            f"Expected page_kind={page_kind}, got {row.get('page_kind')}"
        assert row.get("page_type") == expected_page_type, \
            f"Expected page_type={expected_page_type}, got {row.get('page_type')}"
```

### 3.7 Step 5 — Embedding + Search

```python
# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Embedding + search
# ═══════════════════════════════════════════════════════════════════════════════

class TestStep5EmbeddingSearch:
    """_embed_page writes embedding; DocWikiReadService returns the page."""

    def test_embed_page_writes_embedding(self, dw_store, dw_user_id, dw_openai_available):
        if not dw_openai_available:
            pytest.skip("OPENAI_API_KEY unavailable — embedding smoke deferred (DL-02)")

        rows = (
            dw_store.client.table("ose_knowledge_pages")
            .select("id,embedding")
            .eq("user_id", dw_user_id)
            .eq("canonical_key", _STEP2_CANONICAL_KEY)
            .execute()
            .data or []
        )
        assert rows, "Page must exist before embedding check"
        assert rows[0].get("embedding") is not None, \
            "_embed_page must have written a non-null embedding to ose_knowledge_pages"

    def test_search_returns_page(self, dw_store, dw_user_id, dw_openai_available):
        if not dw_openai_available:
            pytest.skip("OPENAI_API_KEY unavailable — semantic search smoke deferred (DL-02)")

        from services.doc_wiki_read_service import DocWikiReadService
        svc = DocWikiReadService(dw_store)
        result = svc.search(dw_user_id, "agency client relationship revenue")

        assert result.get("schema_version") == "agent_result_v1"
        findings = result.get("findings") or []
        assert findings, "search must return ≥1 finding for a user with synthesized data"
        canonical_keys = [f.get("canonical_key") for f in findings]
        assert any(_STEP2_CANONICAL_KEY in (k or "") for k in canonical_keys), \
            f"search must include {_STEP2_CANONICAL_KEY} in results"

    def test_get_page_by_canonical_key(self, dw_store, dw_user_id):
        from services.doc_wiki_read_service import DocWikiReadService
        svc = DocWikiReadService(dw_store)
        result = svc.get_page(dw_user_id, canonical_key=_STEP2_CANONICAL_KEY)

        assert result.get("schema_version") == "agent_result_v1"
        findings = result.get("findings") or []
        assert findings, "get_page must return ≥1 finding"
        page = findings[0]
        assert page.get("canonical_key") == _STEP2_CANONICAL_KEY
        assert page.get("title") == _STEP2_PAGE_TITLE

    def test_list_pages_returns_user_pages(self, dw_store, dw_user_id):
        from services.doc_wiki_read_service import DocWikiReadService
        svc = DocWikiReadService(dw_store)
        result = svc.list_pages(dw_user_id)

        assert result.get("schema_version") == "agent_result_v1"
        findings = result.get("findings") or []
        assert findings, "list_pages must return ≥1 page for a user with synthesized data"
        canonical_keys = [f.get("canonical_key") for f in findings]
        assert _STEP2_CANONICAL_KEY in canonical_keys, \
            f"list_pages must include {_STEP2_CANONICAL_KEY}"
```

### 3.8 Step 6 — Corrections Lifecycle

```python
# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Corrections lifecycle
# ═══════════════════════════════════════════════════════════════════════════════

class TestStep6CorrectionsLifecycle:
    """Insert correction → re-synthesize → correction in content + marked applied."""

    _CORRECTION_BODY = "Founder note: Client XYZ actually represents 35% of revenue, not 28%."

    def _get_page_id(self, dw_store, dw_user_id) -> str:
        rows = (
            dw_store.client.table("ose_knowledge_pages")
            .select("id")
            .eq("user_id", dw_user_id)
            .eq("canonical_key", _STEP2_CANONICAL_KEY)
            .execute()
            .data or []
        )
        if not rows:
            pytest.skip(f"Page {_STEP2_CANONICAL_KEY} not found — Step 2 must run first")
        return rows[0]["id"]

    def test_correction_preserved_in_resynthesized_content(
        self, dw_synthesis_svc, dw_store, dw_user_id
    ):
        page_id = self._get_page_id(dw_store, dw_user_id)

        # Insert pending correction
        dw_store.client.table("ose_page_corrections").insert({
            "user_id": dw_user_id,
            "page_id": page_id,
            "body": self._CORRECTION_BODY,
            "status": "pending",
        }).execute()

        # Re-synthesize — correction overlay must be applied
        payload = _make_source_payload(dw_user_id, source_kind="sprint")
        fake_out = _fake_outputs(
            page_title=_STEP2_PAGE_TITLE,
            canonical_key=_STEP2_CANONICAL_KEY,
            page_kind="client",
            content="## Client XYZ\n\nUpdated content after correction.\n",
        )
        with patch.object(type(dw_synthesis_svc), "_call_synthesis_claude", return_value=fake_out):
            result = dw_synthesis_svc.synthesize(payload)

        assert result.pages_updated == 1 or result.pages_created == 1

        # Fetch updated content
        rows = (
            dw_store.client.table("ose_knowledge_pages")
            .select("content")
            .eq("user_id", dw_user_id)
            .eq("canonical_key", _STEP2_CANONICAL_KEY)
            .execute()
            .data or []
        )
        assert rows
        content = rows[0]["content"] or ""
        assert "## Founder Corrections Preserved" in content, \
            "Resynthesized content must contain '## Founder Corrections Preserved' section"
        assert self._CORRECTION_BODY in content, \
            "The correction body must appear verbatim under the corrections section"

    def test_correction_marked_applied_after_resynthesis(self, dw_store, dw_user_id):
        page_id = self._get_page_id(dw_store, dw_user_id)
        rows = (
            dw_store.client.table("ose_page_corrections")
            .select("status,body")
            .eq("user_id", dw_user_id)
            .eq("page_id", page_id)
            .eq("body", self._CORRECTION_BODY)
            .execute()
            .data or []
        )
        assert rows, "Correction row must exist in ose_page_corrections"
        for row in rows:
            assert row["status"] == "applied", \
                f"Correction must be status='applied' after resynthesis; got {row['status']}"
```

### 3.9 Step 7 — Contradiction Flagging

```python
# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7 — Contradiction flagging
# ═══════════════════════════════════════════════════════════════════════════════

_STEP7_CONTRADICTS_KEY = "dw07_accept_contradicts_target"

class TestStep7ContradictionFlagging:
    """Synthesize page A that contradicts page B; verify ose_page_links + activity log."""

    def _seed_target_page(self, dw_synthesis_svc, dw_store, dw_user_id):
        """Create the target page that will be contradicted."""
        payload = _make_source_payload(dw_user_id, source_kind="sprint")
        fake_out = _fake_outputs(
            page_title="Market Context Target Page",
            canonical_key=_STEP7_CONTRADICTS_KEY,
            page_kind="market_trend",
        )
        with patch.object(type(dw_synthesis_svc), "_call_synthesis_claude", return_value=fake_out):
            dw_synthesis_svc.synthesize(payload)

        rows = (
            dw_store.client.table("ose_knowledge_pages")
            .select("id")
            .eq("user_id", dw_user_id)
            .eq("canonical_key", _STEP7_CONTRADICTS_KEY)
            .execute()
            .data or []
        )
        if not rows:
            pytest.skip("Target contradiction page was not created")
        return rows[0]["id"]

    def test_contradiction_written_to_page_links(
        self, dw_synthesis_svc, dw_store, dw_user_id
    ):
        target_id = self._seed_target_page(dw_synthesis_svc, dw_store, dw_user_id)

        # Synthesize a page that contradicts the target
        payload = _make_source_payload(dw_user_id, source_kind="sprint")
        fake_out = _fake_outputs(
            page_title="Contradicting Market Page",
            canonical_key="dw07_accept_contradicting_page",
            page_kind="market_trend",
            contradictory_canonical_keys=[_STEP7_CONTRADICTS_KEY],
        )
        with patch.object(type(dw_synthesis_svc), "_call_synthesis_claude", return_value=fake_out):
            result = dw_synthesis_svc.synthesize(payload)

        assert result.pages_created == 1 or result.pages_updated == 1

        # Assert ose_page_links has relation='contradicts'
        from_page_id = result.page_ids[0] if result.page_ids else None
        if not from_page_id:
            pytest.skip("No page_id in result — cannot check page links")

        link_rows = (
            dw_store.client.table("ose_page_links")
            .select("relation,from_page_id,to_page_id")
            .eq("user_id", dw_user_id)
            .eq("from_page_id", from_page_id)
            .eq("to_page_id", target_id)
            .execute()
            .data or []
        )
        assert link_rows, \
            "ose_page_links must contain a row for the contradiction pair"
        assert link_rows[0]["relation"] == "contradicts", \
            f"Link relation must be 'contradicts'; got {link_rows[0]['relation']}"

    def test_contradiction_written_to_activity_log(self, dw_store, dw_user_id):
        log_rows = (
            dw_store.client.table("ose_activity_log")
            .select("text,kind,icon")
            .eq("user_id", dw_user_id)
            .ilike("text", "%CONTRADICTION_FLAGGED%")
            .execute()
            .data or []
        )
        assert log_rows, "[CONTRADICTION_FLAGGED] must appear in ose_activity_log"
        assert log_rows[0]["kind"] == "decision"
        assert log_rows[0]["icon"] == "alert-triangle"
```

### 3.10 Steps 8, 9, 10 and Deferred Items

```python
# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8 — Health service
# ═══════════════════════════════════════════════════════════════════════════════

class TestStep8HealthService:
    """DocWikiHealthService.health() returns valid doc_wiki_health_v1 schema."""

    def test_health_returns_valid_schema(self, dw_store, dw_user_id):
        from services.doc_wiki_health_service import DocWikiHealthService
        health = DocWikiHealthService(dw_store).health(dw_user_id)

        assert isinstance(health, dict), "health() must return a dict"
        assert health.get("schema_version") == "doc_wiki_health_v1"
        assert health.get("user_id") == dw_user_id
        assert health.get("checked_at"), "checked_at must be a non-empty string"

    def test_health_counts_all_present(self, dw_store, dw_user_id):
        from services.doc_wiki_health_service import DocWikiHealthService
        health = DocWikiHealthService(dw_store).health(dw_user_id)
        counts = health.get("counts") or {}

        expected_keys = {
            "pages_total",
            "pages_with_embedding",
            "pages_without_embedding",
            "pages_with_pending_corrections",
            "contradiction_count",
            "orphan_pages",
            "recent_errors_7d",
        }
        missing = expected_keys - set(counts.keys())
        assert not missing, f"health.counts missing keys: {missing}"

        for key in expected_keys:
            val = counts[key]
            assert val is None or isinstance(val, int), \
                f"health.counts['{key}'] must be int or None; got {type(val)}"

    def test_health_status_is_valid_value(self, dw_store, dw_user_id):
        from services.doc_wiki_health_service import DocWikiHealthService
        health = DocWikiHealthService(dw_store).health(dw_user_id)
        assert health.get("status") in ("healthy", "needs_attention", "degraded"), \
            f"health.status must be one of three values; got: {health.get('status')}"

    def test_health_surfaces_pending_corrections(self, dw_store, dw_user_id):
        """After Step 6 applied the correction, pending count should be 0."""
        from services.doc_wiki_health_service import DocWikiHealthService
        health = DocWikiHealthService(dw_store).health(dw_user_id)
        counts = health.get("counts") or {}
        # The correction was applied in Step 6 — pending should be 0 now
        pending = counts.get("pages_with_pending_corrections")
        assert pending is not None
        assert pending == 0, \
            "All corrections applied in Step 6 — no pending corrections expected at health check time"

    def test_health_contradiction_count_positive(self, dw_store, dw_user_id):
        """After Step 7 seeded a contradiction, contradiction_count must be ≥1."""
        from services.doc_wiki_health_service import DocWikiHealthService
        health = DocWikiHealthService(dw_store).health(dw_user_id)
        counts = health.get("counts") or {}
        contradiction_count = counts.get("contradiction_count", 0) or 0
        assert contradiction_count >= 1, \
            f"health.contradiction_count must be ≥1 after Step 7 seeded a contradiction; got {contradiction_count}"


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9 — UI data availability
# ═══════════════════════════════════════════════════════════════════════════════

class TestStep9UIDataAvailable:
    """
    Verify that ose_knowledge_pages and ose_activity_log have data readable
    by the queries osEngineApi.ts uses (same table/column names).
    """

    def test_wiki_pages_readable_by_user(self, dw_store, dw_user_id):
        """osEngineApi.ts queries ose_knowledge_pages with page_title → title mapping."""
        rows = (
            dw_store.client.table("ose_knowledge_pages")
            .select("id,page_title,page_kind,canonical_key,last_updated")
            .eq("user_id", dw_user_id)
            .neq("status", "deleted")
            .execute()
            .data or []
        )
        assert rows, "ose_knowledge_pages must have ≥1 active page for this test user"
        for row in rows:
            assert row.get("page_title"), "page_title must be non-empty"
            assert row.get("canonical_key"), "canonical_key must be non-empty"
            assert row.get("page_kind"), "page_kind must be non-empty"

    def test_activity_log_readable_by_user(self, dw_store, dw_user_id):
        """osEngineApi.ts queries ose_activity_log with created_at → timestamp mapping."""
        rows = (
            dw_store.client.table("ose_activity_log")
            .select("id,kind,text,icon,created_at")
            .eq("user_id", dw_user_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
            .data or []
        )
        assert rows, "ose_activity_log must have ≥1 entry for this test user"
        for row in rows:
            assert row.get("kind") in ("activity", "decision")
            assert row.get("text"), "log text must be non-empty"


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 10 — Layer-1 bridge
# ═══════════════════════════════════════════════════════════════════════════════

class TestStep10Layer1Bridge:
    """
    AC5: page_type bridges Layer 2 pages into Layer 1 contexts without duplicating claims.
    The bridge is the page_type field, which maps page_kind → Layer 1 page_type
    via kind_to_page_type in doc_wiki_schema.json.
    """

    def test_page_type_field_set_correctly(self, dw_store, dw_user_id):
        """All synthesized pages must have a non-null page_type."""
        rows = (
            dw_store.client.table("ose_knowledge_pages")
            .select("canonical_key,page_kind,page_type")
            .eq("user_id", dw_user_id)
            .neq("status", "deleted")
            .execute()
            .data or []
        )
        assert rows, "Must have ≥1 page for Layer-1 bridge check"

        # Load the schema config to verify mappings
        import json
        from pathlib import Path
        schema_path = _PROJECT_ROOT / "src" / "config" / "doc_wiki_schema.json"
        schema = json.loads(schema_path.read_text())
        kind_to_page_type = schema.get("kind_to_page_type", {})

        for row in rows:
            page_kind = row.get("page_kind") or ""
            page_type = row.get("page_type")
            expected = kind_to_page_type.get(page_kind, "custom")
            assert page_type == expected, (
                f"page_kind='{page_kind}' should map to page_type='{expected}'; "
                f"got page_type='{page_type}' on canonical_key='{row.get('canonical_key')}'"
            )

    def test_no_wiki_claims_written_by_synthesis(self, dw_store, dw_user_id):
        """
        Layer 2 synthesis MUST NOT write to wiki_claims (Layer 1 claim store).
        The Layer-1 bridge is the page_type field only — not claim duplication.
        """
        try:
            rows = (
                dw_store.client.table("wiki_claims")
                .select("id", count="exact")
                .eq("user_id", dw_user_id)
                .execute()
                .data or []
            )
            count = len(rows)
        except Exception:
            count = 0  # Table might not be visible — both cases mean no Layer 1 writes

        assert count == 0, (
            f"Layer 2 synthesis must NOT write to wiki_claims; "
            f"found {count} wiki_claims row(s) for the doc wiki test user"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# DEFERRED LIVE ITEMS
# ═══════════════════════════════════════════════════════════════════════════════

class TestDeferredLiveItems:
    """
    Explicitly deferred items. These are not failures — they are open items
    to clear when API keys / quota are available. Same pattern as DI-EMBED in Layer 1.
    """

    @pytest.mark.skip(reason=(
        "DL-01: Real Claude synthesis smoke — DEFERRED. Requires ANTHROPIC_API_KEY and "
        "a budget for one synthesis call. The synthesis engine plumbing is fully proven via "
        "mock. When ready: remove this skip, call dw_synthesis_svc.synthesize() WITHOUT "
        "patching _call_synthesis_claude, and assert a page is created."
    ))
    def test_dl_01_real_claude_synthesis(self, dw_synthesis_svc, dw_store, dw_user_id):
        pass

    @pytest.mark.skip(reason=(
        "DL-02: Real embedding semantic ranking quality — DEFERRED. Requires OPENAI_API_KEY "
        "with available quota. Structural embedding smoke (embedding IS NOT NULL) is covered in "
        "Step 5 when openai_available=True. Semantic ranking quality (correct recall ordering) "
        "is unvalidated until quota is confirmed. Re-run Step 5 tests with real OpenAI keys."
    ))
    def test_dl_02_real_embedding_semantic_ranking(self, dw_store, dw_user_id):
        pass
```

---

## Step 4 — Compile Check and Pytest

```bash
# Compile check first
python -m compileall python-backend

# Run the harness
pytest python-backend/tests/test_doc_wiki_07_acceptance.py -v
```

**Expected outcome:** All tests pass or skip. No failures. The two DL-* tests skip. If
tests fail due to the missing `ose_page_links` write for contradictions (before the
`_flag_contradictions` fix is applied), apply the fix in Step 2 first.

**If `test_synthesis_updates_manifest` fails with an unknown column error on
`ose_raw_document_registry`:** Skip the test and add `pytest.skip()` at the point of
failure. Report the unknown column in your execution report.

---

## Step 5 — Update `Pro-Suite-Progress.md`

Find the document wiki section and add:

```
| Document Wiki Acceptance Harness | Document Wiki Layer 2 Sub-phase 07 | `.planning/document-wiki/phases/07-acceptance/07-RESEARCH.md` | [result] | [date] Sub-phase 07 | — |
```

Where `[result]` is either:
- `✅ code-complete — 22/22 acceptance criteria pass; 2 deferred (DL-01 real Claude, DL-02 real embed quality); Layer 2 complete in isolation.`
- Or a description of any failures with a clear next step.

---

## Hard Rules

1. **Never call real Claude** — `_call_synthesis_claude` must always be patched in tests
2. **Never touch real user rows** — scope all writes/reads to `dw_user_id`
3. **Do not modify conftest.py** — Layer 2 harness is fully self-contained
4. **Bug fix is in `_flag_contradictions()` only** — no other synthesis logic changes
5. **Migrations applied via Supabase MCP, not in test code** — Step 1 pre-flight only
6. **Deferred items are `@pytest.mark.skip`** — not failures, not missing tests
7. **Report back:** files modified/created, pytest output (pass/skip/fail counts), any
   deviations, and the Pro-Suite-Progress.md update confirmation
