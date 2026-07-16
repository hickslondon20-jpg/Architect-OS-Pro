# 04B Phase D — Remediation (Root Cause + Proposed Minimal Fix)

**Status:** **ROOT CAUSE CONFIRMED — STOP FOR LONDON REVIEW BEFORE IMPLEMENTING** (2026-07-16)

**Diagnosed against:** `main` at `c929d89f` (v0.6.52); Claude Agent SDK `0.2.118`
(vendored at `python-backend/venv/.../claude_agent_sdk`); failure evidence in
`04B-D-COMPLETION.md`.

**Scope of this document:** diagnosis only. No code changed, no flag touched, no commit made.
`vcso_sdk_loop` and `vcso_planner` remain dark, founder-only allowlists empty, global/default off.

---

## 1. The failure, restated

The founder-only SDK canary persisted the correct deep intent
(`strategic_synthesis / deep / 0.97`) and rendered the four-step plan, then the live SDK transcript
denied the three handler-backed worker tools — `run_structured_data_agent`,
`run_sandbox_execution_agent`, `run_per_user_wiki`. Zero child runs were created, the stop hook kept
blocking on the missing required workers, the parent exhausted its six-turn cap, and the UI persisted
the safe-failure response. (`04B-D-COMPLETION.md`, "Final anchor run".)

---

## 2. Confirmed root cause

**The `run_<agent>` handler tools are never placed in the SDK's global auto-approve list
(`allowed_tools`). Under `permission_mode="dontAsk"`, any tool that is not pre-approved is denied — and
because `allowed_tools` is a single *global* grant that also governs subagent tool calls, every
subagent's call to its sole implementation tool `mcp__architectos__run_<agent>` is denied before it
can run. That handler is the code that calls `SubAgentOrchestrator.start_run`, so no child run row is
ever created.**

### Evidence chain

**A. `dontAsk` denies anything not pre-approved.**
`claude_agent_sdk/types.py:1783` — `"dontAsk" — Don't prompt for permissions; deny if not
pre-approved.` `allowed_tools` is the pre-approval list: `types.py:1740–1744` — *"Tool names that are
auto-allowed without prompting for permission."*

**B. `allowed_tools` is a single GLOBAL grant, applied to subagents too.**
The transport serializes it exactly once as `--allowedTools` (`_internal/transport/subprocess_cli.py:317–318`).
`AgentDefinition` (`types.py:84–102`) has **no** `allowed_tools` / auto-approve field — only `tools`
(which tools are *visible* to the subagent) and `disallowedTools`. There is therefore no per-agent
allowlist: a subagent's tool call is auto-approved only if the tool is in the one global
`allowed_tools`. A tool can be *visible* to a subagent (via `AgentDefinition.tools`) yet still be
*denied* at execution because it is not in `allowed_tools`.

**C. The handler tools are never added to `allowed_tools`.**
- `vcso_sdk_config.py:149–151` builds `main_allowed_tools` from the *selected regular tools* plus
  `"Task"`. The `mcp__architectos__run_<agent>` handler tools are **not** in `selected`, so they are
  never added here.
- `vcso_sdk_loop.py:769` then hard-overrides in native mode: `options.allowed_tools = ["Task"]` —
  leaving `Task` as the *only* pre-approved tool for the entire session (lead and subagents).

**D. The subagents are told to call exactly those denied tools.**
Each handler-backed subagent is compiled with `tools = ["mcp__architectos__run_<capability_key>"]`
(`vcso_sdk_config.py:106`) and a prompt that says *"Your one implementation tool is
`run_<agent>` … call that tool exactly once …"* (`vcso_sdk_config.py:297–303`). The handler tool is
defined in `make_native_handler_tool` (`vcso_sdk_loop.py:612–721`) as `run_<capability_key>`, and it
is the *only* place `SubAgentOrchestrator.start_run` is invoked (`:654–671`). Denying it guarantees
zero child rows.

