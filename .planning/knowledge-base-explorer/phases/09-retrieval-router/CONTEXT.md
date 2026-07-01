# Phase 9 — CONTEXT.md
# Retrieval Router + Chat Experience

*Phase planning complete: 2026-07-01*
*Depends on: Phase 8 (KB Explorer wired; Layer 1 projected into ose_knowledge_pages)*

---

## Why This Phase Exists

Phases 1–8 built the KB Explorer sub-agent and wired it to the wiki layers. But the Virtual CSO has no reason to call it — there is no routing logic. A founder can ask "find my Q1 briefing document" and the Virtual CSO will hallucinate an answer from its founder wiki context rather than actually navigating the document library.

Phase 9 closes this gap in three coordinated pieces:

**9A — Retrieval Router:** A lightweight keyword-heuristic intent classifier in `chat.ts` that detects when a question is about uploaded documents, calls the KB Explorer via Railway, and injects the findings into the synthesis prompt. No separate Claude call. No streaming events from KB Explorer. Synchronous call with a client-side 10-second timeout safety net.

**9B — Chat UI Redesign:** The assistant message bubble container is removed. Assistant responses become full-width conversation text at column width — no border, no background, no shadow. This matches the Claude.ai conversation aesthetic London requested. User messages remain in their right-aligned slate bubble. The copy affordance stays.

**9C — Nested AgentStepsPanel:** A new collapsible component that appears above the assistant message text when the KB Explorer was invoked. Shows the tool steps taken (tool name, input summary, one-line output). Muted "thinking block" aesthetic — useful for transparency, not primary content. The panel is driven by `agentSteps` on the `Message` type, populated client-side from the `done` SSE event's `assistantMessage` payload.

---

## Scope Decisions

### 9A: Heuristic, Not a Classifier Claude Call

The intent classifier is a keyword heuristic — not a separate Claude call. Rationale: adding a pre-flight Claude call would add 1–3 seconds of latency on every message, even those that don't need KB routing. The keyword approach fires in ~0ms and covers the clear cases (document, file, PDF, uploaded, transcript, search my files, etc.). False positives are acceptable in beta — an unnecessary KB Explorer call silently times out and the base synthesis proceeds. False negatives (failing to route a KB question) are the worse failure mode, so the keyword list should err toward inclusion.

### 9A: 10-Second Client-Side Timeout

The KB Explorer's backend default is 60 seconds. For the Virtual CSO streaming experience, waiting 60 seconds before synthesis starts is not acceptable. The client uses `Promise.race()` between the Railway call and a 10-second timeout. On timeout, the founder gets base synthesis without KB injection. No error is surfaced to the UI. The routing notice from `onReady` still fires normally.

### 9A: KB Result Injected Into Prompt, Not Streamed Separately

The KB Explorer result (`result_summary`) is injected as a `KB EXPLORER FINDINGS` section in `assemblePrompt()`. Claude synthesizes across both the founder wiki context AND the KB Explorer findings in one pass. There is no separate streaming of KB results — the founder sees one response.

### 9A: `agentSteps` Is Client-Side Only in Beta

`agentSteps` is not persisted to `vcso_chat_messages`. The `done` SSE payload carries it, `toMessage()` passes it through, and the client stores it in component state. On thread reload (loading historical messages), `agentSteps` will be absent — `AgentStepsPanel` simply won't render. This is acceptable for beta. Persistence can be added in v2 if founders need to review historical reasoning.

### 9B: Split MessageBubble or Edit In Place?

Decision: edit `MessageBubble.tsx` in place. The component already has the `isUser` branch. Adding `AgentStepsPanel` above the assistant markdown is a localized addition. A full split into `UserBubble.tsx` + `AssistantMessage.tsx` is cleaner architecturally but is a larger refactor with more import updates across the codebase. For beta, editing in place is the right call.

### 9B: No Max-Width Constraint on Assistant Messages

The existing `max-w-[88%]` on the assistant bubble is removed along with the container. Assistant text runs at full column width. This is consistent with Claude.ai, Notion AI, and similar tools where the UI column itself is the constraint, not a per-message max-width.

