# A0 RESEARCH — Exact live producer shapes (extraction)

**Extraction target:** the ArchitectOS codebase itself (not a reference repo). This pins the exact current
field shapes + file:line anchors of every source-ref producer A0 normalizes, so the execution agent writes
adapters against reality, not against the summary in CONTEXT §2. **Re-verify each anchor before writing its
adapter** — line numbers drift.

All paths relative to `python-backend/services/` unless noted. Verified 2026-07-06.

---

## §1 The canonical target — `AgentSourceRef`

`agent_context.py:18–24`

```python
@dataclass(frozen=True)
class AgentSourceRef:
    source_kind: str
    source_id: str | None
    source_label: str | None = None
    source_metadata: dict[str, Any] = field(default_factory=dict)
    citation_payload: dict[str, Any] = field(default_factory=dict)   # ← pre-existing hook, currently unpopulated
```

**Emitted with these `source_kind` values** (`agent_context.py` `AgentContextBuilder.build`, ~lines 72–149):
`raw_document`, `document_chunk`, `founder_dataset`, `wiki_page`, `wiki_claim`, `global_ip_page`,
`global_checkpoint`. Also `wiki_digest` (via `wiki_read.py`, see §5).

**Design note:** `citation_payload` is the extension carrier. Make `verbatim`/`locator` first-class on
`CitationRef`; serialize into `citation_payload` when a ref traverses `AgentSourceRef`-typed paths. Do **not**
mutate this frozen dataclass (F1).

---

## §2 Ep5 registry — `ToolSourceRef`

`tool_registry.py:23–42`

```python
@dataclass(frozen=True)
class ToolSourceRef:
    source_kind: str
    source_id: str | None
    verbatim: str | None = None
    label: str | None = None            # ← maps to CitationRef.source_label
    metadata: dict[str, Any] = field(default_factory=dict)   # ← maps to CitationRef.source_metadata
    def to_dict(self) -> dict[str, Any]: ...  # drops None verbatim/label/empty metadata
```

**`source_kind` values emitted** (grep `ToolSourceRef(` + tool `citation=` tags): `raw_document`,
`wiki_page`, `computation`, `skill_file`, `skill_pack`, `sub_agent_run`, `workspace_file`, `agent_todos`,
`human_input`, `mcp`, `tool_registry`. Envelope: `ToolResultEnvelope{content, sources[], provenance}`
(`tool_registry.py:45–58`). Field-name deltas vs. `AgentSourceRef`: `label`→`source_label`,
`metadata`→`source_metadata`; **`verbatim` is the field `AgentSourceRef` lacks.**

---

## §3 Tier 2 docwiki read citations (dict, not a class)

`doc_wiki_read_service.py` — `search()` lines 79–88, `get_page()` lines 151–158.

```python
# search():
{ "source_kind": "wiki_page", "canonical_key": f["canonical_key"], "title": f["title"],
  "page_kind": f["page_kind"], "similarity": f["similarity"] }
# get_page():
{ "source_kind": "wiki_page", "canonical_key": row["canonical_key"], "title": title,
  "page_kind": row["page_kind"] }
```

**Least conformant:** no `source_id` (keyed on `canonical_key`), no `verbatim`. Adapter
`from_docwiki_citation`: `source_id=canonical_key`, `source_label=title`, metadata `{page_kind, similarity}`.
Returned inside `agent_result_v1` under `citations` (whole shape: `doc_wiki_read_service.py:89–98`).

---

## §4 Tier 1 claim evidence — `wiki_evidence`

`wiki_read.py:163–168` (`_format_evidence`); sourced from the DB join
`wiki_evidence(source_id,source_kind,path,lines,weight,note)` (`wiki_read.py:126`).

```python
{ "source_id": ..., "source_kind": ..., "path": ..., "lines": ..., "weight": ..., "note": ... }
```

**`source_kind` enum (contract `wiki-1.0` §evidence):** `raw_document | document_chunk | tier0_record |
global_checkpoint`. **Carries `path` + `lines`** → the model for `Locator{path, lines}`. Adapter
`from_wiki_evidence`: `locator.lines`/`path`, metadata `{weight, note}`, `raw_source_kind` preserved
(esp. `tier0_record`→`platform_record`).

---

## §5 Tier 1 read source-refs — `AgentSourceRef` reused

`wiki_read.py` builds `AgentSourceRef` directly: `wiki_digest` (line ~93), `wiki_claim` via
`_sources_for_claims` (lines 200–216, `source_kind="wiki_claim"`, `source_label=claim.text`). So Tier 1
reads already emit the canonical shape — adapter path is `from_agent_source_ref` (near-identity).

---

## §6 Retrieval chunks — `RetrievedChunk`

