# Phase B Plan — SDK Loop for Standard VCSO (Parallel)

> Read `../../CONTEXT.md` + `../../ROADMAP.md` and this folder's `CONTEXT.md` + `ROADMAP.md` first.
> Covers **SDK-B1..B6**. Behind `vcso_sdk_loop`, **parallel** to the hand-rolled path. **Gated on the
> Phase A go/no-go.** Standard (non-Deep, non-planner) VCSO turns only.

## Deliverable
Standard VCSO turns routed through the SDK loop behind the flag, in parallel with the live hand-rolled
path: the context-**selection** pre-assembly feeds the SDK system prompt + inputs, the SDK owns the
message list / `tool_result` accumulation / compaction, the SDK message stream is **normalized into the
existing SSE schema**, the 160-char fake chunker is deleted, and LangSmith + `ai_usage_log` ride SDK
hooks — proven at canary parity (cost + quality) with a byte-stable SSE contract for the frontend.

## Steps

### A. Loop swap behind the flag (SDK-B1)
1. Route standard VCSO turns through the SDK `query()` loop when `vcso_sdk_loop` is on; keep the
   hand-rolled `_stream_chat_impl` loop as the flag-off path. No dark swap — parallel only.
2. Provide the SDK its tool set from the registry (`to_anthropic`-style specs) for the standard surface.

### B. Context selection kept; packing/lifecycle repositioned (SDK-B2)
1. **Keep** the context-*selection* IP (`_build_context_for_turn`: working state + tiered router + wiki
   components + IP layer). Feed its output as the SDK **system prompt + structured inputs** — do **not**
   let the SDK own selection.
2. Hand the SDK the **multi-round message lifecycle** (message list, `tool_result` accumulation,
   compaction) in place of the hand-rolled marshalling. Keep a lean deterministic pre-fetch as the cheap
   first-call fast-path; deeper context is pulled in-loop via router-as-tools.

### C. Stream normalizer + delete the fake (SDK-B3/B4)
1. Build the normalizer: SDK messages → existing SSE events
   (`ready`/`step`/`tool_call`/`tool_result`/`token`/`heartbeat`/`done`). The frontend contract is
   **unchanged**.
2. **Delete** the 160-char pseudo-token chunker; real token streaming replaces it (per Phase A).

### D. Observability on hooks (SDK-B5)
1. Move `trace_scope` + `log_ai_usage_event` from wrapping the manual call onto SDK hooks; every
   standard SDK turn emits a LangSmith trace paired to its `ai_usage_log` row.

### E. Canary parity proof (SDK-B6)
1. On a matched authenticated control/canary set, prove **cost + quality parity-or-better** vs. the
   hand-rolled path with **no quality regression**; SSE payloads byte-stable; traces paired to usage rows.

## Acceptance criteria
1. Flag off ⇒ standard VCSO unchanged; flag on ⇒ standard turns run on the SDK loop in parallel.
2. Context *selection* is unchanged IP; packing + multi-round lifecycle are on the SDK.
3. SDK stream normalized into the existing SSE schema; frontend contract byte-stable; 160-char chunker
   removed; real token streaming live.
4. LangSmith + `ai_usage_log` ride hooks; every SDK turn paired.
5. Canary parity (cost + quality) proven on a matched set; no regression.
6. `compileall` clean; frontend green if any `src` touched; `ROADMAP.md`/`STATE.md` + `04B-B-COMPLETION.md`
   updated. Read-back to London.

## Out of scope
Registry→SDK compiler (C); native subagents / planner (D); sessions/Deep Mode (E); MCP (F); flipping the
default (founder-gated, later). Deep Mode + planner turns stay on the hand-rolled path this phase.