### 9C: AgentStepsPanel Collapsed by Default

The panel defaults to collapsed ("KB Explorer used N tools" header only). Most founders will not need to inspect tool steps on every message. The header is a signal that KB retrieval happened; clicking expands for inspection.

---

## Architectural Boundary: What Phase 9 Does NOT Do

- Does NOT change the Python backend. The Railway `/api/agent-runs` endpoint is unchanged.
- Does NOT add streaming from the KB Explorer to the client. The KB Explorer call is synchronous from `chat.ts`'s perspective (it awaits the full `AgentRunResponse`).
- Does NOT embed KB Explorer results into the Virtual CSO's token stream — findings are injected at prompt assembly before Claude is called.
- Does NOT persist `agentSteps` to Supabase (beta constraint, v2 decision).
- Does NOT change `VirtualCSOWorkspace.tsx` state management beyond what flows naturally from `Message.agentSteps`.
- Does NOT change the skill routing logic in `classify()`. KB routing is a parallel, additive check — it does not interact with skill pack selection.

---

## Deferred Items

| Item | Status | Tracking |
|---|---|---|
| DL-L1-EMBED | Layer 1 projected pages in `ose_knowledge_pages` have no embedding; `match_ose_knowledge_pages` RPC won't surface them in semantic search | Deferred from Phase 8; no phase assigned yet |
| 8C semantic selection upgrade | Upgrade `selectFounderPages()` from keyword scoring to embedding-based similarity | Depends on DL-L1-EMBED; deferred |
| AGENT-02 sub-agent delegation | `can_spawn_agents=False` by design in Phase 7; KB Explorer cannot invoke document_analysis_agent | Tracked in REQUIREMENTS.md v2 table |
| `agentSteps` persistence | Historical thread reload will not show KB Explorer steps | v2; not needed for beta |
| KB Explorer for Domain Agents / OS Engine | Phase 9 only wires KB routing for Virtual CSO | Future phase |

---

## Files Modified by Phase 9

| File | Nature of Change |
|---|---|
| `api/vcso/chat.ts` | Add intent heuristic, Railway call with timeout, prompt injection, `agentSteps` in `done` payload |
| `lib/virtualCsoMockData.ts` | `AgentStep` interface; `agentSteps?` on `Message` |
| `lib/virtualCsoApi.ts` | `toMessage()` passes through `agentSteps` |
| `components/pro-suite/virtual-cso/MessageBubble.tsx` | Remove assistant bubble container; add `AgentStepsPanel` |
| `components/pro-suite/virtual-cso/AgentStepsPanel.tsx` | New collapsible component — create |

---

## Success Criteria (for execution agent smoke tests)

1. A message containing "find my Q1 report" triggers the KB Explorer call (heuristic fires)
2. A message containing "what's my growth bottleneck" does NOT trigger the KB Explorer (heuristic does not fire)
3. The KB Explorer `result_summary` appears as `KB EXPLORER FINDINGS` in the assembled prompt (visible in `console.log` in dev mode)
4. On Railway timeout (>10s), synthesis proceeds without error surfaced to UI
5. `message.agentSteps` is present on the `done` SSE payload's `assistantMessage` when KB was invoked
6. `AgentStepsPanel` renders collapsed above assistant text when `agentSteps.length > 0`
7. `AgentStepsPanel` expands on click and shows tool name + input/output summaries
8. Assistant messages have no border, background, or shadow container
9. User messages remain in right-aligned slate bubble — unchanged
10. TypeScript compiles without new errors on `api/vcso/chat.ts`, `lib/virtualCsoMockData.ts`, `lib/virtualCsoApi.ts`, and both component files

---

## Option B Carries Through

Phase 8's core architecture decision (Option B: Layer 1 pages projected into `ose_knowledge_pages`) is unchanged and not touched by Phase 9. The Virtual CSO's `loadFounderContext()` continues to load from `ose_knowledge_pages` for founder wiki context. Phase 9's KB routing is a parallel path that adds document library retrieval on top of that.
