# Phase 3 Research — Virtual CSO In-Thread Tool Loop (moved onto the Python backend)

**Verified:** 2026-07-03, against the live repo and Supabase project `pwacpjqkntnovndhspxt`.
**Decision inherited (London sign-off, 2026-07-03):** VCSO orchestration **moves off the Vercel streaming function onto the Python/FastAPI backend** and streams from there — final answer tokens **and** curated thinking/tool activity. Phase 3 is therefore full-stack (a port + a new streaming endpoint + a frontend re-point), split into 03-01 (backend) and 03-02 (frontend).

---

## What exists today (the port surface)

### The whole VCSO orchestration lives in one Vercel function: `api/vcso/chat.ts`
It is a single-shot synthesizer, not a loop. In one request it:
1. Auth (JWT → Supabase user), creates/loads the thread, inserts the user message.
2. **Pre-flight guess:** `shouldCallKbExplorer(text)` (keyword heuristic) → calls the Python `/api/agent-runs` KB Explorer sub-agent *before* generating.
3. Loads context in parallel: `loadIpLayer` (rules, prompts, `skill_packs` index), recent messages, `loadFounderContext` (founder wiki pages), project.
4. Skill routing: `detectExplicitSkillInvocation` (`@slug`) else `classify()`/`scoreSkill()`; `loadSelectedSkillBodies`.
5. `requires_sandbox` pre-flight → `callSandboxExecution` sub-agent if a selected skill is flagged.
6. `assemblePrompt(...)` — one big prompt with all context + KB/sandbox findings injected as text.
7. `streamAnthropic(prompt, onText)` — **single** streamed Claude completion (raw REST, `MODEL` env, now resolving `vcso_chat` via `platform_ai_settings` per Phase 1).
8. Persists assistant message; backfills `agent_delegation_runs.assistant_message_id`; logs `ai_usage_log` (`role='main'`, Phase 1); emits SSE `ready` / `token` / `done` / `error`.

**Everything in steps 2–8 must move into Python** and the single completion becomes a **registry-driven tool-use loop**. Steps 2 and 5 (pre-flight guesses) are *absorbed into in-loop `tool_search`* — the model decides mid-thread instead of a keyword guess up front.

### The sub-agent loop pattern already exists and is the model to follow
`kb_explorer_service.py` and `sandbox_execution_service.py` run **bounded native Anthropic tool-use loops** (`messages.create(tools=…)` → dispatch → feed results back → repeat), now sourcing tools from the Phase 2 registry and tagging usage via `usage_events.py`. The VCSO main loop is the same shape, with three differences: (a) a **larger tool set via the registry + `tool_search`**, (b) it **streams to the browser**, (c) it can **either call a tool directly or delegate to a bounded capability sub-agent** (D1-neutral).

