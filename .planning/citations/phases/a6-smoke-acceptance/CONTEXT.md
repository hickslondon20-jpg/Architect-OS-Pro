# Sub-phase A6 Context — Ep7A Smoke + Acceptance (+ gated live-DB apply)

**Date:** 2026-07-06
**Outcome:** Ready to execute (Track 1). **Track 2 (live-DB apply) is a gated working session with London — the
execution agent applies nothing live.** The execution agent makes implementation choices only, not design choices.

---

## What this sub-phase is

The Ep7A closeout: prove the citation stack end-to-end across every lit source-kind in both surfaces, fold in the
L18 credential debt, and **stage** (not apply) the consolidated live-DB changes. It is **two tracks**:
- **Track 1 (autonomous):** the acceptance harness + smoke. Mutates nothing shared.
- **Track 2 (gated):** the live-DB apply runbook — executed with London via the Supabase MCP, one migration at a
  time with a verify after each. **Not the autonomous agent's job.**

Single deliverable: **A6-01** (see `A6-01-PLAN.md`).

---

## Inputs the agent must read first (in order)

1. `RESEARCH.md` (this folder) — **primary source.** The acceptance matrix (§1), the live-apply runbook (§2 —
   gated), the L18 debt (§3), the apply posture (§4).
2. `A6-01-PLAN.md` (this folder) — two-track task + criteria.
3. `../../CONTEXT.md` — locked ledger. §2 (what's lit today), §3.1 DP5, **§8 the consolidated live-DB apply
   ledger** + every phase's completion amendment. **CONTEXT wins on conflict.**
4. The built stack: `services/citations/*` (A0/A1/A2/A4), the VCSO citation UX (A3), artifact delivery (A5),
   and `docs/migrations/20260706_*.sql` (the two pending migrations).

---

## Decisions already made (do not re-open)

- **Do NOT apply live migrations autonomously** — Track 2 is a London working session (shared-project mutation).
- **Dark/dormant families are marked, not failed** — `web` pending-producer (O2), `reflection_reviews` dormant (A2).
- **Verdicts ride inside the `citations` jsonb** (no separate column) — the R1 migration is the only citation-column change.
- **L18 is a smoke, not a build** — fold in, run runnable parts, mark the rest pending-live.
- **No backfill anywhere** (L10).

---

## What this sub-phase does NOT do

- No live-Supabase mutation by the agent (Track 2 is gated).
- No new feature build; no Ep7B geometry (B-series); no §8 visual polish.
- No backfill of existing rows.

---

## Files to create or modify

| File | Action | Notes |
|---|---|---|
| `python-backend/tests/test_ep7a_acceptance.py` (or a harness script) | Create | The family × surface matrix; lit green, dark/dormant marked. |
| L18 smoke notes/harness | Create | Gather + run runnable credential-debt checks; mark the rest pending-live. |
| `Pro-Suite-Progress.md` | Modify | Ep7A row + the pending-live list. |
| `../../CONTEXT.md §8` | Modify (strategy thread) | A6 amendment: matrix results + pending-live set (after the run). |
| *(Track 2, London session — not the agent)* | Apply | R1, R2 migrations + R3 schema confirmation via Supabase MCP, one at a time + verify. |

---

## Success criteria (A6-01, Track 1)

1. E2E matrix green for all **lit** families in both surfaces (local/test fixtures or a branch DB); dark/dormant
   families explicitly marked, not failing.
2. L18 items gathered + runnable parts exercised; the rest pending-live.
3. The live-DB runbook (RESEARCH §2) is complete + validated (idempotency + verify queries) — **nothing applied live.**
4. `Pro-Suite-Progress.md` updated.

## Track 2 done (London session, separate)

R1 + R2 applied + verified; R3 tables confirmed (dormant renderers marked); live smoke of the lit matrix green.

---

## Handoff

When Track 1 lands and the runbook is staged, the strategy thread logs the A6 amendment. **Ep7A is
build-complete; live-complete after the Track 2 session with London.** Ep7B (B0–B3 geometry) is the follow-on
track, independent of A3–A6.

*Context written: 2026-07-06 — Ep7 citations planning thread, at A6 sub-phase entry (live-apply gated to a London session).*
