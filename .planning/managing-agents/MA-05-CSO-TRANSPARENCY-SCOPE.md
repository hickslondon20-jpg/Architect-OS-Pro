# MA-05 / Ep1 — Virtual CSO Agentic Transparency Layer — SCOPE

> Governing scope for the Virtual CSO (VCSO) frontend transparency + sub-agent verification workstream.
> Pairs with `MA-05-CSO-TRANSPARENCY-KICKOFF.md` (the thread-initiating prompt).
> **Baseline: v0.5.50.** Bucketed under Ep1 (agentic RAG tool-calling + M8 sub-agent orchestration).

---

## Why this exists (the pivot)

Sub-agent workflow build-out in the sandbox is in flight, but there is a gap worth closing **first**: the
VCSO thread does not yet fully *surface* what the agent is doing under the hood. The backend intelligence
(RAG, hybrid retrieval, tool calls, sub-agent delegation) is firing and is traceable server-side — LangSmith
tracing of tool calls has already been confirmed via PowerShell against the backend. What is **unproven** is
the **frontend**: whether that same activity is plumbed through the SSE stream and *rendered* legibly in the
VCSO thread the way Claude / Claude Code and ChatGPT render agentic work (thought process → collapsible steps
→ grouped tool calls with inputs + results → sub-agent).

**Sequencing decision:** validate and refine the visible transparency surface **before** committing more effort
to sub-agent build-out and sandbox work. The UI pattern proven here must generalize to the deeper-thinking-mode
domain agents already planned, so it is foundational, not cosmetic.

This is a **verify → refine → render** pass, not a greenfield build. Recent history shows the infra is
substantially in place (`v0.5.50` SSE heartbeat during long tool calls; `v0.5.48` tool-loop hygiene;
`v0.5.46` sandbox delegation step persistence). **Assume built; research each area before wiring or rewriting.**

---

## Method — research-first, one area at a time

For **each** of the seven UI areas below (and the sub-agent objective), the managing agent runs the same loop:

1. **Research step (discovery, not confirmation).** Read the live code paths for that area (frontend +
   backend + DB), determine what is already wired vs. stubbed vs. missing, and write a 3–6 line findings note
   for that area. Do **not** assume the brain-dump reflects our stack — it partly describes the reference RAG
   masterclass app; adapt to our stack per `CLAUDE.md`.
2. **Wire / render decision.** Based on findings: *render-only* (backend emits it, frontend just needs to show
   it correctly), *wire* (backend has it, not plumbed through the stream/persistence), or *build* (genuinely
   missing). Prefer render/wire over rebuild.
3. **Implement + commit** (version-tagged PATCH per `CLAUDE.md`, from baseline v0.5.50).
4. **Acceptance gate.** Prove the area's acceptance criteria on the live VCSO thread before moving to the next
   area. Report findings + gate result to the founder.

Do **not** batch across areas. Report the per-area findings before deep work on that area.

---

## Grounded starting pointers (verify, don't trust blindly)

**Frontend — `components/pro-suite/virtual-cso/`:**
`ChatThread.tsx`, `MessageBubble.tsx`, `AgentStepsPanel.tsx`, `Composer.tsx`, `SourcesPanel.tsx`,
`ArtifactDeliveryCard.tsx`, `ChatRail.tsx`; workspace shell `pages/ProSuite/virtual-cso/VirtualCSOWorkspace.tsx`.

**Backend — `python-backend/services/`:**
`vcso_chat_service.py` (chat + SSE stream + system prompt — the "LLM service" from the brain dump),
`sub_agent_orchestrator.py` (M8 sub-agent / analyze-document delegation), `tool_registry.py`,
`retrieval.py` + `reranker.py` (hybrid search), `structured_query.py` / `structured_data.py` (text-to-SQL),
`web_search.py`.

**Persistence:** the `messages` table (confirm JSONB tool-call/step column via Supabase MCP + `docs/migrations`).
**Observability:** LangSmith project `ArchitectOS-pro` — every LLM call on the critical path emits a trace as
evidence (necessary, not sufficient — pair with DB/output checks).

---

## The seven UI areas (Objectives 1–7)

Overall UI vision is unchanged: reproduce the Claude/ChatGPT agentic-transparency layout inside the VCSO thread.

### 1. Progressive tool-call rendering
Tool calls appear live as the agent fires them, with a full lifecycle: a start/running state and a **complete**
event (green tick), not a single end-of-turn dump.
- **Research:** does the SSE stream emit discrete `tool_call_start` / `tool_call_complete` events? Does
  `ChatThread`/`AgentStepsPanel` consume them incrementally?
- **Acceptance:** on a multi-tool query, each call renders in running state then flips to complete in real time.

### 2. Search transparency (inputs + results)
Beyond "a tool ran," show *what* was searched (the query/args) and the *results* it returned.
- **Research:** are tool inputs + outputs present in the stream payload and stored? Any PII/secret concerns in
  echoing args (respect redaction rules)?
- **Acceptance:** expanding a tool call shows the actual query and a readable result summary.

### 3. Grouped / nested layout (thought process → hide steps → tool calls → sub-agent)
Mirror Claude's structure: a thought-process bubble, a collapsible "Hide steps" section, tool calls grouped with
nested results, and the sub-agent surfaced as its own unit.
- **Research:** current `AgentStepsPanel` grouping/nesting model vs. target; can it represent nested sub-agent steps?
- **Acceptance:** layout visually matches the reference (bubble + collapsible steps + grouped calls + sub-agent block).

