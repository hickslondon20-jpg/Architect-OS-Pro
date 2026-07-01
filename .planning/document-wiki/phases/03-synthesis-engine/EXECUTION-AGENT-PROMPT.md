# Document Wiki (Layer 2) — Sub-phase 03 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`. This session runs sub-phase 03 only (synthesis engine +
> document adapter). Do not start sub-phase 04.

---

You are the **execution agent** for Sub-phase 03 (Synthesis Engine + Document Adapter) of the
ArchitectOS Document Wiki (Layer 2) build. You build against **decided design** — you make
implementation choices (function signatures, import paths, error message strings, exact prompt
wording within the spec) but **never design choices**. If something requires a design decision
beyond what the inputs specify, **stop and flag it** rather than improvising.

You are running inside the `ArchitectOS Pro_beta` repo. The canonical app path is
`C:\Users\Hicks\ArchitectOS Pro_beta`. All file paths below are relative to that root.

This is the most substantial build in the Layer 2 sequence. It creates the synthesis engine that
makes the entire wiki work. There are two sequential steps: complete Step 1 before starting Step 2.

---

## Orient first — read these in order, then build

1. `.planning/document-wiki/phases/03-synthesis-engine/03-RESEARCH.md` — **your primary build
   source.** Read all 10 sections before writing code. Synthesis loop spec (§1), service
   conventions (§2), page-worthiness thresholds (§3), the Claude call / executive_summary primitive
   (§4), document adapter + evidence strategy (§5), config loading (§6), FastAPI endpoints (§7),
   contradiction detection (§8), corrections overlay hook (§9), hard rules (§10).
2. `.planning/document-wiki/phases/03-synthesis-engine/03-01-PLAN.md` — framework task + criteria.
3. `.planning/document-wiki/phases/03-synthesis-engine/03-02-PLAN.md` — adapter task + criteria.
4. `.planning/document-wiki/phases/03-synthesis-engine/CONTEXT.md` — scope, decided decisions,
   file list, success criteria.
5. `.planning/document-wiki/phases/02-page-contract-schema/02-01-CONTRACT.md` — the frozen page
   contract. §J hard guarantees are conformance clauses your code must uphold. Build to this.
6. `.planning/document-wiki/CONTEXT.md` — locked decisions (§3 corrections/flag-don't-resolve,
   §7 memory substrate). CONTEXT wins over all other docs when they conflict.
7. `.planning/document-wiki/phases/01-verify-delta/01-01-DELTA.md` §E (ingest gap — what the
   pipeline does today) and §G (KB Explorer substrate: `full_markdown`, `match_document_chunks`).
8. `python-backend/main.py` — find `_process_ingestion()`. This is where the adapter hooks in.
   Read it fully before modifying it.
9. `python-backend/services/wiki_compilation.py` — **style reference**: `from_env()` pattern,
   service-role discipline, error handling conventions. Do NOT import it; never touch `wiki_*` tables.
10. `python-backend/services/vector_store.py` — read `get_document()`, `store.replace_document_chunks()`,
    and the Supabase client construction. The adapter reads registry rows the same way.
11. `python-backend/services/kb_explorer_service.py` — read how `match_document_chunks` is called
    for hybrid chunk retrieval. Adapt for evidence reading in the document adapter.
12. `src/config/doc_wiki_schema.json` — the vocabulary config the synthesis service validates against.
    The Python backend loads this via a new `core/doc_wiki_config.py` helper.

Read all 12 before writing a single line of code.

---

## What you build

### Step 1 — The synthesis engine framework (03-01)

**File: `python-backend/core/doc_wiki_config.py`** (create)

A simple JSON loader:

```python
import json
from pathlib import Path

_CONFIG_PATH = Path(__file__).parent.parent.parent / "src" / "config" / "doc_wiki_schema.json"

def get_doc_wiki_config() -> dict:
    """Load the doc wiki schema config (page_kind vocabulary, category/type maps)."""
    with _CONFIG_PATH.open() as f:
        return json.load(f)

# Preload at import time for performance
_DOC_WIKI_CONFIG: dict | None = None

def doc_wiki_config() -> dict:
    global _DOC_WIKI_CONFIG
    if _DOC_WIKI_CONFIG is None:
        _DOC_WIKI_CONFIG = get_doc_wiki_config()
    return _DOC_WIKI_CONFIG
```

**File: `python-backend/services/doc_wiki_synthesis.py`** (create)

