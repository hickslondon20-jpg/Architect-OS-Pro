# Citations (Episode 7) — Sub-phase B1 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`. This session runs sub-phase **B1 only** (geometry-aware chunk
> resolver). Do **not** start B2. Do **not** apply the B0 migration to live Supabase.

---

You are the **execution agent** for Sub-phase B1 (Geometry Resolver) of the ArchitectOS Episode 7 (Citations)
build. You build against **decided design** — implementation choices only, never design choices. If something
needs a design decision beyond the inputs, **stop and flag it**.

You are in the `ArchitectOS Pro_beta` repo, canonical path `C:\Users\Hicks\ArchitectOS Pro_beta`.

**What B1 is, in one line:** extend the A2 `chunk_resolver` with a **geometry branch** — return
`locator.bbox` + `page_number` + the raw `verbatim` face for post-B0 chunks, and **fall back to A2's line-level
behavior** for pre-B0 / geometry-less chunks. Small, additive. No UI, no highlight rendering (that's B2).

---

## Orient first — read these in order, then build

1. `.planning/citations/phases/b1-geometry-resolver/RESEARCH.md` — **primary build source.** The A2 resolver
   shape with anchors (§1), the B0 columns + `bbox` contract (§2), the change (§3), downstream (§4), test
   posture (§5). **Re-verify anchors before editing.**
2. `.planning/citations/phases/b1-geometry-resolver/B1-01-PLAN.md` — task + criteria.
3. `.planning/citations/phases/b1-geometry-resolver/CONTEXT.md` — scope, decided decisions, file list, criteria.
4. `.planning/citations/CONTEXT.md` — locked ledger (**wins on conflict**): §3.1 DP6, §3.2 (Locator bbox),
   **§8 (B0 reconciliation — the `bbox` contract + the staged, not-applied migration)**.
5. `services/citations/resolvers/chunk_resolver.py` (the file you edit), `services/citations/models.py`.

Read 1–4 fully before writing a line.

---

## What you build — `services/citations/resolvers/chunk_resolver.py`

- **Extend the select** (`:18`) with `page_number, bbox, verbatim`.
- **Verbatim face:** `verbatim = chunk.verbatim or chunk.content` (post-B0 `content` is the enriched
  `serialize()` face; the raw face is the `verbatim` column; pre-B0 falls back to `content`).
- **Geometry branch:** when `page_number`/`bbox` are present → set `locator.page_number = chunk.page_number`,
  `locator.bbox = chunk.bbox` (**pass the B0 jsonb through as-is**: `{page_no,l,t,r,b,coord_origin,charspan,
  page_w,page_h}` + `multi_page`/`pages`), and `locator.kind = "bbox"`. When absent → keep A2's `lines`/`section`
  behavior unchanged.
- **Graceful fallback:** a pre-B0 / geometry-less chunk resolves exactly as A2 today — no error, no crash.
- **Tests** (`python-backend/tests/test_citations_geometry_resolver_b1.py`): post-B0 chunk → bbox/page_number/
  verbatim present; pre-B0 → line-level fallback; raw-vs-content verbatim selection; A3 payload back-compat.

---

## Hard constraints

- **Additive only** — the geometry branch populates previously-null `locator` fields; A3 must keep working.
- **Pass the `bbox` jsonb through as-is** — do not reshape it (B2 transforms it).
- **Graceful fallback** for pre-B0 / non-PDF chunks — no error on null geometry.
- **No B2/UI work**, no ingestion change (B0), no A3/sidecar change, no new retrieval.
- **Do NOT apply the B0 migration to live Supabase** — geometry columns are live only after the B-series
  session; use fixtures/mocks for tests (columns may not exist in your env).
- **CONTEXT wins** on conflict. If underspecified, stop and flag.

---

## Done when (B1 success criteria — CONTEXT §"Success criteria")

1. A B0-ingested chunk resolves with a valid page-space `bbox` + `page_number` + raw `verbatim`.
2. A pre-B0 / geometry-less chunk falls back to line-level cleanly (no error).
3. `verbatim` is the raw face when present, else `content`.
4. Payload backward-compatible with the A3 sidecar (additive only).
5. `compileall` 0; resolver tests green (fixtures for geometry + fallback).

**Report back:**
- One paragraph on what was built.
- How the geometry branch + verbatim raw-first selection work; the fallback behavior.
- Confirmation the payload is additive / A3 keeps working, and nothing was applied to shared Supabase.
- Any implementation choice deviating from/extending the design (for CONTEXT §8 reconciliation).
- Any flag needing London or a judgment call.

Then stop. Sub-phase B2 is opened from the strategy thread.
