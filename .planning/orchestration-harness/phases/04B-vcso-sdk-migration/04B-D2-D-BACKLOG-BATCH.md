# 04B Phase D2 — Backlog batch (pre-M3) · build record

**Date:** 2026-07-21 · **Predecessor:** `04B-D2-TIER2-CLOSE-HANDOFF.md` (Tier 2 closed at `v0.6.83`).
**Scope:** the three batched-polish items in that handoff's §4 (items 1–3). SDK-M3, M4, and E/F/G
untouched by instruction.

**Versions produced:** `v0.6.84`, `v0.6.85`, `v0.6.86`. Local `main` is **three commits ahead of the
deployed head `9d6a5633`** — nothing here is deployed yet, so neither live confirmation has run.

---

## 1. What landed

| Item | Version | State |
|---|---|---|
| 1 · Duplicate dispatch idempotency (defect #4) | `v0.6.84` | **Built + unit-proven.** Live canary confirmation pending a deploy. |
| 2 · Tier 3 graceful-failure UX | `v0.6.85` | **(b) partial-answer surface built + unit-proven. (a) fault-injection mechanism built; the live fault-injection canary itself is pending a deploy.** |
| 3 · `per_user_wiki` formal confirmation | `v0.6.86` | **DONE — closed live.** DI-EMBED passes against real embeddings; sibling confirmed closed. |

Focused unit suite: **71 passed** (was 45 at Tier 2 close; +5 dedupe, +21 graceful-failure).
Live wiki acceptance suite: **44 passed, 1 skipped** (the unrelated G2 founder-JWT item).

---

## 2. Item 1 — dispatch idempotency (`v0.6.84`)

`run_worker_capability` now coalesces on `(token, capability_key)` for the life of the turn scope:

- a per-capability `asyncio.Lock` on the `TurnScope` serialises a duplicate that lands **mid-flight** (the
  re-sent-after-a-slow-worker case, which a cache-only check would miss);
- a `completed_results` cache replays the first run's compact result to that duplicate and to any later
  re-send, returning a **copy** so the lead cannot corrupt the cached finding;
- **only successful completions are cached** — a raised dispatch leaves no entry, so a genuine retry after
  a failure still runs a real worker. The dedupe suppresses waste, never recovery;
- the app-owned findings-chaining write stays single-shot (a replay cannot clobber a downstream worker's
  inherited finding with a stale copy);
- a `deduped` diagnostic (with `same_objective`) joins `received` / `completed` in the `worker_hop`
  lifecycle stream, so the coalesce is visible in a canary rather than silent.

**Live acceptance still owed:** a canary showing **one dispatch per `(token, capability_key)`** —
i.e. exactly one `per_user_wiki` child row — with the answer unaffected.

## 3. Item 2 — Tier 3 graceful-failure UX (`v0.6.85`)

**(b) Partial-answer surface — built.** `_recover_failed_turn` now reads the parent-linked completed
children *before* writing the apology, and `_failed_turn_message` renders them as a real partial answer.
Per-capability dedupe (so a duplicate dispatch never doubles a line, even on a build predating item 1);
citation markers stripped, because a degraded turn is written with `citations=[]` and a surviving `[3]`
would render a reference the founder cannot open. The failure trace step and the run's `structured_result`
name the workers that completed. **With no completed children the copy is byte-identical to before.** The
lookup is read-only and fail-open — it can never be the reason a founder loses the turn entirely.

> **Note for the deploy:** this is the one change in the batch that touches a **live** founder-visible
> surface. Everything else is behind the dark model-driven flag. It only fires on a turn that already
> failed, and only makes that failure *less* lossy.

**(a) Fault injection — mechanism built, canary owed.** A dark, founder-only `vcso_sdk_loop` sub-flag
forces a named required worker to fail **before `start_run`**, so no child row is written and the
completion bridge faces a *real* absence rather than a simulated one. Gated exactly like the existing
`diagnostic_single_worker` probe, plus one extra guard: it **refuses to fail every required worker** (a
turn with nothing left to compose from is total failure, not the graceful-degradation case being
rehearsed). Empty on every other path, so it is inert by construction.

New settings keys (both required, both absent by default):

```
diagnostic_fault_injection_enabled: true
diagnostic_fault_injection_workers: ["sandbox_execution_agent"]
```

**Out of scope, still deferred by instruction:** the mid-stream finding-injection into the SDK lead
(`vcso_sdk_loop.py` TODO, ~:1002) stays an M4 item. The partial-answer surface deliberately does *not*
need it — it is an after-the-fact read of what the app already persisted, so it adds no SDK machinery and
cannot perturb a live turn.

## 4. Item 3 — `per_user_wiki` formal confirmation (`v0.6.86`) — **CLOSED**

DI-EMBED was a bare `pytest.mark.skip` asserting nothing. It is now a real check: three claims about
clearly different parts of the business are written through the **production writeback path** (which
embeds with the real client), then two queries that share **no content words** with their target claim
must each rank the semantically-right claim first, by a **≥0.05 similarity margin**. Word overlap cannot
carry that — only real embeddings can. Two different target claims, so a single lucky ordering cannot pass
both. It still skips loudly (never fakes) without live OpenAI.

Two blockers found and fixed to get there:

1. **`tests/conftest.py` read the service-role key only under the aliases `service_role` /
   `SUPABASE_SERVICE_KEY`.** `.env.local` carries `SUPABASE_SERVICE_ROLE_KEY` directly, so the key was
   never found, the `store` fixture skipped, and **the entire live wiki suite was reporting
   green-by-skip.** Now tries the backend's own names first.
2. With the suite actually running, step 1 failed: the `_load_sources` patch returned a bare list but the
   service returns `{"primary": [...], "supporting": [...]}`, and indexing a list by string raised
   `TypeError`. That one stale fixture cascaded through **10** tests.

**Sibling confirmed closed by inspection.** `harness_engine.from_env()` already builds the store via
`VectorStore.from_env()` (the v0.6.59 fix, `harness_engine.py:113`) — nothing to do. The one remaining
`VectorStore(client, None, settings)`, at `sandbox_execution_service.py:427`, is **not** the same defect:
it exists only to call `resolve_platform_model`, a pure `platform_ai_settings` read that never touches the
embedding client. Left as is.

---

## 5. What the next session owes (two live confirmations, one deploy)

Both need the deploy first: push `main`, confirm `/api/health` `commit_sha_short` == the intended SHA and
`ok=true`, then run the §5 canary runbook in `04B-D2-TIER2-CLOSE-HANDOFF.md` **unchanged** (arm founder-only
with `cd490873…` / `hicks.london25@gmail.com`; anchor prompt needs a financial term + `concentration` +
`90 days` **with a space**; re-darken immediately after and read back both flags off).

**Canary 9 — dedupe. RUN 2026-07-21 → FAIL, evidence NOT obtained.** The lead never delegated: zero `Task`
calls, zero children, stop_hook thrash to `max_turns`, $0.107 for no answer. Full post-mortem in
`04B-D2-M2-FINISH-LOG.md` → "Canary 9". Ruled out: the v0.6.84–88 commits (delegation surface
byte-identical to Canary 8's build), CLI drift (`claude-agent-sdk==0.2.118` pinned since v0.6.29), the
Railway env, and the worker mount. **Leading cause: the anchor prompt was changed** from Canary 8's
verbatim text — agent error, not a code defect. **The dedupe therefore remains unconfirmed live.**

**Canary 9-retry — the controlled rerun.** Identical arm, and **Canary 8's anchor verbatim**:
> Our client concentration is rising and our margin is compressing. What should I do in the next 90 days?

Expect **exactly one child row per capability** (specifically one `per_user_wiki`, against Canary 8's two),
a `worker_hop` `deduped` entry if the CLI re-sends, and a founder-visible cited answer no worse than Canary
8's. **If the lead again fails to delegate on the identical prompt, code, and CLI that worked on 2026-07-20,
stop — that is a Tier 2 reproducibility problem, not a canary to retry a third time.**

**Canary 10 — graceful failure.** Same arm plus `diagnostic_fault_injection_enabled=true` and
`diagnostic_fault_injection_workers=["sandbox_execution_agent"]`. Expect: `fault_injection_armed` in the
lifecycle; the sandbox worker writes **no** child row; the other two complete; the stop_hook does **not**
thrash on the missing worker (it consults the DB bridge); the turn either composes gracefully from the two
completed children **or**, if it terminalises, the founder reads the **partial answer naming those two
workers** rather than "I couldn't complete that response". Re-darken the fault-injection keys with the
rest of the flag.

---

## 6. Unchanged constraints (carry forward)

`MCP_TOOL_TIMEOUT=240000` lives **only** on the Railway service — do not lose it, and do not re-add the
per-agent `timeout` config key (v0.6.80, rejected by the deployed CLI). Single-process env only (no
`WEB_CONCURRENCY` / `--workers`). Path A stays the fallback; native-delegation scaffolding stays. All locks
preserved: founder isolation, one-writer, Claude-lock, no founder-facing model selector, tier authority at
the capability grain. `vcso_planner` stays retired. Harness-root `ROADMAP.md` untouched.
