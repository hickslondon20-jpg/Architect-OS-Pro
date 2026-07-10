# Sub-phase B1 Context — Geometry-aware Chunk Resolver (Ep7B)

**Date:** 2026-07-06
**Outcome:** Ready to execute. Additive extension of the A2 `chunk_resolver`; no open decisions. The execution
agent makes implementation choices only.

---

## What this sub-phase is

Extend the A2 `chunk_resolver` with a **geometry branch** — return `bbox` + `page_number` + the raw `verbatim`
face for post-B0 chunks, falling back to A2's line-level behavior for pre-B0 / geometry-less chunks. Feeds B2's
PDF highlight. Single deliverable: **B1-01** (see `B1-01-PLAN.md`).

---

## Inputs the agent must read first (in order)

1. `RESEARCH.md` (this folder) — **primary build source.** The A2 resolver shape with anchors (§1), the B0
   columns + `bbox` contract (§2), the change (§3), downstream (§4), test posture (§5).
2. `B1-01-PLAN.md` (this folder) — task + criteria.
3. `../../CONTEXT.md` — locked ledger. §3.1 DP6, §3.2 (Locator bbox), **§8 (B0 reconciliation — the `bbox`
   contract + staged migration)**. **CONTEXT wins on conflict.**
4. `services/citations/resolvers/chunk_resolver.py` (A2 — the file B1 edits), `services/citations/models.py`
   (`Locator` already has `page_number`/`bbox`).

---

## Decisions already made (do not re-open)

- **Additive geometry branch** — populate `locator.page_number`/`bbox` + `kind:"bbox"` when present; A2
  line/section behavior otherwise.
- **Verbatim = raw face** — `chunk.verbatim or chunk.content` (raw preferred; content fallback pre-B0).
- **Pass the B0 `bbox` jsonb through as-is** — B2 does the canvas transform.
- **Graceful fallback** — pre-B0 chunks resolve exactly as A2; no error.
- **No A3 change** — the sidecar ignores `bbox` until B2; payload change is additive/backward-compatible.
- **Geometry columns are live only after the B-series migration** — tests use fixtures until then.

---

## What this sub-phase does NOT do

- No PDF canvas highlight (B2); no ingestion change (B0); no A3/sidecar change.
- No live-Supabase apply (B0 migration is B-series-gated); no new retrieval.

---

## Files to create or modify

| File | Action | Notes |
|---|---|---|
| `python-backend/services/citations/resolvers/chunk_resolver.py` | Modify | Extend select with `page_number,bbox,verbatim`; geometry branch; verbatim = raw-first; fallback line-level. |
| `python-backend/tests/test_citations_geometry_resolver_b1.py` | Create | Post-B0 chunk → bbox/page_number/verbatim; pre-B0 → line-level fallback; raw-vs-content verbatim; A3 back-compat. |

---

## Success criteria (B1-01)

1. A B0-ingested chunk resolves with a valid page-space `bbox` + `page_number` + raw `verbatim`.
2. A pre-B0 / geometry-less chunk falls back to line-level cleanly (no error).
3. `verbatim` is the raw face when present, else `content`.
4. Payload backward-compatible with the A3 sidecar (additive only).
5. `compileall` 0; resolver tests green (fixtures for geometry + fallback).

---

## Handoff

When the geometry branch resolves post-B0 chunks and falls back cleanly, the strategy thread logs a B1
completion amendment in `../../CONTEXT.md §8`, then opens **sub-phase B2 (PDF highlight rendering)** — the
frontend canvas highlight consuming `locator.bbox`.

*Context written: 2026-07-06 — Ep7 citations planning thread, at B1 sub-phase entry.*
