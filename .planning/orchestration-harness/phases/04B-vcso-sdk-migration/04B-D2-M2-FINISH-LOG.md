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

### Stage C addendum — the local venv was running the WRONG `mcp` version

The first Stage-C green was **not trustworthy**: the local venv had **mcp 1.13.1** while
`requirements.txt` pins **mcp==1.28.1**, so the smoke had validated against a different library than
production runs. (`04B-D2-M2-BUILD.md` Step 1 asserts "pkg `mcp` 1.28.1 is installed" — true of Railway,
false of the venv.) Found while diagnosing Stage F. The venv has been upgraded to 1.28.1 and **all of
Stage A, B and C re-run green under it** (31 passed; the endpoint smoke returns the same three tools and
the same clean token refusal).

The version gap is behaviourally load-bearing. In 1.13.1 FastMCP leaves `transport_security=None` ⇒ DNS
rebinding protection **off**. In 1.28.1 it defaults to protection **on** with
`allowed_hosts=['127.0.0.1:*','localhost:*','[::1]:*']`. Consequences, both verified:

- **Public access is refused.** `POST https://api.architectospro.com/internal/mcp/workers/` returns
  **421 `Invalid Host header`** — reproduced locally by spoofing `Host: api.architectospro.com`. Good: the
  mount is on the public FastAPI app, and this is what keeps it from being an internet-reachable MCP
  surface. Do **not** widen `allowed_hosts` to "fix" this.
- **The loopback path the canary depends on is allowed.** `POST http://127.0.0.1:8000/internal/mcp/
  workers/?t=…` returns **200**, because `Host: 127.0.0.1:8000` matches `127.0.0.1:*`. The CLI subprocess
  calls the same origin, so Stage H is not blocked by this.

**Follow-up worth doing separately:** align the local venv to `requirements.txt` generally — the 1.13.1/
1.28.1 gap was silent, and any other drift is equally silent. A pinned-vs-installed check before a
canary would have caught this in seconds.

## Stage F — Deploy confirmation · GREEN

Deployed head is **v0.6.62+** (`ff20a164` pushed; `d9ecf25e..ff20a164`). `GET /api/health` →
`{"ok":true,"service":"architectos-ingestion"}`.

The health endpoint exposes no commit SHA, so deployment was confirmed **by route existence** instead:
`/internal/mcp/workers/` (which exists only from v0.6.62) returns **421**, while a sibling unknown path
`/internal/nonexistent-path-xyz` returns FastAPI's **404 `{"detail":"Not Found"}`**. A 404-vs-421 split on
the same prefix proves the new mount is routed by the running app. Before the deploy landed, the same
probe returned 404 — so the transition was observed directly, not assumed.

**Recommendation:** add the Railway commit SHA (`RAILWAY_GIT_COMMIT_SHA`) to the `/api/health` payload.
The runbook makes "deployed head == intended SHA" a mandatory pre-canary gate, and a stale deploy has
already cost one run; right now that gate can only be checked by hand in the Railway dashboard or by
route-probing as above.

## Stage D — Loopback base URL + single-process requirement · LARGELY ANSWERED FROM THE REPO

Two conditions must hold, not one (the second is not in the runbook but follows directly from the
mechanism): the server must bind Railway's `$PORT`, **and** it must run as a single process, because
`TURN_REGISTRY` is a process-global dict (`04B-D2-FINDINGS.md` §8, Discovery 1).

**Condition 1 — `$PORT` binding · SATISFIED (documented, confirmed at setup).**
`.planning/skills-sandbox/PYTHON-BACKEND-DEPLOYMENT.md:34,64-65` records the Railway service
configuration, reviewed against London's own dashboard screenshots on 2026-07-01:

- Root directory: `python-backend`
- Build command: `pip install -r requirements.txt`
- Start command: **`uvicorn main:app --host 0.0.0.0 --port $PORT`**

So server and loopback resolve `PORT` from the same env var and agree by construction. **No
`VCSO_WORKER_MCP_BASE_URL` override is needed.** Caveat: this is a July-1 record, not a live dashboard
read — worth a glance to confirm nothing has changed since.

**Condition 2 — single worker · NOT PROVABLE FROM THE START COMMAND ALONE. CHECK `WEB_CONCURRENCY`.**
The documented start command carries no `--workers` flag, which reads as "single process" — but that is
**not sufficient**. In the pinned `uvicorn==0.35.0`, `config.py:330-331`:

```python
if workers is None and "WEB_CONCURRENCY" in os.environ:
    self.workers = int(os.environ["WEB_CONCURRENCY"])
```

If a `WEB_CONCURRENCY` variable exists in the Railway service (set by a platform default, or added by
anyone for throughput), uvicorn silently spawns that many worker **processes** despite the start command
looking single-process. The loopback request would then round-robin across processes that do not share
`TURN_REGISTRY`, the token would miss, and the canary would fail as `WorkerScopeError` — indistinguishable
at a glance from the visibility mechanism failing.

**Action before Stage H:** confirm no `WEB_CONCURRENCY` variable is set on the Railway service (and that
no `--workers` was added to the start command). This is invisible in the start command and is the single
highest-value pre-canary check.

**Precision worth recording — replicas are fine, workers are not.** Scaling the Railway service to
multiple *replicas* does not break the mechanism: each replica is its own container, `127.0.0.1` stays
inside it, and the turn that minted the token is the one whose loopback call is served. Only multiple
*processes inside one container* (uvicorn workers sharing a socket) break the process-global registry. If
throughput ever demands in-container workers, `TURN_REGISTRY` needs a shared backing store first — this is
a design constraint, not a tuning knob.

