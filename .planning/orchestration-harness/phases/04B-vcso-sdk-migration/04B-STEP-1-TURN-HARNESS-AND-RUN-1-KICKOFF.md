# 04B — Step 1 Execution Kickoff: Turn Harness, then Canary Run 1 of N=5

**Date:** 2026-07-30 · **You are:** the **execution agent** for Step 1 of the VCSO SDK migration's N=5
probe. **Cold pickup — this document is self-contained.** You do not need any prior conversation.

**This document has two phases and a hard stop between them.**

- **Phase 1A — build and prove a turn-submission harness.** No arming. No native surface.
- **Phase 1B — Canary Run 1 of 5.** **Only after London gives an explicit in-thread go.** Arming is
  founder-gated and is never yours to initiate.

**Do not read ahead and start 1B. Do not arm anything in 1A.** Read the whole document first, then work
1A only.

---

## 1. Where this sits

ArchitectOS Pro is migrating Virtual CSO onto the Claude Agent SDK. The current gate is a reliability
measurement: **five consecutive passes on a pinned anchor question** (N=5, currently **0/5**). The
architecture already ran end to end successfully on 2026-07-29 — subagents delegate, run multi-turn, and
return findings in-band; the access hook and compute gate enforce observably; evidence persists. **N=5 is
a reliability measurement, not a question of whether it functions.** Do not redesign it.

**Every flag is dark and nothing is live to any founder.** Production Virtual CSO runs the pre-migration
loop, which is the real safety net. Step 0 completed on deployed head `c6740ec5`: canary caps raised to
`max_turns: 12` / `max_budget_usd: 0.50` **at arm time**, and a deterministic zero-spend activation
preflight landed.

Context, if you want the why: `04B-NATIVE-SURFACE-PLAN.md` (§5 the probe, §5B the Step 0 findings, §6
acceptance criteria) and `04B-ORCHESTRATION-HANDOFF-N5-ONWARD.md` (§4 the scoring contract, §5 what is
settled and must not be re-derived). **Read §5 of the latter before forming any hypothesis** — six
questions are already settled and re-opening them is the most expensive mistake available to you.

---

## 2. Why Phase 1A exists

Every canary in this migration's history was **typed into the chat box by the founder**. No asset submits
a turn. `POST /api/vcso/chat` requires a Supabase bearer JWT via `get_current_user_id`
(`routers/kb_folders.py:55–73`), and every script in `python-backend/scripts/` is either a post-hoc row
reader or a local stub-driven probe.

Runs are now driven by you, not the founder. That requires a harness — and **the harness must be proven
before it is trusted with a counted run.** A client that drops the SSE stream early reproduces the exact
Defect 8 disconnect shape this migration already spent canaries on, and if that bug lives in the harness
it will be scored against the architecture. Prove the instrument before you measure with it.

---

## 3. Phase 1A — build and prove the harness

### 3.1 Deliverable

**New file:** `python-backend/scripts/submit_vcso_canary_turn.py`.

It must:

1. **Authenticate as the founder** via Supabase `sign_in_with_password`, with credentials read from the
   untracked `python-backend/.env`. **Never commit credentials, never print the token or the password**,
   and never write them to any artifact. Fail loudly if the credentials are absent — do not fall back.
2. **Send the anchor byte-for-byte by importing it**:
   `from services.vcso_canary_anchor import PINNED_ANCHOR_PROMPT`. **Do not retype, reformat, or
   "improve" the prompt string.** Canary 9 failed on an agent-authored replacement anchor, which is why
   the anchor is pinned in version control and guarded by `test_vcso_canary_anchor.py`. Accept a
   `--prompt-mode {anchor,smoke}` switch where `smoke` sends a short throwaway string for 1A and `anchor`
   sends `PINNED_ANCHOR_PROMPT`; there must be **no free-text prompt argument at all.**
3. **Consume the SSE stream to completion.** Set a generous client read timeout — minutes, not seconds; a
   short timeout is the disconnect bug. Record every event type received in order, whether the terminal
   `done` event arrived, total wall-clock, and the byte or token count of the answer.
4. **Capture and print the parent run id** so the verifiers can be pointed at it, plus the thread id and
   message id. Determine how the run id surfaces (stream payload or a `agent_delegation_runs` lookup by
   thread and message) and **state in your report which mechanism you used.**
5. **Emit a JSON summary** and exit non-zero on any failure — non-200, auth failure, stream aborted, no
   `done`, or no run id captured.
6. **Write nothing.** It must never touch `platform_ai_settings` and must never arm anything. It is a
   client, not an operator tool.

### 3.2 Prove it — one unarmed turn

**With every flag still dark**, run it once in `smoke` mode. The flat pre-migration path answers; the
native surface is not involved and no worker is required. This costs a small amount of ordinary live model
spend — that is expected and is the price of not discovering a harness bug inside a counted run.

Confirm from rows, not from the script's own output:

- a new `agent_delegation_runs` parent row exists for that turn;
- `ai_usage_log` shows the spend for it;
- the stream reached `done` and the client did not abort;
- **no** child `agent_delegation_runs` rows were created (flags are dark — if children appear, stop
  immediately and report, because something is armed that should not be).

