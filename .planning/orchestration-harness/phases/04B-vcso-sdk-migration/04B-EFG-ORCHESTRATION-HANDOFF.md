# 04B — Orchestration Handoff: Generalization + Phases E / F / G (cold-pickup)

**Date:** 2026-07-22 · **You are:** the next **Orchestration Agent** for the VCSO SDK migration (04B).
**Self-contained** — you do not need the prior conversation. Your job mirrors the last stretch: work the
remaining scope phase by phase, produce plan + kickoff material for **execution agents** to build/verify
on the live stack, run STOP-and-review checkpoints with London, and handle the tangents that surface
along the way (D2 itself emerged as a tangent from Phase D — expect more). **You orchestrate and plan;
execution agents do the live code/canary work** (this Cowork sandbox cannot commit to the founder's git
or drive Railway).

---

## 1. Read first (in order)
1. **`04B-VISION-AND-INTENT.md`** — the *why* and the fit-for-purpose **sense-check rubric**. Grade
   everything you ship against §4. This is the guard against building correctly toward the wrong thing.
2. `README.md`, `CONTEXT.md` (locks, decisions, deferrals), `ROADMAP.md` (phases A–G + Process Rules,
   esp. **Rule 10**; D2 detail + tracker).
3. D2 evidence: `04B-D2-M3-COMPLETION.md`, `04B-D2-M4-COMPLETION.md`, `04B-D2-M4-FINISH-LOG.md`,
   `04B-D2-TIER2-CLOSE-HANDOFF.md`, `04B-D2-FINDINGS.md` (§9 Defect 6, §10 the `MCP_TOOL_TIMEOUT` note).
4. The phase plans you'll extend: `04B-F-PLAN.md`, `04B-E-PLAN.md`, `04B-G-PLAN.md` (originals — refresh
   them against the current state before handing to execution).
5. Canonical (win over anything): `../../../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md`,
   `../../../INTELLIGENCE-LAYER-ARCHITECTURE.md`; harness spine `../../CONTEXT.md` / `../../ROADMAP.md`.

## 2. Current state (verified 2026-07-22)
- **D2 (model-driven delegation) is DONE on M1–M5** (`v0.6.114`), operational and a step beyond MVP. The
  lead reasons its own decomposition (order-variation evidenced), runs structured → wiki → sandbox, and
  composes a founder-grade cited answer; nested surface + per-child cost attribution + reload all hold;
  Gate 1 (delegation reliability 5/5) and Gate 2 (delivery, observed recovery) closed; Defect 7 (worker
  isolation) closed. **Every claim observation-backed.**
- **Flags dark.** `vcso_sdk_loop` and `vcso_planner` are `is_enabled=false`, allowlists empty. **Path A
  (deterministic app-owned delegation) is retained dark as the fallback — DO NOT prune the native
  scaffolding.**
- **Sandbox is a *working smoke*** — it fires and returns structured results, but *real* concentration/
  margin compute is deferred (needs a financial *series*; no table today) → Phase F.

## 3. The remaining work (sequence is yours to recommend; depth caveats matter)
London's read: these three are **more in-depth than they look**. Treat each as capable of spawning its
own D2-style sub-thread.

### G-gate — Generalization (the gate before ANY wider founder exposure)
The most important near-term decision, and arguably *first*: D2 proved delegation on **one pinned anchor
shape + a simple control**. Whether the lead delegates **appropriately across genuinely different
strategic questions** is unproven (rubric #8, open). Content (parked in `ROADMAP.md` Phase G detail): a
**controlled question-shape expansion** — a small set of deliberately-varied strategic questions across
the delegation archetypes (structured+sandbox / structured-only / wiki-only / simple-direct /
reflect-and-steer), each with an *expected-acceptable delegation* defined up front, scored on an
**appropriateness rubric**, likely requiring the **app-gated effort-scaling to be relaxed** so the lead
chooses across types — which is itself the thing under test. Judgment-heavy and founder-specific (the
question set must reflect real founder-strategy shapes), so scope it *with London*. **Nothing widens
past the dark founder canary until this clears.**

### Phase E — Sessions + Deep Mode reconciliation
Deeper than it looks: reconcile SDK **sessions** (resume/fork) with the hand-rolled Deep Mode
resume-state (`ask_user` pause/resume, `agent_todos` plan, workspace files) so there is **one** source
of truth, now on the model-driven path. Gate: a Deep Mode thread pauses on `ask_user` and resumes with
full context, plan + workspace intact, no double-bookkeeping. Watch for the same live-vs-persisted
class of bug that bit the nested surface (M4 reload).

### Phase F — First live MCP (QuickBooks) — the big one
This couples to the whole data-lifecycle + trend-spine design. In scope: per-user OAuth via
`mcp_connections` + **Vault** (secret *reference*, never the value); the connector catalog gated via
`feature_registry` (Q2 resolved — no `connectors` table for the pilot); **read-only, ephemeral, cited**
P&L pull through a bounded worker; the freshness/authority policy (live-vs-wiki). Then the deferred
heavy piece: **financial-series storage/vectorization** (no table today; client-level revenue +
multi-period P&L) so the **sandbox does *real* concentration/margin compute** — this is the
compiled-truth-over-timeline (gbrain) pattern applied to financials, and the "MCP as a second job =
ingestion source" distinction (ephemeral retrieval vs. deliberate snapshot into the wiki via the
source-agnostic ingestion pipeline). Guardrails: `persistence_semantics` (read-only auto-approves;
write/privileged confirm + quarantine); **never move money.**

