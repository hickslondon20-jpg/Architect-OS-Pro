# Plan B3-01 — Ep7B acceptance + consolidated live-DB apply (GREENLIT)

**Sub-phase:** B3 — Ep7B acceptance (Ep7B)
**Plan:** 1 of 1
**Depends on:** B2 (highlight), B1 (resolver), B0 (ingestion + geometry migration); A6 (staged Ep7A migrations)
**Status:** Ready for execution — **live Supabase schema clearance granted** (CONTEXT §8 governance change, London).
**Decisions:** `../../CONTEXT.md` §3.1 DP6, L10, §8 (clearance + guardrails) · **Ref:** `../../ROADMAP.md` Phase B3

---

## Goal

Prove the Ep7B geometry path end-to-end and, with London's clearance, **apply all staged Ep7A + Ep7B migrations
live** via the Supabase MCP so the whole citation stack is functionally wired. This is the Ep7 closeout.

## Cleared to apply live (additive/idempotent; verify each; MCP `apply_migration`)
- **R1** — `vcso_chat_messages.citations jsonb` (A1; verdicts ride inside it, A4).
- **R2** — `citation_verifier` model setting (A4); confirm `ai_models` / `platform_ai_settings` exist first,
  create only if genuinely required for the verifier wiring.
- **BG** — `document_chunks` geometry columns `page_number int`, `bbox jsonb`, `verbatim text` (B0).
- **R3** — confirm the 15 platform-record tables; create any genuinely-needed-and-missing one **except**
  `reflection_reviews` (dormant by design — source feature unwired; do **not** fabricate an empty table).

## NOT cleared (stop + flag if needed)
Destructive ops (drops/removals/data deletion), restructuring existing tables, backfill (L10). Clearance =
complete wiring, not restructure.

## Pre-Execution Checks
1. Read `RESEARCH.md` (this folder) — the live-apply order + verifies (§1), the acceptance matrix (§2), the
   seeded-geometry-chunk approach for the pixel smoke (§3), the guardrails (§4).
2. Via MCP, confirm current schema before applying (which of R1/R2/BG/R3 tables/columns already exist).

## Build / run
- **Apply live (MCP):** R1, R2, BG in order; verify each with an information_schema / select check. R3: confirm
  tables; note/act per the dormancy rule.
- **Ep7A live smoke:** re-run the A6 acceptance matrix (`test_ep7a_acceptance.py`) against **live** schema —
  citations persist on messages, verifier runs on the utility model, resolvers resolve for lit families.
- **Ep7B geometry smoke (the payoff):** with `document_chunks` geometry columns live, prove resolve→highlight
  end-to-end:
  - **If Docling is installed** in the run env: ingest a real PDF → confirm chunks get `page_number`/`bbox`/`verbatim`.
  - **If not** (env still lacks docling): **seed a geometry-bearing chunk** (real values for `page_number`,
    `bbox` per the B0 contract, `verbatim`) referencing a real PDF already in the raw-document bucket; then
    confirm B1 resolve returns `locator.kind="bbox"` + geometry, and B2's signed-URL + render path works.
  - Confirm the highlighted rectangle lands correctly (or, headless, that the transform + payload are correct).
- **L18 pending-live:** run the items now runnable against live schema.
- **Progress:** update `Pro-Suite-Progress.md` — Ep7 (A + B) live-complete; note any residual (e.g. Docling
  ingestion smoke if still env-blocked).

## Success criteria
1. R1 + R2 + BG applied live and verified; R3 tables confirmed (reflection_reviews left dormant).
2. Ep7A live smoke green (citations persist, verifier grades, lit-family resolve works).
3. Ep7B geometry path proven live — resolve returns geometry + B2 render works (via real ingest or seeded chunk).
4. No destructive ops; no backfill; only additive/needed wiring created.
5. `Pro-Suite-Progress.md` updated; CONTEXT §8 gets the B3 + Ep7-complete amendment.

## Out of scope
Destructive/restructuring schema changes; backfill; §8 visual polish; new features (e.g. wiring Reflection Review).
