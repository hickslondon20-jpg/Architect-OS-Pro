# 04B Phase D2 (SDK-M2) — Handoff #2: Session Recap & Path to Production

**Date:** 2026-07-20 · **Session:** finish-runbook execution + four canaries + remediation
**Repo root:** `C:\Users\Hicks\ArchitectOS Pro_beta` · backend in `python-backend`
**Self-contained.** You do not need the prior conversation. Full evidence trail is in
`04B-D2-M2-FINISH-LOG.md` (same folder) — read that second, this first.

---

## 1. The one-sentence status

**Model-driven delegation is proven working in production** — the SDK lead reasons a decomposition,
delegates via the delegation tool, and the worker executes inside the spawned subagent with `run_<agent>`
invisible to the lead — **but no turn has yet produced a founder-visible cited answer**, because each of
four canaries exposed a different defect. Three are fixed and deployed; two more fixes are committed but
**not yet pushed**.

---

## 2. Exact state right now

| Thing | State |
|---|---|
| Working tree | **clean** |
| Local `HEAD` | `dba961c9` (v0.6.73) |
| `origin/main` | `89c23599`'s parent — **v0.6.72 and v0.6.73 are UNPUSHED** |
| Deployed (`/api/health`) | `8ecd3cb7` = **v0.6.71**. The scope fix + diagnostics are NOT live |
| `vcso_sdk_loop` flag | **dark** — `is_enabled=false`, both allowlists empty, `native_model_driven_enabled=false` |
| `vcso_planner` | **dark / retired** (untouched all session) |
| Path A | untouched, byte-identical, still the working fallback |
| Focused test suite | **35 passed** (`test_vcso_worker_mcp.py`, `test_vcso_sdk_config.py`, `test_vcso_sdk_loop.py`) |

**First action for the next agent:** `git push` (deploys v0.6.72+v0.6.73), then confirm
`/api/health` `commit_sha_short` == `dba961c9` before anything else.

---

## 3. What shipped this session (v0.6.60 → v0.6.73)

| Version | What |
|---|---|
| v0.6.60 | Pre-fix: `HarnessEngine.from_env()` → `VectorStore.from_env()` (wires the OpenAI client) |
| v0.6.61 | Fixed a **stale Path-A test** red since v0.6.57 (worker execution order) + the new M2 integration test |
| v0.6.62 | **SDK-M2 landed**: worker MCP core + transport, mount, config path, loop branch, chat-service flag |
| v0.6.63–66 | Planning docs; harness `CONTEXT.md` constraint #9 (replicas vs. in-container workers) |
| v0.6.67–68 | Canary 1 + 2 results and the local CLI diagnosis |
| v0.6.69 | Fix 1+2: provision the delegation tool; key hooks to its **runtime** name |
| v0.6.70 | (London) venv sync |
| v0.6.71 | Fix 3: exempt **both** delegation names from `disallowed_tools`; **`/api/health` now reports `commit_sha`** |
| v0.6.72 | Canary 3 result — delegation proven in production |
| v0.6.73 | Fix 4+5: **app-owned worker `context_scopes`**; **`worker_hop` diagnostics** |

---

## 4. The four canaries — what each one bought

Total spend across all four: **~$0.45**.

| # | Result | What it bought |
|---|---|---|
| 1 | FAIL — no delegation, max-turns | Root causes 1+2 (found locally afterwards) |
| 2 | FAIL — identical | Root cause 3 (`disallowed_tools`) — deploy confirmed live for 13h, so the fix was incomplete |
| 3 | **Delegation PROVEN**; worker produced no child row | Settled the §4 residual **positively**; isolated the fault to the worker hop |
| 4 | *not run* — packed up here | — |

### Canary 3's lifecycle (the breakthrough)

```
1 runtime_manifest    decision=model_driven, reason_code=none
2 task_pre_tool_use   DENY  "Task contract boundaries must be a non-empty list"
3 task_pre_tool_use   ALLOW "approved_bounded_contract"      <- lead self-corrected
4 pre_tool_probe      mcp__vcso_workers__run_structured_data_agent, agent_id_present: TRUE
5 task_pre_tool_use   DENY  "worker may run only once per turn"
```

Event 4 is the whole point of Phase D2: against the real deployment, the worker tool fired **from inside
the Task-spawned subagent**, over the loopback per-turn-token URL, with `run_<agent>` never in the lead's
schema. Event 2→3 also proves the delegation-contract gate works and the model recovers from denials.

---

## 5. The five defects found (and the pattern behind them)

1. **`tools=[]` disabled the delegation tool.** The SDK's `tools` field *provisions* built-ins; `[]`
   disables all of them. `allowed_tools` only *permits*. The lead had an empty tool schema and
   hallucinated delegations in prose. *(v0.6.69)*
