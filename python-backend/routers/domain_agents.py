"""Domain Agents read endpoints for the founder-facing surfaces."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.config import get_settings
from routers.kb_folders import get_current_user_id
from services.harness_engine import HarnessEngine, HarnessEngineError


router = APIRouter()


class FreeformRequest(BaseModel):
    request: str = Field(..., min_length=1, max_length=4000)


def _client():
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Supabase backend is not configured.")
    return HarnessEngine.from_env().client


@router.get("/api/domain-agents")
def list_domain_agents(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> dict[str, Any]:
    client = _client()
    agents = _active_agents(client)
    workflows = _workflows_by_agent(client)
    task_rows = _task_rows(client, str(user_id))
    task_counts = _task_activity_by_agent(task_rows)
    return {"agents": [_agent_payload(agent, workflows.get(agent["id"], []), task_counts.get(agent["id"])) for agent in agents]}


@router.get("/api/domain-agents/{agent_key}")
def get_domain_agent(
    agent_key: str,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> dict[str, Any]:
    client = _client()
    agent = _agent_by_key(client, agent_key)
    workflows = _workflows_by_agent(client).get(agent["id"], [])
    task_rows = [row for row in _task_rows(client, str(user_id)) if row.get("agent_id") == agent.get("id")]
    artifacts = _artifact_rows(client, str(user_id), agent_id=agent.get("id"), limit=5)
    return {
        "agent": _agent_payload(agent, workflows, _task_activity_by_agent(task_rows).get(agent["id"])),
        "recentTasks": [_task_summary(row, agent, workflows) for row in task_rows[:5]],
        "recentArtifacts": [_artifact_payload(row, agent=agent) for row in artifacts],
    }


@router.post("/api/domain-agents/{agent_key}/freeform", status_code=status.HTTP_201_CREATED)
def create_freeform_request(
    agent_key: str,
    payload: FreeformRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> dict[str, Any]:
    client = _client()
    agent = _agent_by_key(client, agent_key)
    workflows = _workflows_by_agent(client).get(agent["id"], [])
    workflow = _map_workflow(payload.request, workflows, agent)
    inserted = _single_row(
        client.table("freeform_requests")
        .insert(
            {
                "user_id": str(user_id),
                "agent_id": agent["id"],
                "raw_text": payload.request.strip(),
                "mapped": bool(workflow),
                "mapped_workflow_id": workflow.get("id") if workflow else None,
            }
        )
        .execute(),
        "Could not capture request.",
    )

    task = None
    if workflow:
        try:
            task = HarnessEngine.from_env().create_task(
                user_id=str(user_id),
                agent_id=str(agent["id"]),
                workflow_id=str(workflow["id"]),
                origin="profile",
                title=workflow.get("name") or "Domain Agent Task",
            )
            client.table("freeform_requests").update({"resulting_task_id": task["id"]}).eq("id", inserted["id"]).execute()
        except HarnessEngineError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return {
        "request": {
            "id": inserted["id"],
            "agentId": agent["key"],
            "request": inserted["raw_text"],
            "mappedWorkflowId": str(workflow["id"]) if workflow else None,
            "capturedAt": inserted.get("created_at"),
        },
        "mapped": bool(workflow),
        "task": task,
    }


@router.get("/api/artifacts")
def list_artifacts(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    agent: str | None = Query(default=None),
    workflow: str | None = Query(default=None),
    type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
) -> dict[str, Any]:
    client = _client()
    agent_row = _agent_by_key(client, agent) if agent and agent != "all" else None
    rows = _artifact_rows(client, str(user_id), agent_id=agent_row.get("id") if agent_row else None, workflow_id=workflow, limit=limit)
    if type and type != "all":
        rows = [row for row in rows if _artifact_type(row) == type]
    agents_by_id = {row["id"]: row for row in _active_agents(client)}
    return {"artifacts": [_artifact_payload(row, agent=agents_by_id.get(row.get("agent_id"))) for row in rows]}


def _active_agents(client: Any) -> list[dict[str, Any]]:
    return client.table("domain_agents").select("*").eq("is_active", True).order("created_at").execute().data or []


def _agent_by_key(client: Any, key: str | None) -> dict[str, Any]:
    if not key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")
    rows = client.table("domain_agents").select("*").eq("key", key).eq("is_active", True).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")
    return rows[0]


def _workflows_by_agent(client: Any) -> dict[str, list[dict[str, Any]]]:
    rows = client.table("workflows").select("*").eq("is_active", True).order("created_at").execute().data or []
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(str(row.get("agent_id")), []).append(row)
    return grouped


def _task_rows(client: Any, user_id: str) -> list[dict[str, Any]]:
    return (
        client.table("tasks")
        .select("id,title,status,agent_id,workflow_id,created_at,updated_at,step_results,current_step")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(25)
        .execute()
        .data
        or []
    )


def _artifact_rows(
    client: Any,
    user_id: str,
    *,
    agent_id: str | None = None,
    workflow_id: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    query = client.table("artifacts").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit)
    if agent_id:
        query = query.eq("agent_id", agent_id)
    if workflow_id and workflow_id != "all":
        query = query.eq("workflow_id", workflow_id)
    return query.execute().data or []


def _agent_payload(agent: dict[str, Any], workflows: list[dict[str, Any]], activity: dict[str, Any] | None) -> dict[str, Any]:
    short_name = str(agent.get("name") or agent.get("key") or "Agent")
    return {
        "id": agent.get("key"),
        "uuid": agent.get("id"),
        "name": f"{short_name} Agent" if not short_name.lower().endswith("agent") else short_name,
        "shortName": short_name,
        "initial": short_name[:1].upper(),
        "color": agent.get("color") or "var(--aos-obsidian)",
        "discipline": agent.get("discipline_statement") or "",
        "strength": agent.get("what_its_good_at") or "",
        "activity": _activity_label(activity),
        "fullDescription": agent.get("discipline_statement") or "",
        "capabilities": _capabilities(agent.get("capabilities")),
        "thoughtStarters": _thought_starters(agent.get("thought_starters"), workflows),
        "workflows": [_workflow_payload(item, agent.get("key")) for item in workflows],
    }


def _workflow_payload(workflow: dict[str, Any], agent_key: str | None) -> dict[str, Any]:
    return {
        "id": workflow.get("id"),
        "agentId": agent_key,
        "name": workflow.get("name") or "Workflow",
        "description": workflow.get("description") or "",
        "defaultTaskTitle": workflow.get("name") or "Domain Agent Task",
    }


def _task_summary(task: dict[str, Any], agent: dict[str, Any], workflows: list[dict[str, Any]]) -> dict[str, Any]:
    workflow = next((item for item in workflows if item.get("id") == task.get("workflow_id")), None) or {}
    return {
        "id": task.get("id"),
        "title": task.get("title") or workflow.get("name") or "Domain Agent Task",
        "agentId": agent.get("key"),
        "workflowId": task.get("workflow_id"),
        "status": task.get("status"),
        "createdAt": task.get("created_at"),
        "updatedAt": task.get("updated_at"),
    }


def _artifact_payload(row: dict[str, Any], *, agent: dict[str, Any] | None = None) -> dict[str, Any]:
    filename = str(row.get("filename") or "Artifact")
    title = row.get("description") or filename.rsplit(".", 1)[0]
    return {
        "id": row.get("id"),
        "title": title,
        "type": _artifact_type(row),
        "agentId": (agent or {}).get("key"),
        "workflowId": row.get("workflow_id"),
        "taskId": row.get("task_id") or row.get("source_id"),
        "createdAt": row.get("created_at"),
        "promoted": bool(row.get("promoted_to_kb")),
        "summary": row.get("description") or filename,
        "sections": _artifact_sections(row),
        "filename": filename,
        "renderable": bool(row.get("renderable")),
    }


def _capabilities(value: Any) -> list[dict[str, str]]:
    if isinstance(value, dict):
        items = []
        for label in ("Analyze", "Create", "Plan"):
            raw = value.get(label) or value.get(label.lower()) or []
            if isinstance(raw, list):
                description = ", ".join(str(item) for item in raw if str(item).strip())
            else:
                description = str(raw or "")
            if description:
                items.append({"label": label, "description": description})
        return items
    return []


def _thought_starters(value: Any, workflows: list[dict[str, Any]]) -> list[dict[str, str]]:
    workflow_id = str((workflows[0] if workflows else {}).get("id") or "")
    if isinstance(value, list):
        return [{"text": str(item), "workflowId": workflow_id} for item in value if str(item).strip()]
    return []


def _activity_label(activity: dict[str, Any] | None) -> str:
    if not activity or not activity.get("count"):
        return "No tasks yet"
    count = int(activity["count"])
    last = _short_date(activity.get("latest"))
    return f"{count} {'task' if count == 1 else 'tasks'}" + (f" · last run {last}" if last else "")


def _task_activity_by_agent(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    activity: dict[str, dict[str, Any]] = {}
    for row in rows:
        agent_id = str(row.get("agent_id"))
        item = activity.setdefault(agent_id, {"count": 0, "latest": None})
        item["count"] += 1
        if not item["latest"] or str(row.get("updated_at") or "") > str(item["latest"]):
            item["latest"] = row.get("updated_at")
    return activity


def _map_workflow(request: str, workflows: list[dict[str, Any]], agent: dict[str, Any]) -> dict[str, Any] | None:
    haystack = request.lower()
    starters = " ".join(str(item) for item in agent.get("thought_starters") or [])
    best: tuple[int, dict[str, Any] | None] = (0, None)
    for workflow in workflows:
        text = " ".join([str(workflow.get("name") or ""), str(workflow.get("description") or ""), starters]).lower()
        tokens = {token.strip(".,:;!?()[]") for token in text.replace("&", " ").split()}
        score = sum(1 for token in tokens if len(token) > 3 and token in haystack)
        if score > best[0]:
            best = (score, workflow)
    return best[1] if best[0] > 0 else None


def _artifact_type(row: dict[str, Any]) -> str:
    text = " ".join([str(row.get("filename") or ""), str(row.get("description") or "")]).lower()
    for kind in ("brief", "memo", "review", "audit", "analysis", "read"):
        if kind in text:
            return kind
    return "analysis"


def _artifact_sections(row: dict[str, Any]) -> list[str]:
    provenance = row.get("provenance") if isinstance(row.get("provenance"), dict) else {}
    sections = provenance.get("sections") if isinstance(provenance, dict) else None
    if isinstance(sections, list) and sections:
        return [str(item) for item in sections[:4]]
    return ["Summary", "Findings", "Recommendations"]


def _short_date(value: Any) -> str:
    if not value:
        return ""
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        days = max(0, (now - parsed.astimezone(timezone.utc)).days)
        if days == 0:
            return "today"
        if days == 1:
            return "1d ago"
        if days < 14:
            return f"{days}d ago"
        return f"{parsed:%b} {parsed.day}"
    except Exception:
        return str(value)


def _single_row(response: Any, message: str) -> dict[str, Any]:
    data = getattr(response, "data", None)
    if isinstance(data, list) and data:
        return data[0]
    if isinstance(data, dict):
        return data
    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=message)
