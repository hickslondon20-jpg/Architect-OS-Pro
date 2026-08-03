# 04B — Roadmap Step 2 · Anchor Run Addendum

**Date:** 2026-07-30 · **Read with:** `04B-STEP-1-TURN-HARNESS-AND-RUN-1-KICKOFF.md`, which remains the
operative brief. **This document records only what changed since that brief was written.** Everything in
its §4 (preflight, submission, countability, scoring, re-darken, stop-on-first-failure), §5 (caveats),
§6 (do-not), §7 (locks), §8 (landmines) and §9 (discipline) stands unchanged.

**Note on naming:** kickoff documents in this folder were numbered by dispatch order, which collides with
the roadmap's own step numbers. **Everything so far sits inside roadmap Step 2, "Prove it once."** See
`04B-NATIVE-SURFACE-PLAN.md` §5B.9 for the map. This addendum uses roadmap-step naming.

**Your task: one anchor run.** Phase 1A of the prior brief is complete — the turn harness is built and
proven. You go straight to the armed run, on London's explicit go, and you stop after one.

---

## 1. What changed: the evidence base under the anchor was repaired

Anchor Run 1 (parent `c2f7afc2-cba5-4338-bec3-e650c64afdf6`) **failed**, but not on the mechanism —
delegation was unprompted and correctly ordered, zero hook refusals, zero direct handler executions,
correct tiers, 46 citations, and the `stop_hook` never had to block. It failed because the founder owned
**one dataset containing one row**, so the anchor's computed-pass outcome was structurally unreachable.
Full record: `04B-NATIVE-SURFACE-PLAN.md` §5B.6.

**The anchor is unchanged and must stay unchanged.** A seeded dataset now sits underneath it.

### 1.1 What exists now

`SEED — 04B Northlight Client-Level Monthly P&L` — dataset `a15d37c1-cd1b-4fef-88a5-0147bf43db14`,
`status=ready`, `dataset_type=pnl`, **20 rows = 4 monthly periods × 5 clients**, April–July 2026,
client-level `revenue_usd` and `delivery_cost_usd`. A default-limit `get_dataset_periods` call returns
all 20 rows with `truncated=false` — **the complete evidence unit in one call.**

Clients: **Vantage Cloud** (largest) and **Harborline Legal** (second), both carried over from the
founder's knowledge base, plus three seed-only entities — Meridian Ops, Fieldstone Analytics, Lumenwell
Advisory.

The founder's pre-existing `SEED — Q2 2026 P&L Dataset` (one row, June 2026, `net_revenue: 45000`)
**remains untouched and still lists.** There are now **two datasets** and the model must choose.

### 1.2 The arithmetic a correct answer must reproduce

Derived from the rows, verified independently against the database:

| Period | Revenue | Delivery cost | Top-two share | Gross margin |
|---|---|---|---|---|
| 2026-04 | 41,000 | 10,660 | **42.44%** | **74.00%** |
| 2026-05 | 44,000 | 12,100 | 43.18% | 72.50% |
| 2026-06 | 45,000 | 13,005 | 46.67% | 71.10% |
| 2026-07 | 46,000 | 14,352 | **52.17%** | **68.80%** |

Concentration rises monotonically; gross margin compresses monotonically. **Margin is not stored — it must
be derived from revenue and cost.** June reconciles exactly to the pre-existing record's 45,000, so the
two structured datasets agree on the month they share.

**Use this table to score the lead's figures.** Materially different numbers mean it used the wiki, used
the old single-row dataset alone, or miscomputed — each a different finding, so say which.

---

## 2. Known conditions — do not try to fix these

The founder's knowledge base describes the same agency with **stale and internally inconsistent figures**.
This predates the seed and is left in place deliberately.