Build the classes and functions per `03-RESEARCH.md`. Here is the required structure; fill in the
implementations:

```python
"""Layer 2 Document Wiki synthesis engine."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import anthropic

from core.config import get_settings
from core.doc_wiki_config import doc_wiki_config
from services.vector_store import VectorStore


# ─── Data shapes ─────────────────────────────────────────────────────────────

@dataclass
class ChunkRef:
    chunk_id: str
    content: str
    score: float = 0.0

@dataclass
class SourcePayload:
    user_id: str
    source_kind: str          # 'document' | 'sprint' | 'thread' | 'agent_artifact'
    source_id: str            # registry id, thread id, sprint id, etc.
    source_title: str
    full_text: str
    chunk_refs: list[ChunkRef]
    metadata: dict[str, Any]
    synthesis_job_id: str

@dataclass
class SynthesisResult:
    user_id: str
    synthesis_job_id: str
    page_ids: list[str] = field(default_factory=list)
    pages_created: int = 0
    pages_updated: int = 0
    pages_skipped: int = 0
    log_event_ids: list[str] = field(default_factory=list)
    contradictions_flagged: int = 0


# ─── Exceptions ──────────────────────────────────────────────────────────────

class DocWikiSynthesisError(RuntimeError):
    pass

class EmbeddingNotImplementedError(NotImplementedError):
    """Raised by the embedding stub — 05 implements this."""
    pass


# ─── Synthesis service (framework) ───────────────────────────────────────────

class DocWikiSynthesisService:
    """
    Source-agnostic wiki page synthesis engine.
    The synthesis engine is the sole writer of ose_knowledge_pages.content.
    """

    def __init__(self, store: VectorStore, anthropic_client: anthropic.Anthropic):
        self._store = store
        self._anthropic = anthropic_client
        self._config = doc_wiki_config()

    @classmethod
    def from_env(cls) -> "DocWikiSynthesisService":
        settings = get_settings()
        return cls(
            store=VectorStore.from_env(),
            anthropic_client=anthropic.Anthropic(api_key=settings.anthropic_api_key),
        )

    def synthesize(self, source_payload: SourcePayload) -> SynthesisResult:
        """
        Synthesize 1-N pages from a normalized SourcePayload.
        Implements the loop in 03-RESEARCH.md §1.
        """
        result = SynthesisResult(
            user_id=source_payload.user_id,
            synthesis_job_id=source_payload.synthesis_job_id,
        )

        # Step 1: Page-worthiness gate (§3 thresholds applied per-source at adapter level;
        #         per-entity worthiness is returned from the Claude call via page_worthiness field)

        # Step 2: Call Claude to discover topics + synthesize pages
        synthesis_outputs = self._call_synthesis_claude(source_payload)

        for output in synthesis_outputs:
            if output.get("page_worthiness") == "skip":
                result.pages_skipped += 1
                self._write_log(
                    source_payload.user_id,
                    "activity",
                    f"[SYNTHESIS_SKIPPED] {output.get('page_title','unknown')} | job:{source_payload.synthesis_job_id}",
                    result,
                )
                continue

            try:
                page_id = self._upsert_page(source_payload, output)
                result.page_ids.append(page_id)
                if self._was_created(source_payload.user_id, output["canonical_key"]):
                    result.pages_created += 1
                else:
                    result.pages_updated += 1

                # Step g: maintain manifest
                self._maintain_manifest(source_payload, page_id)

                # Step h: write page links
                self._write_page_links(source_payload.user_id, page_id, output.get("suggested_links", []))

                # Step e: flag contradictions (lightweight — §8)
                contradictions = self._flag_contradictions(source_payload.user_id, page_id, output)
                result.contradictions_flagged += contradictions

                # Embedding stub hook (§10 hard rules) — 05 implements
                try:
                    self._embed_page(page_id, output.get("content", ""))
                except EmbeddingNotImplementedError:
                    pass

                # Step i: write activity log
                self._write_log(
                    source_payload.user_id,
                    "activity",
                    f"[SYNTHESIS_COMPLETE] {output.get('page_title','?')} | job:{source_payload.synthesis_job_id}",
                    result,
                )

            except Exception as exc:
                # log but continue to next target
                self._write_log(
                    source_payload.user_id,
                    "activity",
                    f"[SYNTHESIS_ERROR] {output.get('page_title','?')} | {exc} | job:{source_payload.synthesis_job_id}",
                    result,
                )

        return result

    def _call_synthesis_claude(self, payload: SourcePayload) -> list[dict]:
        """
        Call Claude Sonnet to discover topics and synthesize page content.
        Returns a list of page output dicts (one per entity/topic).
        Spec: 03-RESEARCH.md §4.
        """
        # Implementation: build system + user prompt, call claude-sonnet-4-5,
        # parse JSON response. See 03-RESEARCH.md §4 for prompt structure and output schema.
        ...  # implement per spec

    def _upsert_page(self, payload: SourcePayload, output: dict) -> str:
        """
        Create or update ose_knowledge_pages row (service-role).
        Returns page_id.
        Checks for pending corrections before re-synthesis (§9 corrections overlay).
        """
        ...  # implement per spec

    def _maintain_manifest(self, payload: SourcePayload, page_id: str) -> None:
        """
        Update source_file_ids on the page AND connected_pages on the registry row.
        """
        ...  # implement per spec

    def _write_page_links(self, user_id: str, page_id: str, suggested_keys: list[str]) -> None:
        """
        Upsert ose_page_links rows for each suggested canonical_key.
        Lookup page_id from canonical_key; skip if not found.
        """
        ...  # implement per spec

    def _flag_contradictions(self, user_id: str, page_id: str, output: dict) -> int:
        """
        Lightweight contradiction check. Returns count of contradictions flagged.
        """
        ...  # implement per spec (§8)

    def _embed_page(self, page_id: str, content: str) -> None:
        """Stub — raises EmbeddingNotImplementedError. Sub-phase 05 implements."""
        raise EmbeddingNotImplementedError("Embedding not yet implemented (sub-phase 05)")

    def _write_log(self, user_id: str, kind: str, text: str, result: SynthesisResult) -> None:
        """Write an ose_activity_log row. Append id to result.log_event_ids."""
        ...  # implement per spec


# ─── Document adapter (03-02) ────────────────────────────────────────────────

class DocWikiDocumentAdapter:
    """
    Reads a processed document from ose_raw_document_registry and normalizes
    it into a SourcePayload for DocWikiSynthesisService.
    """

    def __init__(self, store: VectorStore, synthesis_service: DocWikiSynthesisService):
        self._store = store
        self._synthesis = synthesis_service

    @classmethod
    def from_env(cls) -> "DocWikiDocumentAdapter":
        store = VectorStore.from_env()
        return cls(
            store=store,
            synthesis_service=DocWikiSynthesisService.from_env(),
        )

    def synthesize_from_document(
        self,
        document_id: str,
        user_id: str,
        file_name: str,
    ) -> SynthesisResult:
        """
        1. Read full_markdown and metadata from ose_raw_document_registry.
        2. Read top chunks for citation evidence via match_document_chunks.
        3. Normalize into SourcePayload.
        4. Call synthesis_service.synthesize().
        """
        ...  # implement per 03-RESEARCH.md §5
```

