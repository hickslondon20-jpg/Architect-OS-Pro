"""Knowledge Base Explorer sub-agent service."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import anthropic

from core.config import get_settings
from services.folder_navigation import (
    KbNavigationError,
    KbNavigationService,
    glob_result_to_dict,
    grep_result_to_dict,
    ls_result_to_dict,
    read_result_to_dict,
    tree_result_to_dict,
)
from services.doc_wiki_read_service import DocWikiReadError, DocWikiReadService
from services.vector_store import VectorStore


KB_EXPLORER_SYSTEM_PROMPT = """You are a Knowledge Base Explorer agent for ArchitectOS Pro. \
Your job is to navigate the founder's document library and compiled knowledge wiki to answer \
research questions and synthesize findings grounded in what the platform actually knows.

Available tools:

Document navigation tools:
- kb_ls: List immediate contents (folders and files) of a folder.
- kb_tree: Get a nested tree view with configurable depth.
- kb_grep: Search document content by case-insensitive regex pattern.
- kb_glob: Find documents by filename pattern (supports *, ?, [seq]).
- kb_read: Read a document's full extracted text, or a specific line range.

Compiled wiki tools:
- wiki_search: Search synthesized wiki pages by keyword query.
- wiki_get_page: Retrieve a specific wiki page by its canonical key.
- wiki_list: List all available wiki pages, optionally filtered by kind.

Recommended workflow:
1. For business context, diagnostic, or strategic questions: start with wiki_list then wiki_search.
2. For document content questions: call kb_tree to understand structure, then kb_grep or kb_glob.
3. Use kb_read to read the full text of specific documents.
4. Use wiki_get_page to retrieve the full content of a specific wiki page.
5. Synthesize findings into a clear, grounded response.

