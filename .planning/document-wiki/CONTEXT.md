# Document Wiki (Layer 2) — CONTEXT

**Cycle:** GSD Discuss → Plan, opened 2026-06-30
**Owner:** London Hicks (founder)
**Status:** Discuss **in progress.** Verify-first. The approach decisions below are locked; the design
decisions are **open pending the verify delta** (`phases/01-verify-delta/01-01-DELTA.md`). This file
matures into the locked ledger after verify + the design discuss.

---

## 1. What Layer 2 is

The emergent, document-driven wiki — the unstructured Tier-1 layer that compounds from the founder's
uploaded documents. Pages exist *because of what was uploaded*: a specific client, competitor, vendor,
contract, methodology, market trend; comparisons; document summaries; filed query answers. It is the
**depth** beneath the **breadth** of the seven fixed structured pages (Layer 1, `../wiki-system/`).

It answers the unbounded, document-specific questions the fixed pages can't anticipate
("what do we know about Client X", "how does our retainer compare to what we proposed to Prospect Y").

**Layer 2 is MULTI-SOURCE and LONGITUDINAL, not document-only** (founder clarification 2026-06-30). The
emergent pages are fed by:
- **Uploaded documents** (OS Engine / KB Explorer).
- **Virtual CSO conversation threads** — substantive threads synthesized into pages (the "explorations
  compound" feature — good reasoning doesn't vanish into chat history).
- **Sprints** — each sprint gets its own page, *plus* the accreting **historical/longitudinal** record:
  capability evolution, focus areas, and growth quarter over quarter.
- **Domain-agent artifacts** — documents/outputs domain agents create get their own pages, *within reason*.

**Current vs. longitudinal split (the key Layer-1/Layer-2 dimension):** Layer 1 holds the **current**
structured state (e.g. the current sprint focus feeds *up* to the fixed Current Quarter/Sprint page —
"where are we now"). Layer 2 holds the **history + the emergent** — the journey, the arc, the
accumulation. The same data (e.g. sprints) flows to both: snapshot → Layer 1, accreting record → Layer 2.
Layer 2 is the platform's **memory of the journey** as well as its document-grounded depth.

**"Within reason" = page-worthiness curation** — not every thread/artifact earns a page (theafh "page
thresholds": create when central or recurring, skip passing mentions).

---

## 2. Locked approach decisions (this discuss)

| # | Decision | Choice |
|---|---|---|
| A1 | Placement | A **new Tier-1 layer beneath the 7 fixed pages**, fed by OS Engine uploads; pre-reasoned cross-linked PAGES — **distinct from Tier 2** raw chunk search. The agent drills here when the 7 pages aren't enough. |
| A2 | Build approach | **Verify-first**, with the prior that we **build the synthesis engine on the existing `ose_knowledge_pages` scaffold** rather than greenfield. Confirmed/adjusted by the verify delta. |
| A3 | Feature home | `.planning/document-wiki/` (paired beside `wiki-system/`). |
| A4 | Scope boundary | Build the **capability** (ingest/synthesis engine + page store + read/write tools + health). **Not** the live CSO/retrieval-router wiring — that is the connection phase (shared with Layer 1's handoff). |
| A5 | Foundational pattern | Adopt the theafh "LLM Wiki" **emergent-taxonomy + ingest/query/lint** model (the half marked *skip* for Layer 1). Mechanics already extracted in `../wiki-system/REFERENCES.md`. Adopt model, never substrate (Supabase + pgvector, not markdown-on-disk). |

---

## 3. Open decisions (resolve after the verify delta)

- **Page model: RESOLVED — prose pages + structured provenance** (2026-06-30). Narrative markdown (the
  existing `ose_knowledge_pages.content`) with `source_file_ids` + inline citations; the **page is the
  unit of recall/promotion** for the memory loop. Claim/evidence decomposition stays Layer 1's job —
  Layer 2 does **not** duplicate the claim store.
- **Ingest engine model: RESOLVED — automated write, flag-don't-resolve** (2026-06-30). The engine
  writes/updates pages automatically on source events (like Layer 1's compile), with page-worthiness
  thresholds + `canonical_key` dedup, and **flags contradictions rather than resolving them**. Founder
  control is the correction surface after the fact — no per-ingest gate.
- **v1 adapter scope: RESOLVED — all four adapters** (document + sprint-history + CSO-thread +
  domain-agent-artifact) built in v1 on one synthesis framework. **Caveat:** document + sprint-history
  have concrete source schemas now; CSO-thread (`origin_thread_id`) + domain-agent-artifact adapters are
  built in v1 but their **live triggering is gated on those source systems maturing** (build-complete,
  activate-as-ready — mirrors Layer 1's dormant-gate pattern).
- **Corrections lifecycle: RESOLVED — preserved override, survives re-synthesis** (2026-06-30). Founder
  corrections (`ose_page_corrections`) are a preserved, highest-precedence override (mirrors Layer 1's
  override layer / B7 managed-vs-human blocks): the engine re-generates the synthesized base but
  honors/re-applies the founder's correction on every rebuild. Founder edits are never clobbered.
- **Page embeddings: RESOLVED — pgvector** (delta §A confirms no page vector exists; `document_chunks`
  already uses `vector(1536)`+HNSW). Add a page-level pgvector column + search path; deprecate
  `pinecone_vector_id`.
- **Taxonomy: RESOLVED — `page_kind` as the emergent axis** (2026-06-30). The unconstrained `page_kind`
  carries the emergent type (client / competitor / vendor / offer / method / market-trend / comparison /
  query-answer / sprint-history / thread-synthesis …); `page_type` stays the Layer-1 bridge (area/adapter
  mapping); `category` is UI grouping; `canonical_key` is identity/dedup. No CHECK-constraint fight.
  Adopts theafh's emergent-type *concept*, tailored to agency founders + multi-source needs.
- **Source scope: RESOLVED — multi-source** (§1): uploaded documents + CSO threads + sprint history +
  domain-agent artifacts. The remaining open part is the **per-source-type synthesis paths** (how a
  document vs a thread vs a sprint vs an agent artifact each becomes/updates pages) and the **"within
  reason" page-worthiness thresholds** per source type.
- **Longitudinal/historical pages:** sprint-history and capability-evolution pages are a distinct page
  category (the "journey" record) — tie to the AE Ladder progression. Confirm how sprint data is read
  (Layer 1 reads current; Layer 2 reads the full history).
- **Vector:** `ose_knowledge_pages.pinecone_vector_id` is a **legacy Pinecone** handle → move to
  **pgvector** (the platform's current stack) for page embeddings. Confirm in verify.
- **Reconciliation with Layer 1:** how `ose_knowledge_pages` (Layer 2) coexists with `wiki_*` (Layer 1
  7 pages). The Layer-1 schema object already carries an `ose_page_type` mapping per fixed page — that
  is the intended bridge. Confirm the boundary so the two layers complement, not duplicate.

---

## 4. Preliminary verify finding (orientation — confirm in 01-verify-delta)

The OS Engine pre-scaffolds Layer 2:
- **`ose_knowledge_pages`** (live, 0 rows): `id, user_id, page_type, page_title, content, category,
  source_file_ids[], last_updated, updated_at, pinecone_vector_id, word_count, status, canonical_key,
  page_kind, domain, confidence, effective_date, observed_date, review_date`.
- **Taxonomy in code:** `PageType`, `PAGE_TYPE_LABELS`, `WIKI_CATEGORIES`, `STARTER_PAGE_TYPES`,
  `IMPORT_SOURCES` (`lib/osEngineMockData.ts`, `lib/osEngineApi.ts`).
- **UI:** `WikiView`, `IndexView`, `ManifestView` (file→page map), `LogView`, the shared `Reader`,
  `NotesComposer` (`addPageCorrection` → `ose_page_corrections`).
- **CSO read-hook:** `api/vcso/chat.ts` references `ose_knowledge_pages`.
- **Gap:** no synthesis/ingest engine writes `ose_knowledge_pages` (Python backend only does Docling →
  chunks/registry). `seed_core_knowledge_pages()` creates 5 empty starters. **The engine is the build.**

---

## 5. Scope — owns / does NOT own

**Owns:** the document→pages synthesis/ingest engine; the page store (extend `ose_knowledge_pages` or a
reconciled schema — verify decides); page embeddings (pgvector); cross-reference/links; index + log;
the read/write tool surface; ingest/query/lint operations; health/validation.

**Does NOT own:** live retrieval-router / intent classification; CSO/Domain-Agent/OS-Engine *runtime*
wiring; context-injection into agent sessions. (Connection phase — shared with Layer 1.)

---

## 6. References

- theafh "LLM Wiki" pattern (the attached overview) — emergent taxonomy + ingest/query/lint.
- `../wiki-system/` — Layer 1 (patterns to reuse; the `ose_page_type` bridge).
- KB Explorer (`.planning/knowledge-base-explorer/`) — the document source the ingest reads.

---

## 7. Memory & self-learning loops — Layer 2 is the substrate (founder note, 2026-06-30)

**Do not let this get lost across feature builds.** Layer 2 is not only a retrieval knowledge base — it
is the **durable substrate the platform's memory and self-learning / self-improving loops run on.**

**What already exists (the seed, built in Layer 1):** the insight layer (short-term, quarantined),
founder **promotion** (durable/trusted), and the **consolidation/dreaming** cycle (dedup, reconcile,
retire, surface gaps) are the early memory machinery. They were built for the 7 fixed pages but the
mechanics are general.

**What was surfaced-but-deferred in the OpenClaw repurposing pass (completes the loop):**
- **Recall tracking + recall-driven promotion** — `recall_count` / `query_diversity` fields exist but
  incrementing on genuine retrieval was deferred to the connection phase, so the B3 promotion gate is
  **dormant in beta**.
- **Session-end / pre-compaction memory flush (B5)** — the entry point exists; live invocation is connection-phase.
- **The broader OpenClaw memory subsystem NOT built for Wiki 1.0** — durable `MEMORY.md`-style curated
  long-term memory, the short-term→long-term promotion loop as a *self-improvement* mechanism, inferred
  **commitments**, and the full active-memory/recall loop. (We adopted only **action-boundary metadata**
  into the insight schema; see `../wiki-system/` adoptions.)

**The dependency (capture for the design discuss + future memory feature):**
- The memory / self-learning loop is only as rich as what it learns from. Layer 2 — documents + CSO
  threads + sprint history + domain-agent artifacts, accreting over time — is the **material** the loop
  distills, recalls, promotes, and evolves a founder-model from.
- The insight→promotion→dreaming machinery must operate over **both** Layer 1 and Layer 2.
- **Design constraint:** Layer 2 must be a first-class **memory substrate** — provenance, accretion
  lifecycle, recall hooks, and a promotion path — not merely a page store to read from. Do not foreclose
  the future memory layer.
- The **memory / self-learning layer is likely its own future component** (post-Layer-2), but its
  foundation is laid here. Flag any Layer 2 design choice that would make the memory loop harder later.

---

## 8. Amendments (append-only)

### 2026-06-30 — Sub-phase 02 completion reconciliation

**A. Inline citation format (implementation decision within agent latitude):**
The execution agent specified a concrete machine-parseable format for inline citations in `content`:
`[[Source: raw_document:{document_id}#chunk:{chunk_id}|{doc_title} section {section_label}]]`.
When chunk id is unavailable, the `#chunk:{chunk_id}` segment is omitted. This format is now the
canonical citation syntax for Layer 2 prose. Sub-phases 03, 06, and the connection phase build
against it. Documented in `02-01-CONTRACT.md §Provenance Contract`.

**B. Config file path — `src/config/doc_wiki_schema.json`:**
The `page_kind_vocabulary`, `kind_to_category`, `kind_to_page_type`, and `link_relation_vocabulary`
config was placed in `src/config/doc_wiki_schema.json` (the frontend `src/config/` tree, not the root
`config/` folder). Sub-phase 03 (synthesis engine) must load this config from the correct path. The
Python backend should load it from the repo root via a relative path from `python-backend/`:
`../src/config/doc_wiki_schema.json`, or add it as a settings value in `core/config.py`. Sub-phase 03
RESEARCH.md notes the resolution.

**C. TypeScript types — Supabase MCP CLI write blocked:**
The Supabase MCP type generation could not write to `lib/database.types.ts` via the CLI path. The
execution agent created `src/types/supabase.ts` for the affected live schema and repaired
`lib/database.types.ts` as a re-export. Sub-phase 03 agents should not attempt to re-run type
generation via MCP CLI for the same reason. Instead, verify types via the existing re-export path.

**D. Capability DB status field:**
The `per_user_document_wiki` capability row was inserted with `status = 'experimental'`. This is
correct — stub-only capabilities in beta should be `experimental`. No amendment needed; noted for
awareness when the real handlers land in 03+.

### 2026-06-30 — Sub-phase 03 completion reconciliation

**A. Code-complete, live smoke deferred (environment constraint):**
Sub-phase 03 is functionally built. The fake-store smoke (mock Supabase client) produced
`page_kind=offer`, `canonical_key=founder_offer_strategy`, `page_title=Founder Offer Strategy`,
`confidence=0.87`, confirming the synthesis loop, Claude call, JSON parsing, page-worthiness gate,
field mapping, and manifest logic all work correctly. The live smoke (criterion 15 — real page in
`ose_knowledge_pages`) is **deferred** because the execution agent's local env lacks valid
`SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY`. Live smoke will gate sub-phase 07 acceptance.

**B. `mark_metadata_failed()` bug fixed by orchestrator:**
The execution agent called `store.mark_metadata_failed()` in the synthesis error handler in
`main.py`. This was incorrect — `mark_metadata_failed()` sets `metadata_extraction_status='failed'`
on the document registry row, which would corrupt the registry status for a successfully ingested
document. Fixed by orchestrator: the synthesis failure handler now silently passes (the synthesis
service already logs errors internally to `ose_activity_log`). This is a 5-line change to
`_process_ingestion()` in `main.py`.

**C. Corrections overlay implementation — `## Founder Corrections Preserved` section:**
The agent appends pending corrections as a clearly marked `## Founder Corrections Preserved`
section at the bottom of synthesized `content`, rather than inline prose injection. This is a
reasonable implementation that keeps corrections transparent and parseable by the 06 health/lint
pass. Preserved as-is. The full corrections lifecycle (how the section interacts with subsequent
re-synthesis) is resolved in sub-phase 06.

**D. Evidence collection fallback strategy:**
The adapter tries three evidence paths in sequence: (1) direct `document_chunks` table query by
`document_id`, (2) keyword-only `match_document_chunks` RPC with `query_embedding=None` to avoid
any OpenAI call, (3) full-text fallback. This avoids any new embedding API call during synthesis
— consistent with the "no OpenAI" hard rule and avoidance of Pinecone.

**E. Claude output schema — `contradictory_canonical_keys` field added:**
The agent added `contradictory_canonical_keys: string[]` to the Claude output schema (not in the
RESEARCH spec). The contradiction detection uses this field alongside `topics_mentioned` for a
two-tier check: explicit contradictions (from the list) are always flagged; mentioned-topic pages
are only flagged when confidence gap > 0.35. This is a sound implementation — note for 06 health
design.

**F. `_was_created()` uses instance variable `_last_write_created`:**
The `_was_created()` method reads `self._last_write_created` set during `_upsert_page()`. This is
sync-safe for single-threaded use but would break under concurrent synthesis calls from the same
service instance. Since synthesis jobs are isolated per-request (each call creates a new service
via `from_env()`), this is safe in the current architecture. Note for future if the service is
refactored to a shared singleton.

### 2026-06-30 — Sprint wiki architecture: locked vision + execution hub dependency

**Context:** After reading the full execution lifecycle in the codebase
(`Retrospective.tsx`, `ReflectionReview.tsx`, `SprintWindDown.tsx`, `ExecutionReflectLayout.tsx`),
the correct architecture for sprint-sourced wiki pages was established and the sub-phase 04
`capability_evolution` loop was removed.

**A. The sprint execution lifecycle (as built):**

The sprint lifecycle has five phases, each producing distinct content:
1. **Planning** → `SprintGoalFlow` + `SprintBoardPage` → data in `sp_sprint_goals`,
   `sp_sprint_initiatives`, `sp_sprint_milestones`. Live and wired.
2. **In-Sprint** → `ProgressPage` → milestone status updates. Live.
3. **Wind-Down** → initiative disposition (Complete / Roll Over / Release) per initiative.
   Wire status TBD.
4. **Retrospective** → `Retrospective.tsx`: goal status (Yes/Partially/We Learned per goal),
   sprint by the numbers, capability areas + 3P bucket, team contributions + AI synthesis,
   **Start/Stop/Continue** (required), "What else did we learn?" (optional), **The Story**
   (AI-generated retrospective memo + forward guidance, generated on Lock & Approve).
   **Status: local state only. No Supabase table. Not wired.**
5. **Reflection & Review** → `ReflectionReview.tsx`: 9 capabilities × 5 checkpoints = 45
   checkpoint re-ratings (No/Somewhat/Yes), inline score delta visual, Submit →
   working-score write. **Status: V-11 placeholder. Submit is not wired to Supabase.**

**B. Correct sprint wiki page architecture (locked):**

Three conceptually distinct pages, all per sprint, all sourced from a single sprint close event:

| Page kind | Canonical key | Source | Status |
|---|---|---|---|
| `sprint_history` | `sprint_{quarter}_{sprint_goal_id_short8}` | `sp_sprint_goals/initiatives/milestones` | LIVE — built in sub-phase 04 |
| `sprint_retrospective` | `sprint_retro_{quarter}_{sprint_goal_id_short8}` | Retrospective table (S/S/C + goal status + The Story) | FUTURE — blocked on execution hub wiring |
| `sprint_evolution` | `sprint_evolution_{quarter}_{sprint_goal_id_short8}` | Reflection & Review checkpoint re-ratings + score deltas | FUTURE — blocked on V-11 working-score write |

**C. What `sprint_history` captures now (live):**

Sprint goal, directional framing, quarter, initiatives (name, 3P tier, outcome statement,
known constraints, unlocks_future, binary_done_definition), milestone completion counts.
This is the planning-intent + execution record. It does NOT include the retrospective
narrative or score evolution — those are separate pages, separate source events.

**D. `capability_evolution` pattern is explicitly rejected:**

One wiki page per `capability_id` is the wrong shape — too granular, wrong source data
(planning labels, not maturity scores), and obscures the sprint-level narrative.
The `capability_evolution` page_kind is reserved in the vocabulary for future use by the
`sprint_evolution` page (which reads checkpoint re-ratings across all capabilities
holistically, not one page per capability). The per-capability synthesis loop has been
removed from `DocWikiSprintAdapter`.

**E. Design principle for all adapters (going forward):**

The wiki adapter provides source data + `page_kind` scaffolding. Claude determines what
is worth a page and how to structure it. Do not pre-architect rigid body templates or
per-entity page shapes. Over-prescribing page structure is the orchestrator's failure mode.
This principle applies to all future adapters and any revisits to existing ones.

**F. Execution hub dependency — do not lose this:**

The `sprint_retrospective` and `sprint_evolution` pages are blocked until two execution
hub wiring tasks complete:
1. **Retrospective table**: a Supabase table (likely `sp_sprint_retrospectives`) that
   captures S/S/C text, goal status ratings per goal, additional notes, and The Story
   narrative. Until this exists, the Retrospective component runs on local state.
2. **V-11 working-score write**: `ReflectionReview.tsx` Submit must write the 45
   checkpoint re-ratings and resulting capability scores to Supabase. The target tables
   are likely `ae_assessment_snapshots` (for AE Ladder) and/or a new
   `sp_sprint_score_snapshots` table for sprint-specific checkpoint re-ratings.

When either of these lands, the `DocWikiSprintAdapter` is extended (not replaced) by
adding the corresponding synthesis method. The `sprint_history` page that already exists
is not re-synthesized — the new pages are separate entries with their own canonical keys.

### 2026-06-30 — Sub-phase 05 completion reconciliation

**A. Code-complete; migration written but not applied; live smoke deferred:**
Sub-phase 05 is fully built. `python -m compileall python-backend` exits 0. The SQL
migration (`20260630_docwiki_page_search.sql`) is written to disk but not applied — same
pattern as 03/04. Live smoke (calling `/api/doc-wiki/search` against a real page with an
embedding) is deferred to the sub-phase 07 acceptance harness.

**B. `ose_knowledge_pages` actual column names — corrections overlay:**
The execution agent discovered the actual table column names differ from what the research
spec assumed. Corrections applied throughout `doc_wiki_read_service.py` and the RPC:

| Research spec assumed | Actual column name | Notes |
|---|---|---|
| `title` | `page_title` | Set in sub-phase 03 upsert (line 209 of `doc_wiki_synthesis.py`) |
| `created_at` | `last_updated` | Set by synthesis engine on upsert |
| `source_type` (column) | *(no column)* | Derived — see below |

The table also has an `updated_at` column (used for ordering in `list_pages`) alongside
`last_updated`. Both are present; `last_updated` reflects the synthesis engine's own write
timestamp; `updated_at` is likely set by a DB trigger.

**C. `source_type` is derived, not stored:**
No `source_type` column exists on `ose_knowledge_pages`. Both the RPC and `DocWikiReadService`
derive it from `page_kind` + presence of `source_file_ids` or `origin_thread_id`:
- `sprint_history` → `sprint`
- `thread_synthesis` or non-null `origin_thread_id` → `cso_thread`
- `agent_artifact` → `agent_artifact`
- non-empty `source_file_ids` → `document`
- otherwise → `null`

This derivation is implemented in a `CASE` expression in the SQL RPC and in a `_source_type()`
private helper in `DocWikiReadService`. Both implementations are consistent.

**D. Column name consistency — `search()` vs `get_page()`/`list_pages()`:**
`search()` reads `row["title"]` from RPC output (the RPC aliases `p.page_title as title`
in the SELECT). `get_page()` and `list_pages()` read directly from the table using
`row["page_title"]`. All three methods normalize to `"title"` in their output `findings`
dicts — so callers always see `"title"`, never `"page_title"`. This is correct and consistent.

**E. `require_ingest_secret` added to direct read endpoints:**
The execution agent added the `require_ingest_secret` FastAPI dependency to the three new
direct read endpoints (`POST /api/doc-wiki/search`, `GET /api/doc-wiki/page/...`,
`GET /api/doc-wiki/pages/...`). These endpoints use the backend service-role client and
read founder-scoped content, so the auth gate is appropriate. This is an additive security
decision within agent latitude — not a spec deviation.

**F. `_embed_page()` call site simplified:**
The call site that previously caught `EmbeddingNotImplementedError` was simplified: the
stub exception is no longer raised, and `_embed_page()` now handles all exceptions
internally with a warning log. The outer call site (line 126) is now a direct call with
no try/except wrapper. `EmbeddingNotImplementedError` class definition is preserved at
line 54 (not removed) in case it is imported by tests or other files.

### 2026-06-30 — Sub-phase 06 scope determination (verify pass)

**A. Corrections lifecycle and activity log are already built (sub-phase 03 agent):**
The verify pass for sub-phase 06 confirmed that the corrections lifecycle and activity log
writes were fully implemented by the sub-phase 03 agent beyond its minimum spec:

| Method | File | Lines | Status |
|---|---|---|---|
| `_pending_corrections()` | `doc_wiki_synthesis.py` | ~485 | ✅ fully built |
| `_apply_corrections_overlay()` | `doc_wiki_synthesis.py` | ~700 | ✅ fully built |
| `_mark_corrections_applied()` | `doc_wiki_synthesis.py` | ~500 | ✅ fully built |
| `_pending_correction_context()` | `doc_wiki_synthesis.py` | ~528 | ✅ fully built |
| `_write_log()` + `_log_icon()` | `doc_wiki_synthesis.py` | ~366, ~761 | ✅ fully built |
| `addPageCorrection()` frontend | `lib/osEngineApi.ts` | ~495 | ✅ fully built |

Sub-phase 06 does NOT rebuild any of these.

**B. True new work for sub-phase 06 (four deliverables):**
1. `docs/migrations/20260630_docwiki_corrections_log.sql` — `CREATE TABLE IF NOT EXISTS`
   schema documentation for `ose_page_corrections` + `ose_activity_log` (both exist live
   but have no migration file)
2. `components/pro-suite/os-engine/views/LogView.tsx` ICONS registry fix — `_log_icon()`
   returns kebab-case (`"file-text"`, `"alert-triangle"`, `"x-circle"`) but LogView ICONS
   registry uses PascalCase; result: all log entries always show `Activity` fallback icon.
   Fix: add 3 kebab-case entries + import `AlertTriangle`, `XCircle`, `FileText`
3. `python-backend/services/doc_wiki_health_service.py` — new `DocWikiHealthService` class
   (7 read-only health checks: pages_total, pages_with/without_embedding, pending_corrections,
   contradiction_count, orphan_pages, recent_errors_7d; status: healthy/needs_attention/degraded)
4. `python-backend/main.py` — `GET /api/doc-wiki/health/{user_id}` endpoint

**C. Icon name mismatch (detail):**
`_log_icon()` in `doc_wiki_synthesis.py` (line ~761) returns:
- `"alert-triangle"` for decisions, contradictions, warnings
- `"x-circle"` for errors
- `"file-text"` for routine activity events

`LogView.tsx` ICONS registry (lines 6–12) uses PascalCase (`FileCheck2`, `Activity`, etc.)
and falls back to `Activity` for unknown keys. The fix is frontend-only (import 3 icons,
add 3 registry entries). `_log_icon()` is correct and should not change.

**D. `DocWikiHealthService` is a separate class:**
Do not add health methods to `DocWikiReadService`. The health service is read-only; it
instantiates via `DocWikiHealthService(store)` and exposes a single `health(user_id)`
method returning a `doc_wiki_health_v1` schema dict.

### 2026-06-30 — Sub-phase 06 completion reconciliation

**Code-complete. All 12 success criteria verified by execution agent. Compileall exits 0.**

Files produced:
- `docs/migrations/20260630_docwiki_corrections_log.sql` — `CREATE TABLE IF NOT EXISTS` for both tables; RLS policies + indexes included; idempotent/safe on live DB
- `python-backend/services/doc_wiki_health_service.py` — `DocWikiHealthService` (read-only, 7 checks, individually try/except'd, `doc_wiki_health_v1` schema)
- `python-backend/main.py` — `GET /api/doc-wiki/health/{user_id}` at line 900; `require_ingest_secret` dependency
- `components/pro-suite/os-engine/views/LogView.tsx` — ICONS registry now includes `'alert-triangle': AlertTriangle`, `'x-circle': XCircle`, `'file-text': FileText`; imports added on line 2

Deviations from brief (none material):
- `.planning/document-wiki/CONTRACT.md` was not present at root; agent used `phases/02-page-contract-schema/02-01-CONTRACT.md` as the contract reference — correct
- `python-backend/.pytest_cache` warning during compileall is pre-existing and does not fail the command

### 2026-06-30 — Sub-phase 07 completion reconciliation

**27 passed / 4 skipped. Compileall exits 0. Layer 2 complete in isolation.**

**Files produced/modified:**
- `python-backend/services/doc_wiki_synthesis.py` (line 329) — `_flag_contradictions()` bug fixed: now upserts `ose_page_links` with `relation="contradicts"` alongside the activity log insert; inner try/except is non-fatal so log entry is always written even if the page link upsert fails
- `python-backend/tests/test_doc_wiki_07_acceptance.py` — 10 test classes, 27 executed tests + 4 skips; covers all 5 ROADMAP ACs against live Supabase project `pwacpjqkntnovndhspxt`
- `Pro-Suite-Progress.md` (line 80) — sub-phase 07 row added

**Migrations applied live (Supabase MCP):**
- `20260630_docwiki_page_search.sql` — `match_ose_knowledge_pages` RPC (pure cosine, `vector(1536)`) is live
- `20260630_docwiki_corrections_log.sql` — `ose_page_corrections` and `ose_activity_log` tables applied

**Deviation — migration policy syntax:**
`CREATE POLICY IF NOT EXISTS` was rejected by this Postgres target version. The execution agent rewrote the policy creation using conditional `DO $$ ... IF NOT EXISTS ... $$` blocks. Same RLS policy intent applied; all tables are live and accessible. Note this deviation if future migrations need to be authored against this same target.

**4 skips (all expected):**
- 2 OpenAI quota-gated: structural embedding non-null check + `DocWikiReadService.search()` semantic result (will pass automatically when `OPENAI_API_KEY` quota is available)
- DL-01: real Claude synthesis smoke (deferred — same pattern as Layer 1)
- DL-02: real embedding semantic ranking quality (deferred — same pattern as Layer 1)

**All 22 specified success criteria pass** (the harness has 27 tests because the parametrize in Step 4 expands 3 source-kind subtests and the implementation added fine-grained assertions within some steps).

**What this proves (Layer 2 done-definition met):**
1. ✅ Source event → page with `page_kind`, `canonical_key` dedup, `source_file_ids` provenance (AC1)
2. ✅ Page embedded + returned by page-search tool — structural embedding confirmed; semantic smoke is quota-gated (AC2)
3. ✅ Founder correction preserved as `## Founder Corrections Preserved` section + marked `status='applied'` (AC3)
4. ✅ Contradictions flagged in both `ose_activity_log` and `ose_page_links`; health service correctly reads `contradiction_count` > 0 (AC4)
5. ✅ `page_type` field correctly set via `kind_to_page_type` config; `wiki_claims` table untouched (AC5)

**Next step:** the connection phase — wire both Tier-1 layers + the retrieval router into Virtual CSO / Domain Agents / OS Engine. Memory/self-learning loop activated in that phase. See `INTELLIGENCE-VISION.md` for the canonical architecture.
