# Plan A6-01 — Ep7A smoke + acceptance (+ gated live-DB apply)

**Sub-phase:** A6 — Ep7A smoke + acceptance
**Plan:** 1 of 1
**Depends on:** A3, A4, A5 (all Ep7A build phases complete)
**Status:** Ready for execution — **two-track:** autonomous harness (execution agent) + **gated live-DB apply
(working session with London, NOT the agent).**
**Decisions:** `../../CONTEXT.md` §3.1 DP5, §8 live-DB ledger, L18 · **Ref:** `../../ROADMAP.md` Phase A6

---

## Goal

Prove Ep7A end-to-end across every **lit** source-kind in both surfaces, fold in the L18 credential debt, and
stage (not unilaterally apply) the consolidated live-DB changes. **The live apply mutates the shared Supabase
project and is done in a working session with London — the execution agent does not apply anything live.**

## Two tracks

### Track 1 — Acceptance harness + smoke (AUTONOMOUS — execution agent)
- Build the **family × surface E2E matrix**: for each lit family (`document_chunk`, `wiki_page`,
  `platform_record`) in **VCSO** and the **artifact library** — query/answer → chip → sidecar resolve →
  Check-Citations verdict. `web` marked pending-producer (O2); `reflection_reviews` marked dormant (A2).
- Fold in the **L18 Ep5/§8 live-credential debt** smoke (sandbox/loop/credential checks) — gather + run what's
  runnable without shared-project mutation; mark the rest pending-live.
- **Mark live-dependent checks `pending-live`** (they need the migrations below) rather than failing them.
- Update `Pro-Suite-Progress.md` with the Ep7A row + the pending-live list.

### Track 2 — Live-DB apply runbook (GATED — London working session, do NOT apply)
- The execution agent **writes/validates the runbook** (`RESEARCH.md §Runbook`) — the exact migrations, apply
  order, idempotency, and post-apply verification queries — but **applies nothing to live Supabase.**
- Items: (1) `20260706_vcso_message_citations.sql`, (2) `20260706_citation_verifier_model_setting.sql`,
  (3) confirm the 15 A2 platform tables (esp. `reflection_reviews` likely absent; `cc_versions` vs
  `clarity_compass_versions`).

## Pre-Execution Checks
1. Read `RESEARCH.md` — the matrix, the live-apply runbook, the L18 items.
2. Confirm which families are lit vs dark today (CONTEXT §2 connection-phase reality; DP5).

## Success criteria
1. E2E matrix green for all **lit** families in both surfaces (against local/test fixtures or a branch DB);
   dark/dormant families explicitly marked, not failing.
2. L18 credential-debt items gathered + runnable parts exercised; the rest marked pending-live.
3. The live-DB runbook is complete + validated (idempotency + verification queries), **nothing applied live.**
4. `Pro-Suite-Progress.md` updated; CONTEXT §8 gets an A6 amendment noting matrix results + the pending-live set.

## Out of scope
Applying migrations to live Supabase (London session); Ep7B geometry (separate acceptance B3); §8 visual polish.
