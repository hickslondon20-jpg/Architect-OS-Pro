# Wiki System — Discuss-Phase CONTEXT (Locked Decisions)

**Cycle:** GSD Discuss → Plan, 2026-06-29
**Owner:** London Hicks (founder)
**Status:** Discuss closed. Decisions below are locked for the Phase 8 build unless
re-opened explicitly. Execution agents read this file first.

This is the decision record that grounds every sub-phase plan. Where the spec
(`ArchitectOS-Wiki-System-Spec-v1.md`, co-located in this folder) and this file differ,
**this file wins** — it captures amendments made during the Discuss cycle.

---

## 1. What this build owns vs. does not own

**Owns (the wiki as a self-contained capability):**
- Supabase schema: per-user pages (3 content classes), claims + evidence, insight
  records (trust state, action-boundary metadata, promotion-gate fields incl.
  `recall_score`), override layer, global-IP page store, per-user index + action-log,
  compiled-digest artifact, embeddings.
- The wiki schema/config object (page set, tag taxonomy, frontmatter contract,
  confidence enum, contradiction fields).
- Compilation workflows: event-triggered compiled-base generation per page type, the
  event→rebuild map, eager rebuild, embedding refresh on compile.
- Validation / health-check logic and dashboards.
- The consolidation ("dreaming") cycle — built + run internally (unlaunched).
- The wiki read/write tool surface and the **interface contract** (§4 below).

**Does NOT own (later, separate phase — roadmap Phase 9):**
- Wiring the wiki into the Virtual CSO streaming endpoint, OS Engine, or Domain Agents.
- The retrieval router / intent classifier and live tiered-retrieval behavior in chat.
- Context injection / stage-primer assembly into agent sessions.

**Acceptance for this build:** the wiki works in isolation — fire an event → a page
compiles with claims and provenance → a query returns it → the digest generates → a
health report runs → the consolidation cycle tends the insight layer. No chat wiring.

---

## 2. Locked decisions (this session)

| # | Decision | Locked choice |
|---|---|---|
| L1 | Interface contract | The read API / compiled digest / write surface in §4 is the build's **first artifact** (08-02). The connection phase consumes it. |
| L2 | Compiled-base write-lock | Compiled base is **write-locked to a single compilation service**. No agent, no write-back, no dreaming may write it. There is no `write_compiled_claim` in the agent-facing surface. |
| L3 | Confidence model | **Dual.** Each claim carries a display `confidence: high\|medium\|low` (A3) **and** a hidden machine `recall_score` (B3). Display drives founder/agent-facing surfaces; `recall_score` is the promotion pre-filter. |
| L4 | Page embedding (**amends spec D14**) | **All** per-user pages are embedded (compiled + insight), enabling `wiki_search` across the whole wiki. Deterministic page-key lookup is **retained** for fixed pages. The snapshot-number guardrail is unchanged — embedding a page for relevance never makes it a source of truth for a figure; `structured_data` still owns numbers. |
| L5 | Claim-as-unit (D17/B1) | Confirmed as the spine of the contract. Knowledge = structured claims `{id, text, status, confidence, evidence[]}`, evidence = `{source_id, source_kind, path, lines, weight, note}`. |
| L6 | Global vs per-user storage (D1/§6.5) | Separate tables. Global IP read is **service-role only** → structurally founder-invisible (a founder JWT cannot reach it). Per-user tables are RLS'd by `user_id`. |
| L7 | Dreaming in beta (D2/§6.4) | Scaffolding **built + run internally** (unlaunched). Write-scoped to the **insight layer + Open Questions only**. Never writes compiled base. Never auto-promotes. |
| L8 | Beta page set (D13/§6.6) | The fixed 7: Business Context, Diagnostic Synthesis, Current Quarter/Sprint, Growth Constraints, Financial Context, Client/Market Position, Open Questions & Unresolved Tensions. **Compiled-base-only:** Current Quarter/Sprint, Diagnostic Synthesis. **Insight-accreting:** the other five. |
| L9 | Write-back confidence bar (D11.iii) | Start the qualification gate at **`medium`**; tune during internal runs. Not a blocking value. |
| L10 | Orchestrator hosting (verify item, confirmed) | The existing FastAPI sub-agent orchestrator hosts the wiki tools with **no parallel orchestrator** (corrected from "no new plumbing"; see §8 amendment 2026-06-30 — bounded in-place handler / context-loader / source-kind additions are required) — tools register as rows in the `agent_capabilities` registry (`capability_key`, `allowed_tools`, `allowed_surfaces`, versioned `output_schema`, citations first-class), dispatched by handler. `per_user_wiki` and `global_ip` become registered capabilities; KB Explorer stays the one true agent (D6 holds). |

