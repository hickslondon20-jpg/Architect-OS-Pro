# 04B Phase D2 · SDK-M3 — Completion

**Date:** 2026-07-22 (Gate 1) · 2026-07-23 (Gate 2 + carries observed) · **Deployed backend at close:**
`33fcde21` (`/api/health ok=true`); frontend on Vercel.
**Flag state at close:** `vcso_sdk_loop` **dark**, both allowlists `[]`, `native_model_driven_enabled=false`,
ALL diagnostic sub-flags (disconnect / drop-done / cross-worker-probe / fault / single-worker) off;
`vcso_planner` dark/retired. Read back off after the final turn.
**Plan:** `04B-D2-M3-PLAN.md` · **Run evidence:** `04B-D2-M3-CANARY-RUNBOOK.md` (per-run detail, final
tally, and the Gate-2 injection-canary section)

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
| 1 | Anchor pinned; stream keepalive, cheap give-up, diagnostics `try/finally` | **Met** (keepalive now **OBSERVED** — fired 11× in the DB metadata on the Gate-2 injection canary, 2026-07-23) |
| 2 | **Defect 7 closed** — a worker cannot call another worker's tool (test + canary) | **Met in code + unit test; canary evidence is negative** — see Honest limits |
| 3 | Effort-scaling both ways | **Met** (anchor decomposed 5/5; control answered directly, with the app-gating caveat) |
| 4 | Per-worker delegation contracts enforced | **Met** |
| 5 | **N/N consecutive delegations** (N = 5, founder-confirmed) | **Met — 5/5** |
| 6 | Path A retained; scaffolding not pruned; `compileall` clean; frontend green; docs updated | **Met** |

**Founder ruling (2026-07-22):** after run 4 the exit bar was **split** into Gate 1 (delegation
reliability) and Gate 2 (founder-visible delivery). Recorded in the runbook as a deliberate scope change,
not a quiet redefinition. **Gate 1 is closed (5/5).**

**Gate 2 — closed on founder ruling (2026-07-23).** The delivery gate was worked in a follow-up pass and
**London accepted it as met on code + canary-1 substance, no further canaries** (see the Gate-2 section
of the runbook). Summary:
- **Keepalive: OBSERVED.** The dark stream-disconnect injection canary (deployed `2370c48f`) reproduced
  run 4's shape on demand — backend completed, answer persisted with 33 citations — and the keepalive is
  now recorded firing **11×** in `agent_delegation_runs.metadata` (v0.6.103 observability), no Railway pull.
- **Defect 8 was incompletely fixed by v0.6.100, and the injection found it.** The recovery ran only on a
  clean stream end; a *killed* connection throws a network error that escaped it, so the founder saw a bare
  "network error." **v0.6.104** wraps the stream parser so **both** disconnect shapes reach the
  record-backed recovery.
- **Honest limit (carried, not smoothed over):** the v0.6.104 in-flight recovery has **not been observed
  running** — canary 1 recovered via a normal page reload, which bypasses it. Its correctness rests on code
  inspection + the `selectRecoverableAssistantMessage` unit tests. And because persistence is the turn's
  **last** step, zero-click no-reopen recovery is inherently limited to disconnects that occur after
  persistence; for a mid-turn death the friendly reopen-guidance copy is the correct behavior.

---

## What shipped

| Version | Change |
|---|---|
| v0.6.92 | The M3 plan + D2 roadmap status |
| v0.6.93 | **A + B**: pinned anchor module + tests; stream keepalive; cheap give-up; diagnostics drain in `try/finally`; **Defect 7 fix** — per-`(turn, capability)` worker tokens, per-capability compile URLs, static shared-token check in the runtime manifest |
| v0.6.94 | **C**: `WORKER_DELEGATION_CONTRACTS` (one explicit contract per worker), two-way effort-scaling clause, contract validator rejecting placeholder and sibling-reused objectives |
| v0.6.95 | Canary runbook (N = 5) + the `v0.6.89` version-collision note |
| v0.6.96–99, 101 | Per-run canary records |
| v0.6.100 | **Defect 8 fix (part 1)** — recover the persisted turn when the SSE stream dies; bar split recorded |
| v0.6.102 | Completion doc + roadmap/STATE update (Gate 1 close) |
| v0.6.103 | **Gate 2 instrumentation** — keepalive observability (lifecycle sink) + dark stream-disconnect injection |
| v0.6.104 | **Defect 8 fix (part 2)** — recover on a *thrown* stream error, not only a clean end (gap found by the injection canary) |
| v0.6.105 | Gate-2 injection canary 1 record + the persistence-is-last timing finding |

