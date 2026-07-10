# Plan A1-01 — Turn collection + answer-span binding

**Sub-phase:** A1 — Turn collection + answer-span binding
**Plan:** 1 of 1
**Depends on:** A0 (currency + adapters)
**Status:** Ready for execution — **O3 resolved** (CONTEXT §8 amendment 2026-07-06); two-source-pool finding baked in.
**Decisions:** `../../CONTEXT.md` §3.1 DP2, §4 O3 (resolved), §5 F4 · **Ref:** `../../REFERENCES.md` C-8/C-9

---

## Goal

Collect a turn's `CitationRef[]` **once** (from both live source pools), number + bind them to answer spans
**source-ref-first** (DP2), and replace the VCSO stream's ad-hoc `{kind,label,pageId}` refs with unified
`CitationRef` events. No parallel per-message citations store (L22) — citations are the turn's collected list,
persisted on the assistant message.

## Decided binding scheme (O3 — do not re-open)
- **Per-message deterministic ordinal `[n]`** over the turn's **deduped** `CitationRef[]`. Dedup/identity key
  `(source_kind_family, source_id)`, content-hash of `verbatim`/`source_label` fallback when `source_id` null.
- **Verbatim escape hatch (DP2):** the Tier 2 `[[Source:]]` marker binds a quote to an offset via
  `parse_inline_source_marker`, coexisting with `[n]`.
- **Invalid/out-of-range `[n]` are dropped** on parse (mirrors reference strip-invalid).
- Cross-turn thread-stable numbering is **deferred** — not built here.

## Pre-Execution Checks
1. Read `RESEARCH.md` (this folder) — the live VCSO loop: the two source pools, the final-answer pass, the
   stream events, persistence, deep-resume state.
2. Re-verify the anchors in `vcso_chat_service.py` (`_build_context` refs ~168–181; `all_sources` ~399–400;
   final-answer pass ~491–504; `done` event ~561–576; deep-resume ~245–269, 353–364) before editing.
3. Confirm where the assistant message persists and whether a `citations` column/store exists on the messages
   table (else add one) — the reload-safe home for the turn `CitationRef[]`.

## Build
- **Collect both pools → one `CitationRef[]`.** Normalize (1) `_build_context` display refs
  (`from_vcso_stream_ref`) and (2) `all_sources` tool refs (`from_tool_source_ref` / `from_agent_source_ref`
  / `from_provenance_ref`) via A0 adapters; dedup by the O3 key; assign stable ordinals.
- **Feed the final-answer pass.** Add a numbered source list + a cite-with-`[n]` instruction to the
  final-answer prompt (`VCSO_TOOL_LOOP_SYSTEM_PROMPT` / the "write the final answer" message). Grounding stays
  source-ref-first (DP2); A4 verification is the backstop for unsupported `[n]`.
- **Parse + bind.** Extract `[n]` from the streamed answer tokens → bind to the ordered `CitationRef[]`; drop
  invalid indices; lift any `[[Source:]]` verbatim markers.
- **Emit unified stream events.** Replace the `done`-event `sources` (`{kind,label,pageId}`) and per-step
  `sourceRefs` display shape with `CitationRef` events; keep the streaming lifecycle (appear → upgrade →
  settle, C-9). Preserve deep-resume: `all_sources`/citation state must survive `ask_user` pause/resume.
- **Persist** the turn `CitationRef[]` on the assistant message (reload-safe).

## Surface manifestation
**Virtual CSO** — the stream emits unified `CitationRef` events and the answer now carries `[n]` markers (the
shape A3 chips consume). The final-answer prompt change alters model output format — **coordinate with the §8
front-end pass (F4)** so the client renders `[n]` as chips.

## Success criteria
1. A VCSO turn reading a chunk + a wiki page + a Tier 0 record collects a **single deduped** `CitationRef[]`
   spanning both pools, with correct families.
2. The answer carries `[n]` markers that bind to the right `CitationRef`; a verbatim quote binds via the marker.
3. Out-of-range/invalid `[n]` are dropped, not rendered.
4. Ordinals + citations are reload-safe (persisted on the assistant message) and survive deep-mode resume.
5. `done`-event + per-step refs are `CitationRef`-shaped; no `{kind,label,pageId}` remains; no parallel store.

## Out of scope
Resolving a ref to a viewable source (A2); the chip/sidecar UI + client `[n]` rendering polish (A3/§8);
verification (A4); cross-turn thread-stable numbering (deferred).
