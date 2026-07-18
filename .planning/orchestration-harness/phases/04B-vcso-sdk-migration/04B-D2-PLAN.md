# Phase D2 Plan — Model-Driven Delegation (restore reasoning-driven worker selection)

> Read `../../CONTEXT.md` + `../../ROADMAP.md` and this folder's `CONTEXT.md` + `ROADMAP.md`, plus
> `04B-D-ORCHESTRATION-HANDOFF.md` and `04B-D-REMEDIATION.md` §§17–24 first. Covers **SDK-M1..M6**.
> Behind `vcso_sdk_loop` (dark, founder-only). **Research the SDK source before building** — this work
> has burned six versions on untested SDK assumptions. Path A stays the working fallback until D2 is
> proven at parity. **Confirm deployed head == intended SHA + `/api/health` before every canary turn.**

## Why this phase exists
Phase D's **Path A** (v0.6.57–59) proved the delegation **plumbing** end-to-end — workers run, the
sandbox fires, best-effort failure granularity holds, nested UI + child traces work. But Path A did it
by **removing model-driven delegation**: the app deterministically runs a fixed worker set and the SDK
lead only composes. That is the inverse of this migration's purpose — a reasoning-driven **thought
partner** that *decides* which specialists it needs. Path A also does not generalize (the app cannot
pre-know the worker set for an arbitrary strategic question — the exact judgment the model was meant to
provide). **D2 restores model-driven delegation** — the lead reasons about decomposition and delegates
via `Task` — while **keeping every proven Path-A asset** (`SubAgentOrchestrator` handlers, sandbox
wiring, nested rendering, tiers, traces) as the substrate. This is reuse-preserving: fix the *visibility
boundary*, not the workers.

## The blocker D2 must clear (handoff §17)
The three native attempts failed on tool **visibility**, not permission. In SDK 0.2.118 an *in-process*
MCP server registers at session scope, so its worker-handler tools are exposed to the **lead's** tool
schema — and `AgentDefinition.tools` scopes the *subagent*, not the lead; `disallowed_tools` is global.
So the lead kept calling the handler directly instead of `Task`. **The fix is to make the worker tools
invisible to the lead but reachable inside a Task-spawned subagent**, so the lead *must* reason and
delegate. The handoff names an **external (stdio/HTTP) MCP server** as that mechanism. D2 confirms the
minimal viable version from the SDK source before building.

## Steps

### A. Incremental pre-fixes (clear the small stuff first)
1. **v0.6.59 confirmation turn** — one founder-only anchor turn; confirm `per_user_wiki` completes (the
   OpenAI embedding-client fix); re-darken. Confirm deployed head == v0.6.59 + `/api/health ok=true` first.
2. **Sibling fix** — `harness_engine.py:110` uses the same `VectorStore(client, None, settings)` pattern;
   rebuild via `VectorStore.from_env()`. Any domain-agent/harness worker that embeds hits the identical
   failure otherwise. Version-tagged commit.

### B. Research spike — nail the worker-scoping mechanism BEFORE building (SDK-M1)
1. From the **vendored SDK source** (`claude_agent_sdk` 0.2.118), confirm the smallest mechanism that
   makes the worker tools **invisible to the lead** yet **callable by a Task-spawned subagent**: validate
   the external stdio/HTTP MCP-server path (§17), and check whether any in-process arrangement of
   `AgentDefinition.tools` + server scoping can achieve it. Pick the minimal viable change.
2. Add **log instrumentation** so the next canary is self-diagnosing — record: did the lead's tool schema
   contain any `run_<agent>` tool? did the lead call `Task`? did the subagent's worker tool resolve and
   fire the handler?
3. Write a short findings note + the chosen mechanism. **STOP for London review before building** — the
   thrash history earns this gate; do not implement on an unconfirmed SDK assumption.

### C. Thin proof — the lead reasons and delegates (SDK-M2)
1. Implement the chosen scoping so the **lead sees only `Task`** (no `run_<agent>` tools in its schema);
   the worker tools live behind the scoped/external server, reachable only inside a subagent, still
   backed by the existing `SubAgentOrchestrator` handlers (**reuse — no rewrite**).
2. Prove on the anchor that the **lead itself reasons the decomposition and spawns the workers via
   `Task`** (not the app deterministically) — structured → sandbox → wiki — workers run, compose over the
   returned findings.
3. **Keep Path A's deterministic guarantee as a SAFETY-NET, not the mechanism:** a stop-hook still catches
   a clearly-missing mandatory child for the thin slice (belt-and-suspenders), so restoring model-driven
   delegation never re-opens the dropped-child defect. The net is relaxed during generalization (Phase G).

### D. Effort-scaling + delegation contracts (SDK-M3)
1. Simple turns answer directly (no decomposition); strategic turns decompose with an **explicit
   per-worker contract** (objective, output format, tools/sources, boundaries) — the reasoning quality P4
   lacked and the fix for the dropped/duplicated-child failure mode. Reflect-and-steer stays a
   first-class terminal mode.

### E. Surface + observability hold under model-driven delegation (SDK-M4)
1. The C2 nested rendering (grouped by `parent_tool_use_id`), child worker traces paired to `ai_usage_log`
   rows, and tiers (Haiku workers / Sonnet compose) all keep working when the **lead** drives delegation.

### F. Proof + checkpoint (SDK-M5)
1. Run the anchor on the live canary (confirm deployed head first). The **lead reasons** the plan, spawns
   the mandatory children, the sandbox fires (**working smoke — real computation still deferred**), cited
   compose, nested UI, traces paired, correct tiers. Capture the self-diagnosing logs. Compare to Path A
   on reliability + cost.
2. **STOP-and-review with London.** Do not generalize question types, prune Path A, or start Phase F/G
   until approved.

## Acceptance criteria
1. Pre-fixes done: `per_user_wiki` confirmed live; `harness_engine.py` sibling fixed.
2. Worker-scoping mechanism confirmed from SDK source + chosen (findings note); the lead's tool schema
   contains **no** `run_<agent>` tool — only `Task`.
3. The **lead** (not the app) reasons and delegates via `Task`; workers run; sandbox fires; cited compose.
4. Effort-scaling holds both ways (simple → direct; strategic → decomposed with contracts).
5. Coverage safety-net retained (no dropped mandatory child); nested UI + child traces + tiers intact.
6. Live proof on a confirmed-deployed head; self-diagnosing logs captured; STOP-and-review reached.
7. Path A retained (dark) as fallback; native scaffolding **not** pruned; `compileall` clean; frontend
   green; `04B-D2-COMPLETION.md` + `../../ROADMAP.md`/`../../STATE.md` updated. Read-back to London.

## Deferred (recorded in `CONTEXT.md` + the platform concerns/roadmap)
- **Real sandbox computation** (concentration/margin over a financial *series*) — needs the
  financial-series storage/vectorization design (no table today; client-level revenue + multi-period
  P&L) and couples to the **MCP-retrieval** path (Phase F). A real compute call will most likely pull
  from MCP. Sandbox stays a **working smoke** in D2.
- **Hybrid per-intent-class delegation** (deterministic Path A for predictable question types +
  model-driven for the open-ended long tail) — decide during generalization (Phase G).
- **Prune of the now-unused native machinery** — deferred until the model-driven path is proven.

## Out of scope
MCP connectors + financial-series storage (Phase F); generalization across all question types (Phase G);
real sandbox computation (deferred as above).
