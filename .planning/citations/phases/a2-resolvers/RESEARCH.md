# A2 RESEARCH — Resolver read-paths (extraction)

**Extraction target:** the live read services each resolver reuses. A2 does **not** add retrieval — it turns
a `CitationRef` into a renderable view by reading the source through existing paths. **Re-verify anchors
before editing — they drift.** Verified 2026-07-06. All paths under `python-backend/`.

---

## §1 chunk_resolver — `document_chunk` (Tier 2/3, no geometry in A2)

Fetch a chunk by id, owner-scoped (pattern `services/agent_context.py:204–210`):

```python
self.store.client.table("document_chunks")
    .select("id,user_id,document_id,chunk_index,content,metadata")
    .eq("user_id", user_id).in_("id", chunk_ids).execute()
```

- `content` → `verbatim`. `metadata` → document title / `section_label` when present → `locator.lines`/`section`.
- Document-level label/meta: `ose_raw_document_registry` (id = `document_id`).
- Live producers that put chunks into an answer (so refs exist): the `kb_read` / `retrieve` native tools
  (`tool_registry.py:1005 _execute_kb_read`, `source_kind` `raw_document`/`document_chunk`) and
  `services/retrieval.py` `RetrievalService.hybrid_search` (RPC `match_document_chunks`).
- **No geometry here.** `locator.bbox`/`page_number` stay null; Ep7B/B1 adds the geometry branch.

## §2 wiki_resolver — `wiki_page` family (Tier 1 + Tier 2)

- **Tier 1** — `services/wiki_read.py` `WikiReadService`: `get_page(user_id, page_key)` (`:31`),
  `get_claim(user_id, claim_id)` (`:50`, returns the claim + `evidence[]`), `search(...)` (`:62`). Returns
  `agent_result_v1`. Use `get_claim` when the ref is a `wiki_claim` (source_id = claim id); `get_page` when
  `page_key` is in `source_metadata`.
- **Tier 2** — `services/doc_wiki_read_service.py` `DocWikiReadService.get_page(user_id, canonical_key=…, page_id=…)`
  (`:100`) → page prose + `source_file_ids`. The ref's `source_id` is the `canonical_key` (per A0
  `from_docwiki_citation`).
- Render: page/claim prose + evidence; resolves to the page/claim (no geometry).

## §3 platform_record_resolver — `platform_record` (Tier 0, typed, no LLM)

**DP3 typed-renderer registry keyed by table.** The ref carries `locator.record_path` like
`mra_checkpoints/{row_id}/{field?}` (see `tests/test_citations_binding_a1.py:30`:
`"record_path": "mra_checkpoints/checkpoint-1/stage_assessment"`). Each renderer does a **direct owner-scoped
read**:

```python
self.client.table(<table>).select(<cols>).eq("user_id", user_id).eq("id", row_id).maybe_single().execute()
```

- Tables to cover (Tier 0, per architecture §3): MRA checkpoints/stage assessments, AE Ladder scores, sprint
  goals/initiatives/milestones (`sp_sprint_*`), Quarter Map priorities, Clarity Compass answers, Reflection Review.
- **Safe-surface bound:** `services/structured_query.py:86` `StructuredQueryService` validates reads against a
  **surface/column allow-list** (`_execute_validated` reads `validated["surface"]` scoped by `user_id`). Reuse
  its allow-list to bound which tables/columns the resolver may read — but the resolver uses **fixed typed
  reads**, not agent-generated SQL.
- Render: label + field table + a deep-link to the live platform surface. No geometry, no model call.

## §4 web_resolver — `web` (DARK per O2)

`services/web_search.py:28` `WebSearchService.search(query, ...)` exists **as a service**, but a grep of
`tool_registry.py` finds **no registered web tool** — so no `web` ref reaches an answer today. Build the
resolver in the snapshot shape (point-in-time capture, highlightable) but return a **typed "no producer / dark"**
result until a web tool + snapshot store are wired. Do not build the producer or snapshot store in A2.

## §5 derived kinds — NOT resolvable (O1 trace-only)

`derived` (computation, skill_file, mcp, sub_agent_run, workspace_file, agent_todos, human_input, tool_registry,
skill_pack) have **no resolver**. `POST /api/citations/resolve` returns a typed `not_citable` (or `trace`) result
for a `derived` `source_kind`; A3 renders these in the activity trace, never as chips.

## §6 The endpoint

`POST /api/citations/resolve` — mirror the existing FastAPI read endpoints in `main.py` (the doc-wiki read
routes: `POST /api/doc-wiki/search`, `GET /api/doc-wiki/page/...`) and their auth dependency (`require_ingest_secret`).
Owner-scoped: reject a ref whose owner ≠ caller. Input: a `CitationRef` (or its id + turn ref). Output: a
family-tagged rendered source view (`chunk` / `wiki` / `platform_record` / `web_dark` / `not_citable`).

## §7 Dispatch by family

Resolver dispatch keys on `CitationRef.source_kind` (the **family**, per A0). The **raw** kind
(`source_metadata.raw_source_kind`) disambiguates within a family (e.g. `wiki_claim` vs `wiki_page` →
`get_claim` vs `get_page`; `raw_document` vs `document_chunk`). Never fabricate: a ref that can't be read
returns a typed error, not invented content.