### Phase G — Generalize, verify, cut over
The co-equal gates on live (cost ↓ vs. baseline, cited CFO/CSO quality, native legible UX, safety under
adversarial prompts); retire the hand-rolled loop **only** on parallel-run parity; **then thread 04B
into the harness-root `ROADMAP.md` (separately founder-gated).** The G-gate generalization proof is the
front half of this phase.

## 4. Non-negotiable discipline (hard-won this migration — do not relearn these live)
- **Reliability before "closed" (Process Rule 10).** A single live run is "proven once," not closed;
  anything downstream depends on exits on **N consecutive passes**, not one green run.
- **Observe, don't infer.** Code-verified / unit-tested ≠ observed. This migration shipped *three*
  false greens — mocked `query_impl` hiding the permission bug, a silently-skipped wiki suite, and an
  incomplete recovery fix — each caught only by live observation. Prefer **injection to observe** over
  chasing intermittent causes; prefer **zero-canary verification** (reload persisted data) where possible.
- **Confirm deployed head == intended SHA + `/api/health ok=true` before every canary.** A stale deploy
  once cost a full run.
- **Dark-canary hygiene:** arm `vcso_sdk_loop` founder-only (`hicks.london25@gmail.com` / `cd490873…`)
  **on London's go, not in anticipation**; re-darken immediately after; read back both flags off.
- **Version-tags always forward** — even a failed/retry commit increments (a reused `v0.6.89` created a
  collision; documented, not rewritten).
- **Preserve every lock:** founder isolation, one-writer (feed OS Engine, never write the wiki), bounded
  non-recursive workers, Claude-lock (Sonnet compose / Haiku workers via the MA-06 tier map), **no
  founder-facing model selector**, tier authority at the capability grain, curated transparency (no raw
  payloads / no raw CoT).
- **INFRA LANDMINES:** `MCP_TOOL_TIMEOUT=240000` lives **only** in the Railway env var, not code — if the
  service is recreated and it's lost, the ~113s sandbox worker times out at the CLI ~60s default; do not
  remove it. **Do NOT re-add** the per-agent `timeout` config key (rejected by the deployed CLI, broke
  delegation). **Single-process only** — no `WEB_CONCURRENCY` / `--workers` (`TURN_REGISTRY` is
  process-global).
- **Do not** flip flag defaults, prune Path A, widen past the dark canary before the G-gate clears, or
  edit the harness-root `ROADMAP.md` (that's the separately founder-gated Phase-G cut-over).

## 5. Systemic flags (logged in `../../../codebase/CONCERNS.md`)
False-green test suites (audit for both patterns before trusting green); error-swallowing around
Supabase/PostgREST; uniqueness-assumption mismatches. Add a real-engine test on any permission/CLI-gated
path.

## 6. Key files
```
python-backend/services/
  vcso_sdk_loop.py          model-driven branch; hooks; stop_hook + terminal check; graceful-compose
  vcso_sdk_config.py        DELEGATION_TOOL_* ; per-founder ClaudeAgentOptions compile; worker pre-approval
  vcso_worker_mcp.py        TurnScope / TurnRegistry / run_worker_capability (per-(turn,capability) token)
  vcso_worker_mcp_server.py FastMCP loopback transport
  vcso_chat_service.py      reads native_model_driven_enabled; _failed_turn_message / partial-answer
  sub_agent_orchestrator.py the 7 bounded capability handlers (reused as workers)
  tool_registry.py          catalog + tier→model; the SDK-config compiler seam
  main.py                   /internal/mcp/workers + session manager; /api/health SHA
Supabase (pwacpjqkntnovndhspxt): platform_ai_settings (flags), agent_delegation_runs/steps,
  agent_capabilities, ai_models, mcp_connections, feature_registry, ai_usage_log (separate metering)
Railway: MCP_TOOL_TIMEOUT=240000 (do not lose)
```

## 7. Owed / housekeeping
- The two-`v0.6.89` collision note is recorded in the finish log. ✅
- Mid-stream finding-injection TODO (`vcso_sdk_loop.py:~1002–1005`) stays **deferred** (significant
  machinery; graceful-compose already makes the timed-out-worker case non-fatal).

**First move on pickup:** confirm current state (flags dark, deployed head), then bring London a
recommended **sequence** for G-gate / E / F — do not assume the order. Everything is at a clean, dark,
bankable state; nothing is time-pressured.
