# Wiki System — Sub-phase 04 (Compilation) Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **execution agent** for Sub-phase 04 (Compilation) of the ArchitectOS Wiki System build.
You build the single compilation service and the read path that serves it, against **decided design**.
You make implementation choices (module layout, function decomposition, endpoint naming), never design
choices. If something needs a design decision beyond the inputs, **stop and flag it**.

## Orient first (read these, in order)

1. `.planning/wiki-system/phases/04-compilation/04-RESEARCH.md` — build-ready extraction. **§0 is the
   runtime contract: FastAPI executes, n8n triggers, and the write-lock marker mechanism.**
2. `.planning/wiki-system/phases/04-compilation/04-01-PLAN.md` — task spec + the §F event→rebuild map.
3. `.planning/wiki-system/phases/04-compilation/CONTEXT.md` — scope + success criteria + file targets.
4. `.planning/wiki-system/phases/02-interface-contract/02-01-CONTRACT.md` — read-op signatures + the
   named seams you now implement.
5. `.planning/wiki-system/phases/03-schema-foundation/` + `docs/migrations/20260630_wiki_schema.sql` —
   the live tables you write/read; the schema object whose `event_rebuild_targets` you populate.
6. `.planning/wiki-system/CONTEXT.md` §8 — D15 resolution, write-lock, GM tables, 5-stage model.
7. `.planning/wiki-system/phases/01-verify-delta/01-01-DELTA.md` §A (GM join) + §F (Tier 0 sources).
8. Existing FastAPI services (`sub_agent_orchestrator.py`, `agent_context.py`, `structured_query.py`,
   `vector_store.py`) — **reuse** retrieval/embedding primitives; do not re-implement.

## What you build

### Compilation (FastAPI)
- `compile_page(user_id, page_key)` — the **single writer** of `class='compiled'`. In one transaction:
  set `app.wiki_compilation_service='on'` (`set_config(..., true)`) under the service role; delete the
  page's existing `class='compiled'` claims (+ evidence via cascade); insert new compiled claims with
  `wiki_evidence` rows (`source_id, source_kind, path, lines, weight`); refresh `wiki_pages.embedding`
  + each compiled `wiki_claims.embedding` (OpenAI text-embedding-3-small, vector(1536)); update
  `last_compiled_at` / `stale=false` / `one_line`; append a `wiki_action_log` `compile` row. **Never**
  touch `class='insight'` or `class='override'`.
- `rebuild_digest(user_id)` — write the single `wiki_digest` row to the contract `digest{}` shape.
- Event→rebuild wiring: an endpoint n8n calls (per the §F map); populate the schema object's
  `event_rebuild_targets`. Empty sources → thin page, never error.
- Use theafh `executive_summary` semantics for compiled prose (`one_line`, snapshot prose); self-rating
  feeds display `confidence`. High confidence only when multi-source. SPR is post-beta — skip.

### Read path (fill the 02 stubs)
- `_handle_per_user_wiki` / `_handle_global_ip` in `sub_agent_orchestrator.py` returning
  `agent_result_v1` with citations (mirror `document_analysis_agent`).
- `wiki_get_page` (precedence override>compiled>insight, class/trust visible), `wiki_get_claim`,
  `wiki_search` (vector over compiled+insight; contested/stale affect ranking), `wiki_search_insight`,
  `wiki_read_digest`.
- `AgentContextBuilder`: add scope keys `page_keys` / `claim_ids` / `global_ip_selector` /
  `checkpoint_selector` + loaders `_load_wiki_pages` / `_load_wiki_claims` / `_load_global_ip` /
  `_load_global_checkpoints`.
- `GlobalIpReadService.get` / `.get_checkpoints` — read-only, service-role, founder-invisible;
  `get_checkpoints` uses the **01-01-DELTA §A join** and cites `source_kind='global_checkpoint'`.

## Hard constraints

- **Single writer (L2):** `compile_page` is the only path that sets the write-lock marker. Nothing else
  writes `class='compiled'`. Verify an out-of-band compiled write is still rejected.
- **Compiled-only regeneration:** insight + override claims survive every compile. Prove it with a test.
- **No write surface** (`propose_insight_claim`, `add_override`, `promote_insight`) — that is 05.
- **No validation/health (06), no consolidation (07), no UI.**
- **No substrate:** no `agent-digest.json`/`claims.jsonl` files, no markdown pages — the digest is the
  `wiki_digest` row.
- **Reuse, don't re-implement** retrieval/embedding (DRY = the reason compilation lives in FastAPI).
- Global IP read stays **service-role only**; GM family **referenced via the §A join**, not recreated.

## Done when

All eight success criteria in `CONTEXT.md` are met: fire a diagnostic-run event → Diagnostic Synthesis
compiles with evidence-bearing claims; insight/override survive; out-of-band compiled write rejected;
embeddings refresh; `wiki_get_page`/`wiki_search`/`wiki_read_digest` return contract-shaped results with
precedence + visible class/trust; digest current. Verify `python -m compileall python-backend` and a
compile→read round-trip on a seeded test user. Report back: a one-paragraph summary, the new module
names, and confirmation the write-lock single-writer guarantee held under test. Then stop — sub-phase 05
is opened from the strategy thread.
