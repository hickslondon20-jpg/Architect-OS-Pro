# Phase 7 Alignment Context — Explorer Sub-Agent

> Decisions locked in Phase 6→7 alignment checkpoint, 2026-06-28.
> Phase 7 execution agent must read this before touching any file.

---

## What Phase 7 Builds

The KB Explorer sub-agent: a Claude-powered tool-use loop that can navigate and read the founder's Knowledge Base to answer research questions. Three things:

1. **`kb_explorer_service.py`** — new service file with the Claude tool-use loop
2. **`sub_agent_orchestrator.py`** extension — new handler wired into the dispatch branch
3. **Capability registration + dependencies** — `requirements.txt`, `config.py`, `agent_capabilities.py` fallback, Supabase migration

---

## Architecture Exception: Claude in Python Backend

The CLAUDE.md architecture rule is: all Claude synthesis goes through N8N. The one existing exception is the Virtual CSO streaming path (Vercel serverless), made because N8N cannot stream tokens.

**Phase 7 is a second exception, with the same rationale:** N8N cannot run a multi-round tool-use loop (call Claude → execute tool → feed result back → repeat). The KB Explorer requires this loop. Therefore, Claude calls for the KB Explorer live in the Python Railway backend.

This means:
- Add `anthropic` package to `requirements.txt`
- Add `anthropic_api_key` and `claude_synthesis_model` to `core/config.py`
- Call `anthropic.Anthropic()` directly in `KbExplorerService`
- The API key stays server-side (never in the browser)

This is not a rewrite of the N8N synthesis paths. WF-PS-01..04 remain in N8N. This only applies to `kb_explorer_agent`.

---

## Tool-Use Loop Design

**Max rounds:** 5 (hardcoded in handler). No `context_scope` or `capability.default_config` parameter exposed — Claude consistently finishes in 2–4 rounds for typical KB tasks.

**Stop conditions:**
- `stop_reason == "end_turn"` → agent finished, extract text response
- `stop_reason == "tool_use"` → execute tools, append results, call Claude again
- Rounds exhausted → return with `truncated=True`

**Tool execution:** `KbNavigationService` methods called directly — no HTTP round-trips to the FastAPI tool endpoints. `KbExplorerService` creates its own `KbNavigationService(store)` instance.

**Tool errors:** If a tool call raises `KbNavigationError`, return the error as a string in the tool result with `is_error: True`. The agent sees the error and can try alternative approaches.

---

## Context Scope

`context_scope={}` for KB Explorer calls. The agent discovers documents via tools (ls, tree, grep, glob) rather than requiring pre-seeded document IDs. The existing `_safe_scope_snapshot` strips unknown keys — this is fine because we pass nothing that needs to be kept.

**`context.sources` will be empty** when KB Explorer starts (no pre-seeded IDs). Citations are built from documents the agent actually reads, collected from tool steps.

---

## AGENT-02 Status: Deferred

AGENT-02 ("Explorer sub-agent can invoke the existing document analysis sub-agent") is deferred. The `can_spawn_agents` check in `get_for_surface()` blocks any capability with `can_spawn_agents=True`. Bypassing this for Phase 7 adds complexity without beta benefit. The KB Explorer's 5 tools are sufficient for founder KB research tasks.

`kb_explorer_agent` has `can_spawn_agents=False`.

---

## KbExplorerResult Shape

```python
@dataclass(frozen=True)
class KbExplorerResult:
    summary: str                            # Claude's final text response
    tool_steps: list[dict[str, Any]]        # [{tool_name, input_summary, output_summary, summary}]
    referenced_doc_ids: list[str]           # UUIDs of docs read via kb_read
    referenced_doc_names: dict[str, str]    # {uuid: filename} for citation labels
    rounds_used: int
    truncated: bool = False                 # True if max_rounds exhausted
```

`referenced_doc_ids` and `referenced_doc_names` are populated during tool dispatch whenever `kb_read` is called. This drives the handler's citation output.

---

## New Files

```
python-backend/services/kb_explorer_service.py    — KbExplorerService, KbExplorerResult,
                                                    KB_EXPLORER_TOOLS, KB_EXPLORER_SYSTEM_PROMPT
```

## Modified Files

```
python-backend/requirements.txt                   — add anthropic>=0.40.0
python-backend/core/config.py                     — add anthropic_api_key, claude_synthesis_model
python-backend/services/agent_capabilities.py     — add kb_explorer_agent to _fallback_capabilities()
python-backend/services/sub_agent_orchestrator.py — import KbExplorerService + AgentSourceRef,
                                                    add elif branch, add _handle_kb_explorer()
docs/migrations/20260628_kb_explorer_capability.sql — INSERT kb_explorer_agent into agent_capabilities
```

---

## What Phase 7 Does NOT Build

- No streaming events from KB Explorer to frontend (synchronous, same as existing handlers)
- No sub-agent delegation to `document_analysis_agent` (AGENT-02 deferred)
- No new FastAPI endpoints (KB Explorer is accessed via existing `/api/agent-runs`)
- No frontend changes
- No new Supabase table schemas (uses existing `agent_delegation_runs`, `agent_delegation_steps`, `agent_context_sources`)
