# Sub-phase 04 Execution Agent Prompt

**You are a focused execution agent.** Your task is to build sub-phase 04 of the
ArchitectOS Document Wiki (Layer 2): three new source adapter classes on the existing
synthesis framework. Read the files listed in Step 0 first, then build in order.

---

## Step 0 — Read before writing a single line of code

Read these files in order. Do not skip any.

1. `.planning/document-wiki/CONTEXT.md` — locked decisions, hard guarantees (§J of CONTRACT), amendments
2. `.planning/document-wiki/phases/02-page-contract-schema/02-01-CONTRACT.md` — page object + §J (8 hard rules)
3. `src/config/doc_wiki_schema.json` — page_kind vocabulary (confirm `sprint_history`, `capability_evolution`, `thread_synthesis`, `agent_artifact` are present)
4. `python-backend/services/doc_wiki_synthesis.py` — the framework you're extending: `DocWikiSynthesisService`, `SourcePayload`, `SynthesisResult`, `ChunkRef`, `_upsert_page()`, `_canonical_key()`, `_is_source_worthy()`
5. `python-backend/main.py` — existing endpoint pattern and `DocWikiSynthesizeRequest` model
6. `.planning/document-wiki/phases/04-source-adapters/04-RESEARCH.md` — verified source schemas, body assembly specs, page-worthiness gates, endpoint specs, hard rules
7. `Pro-Suite-Progress.md` — your status manifest

---

## Step 1 — `DocWikiSprintAdapter`

Create `python-backend/services/doc_wiki_sprint_adapter.py`.

### Class skeleton

```python
"""Document Wiki — Sprint-history source adapter."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from supabase import Client as SupabaseClient

from .doc_wiki_synthesis import (
    DocWikiSynthesisService,
    SourcePayload,
    SynthesisResult,
    ChunkRef,
)


class DocWikiSprintAdapter:
    """Synthesizes sprint data into sprint_history + capability_evolution pages."""

    def __init__(self, supabase: SupabaseClient, service: DocWikiSynthesisService) -> None:
        self._sb = supabase
        self._service = service

    async def synthesize_from_sprint(
        self, sprint_goal_id: str, user_id: str
    ) -> dict[str, Any]:
        """
        Synthesize one sprint goal into wiki pages.

        Returns:
            {
              "sprint_history": SynthesisResult,
              "capability_evolution": list[SynthesisResult],
              "skipped": bool,
              "skip_reason": str | None,
            }
        """
        # 1. Load sprint goal
        # 2. Load initiatives (with milestones nested or joined)
        # 3. Run _is_sprint_worthy() gate — return skipped result if fails
        # 4. Synthesize sprint_history page
        # 5. For each unique capability_id in initiatives:
        #    a. Read existing capability_evolution page (if any)
        #    b. Synthesize capability_evolution page (accreting)
        # 6. Return results dict
        ...

    # ── Private helpers ──────────────────────────────────────────────────────

    def _is_sprint_worthy(self, goal: dict, initiatives: list[dict]) -> bool:
        """Return False for draft sprints or sprints with no substantive initiatives."""
        if goal.get("status") == "draft":
            return False
        has_substance = any(
            i.get("outcome_statement") or i.get("binary_done_definition")
            for i in initiatives
        )
        return has_substance

    def _sprint_canonical_key(self, quarter: str, sprint_goal_id: str) -> str:
        return f"sprint_{quarter}_{sprint_goal_id[:8]}"

    def _capability_canonical_key(self, capability_id: str) -> str:
        return f"capability_evolution_{capability_id}"

    def _assemble_sprint_body(
        self, goal: dict, initiatives: list[dict], milestones: list[dict]
    ) -> str:
        """Build the narrative body text for the sprint_history Claude call."""
        # See 04-RESEARCH.md §2.4 for the exact template
        ...

    def _assemble_capability_body(
        self,
        initiative: dict,
        goal: dict,
        existing_content: str | None,
    ) -> str:
        """Build body text for capability_evolution. If existing_content, pass it
        with a directive for Claude to extend history rather than replace it."""
        ...

    def _read_existing_capability_page(
        self, user_id: str, capability_id: str
    ) -> str | None:
        """Return existing page content or None if not yet synthesized."""
        key = self._capability_canonical_key(capability_id)
        result = (
            self._sb.table("ose_knowledge_pages")
            .select("content")
            .eq("user_id", user_id)
            .eq("canonical_key", key)
            .maybe_single()
            .execute()
        )
        return result.data["content"] if result.data else None
```