### 3.3 Phase 1A gate

`compileall` clean; unit tests covering the anchor-import path (assert the submitted string is identical
to `PINNED_ANCHOR_PROMPT` and that no free-text prompt argument exists) and the fail-closed exits;
version-tagged PATCH commit per logical unit, incrementing forward from the latest commit message; deploy
is **not required** for this step — the harness runs from the operator machine — but if you do push,
confirm the head cache-busted afterwards as a **bounded poll** (every 20 s to a 5-minute deadline; Railway
builds in ~2.5 minutes, and a single immediate read returning the previous SHA is expected, not a fault).

**Then STOP and report. Do not proceed to 1B.** Include: the harness design and the run-id mechanism, the
smoke turn's parent run id, the row evidence above, the spend, the event sequence, and the commit list.

**Also commit, as your first unit, the two uncommitted planning documents** in
`.planning/orchestration-harness/phases/04B-vcso-sdk-migration/` —
`04B-NATIVE-SURFACE-PLAN.md` (§5B.4) and `04B-ORCHESTRATION-HANDOFF-N5-ONWARD.md` (§4 corrections).

---

## 4. Phase 1B — Canary Run 1 of 5

**Do not begin until London has said go, in this thread, explicitly.** Not implied, not inferred from
approval of Phase 1A.

### 4.1 Preflight, every time, no exceptions

1. **Cache-busted deployed head confirmation**, bounded poll as above. A plain read can be served stale.
2. **Arm with `python-backend/scripts/arm_native_capture_canary.py arm --founder-id <id>
   --expected-sha <sha> --confirm ARM-ONE-CAPTURE-CANARY`.** It requires a dark starting state, SHA
   confirmation, membership in **both** allowlists, one atomic update, and readback. **Never arm by hand.**
   Two allowlists exist with different jobs: `test_user_ids` gates the base loop, `diagnostic_user_ids`
   gates the native sub-flags, and **the founder must be in both.** A canary was lost to exactly this.
3. **`python-backend/scripts/verify_native_activation_compile.py --founder-id <id>`** — deterministic,
   zero-spend, no model turn. It must exit 0. **If it fails, do not submit the anchor.** Validate before
   spending, not after.
   Its known limitation: it compiles with `hooks={}`, so it proves the *surface*, not that the access
   hook, compute gate, or lifecycle writers are registered. **A green preflight is not evidence the
   governance gates are armed** — that comes from the run's own lifecycle rows.

### 4.2 Submit exactly one run

`submit_vcso_canary_turn.py --prompt-mode anchor`. One run. **Do not chain runs 2–5** — Run 1 reports back
for verification before the count continues.

**Do not change `max_turns` or `max_budget_usd`.** They are set by the arming script at 12 / $0.50. Turn or
budget exhaustion *with correct delegation* is a **capacity finding**, scored separately, not a failure.

### 4.3 Verify countability, then score

Run `python-backend/scripts/verify_native_surface_canary.py --user-id <id> --run-id <parent>`. A run that
does not carry `sdk_phase=04B-D`, `native_subagent_mode=true`, and a non-empty `available_subagents` is
**void** — it counts neither way.

Then score against **three outcome classes**:

- **PASS — delegated and computed.** Delegation via `Task`, required workers complete, a cited compute
  result present, correct model tiers, citations intact, **zero direct handler calls executed.**
- **PASS — delegated and honestly declined.** The lead delegates, workers retrieve, and the lead declines
  to assert a computed figure because one period cannot support a trend. **Capture its exact wording
  verbatim** — it is direct input to the Phase G reflect-and-steer requirement.
- **FAIL.** No delegation; a required worker produces nothing usable; a direct handler call **executes**;
  wrong tiers; missing citations; **or the lead asserts a computed or directional figure from a single
  period.**

**Not failures:** a hook-refused lead attempt (count it, report the rate, and say whether the lead
recovered by delegating). A worker completing as `partial` after safely refusing an optional tool — that is
now correct behaviour.

**A Mode B answer to the anchor is a FAILURE, not a pass.** The anchor requires computation over a
multi-period series; direct wiki or dataset reads cannot produce it.

### 4.4 Report these fields, every one paired to a row

Outcome class · delegation shape and order · **whether the `stop_hook` ever had to block** · hook-refusal
count and whether the lead recovered · turn and budget consumption · child run outcomes including any
`partial` status · whether per-child cost attribution held · the integrity-gate decision code · the exact
declining wording if the outcome was an honest decline.

**The `stop_hook` line matters most.** If it never blocks, the lead chose delegation unprompted and the
required-worker scaffolding was inert — the closest thing to a rubric #1 reading this probe can honestly
produce.

### 4.5 Re-darken immediately

`arm_native_capture_canary.py disarm --confirm RE-DARKEN-04B`, then `read`, and paste the sanitized state.
**Re-darken even if the run failed. Re-darken before you write your report.**

### 4.6 Stop on the first failure

