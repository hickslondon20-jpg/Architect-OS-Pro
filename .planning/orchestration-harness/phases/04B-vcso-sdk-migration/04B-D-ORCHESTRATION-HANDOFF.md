# 04B Phase D — Handoff to the Orchestration Agent (SDK Migration)

**Date:** 2026-07-16 · **Status:** SOFT-LOCK — delegation architecture proven; sandbox real-compute
deferred. **Live head:** `v0.6.59` (deployed). **Flags:** `vcso_sdk_loop` dark, `vcso_planner` dark.
**Full evidence log:** `04B-D-REMEDIATION.md` §§17–24.

---

## 1. TL;DR

Phase-D delegation (VCSO decompose → workers → compose) is **working and proven end-to-end** via a new
approach — **Path A: deterministic application-owned delegation**. The three prior SDK-native attempts
failed on one fundamental SDK limitation (tool *visibility*), not permission. Path A sidesteps it: the
app runs the required workers via the existing `SubAgentOrchestrator` before the SDK lead composes. The
single-worker and multi-worker live canaries passed, the sandbox worker fires and returns results, and
the two bugs found along the way (wiki embedding client, provider policy) are fixed. The **only** thing
intentionally left open is the sandbox's real *computation*, which is a data-storage decision (below).

## 2. What's now PROVEN / working (live evidence)

- **Path A engine** — the lead sees no worker tools and no `Task`; the app deterministically runs the
  required workers via `SubAgentOrchestrator.start_run` (depth 1, worker tier, compact contract,
  citations), then the SDK lead composes from the injected findings. Removes the model's tool-selection
  from the critical path and guarantees the mandatory children.
- **Single-worker canary — PASSED** (§20). Parent `2bcda40b…` completed; child `6d84569f…`
  (`structured_data_agent`) created **before** synthesis; cited answer; `app_owned` lifecycle; Sonnet
  compose `$0.0597` (cap `$0.25`). First delegation success after Fixes A/B/C.
- **Three-worker run on v0.6.58 — improvements validated** (§23). Parent `721f7d9a…` completed;
  children in the new order `structured → sandbox → wiki`:
  - `96e6ed4b…` `structured_data_agent` — completed.
  - `eeeddb25…` `sandbox_execution_agent` — **completed. Sandbox fired for the first time** and returned
    a well-formed structured result (a working smoke of the sandbox as a connected worker).
  - `0181d8b7…` `per_user_wiki` — failed **but did not abort the turn** (best-effort granularity proven).
- **Worker ordering + failure granularity (v0.6.58)** — mandatory compute chain runs first; a
  best-effort (wiki) failure no longer fail-opens the whole turn.
- **Live safety discipline** — every canary was founder-only, immediately re-darkened, and read back
  off; `vcso_planner` untouched throughout.

## 3. What we figured out (root causes)

- **Why the three native attempts failed = tool VISIBILITY, not permission.** In SDK 0.2.118 an
  in-process MCP server must register at session scope, so its worker-handler tools are exposed to the
  **lead's** tool schema. `allowed_tools` is permission-only; `AgentDefinition.tools` scopes the
  subagent, not the lead; `disallowed_tools` is global. So the model kept calling the handler directly
  instead of `Task`. Native worker-scoping is only possible with an **external** (stdio/HTTP)
  serializable MCP server — a real re-architecture that still leaves decomposition to the model. Path A
  was chosen instead. (§17)
- **Why `per_user_wiki` failed with "OPENAI_API_KEY is required for embedding" despite the key being
  set** — the VCSO store was constructed with the OpenAI client hard-wired to `None`:
  `VcsoChatService.from_env()` called `VectorStore(client, None, settings)`. So every VCSO sub-agent had
  no embedding client regardless of the env key. Fixed in v0.6.59 by building the store via
  `VectorStore.from_env()`. (§24)

## 4. Versions shipped this thread

