# Phase A Plan — Streaming Spike + SDK Proof-of-Loop

> Read the workstream `../../CONTEXT.md` + `../../ROADMAP.md` and this folder's `CONTEXT.md` +
> `ROADMAP.md` first. Covers **SDK-A1..A5**. Behind dark flag `vcso_sdk_loop` (default off, Phase-1-flag
> shape). **Verify live before changing.** This phase **resolves Q1** — the decisive unknown — and
> gates the whole migration. Prove streaming; migrate nothing.

## Deliverable
A minimal Claude Agent SDK `query()` loop in `python-backend`, behind a dark flag, proving that **real
token-level assistant streaming** and **curated step events** flow through the existing SSE transport
and render natively, with one lifecycle/`PostToolUse` hook emitting a LangSmith trace paired to an
`ai_usage_log` row. Output is a documented **go/no-go** on SDK token streaming.

## Steps

### A. SDK loop stub (SDK-A1)
1. Install/verify the Agent SDK (Python) in `python-backend`; confirm it runs **in-process** with the
   API key server-side (CLAUDE.md Rule #1). No Managed Agents.
2. Add flag `vcso_sdk_loop` (default **off**). Behind it, a minimal `query()` loop wired with 1–2
   existing read-only tools (e.g. `wiki_search`) for **one trivial VCSO turn**. Flag off ⇒ the live
   `_stream_chat_impl` path is byte-for-byte unchanged.

### B. Streaming through the SSE transport (SDK-A2/A3) — the decisive test
1. Consume the SDK message stream and normalize into the existing SSE events: assistant text deltas →
   **real** `token` events (not 160-char chunks); `tool_use` → curated `step`/`tool_call`; confirm
   native render on the canary frontend build.
2. **Explicitly evaluate token granularity:** does true token-level assistant text flow through our SSE
   transport, or only coarser message chunks? Record the observed behavior with evidence.
3. Surface **no raw JSON payloads and no raw chain-of-thought** in the UI (locks reconciliation) — only
   curated steps + streamed answer.

### C. Observability seam (SDK-A4)
1. Wire one `PostToolUse`/lifecycle hook to emit a LangSmith trace for the SDK call, **paired to the
   exact `ai_usage_log` row** (the standing bar: traces paired with DB/output checks).

### D. Go/No-Go (SDK-A5)
1. Write the finding + recommendation to `04B-A-COMPLETION.md`. **If token streaming is clean →** Phase
   B proceeds as specified. **If not →** document the message-level-streaming fallback + plan-panel
   masking UX revision that Phase B must adopt instead. Bring the go/no-go to London.

## Acceptance criteria
1. Flag off ⇒ live VCSO unchanged (forced flag-off smoke passes; `intent`/router untouched).
2. Flag on: one trivial turn runs on the SDK loop; assistant text streams as **real tokens** through
   SSE and renders natively; curated step events appear; no raw JSON/CoT surfaced.
3. One hook emits a LangSmith trace paired to the exact `ai_usage_log` row.
4. The Q1 go/no-go is recorded with evidence; if no-go, the fallback UX path is documented.
5. `python -m compileall python-backend` clean; `../../ROADMAP.md` + `../../STATE.md` + `ROADMAP.md`
   progress updated; `04B-A-COMPLETION.md` written. Read-back to London.

## Out of scope
Replacing the live loop (Phase B); registry→SDK compiler (C); native subagents (D); sessions/Deep Mode
(E); MCP (F). This phase proves **streaming + the loop seam only**, on a trivial turn.