Surface it with its row evidence and wait. **Do not retry blind**, do not adjust the architecture, and do
not "try once more to see." A single failure resets the count and is a finding to be reported, not a
setback to be worked around.

---

## 5. Caveats you must carry into your report — do not let a green be over-read

1. **N=5 will not exercise the composer-integrity gate.** It keys off *question* phrasing
   (`COMPUTE_REQUEST_SIGNALS`) and the anchor is phrased as advice; it has recorded `not_required` on three
   consecutive live runs. The "asserts a computed figure" hard-fail is enforced by **manual scoring only**.
   Nobody may later read a 5/5 as proof that the gate holds.
2. **The anchor's success accounting changed shape** when the sandbox stopped being a subagent — two worker
   children plus a cited compute result, not three children. Same question under test, different evidence
   criteria. **Do not claim a byte-identical comparison to the D2 baseline.**
3. **A green activation preflight is not evidence the governance hooks are registered** (§4.1).

---

## 6. Do not

- **Do not arm anything in Phase 1A**, and do not arm in 1B without London's explicit in-thread go.
- **Do not run runs 2–5.** Run 1 reports back first.
- **Do not change `max_turns`, `max_budget_usd`, the required-worker set, the eligibility gate, the access
  hook, the compute gate, or the composer-integrity gate.**
- **Do not touch Path A**, `vcso_worker_mcp_server.py` / `vcso_worker_mcp.py`, `TURN_REGISTRY`, the token
  machinery, or the out-of-band completion bridge. Frozen; deletion is Step 3 and separately gated.
- **Do not run or repoint `diagnostic_cross_worker_probe`.** It exercises the retired `TURN_REGISTRY`
  boundary, not the access hook the granular surface actually uses, so a refusal from it would prove the
  wrong thing. A replacement is scheduled separately, after 5/5.
- **Do not edit the harness-root `ROADMAP.md`** (`.planning/orchestration-harness/ROADMAP.md`).
- **Do not commit secrets.** The founder credentials stay in the untracked `.env` and appear in no output,
  no log, and no report.
- **Do not scale the service.** Replicas must stay at 1 — see §8.

---

## 7. Locks — binding, and no change may weaken one silently

Founder isolation · one writer (feed the OS Engine, never write the wiki) · cited provenance · cost-tier
routing at the capability grain with **no founder-facing model selector** · the context-selection IP ·
curated transparency (no raw payloads, no raw chain-of-thought) · bounded, non-recursive, depth-capped
workers.

## 8. Infra landmines

- **Keep `MCP_TOOL_TIMEOUT=240000`** (Railway environment only) until Step 3 removes its cause.
- **Single process only.** `TURN_REGISTRY` is process-global. Railway replicas are set to **1**, and that
  configuration — not any code — is what holds the constraint. No `WEB_CONCURRENCY`, no `--workers`, no
  scaling.
- **Do not re-add the per-agent `timeout` config key.** The deployed CLI rejects it and it broke delegation
  outright.
- `max_rounds` (`agent_capabilities.default_config`) and SDK `maxTurns` are **different concepts**.
  `max_rounds: 1` is correct for Path A. Conflating them cost six cycles. Never re-collapse them, and do
  not "fix" anything by editing `default_config.max_rounds`.

## 9. Discipline

**Observe, don't infer.** Pair every claim to a row, a trace, or a log line. This migration has shipped
three false greens, each caught only by live observation. **Code-verified is not observed.** Report
negative and surprising results as results — they are worth more than a tidy conclusion. Version tags
always move forward; PATCH per logical unit; MINOR and MAJOR are London's call. **Commit each unit as you
finish it — uncommitted work does not survive a session boundary.**

## 10. Key files

```
python-backend/scripts/
  submit_vcso_canary_turn.py          NEW — the turn harness (Phase 1A)
  arm_native_capture_canary.py        arm / disarm / read — the only arming path
  verify_native_activation_compile.py zero-spend preflight; must exit 0 before the anchor
  verify_native_surface_canary.py     post-hoc countability on the parent run
python-backend/services/
  vcso_canary_anchor.py               PINNED_ANCHOR_PROMPT — import it, never retype it
  vcso_sdk_loop.py                    :99–102 NATIVE_SURFACE_REQUIRED_AGENTS · :357–404 eligibility ·
                                      :1341 access hook · :1513 stop_hook required-set blocking
  vcso_sdk_config.py                  :18–35 Mode B surface and granular grants · :41 worker turn floor
python-backend/main.py                :1262 POST /api/vcso/chat
python-backend/routers/kb_folders.py  :55–73 get_current_user_id — the bearer JWT contract
Supabase project pwacpjqkntnovndhspxt: platform_ai_settings, agent_delegation_runs, agent_delegation_steps,
                                       ai_usage_log
```

## 11. Out of scope

Runs 2–5. The two mandatory negative tests and the granular cross-worker probe they require. The single
watched UI turn that supplies the nested-surface render proof after 5/5. Step 3 deletion. Phases E, F, G.
Domain Agents. **None of these are yours in this step.**
