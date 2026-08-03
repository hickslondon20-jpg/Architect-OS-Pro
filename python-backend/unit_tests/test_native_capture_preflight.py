from __future__ import annotations

import io
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1]))

from scripts.arm_native_capture_canary import (
    DIAGNOSTIC_FALSE_KEYS,
    HEALTH_CHECK_USER_AGENT,
    assert_armed_state,
    assert_dark_state,
    build_armed_settings,
    build_dark_settings,
    confirm_deployed_head,
)
from scripts.verify_native_activation_smoke import evaluate_activation_smoke
from scripts.verify_native_activation_compile import (
    compile_activation_surface,
    compiled_activation_snapshot,
    evaluate_activation_compile,
)
from services.tool_registry import ToolRegistry
from services.vcso_sdk_config import (
    GRANULAR_NATIVE_AGENT_MAX_TURNS,
    MODE_B_LEAD_TOOL_NAMES,
    NATIVE_GRANULAR_AGENT_TOOL_GRANTS,
    SDK_INTERNAL_SERVER,
)
from services.vcso_sdk_loop import NATIVE_SURFACE_REQUIRED_AGENTS


FOUNDER_ID = "cd490873-99aa-4533-9240-f0aa04deb54f"


class _Query:
    def __init__(self, rows):
        self.rows = list(rows)

    def select(self, *_args):
        return self

    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self

    def in_(self, key, values):
        self.rows = [row for row in self.rows if row.get(key) in values]
        return self

    def order(self, key):
        self.rows.sort(key=lambda row: str(row.get(key) or ""))
        return self

    def execute(self):
        return type("Response", (), {"data": self.rows})()


class _Client:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return _Query(self.tables.get(name, []))


class _Store:
    def __init__(self, client):
        self.client = client

    def resolve_platform_model(self, *, setting_key, fallback_model_name, fallback_provider):
        return {"provider": fallback_provider, "model_name": fallback_model_name}


def _capability(key):
    return {
        "id": key,
        "capability_key": key,
        "label": key.replace("_", " ").title(),
        "description": f"Bounded {key}.",
        "status": "experimental",
        "allowed_surfaces": ["virtual_cso"],
        "allowed_tools": [],
        "allowed_source_kinds": [],
        "model_setting_key": key,
        "routing_tier": "worker",
        "output_schema": {"version": "agent_result_v1"},
        "default_config": {"max_rounds": 1},
        "can_spawn_agents": False,
    }


def _armed_compile_substrate():
    all_tools = {
        *MODE_B_LEAD_TOOL_NAMES,
        *(name for grants in NATIVE_GRANULAR_AGENT_TOOL_GRANTS.values() for name in grants),
    }
    client = _Client(
        {
            "tool_registry": [
                {"slug": name, "enabled": True, "is_code_registered": True}
                for name in all_tools
            ],
            "agent_capabilities": [
                _capability(key) for key in NATIVE_GRANULAR_AGENT_TOOL_GRANTS
            ],
            "mcp_connections": [],
        }
    )
    store = _Store(client)
    return store, ToolRegistry(store=store)


def _passing_compile_snapshot():
    grants = {
        key: list(value) for key, value in NATIVE_GRANULAR_AGENT_TOOL_GRANTS.items()
    }
    return {
        "lead_tool_names": list(MODE_B_LEAD_TOOL_NAMES),
        "lead_tools": ["Task"],
        "lead_allowed_tools": [
            "Task",
            *[
                f"mcp__{SDK_INTERNAL_SERVER}__{name}"
                for names in NATIVE_GRANULAR_AGENT_TOOL_GRANTS.values()
                for name in names
            ],
        ],
        "lead_disallowed_tools": ["Bash"],
        "agent_keys": sorted(NATIVE_GRANULAR_AGENT_TOOL_GRANTS),
        "agent_tool_grants": grants,
        "agent_tools": {
            key: [f"mcp__{SDK_INTERNAL_SERVER}__{name}" for name in names]
            for key, names in NATIVE_GRANULAR_AGENT_TOOL_GRANTS.items()
        },
        "agent_mcp_servers": {
            key: [SDK_INTERNAL_SERVER] for key in NATIVE_GRANULAR_AGENT_TOOL_GRANTS
        },
        "agent_max_turns": {
            key: GRANULAR_NATIVE_AGENT_MAX_TURNS
            for key in NATIVE_GRANULAR_AGENT_TOOL_GRANTS
        },
        "max_turns": 12,
        "max_budget_usd": 0.50,
    }


