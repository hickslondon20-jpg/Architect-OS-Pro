"""Superseded post-hoc evaluator for a completed 04B-D capture turn.

Use ``verify_native_activation_compile.py`` before any model turn. The former
activation smoke costs a full two-worker delegation and verifies activation only
after that spend. This evaluator remains available for existing post-hoc evidence
and its tests; it is no longer part of the activation preflight sequence.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, str(Path(__file__).parents[1]))

from core.config import get_settings


load_dotenv(Path(__file__).parents[1] / ".env")


def _containers(run: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        value
        for value in (run.get("metadata"), run.get("structured_result"))
        if isinstance(value, dict)
    ]


def evaluate_activation_smoke(run: dict[str, Any]) -> dict[str, Any]:
    containers = _containers(run)
    phases = {str(item.get("sdk_phase")) for item in containers if item.get("sdk_phase")}
    modes = [
        bool(item.get("native_subagent_mode"))
        for item in containers
        if "native_subagent_mode" in item
    ]
    available_lists = [
        [str(value) for value in item.get("available_subagents") or []]
        for item in containers
        if "available_subagents" in item
    ]
    metadata = run.get("metadata") if isinstance(run.get("metadata"), dict) else {}
    capture = metadata.get("sdk_raw_stream_capture")
    checks = {
        "run_completed": str(run.get("status") or "") == "completed",
        "sdk_phase": phases == {"04B-D"},
        "native_subagent_mode": bool(modes) and all(modes),
        "available_subagents": (
            bool(available_lists)
            and all(items for items in available_lists)
            and all(items == available_lists[0] for items in available_lists)
        ),
        "capture_enabled_attribution": all(
            bool(item.get("sdk_stream_capture_enabled"))
            for item in containers
            if "sdk_stream_capture_enabled" in item
        )
        and any("sdk_stream_capture_enabled" in item for item in containers),
        "capture_key_present": (
            "sdk_raw_stream_capture" in metadata
            and isinstance(capture, list)
            and bool(capture)
        ),
    }
    return {
        "activated": all(checks.values()),
        "checks": checks,
        "run_id": run.get("id"),
        "status": run.get("status"),
        "sdk_phases": sorted(phases),
        "native_subagent_modes": modes,
        "available_subagents": available_lists[0] if available_lists else [],
        "capture_event_count": len(capture) if isinstance(capture, list) else 0,
    }


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
        .select("id,user_id,capability_key,status,metadata,structured_result,created_at,updated_at")
        .eq("id", run_id)
        .eq("user_id", user_id)
        .single()
        .execute(),
        "activation smoke run",
    )
    verdict = evaluate_activation_smoke(run)
    print(json.dumps(verdict, indent=2))
    return verdict


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    verdict = verify(user_id=args.user_id, run_id=args.run_id)
    if not verdict["activated"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
