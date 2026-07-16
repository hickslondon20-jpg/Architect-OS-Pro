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
