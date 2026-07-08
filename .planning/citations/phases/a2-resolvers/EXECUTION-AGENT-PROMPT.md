# Citations (Episode 7) — Sub-phase A2 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`. This session runs sub-phase **A2 only** (resolvers). Do **not** start A3.

---

You are the **execution agent** for Sub-phase A2 (Resolvers) of the ArchitectOS Episode 7 (Citations & Source
Grounding) build. You build against **decided design** — implementation choices only, never design choices.
**O1 and O2 are already resolved** — do not re-open them. If something needs a design decision beyond the
inputs, **stop and flag it**.

You are in the `ArchitectOS Pro_beta` repo, canonical path `C:\Users\Hicks\ArchitectOS Pro_beta`. All paths
below are relative to that root.

**What A2 is, in one line:** turn a `CitationRef` into a **renderable source view** — one resolver per
knowledge-tier family — plus `POST /api/citations/resolve`. Read existing sources through existing read paths;
add **no** retrieval, no UI, no verification, no geometry.

---

## Orient first — read these in order, then build

1. `.planning/citations/phases/a2-resolvers/RESEARCH.md` — **primary build source.** The pinned read-path per
   resolver (§1 chunk, §2 wiki, §3 platform record), web-dark (§4), derived-not-resolvable (§5), the endpoint
   (§6), family dispatch (§7). **Re-verify every line anchor before editing — they drift.**
2. `.planning/citations/phases/a2-resolvers/A2-01-PLAN.md` — task + decided O1/O2 + criteria.
3. `.planning/citations/phases/a2-resolvers/CONTEXT.md` — scope, decided decisions, file list, criteria.
4. `.planning/citations/CONTEXT.md` — locked ledger (**wins on conflict**): §3.1 DP3/DP5, §4 O1/O2 (resolved),
   §5 F3, §8 amendments (A2 entry).
5. `python-backend/services/citations/models.py` — the `CitationRef` + family the resolvers dispatch on.
6. Live read services: `wiki_read.py`, `doc_wiki_read_service.py`, `structured_query.py`, `retrieval.py`,
   `agent_context.py` (chunk-fetch pattern `:204–210`), `main.py` (endpoint + `require_ingest_secret` pattern).

Read 1–4 fully before writing a line.

---

## Decided (do not re-open)

- **O1 — trace-only.** Build resolvers for the **four knowledge-tier families only** (`document_chunk`,
  `wiki_page`, `platform_record`, `web`). A `derived` `source_kind` has **no resolver**; the endpoint returns a
  typed `not_citable` result for it. (Derived refs render in the A3 activity trace, not as chips.)
- **O2 — web dark.** Build `web_resolver` in the snapshot shape, but it returns a typed **"no producer / dark"**
  result. A `WebSearchService` exists (`services/web_search.py`) but is **not** a registered citable tool — do
  **not** wire a web producer or snapshot store in A2.

---

## What you build — `python-backend/services/citations/resolvers/`

- **`chunk_resolver.py`** — `document_chunk`: owner-scoped `document_chunks` select by id (RESEARCH §1);
  return `verbatim` (= `content`) + `locator.lines`/`section` from `metadata`; doc title/meta from
  `ose_raw_document_registry`. **No geometry** (`bbox`/`page_number` stay null — Ep7B adds them).
- **`wiki_resolver.py`** — `wiki_page` family: Tier 1 `WikiReadService.get_page(page_key)` /
  `get_claim(claim_id)` (claim + `evidence`), Tier 2 `DocWikiReadService.get_page(canonical_key|page_id)`.
  Pick by `raw_source_kind` (`wiki_claim`→`get_claim`, else page).
- **`platform_record_resolver.py`** — DP3 **typed-renderer registry keyed by table**: direct owner-scoped read
  (`.eq("user_id",…).eq("id", row_id)`) for MRA / AE Ladder / sprint (`sp_sprint_*`) / Quarter Map / Clarity
  Compass / Reflection Review → label + field table + deep-link. **No LLM, no agent SQL.** Bound readable
  tables/columns by `StructuredQueryService`'s safe-surface allow-list (`structured_query.py`).
- **`web_resolver.py`** — snapshot-shaped; returns typed "dark" (O2).
- **`__init__.py`** — `resolve(ref) -> view` dispatching on `CitationRef.source_kind` (family); `derived` →
  typed `not_citable`.
- **`python-backend/main.py`** — `POST /api/citations/resolve`, owner-scoped, mirroring the doc-wiki read
  endpoints + `require_ingest_secret`. Output: a family-tagged view (`chunk`/`wiki`/`platform_record`/`web_dark`/`not_citable`).
- **`python-backend/tests/test_citations_resolvers_a2.py`** — per-family resolve; `derived`→not_citable;
  `web`→dark; unauthorized + unresolvable → typed error (never fabricated content).

---

## Hard constraints

- **Do not re-open O1/O2.** Four resolvers; derived = not_citable; web = dark.
- **No new retrieval.** Resolvers read known ids/keys through existing paths; they do not search or embed.
- **Never fabricate.** Unresolvable/unauthorized → typed error, not invented content.
- **Owner-scoped everywhere.** Reject a ref whose owner ≠ caller. Platform reads bounded to the safe-surface allow-list.
- **No LLM in the platform-record resolver** — deterministic typed reads only.
- **No UI, no verification, no geometry, no web producer/snapshot store, no `derived` resolver.**
- **CONTEXT wins** on conflict. If underspecified, stop and flag.

---

## Done when (A2 success criteria — CONTEXT §"Success criteria")

1. Each lit family resolves a real ref to a viewable payload (chunk verbatim+lines; wiki prose/claim+evidence;
   Tier 0 field table + deep-link).
2. `derived` → typed `not_citable`/trace (O1); `web` → typed "dark" (O2).
3. Unresolvable refs return a typed error — never fabricated content.
4. Endpoint owner-scoped; platform reads bounded to the safe-surface allow-list.
5. `python -m compileall python-backend` exits 0; resolver tests green.

**Report back:**
- One paragraph on what was built.
- The resolve endpoint's view shapes per family; the platform-record table registry (which tables you covered).
- Confirmation `derived`→not_citable and `web`→dark are wired.
- Any implementation choice deviating from/extending the design (for CONTEXT §8 reconciliation).
- Any flag needing London or a judgment call (e.g. a Tier 0 table whose safe-surface read isn't obvious).

Then stop. Sub-phase A3 is opened from the strategy thread.