### Implementation notes

- Load milestones by joining `initiative_id IN (...)` from the initiatives list.
- `capability_evolution` canonical key uses `capability_id` (a text field from
  `sp_sprint_initiatives`, not a UUID) — do not truncate it.
- For the capability_evolution `SourcePayload`, set `metadata['existing_content']` to
  the existing page text. Add a synthesis directive in `metadata['synthesis_directive']`
  instructing Claude to extend history.
- `source_file_ids` is `[]` for all sprint pages (no document IDs).
- `effective_date` = `goal['kickoff_date']`; `observed_date` = `goal['retrospective_completed_at']`
  (pass these in `metadata` so `_upsert_page()` can set them — check the upsert method
  signature in `doc_wiki_synthesis.py` to see how extra metadata fields are handled).

---

## Step 2 — `DocWikiCSOThreadAdapter`

Create `python-backend/services/doc_wiki_cso_thread_adapter.py`.

### Class skeleton

```python
"""Document Wiki — Virtual CSO thread source adapter."""

from __future__ import annotations

from typing import Any

from supabase import Client as SupabaseClient

from .doc_wiki_synthesis import DocWikiSynthesisService, SourcePayload, SynthesisResult


# Page-worthiness thresholds
_MIN_MESSAGE_COUNT = 4
_MIN_ASSISTANT_CONTENT_LEN = 200
_TRUNCATION_TOTAL_MESSAGES = 30
_TRUNCATION_KEEP_FIRST = 20
_TRUNCATION_KEEP_LAST = 5


class DocWikiCSOThreadAdapter:
    """Synthesizes Virtual CSO threads into thread_synthesis wiki pages."""

    def __init__(self, supabase: SupabaseClient, service: DocWikiSynthesisService) -> None:
        self._sb = supabase
        self._service = service

    async def synthesize_from_thread(
        self, thread_id: str, user_id: str
    ) -> SynthesisResult | None:
        """
        Synthesize one thread into a thread_synthesis page.

        Returns SynthesisResult on success, None if skipped.
        Sets synthesis_status='completed' or 'skipped' on vcso_chat_threads.
        """
        # 1. Load thread metadata
        # 2. Load messages ordered by created_at
        # 3. Run _is_thread_worthy() — if fails, set status='skipped', return None
        # 4. Assemble transcript body (with truncation if needed)
        # 5. Build SourcePayload, call service.synthesize()
        # 6. Set synthesis_status='completed'
        # 7. Return SynthesisResult
        ...

    async def synthesize_pending_threads(
        self, user_id: str, limit: int = 10
    ) -> list[SynthesisResult | None]:
        """Synthesize all pending threads for a user, up to limit."""
        threads = (
            self._sb.table("vcso_chat_threads")
            .select("id")
            .eq("user_id", user_id)
            .eq("synthesis_status", "pending")
            .limit(limit)
            .execute()
        )
        results = []
        for thread in threads.data:
            result = await self.synthesize_from_thread(thread["id"], user_id)
            results.append(result)
        return results

    # ── Private helpers ──────────────────────────────────────────────────────

    def _is_thread_worthy(self, thread: dict, messages: list[dict]) -> bool:
        """Return True if thread meets synthesis worthiness threshold."""
        if thread.get("message_count", 0) < _MIN_MESSAGE_COUNT:
            return False
        assistant_msgs = [m for m in messages if m.get("role") == "assistant"]
        return any(
            len(m.get("content", "")) >= _MIN_ASSISTANT_CONTENT_LEN
            for m in assistant_msgs
        )

    def _build_transcript(self, messages: list[dict]) -> str:
        """Assemble message transcript with truncation if needed."""
        if len(messages) > _TRUNCATION_TOTAL_MESSAGES:
            kept = messages[:_TRUNCATION_KEEP_FIRST] + messages[-_TRUNCATION_KEEP_LAST:]
            omitted = len(messages) - len(kept)
            messages = (
                messages[:_TRUNCATION_KEEP_FIRST]
                + [{"role": "system", "content": f"[{omitted} messages omitted]"}]
                + messages[-_TRUNCATION_KEEP_LAST:]
            )
        lines = []
        for m in messages:
            role_label = m.get("role", "unknown").upper()
            lines.append(f"**{role_label}:** {m.get('content', '')}")
        return "\n\n".join(lines)

    def _set_synthesis_status(self, thread_id: str, status: str) -> None:
        self._sb.table("vcso_chat_threads") \
            .update({"synthesis_status": status}) \
            .eq("id", thread_id) \
            .execute()

    def _thread_canonical_key(self, thread_id: str) -> str:
        return f"thread_{thread_id[:8]}"
```

