# 04B Phase D2 — Tier 2 Close Handoff (cold-pickup)

**Date:** 2026-07-20 · **Session:** Canary 8 PASS — full three-worker chain proven live; Tier 2 closed.
**Repo root:** `C:\Users\Hicks\ArchitectOS Pro_beta` · backend in `python-backend`
**Self-contained.** You do not need the prior conversation. Full evidence trail:
`04B-D2-M2-FINISH-LOG.md` → "Canary 8" (read that second). This doc is the pickup for the *next* session:
the founder is banking this win and batching remaining polish for later.

---

## 1. Current state (verified)

| Thing | State |
|---|---|
| Deployed head (`/api/health`) | `72ababb8` = **v0.6.82**, `ok=true` |
| Working tree | **clean** |
| Focused test suite | **45 passed** |
| `vcso_sdk_loop` flag | **dark & verified** — `is_enabled=false`, both allowlists empty (`test_user_ids=[]`, `diagnostic_user_ids=[]`), `native_model_driven_enabled=false` |
| `vcso_planner` flag | **dark / retired & verified** — untouched |
| Path A | **untouched, byte-identical, still the working fallback** |
| D2 objective, tier 1 | **DONE** — canary-proven (SDK-M2 closed, Canary 5) |
| D2 objective, tier 2 | **DONE** — canary-proven (Canary 8: full `structured → wiki → sandbox` three-worker chain live, progress bridge + app-owned findings-chaining, founder-visible cited answer) |
| SDK-M3 | **not started** |

**Canary 8 headline (evidence in the FINISH-LOG):** parent run
`f0f5add5-c71f-476f-82e7-95a6d3187766` completed (3m34s); four children all completed, all `Task allow`
on the first attempt (zero denials); the slow sandbox worker ran **113s in-band under the 240s
`MCP_TOOL_TIMEOUT`**; founder-visible answer **8,577 chars / 33 citations**, compose $0.1454. Flag
re-darkened immediately after.

---

## 2. Fix arc this session (one line each)

| Version | What |
|---|---|
| v0.6.75 | Worker-handler **pre-approval** on the lead's `allowed_tools` + **gate inversion** (isolation guards exposure, not permission) — **Defect 6** |
| v0.6.76 | Lead-prompt **contract schema** (Task-contract schema tail + worked example) — contract approved first-try |
| v0.6.77 | Record **Canary 5 PASS** — first founder-visible cited answer on the model-driven path; **SDK-M2 closed** |
| v0.6.78 | **Progress bridge** — model-driven workers emit `sub_agent_step` SSE events |
| v0.6.79 | **App-owned findings chaining** across the model-driven worker hop |
| v0.6.80 | Per-agent http **`timeout` config key** — **LATER REVERTED** (rejected by the deployed CLI) |
| v0.6.81 | **Graceful-compose from DB-completed workers** — `stop_hook` + terminal check consult `model_driven_completed_children` instead of thrashing |
| v0.6.82 | **Revert** the per-agent timeout key → deliver the 240s worker timeout via the **`MCP_TOOL_TIMEOUT`** Railway env var |
| v0.6.83 | This doc + Canary 8 PASS records (Tier 2 close) |

---

## 3. CRITICAL INFRA NOTE (must persist)

**The worker tool-call timeout lives ONLY in the Railway env var `MCP_TOOL_TIMEOUT=240000` (ms). It is
NOT in code.** The SDK forwards the backend process environment to the CLI subprocess, so this env var is
how the 240s timeout reaches the CLI.

- If the backend service is **recreated or migrated and this env var is lost**, the slow
  `sandbox_execution_agent` worker (~113s) will time out again at the CLI's ~60s default, its return will
  not reach the lead in-band, and delegation-completion degrades to the graceful-compose safety net
  (v0.6.81). Re-set `MCP_TOOL_TIMEOUT=240000` on the Railway service.
- The per-agent config `timeout` key (v0.6.80) was **tried and rejected by the deployed Linux CLI** — it
  broke delegation entirely in canary 7 (lead ran, zero delegations, zero worker calls). Reverted in
  v0.6.82. **Do not re-add it.** Detail in `04B-D2-FINDINGS.md` §10.

