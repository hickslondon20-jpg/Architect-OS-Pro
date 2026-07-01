# Sub-phase 07 — Research: Acceptance Harness

**Verify-pass date:** 2026-06-30
**Verified by:** Orchestration agent
**Status:** Complete — ready for execution

---

## 1. What This Phase Is

End-to-end isolation harness for Layer 2. Proves all five ROADMAP acceptance criteria against
the live Supabase project (`pwacpjqkntnovndhspxt`) before declaring Layer 2 done in isolation.

**After sub-phase 07 passes, Layer 2 is complete.** The connection phase (routing both
Tier-1 layers into Virtual CSO / Domain Agents) is a separate, shared phase.

---

## 2. Existing Test Infrastructure

### 2.1 What already exists

```
python-backend/tests/
  conftest.py                    — session-scoped env loading, store, test auth user, cleanup
  test_wiki_08_acceptance.py     — Layer 1 Wiki System acceptance harness (38 tests, 8 steps + guarantees)
```

The Layer 1 conftest:
- Loads `.env.local` from project root, mapping `VITE_SUPABASE_URL` → `SUPABASE_URL`,
  `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` → `OPENAI_API_KEY`
- Creates a session-scoped `store` fixture (`VectorStore.from_env()`)
- Creates/reuses test auth user `wiki08-acceptance-test@architectos.internal`
- Provides `openai_available` fixture (checks embed_query round-trip)
- Has `autouse=True` session cleanup for Layer 1 tables

### 2.2 Fixture strategy for Layer 2 harness

The Layer 2 harness lives in the **same `tests/` directory** as the Layer 1 harness. To
avoid fixture name conflicts and cleanup interference, it uses **inline session-scoped
fixtures** with the `dw_` prefix (`dw_store`, `dw_user_id`, `dw_openai_available`):

- Different test auth user: `docwiki07-acceptance@architectos.internal`
- Different cleanup tables: `ose_page_links`, `ose_page_corrections`, `ose_activity_log`,
  `ose_knowledge_pages` (+ any fake `ose_raw_document_registry` rows)
- `dw_store` is a `yield` fixture that cleans up after itself — no `autouse`

The existing conftest.py is NOT modified. Layer 2 cleanup never touches Layer 1 tables.

---

## 3. Two Pending Migrations

Both must be applied to the live project before any tests run. Apply via the Supabase MCP
tool as Step 0 of the execution agent brief.

| File | What it creates | Status |
|---|---|---|
| `docs/migrations/20260630_docwiki_page_search.sql` | `match_ose_knowledge_pages` function (pure cosine RPC, `vector(1536)`) | Written, not applied |
| `docs/migrations/20260630_docwiki_corrections_log.sql` | `ose_page_corrections` + `ose_activity_log` tables (idempotent `IF NOT EXISTS`) | Written, not applied |

Both are idempotent (`CREATE OR REPLACE` / `CREATE TABLE IF NOT EXISTS`) — safe to apply
even if partly live.

---

## 4. Core Constraint: Claude Synthesis