Implement all the `...` methods. The skeleton above is guidance — adjust signatures if needed, but
honor the documented contracts. Every method that writes to Supabase must use service-role.

**Key implementation notes:**

The Claude synthesis call (§4) should:
- Use `model="claude-sonnet-4-5"` (or the latest Sonnet model string from `settings`)
- Request structured JSON via a system prompt that includes the output schema
- Set `max_tokens=4096` for synthesis output
- Parse the response as JSON; if JSON parsing fails, log the error and return an empty list
- Handle both single-page output (one JSON object) and multi-page output (JSON array of objects)

The `_upsert_page()` method should:
- Check for an existing page with `(user_id, canonical_key)` match first
- If UPDATE: read pending `ose_page_corrections` before the Claude call; pass them as context
- Write via service-role Supabase client: `insert` or `update` `ose_knowledge_pages`
- Always set: `page_type` (from `kind_to_page_type` map), `category` (from `kind_to_category`),
  `word_count`, `synthesis_job_id`, `last_updated = now()`, `status = 'active'`,
  `promotion_state = 'default'` (on create only; don't overwrite if already promoted)
- Set provenance fields: `source_file_ids` starts as `[source_id]` for doc pages
- Set date fields from payload metadata where available

---

### Step 2 — Hook into `_process_ingestion()` (03-02)

After reading `main.py` and confirming where `mark_ingested()` is called, add the adapter call:

```python
# In _process_ingestion(), after store.mark_ingested(...):
try:
    from services.doc_wiki_synthesis import DocWikiDocumentAdapter
    adapter = DocWikiDocumentAdapter.from_env()
    adapter.synthesize_from_document(
        document_id=payload.document_id,
        user_id=payload.user_id,
        file_name=payload.file_name,
    )
except Exception as exc:
    try:
        store.mark_metadata_failed(
            payload.document_id,
            payload.user_id,
            f"[DOC_WIKI_SYNTHESIS] {exc}",
        )
    except Exception:
        pass
```

Use a lazy import inside the try block so a synthesis import error never crashes the module.

Also add the two FastAPI endpoints (§7 of RESEARCH). Add them near the other wiki-related endpoints
in `main.py`, or in a new `routers/doc_wiki.py` router — your call on file placement:

```python
class DocWikiSynthesizeRequest(BaseModel):
    document_id: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)

@app.post("/api/doc-wiki/synthesize-document", dependencies=[Depends(require_ingest_secret)])
def doc_wiki_synthesize_document(
    payload: DocWikiSynthesizeRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    job_id = str(uuid.uuid4())
    background_tasks.add_task(
        _run_doc_wiki_synthesis, payload.document_id, payload.user_id, job_id
    )
    return {"synthesis_job_id": job_id, "status": "queued"}

@app.get("/api/doc-wiki/job/{synthesis_job_id}", dependencies=[Depends(require_ingest_secret)])
def doc_wiki_job_status(synthesis_job_id: str, user_id: str) -> dict:
    # Query ose_activity_log for events matching this job_id
    ...

def _run_doc_wiki_synthesis(document_id: str, user_id: str, job_id: str) -> None:
    from services.doc_wiki_synthesis import DocWikiDocumentAdapter, DocWikiSynthesisError
    try:
        adapter = DocWikiDocumentAdapter.from_env()
        adapter.synthesize_from_document(document_id=document_id, user_id=user_id, file_name="")
    except Exception:
        pass  # errors are logged in the synthesis service
```

---

## Hard constraints

- **Never import `openai`** or use OpenAI APIs. Use `anthropic.Anthropic()` only.
- **Never write to `wiki_*` tables** (Layer 1's claim store). The synthesis service writes only to
  `ose_knowledge_pages`, `ose_page_links`, `ose_page_corrections` (status update), and
  `ose_activity_log`.
- **Service-role only for writes.** Check how `VectorStore` gets its Supabase client and mirror
  that service-role pattern for all wiki page writes.
- **Never crash `_process_ingestion()`.** The adapter call is inside try/except; exception handling
  must prevent any synthesis failure from propagating up and marking the document as parse-failed.
- **Embedding column stays null.** Don't attempt to call any embedding API in this sub-phase.
  The `_embed_page()` stub raises `EmbeddingNotImplementedError`; the caller silently catches it.
- **`page_kind` must be validated.** If Claude returns an unknown `page_kind`, default to `entity`.
  Never let an unknown value crash the synthesis.
- **Don't break existing tests.** The tests in `python-backend/tests/test_wiki_08_acceptance.py`
  test Layer 1's wiki. Do not modify those. Run `python -m pytest python-backend/tests/` at the
  end and confirm the Layer 1 tests still pass.
- **Don't touch `api/vcso/chat.ts`.** The CSO read-hook is unchanged in this sub-phase.
- **`AgentContextBuilder` stays unchanged.** Real tool handlers in the orchestrator are for 05+.

---

## Done when

All 15 success criteria in `CONTEXT.md` are met. The critical one is **criterion 15**: a live
synthesis smoke where `synthesize_from_document()` runs against a real `ose_raw_document_registry`
row and produces at least one row in `ose_knowledge_pages` with `content` populated, `canonical_key`
set, and `source_file_ids` containing the document id.

**Report back:**
- One paragraph summarizing what was built.
- The `page_kind`, `canonical_key`, `page_title`, and `confidence` of any page(s) created in the
  live smoke.
- Whether the contradiction detection and corrections overlay hooks were built (even if dormant —
  no existing corrections to apply yet).
- Any implementation choice you made that deviates from or extends the specified design, so the
  strategy thread can reconcile it into CONTEXT.md.
- Any flag you hit requiring a judgment call or London's decision.
- Layer 1 test results (`python -m pytest python-backend/tests/`).

Then stop. Sub-phase 04 is opened from the strategy thread.
