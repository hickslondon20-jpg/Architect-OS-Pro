"""Verify one live 04B native-surface canary row before it may enter the count."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from supabase import create_client

sys.path.insert(0, str(Path(__file__).parents[1]))

from core.config import get_settings
from services.vcso_native_surface_canary import evaluate_native_surface_countability


def _single(response: Any, label: str) -> dict[str, Any]:
    data = getattr(response, "data", None)
    if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
        return data[0]
    if isinstance(data, dict):
        return data
    raise RuntimeError(f"{label} did not return exactly one row")


def verify(*, user_id: str, run_id: str) -> dict[str, Any]:
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
    verdict = evaluate_native_surface_countability(run=run)
    print(json.dumps(verdict, indent=2))
    return verdict


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    verdict = verify(user_id=args.user_id, run_id=args.run_id)
    if not verdict["countable"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
