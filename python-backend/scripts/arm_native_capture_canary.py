"""Atomic founder-only arming/readback for one 04B-D capture canary.

This script does not submit a VCSO turn. ``arm`` is intentionally refused unless:

* the deployed health SHA matches the caller's expected SHA;
* the current row is fully dark;
* the caller supplies the explicit confirmation phrase.

The complete settings object and ``is_enabled`` value are written in one row
update, then read back and asserted. ``disarm`` clears both allowlists and every
related diagnostic switch in the same way.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, str(Path(__file__).parents[1]))

from core.config import get_settings
from services.vcso_sdk_loop import VCSO_SDK_LOOP_FLAG


load_dotenv(Path(__file__).parents[1] / ".env")

ARM_CONFIRMATION = "ARM-ONE-CAPTURE-CANARY"
DARK_CONFIRMATION = "RE-DARKEN-04B"
DEFAULT_HEALTH_URL = "https://api.architectospro.com/api/health"
HEALTH_CHECK_USER_AGENT = "ArchitectOS-04B-Canary-Preflight/1.0"
DIAGNOSTIC_FALSE_KEYS = (
    "diagnostic_single_worker_enabled",
    "diagnostic_fault_injection_enabled",
    "diagnostic_stream_disconnect_enabled",
    "diagnostic_stream_drop_done_enabled",
    "diagnostic_cross_worker_probe_enabled",
    "diagnostic_granular_cross_worker_probe_enabled",
    "diagnostic_founder_isolation_probe_enabled",
)
DIAGNOSTIC_CLEAR_KEYS = (
    "diagnostic_founder_isolation_dataset_id",
    "diagnostic_founder_isolation_owned_dataset_id",
    "diagnostic_founder_isolation_random_dataset_id",
)


def build_armed_settings(
    current: dict[str, Any],
    founder_id: str,
    *,
    granular_cross_worker_probe: bool = False,
    foreign_dataset_id: str | None = None,
    owned_dataset_id: str | None = None,
    random_dataset_id: str | None = None,
) -> dict[str, Any]:
    settings = dict(current)
    settings.update(
        {
            "enabled_for_all": False,
            "test_user_ids": [founder_id],
            "diagnostic_user_ids": [founder_id],
            "native_model_driven_enabled": True,
            "native_subagent_scope": "",
            "diagnostic_sdk_stream_capture_enabled": True,
            "diagnostic_single_worker": "",
            # 12 is the hardcoded production ceiling; raising it is a founder decision.
            "max_turns": 12,
            "max_budget_usd": 0.50,
        }
    )
    settings.update({key: False for key in DIAGNOSTIC_FALSE_KEYS})
    settings.update({key: "" for key in DIAGNOSTIC_CLEAR_KEYS})
    if granular_cross_worker_probe:
        settings["diagnostic_granular_cross_worker_probe_enabled"] = True
    if foreign_dataset_id:
        settings["diagnostic_founder_isolation_probe_enabled"] = True
        settings["diagnostic_founder_isolation_dataset_id"] = foreign_dataset_id
        settings["diagnostic_founder_isolation_owned_dataset_id"] = owned_dataset_id or ""
        settings["diagnostic_founder_isolation_random_dataset_id"] = random_dataset_id or ""
    return settings


def build_dark_settings(current: dict[str, Any]) -> dict[str, Any]:
    settings = dict(current)
    settings.update(
        {
            "enabled_for_all": False,
            "test_user_ids": [],
            "diagnostic_user_ids": [],
            "native_model_driven_enabled": False,
            "native_subagent_scope": "",
            "diagnostic_sdk_stream_capture_enabled": False,
            "diagnostic_single_worker": "",
        }
    )
    settings.update({key: False for key in DIAGNOSTIC_FALSE_KEYS})
    settings.update({key: "" for key in DIAGNOSTIC_CLEAR_KEYS})
    return settings


def assert_dark_state(row: dict[str, Any]) -> None:
    settings = row.get("settings") if isinstance(row.get("settings"), dict) else {}
    failures: list[str] = []
    if bool(row.get("is_enabled")):
        failures.append("is_enabled")
    for key in ("test_user_ids", "diagnostic_user_ids"):
        if list(settings.get(key) or []):
            failures.append(key)
    for key in (
        "enabled_for_all",
        "native_model_driven_enabled",
        "diagnostic_sdk_stream_capture_enabled",
        *DIAGNOSTIC_FALSE_KEYS,
    ):
        if bool(settings.get(key)):
            failures.append(key)
    if failures:
        raise RuntimeError("vcso_sdk_loop is not fully dark: " + ", ".join(sorted(set(failures))))


def assert_armed_state(row: dict[str, Any], founder_id: str) -> None:
    settings = row.get("settings") if isinstance(row.get("settings"), dict) else {}
    failures: list[str] = []
    if not bool(row.get("is_enabled")):
        failures.append("is_enabled")
    if settings.get("test_user_ids") != [founder_id]:
        failures.append("test_user_ids")
    if settings.get("diagnostic_user_ids") != [founder_id]:
        failures.append("diagnostic_user_ids")
    if bool(settings.get("enabled_for_all")):
        failures.append("enabled_for_all")
    if not bool(settings.get("native_model_driven_enabled")):
        failures.append("native_model_driven_enabled")
    if str(settings.get("native_subagent_scope") or ""):
        failures.append("native_subagent_scope")
    if not bool(settings.get("diagnostic_sdk_stream_capture_enabled")):
        failures.append("diagnostic_sdk_stream_capture_enabled")
    for key in (
        "diagnostic_single_worker_enabled",
        "diagnostic_fault_injection_enabled",
        "diagnostic_stream_disconnect_enabled",
        "diagnostic_stream_drop_done_enabled",
        "diagnostic_cross_worker_probe_enabled",
    ):
        if bool(settings.get(key)):
            failures.append(key)
    if int(settings.get("max_turns") or 0) != 12:
        failures.append("max_turns")
    if float(settings.get("max_budget_usd") or 0) != 0.50:
        failures.append("max_budget_usd")
    if failures:
        raise RuntimeError("atomic arming readback failed: " + ", ".join(sorted(set(failures))))


def _single(response: Any, label: str) -> dict[str, Any]:
    data = getattr(response, "data", None)
    if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
        return data[0]
    if isinstance(data, dict):
        return data
    raise RuntimeError(f"{label} did not return exactly one row")


def read_flag(client: Any) -> dict[str, Any]:
    return _single(
        client.table("platform_ai_settings")
        .select("setting_key,is_enabled,settings,updated_at")
        .eq("setting_key", VCSO_SDK_LOOP_FLAG)
        .limit(1)
        .execute(),
        "vcso_sdk_loop readback",
    )


def write_flag(client: Any, *, is_enabled: bool, settings: dict[str, Any]) -> dict[str, Any]:
    client.table("platform_ai_settings").update(
        {"is_enabled": is_enabled, "settings": settings}
    ).eq("setting_key", VCSO_SDK_LOOP_FLAG).execute()
    return read_flag(client)


def _health_sha(payload: Any) -> str:
    if isinstance(payload, dict):
        for key in ("commit_sha", "commit_sha_short", "git_sha", "sha"):
            value = payload.get(key)
            if value:
                return str(value)
        for value in payload.values():
            found = _health_sha(value)
            if found:
                return found
    return ""


def confirm_deployed_head(health_url: str, expected_sha: str) -> dict[str, Any]:
    separator = "&" if "?" in health_url else "?"
    url = f"{health_url}{separator}{urllib.parse.urlencode({'preflight': time.time_ns()})}"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "User-Agent": HEALTH_CHECK_USER_AGENT,
        },
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    observed = _health_sha(payload)
    expected = expected_sha.strip().lower()
    if not observed or not (
        observed.lower().startswith(expected) or expected.startswith(observed.lower())
    ):
        raise RuntimeError(
            f"cache-busted health SHA mismatch: expected {expected_sha}, observed {observed or 'missing'}"
        )
    return {"health_url": url, "expected_sha": expected_sha, "observed_sha": observed}


def _client() -> Any:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase service credentials are required")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def sanitized_state(row: dict[str, Any]) -> dict[str, Any]:
    settings = row.get("settings") if isinstance(row.get("settings"), dict) else {}
    keys = (
        "enabled_for_all",
        "test_user_ids",
        "diagnostic_user_ids",
        "native_model_driven_enabled",
        "native_subagent_scope",
        "diagnostic_sdk_stream_capture_enabled",
        "diagnostic_single_worker_enabled",
        "diagnostic_fault_injection_enabled",
        "diagnostic_stream_disconnect_enabled",
        "diagnostic_stream_drop_done_enabled",
        "diagnostic_cross_worker_probe_enabled",
        "diagnostic_granular_cross_worker_probe_enabled",
        "diagnostic_founder_isolation_probe_enabled",
        "diagnostic_founder_isolation_dataset_id",
        "diagnostic_founder_isolation_owned_dataset_id",
        "diagnostic_founder_isolation_random_dataset_id",
        "max_turns",
        "max_budget_usd",
    )
    return {
        "setting_key": row.get("setting_key"),
        "is_enabled": bool(row.get("is_enabled")),
        "settings": {key: settings.get(key) for key in keys},
        "updated_at": row.get("updated_at"),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("read")

    arm = subparsers.add_parser("arm")
    arm.add_argument("--founder-id", required=True)
    arm.add_argument("--expected-sha", required=True)
    arm.add_argument("--health-url", default=DEFAULT_HEALTH_URL)
    arm.add_argument("--confirm", required=True)
    arm.add_argument("--granular-cross-worker-probe", action="store_true")
    arm.add_argument("--foreign-dataset-id")
    arm.add_argument("--owned-dataset-id")
    arm.add_argument("--random-dataset-id")

    disarm = subparsers.add_parser("disarm")
    disarm.add_argument("--confirm", required=True)

    args = parser.parse_args()
    client = _client()
    current = read_flag(client)

    if args.command == "read":
        print(json.dumps(sanitized_state(current), indent=2))
        return
    if args.command == "arm":
        if args.confirm != ARM_CONFIRMATION:
            raise SystemExit(f"--confirm must equal {ARM_CONFIRMATION}")
        assert_dark_state(current)
        health = confirm_deployed_head(args.health_url, args.expected_sha)
        updated = write_flag(
            client,
            is_enabled=True,
            settings=build_armed_settings(
                current.get("settings") or {},
                args.founder_id,
                granular_cross_worker_probe=bool(args.granular_cross_worker_probe),
                foreign_dataset_id=args.foreign_dataset_id,
                owned_dataset_id=args.owned_dataset_id,
                random_dataset_id=args.random_dataset_id,
            ),
        )
        assert_armed_state(updated, args.founder_id)
        print(json.dumps({"health": health, "state": sanitized_state(updated)}, indent=2))
        return
    if args.confirm != DARK_CONFIRMATION:
        raise SystemExit(f"--confirm must equal {DARK_CONFIRMATION}")
    updated = write_flag(
        client,
        is_enabled=False,
        settings=build_dark_settings(current.get("settings") or {}),
    )
    assert_dark_state(updated)
    print(json.dumps(sanitized_state(updated), indent=2))


if __name__ == "__main__":
    main()
