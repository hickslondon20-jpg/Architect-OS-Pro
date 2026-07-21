# 04B Phase D2 — Backlog batch (pre-M3) · build record

**Date:** 2026-07-21 · **Predecessor:** `04B-D2-TIER2-CLOSE-HANDOFF.md` (Tier 2 closed at `v0.6.83`).
**Scope:** the three batched-polish items in that handoff's §4 (items 1–3). SDK-M3, M4, and E/F/G
untouched by instruction.

**Versions produced:** `v0.6.84` – `v0.6.91`. All deployed and canaried. **FINAL STATE: items 1 and 3
CLOSED live; item 2 HALF CLOSED** — (b) the partial-answer surface is proven live, (a) the fault-injection
/ v0.6.81 rescue is **blocked behind Defect 7** and handed to SDK-M3.

---

## 1. What landed

| Item | Version | State |
|---|---|---|
| 1 · Duplicate dispatch idempotency (defect #4) | `v0.6.84` | **CLOSED live** (Canary 9-retry). A duplicate arrived and was coalesced — one `start_run` per `(token, capability_key)`. See the attribution correction in `04B-D2-FINDINGS.md` §11: the duplicate was a *cross-worker call*, not a CLI re-send. |
| 2 · Tier 3 graceful-failure UX | `v0.6.85`, `v0.6.90` | **HALF CLOSED.** (b) partial-answer surface **proven live** (Canary 10a). (a) fault injection **never fired** — blocked behind Defect 7, handed to M3. |
| 3 · `per_user_wiki` formal confirmation | `v0.6.86` | **CLOSED live.** DI-EMBED passes against real embeddings; sibling confirmed closed. |

Focused unit suite: **76 passed** (was 45 at Tier 2 close).
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

**Canary 10a — RUN 2026-07-21 → MIXED.** Armed `after_completion` on `sandbox_execution_agent`.
**The injection never fired**: the sandbox subagent called `run_structured_data_agent` instead of its own
tool, took the deduped cached result, and returned — so no sandbox child row ever existed to inject into
(**Defect 7**, `04B-D2-FINDINGS.md` §11). Lead re-delegated three times into the once-per-turn guard, hit
`max_turns`. **$0.2196, no answer.**

**What it did prove — item 2(b), CLOSED live.** The failed turn produced a genuine founder-visible partial
answer naming `Structured Data Agent` and `Per User Wiki`, correctly framed as partial ("treat this as
partial. Ask again and I'll rebuild the full answer from here"), with the trace step titled "Partial
answer". The founder's gating concern — that a degraded turn must never read as complete on a
financial-advisory surface — is satisfied on a real live turn.

**Canary 10b — NOT RUN, deliberately.** It would exercise the same partial-answer surface just proven, on
a build with a known isolation defect, for another ~$0.20. Deferred.

**Item 2(a) — still owed, now blocked.** `after_completion` mode exists (`v0.6.90`) and is unit-proven,
but the v0.6.81 rescue cannot be exercised until a worker subagent can no longer call a sibling's tool.
Re-running the fault-injection canary on this build would likely fail the same way.

### Live-run tally (five model-driven turns)

| Run | Result |
|---|---|
| Canary 8 (2026-07-20) | PASS — three workers, cited answer |
| Canary 9 | FAIL — no delegation (changed anchor) |
| Canary 9-retry | PASS — dedupe confirmed, item 1 closed |
| Canary 10a | MIXED — item 2(b) closed; Defect 7 found |
| Canary 10b | not run |

**Delegation is 3 passes / 2 failures. Do not treat "the lead reliably delegates" as established** — the
anchor prompt is still an uncontrolled variable and Defect 7 is live. SDK-M3 is the hardening step.

---

## 6. Unchanged constraints (carry forward)

`MCP_TOOL_TIMEOUT=240000` lives **only** on the Railway service — do not lose it, and do not re-add the
per-agent `timeout` config key (v0.6.80, rejected by the deployed CLI). Single-process env only (no
`WEB_CONCURRENCY` / `--workers`). Path A stays the fallback; native-delegation scaffolding stays. All locks
preserved: founder isolation, one-writer, Claude-lock, no founder-facing model selector, tier authority at
the capability grain. `vcso_planner` stays retired. Harness-root `ROADMAP.md` untouched.
