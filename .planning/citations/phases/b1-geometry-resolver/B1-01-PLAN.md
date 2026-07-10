# Plan B1-01 — Geometry-aware chunk resolver + verbatim face

**Sub-phase:** B1 — Geometry resolver (Ep7B)
**Plan:** 1 of 1
**Depends on:** B0 (geometry columns + bbox contract), A2 (`chunk_resolver`)
**Status:** Ready for execution — additive extension; no open decisions.
**Decisions:** `../../CONTEXT.md` §3.1 DP6, §3.2 (Locator bbox), §8 (B0 bbox contract) · **Ref:** `../../REFERENCES.md` C-2/C-4

---

## Goal

Extend the A2 `chunk_resolver` with a **geometry branch**: return `locator.bbox` + `page_number` + the raw
`verbatim` face when a chunk has them (post-B0), and **fall back to A2's line-level behavior** when it doesn't
(pre-B0 / non-PDF chunks). Small, additive — the A2 payload already reserves `page_number`/`bbox` (currently null).

## Pre-Execution Checks
1. Read `RESEARCH.md` (this folder) — the A2 resolver shape (§1), the B0 columns + `bbox` contract (§2), the change (§3).
2. Confirm the B0 migration columns (`page_number`, `bbox`, `verbatim`) — **live only after the B-series apply**;
   until then, tests use fixtures/mocks (same posture as B0's deferred smoke).

## Build — `python-backend/services/citations/resolvers/chunk_resolver.py`
- **Extend the select** to include `page_number, bbox, verbatim` (`chunk_resolver.py:18`).
- **Verbatim face:** prefer the new `verbatim` column (raw `chunk.text`) over `content` (post-B0 `content` is the
  enriched `serialize()` face); fall back to `content` for pre-B0 chunks. So `verbatim = chunk.verbatim or chunk.content`.
- **Geometry branch:** when `page_number`/`bbox` are present, set `locator.page_number` + `locator.bbox` (pass the
  B0 jsonb through as-is: `{page_no,l,t,r,b,coord_origin,charspan,page_w,page_h}` + `multi_page`/`pages`) and
  `locator.kind = "bbox"`. When absent, keep A2's `lines`/`section` behavior (unchanged).
- **Graceful fallback:** a pre-B0 chunk resolves exactly as A2 today — no error, no null-geometry crash.

## Surface manifestation
`POST /api/citations/resolve` now returns geometry for post-B0 chunks (consumed by B2). **No A3 change** — the
sidecar keeps rendering line/section; B2 adds the PDF-canvas highlight from `locator.bbox`.

## Success criteria
1. A B0-ingested chunk resolves with a valid page-space `bbox` + `page_number` + raw `verbatim`.
2. A pre-B0 / geometry-less chunk falls back to line-level cleanly (no error).
3. `verbatim` is the raw face (verbatim column) when present, else `content`.
4. Payload is **backward-compatible** with the A3 sidecar (additive fields only).
5. `compileall` 0; resolver tests green (fixtures for the geometry + fallback cases).

## Out of scope
PDF canvas highlight rendering (B2); ingestion capture (B0); applying the B0 migration live (B-series session);
any A3 change.
