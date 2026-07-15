"""Knowledge Base Explorer sub-agent service."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import anthropic

from core.config import get_settings
from core.langsmith_tracing import trace_anthropic_client, trace_scope
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
from services.tool_registry import (
    RegistryNativeScopeSource,
    ToolExecutionContext,
    ToolRegistry,
    to_anthropic,
)
from services.usage_events import anthropic_usage, log_ai_usage_event
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


KB_EXPLORER_TOOL_NAMES = [
    "kb_ls",
    "kb_tree",
    "kb_grep",
    "kb_glob",
    "kb_read",
    "wiki_search",
    "wiki_get_page",
    "wiki_list",
]
KB_EXPLORER_TOOLS: list[dict[str, Any]] = to_anthropic(
    [
        ToolRegistry(scope_source=RegistryNativeScopeSource()).get(name)
        for name in KB_EXPLORER_TOOL_NAMES
    ]
)


@dataclass(frozen=True)
class KbExplorerResult:
    summary: str
    tool_steps: list[dict[str, Any]]
    referenced_doc_ids: list[str]
    referenced_doc_names: dict[str, str]
    rounds_used: int
    truncated: bool = False


class KbExplorerService:
    def __init__(self, store: VectorStore, model_setting_key: str | None = "kb_explorer_agent") -> None:
        self.store = store
        settings = get_settings()
        self.nav = KbNavigationService(store)
        self.anthropic_client = trace_anthropic_client(
            anthropic.Anthropic(
                api_key=settings.anthropic_api_key_value,
            )
        )
        resolved = store.resolve_platform_model(
            setting_key=model_setting_key or "kb_explorer_agent",
            fallback_model_name=settings.claude_synthesis_model,
            fallback_provider="anthropic",
        )
        self.model = resolved["model_name"] if resolved.get("provider") == "anthropic" else settings.claude_synthesis_model
        self.provider = "anthropic"
        self.capability_key = model_setting_key or "kb_explorer_agent"
        self.tool_registry = ToolRegistry(store=store)

    @classmethod
    def from_env(cls) -> "KbExplorerService":
        return cls(VectorStore.from_env())

    def run_exploration(
        self,
        user_id: str,
        task_summary: str,
        thread_id: str | None = None,
        run_id: str | None = None,
        max_rounds: int = 5,
    ) -> KbExplorerResult:
        """Run the KB Explorer tool-use loop."""
        messages: list[dict[str, Any]] = [{"role": "user", "content": task_summary}]
        tool_steps: list[dict[str, Any]] = []
        referenced_doc_ids: list[str] = []
        referenced_doc_names: dict[str, str] = {}

        for round_num in range(max_rounds):
            with trace_scope(
                {
                    "user_id": user_id,
                    "thread_id": thread_id,
                    "run_id": run_id,
                    "capability_key": self.capability_key,
                }
            ):
                response = self.anthropic_client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    system=KB_EXPLORER_SYSTEM_PROMPT,
                    tools=self.tool_registry.get_tools(
                        surface="virtual_cso",
                        capability="kb_explorer_agent",
                        format="anthropic",
                    ),  # type: ignore[arg-type]
                    messages=messages,
                )
            usage = anthropic_usage(response)
            log_ai_usage_event(
                self.store.client,
                user_id=user_id,
                surface="virtual_cso",
                model=self.model,
                role="sub_agent",
                provider=self.provider,
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                thread_id=thread_id,
                capability_key=self.capability_key,
                run_id=run_id,
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
            envelope = self._execute_tool(user_id, tool_name, tool_input)
            result_dict = envelope.content
            result_str = json.dumps(result_dict)
            step = {
                "tool_name": tool_name,
                "input_summary": _safe_input_summary(tool_input),
                "output_summary": _safe_output_summary(result_dict),
                "summary": f"{tool_name} returned {_item_count(result_dict)} item(s).",
                "sources": [source.to_dict() for source in envelope.sources],
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
                "sources": [],
                "error": error_str,
            }
            return json.dumps({"error": error_str}), step

    def _execute_tool(
        self,
        user_id: str,
        tool_name: str,
        tool_input: dict[str, Any],
    ):
        return self.tool_registry.execute(
            tool_name,
            ToolExecutionContext(user_id=user_id, store=self.store),
            tool_input,
        )


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
