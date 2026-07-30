# 04B — Step 0 Execution Kickoff: Canary Caps + Deterministic Activation Preflight

**Date:** 2026-07-29 · **You are:** the **execution agent** for Step 0 of the VCSO SDK migration's N=5
probe. **Cold pickup — this document is self-contained.** You do not need any prior conversation.

**Your job:** three bounded changes, a gate, and a report. **No live model spend. No arming. No canary.
No deletion.** Arming, canaries, and Step 3 deletion are each separately founder-authorized and none of
them is in your scope.

---

## 1. Where this sits, in one paragraph

ArchitectOS Pro is migrating Virtual CSO onto the Claude Agent SDK. The current step is a probe: prove the
native in-process worker surface delegates reliably, at **five consecutive passes on a pinned anchor
question** (N=5, currently 0/5). **Every flag is dark and nothing is live to any founder** — production
Virtual CSO still runs the pre-migration loop, which is the real safety net. There is no user-facing risk
in anything you do here. Step 0 is the no-spend preparation that must land before the first counted run.

Rationale for all three changes, with the evidence behind them, is recorded in
`.planning/orchestration-harness/phases/04B-vcso-sdk-migration/04B-NATIVE-SURFACE-PLAN.md` **§5B**. Read
that section if you want the why; this document carries the what.

---

## 2. Current state — verified 2026-07-29, re-confirm before you touch anything

- **Deployed head `c75ea99d` (v0.6.144).** Confirm it **cache-busted** before you do anything else:
  `https://api.architectospro.com/api/health` with a unique query param and `Cache-Control: no-cache`.
  A plain read can be served a stale CDN value. `arm_native_capture_canary.py:173–196` already implements
  exactly this check — reuse `confirm_deployed_head`, do not hand-roll a second one.
- **All flags dark.** Verified in `platform_ai_settings`: `vcso_sdk_loop.is_enabled=false`,
  `vcso_planner.is_enabled=false`, both `test_user_ids` and `diagnostic_user_ids` empty,
  `native_model_driven_enabled=false`, `diagnostic_sdk_stream_capture_enabled=false`.
  **They stay dark for the whole of Step 0.**
- **Live caps are `max_turns: 6` / `max_budget_usd: 0.25`** — this is what you are changing.
- Path A, the external worker MCP transport, `TURN_REGISTRY`, and the DB completion bridge are all present
  and unreachable. **Do not touch any of them.**

---

## 3. Deliverable — exactly three changes

### 3.1 Raise the canary caps to 12 turns / $0.50

In `python-backend/scripts/arm_native_capture_canary.py`:

| Location | Now | Change to |
|---|---|---|
| `build_armed_settings`, `:60` | `"max_turns": 6` | `"max_turns": 12` |
| `build_armed_settings`, `:61` | `"max_budget_usd": 0.25` | `"max_budget_usd": 0.50` |
| `assert_armed_state`, `:125` | `!= 6` | `!= 12` |
| `assert_armed_state`, `:127` | `!= 0.25` | `!= 0.50` |

Payload and readback assertion must move **together** — an armed payload the readback does not assert is
how a silent drift ships.

**Two constraints on this, both founder rulings — do not "improve" past them:**

1. **`12` is the hardcoded turn ceiling**, not a value you may exceed. `vcso_chat_service.py:696` applies
   `min(int(settings["max_turns"]), 12)`. If later runs exhaust turns at 12, raising further is a **code
   change and a founder decision** — it does not come to you. Note the ceiling in a code comment so the
   next reader does not try to raise it from the flag.
2. **Hold `$0.50`, not the `$1.00` ceiling** (`vcso_chat_service.py:699`). Budget exhaustion must stay
   informative. If runs land at $0.45–0.50 that is real data about the shape's cost and the cap is raised
   once, with evidence. **Do not set it to 1.0 for headroom.**

`build_dark_settings` is unchanged — the disarm path deliberately does not touch the caps.

### 3.2 Add a deterministic compile assertion — the new preflight

