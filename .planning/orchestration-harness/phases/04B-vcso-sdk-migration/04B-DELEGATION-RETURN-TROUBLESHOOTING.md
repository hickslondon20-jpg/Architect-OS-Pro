# 04B — Delegation Return: Troubleshooting Handoff

**Date:** 2026-07-29 · **Type:** cold-pickup handoff. Self-contained — you do not need the orchestration
conversation. **Scope: one question only.**

> **The question.** Two bounded worker subagents start, execute their granted tools successfully, and
> never return their results to the lead. `SubagentStop` never fires. The lead retries, is refused, and
> the turn fails. **This does not reproduce in an isolated SDK harness — every arm returns in-band.**
> Why does it fail in production?

Nothing else is in scope. Do not fix, refactor, or optimise anything outside this question.

---

## 1. Where this sits

ArchitectOS Pro is migrating Virtual CSO onto the Claude Agent SDK. The current step ("Step 2") is a
probe: prove the native in-process worker surface delegates reliably, at N=5 consecutive passes on a
pinned anchor question. **N=5 is at 0/5 and blocked by the question above.**

Full context if you need it: `04B-TARGET-ARCHITECTURE-AND-ROADMAP.md` (decisions, target architecture,
roadmap) and `04B-NATIVE-SURFACE-PLAN.md` (the probe's plan and gates). Read them only if the sections
below leave you short — this document is meant to be sufficient.

**Nothing is live to any founder.** Every flag is dark; production Virtual CSO runs the pre-migration
path. There is no user-facing risk in anything you do here.

---

## 2. What is PROVEN — do not re-derive

**The enforcement architecture works.** Two runs activated the native surface and both showed:

- The access hook allowing each worker tool with correct attribution ("*list_founder_datasets is within
  the compiled structured_data_agent delegation grant*"), agent identity present and matched.
- **Zero lead-direct attempts** on worker tools across every run.
- The compute gate correctly no-op'ing on retrieval tools and allowing `execute_code` only after naming
  the specific cited retrievals that satisfied it.
- The lead delegating **unprompted** — two Tasks within twenty seconds, before any `stop_hook` block.
- Child run rows, steps, source refs (47 on the wiki worker), and the nested UI all persisting and
  rendering.
- Founder-visible streaming working.

**The isolated SDK harness returns in-band in every arm** (`scripts/probe_native_task_return.py`, CLI
`2.1.209`, SDK `0.2.118`):

| Arm | Shape | Stops | Result |
|---|---|---|---|
| Hook rewrite | one Agent, incoming `true`, rewritten `false` | 1/1 | in-band |
| Two same-turn | two Agent calls, same `message_id`, 682 ms apart | 2/2 | in-band |
| Two separate turns | distinct message ids, sequential | 2/2 | in-band |
| Same-turn + `background=False` | same `message_id`, 534 ms apart | 2/2 | in-band |
| Lead-level MCP | direct lead in-process tool call | — | `PostToolUse` fired, returned |

**`updatedInput` is honored for the Agent built-in.** A `PreToolUse` hook rewriting `run_in_background`
demonstrably takes effect.

---

## 3. What is DISPROVED — do not retry these

1. **Omitted `run_in_background`.** Production lifecycle shows `input_state=present` on all six Agent
   calls — the model was already sending it non-true before our rewrite touched anything. The omitted-field
   hypothesis explains the harness, not production.
2. **Parallel same-message dispatch.** Two Agent calls sharing one `message_id` return in-band in the
   harness.
3. **`AgentDefinition.background = False`.** No material change.
4. **`updatedInput` not honored.** It is honored.
5. **A general lead-level MCP result-return failure.** A direct lead-level in-process tool completed
   normally in the harness, so `execute_code`'s live failure does not collapse into this question. Treat
   it as possibly related but unproven — do not chase it here.

---

## 4. The remaining suspect: our loop, not the SDK

The harness exercises **the SDK in isolation**. Production differs in ways the harness does not replicate:

- **A threaded async-to-sync bridge.** `_run_sdk_turn` runs inside an event loop on a worker thread,
  draining SDK messages into a `queue.Queue` consumed by a synchronous SSE generator
  (`vcso_sdk_loop.py` ~570–711).
- **Real tool latency.** Production workers make Supabase round-trips, embeddings, reranking — seconds per
  call. Harness tools return sentinels in milliseconds.
- **Scale.** ~77k input tokens versus a trivial harness prompt.
- **Hooks doing network writes mid-lifecycle.** `SubagentStart` inserts a child run row into Supabase
  before the subagent proceeds.
- **Environment.** Railway container with a forwarded process environment (including
  `MCP_TOOL_TIMEOUT=240000`).

---

## 5. Primary task — reproduce locally, no canary, no flags

**Run `_run_sdk_turn` itself locally** — the actual production code path with the real hook set and the
threaded queue bridge — against **stub tools that deliberately take seconds, not milliseconds.**

This is the test we have not run. It isolates our loop from both the SDK (already cleared) and the
deployment environment.

Vary one factor at a time and report each:

1. **Tool latency.** Sub-second stubs versus multi-second stubs. Does slowness alone break the return?
2. **The threaded bridge.** Same turn driven through the production thread-plus-queue path versus a plain
   asyncio driver. Does the bridge drop or stop consuming messages?
3. **Hook cost.** `SubagentStart` performing a real network write versus a no-op. Does a slow hook stall
   the subagent lifecycle?
4. **Prompt scale.** Small versus production-sized system prompt and context.

For each: does `SubagentStop` fire, does the Agent result return in-band, how did iteration terminate, and
at what elapsed time relative to each subagent start.

**If it reproduces locally, you can iterate in minutes instead of deploy cycles.** That is the entire point
of this task. **If it does not reproduce even here**, the cause is environmental and the search narrows to
the Railway container and its forwarded environment.

---

## 6. Secondary task — at most ONE capture canary, and only behind a structural preflight

Bounded raw-SDK-stream capture already exists and is deployed (`sdk_raw_stream_capture`, gated by
`diagnostic_sdk_stream_capture_enabled`). It records message types, hook invocations with start/return/
exception, Agent result arrival with status and size, iteration termination, and explicit truncation —
sanitized, no content.

**Do not run it until the preflight below exists.** Three of five canary attempts have been lost to arming
and activation failures, not to the architecture. That is the dominant cost in this workstream.

### 6.1 The arming trap — read this twice

**There are two allowlists with different jobs.** `test_user_ids` gates the base `vcso_sdk_loop`;
`diagnostic_user_ids` gates the native sub-flags. **The founder must be in BOTH.** The most recent canary
was lost because the founder was in `diagnostic_user_ids` only, so the base loop evaluated disabled and the
turn silently took the flat path with all three diagnostic settings correctly armed.

### 6.2 Required before any canary

1. **An atomic arming path** — a single script that sets every required key together and reads the
   resulting state back. Not a human assembling flags from a prose checklist.
2. **An activation smoke test** — a trivial throwaway turn that asserts `sdk_phase=04B-D`,
   `native_subagent_mode=true`, non-empty `available_subagents`, and a present capture key, **before** the
   real anchor is submitted. If a cheap turn does not activate, do not spend the expensive one.

**Validate before spending, not after.** The existing countability guard reports voids after the fact; that
is the wrong end of the transaction.

---

## 7. The fork, and the boundary on this work

**If the local reproduction plus at most one capture canary do not yield a cheap fix, we stop chasing and
take the async-native fork.** That decision belongs to London — surface the evidence and recommend; do not
take it unilaterally.

**The fork:** accept that subagent results may not return in-band on this runtime, and complete workers
from the database via the existing completion bridge (`model_driven_completed_children`), which already
works and which the `stop_hook` already consults.

**Its honest cost:** today the bridge only tells the `stop_hook` that a worker finished — it does **not**
inject that worker's findings into the compose. That is the TODO deferred at `vcso_sdk_loop.py` ~1002 as
"significant machinery." The fork means building it.

**Its consequence:** the completion bridge stops being seam-tax and becomes load-bearing. It would not be
deleted in the planned Step 3.

**Therefore: do not touch the completion bridge, the external transport, `TURN_REGISTRY`, or Path A.**
They may be load-bearing. The Step 3 deletion list is provisional.

---

## 8. Assets and evidence pointers

```
python-backend/scripts/
  probe_native_task_return.py   isolated SDK harness — 4 arms, all in-band. Records message grouping,
                                hook inputs/rewrites, lifecycle timing, partial-message counts, versions,
                                turns, duration, spend. PERMANENT regression asset — it will catch the next
                                silent CLI behaviour change.
  probe_lead_execute_code.py    lead-context execute_code probe
python-backend/services/
  vcso_sdk_loop.py              _run_sdk_turn; hooks; the threaded queue bridge (~570–711);
                                record_stream_diagnostic (~1633); foreground_delegation_input (~641)
  vcso_sdk_config.py            per-founder compile; MODE_B_LEAD_TOOL_NAMES;
                                NATIVE_GRANULAR_AGENT_TOOL_GRANTS
```

**Live evidence — Supabase project `pwacpjqkntnovndhspxt`:**

| Parent run | What it shows |
|---|---|
| `a51a155e-2033-4f25-80de-21bf1117e1f3` | First activation. 23-event lifecycle. Two Tasks allowed, both `subagent_start`, **zero `subagent_stop`**, four retries denied, `execute_code` → `sdk_tool_failure`, give-up at 182s. |
| `b0aabc79-945d-48bc-8f70-b1e3846429c5` | Second activation, after the foreground rewrite shipped. All six Agent inputs `present` (non-true). Workers started 2.89s apart, 1 and 5 completed steps, 47 source refs, **still zero `subagent_stop`**, failed at 151s. `execute_code` produced **no** failure event and no success step. |
| `dc86e981-8873-4b2a-8158-34bcddf7c020` | Lost to the allowlist trap — flat path, no native activation, no capture. |

Runtime versions are now recorded per run. Deployed head at handoff: `0d604065`.

---

## 9. Discipline — non-negotiable

- **Observe, don't infer.** Pair every claim to a row, a log line, or a captured event. This migration has
  shipped three false greens caught only by live observation. Code-verified is not observed.
- **Report negative results as results.** Four disproved hypotheses in §3 are worth more than a lucky
  guess. Do not force a conclusion.
- **Stop on the first failure.** Do not retry blind.
- **Cache-busted `/api/health` head confirmation before any canary.** A plain read can be served stale.
- **Dark-canary hygiene:** arm founder-only on explicit go, re-darken immediately, read every flag back off.
- **Preserve every lock:** founder isolation; one writer (feed the OS Engine, never write the wiki); cited
  provenance; cost-tier routing at the capability grain; no founder-facing model selector; curated
  transparency; bounded, non-recursive, depth-capped workers.
- **Infra landmines:** keep `MCP_TOOL_TIMEOUT=240000` (Railway env only). Single-process only —
  `TURN_REGISTRY` is process-global, no `WEB_CONCURRENCY`, no `--workers`. Do **not** re-add the per-agent
  `timeout` config key; the deployed CLI rejects it and it broke delegation outright.
- **Version tags forward.** PATCH per logical unit; MINOR/MAJOR are London's call. Commit each unit —
  uncommitted work does not survive a session boundary.
- **Do not** flip flag defaults, prune Path A, delete the transport or completion bridge, widen past the
  dark founder canary, or edit the harness-root `ROADMAP.md`.

## 10. Explicitly out of scope

The composer-integrity classifier gap (two live instances, question-phrasing rather than answer-content —
carried to Phase G with reflect-and-steer). The capability-row drift. The Phase F quarantine interaction.
Step 3's deletion. Phases E, F, G. Domain Agents. **Do not start N=5** — that resumes only after this
question is resolved and London authorizes it.

## 11. Cost framing

Total live model spend across this entire probe to date is roughly **$0.65**. Credits are not the
constraint. **Cycles and wall-clock are.** Prefer the free local reproduction over any canary, and make
every canary earn its place behind the preflight in §6.2.