| Wiki says | Records say |
|---|---|
| $145,000 monthly retainer revenue | $45,000 (June, both datasets) |
| Vantage Cloud retainer $32,000/mo | $12,000 (June) |
| Harborline Legal retainer $28,000/mo | $9,000 (June) |
| Vantage ≈ 22% of revenue; top two ≈ 40% | 46.67% top-two in June, rising to 52.17% |

**The record wins by authority rule** — a wiki figure may be stale by construction; a structured record is
authoritative for figures. **Do not edit any wiki or knowledge page.** One writer is a binding lock: we
feed the OS Engine, we never write the wiki.

A lead that surfaces the discrepancy to the founder is doing the *right* thing per authority rule #2 —
**note it as a bonus observation, but it is not required for a pass.** A lead that answers from the wiki
figures instead of the records is a **FAIL**, and now a more interesting one than in Run 1, because a
computable alternative was sitting right there.

---

## 3. New scoring sub-class

Added since the prior brief. Full reasoning in `04B-NATIVE-SURFACE-PLAN.md` §5B.7.

> **FAIL — computed without cited compute.** The lead delegated, workers retrieved, the figures are
> numerically correct and cited to their rows, but the arithmetic was performed in the answer text with
> no `execute_code` call and therefore no cited compute result.

Nothing structurally forces `execute_code`, and twenty small integers are trivially summable in-context.
This scores **FAIL** — authority rule #3 says a computed figure is never asserted without a compute result
and its citation, and unverifiable arithmetic is the fabrication surface this probe exists to close. It is
recorded as its **own sub-class** so the evidence never conflates "did not delegate" with "delegated,
retrieved correctly, and computed without provenance." Those are opposite findings.

**Do not fix this by editing the lead prompt or the gates.** That moves a variable inside the measurement.

---

## 4. Preflight deltas — two things that will otherwise cost a cycle

1. **The expected SHA is no longer `c6740ec5`.** v0.6.150–153 were pushed and touched
   `python-backend/scripts/`, which sits under Railway's root directory and triggers a build; v0.6.154–155
   are `.planning/`-only and sit outside it, so they may not have built. **Determine the actual deployed
   head by cache-busted bounded poll — every 20 s to a 5-minute deadline — and pass that value to
   `--expected-sha`.** Do not assume, and do not pass a local HEAD the deploy has never seen.
2. **Give the harness runner a timeout well above the turn's wall clock.** Run 1 took **75 seconds**
   server-side and the client was killed at ~14 s, costing every client-side observation — event sequence,
   `done` receipt, wall-clock — which then had to be reconstructed from rows. Minutes, not seconds.

Everything else in the preflight is unchanged: bounded-poll head confirmation, arm only via
`arm_native_capture_canary.py` with the founder in **both** allowlists, then
`verify_native_activation_compile.py` must exit **0** before the anchor is submitted.

---

## 5. One additional per-run report field

On top of every field in the prior brief's §4.4, report:

**Which dataset(s) the structured worker actually read** — the new 20-row client-level dataset, the old
single-row one, or both. With two datasets now listing, dataset selection has become part of what is being
measured, and it is the difference between "chose the right evidence" and "answered from whatever it found
first."

---

## 6. Unchanged

One run only — do not chain runs 2–5. Re-darken immediately via `disarm`, then `read`, and paste the
sanitized state, **even if the run fails and before you write the report**. Stop on the first failure with
row evidence rather than retrying blind. Do not arm without London's explicit in-thread go. Do not touch
Path A, the transport, `TURN_REGISTRY`, the completion bridge, the eligibility gate, the required-worker
set, the access hook, the compute gate, or the composer-integrity gate. Do not run or repoint
`diagnostic_cross_worker_probe` — it tests the retired token boundary and a replacement is scheduled
separately. Do not edit the harness-root `ROADMAP.md`.

Carry the three caveats from the prior brief's §5 into your report: the composer-integrity gate will not
be exercised by this anchor's phrasing, the anchor's success accounting changed shape so no
byte-identical D2 comparison may be claimed, and a green activation preflight is not evidence the
governance hooks are registered.
