---
title: MA-01 Gate 1 LangSmith Re-Audit
created: 2026-07-09
status: checkpoint - audit complete, wrapping not yet changed
---

# MA-01 Gate 1 LangSmith Re-Audit

This re-audit supersedes the earlier stale audit that ran against an incomplete checkout. Current main is `2062773d` (`v0.5.8 Restore lost Ep5-Ep7 backend service layer from b6ca8881`), where the Ep5-Ep7 Python service layer is present again.

No `.env` or secret values were read. Verification here is source-shape only; runtime verification remains outcome-based via founder-run surfaces and LangSmith traces.

## Current Wrap State

| Site | Client | Current state |
|---|---|---|
| `python-backend/services/wiki_compilation.py` | Anthropic | Wrapped via guarded `wrap_anthropic` fallback. |
| `python-backend/services/citations/verify.py` | Anthropic | Wrapped inline with `wrap_anthropic`. |
| `python-backend/services/harness_engine.py` | Anthropic | Wrapped inline with `wrap_anthropic` for default client. |
| `python-backend/services/kb_explorer_service.py` | Anthropic | Wrapped inline with `wrap_anthropic`. |
| `python-backend/services/sandbox_execution_service.py` | Anthropic | Wrapped inline with `wrap_anthropic`. |
| `python-backend/services/vcso_chat_service.py` | Anthropic | Wrapped inline with `wrap_anthropic`. |
| `python-backend/services/vector_store.py` | OpenAI | Wrapped inline with `wrap_openai`; covers embeddings and `metadata_extractor.py` because metadata extraction uses `VectorStore.openai_client`. |
| `python-backend/services/doc_wiki_synthesis.py` | Anthropic | Missing wrapper at both construction sites. |
| `python-backend/services/skill_draft_synthesis.py` | Anthropic | Missing wrapper. |
| `python-backend/main.py` diagnostic smoke endpoint | Anthropic | Missing wrapper. |

`python-backend/main.py` already calls `load_dotenv()` before backend service imports so `LANGSMITH_*` can reach `os.environ`, where the LangSmith SDK reads it. Keep this behavior.

## Proposed Shared Helper Approach

Add a tiny helper module, likely `python-backend/core/langsmith_tracing.py`, that centralizes optional LangSmith wrapping:

- `trace_anthropic_client(client)` returns `wrap_anthropic(client)` when LangSmith is importable, otherwise returns the original client.
- `trace_openai_client(client)` returns `wrap_openai(client)` when LangSmith is importable, otherwise returns the original client.
- The helper must never read or log secret values.
- The helper should fail open so missing/disabled LangSmith never takes the backend down.

Then replace per-file direct `from langsmith.wrappers import ...` imports with the helper and wrap the remaining missing sites. This keeps behavior consistent, removes repeated optional-wrapper logic, and gives future Python-backend LLM sites one obvious import path.

## Next Milestones

1. Add the shared helper and migrate the already-wrapped first group to it.
2. Wrap the remaining Anthropic sites in `doc_wiki_synthesis.py`, `skill_draft_synthesis.py`, and the `main.py` diagnostic smoke endpoint; preserve existing `load_dotenv()`.
3. Update `CLAUDE.md` and `Pro-Suite-Progress.md` from `TBD` to the adopted LangSmith bar.
4. Verify by outcome only: founder exercises VCSO chat, doc-wiki synthesis, KB Explorer, sandbox execution, wiki compile, and citation resolve; confirm fresh traces in `ArchitectOS-pro` with no secrets/PII in payloads.