**New file:** `python-backend/scripts/verify_native_activation_compile.py`.

**Why it exists.** The activation facts are pure functions of settings × registry × capabilities. They need
no model turn. The turn they currently cost is not cheap either: since keyword eligibility was removed,
`native_subagent_requirements` (`vcso_sdk_loop.py:384–389`) returns both required workers for **any**
message once the flag is on and the founder is allowlisted, so a "throwaway" turn is a full two-worker
delegation — ~$0.15 and ~65 s, before the anchor is spent.

**What it does.** Reads the **live** `platform_ai_settings` row and runs `native_subagent_requirements` and
`compile_founder_sdk_options` **in-process against the real store**, then asserts:

| # | Assertion | Catches |
|---|---|---|
| A | `read_sdk_loop_settings(supabase, user_id=<founder>)["enabled"] is True` | **The two-allowlist trap.** `test_user_ids` gates the base loop; `diagnostic_user_ids` gates the native sub-flags. A canary was lost to the founder being in only one. |
| B | `native_subagent_requirements(message=<a deliberately NON-anchor string>, intent={}, settings=<live>, user_id=<founder>) == NATIVE_SURFACE_REQUIRED_AGENTS` | Eligibility is flag+allowlist. Using a non-anchor message also proves keyword eligibility is genuinely off. |
| C | `sdk_stream_capture_enabled(<live settings>, <founder>) is True` | Capture armed. |
| D | `set(compiled.lead_tool_names) == set(MODE_B_LEAD_TOOL_NAMES)` | **Live catalog drift.** `_select_definitions` filters against the enabled `tool_catalog`; a disabled row would silently strip `execute_code` or `get_dataset_periods` from the lead. |
| E | `compiled.options.tools == ["Task"]`, and **neither `"Task"` nor `"Agent"`** appears in `compiled.options.disallowed_tools` | The provision-vs-runtime name split. Blocking the runtime name hands the lead a delegation tool it may not call and it stalls to `max_turns` (`vcso_sdk_config.py:47–61`). |
| F | `set(compiled.options.agents) == set(NATIVE_GRANULAR_AGENT_TOOL_GRANTS)`; each `compiled.agent_tool_grants[key]` equals its configured grant list; each `AgentDefinition.mcpServers == [SDK_INTERNAL_SERVER]`; **no** agent tool name contains `vcso_workers` | The workers are on the in-process surface, not the external transport. |
| G | `compiled.options.max_turns == 12`; **every** `AgentDefinition.maxTurns >= GRANULAR_NATIVE_AGENT_MAX_TURNS` (6) | **The `maxTurns=1` bug that cost six cycles.** This assertion is the single highest-value line in the script. |
| H | Every granular grant's SDK name appears in `compiled.options.allowed_tools` | Defect 6 — under `dontAsk`, a subagent tool absent from the **parent's** `allowed_tools` is silently denied. |
| I | `compiled.options.max_budget_usd == 0.50` | The 3.1 change actually reaches the compile. |

Print a JSON verdict in the shape of the existing verifiers (`{"activated": bool, "checks": {...}, ...}`),
and **exit non-zero when any assertion fails.** Take `--founder-id` as an argument. **Do not hardcode or
commit a founder id.**

**Fidelity constraints — read these before you write the call.** The script must exercise the *shipping*
compile, not a lookalike. Production's call is `vcso_sdk_loop.py:3217–3249`.

- `enable_native_subagents=True` **and** `native_agent_tool_grants=NATIVE_GRANULAR_AGENT_TOOL_GRANTS`.
  Both together are what set `granular_native` (`vcso_sdk_config.py:120`). Either alone compiles a
  different architecture.
- **Pass `model_driven_worker_server_urls={}`.** Under `granular_native` the compiled output is identical
  whether or not URLs are supplied: `handler_tool` is forced `None` (`:200`) so the per-agent URL branch at
  `:202–222` is never taken, `model_driven_worker_tools` stays empty so `:303–307` adds nothing, and
  `:285`'s condition is satisfied by `granular_native` regardless. **Prove that equivalence in a unit test
  rather than asserting it in prose** — and do not mint `TURN_REGISTRY` tokens inside a preflight script.
