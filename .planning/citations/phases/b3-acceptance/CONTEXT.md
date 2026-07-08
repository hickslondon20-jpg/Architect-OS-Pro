# Sub-phase B3 Context — Ep7B Acceptance + Consolidated Live-DB Apply (GREENLIT)

**Date:** 2026-07-06
**Outcome:** Ready to execute. **Live Supabase schema clearance is granted** (CONTEXT §8 governance change).
This is the Ep7 closeout: apply all staged migrations live + run the live smoke. The execution agent makes
implementation choices only, not design choices.

---

## What this sub-phase is

The final Ep7 phase. With London's clearance, the agent **applies the staged Ep7A + Ep7B additive migrations
live via the Supabase MCP** and proves the whole citation stack end-to-end — including the Ep7B geometry path.
Single deliverable: **B3-01** (see `B3-01-PLAN.md`).

---

## Inputs the agent must read first (in order)

1. `RESEARCH.md` (this folder) — **primary source.** Live-apply order + verifies (§1), the acceptance matrix
   (§2), the real-ingest-OR-seeded-chunk geometry smoke (§3), the guardrails (§4).
2. `B3-01-PLAN.md` (this folder) — task + criteria.
3. `../../CONTEXT.md` — locked ledger. §3.1 DP6, L10, **§8 (the clearance + guardrails, the A6 live-DB ledger,
   the B0/B1/B2 reconciliations)**. **CONTEXT wins on conflict.**
4. The staged migrations (`docs/migrations/20260706_*.sql`), `test_ep7a_acceptance.py` (A6), the B1 resolver +
   B2 signed-URL/render path, and the Supabase MCP (`apply_migration`, `execute_sql`, `list_tables`).

---

## Decisions already made (do not re-open)

- **Live apply is greenlit** — additive/idempotent migrations may be applied by the agent via MCP.
- **Additive/idempotent only** — no drops/removals/data-deletion/restructuring/backfill (L10). Destructive →
  stop + flag.
- **`reflection_reviews` stays dormant** — do not fabricate an empty source table.
- **Geometry smoke via real ingest OR a seeded geometry chunk** (Path B) when Docling is env-absent.
- **Docling install is an env matter, not schema** — don't block B3 on it.

---

## What this sub-phase does NOT do

- No destructive/restructuring schema changes; no backfill; no new features (e.g. wiring Reflection Review).
- No §8 visual polish; no B0/B1/B2 code changes (this is acceptance + apply).

---

## Files / actions

| Action | Notes |
|---|---|
| Apply R1, R2, BG live (MCP `apply_migration`) + verify each | Order + verifies in RESEARCH §1. |
| Confirm R3 platform tables (MCP) | reflection_reviews dormant; cc_versions vs clarity_compass_versions. |
| Re-run `test_ep7a_acceptance.py` against live | Ep7A live smoke. |
| Ep7B geometry smoke (real ingest or seeded chunk) | RESEARCH §3; clean up seeded rows. |
| `python-backend/tests/test_ep7b_acceptance_b3.py` | Create — geometry resolve + signed-url + transform assertions. |
| `Pro-Suite-Progress.md` | Ep7 (A+B) live-complete + any residual (Docling ingestion smoke). |

---

## Success criteria (B3-01)

1. R1 + R2 + BG applied live + verified; R3 confirmed (reflection_reviews dormant).
2. Ep7A live smoke green (citations persist, verifier grades, lit-family resolve).
3. Ep7B geometry path proven live — resolve returns geometry + B2 render works (real ingest or seeded chunk).
4. No destructive ops; no backfill; only additive/needed wiring created.
5. `Pro-Suite-Progress.md` updated; CONTEXT §8 B3 + Ep7-complete amendment.

---

## Handoff

When the migrations are applied + verified live and both smokes pass, the strategy thread logs the B3 +
**Ep7-complete** amendment in `../../CONTEXT.md §8`. Any residual (e.g. the full Docling ingestion smoke if the
env still lacks docling) is the only open item. Ep7 (citations & source grounding, A + B) is then done; the §8
front-end visual-polish pass is the downstream cross-cutting work, separate from Ep7.

*Context written: 2026-07-06 — Ep7 citations planning thread, at B3 sub-phase entry (live clearance granted).*
