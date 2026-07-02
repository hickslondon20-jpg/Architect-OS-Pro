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
from services.sandbox_service import SandboxService, SandboxServiceError, get_sandbox_service
from services.skills import SKILL_FILE_BUCKET


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


SANDBOX_EXECUTION_TOOLS: list[dict[str, Any]] = [
    {
        "name": "execute_code",
        "description": (
            "Run Python code in the persistent sandbox session for this task. Variables and "
            "imports persist across calls. Returns stdout, stderr, and exit code. If your code "
            "writes an output file, report it in the final summary using the PRODUCED_FILE line."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Python code to execute."},
                "description": {"type": "string", "description": "Brief purpose of this code run."},
            },
            "required": ["code"],
        },
    },
    {
        "name": "read_skill_file",
        "description": (
            "Read the full text content of a file attached to the selected skill. Use a "
            "skill_file_id from the task context."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "skill_file_id": {"type": "string", "description": "UUID of the skill file to read."},
            },
            "required": ["skill_file_id"],
        },
    },
]


@dataclass(frozen=True)
class SandboxExecutionResult:
    summary: str
    tool_steps: list[dict[str, Any]]
    produced_file_path: str | None
    rounds_used: int
    truncated: bool = False


class SandboxExecutionService:
    def __init__(self, sandbox_service: SandboxService, supabase_client: Client) -> None:
        self._sandbox_service = sandbox_service
        self._supabase = supabase_client
        settings = get_settings()
        self.anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key or "")
        self.model = settings.claude_synthesis_model

    @classmethod
    def from_env(cls) -> "SandboxExecutionService":
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise SandboxServiceError("Supabase service-role configuration is required for sandbox execution.")
        return cls(
            sandbox_service=get_sandbox_service(),
            supabase_client=create_client(settings.supabase_url, settings.supabase_service_role_key),
        )

    def run_execution(
        self,
        *,
        user_id: str,
        thread_id: str,
        task_summary: str,
        skill_file_ids: list[str] | None = None,
        max_rounds: int = 6,
        timeout_seconds: float = 90,
    ) -> SandboxExecutionResult:
        """Run a bounded native tool-use loop for sandbox execution."""
        scoped_file_ids = [str(item) for item in skill_file_ids or [] if str(item).strip()]
        file_context = self._skill_file_context(scoped_file_ids)
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
                system=SANDBOX_EXECUTION_SYSTEM_PROMPT,
                tools=SANDBOX_EXECUTION_TOOLS,  # type: ignore[arg-type]
                messages=messages,
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
                    tool_result_content, step = self._dispatch_tool(
                        user_id=user_id,
                        thread_id=thread_id,
                        timeout_seconds=timeout_seconds,
                        allowed_skill_file_ids=scoped_file_ids,
                        tool_name=block.name,
                        tool_input=block.input,
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
    ) -> tuple[str, dict[str, Any]]:
        try:
            result_dict = self._execute_tool(
                user_id=user_id,
                thread_id=thread_id,
                timeout_seconds=timeout_seconds,
                allowed_skill_file_ids=allowed_skill_file_ids,
                tool_name=tool_name,
                tool_input=tool_input,
            )
            step = {
                "tool_name": tool_name,
                "input_summary": _safe_input_summary(tool_input),
                "output_summary": _safe_output_summary(result_dict),
                "summary": f"{tool_name} completed.",
                "error": None,
            }
            return json.dumps(result_dict), step
        except Exception as exc:
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
        *,
        user_id: str,
        thread_id: str,
        timeout_seconds: float,
        allowed_skill_file_ids: list[str],
        tool_name: str,
        tool_input: dict[str, Any],
    ) -> dict[str, Any]:
        if tool_name == "execute_code":
            result = self._sandbox_service.execute_code(
                thread_id=thread_id,
                code=str(tool_input["code"]),
                timeout_seconds=timeout_seconds,
            )
            return {
                "thread_id": result.thread_id,
                "pod_name": result.pod_name,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code,
                "status": result.status,
            }

        if tool_name == "read_skill_file":
            skill_file_id = str(tool_input.get("skill_file_id") or "").strip()
            if skill_file_id not in set(allowed_skill_file_ids):
                raise SandboxServiceError("Skill file is not in scope for this run.")
            return self._read_skill_file(user_id=user_id, skill_file_id=skill_file_id)

        raise SandboxServiceError(f"Unknown tool: {tool_name!r}")

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
