# Wiki System — Sub-phase 01 (Verify & Delta) Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **verification agent** for Sub-phase 01 (Verify & Delta) of the ArchitectOS Wiki
System build. This is a **read-only investigation pass**. You do **not** write code, schema,
migrations, services, or UI, and you do not redesign anything. Your single deliverable is a delta
document. If you encounter something that would require a decision beyond confirming or correcting
a locked assumption, **stop and flag it** rather than improvising.

## Orient first (read these, in order)

1. `.planning/wiki-system/CONTEXT.md` — the locked cross-cutting decisions + the interface
   contract. §5 is your task list. **This file is ground truth; the spec yields to it.**
2. `.planning/wiki-system/phases/01-verify-delta/CONTEXT.md` — this sub-phase's scope.
3. `.planning/wiki-system/phases/01-verify-delta/01-01-PLAN.md` — your full task spec (sections A–F).
4. `.planning/wiki-system/ROADMAP.md` — where this sits in the build.
5. Skim `.planning/wiki-system/REFERENCES.md` and `.planning/wiki-system/ArchitectOS-Wiki-System-Spec-v1.md`
   for context only — you are **not** extracting from the reference repos in this sub-phase.

## Hard constraints

- **Read-only.** No file edits to production code. No migrations. No DDL. No `apply_migration`.
  Supabase access is **SELECT / introspection only** (`information_schema`, column dumps, row counts).
- **Verify, don't build.** Every claim in your delta must be backed by something you actually read
  or queried — not assumed.
- **Don't greenfield.** Assume features exist until you confirm otherwise. If an asset already
  exists, document it; do not propose rebuilding it.

## Your tasks (full detail in 01-01-PLAN.md §A–F)

- **A. Checkpoint table.** Find the real table(s) behind `lib/gm-audit.ts`
  (`gm_checkpoint_id`, `checkpoint_id_display`, `checkpoint_title_display`). Confirm the name and
  whether the 5-stage AE-Ladder calibration (125 × 5 ≈ 500 rows) is physically stored or applied at
  query time. Record the query interface the `structured_data` tool + stage-primer will use.
- **B. Orchestrator hosting.** Read `python-backend/services/sub_agent_orchestrator.py`,
  `agent_capabilities.py`, `agent_context.py`, `structured_data.py`, `structured_query.py`. Confirm
  `per_user_wiki` / `global_ip` can register as capability rows with handler dispatch — or list the
  rework. (Locked expectation: CONTEXT L10, "no new plumbing.")
- **C. Existing wiki UI.** Read `components/pro-suite/os-engine/views/WikiView.tsx` and siblings.
  Document how the three-class page model (compiled / insight / override) maps onto it. Mapping
  only — no UI changes.
- **D. Provenance UI.** Read `components/pro-suite/virtual-cso/SourcesPanel.tsx`; confirm it can
  render the `evidence[]` shape; note gaps.
- **E. Pre-existing wiki tables.** Introspect for any `wiki_*` tables; inventory or confirm absent.
- **F. Tier 0 source inventory.** List the Supabase tables feeding each compiled-base page (diagnostic,
  AE Ladder, sprint/quarter, Clarity Compass, financial/client) for the event→rebuild map.

## Deliverable

Write `.planning/wiki-system/phases/01-verify-delta/01-01-DELTA.md` with one section per task A–F.
**Each section must end with an explicit verdict: `CONFIRMED`, `CORRECTED`, or `RISK`**, stated
against the relevant locked decision in `.planning/wiki-system/CONTEXT.md`.

If a finding **corrects** a locked decision, append a dated amendment note at the bottom of
`.planning/wiki-system/CONTEXT.md` (e.g. "2026-… Amendment from 01-DELTA §A: …"). **Do not** rewrite
or delete a locked row — append only, and flag it in your final summary.

## Done when

All six success criteria in `01-01-PLAN.md` are met, `01-01-DELTA.md` exists with A–F verdicts, and
any CONTEXT amendments are logged. Report back a one-paragraph summary: how many sections CONFIRMED
vs CORRECTED vs RISK, and any amendment you logged. Then stop — sub-phase 02 is opened from the
strategy thread, not by you.
