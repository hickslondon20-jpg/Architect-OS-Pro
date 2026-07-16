# Phase C2 Plan — Streaming Surface Redesign (UI/UX)

> Read `../../CONTEXT.md` + `../../ROADMAP.md` and this folder's `CONTEXT.md` + `ROADMAP.md` first.
> Covers **SDK-U1..U5**. The migration's **first `src/` phase** and first explicit UX phase. **Visual-only
> against the stable SSE schema, plus one backend normalizer tweak.** Sequenced after C. **Verify the
> current frontend streaming components AND the founder's approved screenshots before building.**

## Deliverable
The VCSO transparency/streaming surface redesigned to match the approved screenshots — **token-by-token
streaming of the answer *and* the curated interstitial narration**, **drill-down step chips** (not
blocky accordions), and the **living right-hand plan/scratchpad panel** — consuming the stable SSE event
stream, with **one** backend tweak so the normalizer streams interstitial narration as tokens rather
than folding it into blocky step summaries. No change to loop logic, retrieval, the registry, or the SSE
contract (additive only).

## Why this phase exists
Phases A–B upgraded the *data* (real tokens + curated steps over the stable SSE schema) but **reused the
old MA-05 transparency components**, so the surface still feels blocky and templated and does not stream
the thought process. C2 redesigns the *presentation layer* that renders the now-good event stream.

## Steps

### A. Research-first: map current → target (SDK-U1)
1. Read the current frontend streaming/transparency components in `src/` and the founder's approved
   screenshots. Map each SSE event (`ready`/`step`/`tool_call`/`tool_result`/`token`/`heartbeat`/
   `ask_user`/`todos_updated`/`workspace_updated`/`done`) to its **current** render and its **target**
   render. Write a short gap note (what is blocky: accordions, batched narration, non-streamed prose).

### B. Backend: stream the interstitial narration (SDK-U2)
1. Ensure interstitial assistant narration (text the model emits **before/between** `tool_use` in a
   turn — the "now I'll…" lines) is emitted as streamed `token`/narration events, **not** folded into a
   blocky step summary. **Curated only — never raw chain-of-thought.** Keep the SSE contract
   backward-compatible (additive event/fields only).

### C. Frontend: the native surface (SDK-U3)
1. Render the answer **token-by-token** and the interstitial narration as **flowing** text as it
   arrives.
2. Replace heavy accordions with **drill-down step chips** (Claude-like: show the tool called + a
   one-line summary; expand for curated detail; **never** to raw JSON sent/received).
3. Build the **living right-hand plan/scratchpad panel** as plan-state, driven by the plan/todo events —
   the numbered plan updating as steps complete (the screenshot behavior).
4. Match the approved screenshots for layout, hierarchy, and motion; retire the templated feel.

### D. Locks + guardrails (SDK-U4)
1. **No raw JSON payloads and no raw chain-of-thought** anywhere in the UI; drill-down stops at curated
   detail. Founder isolation unchanged. Ship behind the same dark flag / canary as the SDK path.

### E. Canary proof (SDK-U5)
1. On the canary, the surface **matches the approved screenshots**; token + narration streaming is
   smooth; step chips drill down to curated detail only; the plan panel updates live. **No backend logic
   regressed; SSE contract byte-stable (additive only).**

## Acceptance criteria
1. Current→target gap note written from the live components + screenshots.
2. Interstitial narration streams as tokens (curated, no raw CoT); SSE contract backward-compatible.
3. Frontend renders token-by-token answer + flowing narration; drill-down step chips (no raw JSON); the
   living plan panel updates as steps complete — matching the approved screenshots on the canary.
4. Locks intact (no raw payloads / no raw CoT); founder isolation unchanged; behind the dark flag.
5. No backend loop/retrieval/registry logic changed beyond the narration-streaming tweak; SSE contract
   byte-stable.
6. `compileall` clean (if backend touched); frontend build green; `../../ROADMAP.md`/`../../STATE.md` +
   `04B-C2-COMPLETION.md` updated. Read-back to London with before/after against the screenshots.

## Out of scope
Rich rendering of **subagent** step trees (depends on Phase D's `parent_tool_use_id` events — extend C2
when D lands) and **Deep Mode** plan/workspace specifics (depends on Phase E — extend then); any backend
loop/registry/retrieval logic change; flipping the flag default. C2 delivers the **core** native surface
now and is extended as D and E enrich the event stream.
