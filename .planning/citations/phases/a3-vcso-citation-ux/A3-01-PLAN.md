# Plan A3-01 — Virtual CSO citation UX (functional)

**Sub-phase:** A3 — Virtual CSO citation UX
**Plan:** 1 of 1
**Depends on:** A1 (CitationRef stream + `[n]` markers), A2 (`POST /api/citations/resolve`)
**Status:** Ready for execution — no open decisions; frontend mount points pinned (`RESEARCH.md`).
**Decisions:** `../../CONTEXT.md` §3.3, §4 O1 (derived → trace), §5 F4 · **Ref:** `../../REFERENCES.md` C-10/C-11/C-13/C-19

---

## Goal

The user-facing citation experience in Virtual CSO: numbered inline **chips** → **source sidecar** →
**jump-to-evidence**. Consume the A1 `CitationRef` stream + A2 resolve endpoint. **Functional, not polished** —
visual design deferred to the §8 front-end pass (F4).

## Pre-Execution Checks
1. Read `RESEARCH.md` (this folder) — the live VCSO React surface + exact mount points.
2. Confirm the A1 `done.sources` / per-step `sourceRefs` `CitationRef` shape (incl. `ordinal`) and the A2
   resolve view shapes (`chunk`/`wiki`/`platform_record`/`web_dark`/`not_citable`).

## Build (frontend)
- **Type migration (F4).** Replace the old `SourceRef` (`{kind,label,pageId}`, `SourceKind='wiki'|'platform'
  |'ip'|'context'`) in `lib/virtualCsoMockData.ts` + `lib/virtualCsoApi.ts` with a `CitationRef` TS type
  mirroring the backend (`source_kind` family, `source_id`, `source_label`, `verbatim`, `locator`,
  `source_metadata`, `ordinal`). Update the stream parser + `SendUserMessageResult.sources`.
- **Inline chips (C-10)** — in `MessageBubble.tsx`, parse `[n]` in the answer markdown and render each as a
  numbered, clickable chip bound to the turn `CitationRef[]` by ordinal; hover-preview → click opens sidecar.
- **Source sidecar (C-11)** — a preview panel that calls `POST /api/citations/resolve` and renders by family:
  chunk text, wiki prose/claim+evidence, Tier 0 field table, `web_dark` placeholder. **Reuse/extend the
  existing shared Reader** (the current SourcePage click-to-read flow) rather than building a new reader.
- **Jump-to-evidence (C-13)** — scroll/center to `locator.lines`/`section` (chunk/wiki) or the record field
  (Tier 0). PDF bbox jump is Ep7B/B2.
- **Sources rail** — `SourcesPanel.tsx` renders the turn's numbered `CitationRef[]` (was `SourceRef[]`).
- **Derived → trace (O1)** — `derived` refs render only in `AgentStepsPanel.tsx` (the activity trace), never
  as chips or in the sources rail.
- **Copy (C-19)** — copy the answer with `[n]`/markers stripped.

## Surface manifestation
**Virtual CSO** — chips on answers, source sidecar, jump-to-evidence, numbered sources rail; derived refs in the
trace. Line/section/field precision now; pixel-precise PDF rectangles arrive in Ep7B. Functional legibility
only — **visual polish is §8**.

## Success criteria
1. Clicking a chip opens the sidecar with the resolved source and the cited span highlighted (line/field level).
2. `[n]` in the answer renders as the matching numbered chip; invalid/stripped markers don't render.
3. Jump-to-evidence lands on the correct location for each lit family.
4. `derived` refs appear only in the trace (O1); `web_dark`/unresolvable degrade gracefully (no broken chip).
5. Sources rail shows the turn's numbered `CitationRef[]`; Copy strips markers.
6. Frontend builds/typechecks; no old `SourceRef` `{kind,...}` shape remains.

## Out of scope
Backend resolvers (A2); verification action (A4); artifact-library rendering (A5); PDF geometry (Ep7B);
visual/design polish (§8).
