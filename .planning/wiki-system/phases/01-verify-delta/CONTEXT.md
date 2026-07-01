# Sub-phase 01 Context — Verify & Delta

**Date:** 2026-06-29
**Outcome:** Ready to execute. This sub-phase makes **no design decisions** and consumes **no
reference adoptions** — the decisions are already locked in the feature-root `../../CONTEXT.md`.
Its job is to confirm or correct those locked assumptions against the live codebase and Supabase
*before* any schema is written. It is a read-only investigation pass.

---

## What this sub-phase is

The verify-before-build gate. The platform is substantially built; we assume features exist until
confirmed. This pass produces one artifact — `01-01-DELTA.md` — that every downstream sub-phase
(02–08) reads to ground its work in reality. The locked decisions it tests are in
`../../CONTEXT.md` §5 (verify items).

**No extraction here.** Reference repos (theafh / OpenClaw) are not consumed in this sub-phase.
`../../REFERENCES.md` is skimmed only so the delta can note where an existing asset will later
meet an adopted pattern. Extraction discipline begins at sub-phase 02.

---

## Decisions relevant to this sub-phase

There are none to *make*. There are findings to *confirm or correct*:

- **Checkpoint table identity.** Locked CONTEXT says the ~500-entry stage-calibrated store is
  `gm_checkpoint`-keyed (via `lib/gm-audit.ts`), **not** `mra_checkpoints` as the spec guessed.
  Confirm the real table name(s) and whether the 5-stage AE-Ladder calibration (125 × 5 ≈ 500) is
  physically stored or applied at query time.
- **Orchestrator hosting (CONTEXT L10).** Confirm the FastAPI sub-agent orchestrator can host
  `per_user_wiki` / `global_ip` as `agent_capabilities` rows with no new plumbing, or enumerate
  the rework.
- **Existing wiki UI / tables.** Map `WikiView.tsx` onto the three-class model; inventory any
  pre-existing `wiki_*` tables before 03 writes migrations.
- **Tier 0 source inventory.** List the tables feeding each compiled-base page so 04 can wire the
  event→rebuild map to real change sources.

If any finding **corrects** a locked decision, the agent appends a dated amendment note to
`../../CONTEXT.md` — it does **not** silently rewrite a locked row.

---

## What this sub-phase does NOT do

- No schema, migrations, tables, or RLS (begins at 03).
- No services, endpoints, handlers, or compilation logic.
- No UI changes.
- No reference-repo extraction.
- No edits to production code of any kind. **Read-only.**

---

## Files to be created or modified

| File | Action | Notes |
|---|---|---|
| `01-01-DELTA.md` (this folder) | **Create** | The sole deliverable: sections A–F, each ending CONFIRMED / CORRECTED / RISK. |
| `../../CONTEXT.md` | **Append-only (conditional)** | Only if a finding corrects a locked decision — add a dated amendment note; never rewrite a locked row. |

---

## Tools the execution agent may use

- **Read** access to the codebase (`lib/gm-audit.ts`, `python-backend/services/*`,
  `components/pro-suite/os-engine/views/WikiView.tsx`, `components/pro-suite/virtual-cso/SourcesPanel.tsx`).
- **Read-only Supabase** queries (service role) — `information_schema` introspection, column dumps,
  row counts. The Supabase MCP `list_tables` / `execute_sql` (SELECT only) is the cleanest path.
- **No** write/migration/DDL tools. No `apply_migration`. No code edits.

---

## Success criteria (from `01-01-PLAN.md`)

1. Real checkpoint table name(s) + stage-calibration storage model documented, with a query interface.
2. Orchestrator hosting confirmed or rework enumerated.
3. WikiView three-class mapping documented.
4. Existing `wiki_*` tables inventoried (or confirmed absent).
5. Tier 0 source tables per page listed for the event→rebuild map.
6. No production code, schema, or migration written.

---

## Handoff

When `01-01-DELTA.md` is complete and any CONTEXT amendments are logged, the verify pass is done.
The strategy thread reads the delta, then opens **sub-phase 02 (interface-contract)** — the first
sub-phase that requires a reference-extraction pass.

*Context written: 2026-06-29 — Discuss/Plan thread.*
