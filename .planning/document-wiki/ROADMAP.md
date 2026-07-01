# Document Wiki (Layer 2) — Build Roadmap

**Feature:** the emergent, multi-source, longitudinal document wiki — Tier-1 *depth* beneath the seven
fixed structured pages of Layer 1 (`../wiki-system/`).
**Decisions:** `CONTEXT.md` (read first) · **Reference map:** `REFERENCES.md` · **Verify:** `phases/01-verify-delta/01-01-DELTA.md`
**Approach:** build the missing **synthesis engine** on the existing OS Engine `ose_knowledge_pages`
scaffold (verify-confirmed). No greenfield.

---

## Process rules

- **One sub-phase at a time.** Per-sub-phase `CONTEXT.md` + `EXECUTION-AGENT-PROMPT.md` (+ a `RESEARCH.md`
  when there's extraction) are authored just-in-time when we open the sub-phase — not up front.
- **Verify-first** (01 done) → **contract + schema** (02) before engine internals.
- **Build on existing**, extend with pgvector page embeddings, `page_kind` taxonomy, multi-source writers,
  correction/log lifecycle, health/lint.
- **Scope = capability only** (engine + store + tools + health). CSO-hook enhancement + retrieval routing
  = the connection phase (shared with Layer 1's handoff).
- **Layer 2 never duplicates Layer 1's claim store**; it bridges via `ose_page_type`.
- **Memory substrate:** the page is the unit of recall/promotion; design provenance + accretion + recall hooks in.

---

## Sub-phase sequence

| Sub-phase | Folder | Plan(s) | Owns |
|---|---|---|---|
| 01 | `01-verify-delta` | 01-01 | ✅ done — delta + build-on-existing recommendation |
| 02 | `02-page-contract-schema` | 02-01 (page contract), 02-02 (schema + tools) | ✅ done — `02-01-CONTRACT.md` (doc-wiki-1.0) frozen; migration live on pwacpjqkntnovndhspxt; `ose_page_links` + pgvector HNSW; `per_user_document_wiki` registered; stubs compile + dispatch |
| 03 | `03-synthesis-engine` | 03-01 (framework), 03-02 (document adapter) | ⚠️ code-complete, live smoke deferred — `DocWikiSynthesisService` (729 lines) + `DocWikiDocumentAdapter` built; ingest hook + manual endpoints wired in `main.py`; fake-store smoke confirms logic; live smoke (real `ose_knowledge_pages` row) deferred to 07 due to env constraint (missing service-role + Anthropic keys in local agent env). Bug fixed: `mark_metadata_failed()` in synthesis error handler replaced with `pass`. CONTEXT §8 2026-06-30 amendments document all implementation decisions. |
| 04 | `04-source-adapters` | 04-01 (sprint-history), 04-02 (CSO-thread), 04-03 (agent-artifact) | ✅ code-complete — `DocWikiDocumentAdapter` (03), `DocWikiSprintAdapter` (sprint_history only, 142 lines), `DocWikiCSOThreadAdapter`, `DocWikiAgentArtifactAdapter` built; `capability_evolution` loop removed (69 lines); compileall passes; live smoke blocked by env (deferred to 07). **Sprint wiki produces `sprint_history` pages only — see "Sprint Wiki Vision" section below for the two future page kinds.** |
| 05 | `05-embeddings-search` | 05-01 | ✅ code-complete — `_embed_page()` implemented (text-embedding-3-small via VectorStore); `DocWikiReadService` (225 lines) with `search/get_page/list_pages`; `_handle_per_user_document_wiki()` stub replaced with full `docwiki_tool` dispatch; `match_ose_knowledge_pages` RPC authored (`20260630_docwiki_page_search.sql` — written, not yet applied, deferred to 07); 3 direct API endpoints in `main.py`; compileall passes. Schema finding: actual columns are `page_title`/`last_updated` (not `title`/`created_at`); `source_type` is derived from `page_kind`+`source_file_ids`. CONTEXT §8 2026-06-30 amendment records all implementation decisions. Live smoke deferred to 07. |
| 06 | `06-corrections-log-health` | 06-01 | ✅ code-complete — Migration docs written (`ose_page_corrections` + `ose_activity_log` schemas, `CREATE TABLE IF NOT EXISTS`); `LogView.tsx` ICONS registry fixed (kebab-case `alert-triangle`/`x-circle`/`file-text` now resolve; was always falling back to `Activity`); `DocWikiHealthService` created (7 health checks: pages_total, with/without embedding, pending_corrections, contradiction_count, orphan_pages, recent_errors_7d; status: healthy/needs_attention/degraded); `GET /api/doc-wiki/health/{user_id}` endpoint added to `main.py`; compileall exits 0. Scope finding: corrections lifecycle + activity log were already fully built by sub-phase 03 agent. |
| 07 | `07-acceptance` | 07-01 | ✅ done — migrations applied live (`match_ose_knowledge_pages` RPC + `ose_page_corrections`/`ose_activity_log`); `_flag_contradictions()` bug fixed (now upserts `ose_page_links` with `relation="contradicts"`); acceptance harness 27 passed / 4 skipped (OpenAI quota-gated embedding smoke × 2, DL-01 real Claude, DL-02 real embedding quality). Layer 2 complete in isolation. **Deviation:** `CREATE POLICY IF NOT EXISTS` not supported on this Postgres target — agent used conditional DO blocks instead; same policy intent applied. |

### Dependency sketch

```
01 ─> 02 ─> 03 ─┬─> 04 ─┐
                ├─> 05 ─┼─> 06 ─> 07
                └───────┘
```

---

## Acceptance (build done-definition)

Layer 2 works in isolation, no CSO/router wiring:
1. A source event (document upload / sprint update / CSO thread / agent artifact) runs the engine →
   creates/updates a prose page with `page_kind`, `source_file_ids` provenance, `canonical_key` dedup.
2. The page is embedded (pgvector) and returned by the page-search tool.
3. A founder correction is preserved across a re-synthesis of the same page.
4. Contradictions are flagged (not resolved); health/lint surfaces orphans/stale/missing-cross-refs; the
   activity log records events; the UI shells (Wiki/Index/Manifest/Log) show real content.
5. The Layer-1 bridge (`ose_page_type`) exposes Layer 2 pages to Layer 1 contexts without duplicating claims.

---

## Handoff

Once 07 passes, Layer 2 is done in isolation. The connection phase (shared with Layer 1) wires both
Tier-1 layers + the retrieval router into the Virtual CSO / Domain Agents / OS Engine, and is where the
memory/self-learning loop (CONTEXT §7) gets activated.

---

## Sprint Wiki Vision — DO NOT LOSE THIS

> This section exists so the sprint wiki intent survives every future context compaction,
> build sprint, and agent handoff. It is a permanent fixture of this roadmap.

The Document Wiki's sprint adapter currently produces one page per sprint: `sprint_history`
(sourced from `sp_sprint_goals/initiatives/milestones` — planning intent + execution record).
This is intentionally incomplete. Two additional page kinds are designed and waiting for
their data sources to land in Supabase.

### The three sprint wiki pages (full vision)

**Page 1 — `sprint_history`** ✅ LIVE (built sub-phase 04)
- Canonical key: `sprint_{quarter}_{sprint_goal_id_short8}`
- Source: `sp_sprint_goals` + `sp_sprint_initiatives` + `sp_sprint_milestones`
- Captures: sprint goal, directional framing, initiatives + 3P tier (Prioritize/Plant/Iterate),
  outcome statements, milestone completion
- Trigger: sprint close event (`manually_closed_at IS NOT NULL`)

**Page 2 — `sprint_retrospective`** ⏳ FUTURE — blocked on execution hub wiring
- Canonical key: `sprint_retro_{quarter}_{sprint_goal_id_short8}`
- Source: needs a **`sp_sprint_retrospectives` table** (or equivalent) capturing:
  - Goal status per goal: Yes / Partially / We Learned
  - Start/Stop/Continue (3 text fields — the required retrospective exercise)
  - "What else did we learn?" (optional notes + looking ahead prompts)
  - The Story: the AI-generated retrospective memo + forward guidance (currently generated
    on "Lock & Approve" in `Retrospective.tsx` and shown in the UI — not persisted)
- What to do when the table lands: add `synthesize_from_retrospective(sprint_goal_id, user_id)`
  to `DocWikiSprintAdapter`; one page per locked retrospective

**Page 3 — `sprint_evolution`** ⏳ FUTURE — blocked on V-11 working-score write
- Canonical key: `sprint_evolution_{quarter}_{sprint_goal_id_short8}`
- Source: needs the **Reflection & Review checkpoint writes** from `ReflectionReview.tsx`
  — currently V-11 placeholder (Submit button is not wired to Supabase). The data is:
  9 capabilities × 5 checkpoints = 45 re-ratings (No/Somewhat/Yes → 0/50/100 scores),
  delta from previous assessment, stage movement (Surviving/Rising/Driving/Thriving/Compounding)
- Captures: how maturity scores shifted across all capabilities this sprint, what it means
  for the next quarter, where the agency sits on the AE Ladder after re-scoring
- This is NOT one page per capability — it is one holistic evolution narrative per sprint
- The `capability_evolution` page_kind in `doc_wiki_schema.json` is reserved for this page
- What to do when V-11 lands: add `synthesize_from_score_update(sprint_goal_id, user_id)`
  to `DocWikiSprintAdapter`; source tables TBD based on how V-11 is implemented

### Upstream wiring tasks required

These are execution hub tasks, not document wiki tasks. When they land, the wiki adapter
gets extended — nothing about the wiki's architecture needs to change:

| Task | What it unblocks | Where to look |
|---|---|---|
| Create `sp_sprint_retrospectives` table + wire `Retrospective.tsx` Lock & Approve | `sprint_retrospective` wiki page | `pages/ProSuite/Retrospective.tsx` |
| V-11: wire `ReflectionReview.tsx` Submit to write checkpoint re-ratings | `sprint_evolution` wiki page | `pages/ProSuite/ReflectionReview.tsx` (see comment line 4-6) |

### Design constraint (locked)

The sprint adapter must never create per-capability pages. The `sprint_evolution` page is
one page per sprint covering all capabilities holistically. The wiki synthesizes the story
of how the agency evolved — it does not create a separate record for each of 9 capabilities.

See `CONTEXT.md §8 "2026-06-30 — Sprint wiki architecture"` for the full rationale.