---

## 3. Parked — explicit open decision

**D15 host — RESOLVED 2026-06-30 (see §8): FastAPI executes, n8n triggers.** Original discussion retained below for context.

**D15 host (where compilation + dreaming execute: N8N vs FastAPI).**
Parked deliberately. The interface contract (L2) reduces this from an architecture
fork to a deployment question: because the compiled base is write-locked to a single
service, the only open question is *where that one writer runs* — not *who can write
the tables*. Resolve during planning/build of **08-05**:

- Likely convergence: **n8n owns "when"** (Supabase-change events, the event→rebuild
  map, the dreaming cron, retries/observability, the existing writeback bridge);
  **FastAPI owns "what"** (claim generation, evidence resolution, validation/lint,
  the dreaming reconcile loop) as endpoints n8n calls with thin HTTP nodes.
- Deciding criterion captured for the build: *how much is visual editability of the
  compilation logic in n8n worth, versus single-sourcing it with the orchestrator's
  retrieval + write code?* DRY/contract-consistency leans FastAPI; ops-editability
  leans n8n.
- 08-05 must be written so the synthesis logic is a callable service regardless of
  trigger, preserving the single-writer guarantee (L2).

---

## 4. The Interface Contract (first deliverable — formalized in 08-02)

The seam between this build and the later connection phase. Conforms to the existing
`agent_capabilities` registry pattern; results are `agent_result_v1`-shaped with
first-class citations.

### 4.1 Read API (deterministic page-key + semantic search — amended D14)

```
wiki_get_page(page_key)            → effective page: claims tagged by class
                                      {class: compiled|insight|override,
                                       trust: trusted|quarantined, ...}
                                      precedence pre-applied (override > compiled > insight);
                                      every claim's class/trust stays visible so the agent
                                      can reason WITHOUT asserting quarantined insight (D9)
wiki_get_claim(claim_id)           → one claim + full evidence[]
wiki_search(query, page_key?)      → semantic search across compiled + insight (L4)
wiki_search_insight(query,page_key?)→ semantic search scoped to insight layer only
wiki_read_digest()                 → the compiled digest (§4.2)
global_ip_get(domain|stage|tier|topic) → authored IP pages + checkpoint rows;
                                      service-role only; founder-invisible (L6)
```

Single-sourced data shapes (compilation writes them, the agent reads them):

```
claim    { id, page_key, text, class, status, confidence, recall_score,
           evidence[], contradictions[], updated_at }
evidence { source_id, source_kind, path, lines, weight, note }
```

### 4.2 Compiled digest (B2) — the cheap-context object (one per user wiki)

```
digest  { user_id, wiki_version, generated_at,
          pages:  [{ page_key, title, one_line, claim_count, top_claim_ids[],
                     confidence_rollup, last_compiled_at, stale }],
          top_claims: [{ claim_id, page_key, text, confidence }],
          counts: { contradictions, open_questions, low_confidence, quarantined },
          qualifiers: { overall_confidence, oldest_page_age } }
```
The per-page `one_line` **is** the A4 index entry — same artifact, two uses.

