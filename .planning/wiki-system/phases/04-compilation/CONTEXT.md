# Sub-phase 04 Context — Compilation

**Date:** 2026-06-30
**Outcome:** Ready to execute. D15 is resolved (FastAPI executes, n8n triggers — CONTEXT §3/§8), the
extraction is done (`04-RESEARCH.md`), the contract is frozen, and the schema is live. This sub-phase
builds the **single compilation service** and the **read path** that serves what it produces.

---

## What this sub-phase is

The first sub-phase that makes the wiki *produce and serve* compiled knowledge. It builds:
- `compile_page(user_id, page_key)` — the **only** writer of `class='compiled'` claims (L2), holding
  the service-role transaction + the `app.wiki_compilation_service` marker the write-lock requires.
- `rebuild_digest(user_id)` — writes the `wiki_digest` row to the contract shape.
- the event→rebuild wiring (n8n triggers → FastAPI endpoint) over the verified §F source tables.
- the **read handlers** filling the 02 stubs (`wiki_get_page/get_claim/search/search_insight/read_digest`,
  `global_ip_get`) + the read seams (`AgentContextBuilder` loaders, `GlobalIpReadService`).

---

## Inputs the agent must read first

1. `04-RESEARCH.md` (this folder) — build-ready extraction + the D15 runtime architecture + write-lock mechanism.
2. `04-01-PLAN.md` (this folder) — task spec, the §F event→rebuild table map, success criteria.
3. `../02-interface-contract/02-01-CONTRACT.md` — read-op signatures + the named seams to implement.
4. `../03-schema-foundation/` — the live schema; `compile_page` writes `wiki_claims`/`wiki_evidence`/
   `wiki_pages`/`wiki_digest`; the schema object's `event_rebuild_targets` is `{}` to fill.
5. `../../CONTEXT.md` §8 — D15 resolution, the write-lock marker, GM tables, 5-stage model.
6. `../01-verify-delta/01-01-DELTA.md` §A (GM join), §F (Tier 0 source tables per page).
7. The existing FastAPI services (`sub_agent_orchestrator.py`, `agent_context.py`, `structured_query.py`,
   `vector_store.py`) — reuse retrieval/embedding primitives; do not re-implement (DRY = the L2 rationale).

---

## Decisions already made (do not re-open)

- **FastAPI executes** compile/digest/read; **n8n triggers** (D15 resolved).
- Write-lock: set `app.wiki_compilation_service='on'` transaction-local, service-role, same transaction as compiled writes.
- `compile_page` regenerates **only** `class='compiled'`; insight + override survive.
- Read precedence override > compiled > insight; class/trust visible; quarantined insight non-assertable.
- `GlobalIpReadService` is the global/GM read path (service-role); GM family referenced via the §A join, not recreated.
- Embeddings: OpenAI text-embedding-3-small, vector(1536), refreshed on every compile.

---

## What this sub-phase does NOT do

- No write surface (`propose_insight_claim`, `add_override`, `promote_insight`, …) — that is 05.
- No validation/health checks (06), no consolidation/dreaming (07).
- No UI. No founder-facing surfaces.
- No file-based digest/cache or markdown pages (no reference-repo substrate).

---

## Files to be created or modified

| File | Action | Notes |
|---|---|---|
| `python-backend/services/wiki_compilation.py` (or similar) | **Create** | `compile_page`, `rebuild_digest`, the transaction + write-lock marker. |
| `python-backend/services/global_ip_read.py` | **Create** | `GlobalIpReadService.get` / `.get_checkpoints` (the §A GM join). |
| `python-backend/services/sub_agent_orchestrator.py` | **Modify** | Replace the `per_user_wiki` / `global_ip` stubs with real `_handle_*`. |
| `python-backend/services/agent_context.py` | **Modify** | Add wiki/global-IP scope keys + loaders. |
| `python-backend/main.py` (+ router) | **Modify** | The `compile_page` endpoint n8n calls. |
| schema object `event_rebuild_targets` | **Modify** | Populate from the §F map. |
| n8n | **Trigger only** | Watch §F tables / platform events → call the endpoint. (Wiring documented; not wiki-table writes.) |

---

## Success criteria (from `04-01-PLAN.md`)

1. `compile_page` regenerates only compiled-base claims; insight + override survive untouched.
2. Every compiled claim carries ≥1 evidence row with a real `source_id`; no evidence-less claims.
3. Write-lock holds: only `compile_page` (service-role + marker) writes `class='compiled'`.
4. Embeddings refresh on every compile (pages + compiled claims).
5. Each event in the §F map rebuilds the correct page(s), eagerly; empty sources → thin page, no error.
6. Digest reflects the latest compile.
7. Read handlers return contract-shaped results with correct precedence + visible class/trust.
8. The D15 trigger/host split is implemented as written (FastAPI executes, n8n triggers).

---

## Handoff

When compile + read are working end-to-end (event → compiled page with evidence → `wiki_get_page`/
`wiki_search` return it → digest current), the strategy thread opens **sub-phase 05 (write-back)** —
the write surface + domain-agent write-back, with its own extraction pass (B6 mutations, B5 flush, B4/B3).

*Context written: 2026-06-30 — Discuss/Plan thread, D15 resolved.*
