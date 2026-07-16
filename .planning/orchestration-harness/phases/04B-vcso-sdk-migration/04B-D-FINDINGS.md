# Phase D Findings — Native Subagents

**Checked:** 2026-07-16 against `main` at `13c4a235`, Supabase project
`pwacpjqkntnovndhspxt`, and Claude Agent SDK `0.2.118`.

## Live code and schema findings

1. `vcso_sdk_config.py` already compiles the seven bounded capability rows into per-founder
   `AgentDefinition`s with capability-scoped tools, models, and turn caps. The lead options currently
   disallow the SDK `Task` tool, so those definitions cannot yet be invoked as native subagents.
2. `sub_agent_orchestrator.py` remains the correct implementation substrate. Its seven handlers are
   founder-scoped, persist parent-linked runs and curated steps, reject delegation depth above one,
   and return compact cited results when the compact contract is enabled.
3. The old `_run_planner_or_none` executes before the SDK branch and uses futures plus heartbeat
   polling. On the SDK path it must be bypassed in favor of SDK-native `Task` delegation; it remains
   untouched as the flag-off strangler fallback until Phase G.
4. The exact P4 defect is upstream coverage, not worker health: restart 2 persisted only a
   `structured_data_agent` child and no `sandbox_execution_agent` child. Prompt guidance alone did
   not preserve the required dependency.
5. The SDK stream exposes `parent_tool_use_id`, but the current normalizer neither emits that lineage
   nor groups worker events. The C2 client already has nested `AgentStep.children`; Phase D can extend
   the additive event data without changing existing event names.
6. Live `agent_delegation_runs`, `agent_delegation_steps`, and `agent_context_sources` already hold the
   required parent lineage, curated detail, and citations. No new table is needed; `ai_usage_log`
   remains unchanged as the separate metering ledger.
7. All seven capability rows are `can_spawn_agents=false`, but only `document_analysis_agent` has
   `routing_tier=worker`. The other six currently resolve through bespoke Sonnet rows even though the
   live central `tier_worker` row resolves to `claude-haiku-4-5-20251001`. A data-only migration must
   set the seven worker capability rows to `routing_tier=worker`; model authority remains at the
   capability grain and no second selector is introduced.

## Q5 decision

**Retire `_run_planner_or_none` on the SDK path; retain it only on the hand-rolled fallback path.**
When `vcso_sdk_loop` is enabled for a founder and the bounded P4 thin-slice contract matches, the SDK
lead owns decompose → delegate → compose. When the SDK flag is off, the current planner and flat paths
remain byte-for-byte unchanged. This preserves the strangler while removing duplicate planner
authority from the SDK canary.

## Structural fix for the dropped child

- Enable `Task` only for the SDK lead; every subagent definition continues to disallow `Task` and
  `Agent`, enforcing one controlled delegation level with no recursion.
- Require every native Task call to carry an explicit contract: objective, output format,
  tools/sources, boundaries, and scoped context.
- For the P4 financial-risk thin slice, runtime state requires both `structured_data_agent` and
  `sandbox_execution_agent`, in dependency order. A stop hook blocks completion while either required
  child is missing; the sandbox contract must inherit the compact structured-data finding.
- Run each native subagent through a dedicated SDK tool adapter that calls the existing bounded
  capability handler with founder/thread/parent-run scope, depth 1, worker-tier routing, compact
  output, progress callbacks, and citations.
- Outside the exact thin slice, the SDK retains effort scaling: simple turns answer directly and no
  new generalized delegation behavior is introduced in Phase D.

## Surface mapping

- `Task` start/result becomes the parent subagent step.
- child SDK events and persisted handler progress carry `parentToolUseId` additively and render inside
  that parent chip.
- worker citations are merged into the existing turn `sources` collection and the SOURCES rail.
- only curated titles, summaries, statuses, and source labels render; raw Task prompts, tool inputs,
  tool outputs, and chain-of-thought remain hidden.

