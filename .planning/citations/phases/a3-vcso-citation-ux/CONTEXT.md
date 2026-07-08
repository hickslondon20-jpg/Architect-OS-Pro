# Sub-phase A3 Context — Virtual CSO Citation UX

**Date:** 2026-07-06
**Outcome:** Ready to execute. No open decisions; frontend mount points pinned in `RESEARCH.md`. The execution
agent makes implementation choices only, not design choices. **Functional UX only — visual polish is the §8 pass.**

---

## What this sub-phase is

The first user-facing citation phase: numbered inline **chips**, a **source sidecar**, and **jump-to-evidence**
in Virtual CSO, consuming the A1 `CitationRef` stream + the A2 `POST /api/citations/resolve` endpoint. Includes
the F4 type migration (old `SourceRef` → `CitationRef`). Single deliverable: **A3-01** (see `A3-01-PLAN.md`).

---

## Inputs the agent must read first (in order)

1. `RESEARCH.md` (this folder) — **primary build source.** The old source type to migrate (§1), where sources
   flow in (§2), the mount points (§3), the sidecar/resolve contract (§4), scope discipline (§5).
2. `A3-01-PLAN.md` (this folder) — task + criteria.
3. `../../CONTEXT.md` — locked ledger. §3.3 (surfaces), §4 O1 (derived → trace), §5 F4, §8 amendments (A1/A2
   completion — the `done.sources` shape, resolve endpoint, derived handling). **CONTEXT wins on conflict.**
4. The live surface: `lib/virtualCsoApi.ts`, `lib/virtualCsoMockData.ts`,
   `components/pro-suite/virtual-cso/{MessageBubble,SourcesPanel,AgentStepsPanel}.tsx`, and the shared Reader.

---

## Decisions already made (do not re-open)

- **Chips are numbered `[n]`** bound by `ordinal` to the turn `CitationRef[]` (A1 scheme).
- **Sidecar reuses/extends the existing shared Reader** — do not build a new reader; it calls the A2 resolve
  endpoint and renders by family.
- **`derived` refs render only in the activity trace** (O1) — never chips or sources rail.
- **`web_dark` / unresolvable degrade gracefully** — quiet "source unavailable", no broken chip.
- **Functional only** — visual/design polish is deferred to the §8 front-end pass (F4).
- **Full type migration** — no old `SourceRef` `{kind,...}` shape may remain.

---

## What this sub-phase does NOT do

- No backend changes (consumes A1 stream + A2 endpoint only).
- No verification action/UI (A4); no artifact-library rendering (A5); no PDF geometry jump (Ep7B/B2).
- No visual/design system work — legibility only; §8 owns polish.
- No new source types beyond `CitationRef`.

---

## Files to create or modify

| File | Action | Notes |
|---|---|---|
| `lib/virtualCsoMockData.ts` | Modify | Replace `SourceKind`/`SourceRef` with `CitationRef` TS type + family labels; update mocks. |
| `lib/virtualCsoApi.ts` | Modify | Update re-exports, `SendUserMessageResult.sources`, stream parser to `CitationRef`. |
| `components/pro-suite/virtual-cso/MessageBubble.tsx` | Modify | Parse `[n]` → numbered clickable chips; Copy (strip markers). |
| `components/pro-suite/virtual-cso/SourcesPanel.tsx` | Modify | Render the turn's numbered `CitationRef[]`; click → sidecar. |
| `components/pro-suite/virtual-cso/AgentStepsPanel.tsx` | Modify | `derived` refs render here (trace) only. |
| the shared Reader component (+ a citation-sidecar wrapper) | Modify/Create | Call `POST /api/citations/resolve`; render by family; jump-to-evidence via `locator`. |

---

## Success criteria (A3-01)

1. Clicking a chip opens the sidecar with the resolved source and the cited span highlighted (line/field level).
2. `[n]` in the answer renders as the matching numbered chip; stripped/invalid markers don't render.
3. Jump-to-evidence lands on the correct location for each lit family.
4. `derived` refs appear only in the trace (O1); `web_dark`/unresolvable degrade gracefully.
5. Sources rail shows the turn's numbered `CitationRef[]`; Copy strips markers.
6. Frontend builds/typechecks; no old `SourceRef` `{kind,...}` remains.

---

## Handoff

When chips + sidecar + jump-to-evidence are functional and the type migration is complete, the strategy thread
logs an A3 completion amendment in `../../CONTEXT.md §8`, then opens **sub-phase A4 (Check Citations verifier)**.
Visual polish for all of A3's surfaces is carried to the post-Ep7 §8 front-end pass.

*Context written: 2026-07-06 — Ep7 citations planning thread, at A3 sub-phase entry.*
