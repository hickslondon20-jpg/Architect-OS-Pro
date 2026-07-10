# Citations (Episode 7) — Sub-phase A3 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`. This session runs sub-phase **A3 only** (Virtual CSO citation UX).
> Do **not** start A4.

---

You are the **execution agent** for Sub-phase A3 (Virtual CSO Citation UX) of the ArchitectOS Episode 7
(Citations & Source Grounding) build. You build against **decided design** — implementation choices only, never
design choices. This is **functional UX only** — do **not** do visual/design-system polish; that is the
separate §8 front-end pass. If something needs a design decision beyond the inputs, **stop and flag it**.

You are in the `ArchitectOS Pro_beta` repo, canonical path `C:\Users\Hicks\ArchitectOS Pro_beta`. All paths
below are relative to that root. This phase is **frontend** (React/TypeScript).

**What A3 is, in one line:** numbered inline **chips** → **source sidecar** → **jump-to-evidence** in Virtual
CSO, consuming the A1 `CitationRef` stream + the A2 `/api/citations/resolve` endpoint, plus the F4 type
migration. No backend changes.

---

## Orient first — read these in order, then build

1. `.planning/citations/phases/a3-vcso-citation-ux/RESEARCH.md` — **primary build source.** The old source type
   to migrate (§1), where sources flow in (§2), the mount points with anchors (§3), the sidecar/resolve
   contract (§4), scope discipline (§5). **Re-verify every anchor before editing — they drift.**
2. `.planning/citations/phases/a3-vcso-citation-ux/A3-01-PLAN.md` — task + criteria.
3. `.planning/citations/phases/a3-vcso-citation-ux/CONTEXT.md` — scope, decided decisions, file list, criteria.
4. `.planning/citations/CONTEXT.md` — locked ledger (**wins on conflict**): §3.3, §4 O1 (derived → trace), §5
   F4, §8 amendments (A1 `done.sources`/`ordinal` shape; A2 resolve view shapes + derived/web handling).
5. The live surface: `lib/virtualCsoApi.ts`, `lib/virtualCsoMockData.ts`,
   `components/pro-suite/virtual-cso/{MessageBubble,SourcesPanel,AgentStepsPanel}.tsx`, and the shared Reader.

Read 1–4 fully before writing a line.

---

## What you build (frontend)

- **Type migration (F4)** — replace `SourceKind`/`SourceRef` (`{kind:'wiki'|'platform'|'ip'|'context', label,
  pageId}`) in `lib/virtualCsoMockData.ts` + `lib/virtualCsoApi.ts` with a `CitationRef` TS type mirroring the
  backend A0 shape: `source_kind` (family `document_chunk|wiki_page|platform_record|web|derived`), `source_id`,
  `source_label`, `verbatim`, `locator`, `source_metadata`, `ordinal`. Update the stream parser +
  `SendUserMessageResult.sources`. **No old `SourceRef` `{kind,...}` may remain** (typecheck enforces).
- **Inline chips (C-10)** — in `MessageBubble.tsx`, parse `[n]` in the answer markdown and render each as a
  numbered, clickable chip bound to the turn `CitationRef[]` by `ordinal`; hover-preview → click opens sidecar.
- **Source sidecar (C-11)** — **reuse/extend the existing shared Reader** (the current SourcePage click-to-read
  flow — RESEARCH §3); it calls `POST /api/citations/resolve` and renders by family: chunk text, wiki
  prose/claim+evidence, Tier 0 field table, `web_dark` placeholder. Do not build a brand-new reader.
- **Jump-to-evidence (C-13)** — scroll/center + highlight using `locator.lines`/`section` (chunk/wiki) or the
  record field (Tier 0). `locator.bbox` is null in Ep7A — PDF-rectangle jump is Ep7B/B2.
- **Sources rail** — `SourcesPanel.tsx` renders the turn's numbered `CitationRef[]`.
- **Derived → trace (O1)** — `derived` refs render only in `AgentStepsPanel.tsx` (the activity trace), never as
  chips or in the sources rail.
- **Copy (C-19)** — copy the answer with `[n]`/markers stripped.

---

## Hard constraints

- **Functional only.** Legible chips/sidecar/highlight — **no visual/design-system polish** (that is §8).
- **No backend changes.** Consume the A1 stream + A2 endpoint only.
- **Derived → trace-only** (O1). **`web_dark`/unresolvable degrade gracefully** — quiet "source unavailable",
  never a broken chip.
- **Reuse the shared Reader** for the sidecar; don't fork a second reader.
- **Full type migration** — no old `SourceRef` shape remains.
- **No verification UI (A4), no artifact rendering (A5), no PDF geometry (Ep7B).**
- **CONTEXT wins** on conflict. If underspecified, stop and flag.

---

## Done when (A3 success criteria — CONTEXT §"Success criteria")

1. Clicking a chip opens the sidecar with the resolved source and the cited span highlighted (line/field level).
2. `[n]` in the answer renders as the matching numbered chip; stripped/invalid markers don't render.
3. Jump-to-evidence lands on the correct location for each lit family.
4. `derived` refs appear only in the trace (O1); `web_dark`/unresolvable degrade gracefully.
5. Sources rail shows the turn's numbered `CitationRef[]`; Copy strips markers.
6. Frontend builds/typechecks; no old `SourceRef` `{kind,...}` remains.

**Report back:**
- One paragraph on what was built.
- How chips parse/bind `[n]`; how the sidecar extends the shared Reader; the jump-to-evidence behavior per family.
- Confirmation `derived`→trace and `web_dark`/unresolvable degrade gracefully.
- Any implementation choice deviating from/extending the design (for CONTEXT §8 reconciliation).
- Any flag needing London (e.g. a UX ambiguity that reads as a design decision) or a judgment call — and note
  that all visual polish is intentionally deferred to §8.

Then stop. Sub-phase A4 is opened from the strategy thread.