**E. No hook rescues the handler call.**
The only `PreToolUse` hook registered is `matcher="Task"` → `pre_task_use`
(`vcso_sdk_loop.py:737`). There is **no** `PreToolUse` matcher for `mcp__architectos__run_*`, so no
hook can pre-approve the handler under `dontAsk`. (The `PostToolUse` matcher `^mcp__.*$` at `:728`
runs *after* execution and only emits a trace — it cannot grant permission.) The denied names in the
transcript are the `run_<agent>` tools, **not** `Task`, confirming the deny came from the permission
layer, not from `pre_task_use`.

This is fully consistent with the observed symptom set: the plan renders (it is emitted unconditionally
at `:346`), `Task` succeeds (it is in `allowed_tools`, so subagents spawn), each subagent's handler
call is denied, `completed_agents` stays empty, `stop_hook` blocks on the missing required workers
(`:543–553`), and the loop safe-fails at the six-turn cap.

---

## 3. Hypothesis adjudication

| # | Hypothesis | Verdict | Basis |
|---|---|---|---|
| **H1** | `run_<agent>` tools absent from the grant; `dontAsk` denies any unlisted tool | **CONFIRMED (with one refinement)** | Sections 2A–2D. Refinement: `allowed_tools` is *global*, not "the lead's" — the denied calls originate from the **subagents**, so the fix must make the handler tools pre-approvable for the subagent lifecycle, not merely for the lead. |
| **H2** | Half-migrated design: runtime invokes `run_<agent>` while the grant reflects the `Task(subagent_type=…)` design (or vice versa) | **RULED OUT as stated; partial truth** | The runtime is internally coherent: lead → `Task` → subagent → `run_<agent>` handler (`_native_lead_prompt` :1101–1116; `pre_task_use` :429–472; handler :612–721). It is not half-migrated between two invocation styles. The real gap is narrower: the permission **grant** covers only the first hop (`Task`) and omits the handler hop. Incomplete allowlist, not a mixed design. |
| **H3** | Name mismatch between invoked tool / `subagent_type` and registered `AgentDefinition` keys / capability keys | **RULED OUT** | Keys align end-to-end: `AgentDefinition` keyed by `capability.capability_key`; `subagent_type` validated against `required_agents` = `("structured_data_agent","sandbox_execution_agent","per_user_wiki")` (:440); handler name `run_{capability_key}` matches on both sides (`vcso_sdk_config.py:307–308` and `vcso_sdk_loop.py:613`). A name/resolution failure would surface as "unknown tool," not "permission denied." The transcript says denied. |
| **H4** | `pre_task_use` hook denies | **RULED OUT** | `pre_task_use` matches only `Task` (:737) and returns `allow` for a valid contract (:466–472). The denied names are `run_<agent>`, not `Task`. A `pre_task_use` denial would have named `Task`. |

**Surviving root cause: H1**, corrected to reflect that `allowed_tools` is a global grant governing
subagent calls, and that the missing tools are called by the subagents.

---

## 4. Why the 38 focused tests passed but live failed

The focused tests inject a fake `query_impl`, which bypasses the real `claude` CLI subprocess and its
permission engine entirely. The permission gate that denies the handler tools lives in the CLI
(`--allowedTools` + `dontAsk`), so a mocked `query_impl` cannot exercise it. The defect is only
observable on the live SDK path — exactly where it appeared.

---

## 5. Proposed minimal fix (for London's decision — NOT yet implemented)

The fix must let the handler tools execute **inside the Task → subagent lifecycle** without opening a
direct-call path that bypasses the `pre_task_use` guardrails (contract parse, dependency ordering,
single-run, delegation cap). Two candidate fixes, narrowest first:

### Option 1 — Add a `PreToolUse` allow-hook for the handler tools (RECOMMENDED)

Add one `PreToolUse` matcher for `^mcp__architectos__run_` whose hook returns
`permissionDecision: "allow"` for the approved required workers, and register it alongside the existing
`Task` matcher (`vcso_sdk_loop.py:737`). Keep `options.allowed_tools = ["Task"]`.

