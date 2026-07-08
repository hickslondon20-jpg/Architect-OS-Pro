# Phase 3 Context — Virtual CSO In-Thread Tool Loop (on the Python backend)

**Phase:** 03 of the Advanced Tool Calling build — the architectural centerpiece.
**Read first:** the build-level `CONTEXT.md` and `ROADMAP.md`; this phase's `03-RESEARCH.md`; the Phase 1 & 2 `COMPLETION.md` files (live substrate inherited); canonical `INTELLIGENCE-LAYER-ARCHITECTURE.md` (§4 VCSO, §5 one-writer) + `INTELLIGENCE-LAYER-EPISODE-MAP.md` §4 Ep5 + §3.2 (traceability). Canonical docs win over the reference PRD.

---

## The decision that defines this phase (London sign-off, 2026-07-03)

**Virtual CSO orchestration moves off the Vercel streaming function onto the Python/FastAPI backend and streams from there** — final answer tokens **and** the curated thinking/context-gathering/tool activity. Rationale in London's words: the vision is to show the *deeper thinking and how it reaches the answer* — the work building in real time, not a spinner — which builds perceived quality and credibility. That is far more natural to emit from the same Python loop already running the sub-agents than to bolt onto a serverless function.

Three scope consequences, all signed off:
1. **Phase 3 is full-stack** — a new FastAPI SSE endpoint *and* a frontend chat-client re-point + live trace rendering. Split into 03-01 (backend) and 03-02 (frontend).
2. **It is a port of `chat.ts`'s orchestration**, not just "add a loop" — context assembly, skill routing, sources, and the Phase 1 `role='main'` usage logging all move into Python; the pre-flight guesses (`shouldCallKbExplorer`, `requires_sandbox`) are absorbed into in-loop `tool_search`.
3. **"Deeper thinking" = curated trace, not raw chain-of-thought (L11)** — what streams is *what it's doing and why*, not Claude's raw reasoning tokens.

## What this phase is

Convert the single-shot Vercel synthesizer into a **genuine Claude tool-use loop on the Python backend** that consumes the Phase 2 registry: catalog + `tool_search` in context, tools called mid-thread, results fed back and interleaved, the final answer streamed token-by-token — with curated trace events streamed throughout. Modeled on the existing `kb_explorer_service` / `sandbox_execution_service` bounded loops, extended with the registry, streaming, and both direct-call and sub-agent-delegation paths.

## What this phase is NOT

- **Not the sandbox bridge (Phase 4) or MCP (Phase 5).** The loop calls registry tools and can delegate to sub-agents; sandboxed code calling tools programmatically is Phase 4.
- **Not the degradation UI (Phase 6) or reload-durable history rendering (Phase 7).** But it **defines the SSE event vocabulary that becomes Phase 7's persistence schema**, and it persists the trace so Phase 7 can reconstruct it. Design them together.
- **Not a data-model change.** Reuse `vcso_chat_threads/messages/projects`, `ai_usage_log`, `agent_delegation_runs/steps`. No migration is required to relocate orchestration (RESEARCH §"data model does not change").
- **Not a resolution of D1.** The loop supports direct-call and delegate both; the registry's swappable scope resolver keeps authorization capability-derived without fusing.
- **Not raw chain-of-thought streaming.** Curated summaries only.

## Decisions that shape this phase (do not override)

1. **Orchestration + streaming live in Python.** A new streaming VCSO service + FastAPI SSE endpoint. The Vercel `chat.ts` path is superseded (retired behind a flag; see risk posture). `CLAUDE.md` Rule #1 is updated to record that VCSO chat streaming now lives in the Python direct-Anthropic lane, not the Vercel exception.
2. **Curated trace, never raw CoT (L11).** Stream `step`/`tool_call`/`tool_result` curated summaries + answer `token`s. Never stream raw reasoning or raw tool payloads/code. Reuse the sub-agents' `_safe_input_summary`/`_safe_output_summary` shaping.
3. **The SSE event vocabulary is the Phase 7 persistence contract.** Proposed: `ready`, `step`/`tool_call`/`tool_result`, `token`, `done`, `error`. Persist the trace (lean: reuse `agent_delegation_runs`/`steps` for the main loop's own steps) so Phase 7 reload reconstructs the interleaving.
4. **One-writer honored (architecture §5).** The loop's tool subset = `registry.get_tools(surface='virtual_cso')` — read/compute only. No KB-write tool in scope. KB writeback stays the existing `/api/vcso/writeback` feeder workflow.
5. **D1 stays open.** Support direct registry tool calls **and** delegation to bounded capability sub-agents; don't hardcode one. Authorization stays capability-derived via the Phase 2 swappable resolver.
6. **Inherit Phases 1–2; don't re-touch them.** Model routing (`vcso_chat` via `platform_ai_settings`, Claude-locked), tagged usage (`role='main'` now emitted from the Python loop via `usage_events.py`), the registry, and `tool_search` are all inherited. The registry is the tool source — no hardcoded tool lists.
7. **Streaming feel is a requirement, not a nicety.** Emit `step` events as each tool round resolves; stream the final synthesis token-by-token (`messages.stream`). Never buffer the whole loop then dump.
8. **Bounded + graceful.** Cap rounds (like the sub-agents); always emit a clean `done` on completion, cap, timeout, or error.

## Risk posture (explicit)

This is the biggest, riskiest phase — it replaces the founder's primary surface. Build the Python streaming endpoint **alongside** the live Vercel function, gate the frontend on a feature flag, cut over only after a live end-to-end smoke, and keep the Vercel function **dormant (removable later)** as instant rollback. Beta is founder-only, so blast radius is small, but treat the cutover as reversible.

## Success criteria (from ROADMAP.md Phase 3, reconciled to the Python move)

1. A Virtual CSO turn runs a Claude tool-use loop **on the Python backend**: calls a registry tool mid-generation, feeds the result back, continues, and streams the final answer.
2. Token-by-token streaming to the browser is preserved **via the FastAPI SSE endpoint** (the VCSO orchestration no longer runs on the Vercel function); curated `step`/`tool` trace events stream live alongside.
3. The VCSO tool subset is read/compute only — no tool writes to the knowledge base (one-writer honored).
4. The loop supports both a direct tool call and delegation to a bounded capability sub-agent, built so D1 is not hard-coded either way.
5. Sub-agent returns fed into the main thread are compact/synthesized (protecting the main window Phase 6 measures).
6. The streamed trace is curated (no raw chain-of-thought), and its event shape is the persistence contract Phase 7 will reconstruct.

## Open items to resolve at this phase's build-planning (flag, don't silently pick)

- **Retrieval-router pre-step fate** — keep a cheap classifier/heuristic to seed the loop, or fully absorb into in-loop `tool_search`? Lean: absorb into `tool_search`, optionally keep a cheap seed only if it measurably reduces first-round latency.
- **Persistence home for the main loop's own steps** — reuse `agent_delegation_runs`/`steps` (lean; reconstruction path exists) vs. a dedicated table. Confirm no shape mismatch forces a new table.
- **Vercel `chat.ts` retirement** — dormant-but-kept during transition (lean) vs. removed at cutover. Keep dormant for rollback; schedule removal later.
- **Streaming library** — raw `StreamingResponse` vs. `sse-starlette` `EventSourceResponse`. Lean: whichever matches the existing frontend `parseSseStream` (`event:`/`data:` framing) with least new dependency.
- **`ready`-time context payload** — how much of today's `assembledContext`/`route` meta to keep in the `ready` event for UI parity. Lean: preserve the existing shape so the frontend meta panels keep working.