---

## Gate G/H pre-flight — TWO MORE SILENT NO-OPS (found while sanity-checking the Gate G write)

Both are the same class of hazard as `WEB_CONCURRENCY`: the turn appears to run, costs money, and proves
nothing, because native subagent mode never engaged. Neither is visible in the flag settings.

**Trap 1 — the anchor question must match a literal regex, and "90-day" FAILS it.**
`native_subagent_requirements` (`vcso_sdk_loop.py:196-222`) returns `()` — no workers, no model-driven
branch, plain flat SDK path — unless **all** of these hold:

1. `intent.move_type` (or `intent.intent`) == `"strategic_synthesis"`;
2. `intent.depth` == `"deep"`;
3. the message matches `P4_THIN_SLICE_SIGNALS` (`:59-62`), which requires **all three** of a
   financial term (`financial|p&l|margin|revenue`), the word `concentration`, **and** `\b90\s+days?\b`.

That last lookahead demands **whitespace** between `90` and `day`. Verified against the live regex:

| Phrasing | Result |
|---|---|
| `...margin is compressing. What should I do in the next 90 days?` | **MATCH** |
| `...margin is compressing. Give me a 90-day plan.` | **NO MATCH** (hyphen) |
| `Client concentration is up and revenue quality is slipping - what is the 90 day plan?` | **MATCH** |
| `Margin is compressing and concentration is rising; recommend a 90days plan.` | **NO MATCH** (no space) |
| `What should I do about client concentration over the next 90 days?` | **NO MATCH** (no financial term) |

The hyphenated form is the trap: **every doc in this phase writes the anchor as "a cited 90-day
recommendation"** (including `_native_lead_prompt` itself), so the natural way to type the question is the
one that silently no-ops. The anchor turn must contain a financial term, `concentration`, and `90 days`
(or `90 day`) **with a space** — and must read as a deep strategic-synthesis move.

**Trap 2 — the founder must be logged in as the enrolled account.**
The enrolled UUID `cd490873-99aa-4533-9240-f0aa04deb54f` is the **seeded** account
(`hicks.london25@gmail.com`), not London's everyday account. Per `.planning/codebase/CONCERNS.md:104`
there are two: UI uploads land under the real `4ef8…` account while the seeded Tier-1 data lives under
`cd490873…`. `.planning/STATE-AND-ROADMAP-TO-MVP.md:56` records that the forgot-password feature shipped
and the seeded account is now directly usable.

Both gates are `str(user_id) in test_user_ids` / `in diagnostic_user_ids`. If the anchor turn is sent
while logged in as `4ef8…`, the flag simply does not match, the SDK loop stays off, and the turn runs the
old path — a clean-looking answer that proves nothing about M2. **Send both the control and canary turns
logged in as `hicks.london25@gmail.com`**, or enroll the `4ef8…` UUID instead — but the account sending
the turn and the UUID in both allowlists must be the same one.

**Verified sound in the proposed Gate G write:** every settings key matches the code exactly
(`test_user_ids`, `diagnostic_user_ids`, `diagnostic_single_worker_enabled`, `diagnostic_single_worker`,
`native_model_driven_enabled`); `structured_data_agent` is in `P4_THIN_SLICE_REQUIRED_AGENTS` so the
single-worker narrowing will take effect; `max_budget_usd=0.25` sits inside the code's clamp of
[0.01, 1.0] (`vcso_chat_service.py:623`) and so is honoured as written.

## Stage D — original open item (superseded by the above)

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

| v0.6.63 | `ff20a164` | Phase D2 planning docs + this finish log (docs only) |

---

## Stage G — Control run · PASS (baseline established)

Run `7274db2a-b207-4b76-b4ef-7491743f5073`, 2026-07-19 04:04:50Z, founder `cd490873…`.

- `ai_usage_log` records the main call under capability **`vcso_sdk_loop`** on `claude-sonnet-4-6` — proof
  the SDK loop engaged rather than the legacy path.
- Lifecycle: `native_handler_entry` → `native_handler_completion` (child `bd00bb04…`, completed) →
  `runtime_manifest decision="app_owned" reason_code="none"`.
- Exactly **one** child: `structured_data_agent`, completed, `delegation_depth: 1`, `routing_tier: worker`.
- **No `task_pre_tool_use` event** — the lead never emitted `Task`, which is correct for Path A.
- Cost **$0.0593** vs. the $0.25 cap. Sonnet compose + Haiku utilities ⇒ the Claude/tier lock held.

A note on sequencing: an earlier turn at 03:29Z (`772cd5c7…`) predated the Gate G write and ran the
ordinary `vcso_chat_tool_loop` with **no** children — the flag row was still fully dark. It is not a
control and should be ignored. The Gate G settings had been described in planning but never written to
`platform_ai_settings`; this pass wrote them.

## Stage H — Canary (THE PROBE) · **FAIL — and it settles the §4 residual**

Two attempts (the founder retried once), both identical:
`07aa0ddf…` 11:51:49Z and `e2cb4016…` 11:53:36Z. Only `native_model_driven_enabled` differed from Stage G.

**Result: `status=failed`, `error_message="Claude Code returned an error result: Reached maximum number
of turns (6)"`.** This is precisely the documented fail signature — *no `Task` / max-turns*.