- **Why:** under `dontAsk`, a `PreToolUse` "allow" *is* pre-approval (the same mechanism `pre_task_use`
  already uses for `Task`). This permits the handler call within the native lifecycle while leaving the
  lead's *global* grant as `Task`-only, so the delegation-first guarantee and the `pre_task_use`
  contract guardrails stay intact.
- **Change size:** ~1 small hook function + 1 `HookMatcher` line (~10–15 lines), behind the existing
  `native_mode` branch.
- **Blast radius:** native (`vcso_sdk_loop`) path only, which is dark and founder-only. Zero effect on
  the flat/fallback path, effort-scaling, or forced-fail-open (all of which stay on
  `allowed_tools`/no-native-hooks paths). The new hook only ever returns "allow" for the three
  approved `run_<agent>` tools; everything else is unchanged.
- **Risk:** low. Main design point for London: whether to additionally gate the allow on subagent
  context (`ToolPermissionContext.agent_id`, `types.py:213–214`) so a lead that ignores its prompt and
  calls `run_<agent>` directly is still denied. Recommended: yes, gate on subagent context for
  defense-in-depth; it is a few extra lines.

### Option 2 — Add the handler tool names to `allowed_tools`

At `vcso_sdk_loop.py:769`, set
`options.allowed_tools = ["Task", *(f"mcp__architectos__run_{k}" for k in required_agents)]`.

- **Change size:** truly one line.
- **Blast radius:** native path only, dark/founder-only.
- **Risk — higher than Option 1:** a global `allowed_tools` entry auto-approves the tool for **every**
  agent, including the **lead**. A lead that calls `run_<agent>` directly would then bypass
  `pre_task_use` entirely — skipping contract validation, the structured-data→sandbox dependency guard
  (`:446–451`), the single-run and delegation-cap checks, and the `emit_subagent_start` UI chip — and
  `post_tool_use` for `run_*` only records a trace (`:476–478`), so the nested MA-05 rendering would
  not be built. This re-opens the exact class of "dropped/unguarded child" defect Phase D exists to
  fix. Not recommended despite the smaller diff.

**Recommendation:** Option 1, subagent-context-gated. It is the narrowest change that restores
delegation *and* preserves every guardrail the P4 thin-slice depends on.

---

## 6. What this remediation deliberately does NOT do

Per the checkpoint constraints: no implementation yet (awaiting London), no commit, no flag change,
`vcso_planner` stays retired, no broadening of question types, no touch to the flat/fallback path, no
Phase E start, and the harness-root `ROADMAP.md` is untouched. The confirmed-passing behaviors
(effort-scaling-down, forced-error fail-open, safe-failure UI, sandbox `scipy`/`statsmodels`,
`tier_worker → claude-haiku-4-5` resolution) are all outside the changed surface and remain intact.

---

## 7. Next step (gated on London)

1. **London reviews** this root cause and picks Option 1 (recommended) vs Option 2.
2. **If approved:** implement the minimal fix behind `vcso_sdk_loop` (dark), enroll only the founder,
   and run the **one-worker repro** — a single approved worker delegated in isolation — to prove the
   handler now executes and one child run row is created with correct `parent_run_id` and
   `tier_worker → claude-haiku-4-5` attribution. **Then STOP.** Do **not** run the full three-worker
   anchor proof; that remains a separate, separately-gated step. Re-darken and empty the founder
   allowlist immediately after the repro.

---

## 8. Implementation record — Option 1 applied (pending commit)

**London approved Option 1 (2026-07-16).** Implemented on disk in the GitHub-linked repo
(`ArchitectOS Pro_beta`, NOT the retired OneDrive path):

