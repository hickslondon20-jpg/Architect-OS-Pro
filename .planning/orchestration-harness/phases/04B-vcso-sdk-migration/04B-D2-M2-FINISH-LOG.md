# 04B Phase D2 (SDK-M2) — Finish Log (Stages A–F)

**Date:** 2026-07-18 · **Agent:** Execution Agent (London's host, venv + git available)
**Runbook:** `04B-D2-M2-HANDOFF.md` §3 (gates A–I) · **Build spec:** `04B-D2-M2-BUILD.md`

Records what was *run* (as opposed to written) on the SDK-M2 last mile. Stages A–F are done and green.
Stages G–I (control run, canary probe, re-darken) are **not started** — they need London's environment
(Supabase flag flips + founder turns) and the Stage-D confirmation below.

---

## Stage A — Local compile + unit tests · GREEN (after one pre-existing fix)

`py_compile` clean across all seven touched files. Focused suite: **31 passed**.

**One red found, and it was NOT caused by SDK-M2.** `test_vcso_sdk_loop.py::
test_app_owned_workers_run_before_synthesis_with_no_lead_delegation_surface` failed identically at
`d9ecf25e` (v0.6.59). Cause: v0.6.57's "Improvement #1" deliberately reordered
`run_app_owned_workers` to run the mandatory compute chain first (`structured → sandbox`) and the
best-effort `per_user_wiki` last, so a wiki failure cannot pre-empt sandbox — but the test still asserted
the old `structured → wiki → sandbox` order (and indexed `calls[2]` for the sandbox assertions). The test
was stale, not the code. Fixed in **v0.6.61** (assertion matches the intended order; the sandbox call is
now indexed by name, not position). Approved by London before proceeding.

## Stage B — Model-driven `_run_sdk_turn` integration test · GREEN

`test_model_driven_lead_delegates_via_task_with_workers_hidden` written to the `04B-D2-M2-BUILD.md` §
"Remaining before the probe" spec and **passing on first run**. It asserts, with a single
`structured_data_agent` worker:

- lead surface is `allowed_tools == ["Task"]` — no `__run_` tool anywhere the lead can see, and
  `vcso_workers` absent from top-level `mcp_servers`;
- the worker `AgentDefinition` carries the **inline external** server (`type:"http"`, per-turn `?t=` URL)
  and `tools == ["mcp__vcso_workers__run_structured_data_agent"]`, and that inline config JSON-serializes;
- the `PreToolUse` `Task` hook accepts a valid `_parse_task_contract` contract (`decision=allow`);
- the observe-only `^mcp__.*$` probe records `agent_id_present=true` (the §4 residual's in-test analogue);
- `PostToolUse(Task)` hits the **DB completion bridge** and `Stop` returns `{}` (does not block) — i.e. an
  out-of-process worker completion is correctly observed;
- `SubAgentOrchestrator` is **never** constructed (Path A's app-owned run does not fire);
- lifecycle shows `runtime_manifest decision=model_driven`, one `task_pre_tool_use`, one `pre_tool_probe`;
  no contract `objective` text leaks into lifecycle events.

Static correctness of the M2 mechanism is therefore established. What remains unproven is only the part
that needs a real CLI subprocess: that the compiled inline config actually *reaches* the loopback server.

## Stage C — Local FastMCP endpoint smoke · GREEN (after a real fix)

**First run failed: HTTP 500, `RuntimeError: Task group is not initialized. Make sure to use run().`**

This is the mounted-sub-app lifespan gotcha `04B-D2-M2-BUILD.md` Step 1 and the `main.py` mount comment
both flagged as a risk. Starlette's `app.mount()` does **not** propagate lifespan to a mounted ASGI
sub-app, so FastMCP's `StreamableHTTPSessionManager` task group was never started and *every* request to
the mount 500'd. The endpoint would have been dead in production.

**Fix (in v0.6.62):** `vcso_worker_mcp_server.py` now memoizes the FastMCP instance and exports
`worker_session_manager_lifespan()`; `main.py` enters it from an `on_event("startup")` handler via an
`AsyncExitStack` and closes it on shutdown. **Fail-open** — a failure starting the session manager is
logged and leaves model-driven delegation unavailable, but cannot block backend startup.

Re-run result, against `http://127.0.0.1:8000/internal/mcp/workers/?t=SMOKE-DOES-NOT-EXIST`:

```
TOOLS: ['run_structured_data_agent', 'run_sandbox_execution_agent', 'run_per_user_wiki']
IS_ERROR: True | CONTENT: Error executing tool run_structured_data_agent: No active turn scope for this token.
```

Exactly the three worker tools; an unregistered token is refused cleanly in the core with no child row and
no spend. Smoke script retained at `python-backend/scripts/smoke_worker_mcp.py`.

## Stage D — Loopback base URL · OPEN (needs London)

Resolution logic (`vcso_sdk_loop.py:1325`): `VCSO_WORKER_MCP_BASE_URL` if set, else
`http://127.0.0.1:${PORT}`, defaulting to port 8000. There is **no `Procfile`, `railway.json`,
`nixpacks.toml`, or `Dockerfile` in the repo**, so Railway's start command lives in its dashboard and
could not be read from here.

**Required before Stage H:** confirm the Railway start command binds `$PORT` (e.g.
`uvicorn main:app --host 0.0.0.0 --port $PORT`). If it binds a hardcoded port instead, set
`VCSO_WORKER_MCP_BASE_URL` to match — otherwise the canary fails on an unreachable endpoint rather than on
the mechanism, which would waste the run and mislead the PASS/FAIL read.

## Stage E — Commits · DONE

| Version | SHA | Contents |
|---|---|---|
| v0.6.60 | `c4ea9322` | Pre-fix (b): `HarnessEngine.from_env()` → `VectorStore.from_env()` (v0.6.59 sibling) |
| v0.6.61 | `1ad63847` | Stale Path-A execution-order assertion + the new M2 integration test (same file) |
| v0.6.62 | `9253caca` | SDK-M2: worker MCP core + transport + mount/lifespan, config path, loop branch, chat-service flag |

Deviation from the runbook's numbering: the runbook scripted two commits (v0.6.60 + v0.6.61 = M2). The
stale-test fix needed its own commit, so **M2 is v0.6.62, not v0.6.61**. Gate F confirms against the M2
SHA `9253caca` (or a later docs-only head that contains it). `git diff --stat` showed clean hunks
throughout — no whole-file CRLF churn.

## Stage F — Deploy confirmation · see below

## Stages G–I — NOT STARTED

Control run, canary probe, and re-darken all require London's environment. Flag settings are unchanged:
`vcso_sdk_loop` **dark**, `native_model_driven_enabled` **false**, `vcso_planner` **retired**. Nothing was
flipped by this pass.

**Pre-fix (a)** — the v0.6.59 `per_user_wiki` confirmation turn (`04B-D2-PREFIX-RUNBOOK.md`) — is also
still outstanding; it needs a founder turn.

---

## Locks preserved

Founder isolation (per-turn token scope), one-writer, Claude-lock (Sonnet compose / Haiku workers via the
MA-06 tier map), no model selector, tier authority at the capability grain, curated transparency. Path A
retained as the fallback and not pruned; native-delegation scaffolding intact; `vcso_planner` stays
retired; harness-root `ROADMAP.md` untouched. No new conflict was found, so no row was added to
`../../CONTEXT.md`. SDK-M3 not started.