Single-process env only — no `WEB_CONCURRENCY`, no `--workers` (the `TURN_REGISTRY` is process-global;
`04B-D2-M2-FINISH-LOG.md` Stage D + harness `CONTEXT.md` constraint #9).

---

## 4. Batched remaining-work backlog (priority order)

1. **[medium] Duplicate worker dispatch idempotency (defect #4).** A re-sent CLI `tools/call` starts a
   second `start_run` (canary 8 dispatched `per_user_wiki` twice; both completed). Dedupe/coalesce on
   `(token, capability_key)` in `services/vcso_worker_mcp.py` (~:198–268). Cosmetic today — workers
   occasionally run twice, both complete, answer unaffected — but wasteful.
2. **[medium] Tier 3 — graceful-failure UX.** The DB-completion safety net (v0.6.81, `vcso_sdk_loop.py`
   `stop_hook` + terminal check) is **built but never exercised live** (nothing has failed since). The
   optional finding-injection is left as a TODO at `vcso_sdk_loop.py:~1001–1004`. Needs a **live
   fault-injection test** + a **real partial-answer surface** (replace the binary `_failed_turn_message`
   at `vcso_chat_service.py:~3110`).
3. **[medium] Tier 3 — `per_user_wiki` formal confirmation.** Embedding semantic-ranking validation is
   deferred (`tests/test_wiki_08_acceptance.py:~1224–1230`); relates to the v0.6.59 embedding fix
   (`services/harness_engine.py:~110–112`).
4. **[large] SDK-M3.** Effort-scaling + explicit per-worker delegation contracts + full anchor.
5. **[medium] M4.** Progress-bridge full C2 frontend surface — the bridge emits `sub_agent_step` today;
   the full surface treatment is pending.
6. **Later phases.** E (sessions + Deep Mode reconciliation), F (first live MCP — QuickBooks; sandbox real
   compute + financial-series storage), G (generalize / verify / cut over).

---

## 5. How to resume a canary

1. **Pre-flight:** `curl https://api.architectospro.com/api/health` — confirm `commit_sha_short` == the
   intended SHA and `ok=true`.
2. **Arm** (`platform_ai_settings`, project `pwacpjqkntnovndhspxt`, `setting_key='vcso_sdk_loop'`, merge —
   do not replace): flip `is_enabled=true`, set `test_user_ids` and `diagnostic_user_ids` to the seeded
   founder UUID `cd490873-99aa-4533-9240-f0aa04deb54f` only, `native_model_driven_enabled=true`. For the
   full chain keep `diagnostic_single_worker_enabled=false`.
3. **Send the anchor turn** signed in as the **seeded** account `hicks.london25@gmail.com` (the enrolled
   `cd490873…` UUID — *not* the everyday `4ef8…` account, or the allowlist will not match). Anchor must
   contain a financial term, the word `concentration`, and **`90 days` with a space** (regex
   `\b90\s+days?\b` — a hyphenated "90-day" silently no-ops).
4. **Read the result:** `agent_delegation_runs` (parent + child rows, `metadata->sdk_native_lifecycle`),
   `ai_usage_log` (costs), `vcso_chat_messages` (the composed answer).
5. **Re-darken immediately after:** `is_enabled=false`, both allowlists `[]`,
   `native_model_driven_enabled=false`, `diagnostic_single_worker_enabled=false`; read back both
   `vcso_sdk_loop` and `vcso_planner` dark.

Single-process env only (no `WEB_CONCURRENCY` / `--workers`).

---

## 6. Hard rules (unchanged, carry forward)

Keep `vcso_sdk_loop` dark and founder-only; re-darken immediately after each turn. Keep **Path A as the
fallback**; do not prune the native-delegation scaffolding. Preserve every lock: founder isolation,
one-writer, Claude-lock (Sonnet compose / Haiku workers via the MA-06 tier map), no founder-facing model
selector, tier authority at the capability grain. `vcso_planner` stays retired. Version-tagged commits,
one per logical unit. **Do not flip defaults or edit the harness-root `ROADMAP.md`** (that is the
separately founder-gated Phase G update). Confirm deployed head == intended SHA before every canary.

---

## 7. Key files

```
python-backend/services/
  vcso_worker_mcp.py         TurnScope / TurnRegistry / run_worker_capability; dedupe target ~:198-268
  vcso_worker_mcp_server.py  FastMCP loopback transport; worker_session_manager_lifespan()
  vcso_sdk_config.py         DELEGATION_TOOL_* constants; model-driven compile path; worker pre-approval
  vcso_sdk_loop.py           model-driven branch; inverted manifest; completion bridge; stop_hook + terminal
                             check (graceful-compose, v0.6.81); optional finding-injection TODO ~:1001-1004
  vcso_chat_service.py       reads native_model_driven_enabled; _failed_turn_message ~:3110
python-backend/main.py       mounts /internal/mcp/workers + session manager; /api/health SHA
.planning/orchestration-harness/phases/04B-vcso-sdk-migration/
  04B-D2-M2-FINISH-LOG.md    FULL canary-by-canary evidence trail (read "Canary 8" second)
  04B-D2-FINDINGS.md         mechanism analysis; §9 Defect 6; §10 MCP_TOOL_TIMEOUT / rejected timeout key
  04B-D2-M2-HANDOFF-2.md     prior handoff (pre-Canary-8 state)
```

**Railway infra:** `MCP_TOOL_TIMEOUT=240000` (see §3). Do not lose it.