- `python-backend/services/vcso_sdk_loop.py`
  - Added `pre_worker_handler` (a `PreToolUse` hook): returns `permissionDecision: "allow"` for
    `mcp__architectos__run_<capability>` **only when** the call fires from inside a Task-spawned
    subagent (`agent_id` present in the hook input) **and** the capability is in `required_agents`.
    Any other caller — notably a direct lead call (no `agent_id`) — is denied, so `pre_task_use`
    remains the sole delegation entry path and its contract/ordering/cap guardrails cannot be bypassed.
  - Registered a second `PreToolUse` matcher `rf"^mcp__{SDK_TOOL_SERVER_NAME}__run_"` → `pre_worker_handler`
    alongside the existing `matcher="Task"` → `pre_task_use`. `options.allowed_tools` stays `["Task"]`,
    so the lead remains delegation-first.
- Diff: +38 / −1, native (`vcso_sdk_loop`) path only. `vcso_sdk_config.py` unchanged.
- Verified: `py_compile` clean on both `vcso_sdk_loop.py` and `vcso_sdk_config.py`; `git diff` shows
  exactly the two intended hunks.

**Not yet done (blocked / gated):**
- **Commit `v0.6.53`** — could not be created from the agent sandbox: this mount blocks the file ops
  git requires (`unlink … Operation not permitted`; `git commit` stalls). A stale `.git/index.lock`
  (05:43) is present and could not be removed from the sandbox. Commit from a host where git can write:
  `git commit -m "v0.6.53 Permit Phase-D native worker handlers in subagent lifecycle"`.
- **One-worker repro** — must be run in the live environment (dark flag, founder-scoped, live backend +
  Supabase; not runnable from the agent sandbox). Enroll only the founder under `vcso_sdk_loop`,
  delegate a single approved worker in isolation, confirm one child `agent_delegation_runs` row is
  created with correct `parent_run_id` and `tier_worker → claude-haiku-4-5` attribution, then STOP and
  re-darken. **Do not run the full three-worker anchor** — that remains a separate, separately-gated step.

---

## 10. Why the deployed Option-1 hook failed, and the corrected fix

**Correction of record:** `v0.6.53` was committed, pushed, and is the ACTIVE Railway deployment on
`api.architectospro.com`. The §8 "commit blocked" note was a stale sandbox artifact — the repro did
test the live fix. It still produced zero child rows.

### 10.1 What the SDK source proves (definitive)

From the vendored SDK `0.2.118` (`python-backend/venv/.../claude_agent_sdk`):

- **`--allowedTools` is one global grant.** `_internal/transport/subprocess_cli.py:317` serializes
  `allowed_tools` exactly once for the whole session; `AgentDefinition` has no per-agent allow list.
  This is the only permission channel we have *proven* both (a) reaches subagent tool calls and (b) is
  consulted under `permission_mode="dontAsk"`.
- **`can_use_tool` does not fire under `dontAsk`.** `types.py:1895–1911` — the callback is "the SDK
  replacement for the interactive permission prompt," invoked only when rules evaluate to **"ask"**,
  and "*not* invoked for tool calls already permitted by `allowed_tools` [or] `permission_mode`."
  `dontAsk` = "don't prompt; deny if not pre-approved" (`types.py:1783`) — i.e. there is no "ask"
  state, so the prompt-replacement callback is skipped. **`can_use_tool` is the only channel the SDK
  enriches with `agent_id`** (`_internal/query.py:400`, built into `ToolPermissionContext`) — but that
  is moot here because it never fires under `dontAsk`.
- **The PreToolUse hook's dedicated context arg carries no `agent_id`.** `_internal/query.py:446–450`
  invokes the hook as `callback(input, tool_use_id, {"signal": None})`. Any `agent_id` a hook could see
  must come from `input` (arg 1); the CLI's population of `agent_id` in the *PreToolUse input* is
  asserted only by a comment (`types.py:284–306`) and is **not verifiable from source** — the matching
  and input-assembly live in the bundled CLI (`_bundled/claude.exe`, a 251 MB compiled binary).

### 10.2 RC-α / RC-β / RC-γ — cannot be split from existing evidence

