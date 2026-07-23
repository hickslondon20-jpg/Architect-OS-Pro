"""Create three founder-scoped, reload-first Phase E persistence proofs.

This deliberately does not invoke a model or arm a feature flag. Each pass
creates a Deep Mode thread fixture, persists an SDK transcript through the
production adapter, reconstructs a fresh client/store/service boundary, and
then reloads the transcript, mutable plan, workspace metadata, and thread
session pointer from Supabase.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from supabase import create_client

sys.path.insert(0, str(Path(__file__).parents[1]))

from core.config import get_settings
from services.vcso_chat_service import VcsoChatService
from services.vcso_session_store import SupabaseVcsoSessionStore


def _single(response: Any, label: str) -> dict[str, Any]:
    data = getattr(response, "data", None)
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return data[0]
    if not isinstance(data, dict):
        raise RuntimeError(f"{label} did not return one row")
    return data


async def verify_pass(*, user_id: str, pass_number: int) -> dict[str, Any]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase service credentials are required")
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    marker = f"phase-e-reload-{pass_number}-{uuid.uuid4().hex[:8]}"
    thread = _single(
        client.table("vcso_chat_threads")
        .insert(
            {
                "user_id": user_id,
                "title": f"[Phase E reload proof {pass_number}] {marker}",
                "agent_status": "working",
            }
        )
        .execute(),
        "thread insert",
    )
    thread_id = str(thread["id"])
    message = _single(
        client.table("vcso_chat_messages")
        .insert(
            {
                "thread_id": thread_id,
                "user_id": user_id,
                "role": "user",
                "content": f"Persist this Deep Mode context: {marker}",
                "deep_mode": True,
            }
        )
        .execute(),
        "message insert",
    )
    message_id = str(message["id"])
    todo_rows = [
        {
            "thread_id": thread_id,
            "user_id": user_id,
            "content": f"{marker}: plan step {position + 1}",
            "status": "in_progress" if position == 0 else "pending",
            "position": position,
        }
        for position in range(2)
    ]
    todos = client.table("agent_todos").insert(todo_rows).execute().data or []
    workspace = _single(
        client.table("workspace_files")
        .insert(
            {
                "owner_type": "thread",
                "owner_id": thread_id,
                "user_id": user_id,
                "file_path": f"phase-e/{marker}.md",
                "content": f"# Reload proof\n\n{marker}",
                "source": "agent",
                "size": len(marker),
            }
        )
        .execute(),
        "workspace insert",
    )
    session_id = str(uuid.uuid4())
    project_key = "architectos-vcso-deep"
    transcript = [
        {
            "uuid": str(uuid.uuid4()),
            "type": "user",
            "message": {"role": "user", "content": f"Context marker: {marker}"},
        },
        {
            "uuid": str(uuid.uuid4()),
            "type": "assistant",
            "message": {"role": "assistant", "content": "Plan and workspace persisted."},
        },
    ]
    store = SupabaseVcsoSessionStore(
        client,
        user_id=user_id,
        thread_id=thread_id,
        turn_message_id=message_id,
    )
    await store.append(
        {
            "project_key": project_key,
            "session_id": session_id,
            "subpath": "",
        },
        transcript,
    )
    pending_tool_use_id = f"ask-{uuid.uuid4()}"
    client.table("vcso_chat_threads").update(
        {
            "active_sdk_session_id": session_id,
            "sdk_pending_tool_use_id": pending_tool_use_id,
            "sdk_pending_question": f"{marker}: founder answer?",
            "agent_status": "waiting_for_user",
            "sdk_session_updated_at": datetime.now(timezone.utc).isoformat(),
            "deep_resume_state": None,
        }
    ).eq("id", thread_id).eq("user_id", user_id).execute()

    # Reload boundary: a fresh client, adapter, and service object. No in-memory
    # object from the write side is reused for any assertion.
    reload_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    reload_store = SupabaseVcsoSessionStore(
        reload_client,
        user_id=user_id,
        thread_id=thread_id,
        turn_message_id=message_id,
    )
    loaded_transcript = await reload_store.load(
        {
            "project_key": project_key,
            "session_id": session_id,
            "subpath": "",
        }
    )
    reload_service = object.__new__(VcsoChatService)
    reload_service.supabase = reload_client
    loaded_todos = reload_service._load_thread_todos(thread_id, user_id)
    loaded_workspace = reload_service._load_thread_workspace_metadata(thread_id, user_id)
    loaded_thread = _single(
        reload_client.table("vcso_chat_threads")
        .select(
            "id,active_sdk_session_id,sdk_pending_tool_use_id,"
            "sdk_pending_question,agent_status,deep_resume_state"
        )
        .eq("id", thread_id)
        .eq("user_id", user_id)
        .single()
        .execute(),
        "thread reload",
    )

    assert loaded_transcript == transcript
    assert [row["content"] for row in loaded_todos] == [
        row["content"] for row in todo_rows
    ]
    assert [row["file_path"] for row in loaded_workspace] == [workspace["file_path"]]
    assert loaded_thread["active_sdk_session_id"] == session_id
    assert loaded_thread["sdk_pending_tool_use_id"] == pending_tool_use_id
    assert loaded_thread["agent_status"] == "waiting_for_user"
    assert loaded_thread["deep_resume_state"] is None
    return {
        "pass": pass_number,
        "thread_id": thread_id,
        "turn_message_id": message_id,
        "session_id": session_id,
        "todo_ids": [str(row["id"]) for row in todos],
        "workspace_file_id": str(workspace["id"]),
        "transcript_entries": len(loaded_transcript or []),
        "legacy_resume_absent": loaded_thread["deep_resume_state"] is None,
        "result": "PASS",
    }


async def main(user_id: str) -> None:
    results = [
        await verify_pass(user_id=user_id, pass_number=pass_number)
        for pass_number in range(1, 4)
    ]
    print(json.dumps({"phase": "04B-E", "reload_first": results}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", required=True)
    args = parser.parse_args()
    asyncio.run(main(args.user_id))