Rules:
- Ground every claim in content you have actually read.
- If no relevant content is found, say so clearly — do not speculate.
- Be concise. Founders need actionable insight, not verbose summaries.
- When referencing a document, include its name.
- When referencing a wiki page, include its page kind and canonical key."""


KB_EXPLORER_TOOLS: list[dict[str, Any]] = [
    {
        "name": "kb_ls",
        "description": (
            "List the immediate contents of a Knowledge Base folder. "
            "Returns folders first (alphabetical), then files (alphabetical). "
            "Use this to explore one level at a time."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "folder_id": {
                    "type": ["string", "null"],
                    "description": "UUID of the folder to list. null = Knowledge Base root.",
                }
            },
            "required": [],
        },
    },
    {
        "name": "kb_tree",
        "description": (
            "Get a nested tree view of the Knowledge Base from a starting folder. "
            "Use depth=2 for an overview, depth=3 or more for detailed exploration."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "folder_id": {
                    "type": ["string", "null"],
                    "description": "Root folder UUID. null = Knowledge Base root.",
                },
                "depth": {
                    "type": "integer",
                    "description": "Levels to traverse (1-10). Default: 3.",
                    "default": 3,
                },
                "limit": {
                    "type": "integer",
                    "description": "Max items to return (1-500). Default: 200.",
                    "default": 200,
                },
            },
            "required": [],
        },
    },
    {
        "name": "kb_grep",
        "description": (
            "Search the extracted text of all documents for a regex pattern. "
            "Returns matching document names and IDs - not content excerpts. "
            "Use kb_read to inspect matching documents."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Case-insensitive regex to search for (e.g. 'revenue', 'Q[34]\\s+\\d{4}').",
                },
                "folder_id": {
                    "type": ["string", "null"],
                    "description": "Scope search to a folder subtree. null = all documents.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results (1-100). Default: 50.",
                    "default": 50,
                },
            },
            "required": ["pattern"],
        },
    },
    {
        "name": "kb_glob",
        "description": (
            "Find documents whose filenames match a glob pattern. "
            "Supports *, ?, [seq] wildcards. Case-insensitive. Filename only - no folder path."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern (e.g. '*.pdf', 'report*', '*Q3*').",
                },
                "folder_id": {
                    "type": ["string", "null"],
                    "description": "Scope to a folder subtree. null = all documents.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results (1-200). Default: 200.",
                    "default": 200,
                },
            },
            "required": ["pattern"],
        },
    },
    {
        "name": "kb_read",
        "description": (
            "Read the extracted text content of a document. "
            "Omit start_line and end_line for the full document (max 2000 lines). "
            "Provide both start_line and end_line for a specific range (max 500 lines, 1-indexed inclusive). "
            "Use the document_id from kb_grep, kb_glob, kb_ls, or kb_tree results."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "document_id": {
                    "type": "string",
                    "description": "UUID of the document to read.",
                },
                "start_line": {
                    "type": "integer",
                    "description": "Start line (1-indexed, inclusive). Omit for full read.",
                },
                "end_line": {
                    "type": "integer",
                    "description": "End line (1-indexed, inclusive). Must be provided with start_line.",
                },
            },
            "required": ["document_id"],
        },
    },
    {
        "name": "wiki_search",
        "description": (
            "Search the founder's compiled wiki by keyword query. "
            "Returns matching wiki pages with titles and summaries. "
            "Use this to find synthesized knowledge about business context, diagnostics, "
            "sprint history, clients, offers, and conversation threads. "
            "Prefer wiki_search over kb_grep when looking for synthesized intelligence "
            "rather than raw document content."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Keyword or phrase to search for (e.g. 'revenue', 'client retention', 'sprint goals').",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results to return (1-20). Default: 5.",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "wiki_get_page",
        "description": (
            "Retrieve a specific wiki page by its canonical key. "
            "Use this when you know the exact page key from a wiki_search or wiki_list result. "
            "Returns the full page content."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "canonical_key": {
                    "type": "string",
                    "description": (
                        "The canonical key of the wiki page "
                        "(e.g. 'business_context', 'diagnostic_synthesis', or a Layer 2 page key)."
                    ),
                },
            },
            "required": ["canonical_key"],
        },
    },
    {
        "name": "wiki_list",
        "description": (
            "List wiki pages available for this founder, optionally filtered by page kind. "
            "Use this to discover what synthesized knowledge exists before searching. "
            "Returns page titles, kinds, and canonical keys."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "kind": {
                    "type": ["string", "null"],
                    "description": (
                        "Filter by page kind. Examples: 'wiki_layer1' (compiled platform knowledge), "
                        "'sprint_history', 'thread_synthesis', 'client', 'offer'. "
                        "null = return all kinds."
                    ),
                },
                "limit": {
                    "type": "integer",
                    "description": "Max pages to return (1-50). Default: 20.",
                    "default": 20,
                },
            },
            "required": [],
        },
    },
]


@dataclass(frozen=True)
class KbExplorerResult:
    summary: str
    tool_steps: list[dict[str, Any]]
    referenced_doc_ids: list[str]
    referenced_doc_names: dict[str, str]
    rounds_used: int
    truncated: bool = False


class KbExplorerService:
    def __init__(self, store: VectorStore) -> None:
        self.store = store
        settings = get_settings()
        self.nav = KbNavigationService(store)
        self.anthropic_client = anthropic.Anthropic(
            api_key=settings.anthropic_api_key_value,
        )
        self.model = settings.claude_synthesis_model

    @classmethod
    def from_env(cls) -> "KbExplorerService":
        return cls(VectorStore.from_env())

    def run_exploration(
        self,
        user_id: str,
        task_summary: str,
        max_rounds: int = 5,
    ) -> KbExplorerResult:
        """Run the KB Explorer tool-use loop."""
        messages: list[dict[str, Any]] = [{"role": "user", "content": task_summary}]
        tool_steps: list[dict[str, Any]] = []
        referenced_doc_ids: list[str] = []
        referenced_doc_names: dict[str, str] = {}

        for round_num in range(max_rounds):
            response = self.anthropic_client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=KB_EXPLORER_SYSTEM_PROMPT,
                tools=KB_EXPLORER_TOOLS,  # type: ignore[arg-type]
                messages=messages,
            )

            if response.stop_reason == "end_turn":
                summary = next(
                    (block.text for block in response.content if hasattr(block, "text")),
                    "Exploration complete. No text response generated.",
                )
                return KbExplorerResult(
                    summary=summary,
                    tool_steps=tool_steps,
                    referenced_doc_ids=referenced_doc_ids,
                    referenced_doc_names=referenced_doc_names,
                    rounds_used=round_num + 1,
                    truncated=False,
                )

            if response.stop_reason == "tool_use":
                messages.append({"role": "assistant", "content": response.content})
                tool_results: list[dict[str, Any]] = []

                for block in response.content:
                    if block.type != "tool_use":
                        continue
                    tool_result_content, step = self._dispatch_tool(
                        user_id=user_id,
                        tool_name=block.name,
                        tool_input=block.input,
                        referenced_doc_ids=referenced_doc_ids,
                        referenced_doc_names=referenced_doc_names,
                    )
                    tool_steps.append(step)
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": tool_result_content,
                        }
                    )

                messages.append({"role": "user", "content": tool_results})

        return KbExplorerResult(
            summary="The KB Explorer reached its maximum number of rounds without completing.",
            tool_steps=tool_steps,
            referenced_doc_ids=referenced_doc_ids,
            referenced_doc_names=referenced_doc_names,
            rounds_used=max_rounds,
            truncated=True,
        )

    def _dispatch_tool(
        self,
        user_id: str,
        tool_name: str,
        tool_input: dict[str, Any],
        referenced_doc_ids: list[str],
        referenced_doc_names: dict[str, str],
    ) -> tuple[str, dict[str, Any]]:
        """Execute a tool call and return (result_json_string, step_record)."""
        try:
            result_dict = self._execute_tool(
                user_id,
                tool_name,
                tool_input,
                referenced_doc_ids,
                referenced_doc_names,
            )
            result_str = json.dumps(result_dict)
            step = {
                "tool_name": tool_name,
                "input_summary": _safe_input_summary(tool_input),
                "output_summary": _safe_output_summary(result_dict),
                "summary": f"{tool_name} returned {_item_count(result_dict)} item(s).",
                "error": None,
            }
            if tool_name == "kb_read" and "document_id" in result_dict:
                doc_id = result_dict["document_id"]
                doc_name = result_dict.get("name", doc_id)
                if doc_id not in referenced_doc_ids:
                    referenced_doc_ids.append(doc_id)
                    referenced_doc_names[doc_id] = doc_name
            return result_str, step
        except KbNavigationError as exc:
            error_str = str(exc)
            step = {
                "tool_name": tool_name,
                "input_summary": _safe_input_summary(tool_input),
                "output_summary": {},
                "summary": f"{tool_name} returned an error.",
                "error": error_str,
            }
            return json.dumps({"error": error_str}), step

    def _execute_tool(
        self,
        user_id: str,
        tool_name: str,
        tool_input: dict[str, Any],
        referenced_doc_ids: list[str],
        referenced_doc_names: dict[str, str],
    ) -> dict[str, Any]:
        if tool_name == "kb_ls":
            result = self.nav.execute_ls(
                user_id=user_id,
                folder_id=tool_input.get("folder_id"),
            )
            return ls_result_to_dict(result)

        if tool_name == "kb_tree":
            result = self.nav.execute_tree(
                user_id=user_id,
                folder_id=tool_input.get("folder_id"),
                depth=int(tool_input.get("depth", 3)),
                limit=int(tool_input.get("limit", 200)),
            )
            return tree_result_to_dict(result)

        if tool_name == "kb_grep":
            result = self.nav.execute_grep(
                user_id=user_id,
                pattern=str(tool_input["pattern"]),
                folder_id=tool_input.get("folder_id"),
                limit=int(tool_input.get("limit", 50)),
            )
            return grep_result_to_dict(result)

        if tool_name == "kb_glob":
            result = self.nav.execute_glob(
                user_id=user_id,
                pattern=str(tool_input["pattern"]),
                folder_id=tool_input.get("folder_id"),
                limit=int(tool_input.get("limit", 200)),
            )
            return glob_result_to_dict(result)

        if tool_name == "kb_read":
            start_line = tool_input.get("start_line")
            end_line = tool_input.get("end_line")
            result = self.nav.execute_read(
                user_id=user_id,
                document_id=str(tool_input["document_id"]),
                start_line=int(start_line) if start_line is not None else None,
                end_line=int(end_line) if end_line is not None else None,
            )
            return read_result_to_dict(result)

        if tool_name == "wiki_search":
            reader = DocWikiReadService(self.store)
            query = str(tool_input.get("query", ""))
            limit = int(tool_input.get("limit", 5))
            try:
                result = reader.search(user_id=user_id, query=query, limit=limit)
            except DocWikiReadError as exc:
                return {"error": str(exc)}
            pages = result.get("findings", [])
            return {
                **result,
                "pages": pages if isinstance(pages, list) else [],
                "result_count": len(pages) if isinstance(pages, list) else 0,
            }

        if tool_name == "wiki_get_page":
            reader = DocWikiReadService(self.store)
            canonical_key = str(tool_input.get("canonical_key", ""))
            try:
                result = reader.get_page(user_id=user_id, canonical_key=canonical_key)
            except DocWikiReadError as exc:
                return {"error": str(exc)}
            pages = result.get("findings", [])
            return {
                **result,
                "page": pages[0] if isinstance(pages, list) and pages else None,
                "result_count": len(pages) if isinstance(pages, list) else 0,
            }

        if tool_name == "wiki_list":
            reader = DocWikiReadService(self.store)
            kind = tool_input.get("kind") or None
            limit = int(tool_input.get("limit", 20))
            page_kinds = [str(kind)] if kind else None
            try:
                result = reader.list_pages(user_id=user_id, page_kinds=page_kinds, limit=limit)
            except DocWikiReadError as exc:
                return {"error": str(exc)}
            pages = result.get("findings", [])
            return {
                **result,
                "pages": pages if isinstance(pages, list) else [],
                "result_count": len(pages) if isinstance(pages, list) else 0,
            }

        raise KbNavigationError(f"Unknown tool: {tool_name!r}")


def _safe_input_summary(tool_input: dict[str, Any]) -> dict[str, Any]:
    """Return a safe subset of tool input for logging."""
    return {k: v for k, v in tool_input.items() if k != "content"}


def _safe_output_summary(result: dict[str, Any]) -> dict[str, Any]:
    """Return a compact summary of tool output for logging."""
    summary: dict[str, Any] = {}
    for k, v in result.items():
        if k == "content" and isinstance(v, str):
            summary[k] = f"[{len(v)} chars]"
        elif k in ("items", "matches", "tree") and isinstance(v, list):
            summary[k] = f"[{len(v)} items]"
        else:
            summary[k] = v
    return summary


def _item_count(result: dict[str, Any]) -> int:
    for key in ("item_count", "match_count", "total_items"):
        if key in result:
            return int(result[key])
    return 0