The failed Option-1 hook contained **no log line**, and the run was launched with
`include_hook_events=False` — so neither the Railway logs for run
`dda760fc-2c72-4424-b50e-377536e8ef6d` nor the SDK stream can show whether `pre_worker_handler` fired,
what its input held, or what it returned. The matcher/agent_id/subagent-firing behaviors all live in
the compiled CLI binary. Therefore:

| Cause | Can source confirm? | Assessment |
|---|---|---|
| **RC-α** hooks don't fire for subagent tool calls | No (CLI-internal) | *Unlikely* — the SDK schema deliberately carries `agent_id` for hooks "fired from inside a Task-spawned sub-agent" (`types.py:290–306`) and docs say PreToolUse gates "every tool call regardless of permission rules." But not provable. |
| **RC-β** hook fires but `agent_id` absent from its input | No (CLI-internal) | *Plausible and self-inflicting* — Option-1 denied whenever `input_data.get("agent_id")` was falsy. If the CLI omits `agent_id` from the PreToolUse input, the hook denied its own legitimate subagent call. |
| **RC-γ** matcher `^mcp__architectos__run_` didn't match `mcp__architectos__run_<agent>` | No (CLI-internal) | *Plausible* — unlike the codebase's proven `^mcp__.*$`, the Option-1 pattern was not closed with `.*$`; under full-match semantics it never matches, so the hook never fires. |

**Adjudication:** the three cannot be disambiguated from what exists today. Crucially, **the corrected
fix must not depend on which one it is** — every RC lives in the hook/callback layer, so the fix routes
around that layer entirely.

### 10.3 Fix A vs Fix B

- **Fix A — `can_use_tool` keyed on `agent_id`:** rejected. The channel that carries `agent_id`
  (`can_use_tool`) does not fire under `dontAsk` (10.1). Making Fix A work would require abandoning
  `dontAsk` for the whole session — a large blast radius that reintroduces prompt semantics into a
  headless server path. Not worth it.
- **Fix B — inverted `allowed_tools` (RECOMMENDED):** add the three required handler tools
  (`mcp__architectos__run_structured_data_agent`, `…run_sandbox_execution_agent`,
  `…run_per_user_wiki`) to the global `allowed_tools` in the native override
  (`vcso_sdk_loop.py:769`): `options.allowed_tools = ["Task", *(f"mcp__{SDK_TOOL_SERVER_NAME}__run_{k}"
  for k in required_agents)]`. This is the proven channel; it is independent of RC-α/β/γ.
  **Also remove the Option-1 `pre_worker_handler` allow/deny hook** — an explicit hook *deny* overrides
  an `allowed_tools` allow, so leaving the buggy hook in place could actively block Fix B.

### 10.4 Preserving delegation-first without a per-call permission gate

`allowed_tools` is global, so Fix B would also let the *lead* call `run_<agent>` directly and bypass
the `pre_task_use` contract/ordering/cap guardrails. Because no hook/callback channel reliably gives us
lead-vs-subagent context under `dontAsk`, enforce the guardrail in **code we fully control** — the
handler itself:

- In `make_native_handler_tool.execute` (`vcso_sdk_loop.py:612–721`), refuse to run unless
  `pre_task_use` has already registered a contract for this capability, i.e. **require
  `capability_key in task_contracts`** (populated only by an approved `Task` delegation at
  `pre_task_use`, which already enforces order/single-run/cap). A direct lead call arrives with no
  registered contract → return a bounded `is_error` "must be delegated via an approved Task contract."
  This makes delegation-first deterministic and SDK-permission-agnostic.

### 10.5 Self-diagnosing instrumentation (so the next repro is unambiguous)

1. **Grant/decision log in the handler:** at `execute` entry, `logger.info` the `capability_key`,
   whether a registered contract exists (`delegated=<bool>`), the resolved `task_id`, and — after the
   orchestrator call — the child `run_id` and status. "Handler fired + child created" then appears
   directly in Railway logs, resolving the "not confirmed" gap without the SDK stream.