Lifecycle for both runs contains **exactly one event**:

```json
{"event": "runtime_manifest", "decision": "model_driven", "sequence": 1, "reason_code": "none"}
```

What that single event proves, and what its absent siblings prove:

| Expectation | Observed | Read |
|---|---|---|
| model-driven branch selected | `decision="model_driven"` | **PASS** — the flag, founder scoping and branch all work |
| inverted manifest passes | `reason_code="none"` | **PASS** — `Task` pre-approved; no `run_<agent>` leaked to the lead; worker server absent top-level; each worker agent inline-scoped |
| lead emits `Task` | **no `task_pre_tool_use` event** | **FAIL** — the lead never delegated, not even a denied attempt |
| worker call from inside the subagent | **no `pre_tool_probe` event** | **FAIL** — no `mcp__*` tool call fired at all |
| one completed child row | **no child rows** | **FAIL** |

Cost: $0.0769 + $0.1260 = **$0.2029** total. Each attempt stayed inside its own $0.25 cap; no worker LLM
spend occurred because no worker ever ran.

**Diagnosis — what did NOT cause it (each ruled out with evidence):**

1. *Not the flag or founder scoping* — `decision="model_driven"` only records inside the gated branch.
2. *Not a leaked/invalid lead surface* — the inverted manifest passed with `reason_code="none"`, so
   `Task` **was** in `allowed_tools` and no worker tool was visible to the lead.
3. *Not the anchor phrasing* — native subagent mode engaged, which requires `P4_THIN_SLICE_SIGNALS` to
   have matched.
4. *Not the account* — both runs are under the enrolled `cd490873…`.
5. *Not `WEB_CONCURRENCY`/multi-process* — confirmed unset on the Railway service by the founder.
6. *Not the session-manager lifespan* — the deployed mount answers at protocol level (421), not the
   pre-fix 500 `Task group is not initialized`.
7. *Not transport-security blocking the loopback* — FastMCP auto-enables DNS-rebinding protection only
   for localhost hosts, with `allowed_hosts=["127.0.0.1:*", "localhost:*", "[::1]:*"]`
   (`fastmcp/server.py`). The CLI's `http://127.0.0.1:${PORT}` Host **is** allowed. The 421 seen from the
   public internet is that protection working correctly against a non-loopback Host, not a defect.
8. *Not an unsupported SDK field* — `claude_agent_sdk.types.AgentDefinition.mcpServers` is
   `list[str | dict[str, Any]]`, documented as "a server name (str) or an inline `{name: config}` dict",
   which is exactly the shape compiled.

**Leading hypothesis (unproven, and the next experiment):** the inline per-agent MCP server is not
honoured by the CLI under **`--strict-mcp-config`**. In `subprocess_cli.py:368-402`, `--mcp-config`
carries **only** top-level `options.mcp_servers` — which by design excludes `vcso_workers` — while
`--strict-mcp-config` is also passed, and agent definitions travel separately "via initialize request"
(`:410-411`). If strict mode confines resolvable servers to those in `--mcp-config`, then
`structured_data_agent`'s sole tool `mcp__vcso_workers__run_structured_data_agent` never resolves, the
agent has no usable tool surface, and `Task` has no valid `subagent_type` to target — so a Sonnet lead,
even while being told by `stop_hook` six consecutive times to delegate, has nothing it *can* delegate to.
That matches the observed signature exactly: manifest passes (a **static** check on `options`), yet zero
`Task` emissions at runtime.

**This is exactly the §4 residual, and the probe did its job.** The static half was already proven by the
Stage B integration test; the residual was always "does the compiled CLI actually consume this
construction." The answer, on this evidence, is **no** — and it cost $0.20 to learn rather than being
discovered inside SDK-M3.

**Recommended next experiment (cheap, local, no canary):** drive the real `claude` CLI locally against
the same compiled options and inspect the initialize handshake / the lead's rendered tool schema, varying
one thing at a time — `strict_mcp_config=False`; the worker server registered top-level *and*
inline-scoped per agent (visibility then rests on `allowed_tools` alone rather than server registration);
and a control with the worker server present in `--mcp-config`. Whichever variant makes the lead emit
`Task` while keeping `run_<agent>` out of its schema is the M2 mechanism. This needs no founder turn and
no production flag.

---

## Post-canary local CLI experiment · **BOTH ROOT CAUSES FOUND — and the M2 mechanism is PROVEN SOUND**

Run locally against the real bundled `claude` CLI, no founder turn and no production flag. To isolate the
CLI-consumption question from our worker core, the worker MCP server was replaced by a trivial stand-in
(`scripts/probe_cli_server.py`) exposing one `run_structured_data_agent` tool that always succeeds, so any
failure is unambiguously SDK/CLI wiring. Driver: `scripts/probe_cli_model_driven.py` (variant matrix) and
`scripts/probe_cli_debug.py` (full init + hook-event dump).

**The `--strict-mcp-config` hypothesis from Stage H was WRONG.** Variants A (production repro), B (strict
off) and C (worker server also top-level) all failed identically — no delegation in any of them. Strict
mode was never the discriminator.

### Root cause 1 — `tools=[]` disables the delegation tool itself

`vcso_sdk_config.py:199` passes `tools=[]` to `ClaudeAgentOptions`. Per the SDK's own field docs:

> `tools` — "Specify the base set of available built-in tools. `[]` (empty list) — **Disable all built-in
> tools.**" … `allowed_tools` — "Tool names that are auto-allowed **without prompting for permission**. To
> restrict which tools are available at all, use `tools`."

So `tools` **provisions**; `allowed_tools` only **permits**. Adding `"Task"` to `allowed_tools`
(`:196-197`) granted permission for a tool that was never provisioned. The debug dump confirms it —
`[init] tools=[]` — the lead had **no tools at all**. It then *hallucinated* the delegation in prose
("[Calling Task tool with subagent_type='structured_data_agent']"), which is the classic signature of a
model instructed to use a tool it does not have. That is precisely the observed production behaviour:
reason, get blocked by `stop_hook`, reason again, exhaust `max_turns`.

This also explains why the inverted manifest passed: `build_model_driven_manifest` checks
`"Task" in options.allowed_tools`, which was true — but `allowed_tools` was never the field that mattered.

### Root cause 2 — the delegation tool is named `Agent`, not `Task`

With `tools=["Task"]` provisioned, `[init] tools=['Task']` and the agent registers correctly
(`agents=[…, 'structured_data_agent']`). The lead then delegates — but the tool it actually emits is:

```
[assistant TOOL_USE] name=Agent
PreToolUse tool='Agent' agent_id=no  id=toolu_016CES…
PostToolUse tool='Agent'             id=toolu_016CES…
```

`"Task"` is the **provisioning** name; **`Agent`** is the runtime tool name in `claude-agent-sdk==0.2.118`.
Every hook and check in the loop is keyed to the wrong string:

| Site | Current | Consequence |
|---|---|---|
| `vcso_sdk_loop.py:1340` | `HookMatcher(matcher="Task", hooks=[pre_task_use])` | never fires ⇒ no contract enforcement, `task_capabilities` never populated, no `task_pre_tool_use` lifecycle event |
| `vcso_sdk_loop.py:1312` | `HookMatcher(matcher=r"^(Task\|mcp__.*)$", hooks=[post_tool_use])` | `post_tool_use`'s `Task` branch never runs ⇒ completion bridge never consulted ⇒ `completed_agents` stays empty ⇒ `stop_hook` blocks forever ⇒ **max_turns** |
| `vcso_sdk_config.py:193,197` | `allowed_tools.append("Task")`, `Task` exempted from disallowed | permits a name the model never emits |
| `build_model_driven_manifest` | asserts `"Task" in allowed_tools` | passes while the real surface is wrong — a **false-green safety check** |

Together these two causes fully and exactly explain the Stage H signature.

### The part that MATTERS: the M2 mechanism itself works

Variant **D** = production construction (`strict_mcp_config=True`, worker server **kept out** of top-level
`mcp_servers`, inline per-agent only) **plus** `tools=["Task"]`:

```
Task emitted by lead : NO   <- measurement artifact: the hook matcher says "Task", the CLI emits "Agent"
worker tool called   : YES
from a subagent      : YES   <- agent_id present
LEAKED (lead direct) : NO    <- the lead never called run_<agent>
```

And the debug dump shows the delegation end-to-end: `Agent` → `TaskStartedMessage` →
`mcp__vcso_workers__run_structured_data_agent` **with `agent_id=yes`** → `TaskUpdatedMessage` →
`PostToolUse tool='Agent'`.

**This settles the §4 CLI-consumption residual POSITIVELY.** The compiled inline per-agent external MCP
server *is* consumed by the real CLI; the worker tool *is* callable from inside the Task-spawned subagent;
and with the server withheld from top-level `mcp_servers` it *is* invisible to the lead. The construction
D2 was built on is correct — only the tool naming and provisioning were wrong.

**Secondary confirmation of the safety net.** In the debug run the server *was* registered top-level, and
the lead did then direct-call the worker (`agent_id=no`) — the §16 trap reappearing exactly as predicted
when the server is visible. That call was **denied** by `dontAsk` because the worker tool was not in the
lead's `allowed_tools`. So the permission layer holds as a second line of defence behind the hiding.

### Recommended M2 remediation (small, and testable without a canary)

1. `vcso_sdk_config.py`: for model-driven, pass `tools=["Task"]` instead of `[]` so the delegation tool is
   actually provisioned. Leave Path A on `tools=[]` — Path A is compose-only and *wants* no tools.
2. Introduce one constant (e.g. `DELEGATION_TOOL_NAME = "Agent"`) and key every matcher/allowlist/manifest
   assertion to it, rather than the literal `"Task"`, at the four sites tabled above.
3. Extend `build_model_driven_manifest` to assert the delegation tool is **provisioned** (in `options.tools`)
   and not merely permitted — this specific false-green is what let a statically "valid" surface reach a
   paid canary.
4. Update the Stage B integration test to drive the hook under the real runtime name, so the regression is
   locked in code rather than in a runbook.
5. Re-run this local probe (free) to confirm D goes fully green, then re-canary.

Local experiment cost: a few cents across five CLI runs. No production flag was touched; the flags were
already re-darkened before this began.

---

## M2 remediation · APPLIED AND LOCALLY PROVEN (v0.6.69)

Two named constants now carry the distinction that caused Stage H
(`vcso_sdk_config.py`): `DELEGATION_TOOL_PROVISION_NAME = "Task"` (what `options.tools` /
`allowed_tools` must contain) and `DELEGATION_TOOL_RUNTIME_NAME = "Agent"` (what the model emits, so what
every matcher must key off). The comment block records that both must be re-verified on any SDK upgrade.