- `native_subagent_tools={}` is acceptable for the same reason: under `granular_native`, handler tools
  affect only `mcp_servers` contents, never any name-level assertion. State this in the module docstring.
- **Any other deviation from the production argument set must be listed explicitly in your report.**
- **No mocks or fixtures for settings, store, registry, or capabilities.** A mocked substrate is precisely
  how this migration's three false greens shipped. If service credentials are unavailable, fail loudly —
  do not fall back to a stub.
- The script **must never write to `platform_ai_settings`.** It is read-only. It is not an arming path.

**Prove it fails closed.** Run it against the **current dark row**. It must report `activated: false`,
name the specific failing assertions, and exit non-zero. Paste that output into your report — a preflight
that has only ever been seen passing is not evidence.

### 3.3 Supersede the model-turn smoke in the preflight sequence

`verify_native_activation_smoke.py` is replaced **procedurally**, not deleted. Mark it superseded in its
module docstring, naming `verify_native_activation_compile.py` and the reason (it costs a full two-worker
delegation and verifies after the spend rather than before it). **Keep the file and its existing tests in
`unit_tests/test_native_capture_preflight.py`** — it is a harmless post-hoc evaluator, and deleting it
mid-probe churns a passing test file for no gain. Actual deletion, if wanted, is a separate founder call.

**`verify_native_surface_canary.py` is unchanged.** It remains the post-hoc countability check on a real
run and is not part of this step.

---

## 4. Gate — all of it, before you stop

- `python -m compileall` clean on the touched backend files.
- Frontend green (this step touches no `src/`, so this is a no-regression confirmation, not a build task).
- **Unit tests**, added to `python-backend/unit_tests/test_native_capture_preflight.py`:
  - the armed payload carries `max_turns: 12` / `max_budget_usd: 0.50`;
  - the readback assertion **rejects** `6` / `0.25` (assert the failure, not just the success — the readback
    is the guard, and a guard that only passes has not been tested);
  - the disarm path still clears both allowlists and every diagnostic switch;
  - the compile assertion passes on an armed-shaped settings object and fails closed on each individual
    mutation of it;
  - the `model_driven_worker_server_urls={}` equivalence from §3.2.
- **Version-tagged PATCH commit per logical unit** — three units: the caps change, the compile assertion
  plus its tests, the docstring supersede. Read the most recent commit message to find the current version
  and increment forward from there (head at handoff is **v0.6.144**). Versions only move forward; MINOR and
  MAJOR are the founder's call, never yours. **Commit each unit as you finish it — uncommitted work does
  not survive a session boundary.**
- **Deploy** via `main` (Railway + Vercel auto-deploy), then a **cache-busted** head confirmation that the
  deployed SHA matches your new head.
- **Read every flag back and confirm still dark** — `arm_native_capture_canary.py read` prints the
  sanitized state. Paste it.
- **No live model spend anywhere in this step.**

---

## 5. Stop point and what to report

**Stop after the gate. Do not arm, do not submit any turn, do not proceed to Step 1.**

Report, with every claim paired to a file, a line, a row, or a command output — **observe, don't infer;
code-verified is not observed**:

1. Deployed SHA before and after, both cache-busted, with the URL you used.
2. The four caps edits, by file and line.
3. The compile assertion script: the assertion list as implemented, any deviation from the production
   argument set, and the **fail-closed run output against the dark row**.
4. Unit test results — names and pass/fail, including the readback-rejects-6/0.25 test.
5. The commit list with version tags.
6. The final flag read-back showing dark.
7. Anything you found that this document did not predict — **negative and surprising results are the most
   valuable thing you can return.** Do not force a conclusion to fit the plan.

**Stop on the first failure.** Surface it with its evidence and wait. Do not retry blind, and do not work
around a blocker by widening scope.

---

