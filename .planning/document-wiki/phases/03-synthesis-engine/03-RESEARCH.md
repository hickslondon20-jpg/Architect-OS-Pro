# Sub-phase 03 — Reference Extraction (build-ready)

**Purpose:** turns `REFERENCES.md` pointers L2-2/L2-3/L2-10 and the KB Explorer/Layer-1 patterns
into decided, build-ready design for the synthesis engine framework (03-01) and document adapter
(03-02). The execution agent implements from this file — it does not re-interpret theafh repos or
OpenClaw directly.

**Sources grounded against:**
- `../../REFERENCES.md` (L2-2 ingest op, L2-3 thresholds, L2-10 executive_summary)
- `../../CONTEXT.md` (automated/flag-don't-resolve, prose model, multi-source, corrections)
- `../02-page-contract-schema/02-01-CONTRACT.md` (the page object + hard guarantees)
- `../01-verify-delta/01-01-DELTA.md` §E (ingest gap), §G (KB Explorer)
- `python-backend/main.py` `_process_ingestion()` — the document trigger point
- `python-backend/services/wiki_compilation.py` — Layer 1 compile pattern (mirror service-role/
  transaction discipline)
- `python-backend/services/kb_explorer_service.py` — KB Explorer tool loop (mirror for evidence)
- `python-backend/services/vector_store.py` — service-role Supabase client; `store_full_markdown`,
  `mark_ingested`

**What sub-phase 03 builds:** the source-agnostic `DocWikiSynthesisService.synthesize()` loop
(03-01) + the document adapter that triggers from the ingest pipeline (03-02). No other adapters
yet (04), no embeddings (05), no corrections lifecycle (06).

---

## 1. L2-2 — The synthesis loop (source-agnostic core)

**theafh model (concept only — adopt the loop, adapt the mechanics):**
> "The ingest operation reads the source, extracts topics/entities, writes or updates pages (often
> 10–15 pages touched per source), updates the index for each, links related pages, and logs the
> event. The human review step is the only part we skip."

**Our synthesis loop — `DocWikiSynthesisService.synthesize(source_payload) -> list[str]`:**

```
Given a SourcePayload (normalized by the adapter before calling synthesize):

1. PAGE-WORTHINESS GATE     — is this payload worth a page? (§3 thresholds)
                             → skip + log if not worthy

2. TOPIC DISCOVERY          — from the payload, identify the primary entity/topic
                               AND any secondary entities that warrant their own pages
                             → yields 1-N SynthesisTargets (each gets its own page)

3. FOR EACH SynthesisTarget:
   a. RESOLVE IDENTITY      — lookup (user_id, canonical_key) in ose_knowledge_pages
                             → existing page → UPDATE mode
                             → no match → CREATE mode

   b. PRE-SYNTHESIS CORRECTIONS — if UPDATE mode, read ose_page_corrections where
                                   page_id = existing.id AND status = 'pending'
                                   carry forward for overlay

   c. SYNTHESIZE PROSE      — Claude call via executive_summary primitive (§4)
                             → returns: page_title, page_kind, content (with citations),
                               confidence, suggested_links[]

   d. APPLY CORRECTIONS OVERLAY — if pre-synthesis corrections exist:
                                  inject corrections into final content as founder voice
                                  sections; mark corrections status='applied'

   e. FLAG CONTRADICTIONS   — scan existing pages for conflicting statements
                             → write ose_activity_log (kind='decision') for each flag
                             → never resolve; founder resolves

   f. WRITE PAGE            — upsert to ose_knowledge_pages (service-role):
                             set all metadata fields per contract §5
                             word_count = len(content.split())
                             synthesis_job_id = current job id
                             status = 'active', promotion_state = 'default'

   g. MAINTAIN MANIFEST     — update source_file_ids on the page
                              update connected_pages on the registry row(s)
                             (atomic within the same db call where possible)

   h. WRITE LINKS           — upsert ose_page_links for suggested_links[]
                             → 2+ links target; orphan if 0 links (health finding)

   i. WRITE ACTIVITY LOG    — ose_activity_log (kind='activity')
                              text = '[SYNTHESIS_COMPLETE] page_title | job_id'

4. RETURN page_ids[]
```

**Service signature:**