2. **The delegation tool is named `Agent`, not `Task`.** `"Task"` is the provisioning name; the model
   emits `Agent`. Every hook matcher and `tool_name ==` check was keyed to a string never emitted, so the
   contract gate and completion bridge never fired. *(v0.6.69)*
3. **`DISALLOWED_SDK_BUILTINS` blocks both names**, and v0.6.69 exempted only the provision name — so the
   lead held a tool it was forbidden to call. *(v0.6.71)*
4. **The model was choosing the founder's data scope.** Path A passes `native_subagent_scopes`;
   model-driven built `context_scope` from the model-authored contract, which has no founder bindings, so
   the worker reviewed **0 datasets** and returned "no sources". A scope-integrity issue, not just
   quality. *(v0.6.73)*
5. **The worker hop was unobservable.** The endpoint runs in a separate request context and cannot reach
   `record_lifecycle`, so "never arrived" was indistinguishable from "arrived and failed". *(v0.6.73)*

### The pattern worth carrying forward

**Defects 1–3 are all the same shape: a static safety check reading the wrong field.** The manifest
asserted the lead *could* delegate by inspecting `allowed_tools`, while the real capability depended on
`tools` (provisioning), `disallowed_tools` (prohibition), and the runtime tool name. Each canary bought
exactly one of them, at ~$0.12 a time.

**Defects 4–5 came from a second habit: proving things on a simplified surface.** The local CLI probe
initially set no `disallowed_tools`, and its stand-in worker server ignored tokens and always succeeded —
so it passed while production failed. **Every probe now mirrors production's real option surface.** If
you add a new probe, make it reproduce production's config exactly before you trust a green result.

---

## 6. What is left before this is production-ready

### 6.1 Blocking — must be done to close SDK-M2

- **B1. Push v0.6.72+v0.6.73 and confirm the deployed SHA.** Nothing below is meaningful until the
  scope fix and diagnostics are live.
- **B2. Run canary 4.** Arm (see §7), send **one** turn, read the `worker_hop` events:
  - no `worker_hop` events ⇒ the loopback request never reached the endpoint. **This is the live
    hypothesis.** Investigate the in-container base URL (`VCSO_WORKER_MCP_BASE_URL` overrides
    `http://127.0.0.1:${PORT}`).
  - `received` with no `completed` ⇒ it landed and execution failed; the error text is in the event.
  - `received` + `completed` ⇒ the hop worked; any remaining fault is downstream (composition).
- **B3. Get one founder-visible cited answer.** This has never happened on the model-driven path. It is
  the actual acceptance criterion — not the lifecycle events.
- **B4. Verify the answer quality matches Path A.** Compare against the Stage G control
  (`7274db2a…`, 2026-07-19 04:04:50Z): one completed `structured_data_agent` child reviewing **1**
  dataset, a cited 90-day recommendation, ~$0.06.

### 6.2 Required before the flag could ever go beyond the founder

- **P1. The full three-worker anchor.** Everything so far is the single-worker diagnostic. The real path
  is `structured → sandbox → wiki`, which needs `prior_findings` chaining across the external hop
  (`TurnScope.prior_findings` exists but is never populated) so sandbox inherits structured's finding.
- **P2. The C2 progress bridge (M4).** `TurnScope.progress_bridge` is `None`. Workers currently run
  invisibly — no nested UI steps, no `sources_updated` events. The founder sees a spinner then an answer.
  Path A emits these; model-driven does not. **This is a visible UX regression and must land before
  anyone but the founder sees this path.**
- **P3. `per_user_wiki` confirmation.** Never validated since the v0.6.59 embedding fix (it failed with
  "OPENAI_API_KEY is required for embedding" on 2026-07-16). Deferred all session because the
  single-worker probe never touches it. P1 will exercise it.
- **P4. Failure UX.** Every failed canary showed the founder *"I couldn't complete that response."* On a
  worker failure the turn should degrade to a useful answer, not a dead end.
- **P5. Budget/turn headroom.** `max_turns=6` was consumed by retries in every failure. Confirm a healthy
  turn's actual consumption before setting production caps.

### 6.3 Known debt (non-blocking, recorded)

- **D1. The venv is committed to git** (`python-backend/venv/`, ~34k files). v0.6.70 synced it rather
  than untracking it. It already caused one false-positive test pass against a stale `mcp` version.
  Should be untracked and `.gitignore`d.
- **D2. `create_client` is now an unused import** in `services/harness_engine.py` (left deliberately, as
  the runbook scoped that commit to one hunk).
- **D3. The diagnostic probe scripts** (`scripts/probe_cli_*.py`, `scripts/probe_worker_hop.py`,
  `scripts/smoke_worker_mcp.py`) are committed. Keep them — they are the regression harness for this
  mechanism — but they are developer tools, not product.
- **D4. `_native_lead_prompt` still says "Use only the SDK Task tool"** while the tool is presented as
  `Agent`. The model coped, but the wording should match reality.