**Changes:**
1. `vcso_sdk_config.py` — `tools=[DELEGATION_TOOL_PROVISION_NAME] if enable_native_subagents else []`.
   Path A keeps `tools=[]` and is byte-identical (it is compose-only and deliberately wants no tools);
   `enable_native_subagents` is `True` only for model-driven. `DISALLOWED_SDK_BUILTINS` exemption and the
   `allowed_tools` entry now use the provision constant.
2. `vcso_sdk_loop.py` — module-level `_DELEGATION_OR_MCP_MATCHER = rf"^({runtime}|mcp__.*)$"`; the
   `PreToolUse` delegation matcher, the `PostToolUse` and `PostToolUseFailure` matchers, the
   `post_tool_use` branch test, and the UI tool-start filter all key off the **runtime** name.
3. `build_model_driven_manifest` — new **first** violation
   `model_driven_delegation_tool_not_provisioned`, asserting the delegation tool is *provisioned* in
   `options.tools`, not merely permitted. `lead_provisioned_tools` is now recorded in the manifest.
   This is the specific false-green that let a statically "valid" surface reach a paid canary.
4. Tests — the Stage B integration test asserts `options.tools == ["Task"]`, that the `PreToolUse` matcher
   is `"Agent"` and the `PostToolUse` matcher is `^(Agent|mcp__.*)$`, and drives both hooks under the
   runtime name. New `test_model_driven_manifest_flags_delegation_tool_not_provisioned` reproduces the
   pre-fix surface (`tools=[]`, `allowed_tools=["Task"]`) and requires the manifest to reject it.

**Local suite:** 32 passed (was 31 + the new manifest test). Path A tests green throughout.

**Live CLI re-run of the variant matrix — the fix is the discriminator:**

| Variant | delegation emitted | worker called | from subagent | leaked to lead | verdict |
|---|---|---|---|---|---|
| A production repro (`tools=[]`) | NO | NO | NO | NO | FAIL |
| B strict off | NO | NO | NO | NO | FAIL |
| C server also top-level | NO | NO | NO | NO | FAIL |
| **D production construction + provisioned tool** | **YES** | **YES** | **YES** | **NO** | **PASS** |

D holds `strict_mcp_config=True` and keeps the worker server **out** of top-level `mcp_servers` — the
production hiding construction, unchanged. Only the provisioning differs. So the M2 mechanism is now
proven end-to-end against the real CLI: the lead delegates, the worker executes **inside** the
Task-spawned subagent, and `run_<agent>` never reaches the lead.

**Still unproven and only a canary can settle it:** the same flow against the *real* worker MCP endpoint
on Railway (per-turn token minting, founder isolation, the DB completion bridge clearing `stop_hook`, and
a composed cited answer). The probe deliberately substituted a trivial worker server to isolate CLI
wiring, so the worker-core half of the path has not been exercised model-driven.

---

## Canary 2 (deployed v0.6.69/v0.6.70) · FAIL — third root cause found, reproduced, fixed (v0.6.71)

Run `9cfd4adf-b062-46a4-a8da-976c0c4f946e`, 2026-07-20 02:16:33Z. Identical signature to Stage H: one lone
`runtime_manifest decision=model_driven reason_code=none`, no delegation hook, no probe, no child row,
`Reached maximum number of turns (6)`. The control was deliberately skipped — Path A is byte-identical
under this change, and the 04:04Z baseline stands.

`v0.6.70` (dd9920e8, the venv sync) was pushed at 13:08Z on 07-19, ~13 hours before the turn, so the
remediation was live. The v0.6.69 fix was therefore **necessary but not sufficient.**

### Root cause 3 — `DISALLOWED_SDK_BUILTINS` blocks the RUNTIME name

```python
DISALLOWED_SDK_BUILTINS = [..., "Task", "Agent"]   # blocks BOTH delegation names
```

Correct for Path A and the flat loop, which must never spawn agents. But v0.6.69's exemption read
`name == DELEGATION_TOOL_PROVISION_NAME` — it removed only `"Task"`, leaving **`"Agent"` in
`disallowed_tools`**. So the deployed lead was handed a delegation tool it was explicitly forbidden to
call: provisioned, permitted, and blocked, all at once. It stalls to `max_turns` exactly as before.

This is also precisely why the local probe passed while production failed: the probe never set
`disallowed_tools` at all. Closing that gap is what found this.