def test_deployed_head_check_sends_explicit_preflight_user_agent(monkeypatch):
    observed = {}

    class _Response:
        def __enter__(self):
            return io.BytesIO(b'{"commit_sha_short":"abc12345"}')

        def __exit__(self, *_args):
            return False

    def _urlopen(request, timeout):
        observed["user_agent"] = request.get_header("User-agent")
        observed["timeout"] = timeout
        return _Response()

    monkeypatch.setattr("scripts.arm_native_capture_canary.urllib.request.urlopen", _urlopen)

    result = confirm_deployed_head("https://example.test/api/health", "abc12345")

    assert result["observed_sha"] == "abc12345"
    assert observed == {"user_agent": HEALTH_CHECK_USER_AGENT, "timeout": 20}


def test_atomic_arm_places_founder_in_both_allowlists_and_disables_other_diagnostics():
    armed = build_armed_settings({"unrelated": "preserved"}, FOUNDER_ID)
    row = {"is_enabled": True, "settings": armed}

    assert_armed_state(row, FOUNDER_ID)
    assert armed["test_user_ids"] == [FOUNDER_ID]
    assert armed["diagnostic_user_ids"] == [FOUNDER_ID]
    assert armed["diagnostic_sdk_stream_capture_enabled"] is True
    assert armed["max_turns"] == 12
    assert armed["max_budget_usd"] == 0.50
    assert armed["unrelated"] == "preserved"
    assert all(armed[key] is False for key in DIAGNOSTIC_FALSE_KEYS)


def test_arm_readback_rejects_the_two_allowlist_trap():
    armed = build_armed_settings({}, FOUNDER_ID)
    armed["test_user_ids"] = []

    with pytest.raises(RuntimeError, match="test_user_ids"):
        assert_armed_state({"is_enabled": True, "settings": armed}, FOUNDER_ID)


def test_arm_readback_rejects_old_six_turn_quarter_dollar_caps():
    armed = build_armed_settings({}, FOUNDER_ID)
    armed["max_turns"] = 6
    armed["max_budget_usd"] = 0.25

    with pytest.raises(RuntimeError, match=r"max_budget_usd, max_turns"):
        assert_armed_state({"is_enabled": True, "settings": armed}, FOUNDER_ID)


def test_disarm_clears_both_allowlists_and_every_diagnostic_switch():
    dark = build_dark_settings(build_armed_settings({}, FOUNDER_ID))
    row = {"is_enabled": False, "settings": dark}

    assert_dark_state(row)
    assert dark["test_user_ids"] == []
    assert dark["diagnostic_user_ids"] == []
    assert dark["native_model_driven_enabled"] is False
    assert dark["diagnostic_sdk_stream_capture_enabled"] is False
    assert all(dark[key] is False for key in DIAGNOSTIC_FALSE_KEYS)


def test_compile_assertion_passes_on_armed_shaped_settings():
    verdict = evaluate_activation_compile(
        loop_enabled=True,
        requirements=NATIVE_SURFACE_REQUIRED_AGENTS,
        capture_enabled=True,
        compiled_snapshot=_passing_compile_snapshot(),
    )

    assert verdict["activated"] is True
    assert all(verdict["checks"].values())


def _mutate_loop_disabled(state):
    state["loop_enabled"] = False


def _mutate_requirements(state):
    state["requirements"] = ()


def _mutate_capture_disabled(state):
    state["capture_enabled"] = False


def _mutate_lead_catalog(state):
    state["compiled_snapshot"]["lead_tool_names"].remove("execute_code")


def _mutate_task_runtime_split(state):
    state["compiled_snapshot"]["lead_disallowed_tools"].append("Agent")


