"""Generic Domain Agents hard-harness engine.

The engine advances workflow steps deterministically. LLMs and sub-agents only
execute inside a step; they never choose ordering, skipping, or completion.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Iterator

import anthropic
from langsmith.wrappers import wrap_anthropic
from supabase import Client, create_client

from core.config import get_settings
from services.sub_agent_orchestrator import SubAgentOrchestrator, SubAgentRunRequest
from services.tool_registry import AgentCapabilityScopeSource, ToolRegistry, build_registry
from services.usage_events import anthropic_usage, log_ai_usage_event
from services.vector_store import VectorStore
from services.artifact_service import ArtifactService, ArtifactServiceError


DOMAIN_AGENT_SURFACE = "domain_agent"
SSE_EVENTS = {
    "task_ready",
    "task_step_start",
    "task_step_complete",
    "task_step_error",
    "task_blocked",
    "task_batch_progress",
    "task_sub_agent_start",
    "task_sub_agent_complete",
    "task_review",
    "task_done",
    "task_error",
}


class HarnessEngineError(RuntimeError):
    pass


ProgrammaticHandler = Callable[["HarnessEngine", dict[str, Any], dict[str, Any], dict[str, Any]], "StepResult | BlockedResult"]
PROGRAMMATIC_HANDLERS: dict[str, ProgrammaticHandler] = {}


def register_programmatic_handler(key: str) -> Callable[[ProgrammaticHandler], ProgrammaticHandler]:
    clean_key = str(key or "").strip()
    if not clean_key:
        raise HarnessEngineError("Programmatic handler key is required.")

    def _register(handler: ProgrammaticHandler) -> ProgrammaticHandler:
        PROGRAMMATIC_HANDLERS[clean_key] = handler
        return handler

    return _register


@dataclass(frozen=True)
class StepResult:
    summary: str
    output: dict[str, Any]
    workspace_path: str | None = None
    workspace_content: str | None = None
    source_refs: list[dict[str, Any]] | None = None


@dataclass(frozen=True)
class BlockedResult:
    question: str
    workspace_path: str | None = None
    details: dict[str, Any] | None = None


class HarnessEngine:
    def __init__(
        self,
        client: Client,
        *,
        store: VectorStore | None = None,
        anthropic_client: Any | None = None,
        sub_agent_factory: Callable[[], Any] | None = None,
        registry_factory: Callable[[str | None], ToolRegistry] | None = None,
        artifact_service_factory: Callable[[], ArtifactService] | None = None,
        model: str | None = None,
    ) -> None:
        self.client = client
        self.store = store
        self.settings = get_settings()
        self.model = model or self.settings.claude_synthesis_model
        self.provider = "anthropic"
        self.anthropic_client = anthropic_client or wrap_anthropic(anthropic.Anthropic(api_key=self.settings.anthropic_api_key or ""))
        self.sub_agent_factory = sub_agent_factory or (lambda: SubAgentOrchestrator.from_env())
        self.registry_factory = registry_factory or self._default_registry
        self.artifact_service_factory = artifact_service_factory or (lambda: ArtifactService(self.settings, self.client))

    @classmethod
    def from_env(cls) -> "HarnessEngine":
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise HarnessEngineError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
        client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        store = VectorStore(client, None, settings)
        return cls(client, store=store)

    def create_task(
        self,
        *,
        user_id: str,
        agent_id: str,
        workflow_id: str | None = None,
        origin: str,
        origin_thread_id: str | None = None,
        title: str | None = None,
    ) -> dict[str, Any]:
        if origin not in {"profile", "kanban", "vcso"}:
            raise HarnessEngineError("Task origin must be profile, kanban, or vcso.")
        workflow = self._load_workflow(workflow_id) if workflow_id else None
        row = {
            "user_id": user_id,
            "agent_id": agent_id,
            "workflow_id": workflow_id,
            "title": title or (workflow or {}).get("name") or "Domain Agent Task",
            "status": "ready",
            "current_step": 0,
            "step_results": {},
            "origin": origin,
            "origin_thread_id": origin_thread_id,
        }
        return _single_row(self.client.table("tasks").insert(row).execute(), "Could not create task.")

    def get_task_state(self, *, user_id: str, task_id: str) -> dict[str, Any]:
        task = self._load_task(user_id, task_id)
        workspace = self._list_workspace(user_id, task_id)
        workflow = self._load_workflow(task.get("workflow_id")) if task.get("workflow_id") else None
        steps = self._load_steps(task["workflow_id"]) if task.get("workflow_id") else []
        artifact = self._load_domain_artifact(user_id, task_id)
        return {
            "task": task,
            "workflow": workflow,
            "steps": [_step_public(step) for step in steps],
            "workspace": [_workspace_public(row) for row in workspace],
            "artifact": _artifact_public(artifact) if artifact else None,
            "resume": {
                "status": task.get("status"),
                "current_step": task.get("current_step") or 0,
                "next_step": _next_step_public(steps, int(task.get("current_step") or 0)),
            },
        }

    def run_task(self, *, user_id: str, task_id: str) -> Iterator[dict[str, Any]]:
        task = self._load_task(user_id, task_id)
        if task.get("status") == "done":
            yield self._event("task_done", task_id, status="done")
            return
        if task.get("status") == "review":
            artifact = self._register_review_artifact(user_id, task_id)
            yield self._event("task_review", task_id, artifact=artifact, artifact_id=(artifact or {}).get("id"), status="review")
            return
        if task.get("status") == "blocked":
            yield self._event("task_blocked", task_id, question=_blocked_question(task), status="blocked")
            return
        if not task.get("workflow_id"):
            blocked = BlockedResult("This task does not have a workflow yet.")
            self._block_task(task, blocked)
            yield self._event("task_blocked", task_id, question=blocked.question)
            return

        workflow = self._load_workflow(task["workflow_id"])
        steps = self._load_steps(task["workflow_id"])
        yield self._event("task_ready", task_id, status=task.get("status"), current_step=task.get("current_step") or 0)

        prereq_block = self._check_prereqs(task, workflow)
        if prereq_block is not None:
            self._block_task(task, prereq_block)
            yield self._event("task_blocked", task_id, question=prereq_block.question, details=prereq_block.details or {})
            return

        self._update_task(user_id, task_id, status="running")
        current = int(task.get("current_step") or 0)
        while current < len(steps):
            task = self._load_task(user_id, task_id)
            if self._cancel_requested(task):
                blocked = BlockedResult("Task paused by request.", details={"cancel_requested": True})
                self._block_task(task, blocked)
                yield self._event("task_blocked", task_id, question=blocked.question, details=blocked.details or {})
                return

            step = steps[current]
            yield self._event(
                "task_step_start",
                task_id,
                index=step["position"],
                name=step["name"],
                type=step["step_type"],
            )
            try:
                for item in self._execute_step(task, workflow, step):
                    if isinstance(item, BlockedResult):
                        self._block_task(task, item)
                        yield self._event("task_blocked", task_id, question=item.question, details=item.details or {})
                        return
                    if isinstance(item, StepResult):
                        self._persist_step_result(task, step, item)
                        current += 1
                        self._update_task(user_id, task_id, current_step=current)
                        yield self._event(
                            "task_step_complete",
                            task_id,
                            index=step["position"],
                            summary=item.summary,
                        )
                    else:
                        yield item
            except Exception as exc:
                self._record_step_error(task, step, exc)
                yield self._event("task_step_error", task_id, index=step["position"], error=str(exc))
                yield self._event("task_error", task_id, error=str(exc))
                return

        self._update_task(user_id, task_id, status="review", current_step=len(steps))
        artifact = self._register_review_artifact(user_id, task_id)
        yield self._event("task_review", task_id, artifact=artifact, artifact_id=(artifact or {}).get("id"), status="review")

    def record_human_reply(self, *, user_id: str, task_id: str, message: str) -> dict[str, Any]:
        task = self._load_task(user_id, task_id)
        steps = self._load_steps(task["workflow_id"]) if task.get("workflow_id") else []
        index = int(task.get("current_step") or 0)
        step = steps[index] if index < len(steps) else None
        file_path = (step or {}).get("workspace_output") or f"human-input/{uuid.uuid4()}.md"
        self._write_workspace(task, file_path, message, source="upload")
        results = dict(task.get("step_results") or {})
        results["_blocked"] = None
        self._update_task(user_id, task_id, status="running", step_results=results)
        return self.get_task_state(user_id=user_id, task_id=task_id)

    def add_workspace_file(
        self,
        *,
        user_id: str,
        task_id: str,
        file_path: str,
        content: str | None = None,
        storage_path: str | None = None,
        source: str = "upload",
    ) -> dict[str, Any]:
        task = self._load_task(user_id, task_id)
        self._write_workspace(task, file_path, content, storage_path=storage_path, source=source)
        if task.get("status") == "blocked":
            results = dict(task.get("step_results") or {})
            results["_blocked"] = None
            self._update_task(user_id, task_id, status="running", step_results=results)
        return self.get_task_state(user_id=user_id, task_id=task_id)

    def request_cancel(self, *, user_id: str, task_id: str) -> dict[str, Any]:
        task = self._load_task(user_id, task_id)
        results = dict(task.get("step_results") or {})
        control = dict(results.get("_control") or {})
        control["cancel_requested"] = True
        control["requested_at"] = _now()
        results["_control"] = control
        self._update_task(user_id, task_id, step_results=results)
        return self.get_task_state(user_id=user_id, task_id=task_id)

    def _execute_step(self, task: dict[str, Any], workflow: dict[str, Any], step: dict[str, Any]) -> Iterator[Any]:
        step_type = step["step_type"]
        if step_type == "programmatic":
            yield self._execute_programmatic(task, workflow, step)
        elif step_type == "llm_single":
            yield self._execute_llm_single(task, workflow, step)
        elif step_type == "llm_agent":
            yield from self._execute_llm_agent(task, step)
        elif step_type == "llm_batch_agents":
            yield from self._execute_llm_batch_agents(task, step)
        elif step_type == "llm_human_input":
            yield self._execute_human_input(task, step)
        else:
            raise HarnessEngineError(f"Unsupported step type: {step_type}")

    def _execute_programmatic(self, task: dict[str, Any], workflow: dict[str, Any], step: dict[str, Any]) -> StepResult | BlockedResult:
        schema = step.get("output_schema") or {}
        mode = schema.get("mode") if isinstance(schema, dict) else None
        output_path = step.get("workspace_output")
        if mode == "copy_workspace":
            source_path = _first_workspace_input(step)
            content = self._read_workspace_content(task, source_path) if source_path else ""
        elif mode == "join_workspace":
            pieces = [self._read_workspace_content(task, path) for path in _workspace_input_paths(step)]
            content = "\n\n".join(piece for piece in pieces if piece)
        elif mode == "handler":
            handler_key = str(schema.get("handler") or "").strip()
            handler = PROGRAMMATIC_HANDLERS.get(handler_key)
            if handler is None:
                raise HarnessEngineError(f"Unknown programmatic handler: {handler_key or '(empty)'}")
            return handler(self, task, workflow, step)
        else:
            content = str(schema.get("content") or f"{step['name']} completed for workflow {workflow.get('key')}.")
        output = {
            "schema_version": "harness_step_result_v1",
            "mode": mode or "static",
            "workspace_paths": _workspace_input_paths(step),
            "output_path": output_path,
        }
        return StepResult(
            summary=f"{step['name']} completed.",
            output=output,
            workspace_path=output_path,
            workspace_content=content if output_path else None,
        )

    def _execute_llm_single(self, task: dict[str, Any], workflow: dict[str, Any], step: dict[str, Any]) -> StepResult:
        schema = _claude_output_schema(step.get("output_schema") or {})
        tools = [
            {
                "name": "record_step_output",
                "description": "Return the structured output for this workflow step.",
                "input_schema": schema,
            }
        ]
        prompt = self._step_prompt(task, workflow, step)
        response = self.anthropic_client.messages.create(
            model=self.model,
            max_tokens=1200,
            system=step.get("system_prompt_template") or "Complete this workflow step with structured output.",
            tools=tools,
            tool_choice={"type": "tool", "name": "record_step_output"},
            messages=[{"role": "user", "content": prompt}],
        )
        usage = anthropic_usage(response)
        log_ai_usage_event(
            self.client,
            user_id=task["user_id"],
            surface="domain_agents",
            model=self.model,
            role="main",
            provider=self.provider,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            skill_id=step.get("skill_id"),
            capability_key=step.get("capability_key"),
            task_id=task["id"],
        )
        output = _extract_tool_output(response)
        _validate_required(output, schema)
        content = json.dumps(output, indent=2)
        return StepResult(
            summary=str(output.get("summary") or f"{step['name']} completed."),
            output=output,
            workspace_path=step.get("workspace_output"),
            workspace_content=content if step.get("workspace_output") else None,
            source_refs=output.get("source_refs") if isinstance(output.get("source_refs"), list) else None,
        )

    def _execute_llm_agent(self, task: dict[str, Any], step: dict[str, Any]) -> Iterator[Any]:
        scoped_tools = self._scoped_tool_names(step)
        capability_key = step.get("capability_key")
        if not capability_key:
            raise HarnessEngineError("llm_agent steps require capability_key.")
        yield self._event(
            "task_sub_agent_start",
            task["id"],
            ref=capability_key,
            summary=f"Starting {capability_key}.",
        )
        result = self.sub_agent_factory().start_run(
            SubAgentRunRequest(
                user_id=task["user_id"],
                parent_surface="domain_agent",
                capability_key=capability_key,
                task_summary=self._task_summary_for_step(task, step),
                context_scope={
                    "task_id": task["id"],
                    "workspace_paths": _workspace_input_paths(step),
                    "allowed_tools": scoped_tools,
                },
                task_title=step.get("name"),
                parent_thread_id=task.get("origin_thread_id"),
            )
        )
        log_ai_usage_event(
            self.client,
            user_id=task["user_id"],
            surface="domain_agents",
            model=str(getattr(result, "model", None) or capability_key),
            role="sub_agent",
            provider=None,
            capability_key=capability_key,
            run_id=result.run_id,
            task_id=task["id"],
        )
        yield self._event(
            "task_sub_agent_complete",
            task["id"],
            ref=result.run_id,
            summary=result.result_summary or "Sub-agent completed.",
        )
        yield StepResult(
            summary=result.result_summary or "Sub-agent completed.",
            output={
                "run_id": result.run_id,
                "status": result.status,
                "structured_result": result.structured_result,
                "trace": _curated_trace(result.trace),
                "citations": result.citations,
                "allowed_tools": scoped_tools,
            },
            workspace_path=step.get("workspace_output"),
            workspace_content=json.dumps(result.structured_result or {}, indent=2) if step.get("workspace_output") else None,
            source_refs=result.citations,
        )

    def _execute_llm_batch_agents(self, task: dict[str, Any], step: dict[str, Any]) -> Iterator[Any]:
        capability_key = step.get("capability_key")
        if not capability_key:
            raise HarnessEngineError("llm_batch_agents steps require capability_key.")
        output_path = step.get("workspace_output")
        completed = self._read_batch_output(task, output_path)
        completed_indexes = {int(item["item_index"]) for item in completed if "item_index" in item}
        items = self._batch_items(task, step)
        pending = [(index, item) for index, item in enumerate(items) if index not in completed_indexes]
        if pending:
            results = asyncio.run(self._run_batch_items(task, step, pending))
            for item in results:
                completed.append(item)
                self._write_workspace(task, output_path, json.dumps(completed, indent=2), source="agent")
                yield self._event(
                    "task_batch_progress",
                    task["id"],
                    done=len(completed),
                    total=len(items),
                )
        yield StepResult(
            summary=f"Batch completed {len(completed)} of {len(items)} item(s).",
            output={"items": completed, "total": len(items), "resumed_from_partial": bool(completed_indexes)},
            workspace_path=output_path,
            workspace_content=json.dumps(completed, indent=2) if output_path else None,
        )

    def _execute_human_input(self, task: dict[str, Any], step: dict[str, Any]) -> StepResult | BlockedResult:
        output_path = step.get("workspace_output")
        if output_path:
            answer = self._read_workspace_content(task, output_path)
            if answer.strip():
                return StepResult(
                    summary="Founder input received.",
                    output={"workspace_path": output_path, "answer_chars": len(answer)},
                    workspace_path=output_path,
                    workspace_content=answer,
                )
        question = _human_question(step)
        return BlockedResult(question=question, workspace_path=output_path, details={"step": step["position"]})

    async def _run_batch_items(self, task: dict[str, Any], step: dict[str, Any], pending: list[tuple[int, Any]]) -> list[dict[str, Any]]:
        async def _run(index: int, item: Any) -> dict[str, Any]:
            result = await asyncio.to_thread(self._run_one_batch_item, task, step, index, item)
            return result

        return await asyncio.gather(*[_run(index, item) for index, item in pending])

    def _run_one_batch_item(self, task: dict[str, Any], step: dict[str, Any], index: int, item: Any) -> dict[str, Any]:
        capability_key = str(step.get("capability_key"))
        scoped_tools = self._scoped_tool_names(step)
        result = self.sub_agent_factory().start_run(
            SubAgentRunRequest(
                user_id=task["user_id"],
                parent_surface="domain_agent",
                capability_key=capability_key,
                task_summary=f"{self._task_summary_for_step(task, step)}\n\nBatch item {index + 1}: {json.dumps(item)}",
                context_scope={"task_id": task["id"], "batch_item": item, "batch_index": index, "allowed_tools": scoped_tools},
                task_title=f"{step.get('name')} item {index + 1}",
                parent_thread_id=task.get("origin_thread_id"),
            )
        )
        log_ai_usage_event(
            self.client,
            user_id=task["user_id"],
            surface="domain_agents",
            model=capability_key,
            role="sub_agent",
            provider=None,
            capability_key=capability_key,
            run_id=result.run_id,
            task_id=task["id"],
        )
        return {
            "item_index": index,
            "run_id": result.run_id,
            "status": result.status,
            "summary": result.result_summary,
            "structured_result": result.structured_result,
            "trace": _curated_trace(result.trace),
            "citations": result.citations,
        }

    def _check_prereqs(self, task: dict[str, Any], workflow: dict[str, Any]) -> BlockedResult | None:
        prereqs = workflow.get("prereqs") or {}
        required = []
        if isinstance(prereqs, dict):
            required = prereqs.get("required_workspace_files") or prereqs.get("required_files") or []
        if not isinstance(required, list) or not required:
            return None
        existing = {row["file_path"] for row in self._list_workspace(task["user_id"], task["id"])}
        missing = [str(path) for path in required if str(path) not in existing]
        if not missing:
            return None
        return BlockedResult(
            question=f"Please upload or provide the required workspace file(s): {', '.join(missing)}.",
            details={"missing_workspace_files": missing},
        )

    def _scoped_tool_names(self, step: dict[str, Any]) -> list[str]:
        names = _string_list(step.get("tools"))
        capability = step.get("capability_key")
        if not capability:
            return names
        registry = self.registry_factory(capability)
        return [tool.name for tool in registry.get_tools(surface=DOMAIN_AGENT_SURFACE, capability=capability, names=names or None)]

    def _default_registry(self, _capability: str | None) -> ToolRegistry:
        if self.store is not None:
            return build_registry(store=self.store, scope_source=AgentCapabilityScopeSource(self.store))
        return build_registry(supabase_client=self.client)

    def _step_prompt(self, task: dict[str, Any], workflow: dict[str, Any], step: dict[str, Any]) -> str:
        workspace_paths = _workspace_input_paths(step)
        workspace_index = [{"path": path, "present": bool(self._read_workspace_content(task, path))} for path in workspace_paths]
        return "\n".join(
            [
                f"Task: {task.get('title')}",
                f"Workflow: {workflow.get('name')}",
                f"Step: {step.get('name')} ({step.get('step_type')})",
                f"Workspace inputs, paths only: {json.dumps(workspace_index)}",
                "Return only the required structured output using the provided tool schema.",
            ]
        )

    def _task_summary_for_step(self, task: dict[str, Any], step: dict[str, Any]) -> str:
        return f"Task {task.get('title') or task['id']} - step {step.get('position')}: {step.get('name')}"

    def _batch_items(self, task: dict[str, Any], step: dict[str, Any]) -> list[Any]:
        path = _first_workspace_input(step)
        if not path:
            return []
        content = self._read_workspace_content(task, path)
        if not content.strip():
            return []
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            parsed = [line.strip() for line in content.splitlines() if line.strip()]
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict) and isinstance(parsed.get("items"), list):
            return parsed["items"]
        return [parsed]

    def _read_batch_output(self, task: dict[str, Any], output_path: str | None) -> list[dict[str, Any]]:
        if not output_path:
            return []
        content = self._read_workspace_content(task, output_path)
        if not content.strip():
            return []
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            return []
        return parsed if isinstance(parsed, list) else []

    def _persist_step_result(self, task: dict[str, Any], step: dict[str, Any], result: StepResult) -> None:
        if result.workspace_path and result.workspace_content is not None:
            self._write_workspace(task, result.workspace_path, result.workspace_content, source="agent")
        results = dict(task.get("step_results") or {})
        results[str(step["position"])] = {
            "step_id": step["id"],
            "step_type": step["step_type"],
            "name": step["name"],
            "summary": result.summary,
            "output": result.output,
            "workspace_path": result.workspace_path,
            "source_refs": result.source_refs or [],
            "completed_at": _now(),
        }
        self._update_task(task["user_id"], task["id"], step_results=results)

    def _record_step_error(self, task: dict[str, Any], step: dict[str, Any], exc: Exception) -> None:
        results = dict(task.get("step_results") or {})
        results[str(step["position"])] = {
            "step_id": step["id"],
            "step_type": step["step_type"],
            "name": step["name"],
            "error": str(exc),
            "failed_at": _now(),
        }
        self._update_task(task["user_id"], task["id"], step_results=results)

    def _block_task(self, task: dict[str, Any], blocked: BlockedResult) -> None:
        results = dict(task.get("step_results") or {})
        results["_blocked"] = {
            "question": blocked.question,
            "workspace_path": blocked.workspace_path,
            "details": blocked.details or {},
            "blocked_at": _now(),
        }
        self._update_task(task["user_id"], task["id"], status="blocked", step_results=results)

    def _cancel_requested(self, task: dict[str, Any]) -> bool:
        return bool(((task.get("step_results") or {}).get("_control") or {}).get("cancel_requested"))

    def _load_task(self, user_id: str, task_id: str) -> dict[str, Any]:
        rows = self.client.table("tasks").select("*").eq("id", task_id).eq("user_id", user_id).limit(1).execute().data or []
        if not rows:
            raise HarnessEngineError("Task not found.")
        return rows[0]

    def _load_workflow(self, workflow_id: str | None) -> dict[str, Any]:
        if not workflow_id:
            raise HarnessEngineError("Workflow is required.")
        rows = self.client.table("workflows").select("*").eq("id", workflow_id).limit(1).execute().data or []
        if not rows:
            raise HarnessEngineError("Workflow not found.")
        return rows[0]

    def _load_steps(self, workflow_id: str) -> list[dict[str, Any]]:
        return self.client.table("workflow_steps").select("*").eq("workflow_id", workflow_id).order("position").execute().data or []

    def _list_workspace(self, user_id: str, task_id: str) -> list[dict[str, Any]]:
        return (
            self.client.table("workspace_files")
            .select("*")
            .eq("owner_type", "task")
            .eq("owner_id", task_id)
            .eq("user_id", user_id)
            .order("file_path")
            .execute()
            .data
            or []
        )

    def _load_domain_artifact(self, user_id: str, task_id: str) -> dict[str, Any] | None:
        rows = (
            self.client.table("artifacts")
            .select("*")
            .eq("user_id", user_id)
            .eq("source_kind", "domain_agent_task")
            .eq("task_id", task_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        return rows[0] if rows else None

    def _read_workspace_content(self, task: dict[str, Any], path: str | None) -> str:
        if not path:
            return ""
        rows = (
            self.client.table("workspace_files")
            .select("content")
            .eq("owner_type", "task")
            .eq("owner_id", task["id"])
            .eq("user_id", task["user_id"])
            .eq("file_path", path)
            .limit(1)
            .execute()
            .data
            or []
        )
        return str((rows[0] if rows else {}).get("content") or "")

    def _write_workspace(
        self,
        task: dict[str, Any],
        file_path: str | None,
        content: str | None,
        *,
        storage_path: str | None = None,
        source: str,
    ) -> None:
        if not file_path:
            return
        row = {
            "owner_type": "task",
            "owner_id": task["id"],
            "user_id": task["user_id"],
            "file_path": _clean_workspace_path(file_path),
            "content": content,
            "storage_path": storage_path,
            "source": source,
            "size": len(content.encode("utf-8")) if content is not None else None,
        }
        self.client.table("workspace_files").upsert(row, on_conflict="owner_type,owner_id,file_path").execute()

    def _update_task(self, user_id: str, task_id: str, **values: Any) -> None:
        values["updated_at"] = _now()
        self.client.table("tasks").update(values).eq("id", task_id).eq("user_id", user_id).execute()

    def _register_review_artifact(self, user_id: str, task_id: str) -> dict[str, Any] | None:
        try:
            result = self.artifact_service_factory().register_domain_artifact(
                user_id=user_id,
                task_id=task_id,
                workspace_path="artifact.html",
            )
            return result.to_dict()
        except ArtifactServiceError:
            return None

    def _event(self, event: str, task_id: str, **data: Any) -> dict[str, Any]:
        if event not in SSE_EVENTS:
            raise HarnessEngineError(f"Unknown task SSE event: {event}")
        return {"event": event, "data": {"task_id": task_id, **data}}


def _single_row(response: Any, message: str) -> dict[str, Any]:
    data = getattr(response, "data", None)
    if isinstance(data, list) and data:
        return data[0]
    if isinstance(data, dict):
        return data
    raise HarnessEngineError(message)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_workspace_path(path: str) -> str:
    clean = path.replace("\\", "/").strip().lstrip("/")
    if not clean or ".." in clean.split("/") or len(clean) > 500:
        raise HarnessEngineError("Invalid workspace file path.")
    return clean


def _workspace_input_paths(step: dict[str, Any]) -> list[str]:
    raw = step.get("workspace_inputs") or []
    if isinstance(raw, dict):
        raw = raw.get("paths") or raw.get("files") or ([raw.get("path")] if raw.get("path") else [])
    return [str(item) for item in raw if str(item or "").strip()]


def _first_workspace_input(step: dict[str, Any]) -> str | None:
    paths = _workspace_input_paths(step)
    return paths[0] if paths else None


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item or "").strip()]


def _claude_output_schema(schema: dict[str, Any]) -> dict[str, Any]:
    if schema.get("type") == "object":
        return schema
    properties = schema.get("properties") if isinstance(schema.get("properties"), dict) else None
    return {
        "type": "object",
        "properties": properties
        or {
            "summary": {"type": "string"},
            "findings": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
        },
        "required": schema.get("required") if isinstance(schema.get("required"), list) else ["summary"],
        "additionalProperties": True,
    }


def _extract_tool_output(response: Any) -> dict[str, Any]:
    for block in getattr(response, "content", []) or []:
        if getattr(block, "type", None) == "tool_use" and getattr(block, "name", None) == "record_step_output":
            data = getattr(block, "input", None)
            return dict(data or {})
    text = "\n".join(str(getattr(block, "text", "")) for block in getattr(response, "content", []) or [])
    return {"summary": text.strip() or "Step completed."}


def _validate_required(output: dict[str, Any], schema: dict[str, Any]) -> None:
    for key in schema.get("required") or []:
        if key not in output:
            raise HarnessEngineError(f"Structured output missing required field: {key}")


def _human_question(step: dict[str, Any]) -> str:
    schema = step.get("output_schema") or {}
    question = schema.get("question") if isinstance(schema, dict) else None
    return str(question or f"Please provide the input needed for: {step.get('name')}.")


def _blocked_question(task: dict[str, Any]) -> str:
    blocked = (task.get("step_results") or {}).get("_blocked") or {}
    return str(blocked.get("question") or "This task is waiting on you.")


def _curated_trace(trace: list[dict[str, Any]]) -> list[dict[str, Any]]:
    curated = []
    for step in trace or []:
        curated.append(
            {
                "step_index": step.get("step_index"),
                "step_type": step.get("step_type"),
                "status": step.get("status"),
                "tool_name": step.get("tool_name"),
                "title": step.get("title"),
                "summary": step.get("summary"),
                "source_refs": step.get("source_refs") or [],
                "error_message": step.get("error_message"),
            }
        )
    return curated


def _step_public(step: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": step.get("id"),
        "position": step.get("position"),
        "name": step.get("name"),
        "step_type": step.get("step_type"),
        "workspace_inputs": step.get("workspace_inputs") or [],
        "workspace_output": step.get("workspace_output"),
    }


def _next_step_public(steps: list[dict[str, Any]], current_step: int) -> dict[str, Any] | None:
    if current_step < 0 or current_step >= len(steps):
        return None
    return _step_public(steps[current_step])


def _workspace_public(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "file_path": row.get("file_path"),
        "source": row.get("source"),
        "size": row.get("size"),
        "storage_path": row.get("storage_path"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _artifact_public(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "filename": row.get("filename"),
        "promoted_to_kb": bool(row.get("promoted_to_kb")),
        "source_kind": row.get("source_kind"),
        "task_id": row.get("task_id"),
    }