**Controlled local A/B against the real CLI** (probe now reproduces production's disallowed list):

| Variant | delegation | worker | from subagent | leaked | verdict |
|---|---|---|---|---|---|
| **E** deployed v0.6.69 surface (`Agent` still disallowed) | NO | NO | NO | NO | **FAIL** — reproduces the canary |
| **F** exempt BOTH delegation names | **YES** | **YES** | **YES** | **NO** | **PASS** |

### Fixes (v0.6.71)

1. `vcso_sdk_config.py` — `DELEGATION_TOOL_NAMES = frozenset({provision, runtime})`; the disallowed
   exemption is now `name in DELEGATION_TOOL_NAMES`. Path A keeps both blocked.
2. `build_model_driven_manifest` — new violation `model_driven_delegation_tool_disallowed:<name>`, and
   `lead_disallowed_tools` is recorded. **The manifest had never inspected `disallowed_tools` at all** —
   the second false-green in a row, and the direct cause of the second wasted canary. Both blind spots
   (not-provisioned, and disallowed-by-name) are now assertions that abort before spend.
3. Tests — the integration test asserts neither delegation name is in `disallowed_tools`; a new manifest
   test reproduces the exact deployed surface and requires rejection. **33 passed**, Path A green.
4. `main.py` — `/api/health` now returns `commit_sha` / `commit_sha_short` from
   `RAILWAY_GIT_COMMIT_SHA` (fallbacks for other hosts; `"unknown"` locally). Two canaries were spent on
   surfaces whose deployed revision could only be inferred indirectly; the runbook's mandatory
   "deployed head == intended SHA" gate is now directly checkable. Verified locally.

### Pattern worth naming

Three root causes, all the same shape: **a static check that inspected the wrong field.** The manifest
asserted the lead *could* delegate by reading `allowed_tools`, while the model's ability to delegate
actually depended on `tools` (provisioning), `disallowed_tools` (prohibition), and the runtime tool name.
Each canary bought exactly one of them. The manifest now covers all four, and the local probe reproduces
production's full option surface rather than a convenient subset — which is what turned canary 3's
diagnosis from a paid guess into a free A/B.

---

## Canary 3 (deployed `8ecd3cb7`, verified) · **§4 RESIDUAL SETTLED POSITIVELY** — new, narrower failure

Run `9dbed506-8e9c-4ee7-8e71-8d8e055537f6`, 2026-07-20 02:58:13Z. **Deploy confirmed directly for the
first time**: `/api/health` returned `commit_sha 8ecd3cb7919b47c231ac93260b250e7e34f82df1`, matching the
intended SHA (and the field's mere existence proves the new build, since it ships in v0.6.71).

Lifecycle — five events, versus one in every previous attempt:

| # | Event | Detail |
|---|---|---|
| 1 | `runtime_manifest` | `decision=model_driven`, `reason_code=none` |
| 2 | `task_pre_tool_use` | **deny** — "Task contract boundaries must be a non-empty list" |
| 3 | `task_pre_tool_use` | **allow** — `approved_bounded_contract` (the lead corrected itself and retried) |
| 4 | `pre_tool_probe` | `mcp__vcso_workers__run_structured_data_agent`, **`agent_id_present: true`** |
| 5 | `task_pre_tool_use` | deny — "Each approved thin-slice worker may run only once per turn" |

**Event 4 is the whole point of Phase D2.** Against the *real* Railway deployment, the lead reasoned a
decomposition, delegated, and the worker tool fired **from inside the Task-spawned subagent** — reaching
the loopback worker MCP endpoint through the per-turn token URL, with `run_<agent>` never visible to the
lead. The §4 CLI-consumption residual is settled **positively in production**, not just in a lab.

Event 2→3 is also a good sign: the delegation-contract gate rejected a malformed contract, the lead read
the denial reason and produced a valid one. `pre_task_use` is doing its job.

### The remaining failure is now isolated to the worker execution hop

The turn still ended in `max_turns`. Evidence:
- **No `structured_data_agent` child row exists** for this parent.
- **No worker row in `ai_usage_log`** — only `vcso_intent_read` (haiku) and the `vcso_sdk_loop` main call
  (`claude-sonnet-4-6`, $0.1311).

So `pre_tool_probe` (a **PreToolUse** hook — it fires *before* execution) confirms the call was
*attempted*, but the execution produced no child run and no spend. `run_worker_capability` therefore
failed. With no completed child, `model_driven_completed_children` returns empty ⇒ `completed_agents`
never fills ⇒ `stop_hook` keeps blocking ⇒ the lead retries delegation ⇒ denied as already-run (event 5)
⇒ `max_turns`. That chain matches the observed events exactly.

**Note the worker core itself is known good:** the Stage G control produced a completed
`structured_data_agent` child via Path A. The only untested element in this path is the new hop — per-turn
token minting, the `?t=` lift into the ContextVar, scope resolution in `TURN_REGISTRY`, and the argument
mapping from the Task contract into `run_worker_capability`.

**And this is exactly the gap the local probe cannot see:** the stand-in server
(`scripts/probe_cli_server.py`) ignores tokens entirely and always succeeds, so the entire token/scope/
argument path has never been exercised anywhere.

### Recommended next step — a free local end-to-end worker test, not a fourth canary

Run the **real** backend app in-process (uvicorn in a thread), mint a real `TurnScope` in `TURN_REGISTRY`,
then drive `…/internal/mcp/workers/?t=<token>` with an MCP client using a realistic Task-contract argument
set. That exercises the ASGI token lift, the ContextVar, scope resolution, founder isolation, the argument
mapping, `SubAgentOrchestrator.start_run`, and the child-row write — the precise span that failed — with
no CLI, no founder turn, and no canary spend. A second run with a deliberately wrong/expired token should
produce a clean `WorkerScopeError` and no row.

Whatever that returns is the last unknown in M2.

---

## Worker-hop end-to-end test · **HOP IS SOUND** — and it found a separate scope bug (v0.6.73)

`scripts/probe_worker_hop.py` runs the **real** app in-process (uvicorn in a thread, so `TURN_REGISTRY` is
genuinely shared exactly as on Railway), mints a real `TurnScope`, and drives
`…/internal/mcp/workers/?t=<token>` with a real MCP client and a realistic Task-contract argument set.

| Case | Result |
|---|---|
| valid token | `is_error: False`, `status: completed`, child run `8763ac1c…` written and parent-linked |
| bogus token | `is_error: True`, "No active turn scope for this token", **no row** |

**So the hop is not broken.** Token lift from `?t=`, the ContextVar, scope resolution, founder isolation,
contract→args mapping, `SubAgentOrchestrator.start_run`, and the child-row write all work against real
Supabase. Confirmed by query: the only child of the canary-3 parent is this test's row (03:17:48Z), not
one from the canary itself (02:58Z) — canary 3 genuinely produced none.

That leaves the untested difference as **environmental**: whether the loopback HTTP request actually
reaches the endpoint inside the Railway container. Nothing local can settle that — hence the diagnostics
below, which make the next canary answer it directly.

### Bug found by the test: the model was choosing the founder's data scope

The valid-token call returned **"Reviewed 0 dataset(s)"** where the Stage G control reviewed **1**.
Cause: Path A passes `native_subagent_scopes` (the founder's dataset/thread bindings) into each worker,
but model-driven built `context_scope` from the **model-authored Task contract**, which carries intent and
no bindings. So even a perfectly working hop would return "no sources" and produce a useless answer.

This is also a scope-integrity issue, not just a quality one: which data a worker may read is a
founder-isolation decision and must never be model-authored.

**Fix:** `TurnScope.context_scopes` (app-owned, per capability), populated by the loop from
`native_subagent_scopes` and merged **over** the contract's `context_scope` in `run_worker_capability`, so
non-conflicting contract keys survive but app bindings win. Unit-tested, including a case where the model
tries to widen its own scope and is overridden.

### Diagnostics: canary 3's ambiguity cannot recur

The endpoint runs in a separate request context and cannot reach `record_lifecycle`, which is exactly why
canary 3 could not tell "the request never arrived" from "it arrived and failed". `TurnScope.diagnostics`
now records `received` / `completed` / `error` in the same process, and the loop drains it into
`worker_hop` lifecycle events before unregistering the token. Reading the next canary:

- **no `worker_hop` events** ⇒ the loopback request never landed (environmental — URL/port/reachability);
- **`received` with no `completed`** ⇒ it landed and execution failed, with the error text recorded;
- **`received` + `completed`** ⇒ the hop worked and any remaining fault is downstream.

**35 tests pass.** Path A green throughout.

## Stage I — Re-darken · DONE

`vcso_sdk_loop`: `is_enabled=false`, `test_user_ids=[]`, `diagnostic_user_ids=[]`,
`diagnostic_single_worker_enabled=false`, `native_model_driven_enabled=false`, `enabled_for_all=false`,
`default=false`. Read back and confirmed. `vcso_planner` re-confirmed `is_enabled=false` with empty
`test_user_ids` — untouched throughout. **STOPPED for London's review; SDK-M3 not started.**

## Stages G–I — original placeholder (superseded)

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

---

## Canary 5 (deployed `56c8d604`, v0.6.76, verified) · **PASS — first founder-visible cited answer on the model-driven path.** SDK-M2 closed.

Run 2026-07-20. **Deploy confirmed directly:** `/api/health` `ok=true`, deployed build `56c8d604`
(v0.6.76). This is the first time a founder-visible cited answer has ever reached the user on the
model-driven delegation path.

**Flag config used (`vcso_sdk_loop`), founder-only, then re-darkened immediately after the turn:**
- enrolled founder `cd490873-99aa-4533-9240-f0aa04deb54f` only; `native_model_driven_enabled=true`;
  `max_turns=10`.
- **Re-darken confirmed (read back after the turn):** both allowlists empty
  (`test_user_ids=[]`, `diagnostic_user_ids=[]`), `native_model_driven_enabled=false`,
  `diagnostic_single_worker_enabled=false`. `vcso_planner` remains dark/retired throughout.

**Runs (from `agent_delegation_runs`):**
- Parent `28d1b9ce-954e-4a21-9e76-77700b1886a1` (`vcso_chat_tool_loop`) — status **completed**, no error.
- Child `3f5554f0-686e-4e9e-aeac-0609ba992276` (`structured_data_agent`) — status **completed**, parented
  to the above. **First worker child row ever produced on the model-driven path.**

**Lifecycle (`metadata.sdk_native_lifecycle` on the parent) — the full happy path, first attempt:**

| # | Event | Detail |
|---|---|---|
| 1 | `runtime_manifest` | `decision=model_driven` |
| 2 | `task_pre_tool_use` | **allow** — `reason=approved_bounded_contract`, **on the first attempt (zero denials)** |
| 3 | `pre_tool_probe` | `mcp__vcso_workers__run_structured_data_agent`, **`agent_id_present=true`** |
| 4 | `worker_hop` | **received** |
| 5 | `worker_hop` | **completed**, `child_status=completed` |

Contrast with canary 3, which denied a malformed contract before self-correcting (2 `task_pre_tool_use`
events) and then produced **no** child row and no `worker_hop` events. Here the contract was approved
first try, the hop landed, and the child completed — end to end.

**Founder-visible answer:** 5,242 chars, **33 citations** to real founder wiki pages
(`financial_context`, `client_market_position`, `revenue_concentration_forecasting_risk`,
`harborline_legal`, `vantage_cloud`). Grounded in real figures — $45K MRR; 71.1% gross / 18.5% net margin;
3.6-month runway; top-5 concentration 55%; Vantage Cloud $32K (~22%); Harborline $28K. Sequenced 90-day
plan with inline `[[Source: ...]]` markers.

**Cost:** main compose `vcso_sdk_loop` (`claude-sonnet-4-6`) = **$0.0776** — in line with the Path A
control (~$0.06).

**What this confirms shipped correctly in production (v0.6.75 / v0.6.76):**
- **v0.6.75 worker-handler pre-approval** → the `CallToolRequest` now dispatches. **Defect 6 resolved and
  verified live** (see `04B-D2-FINDINGS.md` §9).
- **v0.6.75 gate inversion** → isolation now enforced on the exposure surface; the gate passed clean.
- **v0.6.76 lead-prompt contract schema** → the contract was approved on the first try, no wasted turns.

**SDK-M2 closed — first founder-visible cited answer on the model-driven path.**

### Open follow-up for tier 2 (do not bury) — the worker's actual contribution is unquantified

The child worker completed in **~0.4s** (11:04:28.82 → 11:04:29.20 UTC) and logged **no separate Haiku
worker cost** in `ai_usage_log`. For a structured-data (deterministic-pull) agent this is plausibly
correct, but it leaves an open question: **how much did the worker actually contribute versus the compose
step's own context pack?** This must be nailed down in tier 2, because the three-worker chain
(`structured → sandbox → wiki`) depends on each worker producing findings that genuinely feed the next via
`prior_findings`. A single ~0.4s, zero-cost worker does not yet prove that findings-passing works under
load.

---

## Canary 8 (deployed `72ababb8`, v0.6.82, verified) · **PASS — full three-worker chain proven live end-to-end.** Tier 2 CLOSED.

**Date:** 2026-07-20. **Deploy confirmed directly:** `/api/health` `ok=true`, deployed build `72ababb8`
(v0.6.82). This is the first live turn to drive the full `structured → wiki → sandbox` three-worker chain
model-driven, with the progress bridge and app-owned findings-chaining active, all the way to a
founder-visible cited answer.

**Flag config used (`vcso_sdk_loop`), founder-only, then re-darkened immediately after the turn:**
- enrolled founder `cd490873-99aa-4533-9240-f0aa04deb54f` only; `native_model_driven_enabled=true`;
  `diagnostic_single_worker_enabled=false` (the **full three-worker chain**, not the single-worker
  diagnostic); `max_turns=12`; `max_budget_usd=0.50`.
- **Re-darken confirmed (read back after the turn):** both allowlists empty
  (`test_user_ids=[]`, `diagnostic_user_ids=[]`), `native_model_driven_enabled=false`. `vcso_planner`
  remains dark/retired throughout.

**Runs (from `agent_delegation_runs`):**
- Parent `f0f5add5-c71f-476f-82e7-95a6d3187766` (`vcso_chat_tool_loop`) — status **completed**, no error,
  duration **3m34s**.
- Three worker types, **all `task_pre_tool_use → allow` on the FIRST attempt (zero denials, zero
  thrashing)**, all completed:
  - `structured_data_agent` child `073534ec-da43-47d6-8a8e-374f6e05f8de` — completed, **0.3s**.
  - `per_user_wiki` child `76e36f48-fbe6-47ce-bf8b-34761c2594bd` — completed, **2.0s**.
  - `per_user_wiki` child `db140287-56cb-4fb0-a44f-39022384e222` — completed, **1.0s**.
    **(DUPLICATE dispatch — the same `per_user_wiki` capability was dispatched twice; both completed.
    Recorded as the known non-blocking wart — see the named follow-up below.)**
  - `sandbox_execution_agent` child `e48905fd-48ac-434c-914b-ea38801f7912` — completed, **113s** — ran
    **in-band under the 240s `MCP_TOOL_TIMEOUT`**, which is the fix that unblocked canaries 6/7 (the slow
    sandbox worker previously timed out at the ~60s default and never returned to the lead in-band).

**Lifecycle — the full happy path across three worker types, no denials:**
- `runtime_manifest decision=model_driven`;
- **3×** (`Task allow` on the first try + `pre_tool_probe` with `agent_id_present=true`);
- `worker_hop` **received + completed** for all three worker types (`per_user_wiki` twice — the duplicate);
- **no failures, no denials.**

**Founder-visible cited answer:** **8,577 chars, 33 citations** to real founder wiki/data. Structure
"The Read / The Verdict / 90-Day Sequenced Action"; names a single binding constraint
("no systematized pipeline"); grounded in real figures — $45K rev, 71.1% gross / 18.5% net margins,
Vantage $32K + Harborline $28K = **41% of book**, 3.6-month runway, 2.5% churn. Main compose cost
**$0.1454**.

**Tier 2 CLOSED — full structured → wiki → sandbox three-worker chain proven live end-to-end, with the
progress bridge and app-owned findings-chaining, and a founder-visible cited answer.**

### Named non-blocking follow-up recorded here — duplicate worker dispatch (defect #4)

`per_user_wiki` was dispatched twice this run (children `76e36f48…` and `db140287…`), both completed. A
re-sent CLI `tools/call` starts a second `start_run`; the fix is to dedupe/coalesce on
`(token, capability_key)` in `services/vcso_worker_mcp.py` (~:198–268). **Cosmetic today** — workers
occasionally run twice and both complete, so the answer is unaffected — but it is wasteful and should be
made idempotent. Batched to the tier-2-close backlog (item 1); see
`04B-D2-TIER2-CLOSE-HANDOFF.md`.