| Version | What | Result |
|---|---|---|
| v0.6.53 | PreToolUse allow-hook (Option 1) | Failed — visibility |
| v0.6.54 | `allowed_tools` grant + handler guard (Fix B) | Failed — lead called handler directly |
| v0.6.55–56 | Diagnostic substrate + Fix C isolation | Failed — visibility persisted (clean manifest, lead still direct-called) |
| **v0.6.57** | **Path A — deterministic app-owned delegation** | **Single-worker canary PASSED** |
| **v0.6.58** | **Path A worker ordering + best-effort wiki** | **3-worker: structured + sandbox completed; wiki best-effort** |
| **v0.6.59** | **Wire OpenAI client into VCSO `VectorStore`** | **Deployed — pending one confirmation turn** |
| (doc) | CLAUDE.md Rule #2 rewritten | OpenAI required for embeddings/RAG/metadata; Claude for synthesis; agent model flexibility case-by-case (MA-06) |

## 5. Soft-locked / deferred (for the orchestration agent)

1. **Sandbox real computation — deferred (the big one).** The sandbox is wired and fires; it currently
   returns "insufficient data" because `structured_data_agent` only surfaces a single aggregate P&L row
   (`SEED — Q2 2026 P&L`: net_revenue/net_income for June only) — no client-level revenue (concentration)
   and no multi-period series (margin trend). Closing this is a **data-storage design decision**, not a
   delegation fix: how to store/vectorize a financial series (a full vectorized P&L uploaded, or one we
   generate then vectorize into the wiki/retrievable store) given there's no table for it today. A real
   compute call will most likely pull from the **MCP connections**, so validating the full computation
   is a better fit **once MCP retrieval is in the loop.** Brainstorm storage + test approach here.
2. **v0.6.59 wiki fix — deployed, not yet confirmed with a live turn.** High confidence (root cause is a
   one-line client wiring), but not re-verified. First easy step next pass: one founder-only anchor turn
   → confirm `per_user_wiki` completes → re-darken.
3. **Sibling bug (out of Phase-D scope):** `harness_engine.py:110` uses the same
   `VectorStore(client, None, settings)` pattern — any domain-agent/harness worker that embeds will hit
   the identical failure. Fix in a separate pass.

## 6. Current live state

- Deployed head: `v0.6.59` (GitHub pushed + deployed by founder).
- `vcso_sdk_loop`: `is_enabled=false`, empty `test_user_ids`/`diagnostic_user_ids`,
  `diagnostic_single_worker_enabled=false`. `vcso_planner`: off. Both confirmed dark.
- Provider config verified live: `openai_env_present=true`, `openai_settings_present=true`,
  `claude_synthesis_model=claude-sonnet-4-6`.

## 7. Recommended next steps (next pass)

1. One confirmation turn on v0.6.59 → verify `per_user_wiki` completes (fix #2 above).
2. Decide the financial-series storage/vectorization approach (soft-lock item #1), ideally alongside the
   MCP-connection retrieval path, then run a full anchor that produces a real sandbox concentration/margin
   computation.
3. Fix the `harness_engine.py` sibling site.
4. Optional cleanup: prune the now-unused native-delegation machinery in `vcso_sdk_loop.py` (the old
   `pre_task_use` / gate / subagent hooks / `make_native_handler_tool` / manifest builder) left in place
   to keep Path A diffs contained.

**Canary runbook (reusable):** confirm deployed head == intended SHA + `/api/health ok=true`; enroll
founder `cd490873-99aa-4533-9240-f0aa04deb54f` only (add to `test_user_ids`; for single-worker set
`diagnostic_single_worker_enabled=true` + `diagnostic_user_ids=[founder]` +
`diagnostic_single_worker="<worker>"`); send one anchor turn; verify `agent_delegation_runs` child rows +
parent metadata `sdk_native_lifecycle`; **re-darken immediately** and read back off.
