# 04B G-Gate — Pressure-Test Findings + Sequencing Change (2026-07-23)

**Status:** G-gate **paused and re-scoped** after two A1 canary runs. Flags dark, allowlists empty. This
records what the runs proved, the defects they surfaced, and London's resulting decisions. Supersedes the
"G-gate → E → F" ordering; the new order is **E → F → G-gate** (see §5).

## 1. What was run
Two dark founder-canary runs of **A1** (structured+sandbox archetype: "If my top 2 clients churned this
year, what would it do to my margin and runway?"). No A2–A5 run. All observation-backed against
`agent_delegation_runs` / `agent_delegation_steps`.

| Run | Parent run | Shape observed | Verdict |
|---|---|---|---|
| A1 #1 | `f9657258-ff41-41f3-992a-be855166c7eb` | structured → sandbox (correct 2-worker shape) | ✗ — composer fabricated numbers |
| A1 #2 (retry) | `dc6b6e55-d4e0-4d4d-98fc-976f05fbde9c` | structured **only**, sandbox omitted | ✗ — under-decomposed + composer fabricated |

Between the runs: execution agent shipped `v0.6.116` (SHA `911e61fa`) — degraded-worker propagation fix
(a `could_not_compute` / `needs_review=true` worker can no longer be cached, chained, or counted
successful; Path A given the same protection) + G-gate attribution persistence. 98 unit / 6 integration
tests passed.

## 2. Observation-backed evidence
- **The sandbox genuinely had no data.** Worker `c768c2a7…` steps: `context_build` → `source_count: 0`;
  `execute_code returned an error`; result "Could not compute … No computed result is available." There is
  **no financial series** (one seed P&L row). A1 cannot produce a sound *numeric* answer until Phase F.
- **The composer fabricated regardless.** Run #1 parent printed a full scenario table (margin −20%/−28%,
  runway ~11/~8.7 mo) built from the **stale wiki** $45k/$65k figures, while the sandbox returned nothing.
- **Under model-choice the lead under-delegated.** Run #2 (`scope=g_gate_model_choice`, `sdk_phase=04B-G-GATE`
  — the v0.6.116 attribution fix **confirmed live**) brought only the structured worker; the composer did
  its own "defensible assumption" math ($24,750/mo = 55% of the stale $45k) with an internally unsound
  runway ($2,865 burn vs $65k cash ≈ 22 months, not the stated 2.5).
- **Stale-data compounding.** Both composer answers used the wiki's $45k revenue, not the current
  `agency_snapshot_economic_foundation` $480k — a live-vs-wiki freshness miss on top of the fabrication.

## 3. Three problem classes (separated)
1. **Composer self-computation (hard honesty defect — ship-blocker).** In *both* runs the composer
   asserted computed figures it derived itself, not from a compute worker. The v0.6.116 fix addressed the
   *plumbing* (degraded worker ≠ success) but not the composer's willingness to freelance math. Rubric
   #4/#5. **Must be fixed regardless of sequencing.** Chosen approach: a hard guardrail — the composer may
   not present quantitative/computed results without a compute-worker result + citation; if it can't
   compute, say so.
2. **Native capability-selection under-delegates on compute questions (the real generalization finding).**
   Left to choose, the lead did not recognize "this needs the sandbox." **Decision (London, 2026-07-23):
   native-reasoning-first** — tune the lead prompt / delegation contracts / tool descriptions so the model
   reliably brings the sandbox for compute questions; **no hard router** (that would betray the thesis).
   Add a narrow safety-net only if native won't hold after a real attempt. Seen once → "observed once,"
   not yet a reliable pattern (Rule 10).
3. **A1 is mis-scoped as a numeric gate pre-Phase-F.** No series → the sandbox can't compute. **Decision
   (London): hold the G-gate until Phase F** delivers the financial series, so A1 (and real sandbox
   compute) can be tested for real.

## 4. Deploy coherence — RESOLVED (2026-07-23)
Verified healthy: two live checks (including cache-busted) returned `ok=true` and SHA **`911e61fa`**
(v0.6.116, the integrity/attribution fix). Git `main`, `origin/main`, and Railway agree. Both feature
flags remain dark, allowlists empty. The earlier `feb3fe04` reading was a stale/cached deploy state, now
cleared. No half-landed fix outstanding.

## 5. Decisions & resulting sequence
- **Native-reasoning-first** for capability-selection (Problem 2).
- **Hold the G-gate until Phase F** (Problem 3). New order: **E → F → G-gate**.
- **Composer-integrity fix (Problem 1)** is a hard defect independent of sequencing — see the open
  question in §6 for *when* it lands.
- Post-F, the G-gate A1 becomes a **real numeric** test (not just shape+honesty), because F supplies the
  series. A2–A5 (sandbox-free) still test model-choice restraint and can run in the same post-F pass.

## 6. Composer-integrity fix — DECIDED: land NOW, before Phase E (2026-07-23)
Confirmed shared/live risk: `vcso_chat_service.py:111` supplies the common system prompt, and
`vcso_sdk_loop.py:1867` lets a failed Path A delegation **fail open to the standard SDK path** — so the
fabrication defect is live, not dark-only. It lands **now as standalone hardening**, ahead of Phase E, as
an **output-integrity gate** (not prompt tuning alone). Requirements: (1) no asserted quantitative result
without a successful compute result + citation; (2) a degraded/missing compute result yields an explicit
"cannot compute from current data" answer; (3) no composer-authored substitute arithmetic; (4) capability
selection stays native-reasoning-first — this guard governs **answer integrity, not routing**. Spec +
kickoff: `04B-COMPOSER-INTEGRITY-PLAN.md`. Sequencing after this hardening remains **E → F → G-gate**.

## 7. Discipline that held (worth banking)
The execution agent did the right things: stopped on each failure, re-darkened, never retried without an
explicit go, surfaced every claim with row evidence. The problem was not indiscipline — it was iterating
locally without a strategic frame. This doc is that frame.