`retrieval.py:13–27`

```python
@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: str; document_id: str; content: str; metadata: dict
    vector_similarity: float; keyword_rank: float; hybrid_score: float
    source_kind: str = "raw_document_chunk"        # ← taxonomy drift: normalize → document_chunk (F2)
    vector_rank: int | None = None; keyword_rank_position: int | None = None
    rrf_score: float | None = None; rerank_score: float | None = None
    retrieval_stage: str = "rrf_fused"
```

`hybrid_search()` returns `list[RetrievedChunk]` (`retrieval.py:38–92`). Adapter `from_retrieved_chunk`:
`source_id=chunk_id`, `content`→`verbatim`, metadata `{document_id, similarity/scores, document_title from metadata}`,
`raw_source_kind="raw_document_chunk"`→family `document_chunk`. NB: chunks reach answers today via the
`kb_read`/`retrieve` tools, which wrap into `ToolSourceRef(source_kind="raw_document", ...)`
(`tool_registry.py:1018–1024`) — so the chunk may arrive via §2's path too; the adapter must handle both.

---

## §7 Tier 2 inline citation marker (string in page prose)

Contract `doc-wiki-1.0` §Provenance (`../../../document-wiki/phases/02-page-contract-schema/02-01-CONTRACT.md:125–133`):

```
[[Source: raw_document:{document_id}#chunk:{chunk_id}|{doc_title} section {section_label}]]
```

`#chunk:{chunk_id}` omitted when unavailable. Parser `parse_inline_source_marker`: family `document_chunk`,
`source_id = chunk_id or document_id`, `source_label = "{doc_title} section {section_label}"`, metadata
`{document_id}`. Handle both the chunk-present and chunk-absent forms.

---

## §8 VCSO stream refs (display dicts) — divergent axis

`vcso_chat_service.py:168–181`

```python
[ {"kind": "wiki", "label": page.get("page_title"), "pageId": page.get("id")},
  {"kind": "platform", "label": key.replace("_", " ")},
  {"kind": "ip", "label": skill.get("name") or skill.get("slug")},
  {"kind": "context", "label": f"linked: {payload.linked_folder}"} ]
```

**Uses `kind`, not `source_kind`; display taxonomy `wiki/platform/ip/context`.** Adapter
`from_vcso_stream_ref`: `wiki→wiki_page` (`source_id=pageId`), `platform→platform_record`,
`ip→wiki_page`/`global_ip`, `context→derived`. **A1 replaces this emission** with `CitationRef` events (F4);
the adapter exists for transition/back-compat.

---

## §9 Ep6 provenance — `domain_agent_artifact_provenance_v1`

`artifact_service.py:331–364` aggregates `tasks.step_results[n].source_refs` into
`artifacts.provenance.source_refs`. Upstream, `harness_engine.py:413` sets `source_refs=result.citations`
(the sub-agent orchestrator's citations, i.e. `AgentSourceRef` dicts). So provenance `source_refs` are
**already CitationRef-adjacent dicts** — adapter `from_provenance_ref` is a normalize/pass-through. Confirm
whether any legacy rows predate a stable shape (A5 read-time normalize covers those).

---

## §10 The two frozen contract citation surfaces (do not mutate — F1)

- **`wiki-1.0`** — `../../../wiki-system/phases/02-interface-contract/02-01-CONTRACT.md`: `evidence` shape
  (§4 above), `AgentSourceRef[]` on all read tools, `allowed_source_kinds` list (adds `wiki_page`,
  `wiki_claim`, `wiki_evidence`, `wiki_digest`, `global_ip_page`, `global_checkpoint`).
- **`doc-wiki-1.0`** — `../../../document-wiki/phases/02-page-contract-schema/02-01-CONTRACT.md`:
  `agent_result_v1` return with `citations: AgentSourceRef[]`, inline marker (§7 above).

A0-01 appends a `citation-1.0` **additive amendment note** to both — new optional fields only, no in-place edit.

---

## §11 Union taxonomy → family map (must be exhaustive — F2)

| raw `source_kind` | family | notes |
|---|---|---|
| raw_document, document_chunk, raw_document_chunk | `document_chunk` | Ep7B geometry target |
| wiki_page, wiki_claim, wiki_digest, global_ip_page | `wiki_page` | Tier 1 |
| tier0_record, founder_dataset, dataset_row, global_checkpoint | `platform_record` | Tier 0 typed renderer |
| web | `web` | dark until producer (F3/O2) |
| computation, skill_file, skill_pack, sub_agent_run, workspace_file, agent_todos, human_input, mcp, tool_registry | `derived` | non-tier; render per O1 |

Unknown/unlisted raw kind → `derived` + warning log; **never dropped**; `raw_source_kind` always preserved.