```python
class DocWikiSynthesisService:
    @classmethod
    def from_env(cls) -> "DocWikiSynthesisService": ...

    async def synthesize(
        self,
        user_id: str,
        source_payload: SourcePayload,
        synthesis_job_id: str | None = None,
    ) -> SynthesisResult:
        """
        Synthesize 1-N pages from a normalized SourcePayload.
        Returns SynthesisResult with page_ids[], event log ids[].
        """
```

**`SourcePayload` (adapter-produced, passed to synthesize):**

```python
@dataclass
class SourcePayload:
    user_id: str
    source_kind: str                # 'document' | 'sprint' | 'thread' | 'agent_artifact'
    source_id: str                  # registry id or thread id or sprint id
    source_title: str               # display name of the source
    full_text: str                  # full extracted text / markdown
    chunk_refs: list[ChunkRef]      # [(chunk_id, content, score)] for evidence citations
    metadata: dict[str, Any]        # source-specific metadata (file_type, dates, etc.)
    synthesis_job_id: str           # UUID assigned by the adapter before calling synthesize
```

**`SynthesisResult`:**

```python
@dataclass
class SynthesisResult:
    user_id: str
    synthesis_job_id: str
    page_ids: list[str]
    pages_created: int
    pages_updated: int
    pages_skipped: int
    log_event_ids: list[str]
    contradictions_flagged: int
```

---

## 2. The `DocWikiSynthesisService` — file and class conventions

**File:** `python-backend/services/doc_wiki_synthesis.py`

Mirror `wiki_compilation.py` conventions:
- `from_env()` classmethod constructing with `VectorStore.from_env()` + `get_settings()`
- Service-role Supabase client (service key, not user JWT)
- All DB writes inside try/except with fallback log-then-continue (don't crash the ingest pipeline)
- No direct Supabase RPC calls with anon key — use service role throughout

**Page write discipline:** mirrors Layer 1's compiled-base write-lock. The synthesis service is the
sole writer of `ose_knowledge_pages.content`. It does NOT call `wiki_compilation.py`; the two
services are parallel, not nested. Do NOT import or reuse any Layer 1 wiki service — they operate
on different tables.

---

## 3. L2-3 — Page-worthiness thresholds

**theafh model (concept only):**
> "Create a page when a concept/entity is central to the source or mentioned across 2+ sources.
> Skip passing mentions. Split when a page would exceed ~200 lines."

**Our thresholds (decided — bake into the page-worthiness gate):**

| Signal | Weight | Threshold |
|---|---|---|
| Entity/topic is the primary subject of the source (e.g. document title names it) | High | Always worthy |
| Entity/topic occupies ≥15% of the source text | Medium | Worthy |
| Entity/topic is mentioned across ≥2 existing pages in the wiki | Medium | Worthy (even if brief in the new source) |
| Entity/topic appears only in passing (1 mention, <5% of text) | Low | Skip |

**Split threshold:** if Claude's synthesis for a single topic would produce >3000 tokens (~1000
words) of prose, instruct Claude to split into a primary page + 1 sub-page. The sub-page gets its
own `canonical_key` suffixed with `_detail`. Link the two pages with `relation = 'derived_from'`.

**Implementation note:** the page-worthiness gate is a lightweight pre-filter. The primary check is
topic discovery (step 2 in §1): Claude identifies the primary entity AND secondary entities. The
gate rules above are applied per entity. Not worth a separate ML model — use heuristics + Claude
classification.

---

## 4. L2-10 — The `executive_summary` primitive (Claude call → page prose)

**theafh model (concept only):**
> "`executive_summary` generates the page as a structured prose summary with self-rating. Claude is
> called with the source content; it produces the summary + a confidence score representing how
> much reliable material it had to work with."

**Our implementation (decided — a structured Claude API call):**

This is the core intelligence call. The synthesis service calls Claude Sonnet via the Anthropic
SDK (the stack LLM — never OpenAI). One call per `SynthesisTarget`.

**Prompt structure (to be finalized by the execution agent within this spec):**

System prompt: establish the role (ArchitectOS knowledge synthesizer for agency founders), the
output schema, and the hard rules (inline citations, no hallucinated facts, self-rate confidence).

User prompt assembles:
```
# Source: {source_title}
{full_text or relevant excerpts}

# Existing wiki context (pages that may be related):
{compact index of existing pages for this user — titles + kinds only, not full content}

# Synthesis target:
Entity/topic: {target_entity}

# Instructions:
Produce a wiki page for this entity. Follow the output schema exactly.
```

