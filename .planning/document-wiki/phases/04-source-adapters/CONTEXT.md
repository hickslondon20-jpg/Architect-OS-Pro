# Sub-phase 04 — Source Adapters: Context

**Sub-phase:** 04 — Sprint-history, CSO-thread, and Domain-agent-artifact adapters
**Opened:** 2026-06-30
**Status:** Open — ready for execution agent

---

## Inputs to read before building (in order)

1. `.planning/document-wiki/CONTEXT.md` — locked decisions + §8 amendments
2. `.planning/document-wiki/phases/02-page-contract-schema/02-01-CONTRACT.md` — page object spec, §J hard guarantees
3. `src/config/doc_wiki_schema.json` — page_kind vocabulary (14 kinds), kind_to_category, kind_to_page_type maps
4. `python-backend/services/doc_wiki_synthesis.py` — `DocWikiSynthesisService`, `DocWikiDocumentAdapter`, `SourcePayload`, `SynthesisResult`, `ChunkRef` dataclasses, `_is_source_worthy()`, `_upsert_page()`, `_canonical_key()` helpers
5. `python-backend/core/doc_wiki_config.py` — config loader
6. `python-backend/main.py` — `DocWikiSynthesizeRequest`, `_process_ingestion()` hook pattern, existing `/api/doc-wiki/synthesize-document` and `/api/doc-wiki/job/{id}` endpoints
7. `04-RESEARCH.md` — verified source schemas, page assembly specs, endpoint specs, hard rules
8. `python-backend/core/config.py` — Supabase client / settings pattern

---

## What this sub-phase owns

Build three new adapter classes on the existing `DocWikiSynthesisService` framework:

**1. `DocWikiSprintAdapter`** (`python-backend/services/doc_wiki_sprint_adapter.py`)
- Reads `sp_sprint_goals` + `sp_sprint_initiatives` + `sp_sprint_milestones`
- Produces two page kinds per sprint close event:
  - `sprint_history` — one per sprint (creates/updates on each call)
  - `capability_evolution` — one per capability_id, accreting across quarters (reads
    existing page content before re-synthesizing so history is preserved/extended)
- Manual endpoint: `POST /api/doc-wiki/synthesize-sprint`

**2. `DocWikiCSOThreadAdapter`** (`python-backend/services/doc_wiki_cso_thread_adapter.py`)
- Reads `vcso_chat_threads` + `vcso_chat_messages`
- Produces `thread_synthesis` pages for substantive threads
- Updates `vcso_chat_threads.synthesis_status` to `'completed'` or `'skipped'` after each attempt
- Manual endpoints: `POST /api/doc-wiki/synthesize-thread` and `POST /api/doc-wiki/synthesize-pending-threads`

**3. `DocWikiAgentArtifactAdapter`** (`python-backend/services/doc_wiki_agent_artifact_adapter.py`)
- Reads `agent_delegation_runs` + `agent_delegation_steps` + `agent_context_sources`
- Produces `agent_artifact` pages for completed, page-worthy runs
- Manual endpoint: `POST /api/doc-wiki/synthesize-agent-artifact`

Plus all supporting Pydantic request models and `main.py` endpoint wiring.

---

## What this sub-phase does NOT own

- Live auto-trigger hooks (sprint close event, thread session-end event, run completion
  event) — activation-gated, not wired here
- Page embeddings (pgvector) — sub-phase 05
- Corrections lifecycle and health/lint — sub-phase 06
- End-to-end acceptance harness — sub-phase 07
- Any new Supabase migrations — none required

---

## Files to create / modify

**New files:**
```
python-backend/services/doc_wiki_sprint_adapter.py
python-backend/services/doc_wiki_cso_thread_adapter.py
python-backend/services/doc_wiki_agent_artifact_adapter.py
```

**Modified files:**
```
python-backend/main.py    — add 3 new Pydantic models + 4 new endpoints (3 single + 1 batch)
```

---

## Success criteria (done-when)

1. `DocWikiSprintAdapter` class exists with `synthesize_from_sprint(sprint_goal_id, user_id)` method
2. Sprint adapter joins `sp_sprint_goals` → `sp_sprint_initiatives` → `sp_sprint_milestones` correctly
3. Sprint adapter page-worthiness gate: skips sprints with no initiatives having `outcome_statement` or `binary_done_definition`; skips status='draft' sprints
4. Sprint adapter produces a `sprint_history` `SourcePayload` with correct `canonical_key` = `sprint_{quarter}_{sprint_goal_id_short8}`
5. Sprint adapter reads existing `capability_evolution` page content before re-synthesizing; passes old content in metadata so Claude can extend rather than overwrite history
6. Sprint adapter produces a `capability_evolution` `SourcePayload` per unique `capability_id` in the sprint's initiatives
7. `DocWikiCSOThreadAdapter` class exists with `synthesize_from_thread(thread_id, user_id)` method
8. CSO thread adapter reads `vcso_chat_messages` ordered by `created_at`; assembles role/content transcript
9. CSO thread adapter page-worthiness gate: `message_count >= 4` AND at least one assistant message `len >= 200`; sets `synthesis_status='skipped'` on gate failure
10. CSO thread adapter sets `synthesis_status='completed'` on `vcso_chat_threads` after successful synthesis
11. `DocWikiAgentArtifactAdapter` class exists with `synthesize_from_run(run_id, user_id)` method
12. Agent artifact adapter page-worthiness gate: `status='completed'`, `result_summary` length >= 150, `confidence >= 0.5`
13. All three adapters use `DocWikiSynthesisService.synthesize()` — no direct Supabase writes to `ose_knowledge_pages`
14. `main.py` has Pydantic models `DocWikiSynthesizeSprintRequest`, `DocWikiSynthesizeThreadRequest`, `DocWikiSynthesizeAgentArtifactRequest`
15. `main.py` exposes `POST /api/doc-wiki/synthesize-sprint`, `POST /api/doc-wiki/synthesize-thread`, `POST /api/doc-wiki/synthesize-agent-artifact`, `POST /api/doc-wiki/synthesize-pending-threads`
16. `page_kind` values used: `sprint_history`, `capability_evolution`, `thread_synthesis`, `agent_artifact` — all present in `src/config/doc_wiki_schema.json`
17. `python -m compileall python-backend` passes with zero errors
18. `Pro-Suite-Progress.md` updated to reflect sub-phase 04 status