- **D5. Constraint #9** in the harness `CONTEXT.md`: scale replicas, never in-container workers, until
  `TURN_REGISTRY` has a shared backing store. `WEB_CONCURRENCY` must stay unset (confirmed unset).

---

## 7. Operating procedure for the next canary

**Pre-flight (mandatory):**
```bash
curl https://api.architectospro.com/api/health     # commit_sha_short == your intended SHA
```

**Arm** (Supabase `platform_ai_settings`, `setting_key='vcso_sdk_loop'`, merge — do not replace):
```json
{ "is_enabled": true,
  "settings": { "test_user_ids": ["cd490873-99aa-4533-9240-f0aa04deb54f"],
                "diagnostic_user_ids": ["cd490873-99aa-4533-9240-f0aa04deb54f"],
                "diagnostic_single_worker_enabled": true,
                "diagnostic_single_worker": "structured_data_agent",
                "native_model_driven_enabled": true,
                "max_turns": 6, "max_budget_usd": 0.25 } }
```

**The anchor question — use this exact wording:**

> Our client concentration is rising and our margin is compressing. What should I do in the next 90 days?

⚠ It must contain a financial term, the word `concentration`, and **`90 days` with a space**. The
regex is `\b90\s+days?\b`, so **"90-day" with a hyphen silently fails** and the turn quietly runs the
ordinary path — which is how the very first attempt was wasted. Sign in as **`hicks.london25@gmail.com`**
(`cd490873…`), *not* the everyday `4ef8…` account, or the allowlist will not match.

**Read the result:**
```sql
select id, capability_key, status, parent_run_id, error_message,
       jsonb_pretty(metadata->'sdk_native_lifecycle') as lifecycle, created_at
from agent_delegation_runs where created_at > now() - interval '30 minutes' order by created_at;

select role, model, capability_key, cost_usd, created_at from ai_usage_log
where created_at > now() - interval '30 minutes' order by created_at;
```

**Re-darken immediately after every turn** (`is_enabled=false`, both allowlists `[]`,
`diagnostic_single_worker_enabled=false`, `native_model_driven_enabled=false`) and read back both
`vcso_sdk_loop` and `vcso_planner` dark.

---

## 8. Hard rules (unchanged, carry forward)

Keep `vcso_sdk_loop` dark and founder-only; re-darken immediately after each turn. Keep **Path A as the
fallback** and do not prune the native-delegation scaffolding. Preserve every lock: founder isolation,
one-writer, Claude-lock (Sonnet compose / Haiku workers via the MA-06 tier map), no founder-facing model
selector, tier authority at the capability grain. `vcso_planner` stays retired. Version-tagged commits,
committing after each logical unit. Do not flip defaults or edit the harness-root `ROADMAP.md`. **Do not
start SDK-M3** (effort-scaling, the full anchor, the C2 progress bridge) or touch MCP/financial-series
(Phase F) until SDK-M2 closes with a founder-visible cited answer.

**Confirm deployed head == intended SHA before every canary.** `/api/health` now returns `commit_sha`,
so this is a direct read — use it.

---

## 9. Key files

```
python-backend/services/
  vcso_worker_mcp.py         TurnScope / TurnRegistry / run_worker_capability (+ context_scopes, diagnostics)
  vcso_worker_mcp_server.py  FastMCP loopback transport; worker_session_manager_lifespan()
  vcso_sdk_config.py         DELEGATION_TOOL_* constants; model-driven compile path
  vcso_sdk_loop.py           the model-driven branch, inverted manifest, completion bridge, hop drain
  vcso_chat_service.py       reads native_model_driven_enabled, founder-scoped
python-backend/main.py       mounts /internal/mcp/workers + starts its session manager; /api/health SHA
python-backend/scripts/      probe_cli_model_driven.py | probe_cli_debug.py | probe_worker_hop.py | smoke_worker_mcp.py
.planning/orchestration-harness/phases/04B-vcso-sdk-migration/
  04B-D2-M2-FINISH-LOG.md    FULL evidence trail — read this second
  04B-D2-FINDINGS.md         the original mechanism analysis (§4 residual, now settled positively)
  04B-D2-M2-BUILD.md         what landed in the original build
```

---

## 10. Honest assessment

The hard, uncertain question this phase existed to answer — *can the SDK lead be made to delegate to
workers it cannot see, and does the real CLI consume that construction?* — **is answered, and the answer
is yes.** That was the genuine risk, and it is retired.

What remains is ordinary integration work: one environmental unknown (does the loopback request reach the
endpoint in-container), a UX regression to close (the progress bridge), and the multi-worker path to
exercise. None of it is architecturally uncertain.

The main process lesson is worth keeping: **four canaries were spent because static checks and local
probes were each validating a simplified version of the real surface.** The manifest now asserts all four
delegation preconditions and the probes mirror production's config — so the next failure should cost a
test run, not a canary.
