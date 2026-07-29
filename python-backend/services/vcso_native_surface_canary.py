"""Fail-closed countability checks for 04B native-surface canaries."""

from __future__ import annotations

from typing import Any

NATIVE_SURFACE_PHASE = "04B-D"


def _mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _agent_list(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(str(item).strip() for item in value if str(item or "").strip())


def evaluate_native_surface_countability(*, run: dict[str, Any]) -> dict[str, Any]:
    """Return an auditable verdict; callers must treat every failed verdict as void."""

    metadata = _mapping(run.get("metadata"))
    structured_result = _mapping(run.get("structured_result"))
    observed_phases = {
        str(value).strip()
        for value in (metadata.get("sdk_phase"), structured_result.get("sdk_phase"))
        if str(value or "").strip()
    }
    observed_native_modes = {
        value
        for container in (metadata, structured_result)
        if "native_subagent_mode" in container
        for value in (container.get("native_subagent_mode"),)
    }
    observed_agent_lists = [
        _agent_list(container.get("available_subagents"))
        for container in (metadata, structured_result)
        if "available_subagents" in container
    ]
    available_subagents = observed_agent_lists[0] if observed_agent_lists else ()
    checks = {
        "phase_d_marker": observed_phases == {NATIVE_SURFACE_PHASE},
        "native_subagent_mode": observed_native_modes == {True},
        "available_subagents": bool(available_subagents)
        and all(agent_list == available_subagents for agent_list in observed_agent_lists),
    }
    failures = [name for name, passed in checks.items() if not passed]
    return {
        "countable": not failures,
        "classification": "countable" if not failures else "void",
        "phase": NATIVE_SURFACE_PHASE,
        "run_id": str(run.get("id") or ""),
        "available_subagents": list(available_subagents),
        "checks": checks,
        "failures": failures,
    }


__all__ = ["NATIVE_SURFACE_PHASE", "evaluate_native_surface_countability"]
