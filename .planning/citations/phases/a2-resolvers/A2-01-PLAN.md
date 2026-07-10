# Plan A2-01 — Four resolver families (chunk / wiki_page / platform_record / web)

**Sub-phase:** A2 — Resolvers
**Plan:** 1 of 1
**Depends on:** A0 (currency)
**Status:** Ready for execution — **O1 + O2 resolved** (CONTEXT §8, 2026-07-06); read-paths pinned.
**Decisions:** `../../CONTEXT.md` §3.1 DP3/DP5, §4 O1 (trace-only) / O2 (web dark), §5 F3 · **Ref:** `../../REFERENCES.md` C-11/C-13/C-15/C-7

---

## Goal

Turn a `CitationRef` into a **renderable source view** — one resolver per tiered family. Non-geometry (chunk
resolver is line-level here; bbox geometry is Ep7B/B1). Each resolver **lights up as its source reaches an
answer (DP5); un-surfaced tiers return cleanly, never fabricate.**

## Decided (do not re-open)
- **O1 — trace-only:** resolvers exist for the **four knowledge-tier families only**. A `derived` `source_kind`
  is **not** resolvable to a source view — the endpoint returns a typed `not_citable`/trace result; A3 renders
  it in the activity trace, not as a chip.
- **O2 — web dark:** build `web_resolver` (snapshot-shaped) but it returns a typed "no producer / dark" result
  until a web tool + snapshot store land (`WebSearchService` exists but is not a registered citable tool).

## Pre-Execution Checks
1. Read `RESEARCH.md` (this folder) — the pinned read-path for each resolver + the endpoint pattern.
2. Re-verify anchors: `agent_context.py:204–210` (chunk fetch), `wiki_read.py:31/50`, `doc_wiki_read_service.py:100`,
   `structured_query.py:86` (safe-surface allow-list), `main.py` doc-wiki read endpoints (`require_ingest_secret`).

## Build — `python-backend/services/citations/resolvers/`
- **`chunk_resolver`** — `document_chunk` → owner-scoped `document_chunks` select by id; returns `verbatim`
  (= `content`) + `locator.lines`/`section` from metadata; **no geometry** (Ep7B fallback face). Doc-level
  title/meta via `ose_raw_document_registry`.
- **`wiki_resolver`** — `wiki_page` family → Tier 1 `WikiReadService.get_page`/`get_claim` (page prose / claim +
  `evidence`) and Tier 2 `DocWikiReadService.get_page` (by `canonical_key`/`page_id`); resolves to page/claim.
- **`platform_record_resolver`** — DP3 **typed-renderer registry keyed by table**: direct owner-scoped read
  (`.eq("user_id",…).eq("id", row_id)`) for MRA / AE Ladder / sprint / Quarter Map / Clarity Compass /
  Reflection Review → read-only view (label + field table + deep-link). No LLM, no agent SQL; use
  `StructuredQueryService`'s safe-surface allow-list to bound which tables are readable.
- **`web_resolver`** — snapshot view shape; **dark** (typed "no producer") per O2.
- **`POST /api/citations/resolve`** (FastAPI, owner-scoped; mirror the `main.py` doc-wiki read endpoints +
  auth dependency) → rendered source view for a `CitationRef`. `derived` kind → typed `not_citable` (O1).

## Surface manifestation
Backend resolve endpoint the A3 sidecar calls. Tier 0 typed views are the net-new render (no reference analog).

## Success criteria
1. Each **lit** family resolves a real ref to a viewable payload (chunk verbatim+lines; wiki prose/claim+evidence;
   Tier 0 field table + deep-link).
2. `derived` refs return a typed `not_citable`/trace result (O1); `web` returns typed "dark" (O2).
3. Unresolvable refs return a typed error — never a fabricated source.
4. Endpoint is owner-scoped (rejects cross-user refs); platform reads bounded to the safe-surface allow-list.
5. `python -m compileall python-backend` exits 0; resolver tests green.

## Out of scope
Chip/sidecar UI (A3); verification (A4); PDF bbox geometry (Ep7B B1/B2); any new web producer tool.