### No browser-facing SSE exists on FastAPI yet
`main.py` mounts plain JSON routers (`/kb/folders`, `/kb/documents`, `/api/skills`, plus the generic `/api/agent-runs`). Grep: **no `StreamingResponse` / `text/event-stream` / `EventSourceResponse`.** Phase 3 introduces the **first** browser-facing SSE endpoint on the Python backend. CORS is already configured (`config.allowed_origins`); JWT verification exists (`get_current_user_id`, used by `skills.py`/`artifacts`/`kb_*`). FastAPI streams via `StreamingResponse` (or `sse-starlette`'s `EventSourceResponse`); the Anthropic Python SDK streams via `messages.stream(...)`.

### The frontend is a contained re-point, not a rewrite
`lib/virtualCsoApi.ts`:
- `sendUserMessage()` POSTs to the **hardcoded relative path `/api/vcso/chat`** (Vercel) and parses SSE with a **generic** `parseSseStream` handling `ready`/`token`/`done`/`error` via `onReady`/`onToken`/callbacks.
- `getBaseUrl()` already exists in `lib/skillsApi.ts` / `lib/artifactsApi.ts` (via `VITE_INGESTION_API_URL`) to reach the FastAPI backend (`api.architectospro.com`).
- `getMessagesForChat()` reconstructs history client-side from `vcso_chat_messages` + `agent_delegation_runs`/`agent_delegation_steps` + artifacts.

So the frontend change: re-point `sendUserMessage` to `${getBaseUrl()}/api/vcso/chat…`, extend the event handling for new streamed trace event types, and render them live. The generic `parseSseStream` already supports arbitrary event names.

### The data model does not change for the move
Runtime uses `vcso_chat_threads`, `vcso_chat_messages`, `vcso_projects`, `ai_usage_log`, `agent_delegation_runs`/`agent_delegation_steps`. Both the old (Vercel) and new (Python) paths use the same tables — **no schema migration is required to relocate orchestration.** The `docs/migrations/pending/ws5_decommission_virtual_cso_legacy_founder_confirm_required.sql` migration only drops long-dead, empty `virtual_cso_*` tables (a different, unused legacy set — confirmed empty, zero code refs) and is **unrelated** to this cutover.

---

## Implications / decisions for the design

1. **Curated thinking, never raw chain-of-thought (L11).** What streams as "thinking" is *what the agent is doing and why* — curated step events ("searching your knowledge base," "reading the Q3 P&L," "running the margin calc") derived from tool calls + a short synthesized plan line — **not** Claude's raw internal reasoning tokens. If extended thinking is used, its raw blocks are never sent to the browser. This is London's explicit "show the deeper thinking, not the guts" vision, kept inside the L11 boundary.

2. **The SSE event vocabulary defined here IS Phase 7's persistence schema.** Design them together. Proposed event set: `ready` (thread + user message), `step` / `tool_call` / `tool_result` (curated trace), `token` (final answer), `done` (assistant message + sources + artifact + usage), `error`. Persist the trace so Phase 7 reload reconstructs the same interleaving.

3. **Persistence seam (Phase 3 ↔ Phase 7).** Today `agent_delegation_runs`/`steps` persist *sub-agent* delegation steps, reconstructed client-side by `getMessagesForChat()`. The VCSO main loop's **own direct tool calls** now need a persistence home too. Lean: reuse `agent_delegation_runs`/`steps` for the main loop's steps (the reconstruction path already exists), rather than a new table — confirm at build-planning. Phase 3 must persist; Phase 7 formalizes reload-durable interleaving.

4. **`role='main'` usage logging relocates from TS to Python.** Phase 1 tagged the main call in `chat.ts`. With the main call now in the Python loop, emit the `role='main'` event via `usage_events.py` from the loop. The TS insert is retired with the Vercel path.

5. **Model routing + one-writer inherited.** The loop resolves `vcso_chat` via `platform_ai_settings` (Claude-locked, Phase 1). Its tool subset comes from `registry.get_tools(surface='virtual_cso')` — **read/compute only**; no KB-write tool is in scope (one-writer, architecture §5). KB writeback stays the existing `/api/vcso/writeback` feeder workflow.

6. **D1 stays open.** The loop must support both a **direct** registry tool call and **delegation** to a bounded capability sub-agent (via the existing orchestrator). Build both paths; don't hardcode one. The registry's swappable scope resolver (Phase 2) is how tool authorization stays capability-derived without fusing.

7. **Risk posture: parallel endpoint + feature flag, not a hard swap.** This is the biggest, riskiest phase. Stand up the Python streaming endpoint alongside the live Vercel function, gate the frontend on a flag, cut over after a live smoke, and keep the Vercel function dormant (removable later) as instant rollback. Beta is founder-only, so blast radius is small — but the loop is the founder's primary surface.

---

## Landmines / things to get right

- **Do not change the data model to move the loop.** Reuse the existing tables.
- **Latency & streaming feel.** Emit `step` events *as each tool round resolves* so the founder sees progress immediately; stream the final synthesis token-by-token (`messages.stream`). Don't buffer the whole loop then dump.
- **Don't stream raw tool payloads or code as "thinking."** Curated summaries only (reuse the `_safe_input_summary`/`_safe_output_summary` shaping the sub-agents already do).
- **CORS + auth for SSE.** The new endpoint needs the frontend origin allowed and the same JWT verification; a POST-body + bearer SSE (as today) is fine — keep it, don't switch to `EventSource` (which can't send auth headers/body cleanly).
- **`CLAUDE.md` Rule #1 update.** The Vercel streaming exception is superseded for VCSO chat — streaming chat now lives in the Python direct-Anthropic lane. Update the rule so the architecture doc matches reality.
- **Bounded loop.** Cap rounds (like the sub-agents' `max_rounds`) with a graceful "reached max rounds" finish; stream a clean `done` even on cap/timeout/error.

---

## Verification method (for the record)

- Read in full: `api/vcso/chat.ts`, `lib/virtualCsoApi.ts`, `services/sandbox_execution_service.py` (loop pattern), `services/tool_registry.py` (Phase 2), the pending decommission migration.
- Grep `main.py` for streaming/router mounts (no SSE today); grep `lib/` for the `getBaseUrl`/`VITE_INGESTION_API_URL` base-URL mechanism.
- Live Supabase: runtime tables confirmed (Phase 1/2 passes); no migration needed for the move.
