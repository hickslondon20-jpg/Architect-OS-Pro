"""Domain Agent task execution endpoints."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from routers.kb_folders import get_current_user_id
from services.harness_engine import HarnessEngine, HarnessEngineError
from services.doc_wiki_agent_artifact_adapter import DocWikiAgentArtifactAdapter
from services.doc_wiki_synthesis import DocWikiSynthesisService
from services import harness_handlers as _harness_handlers  # noqa: F401


router = APIRouter()


class TaskCreateRequest(BaseModel):
    agent_id: UUID
    workflow_id: UUID | None = None
    origin: str = Field(..., pattern="^(profile|kanban|vcso)$")
    origin_thread_id: UUID | None = None
    title: str | None = Field(default=None, max_length=240)


class HumanReplyRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=20000)


class WorkspaceFileRequest(BaseModel):
    file_path: str = Field(..., min_length=1, max_length=500)
    content: str | None = Field(default=None, max_length=1000000)
    storage_path: str | None = None


class TaskPromoteRequest(BaseModel):
    artifact_id: UUID | None = None


@router.get("")
def list_tasks(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    agent: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, max_length=240),
    date_from: str | None = Query(default=None, alias="dateFrom"),
    date_to: str | None = Query(default=None, alias="dateTo"),
) -> dict:
    client = HarnessEngine.from_env().client
    query = (
        client.table("tasks")
        .select("*,domain_agents!inner(id,key,name,color),workflows(id,name,description)")
        .eq("user_id", str(user_id))
        .order("updated_at", desc=True)
    )
    if agent and agent != "all":
        query = query.eq("domain_agents.key", agent)
    if status_filter and status_filter != "all":
        query = query.eq("status", status_filter)
    if date_from:
        query = query.gte("created_at", date_from)
    if date_to:
        query = query.lte("created_at", date_to)
    rows = query.execute().data or []
    if q:
        lowered = q.lower()
        rows = [row for row in rows if lowered in str(row.get("title") or "").lower()]
    return {"tasks": [_task_payload(row) for row in rows]}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreateRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> dict:
    try:
        return HarnessEngine.from_env().create_task(
            user_id=str(user_id),
            agent_id=str(payload.agent_id),
            workflow_id=str(payload.workflow_id) if payload.workflow_id else None,
            origin=payload.origin,
            origin_thread_id=str(payload.origin_thread_id) if payload.origin_thread_id else None,
            title=payload.title,
        )
    except HarnessEngineError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{task_id}")
def get_task(
    task_id: UUID,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> dict:
    try:
        return HarnessEngine.from_env().get_task_state(user_id=str(user_id), task_id=str(task_id))
    except HarnessEngineError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{task_id}/files/{file_path:path}")
def get_task_file(
    task_id: UUID,
    file_path: str,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> dict:
    clean_path = _clean_workspace_read_path(file_path)
    client = HarnessEngine.from_env().client
    task_rows = client.table("tasks").select("id").eq("id", str(task_id)).eq("user_id", str(user_id)).limit(1).execute().data or []
    if not task_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    rows = (
        client.table("workspace_files")
        .select("id,file_path,content,source,size,storage_path,created_at,updated_at")
        .eq("owner_type", "task")
        .eq("owner_id", str(task_id))
        .eq("user_id", str(user_id))
        .eq("file_path", clean_path)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace file not found.")
    return rows[0]


@router.post("/{task_id}/run")
def run_task(
    task_id: UUID,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> StreamingResponse:
    def event_stream():
        try:
            for item in HarnessEngine.from_env().run_task(user_id=str(user_id), task_id=str(task_id)):
                yield _sse(item["event"], item["data"])
        except Exception as exc:
            yield _sse("task_error", {"task_id": str(task_id), "error": str(exc) or "Task stream failed."})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{task_id}/messages")
def reply_to_task(
    task_id: UUID,
    payload: HumanReplyRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> dict:
    try:
        return HarnessEngine.from_env().record_human_reply(user_id=str(user_id), task_id=str(task_id), message=payload.message)
    except HarnessEngineError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{task_id}/files")
def add_task_file(
    task_id: UUID,
    payload: WorkspaceFileRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> dict:
    try:
        return HarnessEngine.from_env().add_workspace_file(
            user_id=str(user_id),
            task_id=str(task_id),
            file_path=payload.file_path,
            content=payload.content,
            storage_path=payload.storage_path,
            source="upload",
        )
    except HarnessEngineError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{task_id}/cancel")
def cancel_task(
    task_id: UUID,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> dict:
    try:
        return HarnessEngine.from_env().request_cancel(user_id=str(user_id), task_id=str(task_id))
    except HarnessEngineError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{task_id}/promote")
async def promote_task_artifact(
    task_id: UUID,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    payload: TaskPromoteRequest | None = None,
) -> dict:
    client = HarnessEngine.from_env().client
    task_rows = client.table("tasks").select("id").eq("id", str(task_id)).eq("user_id", str(user_id)).limit(1).execute().data or []
    if not task_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    artifact_query = (
        client.table("artifacts")
        .select("*")
        .eq("user_id", str(user_id))
        .eq("source_kind", "domain_agent_task")
        .eq("task_id", str(task_id))
    )
    if payload and payload.artifact_id:
        artifact_query = artifact_query.eq("id", str(payload.artifact_id))
    artifact_rows = artifact_query.order("updated_at", desc=True).limit(1).execute().data or []
    if not artifact_rows:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Task does not have a registered artifact yet.")
    artifact = artifact_rows[0]
    try:
        adapter = DocWikiAgentArtifactAdapter(client, DocWikiSynthesisService.from_env())
        result = await adapter.synthesize_from_task(str(task_id), str(user_id), artifact_id=str(artifact["id"]))
        client.table("artifacts").update({"promoted_to_kb": True}).eq("id", str(artifact["id"])).eq("user_id", str(user_id)).execute()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not promote artifact: {exc}") from exc
    return {
        "task_id": str(task_id),
        "artifact_id": str(artifact["id"]),
        "promoted_to_kb": True,
        "synthesis": {
            "synthesis_job_id": getattr(result, "synthesis_job_id", None) if result else None,
            "page_ids": getattr(result, "page_ids", []) if result else [],
            "pages_created": getattr(result, "pages_created", 0) if result else 0,
            "pages_updated": getattr(result, "pages_updated", 0) if result else 0,
            "pages_skipped": getattr(result, "pages_skipped", 0) if result else 0,
        },
    }


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"


def _task_payload(row: dict) -> dict:
    agent = row.get("domain_agents") or {}
    workflow = row.get("workflows") or {}
    step_results = row.get("step_results") or {}
    resources = _resources(step_results)
    steps = _progress_from_results(row)
    status_value = row.get("status") or "ready"
    blocked = step_results.get("_blocked") if isinstance(step_results, dict) else None
    return {
        "id": row.get("id"),
        "title": row.get("title") or workflow.get("name") or "Domain Agent Task",
        "agentId": agent.get("key"),
        "workflowId": row.get("workflow_id"),
        "status": status_value,
        "runLabel": f"run · {_short_date(row.get('created_at'))}",
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
        "resources": resources,
        "waitingOn": (blocked or {}).get("question") if isinstance(blocked, dict) else None,
        "messages": _messages_from_results(row, workflow),
        "progress": steps,
        "artifactId": _artifact_id(step_results),
    }


def _messages_from_results(row: dict, workflow: dict) -> list[dict]:
    messages = [
        {
            "id": f"{row.get('id')}-intro",
            "role": "agent",
            "content": f"I am ready to run {workflow.get('name') or row.get('title') or 'this task'} as a bounded Domain Agent workflow.",
        }
    ]
    step_results = row.get("step_results") or {}
    if isinstance(step_results, dict):
        for key in sorted([item for item in step_results.keys() if str(item).isdigit()], key=lambda item: int(item)):
            result = step_results.get(key) or {}
            if isinstance(result, dict) and result.get("summary"):
                messages.append({"id": f"{row.get('id')}-step-{key}", "role": "agent", "content": str(result["summary"])})
        blocked = step_results.get("_blocked")
        if isinstance(blocked, dict) and blocked.get("question"):
            messages.append(
                {
                    "id": f"{row.get('id')}-blocked",
                    "role": "agent",
                    "content": str(blocked["question"]),
                    "uploadPrompt": str(blocked["question"]),
                }
            )
    return messages


def _progress_from_results(row: dict) -> list[dict]:
    step_results = row.get("step_results") or {}
    completed = {int(key) for key in step_results.keys() if str(key).isdigit()} if isinstance(step_results, dict) else set()
    current = int(row.get("current_step") or 0)
    status_value = row.get("status") or "ready"
    labels = ["Intake", "Clarify context", "Analyze", "Draft artifact", "Review"]
    progress = []
    for index, label in enumerate(labels):
        position = index + 1
        state = "pending"
        if position in completed or status_value in {"review", "done"}:
            state = "done"
        elif index == current or (status_value == "blocked" and index == current):
            state = "current"
        progress.append({"label": "Waiting on founder input" if status_value == "blocked" and index == current else label, "state": state})
    if status_value == "review":
        progress[-1] = {"label": "Await founder review", "state": "current"}
    if status_value == "done":
        progress[-1] = {"label": "Founder accepted artifact", "state": "done"}
    return progress


def _resources(step_results: dict) -> list[str]:
    resources = []
    if not isinstance(step_results, dict):
        return resources
    for result in step_results.values():
        if isinstance(result, dict) and result.get("workspace_path"):
            resources.append(str(result["workspace_path"]))
    return list(dict.fromkeys(resources))


def _artifact_id(step_results: dict) -> str | None:
    if not isinstance(step_results, dict):
        return None
    for result in step_results.values():
        if isinstance(result, dict):
            output = result.get("output")
            if isinstance(output, dict) and output.get("artifact_id"):
                return str(output["artifact_id"])
    return None


def _short_date(value: str | None) -> str:
    if not value:
        return "created"
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        days = max(0, (now - parsed.astimezone(timezone.utc)).days)
        if days == 0:
            return "today"
        if days == 1:
            return "1d ago"
        return f"{days}d ago"
    except Exception:
        return str(value)


def _clean_workspace_read_path(file_path: str) -> str:
    normalized = file_path.replace("\\", "/").strip("/")
    parts = [part for part in normalized.split("/") if part]
    if not parts or any(part in {".", ".."} for part in parts):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid workspace file path.")
    return "/".join(parts)