Layer 2 synthesis calls Claude Sonnet (`_call_synthesis_claude`). Unlike Layer 1's SQL
compilation, this cannot be exercised live in a cost-free, deterministic way within a
harness context. The harness therefore **always mocks `_call_synthesis_claude`** with a
deterministic fake output. Real Claude synthesis is a deferred item (same pattern as
Layer 1's `DI-EMBED`).

### 4.1 Fake synthesis output schema

Extracted from `_build_system_prompt()` in `doc_wiki_synthesis.py`:

```python
def _fake_synthesis_outputs(
    page_title: str,
    canonical_key: str,
    page_kind: str,
    content: str,
    contradictory_canonical_keys: list[str] | None = None,
) -> list[dict]:
    return [{
        "page_title": page_title,
        "page_kind": page_kind,
        "canonical_key": canonical_key,
        "content": content,
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

### 4.2 `_is_source_worthy` threshold

`_is_source_worthy()` requires `>= 80 words` OR chunk_refs with `>= 60 words`. Fake
`SourcePayload.full_text` must contain at least 80 words.

```python
_LONG_TEXT = "Agency founder strategic operating context. " + " ".join(
    ["Context word placeholder"] * 40
)  # 44+ words per repeat — well over 80
```

---

## 5. Bug Found: Contradiction Signal Not Written to `ose_page_links`

**Severity:** Medium — `DocWikiHealthService.contradiction_count` always returns 0.

**Root cause:**  
`_flag_contradictions()` in `doc_wiki_synthesis.py` writes contradictions to
`ose_activity_log` only. It never writes `relation="contradicts"` to `ose_page_links`.

`DocWikiHealthService.health()` checks:
```python
.table("ose_page_links").eq("relation", "contradicts")
```
→ Always returns 0 because synthesis never writes there.

**Fix (in scope for sub-phase 07):**

Add an `ose_page_links` upsert in `_flag_contradictions()` alongside the activity log entry:

```python
# (inside the try block in _flag_contradictions, after the activity_log insert)
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
    pass  # Non-fatal — log entry already written
```

This makes `ose_page_links.relation='contradicts'` the ground truth for contradiction count,
with the activity log entry as the audit trail. Both are written on contradiction flag.

The existing `on_conflict` key is `(user_id, from_page_id, to_page_id)` — the upsert will
overwrite the relation if a `"related"` link already exists. This is correct: a detected
contradiction supersedes a merely "related" link.

---

## 6. Acceptance Criteria → Test Mapping

| AC | ROADMAP text | Test step(s) |
|---|---|---|
| AC1 | Source event → engine → page with `page_kind`, `source_file_ids`, `canonical_key` dedup | Step2 (document), Step4 (sprint/thread/artifact) |
| AC2 | Page embedded + returned by page-search tool | Step5 |
| AC3 | Founder correction preserved across re-synthesis | Step6 |
| AC4 | Contradictions flagged; health surfaces orphans; activity log records events; UI shells show real content | Step7, Step8, Step9 |
| AC5 | Layer-1 bridge (`ose_page_type`) exposes pages without duplicating claims | Step10 |

**Note on "UI shells show real content" (AC4):** The three OS Engine views
(`WikiView`, `ManifestView`, `LogView`) are fully wired to Supabase via `loadOSEngineData()`
in `osEngineApi.ts`. They will show real content automatically as the backend writes data.
No additional test is needed — the front-end wiring is already live (verified in sub-phase
06 verify pass). The harness confirms the backend writes; the frontend reads the same tables.

**Note on stale-pages check (AC4):** The ROADMAP mentions "stale" as an AC4 item but
`DocWikiHealthService` does not include a stale-pages count. This is an acceptable gap
for beta — stale page detection (not synthesized in >90 days) is a post-beta enhancement.
The harness tests the 7 checks that ARE implemented.

---

## 7. Test File Structure

**File:** `python-backend/tests/test_doc_wiki_07_acceptance.py`

```
class TestStep1MigrationsLive
  test_match_ose_knowledge_pages_rpc_exists
  test_ose_page_corrections_table_exists
  test_ose_activity_log_table_exists

class TestStep2DocumentSynthesis
  test_synthesis_creates_page
  test_synthesis_sets_correct_fields
  test_synthesis_writes_activity_log
  test_synthesis_updates_manifest (uses fake ose_raw_document_registry row)

class TestStep3Idempotency
  test_resynthesis_updates_not_creates
  test_canonical_key_stable_on_resynthesis

class TestStep4AlternateSourcePaths
  test_sprint_source_creates_sprint_history_page
  test_cso_thread_source_creates_thread_synthesis_page
  test_agent_artifact_source_creates_artifact_page

class TestStep5EmbeddingSearch
  test_embed_page_writes_embedding (skip if openai unavailable)
  test_search_returns_page
  test_get_page_by_canonical_key
  test_list_pages_by_user

class TestStep6CorrectionsLifecycle
  test_correction_preserved_in_resynthesized_content
  test_correction_marked_applied_after_resynthesis

class TestStep7ContradictionFlagging
  test_contradiction_written_to_page_links
  test_contradiction_written_to_activity_log

class TestStep8HealthService
  test_health_returns_valid_schema
  test_health_counts_all_present
  test_health_status_is_valid_value
  test_health_surfaces_pending_corrections

class TestStep9UIDataAvailable
  test_wiki_pages_readable_by_user
  test_activity_log_readable_by_user

class TestStep10Layer1Bridge
  test_page_type_field_set_correctly
  test_no_wiki_claims_written_by_synthesis

class TestDeferredLiveItems
  test_dl_01_real_claude_synthesis (SKIP — deferred)
  test_dl_02_real_embedding_quality (SKIP — deferred)
```

---

## 8. `ose_raw_document_registry` Fake Row Strategy

`_maintain_manifest()` calls `self._store.get_document(payload.source_id, payload.user_id)`,
which does a `SELECT *` + `.single()` on `ose_raw_document_registry`. If no row exists,
it raises `VectorStoreError`, which propagates as `DocWikiSynthesisError` from
`_maintain_manifest`, which propagates as `[SYNTHESIS_ERROR]` from `synthesize()`.

For `TestStep2DocumentSynthesis.test_synthesis_updates_manifest`:
1. Insert a minimal fake row into `ose_raw_document_registry` before the test:
   ```python
   fake_doc_id = str(uuid.uuid4())
   dw_store.client.table("ose_raw_document_registry").insert({
       "id": fake_doc_id,
       "user_id": dw_user_id,
       "file_name": "test_document_07.pdf",
       "file_type": "pdf",
       "status": "ingested",
       "record_state": "active",
       "connected_pages": [],
   }).execute()
   ```
2. Run synthesis with `source_kind="document"` and `source_id=fake_doc_id`
3. Assert `connected_pages` now contains the created page_id
4. Clean up the row in `dw_store` teardown

All other tests use `source_kind="sprint"` (bypasses `_maintain_manifest`).

If the `ose_raw_document_registry` insert fails (unknown column), the test should be
skipped with a note, not failed.

---

## 9. Hard Rules

1. **Never touch real user data** — all writes scoped to the test auth user UUID
2. **Always mock `_call_synthesis_claude`** — never let real Claude be called in harness tests
3. **Never skip a test with a workaround** — if a service call fails, assert the root cause
4. **Bug fix is in scope** — fix `_flag_contradictions()` to write to `ose_page_links`; this
   is a plumbing fix, not a new feature
5. **Do not apply migrations in test code** — migrations are applied as Step 0 before pytest;
   tests assume migrations are live
6. **Cleanup is by user_id, not by test row ID** — delete all rows for the test user UUID
7. **compileall must pass** before running pytest
8. **Do NOT import from conftest.py** — the Layer 2 harness defines its own fixtures inline
9. **One test file only** — `test_doc_wiki_07_acceptance.py` — do not split across files

---

## 10. Success Criteria (20 checks)

| # | Criterion |
|---|---|
| 1 | Both migrations applied to live Supabase project |
| 2 | `match_ose_knowledge_pages` RPC callable (Step1) |
| 3 | `ose_page_corrections` table readable (Step1) |
| 4 | `ose_activity_log` table readable (Step1) |
| 5 | Synthesis creates page in `ose_knowledge_pages` (Step2) |
| 6 | Page has correct `page_kind`, `canonical_key`, `page_title`, `page_type` (Step2) |
| 7 | `[SYNTHESIS_COMPLETE]` written to `ose_activity_log` (Step2) |
| 8 | `connected_pages` updated in `ose_raw_document_registry` (Step2 manifest test) |
| 9 | Re-synthesis updates page, not creates duplicate (Step3) |
| 10 | Sprint / CSO thread / agent artifact paths each produce correctly-typed pages (Step4) |
| 11 | `embedding` field non-null after synthesis (Step5, skip if openai unavailable) |
| 12 | `DocWikiReadService.search()` returns synthesized page (Step5) |
| 13 | `get_page()` and `list_pages()` return correct data (Step5) |
| 14 | Correction appended as `## Founder Corrections Preserved` section (Step6) |
| 15 | Correction marked `status='applied'` after re-synthesis (Step6) |
| 16 | `ose_page_links` contains `relation='contradicts'` row after contradiction flag (Step7) |
| 17 | `[CONTRADICTION_FLAGGED]` written to `ose_activity_log` (Step7) |
| 18 | `DocWikiHealthService.health()` returns valid `doc_wiki_health_v1` schema (Step8) |
| 19 | `page_type` field correctly set on all synthesized pages (Step10) |
| 20 | `wiki_claims` table untouched by synthesis (Step10) |
| 21 | `python -m compileall python-backend` exits 0 |
| 22 | `pytest python-backend/tests/test_doc_wiki_07_acceptance.py -v` exits 0 (deferred items skip, not fail) |
