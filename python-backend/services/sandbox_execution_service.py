"""Sandbox execution sub-agent service."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import anthropic
from supabase import Client, create_client

from core.config import get_settings
from core.langsmith_tracing import trace_anthropic_client
from services.agent_capabilities import AgentCapabilityError
from services.sandbox_bridge import BridgeFulfiller
from services.sandbox_service import SandboxService, SandboxServiceError, get_sandbox_service
from services.skills import SKILL_FILE_BUCKET
from services.tool_registry import (
    RegistryNativeScopeSource,
    ToolExecutionContext,
    ToolRegistry,
    to_anthropic,
)
from services.usage_events import anthropic_usage, log_ai_usage_event


PRODUCED_FILE_PATTERN = re.compile(r"^PRODUCED_FILE:\s*(?P<path>/[^\r\n]+?)\s*$", re.MULTILINE)

SANDBOX_EXECUTION_SYSTEM_PROMPT = """You are a sandboxed code-execution agent for ArchitectOS Pro.
Your job is to write and run Python code against founder/platform data to answer a calculation or
document-generation task, using any attached skill files as reference or template material.

Available tools:
- execute_code: Run Python code in a persistent sandbox session. State (variables, imports)
  persists across calls within this task.
- read_skill_file: Read the full content of a file attached to the skill guiding this task.

Rules:
- If code raises an error, read the error and fix it. Do not give up after one failed attempt.
- Prefer producing a real output file when the task calls for a document, spreadsheet, chart, or
  other downloadable deliverable.
- Write deliverable files under /sandbox.
- If you create a deliverable file, end your final response with exactly one line:
  PRODUCED_FILE: /sandbox/path/to/file.ext
