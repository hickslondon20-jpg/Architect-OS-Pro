# Sub-phase 07 — Context: Acceptance Harness

**Phase:** 07 — End-to-End Acceptance
**Status:** Ready for execution
**Verify-pass date:** 2026-06-30

---

## What This Phase Is

The Layer 2 acceptance harness. Proves all five ROADMAP acceptance criteria against the
live Supabase project before declaring Layer 2 done in isolation. After this phase passes,
Layer 2 is complete and ready for the connection phase (routing into Virtual CSO + retrieval
router).

---

## Verified Inputs

| Asset | State |
|---|---|
| `DocWikiSynthesisService` | ✅ built — sub-phase 03 |
| `DocWikiDocumentAdapter`, `DocWikiSprintAdapter`, `DocWikiCSOThreadAdapter`, `DocWikiAgentArtifactAdapter` | ✅ built — sub-phases 03/04 |
| `DocWikiReadService` (`search`, `get_page`, `list_pages`) | ✅ built — sub-phase 05 |
| `match_ose_knowledge_pages` RPC | ✅ SQL written — NOT YET APPLIED to live DB |
| `DocWikiHealthService` | ✅ built — sub-phase 06 |
| `ose_page_corrections` + `ose_activity_log` tables | ✅ SQL written — NOT YET APPLIED (idempotent — apply safely) |
| `LogView.tsx` ICONS registry | ✅ fixed — sub-phase 06 |
| Existing `tests/conftest.py` | ✅ env loading + auth user pattern established |
| `python-backend/tests/test_wiki_08_acceptance.py` | ✅ Layer 1 harness — pattern reference |
| Supabase project ID | `pwacpjqkntnovndhspxt` |

---

## Bug Found During Verify Pass (Fix Required in This Phase)

**`_flag_contradictions()` does not write to `ose_page_links`.**

`DocWikiHealthService.health()` queries `ose_page_links.relation='contradicts'` for
`contradiction_count`, but `_flag_contradictions()` only writes to `ose_activity_log`.
Result: `contradiction_count` is always 0 even when contradictions are flagged.

**Fix:** Add an `ose_page_links` upsert in `_flag_contradictions()` with
`relation="contradicts"`. See `07-RESEARCH.md §5` for the exact code.

**File to modify:** `python-backend/services/doc_wiki_synthesis.py`

---

## Files This Phase Touches

| File | Action | Notes |
|---|---|---|
| `python-backend/tests/test_doc_wiki_07_acceptance.py` | CREATE | Full acceptance harness (22 tests + 2 deferred skips) |
| `python-backend/services/doc_wiki_synthesis.py` | MODIFY | Bug fix: `_flag_contradictions()` upserts to `ose_page_links` |

Migrations are applied to the live Supabase project as a pre-flight step (not code changes):
- `docs/migrations/20260630_docwiki_page_search.sql` → apply via Supabase MCP
- `docs/migrations/20260630_docwiki_corrections_log.sql` → apply via Supabase MCP

---

## Out of Scope

- The Layer 1 `tests/conftest.py` — do not modify
- Adding stale-pages check to `DocWikiHealthService` — deferred post-beta
- Real Claude synthesis smoke — deferred (skip in harness)
- Real embedding quality validation — deferred (skip in harness)
- CSO / retrieval router wiring — that is the connection phase
- Any frontend changes

---

## Key Constraints

- **Mock Claude, not Supabase** — real Supabase writes for all tests; mock `_call_synthesis_claude`
- **Test auth user isolation** — all writes scoped to `docwiki07-acceptance@architectos.internal`
- **`dw_` prefix for all fixtures** — avoids name conflicts with conftest.py session fixtures
- **Cleanup by user_id** — delete from doc wiki tables by the test user UUID, in FK order
- **Do not apply migrations in test code** — migrations are pre-flight only
- **`compileall` must pass** before running pytest
- **Deferred items skip, not fail** — two `@pytest.mark.skip` tests are acceptable exits

---

## ROADMAP Acceptance Criteria

| AC | Text | Proven by |
|---|---|---|
| AC1 | Source event → page with `page_kind`, `source_file_ids`, `canonical_key` dedup | Step2 + Step4 |
| AC2 | Page embedded + returned by page-search tool | Step5 |
| AC3 | Founder correction preserved across re-synthesis | Step6 |
| AC4 | Contradictions flagged; health surfaces orphans; log records events; UI shells ready | Step7 + Step8 + Step9 |
| AC5 | Layer-1 bridge (`ose_page_type`) exposes pages without duplicating claims | Step10 |

---

## Success Criteria (22 checks)

| # | Criterion |
|---|---|
| 1 | Both migrations applied to live Supabase project |
| 2 | `match_ose_knowledge_pages` RPC callable without error |
| 3 | `ose_page_corrections` table readable |
| 4 | `ose_activity_log` table readable |
| 5 | Synthesis creates page in `ose_knowledge_pages` |
| 6 | Page has correct `page_kind`, `canonical_key`, `page_title`, `page_type` |
| 7 | `[SYNTHESIS_COMPLETE]` in `ose_activity_log` |
| 8 | `connected_pages` updated in `ose_raw_document_registry` |
| 9 | Re-synthesis updates page, not creates duplicate |
| 10 | Sprint / CSO thread / agent artifact paths each produce correctly-typed pages |
| 11 | `embedding` non-null after synthesis (skip if OpenAI unavailable) |
| 12 | `DocWikiReadService.search()` returns synthesized page |
| 13 | `get_page()` and `list_pages()` return correct data |
| 14 | Correction appended as `## Founder Corrections Preserved` section |
| 15 | Correction marked `status='applied'` after re-synthesis |
| 16 | `ose_page_links` contains `relation='contradicts'` row |
| 17 | `[CONTRADICTION_FLAGGED]` in `ose_activity_log` |
| 18 | `DocWikiHealthService.health()` returns valid `doc_wiki_health_v1` schema |
| 19 | `page_type` field correctly set on synthesized pages |
| 20 | `wiki_claims` table untouched by synthesis |
| 21 | `python -m compileall python-backend` exits 0 |
| 22 | `pytest ... -v` exits 0 (deferred items skip, not fail) |
