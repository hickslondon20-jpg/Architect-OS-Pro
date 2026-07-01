# Phase 8 Context: Intelligence Layer Connection

> Produced by: Discuss & Plan Orchestration Agent
> Date: 2026-06-30
> Status: Planning complete — artifacts authored; execution agent thread pending

---

## Why Phase 8 Was Re-scoped

The original Phase 8 spec in `.planning/ROADMAP.md` was titled "Compiled Wiki — Business
Knowledge Layer." Its goal was to build the per-founder synthesized wiki from scratch.

That work is now substantially done:
- **Layer 1** (`WikiCompilationService`) compiles structured platform data (Tier 0) into
  synthesized wiki pages, writes to `wiki_pages` + `wiki_claims`, and has an acceptance
  harness (sub-phase 07, 27 passed / 4 skipped).
- **Layer 2** (`DocWikiSynthesisService`) compiles uploaded documents and conversation
  threads into emergent wiki pages, writes to `ose_knowledge_pages`, and shares the
  table with the Virtual CSO read path.

Phase 8 as an execution phase is now about **wiring** the built layers into the surfaces
that need them — not building the wiki from scratch.

The re-scoped Phase 8 has two tasks:

| Task | What | Why |
|---|---|---|
| **8A** | Add wiki tools to `KbExplorerService` | KB Explorer can navigate raw documents but cannot query synthesized wiki knowledge. Adding 3 wiki tools (`wiki_search`, `wiki_get_page`, `wiki_list`) gives Claude access to both layers during an exploration loop. |
| **8B** | Mirror Layer 1 pages into `ose_knowledge_pages` | Layer 1 writes to `wiki_pages`/`wiki_claims`. The Virtual CSO reads only `ose_knowledge_pages`. 8B closes the gap by projecting compiled Layer 1 page content into `ose_knowledge_pages` after each successful compile. |

Phase 8C (semantic selection in `chat.ts`) is deferred to Phase 9 strategy.

---

## Architectural Decision: Option B

During the connection-point verify pass (2026-06-30), the strategy thread presented two
options for making Layer 1 visible to the Virtual CSO:

- **Option A (Pragmatic):** Add a second read path to `loadFounderContext()` in `chat.ts`
  that queries `wiki_pages`/`wiki_claims` directly alongside the existing `ose_knowledge_pages`
  query. No Layer 1 changes needed.

- **Option B (Canonical):** Project compiled Layer 1 page content into `ose_knowledge_pages`
  at compile time. Both wiki layers land in one table. `loadFounderContext()` unchanged.

London confirmed **Option B** with explicit rationale:

> "I'm fine with needing to go back and revise things to work once we go live and we
> notice that it might not be firing as intended, but that's a maintenance, not a
> from-scratch element. So, let's move forward with that directional philosophy."

The philosophy: build it right for the long term. Option B means the Virtual CSO has one
loading path, one table, one scoring function. Anything that goes into `ose_knowledge_pages`
— Layer 1 or Layer 2 — surfaces automatically. Option A would create divergent paths that
need to be reconciled later.

---

## How This Connects to INTELLIGENCE-VISION.md

The four-tier architecture defined in `.planning/INTELLIGENCE-VISION.md`:

- **Tier 0:** Platform data (Supabase tables) — DONE
- **Tier 1:** Compiled wiki (per-founder synthesized knowledge) — Layer 1 + Layer 2 BUILT; Phase 8 WIRES it to surfaces
- **Tier 2:** Semantic / vector search (pgvector) — EXISTS; 8C will upgrade to semantic selection
- **Tier 3:** Raw document explorer (KB Explorer) — DONE via Phases 1–7; Phase 8A adds wiki tool access

After Phase 8, Tier 1 knowledge is accessible from three paths:
1. **Virtual CSO** (`chat.ts`) — reads `ose_knowledge_pages` directly (Layer 2 always, Layer 1 after 8B)
2. **KB Explorer sub-agent** — can call `wiki_search`, `wiki_get_page`, `wiki_list` tools
3. **Sub-agent orchestrator** — `_handle_per_user_wiki()` (Layer 1) and `_handle_per_user_document_wiki()` (Layer 2) both wired

---

## What Phase 8 Unlocks

**Phase 9 (Retrieval Router)** depends on Phase 8 being complete. The router needs:
- A populated Tier 1 to route to — that's Phase 8's output
- The `match_ose_knowledge_pages` RPC already exists for semantic search
- Intent classification logic in `chat.ts` to determine which tier(s) to use

Phase 9 can begin scoping immediately after Phase 8 execution is confirmed complete.

---

## What Phase 8 Does NOT Change

- No changes to `wiki_pages`, `wiki_claims`, `wiki_evidence`, `wiki_action_log` — Layer 1
  continues writing to these tables as before. The projection is additive.
- No changes to `sub_agent_orchestrator.py` — the orchestrator is already fully wired.
- No changes to `wiki_read.py` or `wiki_writeback.py`.
- No Supabase migrations required — `ose_knowledge_pages` has no check constraint on
  `page_type`. Adding `"compiled_intelligence"` requires only the schema JSON update.
- `loadFounderContext()` in `chat.ts` is NOT changed (this is the Option B win).

---

## Deferred Items Established in This Phase

| ID | Item | Condition to remove deferral |
|---|---|---|
| DL-L1-EMBED | Embed Layer 1 projected pages in `ose_knowledge_pages` | Embedding service available (same gate as DL-01) |
| 8C | Semantic selection upgrade in `selectFounderPages()` | DL-L1-EMBED done; Phase 9 scoping complete |

---

## Files Modified by Phase 8

| File | Change |
|---|---|
| `python-backend/services/kb_explorer_service.py` | + `self.store` on `__init__`; + 3 wiki tools in `KB_EXPLORER_TOOLS`; + 3 dispatch branches in `_execute_tool()`; updated `KB_EXPLORER_SYSTEM_PROMPT` |
| `python-backend/services/wiki_compilation.py` | + `_project_to_ose()` method; + 1 call in `compile_page()` |
| `src/config/doc_wiki_schema.json` | + `wiki_layer1` in vocabulary + mappings |
| `api/vcso/chat.ts` | + 6 Layer 1 page keys to `CORE_PAGE_KEYS` |
| `.planning/ROADMAP.md` | Phase 8 row updated: re-scoped + in-progress |
| `Pro-Suite-Progress.md` | Phase 8 row added on completion |

---

## §1 Session Log

| Date | Event |
|---|---|
| 2026-06-30 | Connection-point verify pass complete; Layer 1 / Virtual CSO gap confirmed |
| 2026-06-30 | Option B architectural decision confirmed by London |
| 2026-06-30 | Phase 8 re-scoped to Intelligence Layer Connection (8A + 8B + CORE_PAGE_KEYS fix) |
| 2026-06-30 | Phase 8 planning artifacts authored; execution agent thread pending |