### Implementation notes

- `origin_thread_id` field in `SourcePayload` must be set to `thread_id` (UUID string)
  so the synthesis service writes it to `ose_knowledge_pages.origin_thread_id`.
- If `thread.title == 'New conversation'`, add a synthesis directive asking Claude to
  generate a meaningful page title based on the content.
- `chunk_refs` is `[]` — CSO messages are not document chunks.
- The `_set_synthesis_status()` call MUST happen in both success and skip paths. Wrap
  the synthesis call in try/except; on unexpected error, do not update the status (leave
  it `'pending'` so the founder can retry).

---

## Step 3 — `DocWikiAgentArtifactAdapter`

Create `python-backend/services/doc_wiki_agent_artifact_adapter.py`.

### Class skeleton

```python
"""Document Wiki — Domain-agent artifact source adapter."""

from __future__ import annotations

from typing import Any

from supabase import Client as SupabaseClient

from .doc_wiki_synthesis import DocWikiSynthesisService, SourcePayload, SynthesisResult

_MIN_RESULT_SUMMARY_LEN = 150
_MIN_CONFIDENCE = 0.5


class DocWikiAgentArtifactAdapter:
    """Synthesizes completed agent delegation runs into agent_artifact wiki pages."""

    def __init__(self, supabase: SupabaseClient, service: DocWikiSynthesisService) -> None:
        self._sb = supabase
        self._service = service

    async def synthesize_from_run(
        self, run_id: str, user_id: str
    ) -> SynthesisResult | None:
        """
        Synthesize one completed run into an agent_artifact page.

        Returns SynthesisResult on success, None if skipped (below threshold).
        """
        # 1. Load run from agent_delegation_runs
        # 2. Load steps from agent_delegation_steps (ordered by step_index)
        # 3. Load context sources from agent_context_sources
        # 4. Run _is_artifact_worthy() gate — return None if fails
        # 5. Assemble body text
        # 6. Build SourcePayload, call service.synthesize()
        # 7. Return SynthesisResult
        ...

    # ── Private helpers ──────────────────────────────────────────────────────

    def _is_artifact_worthy(self, run: dict) -> bool:
        return (
            run.get("status") == "completed"
            and run.get("result_summary")
            and len(run["result_summary"]) >= _MIN_RESULT_SUMMARY_LEN
            and (run.get("confidence") or 0) >= _MIN_CONFIDENCE
        )

    def _artifact_canonical_key(self, run_id: str) -> str:
        return f"agent_artifact_{run_id[:8]}"

    def _assemble_artifact_body(
        self, run: dict, steps: list[dict], sources: list[dict]
    ) -> str:
        """Build body text. See 04-RESEARCH.md §4.4 for template."""
        ...
```

### Implementation notes

- Filter steps to exclude `step_type` values like `'context_load'` or `'internal'`
  from the body (they are plumbing, not content). Include `'tool_use'`, `'reasoning'`,
  `'output'` step types.
