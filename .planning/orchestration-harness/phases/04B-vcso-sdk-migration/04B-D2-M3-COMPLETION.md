# 04B Phase D2 · SDK-M3 — Completion

**Date:** 2026-07-22 · **Deployed head at close:** `5041fa10` (`/api/health ok=true`)
**Flag state at close:** `vcso_sdk_loop` **dark**, both allowlists `[]`, `native_model_driven_enabled=false`;
`vcso_planner` dark/retired. Both read back off after the final turn.
**Plan:** `04B-D2-M3-PLAN.md` · **Run evidence:** `04B-D2-M3-CANARY-RUNBOOK.md` (per-run detail + final tally)

---

## What M3 was for

D2 tiers 1 and 2 were **proven once, not reliable**: delegation had run 3 passes / 2 failures across five
live runs on an **uncontrolled anchor**, and **Defect 7** — worker subagents able to call each other's
tools — was live and had gone unseen through the Tier-2 close. M3 had to make delegation *measurable*,
close Defect 7 as a dark-exit gate, add the reasoning quality (effort-scaling + per-worker contracts),
and exit on **N consecutive passes**, not one green run (Process Rule 10).

---

## Acceptance criteria — status

| # | Criterion | Status |
|---|---|---|
| 1 | Anchor pinned; stream keepalive, cheap give-up, diagnostics `try/finally` | **Met** (keepalive: shipped and code-verified, **not** directly observed — see Honest limits) |
| 2 | **Defect 7 closed** — a worker cannot call another worker's tool (test + canary) | **Met in code + unit test; canary evidence is negative** — see Honest limits |
| 3 | Effort-scaling both ways | **Met** (anchor decomposed 5/5; control answered directly, with the app-gating caveat) |
| 4 | Per-worker delegation contracts enforced | **Met** |
| 5 | **N/N consecutive delegations** (N = 5, founder-confirmed) | **Met — 5/5** |
| 6 | Path A retained; scaffolding not pruned; `compileall` clean; frontend green; docs updated | **Met** |

**Founder ruling (2026-07-22):** after run 4 the exit bar was **split** into Gate 1 (delegation
reliability) and Gate 2 (founder-visible delivery). Recorded in the runbook as a deliberate scope change,
not a quiet redefinition. **Gate 1 is closed. Gate 2 is open at 4/5.**

---

## What shipped

| Version | Change |
|---|---|
| v0.6.92 | The M3 plan + D2 roadmap status |
| v0.6.93 | **A + B**: pinned anchor module + tests; stream keepalive; cheap give-up; diagnostics drain in `try/finally`; **Defect 7 fix** — per-`(turn, capability)` worker tokens, per-capability compile URLs, static shared-token check in the runtime manifest |
| v0.6.94 | **C**: `WORKER_DELEGATION_CONTRACTS` (one explicit contract per worker), two-way effort-scaling clause, contract validator rejecting placeholder and sibling-reused objectives |
| v0.6.95 | Canary runbook (N = 5) + the `v0.6.89` version-collision note |
| v0.6.96–99, 101 | Per-run canary records |
| v0.6.100 | **Defect 8 fix** — recover the persisted turn when the SSE stream dies; bar split recorded |

**Tests:** 101 backend unit tests pass; wider backend suite 138 passed / 3 skipped; `compileall` clean;
6 new vitest cases for the Defect 8 recovery. `lib/presetScenarios.test.ts` has 7 failures **confirmed
pre-existing** (identical with these changes stashed).

---

## The reliability result

**Gate 1 — 5 / 5 consecutive.** Across the five runs: **15 Task delegations, 15 allowed on the first
attempt, zero denials; 15 worker child runs, 15 completed; 15 worker tool calls, every one on the
worker's own tool.** Correct tiers every run (Haiku workers / Sonnet compose). Compose cost held a tight
$0.132–$0.144 band. Answers 4,886–5,908 chars, 33 citations every time.