def _mutate_external_worker_transport(state):
    key = next(iter(NATIVE_GRANULAR_AGENT_TOOL_GRANTS))
    state["compiled_snapshot"]["agent_mcp_servers"][key] = ["vcso_workers"]
    state["compiled_snapshot"]["agent_tools"][key] = ["mcp__vcso_workers__run_worker"]


def _mutate_turn_floor(state):
    key = next(iter(NATIVE_GRANULAR_AGENT_TOOL_GRANTS))
    state["compiled_snapshot"]["agent_max_turns"][key] = GRANULAR_NATIVE_AGENT_MAX_TURNS - 1


def _mutate_parent_preapproval(state):
    missing = next(
        name for names in NATIVE_GRANULAR_AGENT_TOOL_GRANTS.values() for name in names
    )
    state["compiled_snapshot"]["lead_allowed_tools"].remove(
        f"mcp__{SDK_INTERNAL_SERVER}__{missing}"
    )


def _mutate_budget(state):
    state["compiled_snapshot"]["max_budget_usd"] = 0.25


@pytest.mark.parametrize(
    ("expected_failure", "mutation"),
    [
        ("A_loop_enabled_for_founder", _mutate_loop_disabled),
        ("B_non_anchor_requires_exact_native_agents", _mutate_requirements),
        ("C_stream_capture_enabled", _mutate_capture_disabled),
        ("D_mode_b_lead_catalog_exact", _mutate_lead_catalog),
        ("E_task_provisioned_and_runtime_not_blocked", _mutate_task_runtime_split),
        ("F_granular_agents_grants_and_in_process_server_exact", _mutate_external_worker_transport),
        ("G_parent_and_agent_turn_floors", _mutate_turn_floor),
        ("H_granular_tools_parent_preapproved", _mutate_parent_preapproval),
        ("I_half_dollar_budget", _mutate_budget),
    ],
)
def test_compile_assertion_fails_closed_on_each_individual_mutation(
    expected_failure, mutation
):
    state = {
        "loop_enabled": True,
        "requirements": NATIVE_SURFACE_REQUIRED_AGENTS,
        "capture_enabled": True,
        "compiled_snapshot": _passing_compile_snapshot(),
    }
    mutation(state)

    verdict = evaluate_activation_compile(**state)

    assert verdict["activated"] is False
    assert verdict["failures"] == [expected_failure]


def test_activation_smoke_requires_exact_phase_workers_and_nonempty_capture():
    run = {
        "id": "run-1",
        "status": "completed",
        "metadata": {
            "sdk_phase": "04B-D",
            "native_subagent_mode": True,
            "available_subagents": ["structured_data_agent", "per_user_wiki"],
            "sdk_stream_capture_enabled": True,
            "sdk_raw_stream_capture": [{"event": "sdk_stream_message"}],
        },
        "structured_result": {
            "sdk_phase": "04B-D",
            "native_subagent_mode": True,
            "available_subagents": ["structured_data_agent", "per_user_wiki"],
            "sdk_stream_capture_enabled": True,
        },
    }

    assert evaluate_activation_smoke(run)["activated"] is True


@pytest.mark.parametrize(
    "mutation",
    [
        lambda run: run["metadata"].update({"sdk_phase": "04B-C"}),
        lambda run: run["metadata"].update({"native_subagent_mode": False}),
        lambda run: run["metadata"].update({"available_subagents": []}),
        lambda run: run["metadata"].update({"sdk_raw_stream_capture": []}),
    ],
)
def test_activation_smoke_fails_closed(mutation):
    run = {
        "id": "run-1",
        "status": "completed",
        "metadata": {
            "sdk_phase": "04B-D",
            "native_subagent_mode": True,
            "available_subagents": ["structured_data_agent", "per_user_wiki"],
            "sdk_stream_capture_enabled": True,
            "sdk_raw_stream_capture": [{"event": "sdk_stream_message"}],
        },
    }
    mutation(run)

    assert evaluate_activation_smoke(run)["activated"] is False