- Do not use the PRODUCED_FILE line unless the file exists in the sandbox.
- Be concise in your final summary. State what you calculated or produced."""


SANDBOX_EXECUTION_TOOL_NAMES = ["execute_code", "read_skill_file"]
SANDBOX_EXECUTION_TOOLS: list[dict[str, Any]] = to_anthropic(
    [
        ToolRegistry(scope_source=RegistryNativeScopeSource()).get(name)
        for name in SANDBOX_EXECUTION_TOOL_NAMES
    ]
)

# Code Mode (the exec-channel bridge): tools authorized for sandbox_execution_agent
# minus these are exposed as in-code stubs. execute_code itself is excluded to
# prevent recursion; read_skill_file stays a top-level-only tool. This is
# independent of SANDBOX_EXECUTION_TOOLS above, which is what Claude's own
# tool-use loop sees and does not change when agent_capabilities widens.
CODE_MODE_EXCLUDED_TOOL_NAMES = frozenset({"execute_code", "read_skill_file"})


@dataclass(frozen=True)
class SandboxExecutionResult:
    summary: str
    tool_steps: list[dict[str, Any]]
    produced_file_path: str | None
    rounds_used: int
    truncated: bool = False


class SandboxExecutionService:
    def __init__(
        self,
        sandbox_service: SandboxService,
        supabase_client: Client,
        model_setting_key: str | None = "sandbox_execution_agent",
    ) -> None:
        self._sandbox_service = sandbox_service
        self._supabase = supabase_client
        settings = get_settings()
        self.anthropic_client = trace_anthropic_client(
            anthropic.Anthropic(api_key=settings.anthropic_api_key or "")
        )
        self._settings = settings
        self.model_setting_key = model_setting_key or "sandbox_execution_agent"
        self.model = settings.claude_synthesis_model
        self.provider = "anthropic"
        self.tool_registry = ToolRegistry(store=_VectorStoreProxy(supabase_client, settings))

    @classmethod
    def from_env(cls, model_setting_key: str | None = "sandbox_execution_agent") -> "SandboxExecutionService":
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise SandboxServiceError("Supabase service-role configuration is required for sandbox execution.")
        return cls(
            sandbox_service=get_sandbox_service(),
            supabase_client=create_client(settings.supabase_url, settings.supabase_service_role_key),
            model_setting_key=model_setting_key,
        )

    def run_execution(
        self,
        *,
        user_id: str,
        thread_id: str,
        task_summary: str,
        skill_file_ids: list[str] | None = None,
        run_id: str | None = None,
        max_rounds: int = 6,
        timeout_seconds: float = 90,
        surface: str = "virtual_cso",
    ) -> SandboxExecutionResult:
        """Run a bounded native tool-use loop for sandbox execution."""
        self._resolve_model()
        scoped_file_ids = [str(item) for item in skill_file_ids or [] if str(item).strip()]
        file_context = self._skill_file_context(scoped_file_ids)
        code_mode_tool_names = self._resolve_code_mode_tool_names(surface)
        bridge_fulfiller = (
            self._build_code_mode_fulfiller(user_id=user_id, tool_names=code_mode_tool_names)
            if code_mode_tool_names
            else None
        )
        messages: list[dict[str, Any]] = [
            {
                "role": "user",
                "content": (
                    f"Task:\n{task_summary}\n\n"
                    f"Sandbox thread id: {thread_id}\n\n"
                    f"Available attached skill files:\n{file_context}"
                ),
            }
        ]
        tool_steps: list[dict[str, Any]] = []

        for round_num in range(max_rounds):
            response = self.anthropic_client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=_build_system_prompt(code_mode_tool_names),
                tools=SANDBOX_EXECUTION_TOOLS,
                messages=messages,
            )
            usage = anthropic_usage(response)
            log_ai_usage_event(
                self._supabase,
                user_id=user_id,
                surface="virtual_cso",
                model=self.model,
                role="sub_agent",
                provider=self.provider,
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                thread_id=thread_id,
                capability_key=self.model_setting_key,
                run_id=run_id,
            )

            if response.stop_reason == "end_turn":
                summary = next(
                    (block.text for block in response.content if hasattr(block, "text")),
                    "Sandbox execution complete. No text response generated.",
                )
                return SandboxExecutionResult(
                    summary=summary,
                    tool_steps=tool_steps,
                    produced_file_path=_parse_produced_file(summary),
                    rounds_used=round_num + 1,
                    truncated=False,
                )

            if response.stop_reason == "tool_use":
                messages.append({"role": "assistant", "content": response.content})
                tool_results: list[dict[str, Any]] = []

                for block in response.content:
                    if block.type != "tool_use":
                        continue
                    tool_result_content, steps = self._dispatch_tool(
                        user_id=user_id,
                        thread_id=thread_id,
                        timeout_seconds=timeout_seconds,
                        allowed_skill_file_ids=scoped_file_ids,
                        tool_name=block.name,
                        tool_input=block.input,
                        bridge_fulfiller=bridge_fulfiller,
                    )
                    tool_steps.extend(steps)
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": tool_result_content,
                        }
                    )

                messages.append({"role": "user", "content": tool_results})

        return SandboxExecutionResult(
            summary="The Sandbox Execution agent reached its maximum number of rounds without completing.",
            tool_steps=tool_steps,
            produced_file_path=None,
            rounds_used=max_rounds,
            truncated=True,
        )

    def _dispatch_tool(
        self,
        *,
        user_id: str,
        thread_id: str,
        timeout_seconds: float,
        allowed_skill_file_ids: list[str],
        tool_name: str,
        tool_input: dict[str, Any],
        bridge_fulfiller: BridgeFulfiller | None = None,
    ) -> tuple[str, list[dict[str, Any]]]:
        try:
            envelope = self._execute_tool(
                user_id=user_id,
                thread_id=thread_id,
                timeout_seconds=timeout_seconds,
                allowed_skill_file_ids=allowed_skill_file_ids,
                tool_name=tool_name,
                tool_input=tool_input,
                bridge_fulfiller=bridge_fulfiller,
            )
            result_dict = envelope.content
            steps = [
                {
                    "tool_name": tool_name,
                    "input_summary": _safe_input_summary(tool_input),
                    "output_summary": _safe_output_summary(result_dict),
                    "summary": f"{tool_name} completed.",
                    "sources": [source.to_dict() for source in envelope.sources],
                    "error": None,
                }
            ]
            steps.extend(_bridge_call_steps(envelope.provenance.get("bridge_tool_calls")))
            return json.dumps(result_dict), steps
        except Exception as exc:
            error_str = str(exc)
            steps = [
                {
                    "tool_name": tool_name,
                    "input_summary": _safe_input_summary(tool_input),
                    "output_summary": {},
                    "summary": f"{tool_name} returned an error.",
                    "sources": [],
                    "error": error_str,
                }
            ]
            return json.dumps({"error": error_str}), steps

    def _execute_tool(
        self,
        *,
        user_id: str,
        thread_id: str,
        timeout_seconds: float,
        allowed_skill_file_ids: list[str],
        tool_name: str,
        tool_input: dict[str, Any],
        bridge_fulfiller: BridgeFulfiller | None = None,
    ):
        return self.tool_registry.execute(
            tool_name,
            ToolExecutionContext(
                user_id=user_id,
                supabase_client=self._supabase,
                sandbox_service=self._sandbox_service,
                thread_id=thread_id,
                timeout_seconds=timeout_seconds,
                allowed_skill_file_ids=allowed_skill_file_ids,
                metadata={"sandbox_execution_service": self, "bridge_fulfiller": bridge_fulfiller},
            ),
            tool_input,
        )

    def _resolve_code_mode_tool_names(self, surface: str) -> list[str]:
        """Read/compute tools this session's Code Mode may call, host-side.

        Degrades to no Code Mode tools (rather than raising) if the capability
        isn't authorized for this surface - Code Mode is additive, not a hard
        dependency of plain execute_code.
        """
        try:
            authorized = self.tool_registry.get_tools(
                surface=surface,
                capability="sandbox_execution_agent",
                format="definition",
            )
        except AgentCapabilityError:
            return []
        return [tool.name for tool in authorized if tool.name not in CODE_MODE_EXCLUDED_TOOL_NAMES]

    def _build_code_mode_fulfiller(self, *, user_id: str, tool_names: list[str]) -> BridgeFulfiller:
        context = ToolExecutionContext(
            user_id=user_id,
            store=_VectorStoreProxy(self._supabase, self._settings),
            supabase_client=self._supabase,
        )
        return BridgeFulfiller(registry=self.tool_registry, context=context, allowed_tool_names=tool_names)

    def _read_skill_file(self, *, user_id: str, skill_file_id: str) -> dict[str, Any]:
        rows = (
            self._supabase.table("skill_files")
            .select("id,skill_id,filename,category,mime_type,size,storage_path")
            .eq("id", skill_file_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not rows:
            raise SandboxServiceError("Skill file not found.")
        row = rows[0]
        skill_rows = (
            self._supabase.table("skill_packs")
            .select("id,scope,user_id")
            .eq("id", row["skill_id"])
            .limit(1)
            .execute()
            .data
            or []
        )
        skill_pack = skill_rows[0] if skill_rows else {}
        if skill_pack.get("scope") != "global" and str(skill_pack.get("user_id")) != user_id:
            raise SandboxServiceError("Skill file is not visible to this user.")

        content = self._supabase.storage.from_(SKILL_FILE_BUCKET).download(row["storage_path"])
        mime_type = str(row.get("mime_type") or "")
        if _is_text_file(str(row.get("filename") or ""), mime_type):
            return {
                "skill_file_id": row["id"],
                "filename": row["filename"],
                "category": row["category"],
                "mime_type": mime_type,
                "content": content.decode("utf-8", errors="replace"),
            }
        return {
            "skill_file_id": row["id"],
            "filename": row["filename"],
            "category": row["category"],
            "mime_type": mime_type,
            "content": f"[binary file, {len(content)} bytes]",
        }

    def _skill_file_context(self, skill_file_ids: list[str]) -> str:
        if not skill_file_ids:
            return "No attached skill files are scoped to this run."
        rows = (
            self._supabase.table("skill_files")
            .select("id,filename,category,mime_type,size")
            .in_("id", skill_file_ids)
            .execute()
            .data
            or []
        )
        if not rows:
            return "No attached skill files were found for the scoped ids."
        return "\n".join(
            f"- id={row.get('id')} filename={row.get('filename')} category={row.get('category')} "
            f"mime={row.get('mime_type') or 'unknown'} size={row.get('size') or 0}"
            for row in rows
        )

    def _resolve_model(self) -> None:
        store = _VectorStoreProxy(self._supabase, self._settings)
        resolved = store.resolve_platform_model(
            setting_key=self.model_setting_key,
            fallback_model_name=self._settings.claude_synthesis_model,
            fallback_provider="anthropic",
        )
        self.model = resolved["model_name"] if resolved.get("provider") == "anthropic" else self._settings.claude_synthesis_model


class _VectorStoreProxy:
    def __init__(self, supabase_client: Client, settings: Any) -> None:
        self.client = supabase_client
        self.settings = settings

    def resolve_platform_model(self, *, setting_key: str, fallback_model_name: str, fallback_provider: str) -> dict[str, str]:
        from services.vector_store import VectorStore

        return VectorStore(self.client, None, self.settings).resolve_platform_model(
            setting_key=setting_key,
            fallback_model_name=fallback_model_name,
            fallback_provider=fallback_provider,
        )


def _build_system_prompt(code_mode_tool_names: list[str]) -> str:
    if not code_mode_tool_names:
        return SANDBOX_EXECUTION_SYSTEM_PROMPT
    tool_list = ", ".join(sorted(code_mode_tool_names))
    return (
        f"{SANDBOX_EXECUTION_SYSTEM_PROMPT}\n\n"
        "Code Mode: the Python code you run via execute_code can also call these read-only "
        f"platform tools directly as plain functions, without a separate tool_use round trip: {tool_list}. "
        'Call them like normal Python functions (e.g. kb_grep(pattern="revenue")); each call blocks '
        "briefly while the platform resolves it host-side and raises an exception if it fails. Results "
        "match the same structure the platform returns everywhere else. These functions are only "
        "available inside sandbox code, not in your own top-level tool list."
    )


def _bridge_call_steps(bridge_calls: Any) -> list[dict[str, Any]]:
    if not isinstance(bridge_calls, list):
        return []
    steps: list[dict[str, Any]] = []
    for call in bridge_calls:
        if not isinstance(call, dict):
            continue
        tool_name = str(call.get("tool_name") or "")
        ok = bool(call.get("ok"))
        steps.append(
            {
                "tool_name": tool_name,
                "input_summary": {},
                "output_summary": {},
                "summary": f"Code Mode called {tool_name}." if ok else f"Code Mode call to {tool_name} failed.",
                "sources": [],
                "error": None if ok else str(call.get("error") or "Tool call failed."),
            }
        )
    return steps


def _parse_produced_file(summary: str) -> str | None:
    match = PRODUCED_FILE_PATTERN.search(summary)
    if not match:
        return None
    path = match.group("path").strip()
    if not path.startswith("/sandbox/") and path != "/sandbox":
        return None
    return path


def _safe_input_summary(tool_input: dict[str, Any]) -> dict[str, Any]:
    summary = {k: v for k, v in tool_input.items() if k != "code"}
    if "code" in tool_input:
        summary["code"] = f"[{len(str(tool_input.get('code') or ''))} chars]"
    return summary


def _safe_output_summary(result: dict[str, Any]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    for key, value in result.items():
        if key in {"stdout", "stderr", "content"} and isinstance(value, str):
            summary[key] = f"[{len(value)} chars]"
        else:
            summary[key] = value
    return summary


def _is_text_file(filename: str, mime_type: str) -> bool:
    if mime_type.startswith("text/") or mime_type in {"application/json", "application/xml"}:
        return True
    return Path(filename).suffix.lower() in {".md", ".txt", ".csv", ".json", ".yaml", ".yml", ".xml", ".html"}