### 4.3 Write surface — narrow structured mutations only (B6), scoped by actor

```
propose_insight_claim(page_key, text, evidence[], confidence)
        → lands QUARANTINED in the insight layer; must pass D11 gates
          (about-the-business / novel / above confidence bar=medium);
          domain-agent write-back entry point, fired at session-end flush (B5)
set_claim_confidence(claim_id, confidence)
flag_contradiction(claim_id, against_claim_id|page_ref, note)
add_override(page_key, claim_id?, text)   → founder-only; highest trust
promote_insight(insight_id)               → founder-confirmation ONLY (D10/2a);
                                            NOT agent-callable; the only path
                                            quarantined → trusted; auditable + reversible (B4)
```

### 4.4 Hard guarantees the contract enforces

- Compiled base write-locked to the compilation service (L2). Only the internal
  `compile_page(page_key)` path emits compiled claims.
- Insight layer is append-only + quarantined; **reasoning-only until promoted** (D9).
- Override layer is founder-only; highest precedence.
- Promotion is the only quarantined→trusted path; founder-confirmation in beta;
  every promotion auditable + reversible via the action-log (A4/B4).
- Read precedence: **override > compiled > insight.**

---

## 5. Verify-before-build (carried into 08-01)

The platform is substantially built; assume features exist until confirmed otherwise.
08-01 produces an explicit delta against this CONTEXT before any schema is written:

1. **Checkpoint table** — the ~500-entry stage-calibrated content is `gm_checkpoint`-keyed
   (`gm_checkpoint_id`, `checkpoint_id_display` e.g. "1.1.1", `checkpoint_title_display`),
   surfaced via `lib/gm-audit.ts` — **not** `mra_checkpoints` as the spec guessed. Confirm
   the real table name(s) and whether the 5-stage AE-Ladder calibration (125 × 5 = 500) is
   physically stored or applied at query time. This determines how the stage-primer (§5 of
   spec) and `structured_data` target it.
2. **Orchestrator hosting** — confirm `python-backend/services/sub_agent_orchestrator.py`
   + the `agent_capabilities` registry can host `per_user_wiki` / `global_ip` as new
   capabilities (L10 expectation) and document any rework.
3. **Existing wiki UI** — `components/pro-suite/os-engine/views/WikiView.tsx` exists.
   Map the three-class page model onto it; do not greenfield over it.
4. **Existing provenance UI** — `components/pro-suite/virtual-cso/SourcesPanel.tsx` exists;
   note it as the render target for claim/evidence.
5. **Pre-existing wiki tables** — inventory any `wiki_*` tables already in Supabase before
   writing new migrations.

---

## 6. Reference implementations (thinking input only — extraction is the execution agent's job)

- `theafh/ai-modules` → `knowledge_management` plugin (wiki, `wiki_auto_shaper`, `spr`,
  `executive_summary`). Spec §7.1. Seven adoptions A1–A7.
- OpenClaw → memory subsystem + `memory-wiki` plugin (engine/store separation,
  claims/evidence, compiled digest, dreaming, health dashboards). Spec §7.2. Eight
  adoptions B1–B8 + action-boundary metadata.

Adopt the **model and conventions, never the storage plumbing.** Our store is Supabase +
pgvector (hard constraint). Do not port filesystem scripts, markdown-on-disk substrate,
swappable backends, or CLIs.

**Verified 2026-06-29.** Both sources fetched and the spec's §7 summaries confirmed accurate.
Every adoption (A1–A7 / B1–B8 + action-boundary) is mapped artifact-by-artifact to its repo
path, consuming sub-phase, and extract/skip note in **`REFERENCES.md`** (feature root) — read it
before opening any sub-phase. Minor deltas logged there; notably the consolidation agent's real
name is **`auto_shaper_wiki`** (not "wiki_auto_shaper"), and provenance/digest substrates differ
by design (we normalize to `wiki_evidence` rows and a `wiki_digest` JSONB row).