**Tests:** 108 backend unit tests pass (101 + 7 new: disconnect-injection gate ×6, keepalive observability
×1); wider backend suite 138 passed / 3 skipped; `compileall` clean; 6 vitest cases for the Defect 8
recovery selector; frontend `tsc` clean in `lib/virtualCsoApi.ts` (62 pre-existing Phase-6 errors elsewhere,
untouched). `lib/presetScenarios.test.ts` failures **confirmed pre-existing**.

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

1. ~~**Defect 7's guard has never been seen firing.**~~ **CLOSED — now observed (2026-07-23, injection
   canary 2).** A dark `cross_worker_probe` used `structured_data_agent`'s per-capability token to call
   `run_sandbox_execution_agent` (the exact Canary-10a shape) and the scope check **refused it**, recorded
   as `cross_worker_probe decision=refused ... "Capability sandbox_execution_agent is not permitted for
   this turn."` The guard is watched rejecting a real attempt; the earlier negative evidence is upgraded to
   a positive observation. Probe isolation confirmed (no spurious `worker_hop` entry).

2. **The stream keepalive is now OBSERVED** (updated 2026-07-23). The Gate-2 delivery pass made it
   report to the lifecycle sink; the injection canary recorded it firing **11×** in
   `agent_delegation_runs.metadata`. What remains unobserved is the v0.6.104 **in-flight recovery** code
   itself — canary 1 recovered via a normal page reload, which bypasses it (see limit 3).

3. **Gate 2 is closed, and the in-flight recovery is now OBSERVED (2026-07-23, injection canary 2).**
   London first accepted Gate 2 on code + canary-1 substance, then approved one more canary to *watch* the
   recovery fire (the discipline this session earned). With `diagnostic_stream_drop_done_enabled` armed the
   route withheld the answer tokens + terminal `done` (keepalives kept the connection alive → clean EOF,
   answer persisted, no `done`), and the founder confirmed the recovery signature — the cited answer
   **"appeared all at once after a pause," no reload**. Since the tokens were withheld from the stream, the
   answer could only have arrived via the Defect-8 recovery fetching the record. This exercises the
   **clean-EOF** recovery entry (v0.6.100); the **thrown-error** entry (v0.6.104) was exercised by canary 1
   (pre-fix bare error) and is covered by the fix + unit tests — both entries accounted for. Still true and
   unchanged: zero-click recovery is inherently limited to post-persistence disconnects (persistence is the
   turn's last step), and run 4's early-disconnect **cause** remains undetermined (not chased, per founder);
   Defect 8 handles the consequence.

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
| ~~Defect 8 in-flight recovery unobserved~~ | **CLOSED** — observed, injection canary 2 (drop-done) |
| ~~Defect 7 refusal never observed live~~ | **CLOSED** — observed, injection canary 2 (cross-worker probe refused) |
| **Run-4 disconnect cause** — undetermined, unreproduced | not chased (founder call); Defect 8 recovery makes it non-fatal |
| **GENERALIZATION unproven** (delegation shown on ONE anchor shape + a control) | **the true gate before wider founder exposure** — Phase-G-shaped; controlled question-shape expansion, not question count |
| **Child usage attribution collapse** | M4 |
| Item 2(a) fault-injection rescue (`after_completion`) — still owed | was blocked behind Defect 7; now unblocked |
| Progress-bridge full C2 surface | M4 |

---

## STOP-and-review

**D2 is reliable/closed on both gates, with every Gate-2 claim now backed by live observation** — Gate 1
(delegation reliability) at 5/5; Gate 2 (founder-visible delivery) with keepalive observed (canary 1+2),
Defect-7 guard observed refusing (canary 2), and in-flight recovery observed delivering (canary 2). Total
Gate-2 spend: 2 canaries (~$0.30). **M3 and the Gate-2 delivery pass stop here.** M4 and Phases E / F / G
are **not started**. Flag dark, all allowlists empty, all diagnostic sub-flags off, `vcso_planner`
untouched, Path A intact, harness-root `ROADMAP.md` not edited.

**The next gate is NOT the flag flip — it is GENERALIZATION.** D2 proved delegation reliability on **one**
pinned anchor shape plus a simple control; it did **not** prove the lead delegates sensibly across varied
strategic questions (different structures, different data needs). That is Phase-G's job and it has not
happened. Wider founder exposure without it is a bet on unproven generalization — the "a green thin-slice
doesn't mean it generalizes" trap flagged at the start of this work. **Recommended sequence (founder's
2026-07-23 direction):** (1) carries closed ✓; (2) prove generalization via a controlled expansion of
question *shapes* on the dark canary before any beta founder asks an unrehearsed one; (3) only then widen
the founder gate. Next decision is London's: scope the generalization pass, or hold.