**Output schema (structured JSON response from Claude):**

```json
{
  "page_title": "string — human-readable display name for this page",
  "page_kind": "string — one of the page_kind_vocabulary values",
  "canonical_key": "string — slug like 'client_acme' or 'method_architect_framework'",
  "content": "string — prose markdown with [[Source: raw_document:{doc_id}#{chunk_id}|title]] inline citations",
  "confidence": 0.85,
  "category": "string — one of the OSE category values",
  "domain": "string or null",
  "effective_date": "YYYY-MM-DD or null",
  "topics_mentioned": ["other entity names mentioned but not the primary target"],
  "suggested_links": ["canonical_key_1", "canonical_key_2"],
  "page_worthiness": "worthy | skip",
  "split_recommended": false
}
```

**The self-rating:** `confidence` is 0.0–1.0. Claude should rate lower when:
- The source had limited material about the entity
- The information may be stale or unverified
- The source contradicts something in existing wiki pages

**Inline citation discipline:** in `content`, every factual statement that comes from the source
should carry a `[[Source: raw_document:{doc_id}|{doc_title}]]` citation. When a specific chunk
supports the statement, use `[[Source: raw_document:{doc_id}#chunk:{chunk_id}|{doc_title}]]`.
The agent constructs the citation string from `SourcePayload.source_id` (for doc pages) and
`SourcePayload.chunk_refs`.

**Token budget:** keep the synthesis prompt under 20K tokens. For long documents, pass the most
relevant chunks (from `match_document_chunks` hybrid search on the target entity name) rather than
the full markdown.

**Model:** `claude-sonnet-4-5` (latest Sonnet — matches CLAUDE.md "Claude Sonnet (latest)").
Call via `anthropic.Anthropic()` client, using `settings.anthropic_api_key`. Do NOT use the
`openai` package (dead code per CLAUDE.md).

---

## 5. The document adapter trigger

**Where it hooks in:** `python-backend/main.py` `_process_ingestion()` function, after
`store.mark_ingested()` succeeds.

**Pattern (mirror the existing BackgroundTask pattern):**

The document adapter does not run synchronously inside `_process_ingestion`. The existing function
already runs as a `BackgroundTask`. After `mark_ingested()`, the adapter fires another async step:

```python
# Inside _process_ingestion(), after store.mark_ingested(...):
try:
    adapter = DocWikiDocumentAdapter.from_env()
    await adapter.synthesize_from_document(
        document_id=payload.document_id,
        user_id=payload.user_id,
        file_name=payload.file_name,
    )
except Exception as exc:
    # log but never crash the ingest pipeline
    store.mark_metadata_failed(payload.document_id, payload.user_id, f"[DOC_WIKI] {exc}")
```

Since `_process_ingestion` is a sync function called by `BackgroundTasks`, and we need async Claude
calls, the adapter must use `asyncio.run()` (or run the Claude call synchronously via the sync
Anthropic client). Mirror how `WikiCompilationService` handles this (it appears to be sync).
Check whether the existing services use sync or async Anthropic SDK and match the pattern.

**The document adapter class:**

```python
class DocWikiDocumentAdapter:
    """
    Reads a processed document from ose_raw_document_registry and
    synthesizes Layer 2 wiki pages via DocWikiSynthesisService.
    """
    @classmethod
    def from_env(cls) -> "DocWikiDocumentAdapter": ...

    def synthesize_from_document(
        self,
        document_id: str,
        user_id: str,
        file_name: str,
    ) -> SynthesisResult:
        """
        1. Read full_markdown and metadata from ose_raw_document_registry.
        2. Read top document chunks for citation evidence (match_document_chunks).
        3. Normalize into SourcePayload.
        4. Call DocWikiSynthesisService.synthesize().
        """
```

**Evidence reading strategy:**
- `full_markdown` → primary text for the Claude prompt (for docs under ~15K tokens)
- For longer docs: hybrid chunk retrieval via `match_document_chunks` per target entity,
  top 8 chunks, used as excerpts in the Claude prompt (the KB Explorer pattern)
- `chunk_refs` passed to synthesize: top chunks with `(chunk_id, content)` for citation building

---

## 6. Config loading in the Python backend