---

## 7. Adjacent — not folded into the wiki core

**CSO persona/voice layer** (OpenClaw `SOUL.md` model): a small versioned definition of the
Virtual CSO's voice/stance, **distinct from global IP knowledge.** Out of scope for the wiki
core. Flagged so it is not conflated with global IP. Decide its home (likely Virtual CSO
endpoint config) during the connection phase, not here.

---

## 8. Append-only amendments

**2026-06-30 Amendment from 01-01-DELTA §A:** The checkpoint layer is confirmed GM-keyed and not `mra_checkpoints`, but the live content-bearing calibration tables currently store 125 checkpoints x 4 stages, not 125 x 5. `gm_stages` has five active stages and `gm_checkpoint_stage_dimension_order` includes `gm_stg_5`, but `gm_audit_questions`, `gm_checkpoint_stage_meaning`, `gm_checkpoint_scoring`, `gm_capability_stage_meaning`, and `gm_dimension_band_stage_meaning` have rows only for stages 1-4 at verification time.

**2026-06-30 Amendment from 01-01-DELTA §B:** The existing FastAPI sub-agent orchestrator remains the correct host for `per_user_wiki` and `global_ip`, but "no new plumbing" is corrected to "no parallel orchestrator." New capability rows are compatible with the registry, yet execution requires bounded in-place additions: handler dispatch branches or handler registry entries, context loaders/scope keys, and source kinds for wiki/global-IP evidence. Specifically (per §B): add `start_run()` branches `_handle_per_user_wiki()` / `_handle_global_ip()` (or a handler registry); extend `AgentContextBuilder` safe-scope + loaders for page keys / claim IDs / global-IP + checkpoint selectors; expand `StructuredQueryService.APPROVED_SURFACES` (currently `founder_dataset_rows`, `founder_dataset_rows_v`) or add a deterministic GM-checkpoint/global-IP read service.