## 6. Do not

- **Do not arm any flag**, enroll any founder in any allowlist, or run any canary. Arming is separately
  authorized, founder-only, and not part of Step 0.
- **Do not submit a Virtual CSO turn.** Zero live model spend.
- **Do not touch Path A**, `vcso_worker_mcp_server.py` / `vcso_worker_mcp.py`, `TURN_REGISTRY`, the token
  machinery, or the out-of-band completion bridge (`model_driven_completed_children`). They are frozen and
  may still be load-bearing; deletion is Step 3 and is separately gated.
- **Do not repoint or delete `diagnostic_cross_worker_probe`.** It targets the retired token boundary and a
  granular replacement is scheduled separately — but it stays with the transport until Step 3.
- **Do not raise `max_turns` above 12 or `max_budget_usd` above 0.50.**
- **Do not flip flag defaults**, change `build_dark_settings`, or alter eligibility, the access hook, the
  compute gate, the composer-integrity gate, or the required-worker set.
- **Do not edit the harness-root `ROADMAP.md`** (`.planning/orchestration-harness/ROADMAP.md`) — that is
  the separately founder-gated Phase G cutover.
- **Do not commit secrets.** `.env` and any credential file stay out of every commit.

---

## 7. Locks — binding, and no change may weaken one silently

Founder isolation · one writer (feed the OS Engine, never write the wiki) · cited provenance · cost-tier
routing at the capability grain with **no founder-facing model selector** · the context-selection IP ·
curated transparency (no raw payloads, no raw chain-of-thought) · bounded, non-recursive, depth-capped
workers.

## 8. Infra landmines

- **Keep `MCP_TOOL_TIMEOUT=240000`** (Railway environment only). It stays until Step 3 removes its cause.
- **Single process only** while `TURN_REGISTRY` exists — no `WEB_CONCURRENCY`, no `--workers`.
- **Do not re-add the per-agent `timeout` config key.** The deployed CLI rejects it and it broke delegation
  outright.
- `max_rounds` (`agent_capabilities.default_config`) and SDK `maxTurns` are **different concepts**.
  `max_rounds: 1` is correct for Path A. Conflating them starved subagents of the composing turn and cost
  six cycles. **Do not "fix" anything by editing `default_config.max_rounds`.**

---

## 9. Key files

```
python-backend/scripts/
  arm_native_capture_canary.py        :60–61 armed payload · :125–128 readback assertion ·
                                      :173–196 confirm_deployed_head (reuse this)
  verify_native_activation_compile.py NEW — the deterministic preflight
  verify_native_activation_smoke.py   supersede in docstring; keep the file and its tests
  verify_native_surface_canary.py     unchanged — post-hoc countability
python-backend/services/
  vcso_sdk_config.py                  :18–23 MODE_B_LEAD_TOOL_NAMES · :24–35 NATIVE_GRANULAR_AGENT_TOOL_GRANTS ·
                                      :41 GRANULAR_NATIVE_AGENT_MAX_TURNS · :47–61 Task/Agent name split ·
                                      :89–115 compile_founder_sdk_options · :120 granular_native ·
                                      :200–231 agent tool/server branch · :285–315 server + pre-approval
  vcso_sdk_loop.py                    :331–354 read_sdk_loop_settings · :357–404 native_subagent_requirements ·
                                      :99–102 NATIVE_SURFACE_REQUIRED_AGENTS · :518+ sdk_stream_capture_enabled ·
                                      :3217–3249 the production compile call to mirror
  vcso_chat_service.py                :696 max_turns ceiling (12) · :699 max_budget_usd ceiling (1.0)
python-backend/unit_tests/
  test_native_capture_preflight.py    extend this file
Supabase project pwacpjqkntnovndhspxt: platform_ai_settings (flags), agent_delegation_runs/steps, ai_usage_log
.planning/orchestration-harness/phases/04B-vcso-sdk-migration/
  04B-NATIVE-SURFACE-PLAN.md §5B      the evidence behind all three changes
```
