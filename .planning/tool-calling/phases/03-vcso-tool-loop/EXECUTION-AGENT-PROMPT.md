# Execution Agent Brief — Phase 3: Virtual CSO In-Thread Tool Loop (on the Python backend)

You are the Execution Agent for **Phase 3** of the Advanced Tool Calling build in ArchitectOS Pro — the architectural centerpiece. You implement this phase's code. You do not re-plan it and you do not start other phases.

## Read these before writing any code (in order)

1. `.planning/tool-calling/CONTEXT.md` — the build's rationale and the 11 decisions you must not override.
2. `.planning/tool-calling/ROADMAP.md` — Phase 3 goal, dependencies, success criteria.
3. `phases/01-.../COMPLETION.md` and `phases/02-.../COMPLETION.md` — the live substrate you **inherit**: model routing + tagged usage (Phase 1) and the tool registry + `tool_search` (Phase 2). Do not rebuild or re-touch them.
4. `phases/03-vcso-tool-loop/03-RESEARCH.md` — the live-verified state. **Trust it, but re-verify anything you're about to change.**
5. This phase's `CONTEXT.md`, then `03-01-PLAN.md` (backend) and `03-02-PLAN.md` (frontend).
6. Canonical: `INTELLIGENCE-LAYER-ARCHITECTURE.md` (§4 VCSO, §5 one-writer), `INTELLIGENCE-LAYER-EPISODE-MAP.md` §4 Ep5 + §3.2. These win over the reference PRD.

## What you are building (full-stack)

Move the Virtual CSO orchestration off the Vercel streaming function onto the Python backend and stream from there — answer tokens **and** curated thinking/tool activity:

- **03-01 (backend)** — `VcsoChatService`, a bounded Claude tool-use loop consuming the Phase 2 registry (+ `tool_search`), porting `chat.ts`'s context assembly / skill routing / sources / `role='main'` usage logging into Python; and the **first** FastAPI SSE endpoint streaming the curated trace + answer.
- **03-02 (frontend)** — re-point the chat client to the FastAPI endpoint via `getBaseUrl()`, render the curated trace live in the existing `AgentStepsPanel` style, behind a feature flag with the Vercel path as rollback.

## Hard constraints (do not violate)

- **Curated trace, never raw chain-of-thought (L11).** Stream `step`/`tool_call`/`tool_result` curated summaries + answer `token`s. Never stream raw model reasoning or raw tool payloads/code. Reuse the sub-agents' `_safe_input_summary`/`_safe_output_summary` shaping.
- **The SSE event vocabulary is Phase 7's persistence contract.** Design events and persistence together: `ready`, `step`/`tool_call`/`tool_result`, `token`, `done`, `error`. Persist the loop's own tool steps (lean: reuse `agent_delegation_runs`/`steps`) so Phase 7 reconstructs the interleaving.
- **No data-model change to relocate orchestration.** Reuse `vcso_chat_threads/messages/projects`, `ai_usage_log`, `agent_delegation_runs/steps`. Add a table only if persistence genuinely doesn't fit — confirm at checkpoint first.
- **One-writer (architecture §5).** The VCSO tool subset = `registry.get_tools(surface='virtual_cso')`, read/compute only. No KB-write tool in scope. KB writeback stays the `/api/vcso/writeback` feeder workflow.
- **D1 stays open.** Support both direct registry tool calls and delegation to bounded capability sub-agents; never hardcode one. Authorization stays capability-derived via the Phase 2 swappable resolver.
- **Inherit Phases 1–2.** Tools come from the registry (no hardcoded lists); `vcso_chat` resolves Claude-locked via `platform_ai_settings`; `role='main'` usage emits from the Python loop via `usage_events.py`.
- **Parallel endpoint + feature flag, not a hard swap.** Stand the Python endpoint up alongside the live Vercel `chat.ts`; gate the frontend on a flag; keep Vercel dormant/removable as instant rollback. Do NOT delete `chat.ts` in this phase.
- **Streaming feel is required.** Emit `step` events as each round resolves; stream the final answer token-by-token (`messages.stream`). Never buffer the whole loop then dump.
- **Design system.** Live trace renders in the existing `AgentStepsPanel` pattern with ArchitectOS tokens — no Inter, no default grays, no new component if the existing one fits.

## Confirm with London at checkpoint (do not silently decide)

- **Retrieval-router pre-step fate** — absorb into in-loop `tool_search` (lean) vs. keep a cheap classifier seed for first-round latency.
- **Persistence home for the main loop's steps** — reuse `agent_delegation_runs`/`steps` (lean) vs. a new table.
- **Vercel `chat.ts` retirement** — dormant-but-kept (lean) vs. removed at cutover.
- **Streaming library** — `StreamingResponse` vs. `sse-starlette`, matching the frontend `event:`/`data:` framing.

## Done when

1. All Phase 3 success criteria in `ROADMAP.md` (reconciled to the Python move) are met and independently verified.
2. `VcsoChatService` runs a bounded registry-sourced Claude tool loop (direct + delegate both supported); a FastAPI SSE endpoint streams `ready` → curated `step`/`tool` trace → `token` → `done`/`error` with a clean finish on cap/timeout/error.
3. Curated trace only; one-writer honored; `vcso_chat` Claude-locked; `role='main'` usage emits from Python; loop steps persist in a Phase-7-reconstructable shape.
4. Frontend targets the FastAPI endpoint via `getBaseUrl()` behind a flag; live curated trace renders in the existing panel style; live and reloaded trace match; Vercel path preserved as rollback.
5. `CLAUDE.md` Rule #1 updated to record VCSO streaming now lives in the Python lane.
6. `python -m compileall python-backend` clean; `npm run build`/focused TS check clean; loop unit test (mocked Anthropic) passes; live end-to-end smoke run or the gap flagged honestly (missing `ANTHROPIC_API_KEY`/live backend/GKE creds).
7. `Pro-Suite-Progress.md`, `.planning/tool-calling/ROADMAP.md`, `.planning/tool-calling/STATE.md` updated and a `phases/03-vcso-tool-loop/COMPLETION.md` evidence summary written.

## Explicitly out of scope for you

The sandbox bridge / programmatic tool calling (Phase 4), MCP (Phase 5), the degradation % UI + compaction (Phase 6), and the reload-durable interleaved-history *rendering* work (Phase 7 — you persist the trace in a reconstructable shape and render it live, but the formal reload-durability pass is Phase 7). Resolving D1 either way is out of scope — keep it open. Deleting the Vercel `chat.ts` is out of scope — leave it dormant.