- The `citations` field on `agent_delegation_runs` is a JSONB array. If it contains
  references to `ose_knowledge_pages` canonical keys, the adapter should add those as
  page links via `ose_page_links` after synthesis — or pass them in `metadata['related_canonical_keys']`
  for the synthesis service to handle (check if `_write_page_links()` already supports
  this path; if not, a simple direct insert to `ose_page_links` after synthesis is fine).
- `chunk_refs` is `[]`.
- No state update required on `agent_delegation_runs` — the canonical_key existence
  check in `_upsert_page()` prevents re-creation.

---

## Step 4 — Wire endpoints into `main.py`

Add after the existing doc-wiki endpoints (search for `/api/doc-wiki/synthesize-document`
to find the right location):

### New Pydantic models

```python
class DocWikiSynthesizeSprintRequest(BaseModel):
    sprint_goal_id: str
    user_id: str

class DocWikiSynthesizeThreadRequest(BaseModel):
    thread_id: str
    user_id: str

class DocWikiSynthesizePendingThreadsRequest(BaseModel):
    user_id: str
    limit: int = 10

class DocWikiSynthesizeAgentArtifactRequest(BaseModel):
    run_id: str
    user_id: str
```

### New endpoints (pattern mirrors existing `/api/doc-wiki/synthesize-document`)

```python
@app.post("/api/doc-wiki/synthesize-sprint")
async def synthesize_sprint_wiki(payload: DocWikiSynthesizeSprintRequest):
    from services.doc_wiki_sprint_adapter import DocWikiSprintAdapter
    from services.doc_wiki_synthesis import DocWikiSynthesisService
    try:
        service = DocWikiSynthesisService.from_env()
        adapter = DocWikiSprintAdapter(get_supabase_client(), service)
        result = await adapter.synthesize_from_sprint(payload.sprint_goal_id, payload.user_id)
        return {"status": "ok", "result": result}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}

# ... same pattern for synthesize-thread, synthesize-pending-threads, synthesize-agent-artifact
```

Use lazy imports (inside the endpoint function body) matching the `_process_ingestion()`
pattern from sub-phase 03. This avoids import-time failures if env vars are missing.

---

## Step 5 — Verify `page_kind` vocabulary

Check `src/config/doc_wiki_schema.json`. Confirm all four kinds are present:
`sprint_history`, `capability_evolution`, `thread_synthesis`, `agent_artifact`.

If any are missing, add them to `page_kind_vocabulary`, `kind_to_category`, and
`kind_to_page_type` consistently with the existing entries:
- `sprint_history` → category `strategic_execution`, page_type `strategic_context`
- `capability_evolution` → category `strategic_execution`, page_type `assessment_intelligence`
- `thread_synthesis` → category `intelligence_layer`, page_type `custom`
- `agent_artifact` → category `intelligence_layer`, page_type `custom`

---

## Step 6 — Compile check and progress update

```bash
python -m compileall python-backend
```

Fix any errors before reporting done.

Update `Pro-Suite-Progress.md` to mark sub-phase 04 as complete (or partial with
a clear flag if live smoke couldn't be run due to env constraints — same pattern as 03).

---

## Hard constraints (non-negotiable)

- **Never call OpenAI** — all Claude calls go through `DocWikiSynthesisService`
- **Never read/write `pinecone_vector_id`**
- **Never add a DB CHECK constraint to `page_kind`**
- **Capability evolution pages MUST read existing content first** — always check for an
  existing page before synthesizing; pass existing content so Claude extends history
- **CSO thread `synthesis_status` MUST be updated** — always set `'completed'` or `'skipped'`
- **No new migrations** — all schema changes are done; if you find something missing, flag
  it in your report; do NOT apply a migration
- **Adapters are parallel siblings** — do not make any adapter extend another adapter

---

## Done-when report

When complete, report back to the strategy thread with:

1. Files created/modified (with line counts for new files)
2. All 18 success criteria from `CONTEXT.md` — checked or flagged
3. `compileall` output
4. Any implementation flags or deviations from the research spec
5. Whether a live smoke was possible (call one endpoint with a real ID if you have env access)
