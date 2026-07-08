# A3 RESEARCH — The live VCSO React surface (extraction)

**Extraction target:** the Virtual CSO frontend that renders answers, sources, and the trace. A3 wires chips +
sidecar + jump-to-evidence onto these existing mount points and migrates the old `SourceRef` shape to
`CitationRef` (F4). **Re-verify anchors before editing — they drift.** Verified 2026-07-06. Paths from repo root.

---

## §1 The old source type (migrate to CitationRef — F4)

`lib/virtualCsoMockData.ts:54–58`:

```ts
export type SourceKind = 'wiki' | 'platform' | 'ip' | 'context';
export interface SourceRef { kind: SourceKind; label: string; pageId?: ... }
export interface SourcePage { id: string; ... }         // markdown body "opened in the shared Reader"
export const SOURCE_KIND_LABELS: Record<SourceKind,string> = { wiki: 'Your wiki', ... };  // :300
```

Re-exported through `lib/virtualCsoApi.ts:6–20` (`SourceKind`, `SourceRef`, `SourcePage`, `SOURCE_KIND_LABELS`,
`MOCK_SOURCE_REFS`). **A3 replaces `SourceRef`/`SourceKind` with a `CitationRef` TS type** mirroring the backend
A0 shape: `source_kind` (family: `document_chunk|wiki_page|platform_record|web|derived`), `source_id`,
`source_label`, `verbatim`, `locator`, `source_metadata`, plus `ordinal` (A1 adds it via `_with_ordinal`).

## §2 Where the turn's sources flow in (A1 already changed the backend)

`lib/virtualCsoApi.ts`: `SendUserMessageResult` (`:82–88`) has `sources: SourceRef[]` + `sourcePages:
SourcePage[]` + `assistantMessage: Message`. These come from the `done` event, which A1 now emits as
`CitationRef`-shaped (`done.sources = serialized_turn_citations`). Per-step refs: the stream parser maps
`step.source_refs` → `sourceRefs` (`:187`), also now `CitationRef`-shaped. **A3 updates the parser + these
types to the new shape.** Client state maps: `sourceRefsByChat` (`:112`), `sourcePagesById` (`:113`).

## §3 Mount points

- **`components/pro-suite/virtual-cso/MessageBubble.tsx`** — renders the answer with `ReactMarkdown` (`:3`),
  and `AgentStepsPanel` when `message.agentSteps` present (`:40–42`). **Chips mount here:** parse `[n]` in the
  answer markdown → render numbered clickable chips bound to the turn `CitationRef[]` by `ordinal` (a
  ReactMarkdown component override or a pre-render pass). Also the **Copy** (strip `[n]`/markers).
- **`components/pro-suite/virtual-cso/SourcesPanel.tsx`** — the sources rail. **Renders the turn's numbered
  `CitationRef[]`** (was `SourceRef[]`). Chip click → sidecar.
- **`components/pro-suite/virtual-cso/AgentStepsPanel.tsx`** — the curated activity trace (per-step
  `sourceRefs`). **`derived` refs render only here (O1), never as chips / in the rail.**
- **The shared Reader** — `SourcePage` bodies are "opened in the shared Reader when a source is clicked"
  (`virtualCsoMockData.ts:63`). This is the **sidecar precedent** — locate the shared Reader component (also
  used by OS Engine wiki views) and **extend it** to call `POST /api/citations/resolve` and render by family,
  rather than building a new reader.

## §4 The sidecar contract (A2 resolve endpoint)

Chip/rail click → `POST /api/citations/resolve` with the `CitationRef` → a family-tagged view:
`chunk` (verbatim + line/section), `wiki` (prose/claim + evidence), `platform_record` (label + field table +
deep-link), `web_dark` (placeholder), `not_citable` (should not occur for chips — derived never becomes a chip).
Jump-to-evidence uses `locator` (`lines`/`section`/`record_path`) to scroll/center + highlight. `locator.bbox`
is null in Ep7A (Ep7B/B2 adds PDF-rectangle jump).

## §5 Scope discipline

- **Functional, not polished** — legible chips/sidecar/highlight; **all visual design is the §8 pass** (F4).
- **No backend changes** — A3 consumes the A1 stream + A2 endpoint only.
- **Derived → trace-only** (O1). **web_dark / unresolvable degrade gracefully** — no broken chip, a quiet
  "source unavailable" state.
- Migrate the type fully — **no old `SourceRef` `{kind,...}` shape may remain** (typecheck enforces).