**The lead is reasoning, not replaying.** Delegation order varied between runs
(structured→wiki→sandbox on 1/3/5, structured→sandbox→wiki on 2/4) while the sandbox-after-structured
constraint held on all five. A deterministic path cannot produce that pattern; Path A by construction
could not either. This is the migration's original intent, evidenced.

---

## Honest limits — read these before treating anything as closed

1. **Defect 7's guard has never been seen firing.** Per-capability tokens are live on all five runs
   (`worker_token_scoping tokens=3`) and no cross-worker call occurred in 15 worker tool calls — versus
   Canary 9-retry and 10a, which each showed one. But **no run attempted a cross-worker call**, so the
   refusal path is proven only by unit test. The live evidence is *negative* (the leak stopped), which is
   what a closed gap should look like, and is not the same as watching the lock reject an attempt.

2. **The stream keepalive has not been directly observed.** SSE frames are not visible from the database
   and Railway request logs were not pulled. The relay path is confirmed by code inspection
   (`vcso_chat_service` does `yield from stream_vcso_sdk_turn`, so heartbeats pass unfiltered) — but code
   inspection is not observation. Run 4's disconnect was *not* the idle case it guards (the stream died
   ~12s in, before any silent gap), so it neither proves nor disproves it.

3. **Gate 2 is open, and Defect 8's fix does not close it.** The fix addresses the *consequence* — a
   founder losing an answer they paid for — not the *cause*. Run 4's early disconnect is **undetermined
   and unreproduced**. One failure in five is not a rate anyone should plan around.

4. **The effort-scaling control is app-gated.** A lookup/shallow intent never reaches the model-driven
   branch, so the control evidences **system-level** restraint, not model-level. The model-level claim
   rests on the lead prompt's clause and is only observable on turns that do reach the branch.

5. **Child usage attribution collapses onto one child.** All five runs wrote 2 `sub_agent` rows both
   attributed to the sandbox child. **Verified pre-existing** — Canary 8 and Canary 9-retry show the
   identical shape — so it is no worse than the standard the Tier-2 close was accepted on, but per-child
   cost pairing does **not** exist today. **M4 item.**

6. **Two run-5 process wobbles**, recorded in the runbook: a `linked: Financial` chip was visible in the
   composer (routing evidence indicates it did not affect the turn — stated as a reading, not a
   certainty), and the flag sat armed ~58 minutes waiting for the founder. Arm on the founder's go.

---

## Locks and constraints — all intact

`vcso_sdk_loop` dark and founder-only throughout; re-darkened after **every** turn, with both flags read
back off before any evidence was pulled. Founder isolation, one-writer, bounded non-recursive
sub-agents, Claude-lock (Sonnet compose / Haiku workers via the MA-06 tier map), no founder-facing model
selector, tier authority at the capability grain — all preserved. Path A untouched and still the dark
fallback; native scaffolding not pruned; `vcso_planner` retired. `MCP_TOOL_TIMEOUT=240000` untouched on
Railway and still load-bearing (sandbox ran 26.7s–98.2s across the five runs). Single-process only. No
defaults flipped; the harness-root `ROADMAP.md` not edited.

---

## Open items carried out of M3

| Item | Where |
|---|---|
| **Gate 2 / run-4 disconnect cause** — undetermined, unreproduced | blocks any non-dark exposure |
| **Defect 7 refusal never observed live** | consider a dark diagnostic that deliberately attempts a cross-worker call |
| **Keepalive delivery unobserved** | needs Railway request logs or an SSE capture |
| **Child usage attribution collapse** | M4 |
| Item 2(a) fault-injection rescue (`after_completion`) — still owed | was blocked behind Defect 7; now unblocked |
| Progress-bridge full C2 surface | M4 |

---

## STOP-and-review

**M3 stops here.** M4, and Phases E / F / G, are **not started**. The flag is dark. The decision for
London is whether Gate 1 at 5/5 is sufficient to call **D2 reliable/closed** with Gate 2 tracked as a
separate open item, or whether Gate 2 must also close before D2 moves off "proven once".