2. **Observe-only PreToolUse probe (optional, high value):** register a *logging-only* PreToolUse hook
   on the **proven** matcher `^mcp__.*$` that returns `{}` (no decision — permission stays with
   `allowed_tools`) and logs `tool_name`, `bool(input.get("agent_id"))`, `tool_use_id`. One repro then
   empirically settles RC-α (does it fire for subagent calls?) and RC-β (is `agent_id` in the input?)
   for good — telemetry only, cannot affect the grant.

### 10.6 Process precondition for any live repro

Before spending a canary turn: **confirm the deployed Railway head == the intended fix commit**
(`/health` or deploy SHA), so a stale deploy can never again masquerade as a fix failure. The one-worker
repro (single approved worker, one child row with correct `parent_run_id` + `tier_worker →
claude-haiku-4-5`) runs once; then STOP. Do **not** run the full three-worker anchor.

### 10.7 Status

Diagnosis complete; **STOPPED for London**. No code changed for Fix B, no flag touched, no canary run.
The Option-1 `pre_worker_handler` change from §8 is still uncommitted in the working tree and should be
**replaced** (not extended) by Fix B when authorized.

---

## 11. Fix B implemented (v0.6.54) — verified on disk, pending commit/deploy/repro

**London authorized (2026-07-16).** Applied to `python-backend/services/vcso_sdk_loop.py` in the
GitHub-linked repo. Diff vs deployed `v0.6.53` (four changes, native path only):

1. **Grant (the actual fix).** Native override at the former `options.allowed_tools = ["Task"]` now
   pre-approves the required handlers:
   `options.allowed_tools = ["Task", *(f"mcp__{SDK_TOOL_SERVER_NAME}__run_{k}" for k in required_agents)]`.
   This is the one channel proven to reach subagent calls under `dontAsk`.
2. **Removed the ineffective Option-1 hook.** `pre_worker_handler` (PreToolUse allow/deny) is gone —
   an explicit hook deny would have overridden the allowed_tools allow and re-blocked Fix B.
3. **Delegation-first guard, in code we control.** `make_native_handler_tool.execute` now refuses
   unless `capability_key in task_contracts` (written only by an approved `pre_task_use` delegation,
   which already enforces ordering/single-run/cap). A direct lead call → bounded `is_error`, so the
   guardrails survive without depending on any SDK permission channel.
4. **Self-diagnosing instrumentation.**
   - Handler entry log: `capability`, `delegated=<bool>`, `task_id`; completion log: `capability`,
     child `run_id`, `status`. "Handler fired + child created" now shows directly in Railway logs.
   - Observe-only `pre_tool_probe` PreToolUse hook on the proven `^mcp__.*$` matcher — logs
     `tool_name`, `agent_id_present`, `tool_use_id`, returns `{}` (no permission decision). One repro
     then settles RC-α/RC-β empirically.

**Verification done here:** `py_compile` clean; `git diff` shows exactly the four hunks; no dangling
`pre_worker_handler` reference remains.

**Handoff — must run in London's environment (sandbox cannot commit/deploy/spend canary credits):**
1. Commit + push: `git commit -m "v0.6.54 Grant native worker handlers via allowed_tools + delegation guard"`
   (a stale `.git/index.lock` from an earlier sandbox `git checkout` may need `rm -f .git/index.lock`
   first).
2. Let Railway deploy; **confirm deployed head == v0.6.54 commit SHA before the canary** (§10.6).
3. Enroll only the founder under `vcso_sdk_loop`; run the **one-worker** repro once (single approved
   worker delegated in isolation). Pass = one `agent_delegation_runs` child row with correct
   `parent_run_id` and `tier_worker → claude-haiku-4-5`; logs show `handler fired … delegated=True`
   and `handler completed … run_id=…`. Then **STOP and re-darken**. Do **not** run the full
   three-worker anchor.
4. If it still fails: the `pre_tool_probe` log lines now disambiguate RC-α (did it fire for the
   subagent call?) and RC-β (was `agent_id` present?) without further guesswork.
