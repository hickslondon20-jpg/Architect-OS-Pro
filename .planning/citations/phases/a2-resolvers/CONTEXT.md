# Sub-phase A2 Context — Resolvers (four tiered families)

**Date:** 2026-07-06
**Outcome:** Ready to execute. **O1 + O2 resolved** (`../../CONTEXT.md §8`, 2026-07-06); resolver read-paths
pinned in `RESEARCH.md`. The execution agent makes implementation choices only, not design choices.

---

## What this sub-phase is

Turns a `CitationRef` into a **renderable source view** — one resolver per knowledge-tier family, plus the
`POST /api/citations/resolve` endpoint the A3 sidecar calls. A2 reads existing sources through existing paths;
it adds **no retrieval** and no UI. Single deliverable: **A2-01** (see `A2-01-PLAN.md`).

---

## Inputs the agent must read first (in order)

1. `RESEARCH.md` (this folder) — **primary build source.** Per-resolver read-path with anchors (§1–§3),
   web-dark (§4), derived-not-resolvable (§5), the endpoint (§6), family dispatch (§7).
2. `A2-01-PLAN.md` (this folder) — task + decided O1/O2 + criteria.
3. `../../CONTEXT.md` — locked ledger. §3.1 DP3 (Tier 0 typed renderer) / DP5 (light-up-as-surfaced), §4 O1/O2
   (resolved), §5 F3, §8 amendments (A2 entry). **CONTEXT wins on conflict.**
4. `python-backend/services/citations/models.py` — the `CitationRef` / family the resolvers dispatch on.
5. The live read services: `wiki_read.py`, `doc_wiki_read_service.py`, `structured_query.py`, `retrieval.py`,
   `agent_context.py` (chunk-fetch pattern), and `main.py` (endpoint + auth pattern).

---

## Decisions already made (do not re-open)

- **Four resolvers only** — `document_chunk`, `wiki_page`, `platform_record`, `web`. **`derived` has no
  resolver** (O1 trace-only); the endpoint returns typed `not_citable` for it.
- **`web` ships dark** (O2) — snapshot-shaped resolver returning typed "no producer" until a web tool lands.
- **Tier 0 = direct typed reads** keyed by table (DP3), bounded by `StructuredQueryService`'s safe-surface
  allow-list. No LLM, no agent-generated SQL.
- **chunk resolver is line-level only** — no geometry (Ep7B/B1 adds `bbox`/`page_number`).
- **Never fabricate** — unresolvable/unauthorized refs return typed errors.
- **Dispatch on the family** (`source_kind`); disambiguate within a family via `source_metadata.raw_source_kind`.

---

## What this sub-phase does NOT do

- No chip/sidecar UI (A3); the endpoint returns data, not rendered HTML.
- No verification (A4); no artifact surface (A5); no geometry (Ep7B).
- No new retrieval, no new web producer/snapshot store, no `derived` resolver.
- No producer rewrites; no changes to the wiki/dataset read services beyond calling them.

---

## Files to create or modify

| File | Action | Notes |
|---|---|---|
| `python-backend/services/citations/resolvers/__init__.py` | Create | Family dispatch (`resolve(ref) -> view`). |
| `.../resolvers/chunk_resolver.py` | Create | `document_chunks` select by id; verbatim + lines; no geometry. |
| `.../resolvers/wiki_resolver.py` | Create | Tier 1 `WikiReadService.get_page`/`get_claim` + Tier 2 `DocWikiReadService.get_page`. |
| `.../resolvers/platform_record_resolver.py` | Create | Typed-renderer registry keyed by table; safe-surface bound. |
| `.../resolvers/web_resolver.py` | Create | Snapshot-shaped; returns typed "dark". |
| `python-backend/main.py` | Modify | `POST /api/citations/resolve` mirroring doc-wiki read endpoints + `require_ingest_secret`. |
| `python-backend/tests/test_citations_resolvers_a2.py` | Create | Per-family resolve; derived→not_citable; web→dark; unauthorized/unresolvable→typed error. |

---

## Success criteria (A2-01)

1. Each lit family resolves a real ref to a viewable payload (chunk verbatim+lines; wiki prose/claim+evidence;
   Tier 0 field table + deep-link).
2. `derived` → typed `not_citable`/trace (O1); `web` → typed "dark" (O2).
3. Unresolvable refs return a typed error — never fabricated content.
4. Endpoint owner-scoped (rejects cross-user); platform reads bounded to the safe-surface allow-list.
5. `python -m compileall python-backend` exits 0; resolver tests green.

---

## Handoff

When the four resolvers + endpoint land with green tests, the strategy thread logs an A2 completion amendment
in `../../CONTEXT.md §8`, then opens **sub-phase A3 (VCSO citation UX)** — chips + sidecar + jump-to-evidence,
functional, consuming the A1 stream + this resolve endpoint (visual polish deferred to §8).

*Context written: 2026-07-06 — Ep7 citations planning thread, at A2 sub-phase entry (O1 + O2 resolved).*