The `page_kind_vocabulary`, `kind_to_category`, `kind_to_page_type`, and `link_relation_vocabulary`
live in `src/config/doc_wiki_schema.json` (CONTEXT §8 amendment B).

The Python backend (in `python-backend/`) must load this file. Recommended approach:

```python
# python-backend/core/doc_wiki_config.py
import json
from pathlib import Path

_CONFIG_PATH = Path(__file__).parent.parent.parent / "src" / "config" / "doc_wiki_schema.json"

def get_doc_wiki_config() -> dict:
    with _CONFIG_PATH.open() as f:
        return json.load(f)
```

The synthesis service uses `get_doc_wiki_config()["page_kind_vocabulary"]` to validate the
`page_kind` Claude returns, and `kind_to_page_type` / `kind_to_category` to set the bridge fields.
If the returned `page_kind` is not in vocabulary, default to `entity`.

---

## 7. FastAPI endpoint (the async job trigger + status check)

Add two endpoints to `main.py` (or a `routers/doc_wiki.py` router):

```
POST /api/doc-wiki/synthesize-document
  body: { document_id, user_id }
  → fires DocWikiDocumentAdapter.synthesize_from_document() in BackgroundTask
  → returns { synthesis_job_id, status: "queued" }

GET /api/doc-wiki/job/{synthesis_job_id}
  → queries ose_activity_log for events with text matching synthesis_job_id
  → returns { synthesis_job_id, status, page_ids[], events[] }
```

Both protected by `require_ingest_secret` (same as `/api/ingest`). These are internal endpoints
called by n8n or the OS Engine on ingest completion — not the user browser.

The `_process_ingestion` call is the primary path (inline after `mark_ingested`). The explicit
endpoint is the secondary/manual trigger for re-synthesis.

---

## 8. Contradiction detection (lightweight v1)

**Rule:** after synthesizing a page for entity X, query `ose_knowledge_pages` for the user's
other pages and look for potential conflicts on the same entity. Lightweight v1: only flag when
the same `canonical_key` exists with significantly different `confidence` or content that Claude
flags as contradictory in the synthesis response.

The synthesis Claude call returns `topics_mentioned[]` — cross-check these against existing pages.
If a related page exists for a mentioned topic and the new content contradicts a key statement,
write to `ose_activity_log`:

```python
kind = 'decision',
text = f'[CONTRADICTION_FLAGGED] page:{new_page_id} may contradict page:{existing_page_id} | job:{synthesis_job_id}'
```

Do not resolve. Do not modify the existing page. Record only.

---

## 9. Corrections overlay (hook — full lifecycle is 06)

The synthesis service must check for pending corrections **before** calling Claude for an UPDATE
(not a CREATE). If `ose_page_corrections` has pending rows for this page:

1. Include them in the synthesis prompt as additional context: "The founder has noted the following
   corrections to the previous version of this page: {body}. Honor these corrections in the new
   version."
2. After writing the new page content, update `ose_page_corrections.status = 'applied'` for those
   rows.

This is the minimum hook needed so the Contract §J guarantee #2 is uphold from the first synthesis.
The full corrections lifecycle UI/health is sub-phase 06.

---

## 10. Hard rules for the execution agent

- **Never import `openai`** (dead code; CLAUDE.md rule). Use `anthropic.Anthropic()`.
- **Never write to `wiki_*` tables** (Layer 1). The synthesis service operates on
  `ose_knowledge_pages`, `ose_page_links`, `ose_page_corrections`, `ose_activity_log` only.
- **Service-role only** for writes. Never use the anon/user JWT key for `ose_knowledge_pages` writes.
- **Don't crash `_process_ingestion`**. The adapter is wrapped in try/except; exceptions are logged,
  not raised past the adapter boundary.
- **Don't build the CSO hook enhancement here**. The existing `api/vcso/chat.ts` hook is unchanged.
- **Don't build embeddings**. The `embedding` column exists; leave it null (05 populates it).
  Do wire the embedding hook (call into a not-yet-implemented `embed_page()` that the service skips
  gracefully if embedding service is unavailable).
- **Stub the embedding call** so 05 can wire in without modifying the synthesis core:
  ```python
  try:
      self._embedding_service.embed_page(page_id, content)
  except EmbeddingNotImplementedError:
      pass  # 05 implements this
  ```
- **`page_kind` validation:** if Claude returns a `page_kind` not in the vocabulary, default to
  `entity` and log a warning — never crash.
