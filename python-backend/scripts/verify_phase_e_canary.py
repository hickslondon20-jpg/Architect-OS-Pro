"""Verify one live Phase E canary row before it may count toward N=3.

The verifier reloads the run, thread, and SDK transcript from Supabase. It
exits non-zero unless the persisted evidence proves Deep Mode, the 04B-E
marker, and one matching SDK session pointer.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from supabase import create_client

sys.path.insert(0, str(Path(__file__).parents[1]))

from core.config import get_settings
from services.vcso_phase_e_canary import evaluate_phase_e_countability
from services.vcso_session_store import SupabaseVcsoSessionStore


def _single(response: Any, label: str) -> dict[str, Any]:
    data = getattr(response, "data", None)
    if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
        return data[0]
    if isinstance(data, dict):
        return data
    raise RuntimeError(f"{label} did not return exactly one row")


async def verify(*, user_id: str, run_id: str, stage: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase service credentials are required")
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    run = _single(
        client.table("agent_delegation_runs")
        .select(
            "id,user_id,parent_thread_id,parent_message_id,status,"
            "metadata,structured_result,created_at,updated_at"
        )
        .eq("id", run_id)
        .eq("user_id", user_id)
        .single()
        .execute(),
        "run reload",
    )
    thread_id = str(run.get("parent_thread_id") or "")
    if not thread_id:
        raise RuntimeError("run is missing parent_thread_id")
    thread = _single(
        client.table("vcso_chat_threads")
        .select(
            "id,user_id,agent_status,active_sdk_session_id,"
            "sdk_pending_tool_use_id,sdk_pending_question,sdk_pending_run_id"
        )
        .eq("id", thread_id)
        .eq("user_id", user_id)
        .single()
        .execute(),
        "thread reload",
    )
    pointer = (
        (run.get("metadata") or {}).get("sdk_session_id")
        or (run.get("structured_result") or {}).get("sdk_session_id")
        or ""
    )
    transcript = None
    if pointer:
        store = SupabaseVcsoSessionStore(
            client,
            user_id=user_id,
            thread_id=thread_id,
            turn_message_id=str(run.get("parent_message_id") or ""),
        )
        transcript = await store.load(
            {
                "project_key": "architectos-vcso-deep",
                "session_id": str(pointer),
                "subpath": "",
            }
        )
    verdict = evaluate_phase_e_countability(
        run=run,
        thread=thread,
        transcript=transcript,
        stage=stage,  # type: ignore[arg-type]
    )
    print(json.dumps(verdict, indent=2))
    return verdict


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--stage", required=True, choices=("pause", "resume"))
    args = parser.parse_args()
    verdict = await verify(
        user_id=args.user_id,
        run_id=args.run_id,
        stage=args.stage,
    )
    if not verdict["countable"]:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
