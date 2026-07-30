"""Deterministic, read-only activation preflight for the 04B native surface.

This script reads the live settings, tool catalog, capability rows, and model routes, then exercises
``compile_founder_sdk_options`` without submitting a model turn. ``native_subagent_tools={}`` is
intentional: granular-native agents derive their names and grants from
``NATIVE_GRANULAR_AGENT_TOOL_GRANTS``; handler tools affect MCP server contents, not the assertions
below. The SDK tools created here preserve the live registry names, descriptions, and schemas but have
inert handlers because this preflight compiles the surface and never executes a tool.

The script never writes ``platform_ai_settings`` and never mints TURN_REGISTRY tokens.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from claude_agent_sdk import tool
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parents[1]))

from core.config import get_settings
from services.tool_registry import ToolRegistry, build_registry
from services.vcso_sdk_config import (
    DELEGATION_TOOL_PROVISION_NAME,
    DELEGATION_TOOL_RUNTIME_NAME,
    GRANULAR_NATIVE_AGENT_MAX_TURNS,
    MODE_B_LEAD_TOOL_NAMES,
    NATIVE_GRANULAR_AGENT_TOOL_GRANTS,
    SDK_INTERNAL_SERVER,
    CompiledFounderSdkOptions,
    compile_founder_sdk_options,
)
from services.vcso_sdk_loop import (
    NATIVE_SURFACE_REQUIRED_AGENTS,
    native_subagent_requirements,
    read_sdk_loop_settings,
    sdk_stream_capture_enabled,
)
from services.vector_store import VectorStore


load_dotenv(Path(__file__).parents[1] / ".env")

NON_ANCHOR_MESSAGE = "Confirm whether the deterministic native activation surface is compiled."
NO_MODEL_API_KEY = "preflight-no-model-call"


def _inert_sdk_tools(registry: ToolRegistry) -> dict[str, Any]:
    """Build non-executing SDK descriptors from the real registry definitions."""

    sdk_tools: dict[str, Any] = {}
    for definition in registry.definitions():
        async def _never_execute(_args: dict[str, Any], *, _name: str = definition.name) -> dict[str, Any]:
            raise RuntimeError(f"compile-only preflight attempted to execute {_name}")

        sdk_tools[definition.name] = tool(
            definition.name,
            definition.description,
            definition.json_schema,
        )(_never_execute)
    return sdk_tools


def compile_activation_surface(
    *,
    store: Any,
    registry: ToolRegistry,
    founder_id: str,
    settings: dict[str, Any],
    model_driven_worker_server_urls: dict[str, str] | None = None,
) -> CompiledFounderSdkOptions:
    """Run the shipping compiler with the granular-native activation arguments."""

    runtime_settings = get_settings()
    return compile_founder_sdk_options(
        store=store,
        user_id=founder_id,
        registry=registry,
        # Granular-native compilation replaces this selection with the fixed Mode B lead surface.
        requested_tool_names=registry.tool_names(),
        sdk_tools_by_name=_inert_sdk_tools(registry),
        system_prompt="ArchitectOS native activation compile preflight.",
        main_model=runtime_settings.claude_synthesis_model,
        api_key=NO_MODEL_API_KEY,
        hooks={},
        max_turns=int(settings.get("max_turns") or 0),
        max_budget_usd=float(settings.get("max_budget_usd") or 0),
        enable_native_subagents=True,
        native_subagent_tools={},
        native_agent_tool_grants=NATIVE_GRANULAR_AGENT_TOOL_GRANTS,
        model_driven_worker_server_urls=model_driven_worker_server_urls or {},
        session_store=None,
        resume_session_id=None,
        fork_session=False,
    )


def compiled_activation_snapshot(compiled: CompiledFounderSdkOptions) -> dict[str, Any]:
    """Extract only deterministic, JSON-safe activation facts from compiled SDK options."""

    agents = compiled.options.agents or {}
    return {
        "lead_tool_names": list(compiled.lead_tool_names),
        "lead_tools": list(compiled.options.tools or []),
        "lead_allowed_tools": list(compiled.options.allowed_tools or []),
        "lead_disallowed_tools": list(compiled.options.disallowed_tools or []),
        "agent_keys": sorted(agents),
        "agent_tool_grants": {
            key: list(value) for key, value in compiled.agent_tool_grants.items()
        },
        "agent_tools": {
            key: list(agent.tools or []) for key, agent in agents.items()
        },
        "agent_mcp_servers": {
            key: list(agent.mcpServers or []) for key, agent in agents.items()
        },
        "agent_max_turns": {
            key: int(agent.maxTurns or 0) for key, agent in agents.items()
        },
        "max_turns": int(compiled.options.max_turns or 0),
        "max_budget_usd": float(compiled.options.max_budget_usd or 0),
    }


def evaluate_activation_compile(
    *,
    loop_enabled: bool,
    requirements: tuple[str, ...] | list[str],
    capture_enabled: bool,
    compiled_snapshot: dict[str, Any],
) -> dict[str, Any]:
    """Evaluate assertions A-I and return a fail-closed JSON-safe verdict."""

    agent_keys = set(compiled_snapshot.get("agent_keys") or [])
    expected_agent_keys = set(NATIVE_GRANULAR_AGENT_TOOL_GRANTS)
    actual_grants = compiled_snapshot.get("agent_tool_grants") or {}
    agent_mcp_servers = compiled_snapshot.get("agent_mcp_servers") or {}
    agent_tools = compiled_snapshot.get("agent_tools") or {}
    agent_max_turns = compiled_snapshot.get("agent_max_turns") or {}
    allowed_tools = set(compiled_snapshot.get("lead_allowed_tools") or [])
    disallowed_tools = set(compiled_snapshot.get("lead_disallowed_tools") or [])

    checks = {
        "A_loop_enabled_for_founder": loop_enabled is True,
        "B_non_anchor_requires_exact_native_agents": tuple(requirements)
        == NATIVE_SURFACE_REQUIRED_AGENTS,
        "C_stream_capture_enabled": capture_enabled is True,
        "D_mode_b_lead_catalog_exact": set(compiled_snapshot.get("lead_tool_names") or [])
        == set(MODE_B_LEAD_TOOL_NAMES),
        "E_task_provisioned_and_runtime_not_blocked": (
            compiled_snapshot.get("lead_tools") == [DELEGATION_TOOL_PROVISION_NAME]
            and DELEGATION_TOOL_PROVISION_NAME not in disallowed_tools
            and DELEGATION_TOOL_RUNTIME_NAME not in disallowed_tools
        ),
        "F_granular_agents_grants_and_in_process_server_exact": (
            agent_keys == expected_agent_keys
            and all(
                actual_grants.get(key) == list(grants)
                for key, grants in NATIVE_GRANULAR_AGENT_TOOL_GRANTS.items()
            )
            and all(
                agent_mcp_servers.get(key) == [SDK_INTERNAL_SERVER]
                for key in expected_agent_keys
            )
            and all(
                "vcso_workers" not in str(tool_name)
                for key in expected_agent_keys
                for tool_name in agent_tools.get(key, [])
            )
        ),
        "G_parent_and_agent_turn_floors": (
            compiled_snapshot.get("max_turns") == 12
            and agent_keys == expected_agent_keys
            and all(
                int(agent_max_turns.get(key) or 0) >= GRANULAR_NATIVE_AGENT_MAX_TURNS
                for key in expected_agent_keys
            )
        ),
        "H_granular_tools_parent_preapproved": all(
            f"mcp__{SDK_INTERNAL_SERVER}__{name}" in allowed_tools
            for grants in NATIVE_GRANULAR_AGENT_TOOL_GRANTS.values()
            for name in grants
        ),
        "I_half_dollar_budget": compiled_snapshot.get("max_budget_usd") == 0.50,
    }
    failures = [name for name, passed in checks.items() if not passed]
    return {
        "activated": not failures,
        "checks": checks,
        "failures": failures,
        "observed": compiled_snapshot,
    }


def run_preflight(founder_id: str) -> dict[str, Any]:
    """Read live state, compile it in-process, and evaluate the activation contract."""

    store = VectorStore.from_env()
    registry = build_registry(store=store)
    loop_state = read_sdk_loop_settings(store.client, user_id=founder_id)
    live_settings = loop_state.get("settings") or {}
    requirements = native_subagent_requirements(
        message=NON_ANCHOR_MESSAGE,
        intent={},
        settings=live_settings,
        user_id=founder_id,
    )
    capture_enabled = sdk_stream_capture_enabled(live_settings, founder_id)
    compiled = compile_activation_surface(
        store=store,
        registry=registry,
        founder_id=founder_id,
        settings=live_settings,
        model_driven_worker_server_urls={},
    )
    verdict = evaluate_activation_compile(
        loop_enabled=bool(loop_state.get("enabled")),
        requirements=requirements,
        capture_enabled=capture_enabled,
        compiled_snapshot=compiled_activation_snapshot(compiled),
    )
    verdict["non_anchor_message"] = NON_ANCHOR_MESSAGE
    return verdict


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--founder-id", required=True)
    args = parser.parse_args()

    try:
        verdict = run_preflight(args.founder_id)
    except Exception as exc:  # noqa: BLE001 - CLI must emit a bounded fail-closed verdict
        verdict = {
            "activated": False,
            "checks": {"runtime_completed": False},
            "failures": [f"{type(exc).__name__}: {exc}"],
        }
    print(json.dumps(verdict, indent=2, sort_keys=True))
    raise SystemExit(0 if verdict["activated"] else 1)


if __name__ == "__main__":
    main()