**2026-06-30 Resolution — stage model (from 01-01-DELTA §A, founder call):** The wiki and stage-primer **model 5 stages** (Rising / Striving / Thriving / Driving / Arriving — the platform's real AE Ladder definition). The stage-primer pulls whatever calibrated content exists (currently stages 1–4) and treats **stage-5 content as a known gap it surfaces** — never a schema constraint. No migration when stage-5 content lands. The GM stage join (§A) maps `ae_frontend_stage_id` ↔ `gm_stages.stage_id`.

**2026-06-30 Resolution — source-kind naming (from 01-01-DELTA §A/§B):** Use **`global_checkpoint`** (not `gm_checkpoint`) for the GM-keyed checkpoint source kind, and add `wiki_evidence` + `wiki_digest` to the per-user wiki source kinds. The real GM family is `gm_checkpoints` (125) + `gm_audit_questions` / `gm_checkpoint_stage_meaning` / `gm_checkpoint_scoring` (500 each = 125×4).

**2026-06-30 Resolution — provenance RISK §D deferred (founder call):** The rich `evidence[]` shape stays as designed in the contract/schema — the wiki build still produces it. `SourcesPanel` currently renders a simplified `SourceRef{kind,label,pageId?}` and needs an **evidence adapter + small display extension** to show `path/lines/weight/note` at claim level. That UI work is an explicit **connection-phase dependency**, out of scope for this build (see ROADMAP handoff).

**2026-06-30 Note — existing OSE scaffold (from 01-01-DELTA §C/§E):** No `wiki_*` tables exist (clean to create). The existing OS Engine surfaces — `ose_knowledge_pages` (page-level markdown w/ `canonical_key`, `page_kind`, `domain`, `confidence`), `ose_page_corrections` (+ `NotesComposer`/`addPageCorrection()` as the closest existing override surface), `WikiView`/`IndexView`/`Reader` — are the **render-adapter target**, not a rebuild and not a conflict. The `seed_core_knowledge_pages()` 5 OSE page types (business_context, assessment_intelligence, strategic_context, financial_patterns, conversation_intelligence) are **distinct** from our 7 canonical wiki `page_key`s; ours remain canonical for the wiki layer.

**2026-06-30 Contract decision (02-01-CONTRACT.md, frozen `wiki-1.0`):** at the §B fork ("expand `APPROVED_SURFACES` vs. separate read service"), the contract chose a **separate deterministic `GlobalIpReadService`** (`.get(selector)` / `.get_checkpoints(selector)`; read-only, service-role, founder-invisible) rather than expanding `StructuredQueryService.APPROVED_SURFACES`. Sub-phases 04/05 implement against it. The contract is frozen as the binding shape/seam source for sub-phases 03–05 and 07.

**2026-06-30 Resolution — D15 host (founder call):** RESOLVED, amends spec D15 (which hardcoded N8N). `compile_page`, digest rebuild, and the dreaming/consolidation loop **execute as FastAPI services** — they hold the service-role transaction and set the transaction-local `app.wiki_compilation_service='on'` marker the 03 write-lock requires (`set_config(..., true)` in the same transaction as the `class='compiled'` writes). **n8n owns the trigger/schedule layer**: it watches the §F source tables / receives platform events, runs the eager-rebuild map, cron (for dreaming), retries, and the existing writeback bridge, and calls the FastAPI endpoints. Rationale: the write-lock is cleanly satisfiable only by the transaction holder (FastAPI); keeps compilation DRY with the orchestrator's retrieval code; co-locates with `GlobalIpReadService`. Single-writer guarantee (L2) preserved — FastAPI `compile_page` is the only path that sets the marker.

**2026-06-30 Follow-up — embedding validation pending (04 implementation):** the compile path correctly uses OpenAI `text-embedding-3-small` (vector(1536)), but the 04 live smoke ran under an OpenAI `429 insufficient_quota` and fell back to deterministic placeholder embeddings. The plumbing (compile → store → vector index → `wiki_search`) is proven; **semantic search quality is unvalidated until quota is restored.** Carry into **08-acceptance**: re-run a compile + `wiki_search` with real embeddings and confirm semantically relevant ranking. Not a code defect; environmental.

**2026-06-30 Follow-up — live write-surface smoke pending (05 implementation):** the write surface passed in-memory smoke (propose→promote→demote, unauthorized-promotion reject, compiled-base reject) + compile + build, but the **live** Supabase round-trip could not run — `.env.local`'s mapped key was rejected by Supabase admin auth (`Invalid API key`), so no temp live test user could be created. Carry into **08-acceptance**: once a valid Supabase admin/service key is available, run the write surface live against real RLS + the write-lock trigger + actor-scope. Environmental, not a code defect. (Two env blockers now tracked for 08: OpenAI quota, Supabase admin key.)

**2026-06-30 Decision — per-page tags (founder call, prepping 06):** add `tags text[]` to `wiki_pages` (additive migration in 06) so the frontmatter_contract's `tags` is real and the A7 off-taxonomy check is live. Tags validate against the schema-object `tag_taxonomy` via `valid_tag()`. The schema-object `pages` map gains per-page default tags; 06 backfills the 7 fixed pages. **Additive, non-breaking** — does not change the frozen `claim`/`evidence`/`digest` contract shapes (the contract stays `wiki-1.0`).

**2026-06-30 Live-state audit (orchestrator, read-only against project `pwacpjqkntnovndhspxt`):**
- **03 + 04 confirmed fully live** — all 9 `wiki_*`/`global_ip_pages` tables; `wiki_schema` active = `wiki-1.0`; `replace_compiled_wiki_page` present; seeded compile present (1 `wiki_pages`, 2 compiled `wiki_claims`, 1 `wiki_digest`).
- **05 code-only** — no live insight rows (in-memory smoke only).
- **06 migration `20260630_wiki_tags.sql` NOT applied live** — `wiki_pages.tags` absent; `valid_tag` / `wiki_validation_findings` / `wiki_health` functions absent. 06's `wiki_health.py` references DB objects that don't yet exist.
- **Action:** follow-up issued to the 06 execution agent (`phases/06-validation-health/06-FOLLOWUP-PROMPT.md`) to apply the migration live + run the deferred smokes using its Supabase write access. **Sub-phase 07 is PAUSED** until live state is solid (06 applied; 05/06 live smokes pass). Deferred live items tracked for 08: OpenAI real-embedding check, Supabase live write-surface smoke, 06 live validation.

**2026-06-30 (update):** 06 migration **applied live** (`wiki_tags_validation_health` → success). Orchestrator read-only verify confirms `wiki_pages.tags` present; `valid_tag` / `wiki_health` / `wiki_validation_findings` live; existing page backfilled with valid tags `[operations, growth]`. **Structural live state now solid — all migrations (03/04/06) applied, all objects live.** Remaining = write-based functional smokes only: (a) 06 functional (seed broken-provenance + off-taxonomy → flagged-not-dropped; `wiki_health` live; post-compile hook) — pending the 06 agent's MCP usage limit clearing (~2:53 AM); (b) 05 live write-surface smoke; (c) real-embedding check (OpenAI quota). All three carried for 08-acceptance if not cleared sooner.

**2026-06-30 — BUILD COMPLETE (08-acceptance).** Wiki System Tier 1 is **done in isolation.** Harness: **43 passed / 2 intentional skips / 0 failed**; contract **`wiki-1.0` declared STABLE**; all 5 hard guarantees passed live against Supabase; DI-05 (write-surface), DI-06 (health), DI-07 (consolidation) **cleared**. Single open item: **DI-EMBED** — OpenAI `text-embedding-3-small` returned 429, so embeddings were faked with deterministic vectors and **semantic-ranking quality is not yet verified live** → carried into the connection phase. Record: `phases/08-acceptance/08-01-ACCEPTANCE.md`.

**Phase 9 (connection-phase) handoff notes — from the acceptance record:**
1. **`flag_contradiction` on a COMPILED claim is trigger-blocked via the plain Python write API** — the write-lock `enforce_wiki_compiled_claim_writer` fires on **UPDATE** too, not just INSERT. Flag a compiled claim as contested via `page_ref` (no compiled-row write) or a marker-setting RPC; `flag_contradiction` works directly on insight/override claims.
2. **`set_claim_confidence` on a COMPILED claim is likewise blocked** — use `actor='founder'` on override/insight only, or route compiled confidence changes through the compilation RPC.
3. `updated_at` resets on every UPDATE to `wiki_claims` (staleness backdating needs a test-env workaround).
4. Novelty gate rejects identical-text proposals (cosine ≥ 0.92) — correct; tests bypass via direct insert.
**Net rule for the connection phase:** any mutation targeting a **compiled claim row** must go through the compilation-service RPC path (the marker transaction), **not** the write-back API. The write-back API is for insight/override claims.

**2026-06-30 Cross-reference — memory / self-learning loop builds on Layer 2.** The deferred memory
components surfaced in the OpenClaw repurposing pass (recall tracking + recall-driven promotion [B3,
dormant], the session-end memory flush [B5, entry-point only], and the broader OpenClaw memory subsystem
not built for Wiki 1.0 — durable `MEMORY.md`-style memory, the self-improvement promotion loop,
commitments, full active-memory/recall) are the **self-learning loop**. The insight→promotion→dreaming
machinery built here is its seed and operates over **both** Tier-1 layers. Its rich substrate is **Layer 2
(`.planning/document-wiki/`)** — documents + CSO threads + sprint history + domain-agent artifacts. See
`.planning/document-wiki/CONTEXT.md §7`. Do not lose this thread across feature builds.