### 4. Thinking mode in the bubble
If the agent returns think tags / a thought process, render that reasoning in the bubble.
- **Research (open question):** **is thinking mode enabled on this agent / model at all?** Confirm before building
  UI for it. If enabled, how do think tags arrive in the stream?
- **Acceptance:** either thinking content renders in the bubble, or a documented decision that thinking mode is
  off/not exposed (with rationale), so we don't build UI for a signal that never arrives.

### 5. Real loading state
A spinner replaces the submit button while awaiting the stream, plus a "thinking/processing" signal in the main
thread area so the user isn't staring at a dead screen after send.
- **Research:** current `Composer` submit/loading behavior and thread-area pending state.
- **Acceptance:** on send, submit → spinner; thread shows a processing indicator until the first token streams.

### 6. Persistence of tool calls / steps
Tool calls currently live only in the live session — refresh or switching to an older conversation loses them.
Persist to the `messages` table (JSONB) so any past message's tool calls/steps reload with the conversation.
- **Research:** does `messages` already have a JSONB steps/tool-calls column (see `v0.5.46` delegation-step
  persistence)? Is it written on turn completion and re-hydrated on load?
- **Acceptance:** refresh the page and open an older conversation — tool calls/steps for each past message render
  from the DB, identical to live.

### 7. No dangling tool call (turn must resolve to a response)
Enforce that the agent cannot end its turn on a tool call — it must always emit a final written response.
- **Research:** current tool-loop termination logic in `vcso_chat_service.py`; can it terminate on an unresolved
  tool call? (relates to `v0.5.48` tool-loop hygiene.)
- **Acceptance:** across adversarial multi-tool queries, every turn ends with a rendered assistant message, never
  a hanging tool call.

---

## Objective 8 — Sub-agent / analyze-document (latter phase)

Scope: verify the hierarchical **analyze-document sub-agent** works and renders in the same transparency layer.
Functionality is believed to largely exist (`sub_agent_orchestrator.py`; `v0.5.46` delegation-step persistence) —
the job is to confirm the tool-calling + sub-agent capability works **correctly** and is **visible**.

- The main agent delegates full-document work (summarize / review / extract key points) to an isolated sub-agent
  with its own message context and streaming reasoning visible to the user, triggered by an analyze-document tool.
- The agent should generate a **retrieval strategy** and execute against it — multiple progressive tool calls
  (`search_documents`, text-to-SQL against structured data, web search) building up a view of the data the way
  Claude Code works a codebase, on a smaller model.
- **Research:** confirm the analyze-document tool + orchestrator path; confirm sub-agent steps stream and persist
  and render nested under the parent (ties to Objective 3 + 6).
- **Acceptance:** deferred to the testing protocol below — sub-agent activity streams, nests, persists, and produces
  a resolved response.

**Staging:** Objectives 1–7 (transparency layer) land and pass first; Objective 8 (sub-agent) is the latter phase,
built on the now-proven rendering + persistence surface.

---

## Testing protocol

Two layers. Layer A gates each objective; Layer B is the end-to-end proof once the thread is live.

### Layer A — functional / UI verification (per-area acceptance gates)
The acceptance criteria under each objective above. Explicitly includes the cross-cutting checks:
progressive rendering, complete events, **persistence across refresh and across conversation switches**, and
**no dangling tool calls**.

### Layer B — capability testing against real uploaded documents
Once the thread is live and rendering correctly, test against documents **already uploaded for the test users**:
- **Retrieval:** ask the VCSO follow-up questions about specific uploaded documents; confirm it uses its tools to
  retrieve the right content.
- **Tool chaining:** confirm it fires **multiple progressive tool calls** (search → structured query → synthesis)
  rather than one shot, and that each is visible in the thread.
- **Reasoning over contents (not just recall):** ask synthesis questions that require *reasoning over* the file
  contents — comparisons, "so what," cross-document — not just "what does it literally say." This is the proof the
  agentic retrieval strategy is genuinely working end to end, not merely rendering nicely.
- **Sub-agent (Obj 8):** trigger analyze-document on a real uploaded doc; confirm the sub-agent streams, nests under
  the parent, persists, and resolves to a written response.

Every Layer B test names the document, the expected tool path, and the pass/fail — captured with a LangSmith trace
plus DB/output check.

---

## Deliverables (then STOP at the checkpoint)

- Per-area research findings notes (7 + sub-agent).
- Version-tagged, fix-in-place diffs closing each area's gap (baseline v0.5.50, PATCH++).
- Layer A acceptance results per objective; Layer B capability-test results table.
- `Pro-Suite-Progress.md` updated; checkpoint report back to the founder.
- **Do not** expand sub-agent/sandbox build-out beyond Objective 8 verification. Honor existing locks.

---

## Guardrails

- **Work from live** (`architectospro.com` frontend, `api.architectospro.com`, `main` → auto-deploy). Local is a
  pre-push safety net only.
- **Verify before rewrite** — most of this is built; the default action is render/wire, not rebuild.
- **Adapt, don't port** — the brain-dump partly describes the reference masterclass app; respect our stack
  (React 19 / Vite 6 / TS frontend; Python-backend direct-Anthropic synthesis + N8N + VCSO streaming lanes per
  `CLAUDE.md` Rule #1). No client-side Anthropic calls; no Supabase Edge Functions for AI.
- **Design system non-negotiables** apply to all UI (Geist, AOS tokens, no Inter, no glow, no pure black).
- **Never echo secrets/PII;** respect redaction when surfacing tool inputs/results (Objective 2).
