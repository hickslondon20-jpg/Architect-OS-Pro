"""Local-only probe for native Agent and in-process MCP result-return semantics.

The arms deliberately reproduce the production native surface shape without
touching a feature flag or founder data:

1. one Agent call whose ``run_in_background: true`` input is rewritten to false;
2. two explicit-false Agent calls emitted in one assistant turn;
3. two explicit-false Agent calls emitted in separate assistant turns;
4. arm 2 again with ``AgentDefinition.background=False``;
5. one in-process MCP call made directly by the lead.

Each arm uses an ephemeral ``CLAUDE_CONFIG_DIR``, two granular agent
definitions, strict MCP configuration, partial messages, ``dontAsk`` at both
levels, and the production hook topology. The output records assistant-message
grouping, lifecycle timing, Agent/MCP tool results, turns, duration, and spend.
"""

from __future__ import annotations

import argparse
import anyio
import importlib.metadata
import json
import os
import platform
import subprocess
import sys
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
import claude_agent_sdk

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).parents[1]))

from claude_agent_sdk import (  # noqa: E402
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    StreamEvent,
    SystemMessage,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
    create_sdk_mcp_server,
    query,
    tool,
)
from claude_agent_sdk.types import AgentDefinition, HookMatcher  # noqa: E402
from services.vcso_sdk_config import (  # noqa: E402
    DISALLOWED_SDK_BUILTINS,
    GRANULAR_NATIVE_AGENT_MAX_TURNS,
)


load_dotenv(Path(__file__).parents[1] / ".env")

SERVER = "return_probe"
ALPHA_TOOL = f"mcp__{SERVER}__read_alpha_value"
BETA_TOOL = f"mcp__{SERVER}__read_beta_value"
LEAD_TOOL = f"mcp__{SERVER}__read_lead_value"
ALPHA_SENTINEL = "ALPHA_IN_PROCESS_RESULT_RETURNED"
BETA_SENTINEL = "BETA_IN_PROCESS_RESULT_RETURNED"
LEAD_SENTINEL = "LEAD_IN_PROCESS_RESULT_RETURNED"
DELEGATION_TOOL = "Agent"
DELEGATION_OR_MCP_MATCHER = rf"^({DELEGATION_TOOL}|mcp__.*)$"

ARM_PROMPTS = {
    "one_hook_rewrite": (
        "Delegate exactly once to alpha_probe_agent. In the Agent input, explicitly request "
        "run_in_background=true. The runtime hook will normalize it. Do not call beta. Wait for "
        f"the Agent result, then quote {ALPHA_SENTINEL} exactly and finish."
    ),
    "two_same_turn": (
        "In one single assistant message, emit exactly two Agent tool calls before waiting for "
        "either result: one to alpha_probe_agent and one to beta_probe_agent. Explicitly set "
        "run_in_background=false on both calls. After both Agent results return, quote both "
        f"{ALPHA_SENTINEL} and {BETA_SENTINEL} exactly and finish."
    ),
    "two_separate_turns": (
        "Delegate first to alpha_probe_agent with run_in_background=false and wait for its Agent "
        f"result. Only after {ALPHA_SENTINEL} has returned, use a later assistant turn to delegate "
        "to beta_probe_agent with run_in_background=false. Wait for that result, then quote both "
        f"{ALPHA_SENTINEL} and {BETA_SENTINEL} exactly and finish. Never emit both Agent calls in "
        "the same assistant message."
    ),
    "two_same_turn_definition_false": (
        "In one single assistant message, emit exactly two Agent tool calls before waiting for "
        "either result: one to alpha_probe_agent and one to beta_probe_agent. Explicitly set "
        "run_in_background=false on both calls. Both AgentDefinitions also set background=false. "
        f"After both results return, quote {ALPHA_SENTINEL} and {BETA_SENTINEL} exactly and finish."
    ),
    "lead_mcp": (
        f"Do not delegate. Call {LEAD_TOOL} exactly once with request='lead-probe'. Wait for the "
        f"tool result, then quote {LEAD_SENTINEL} exactly and finish."
    ),
}


def _small(value: Any, limit: int = 1_200) -> Any:
    text = json.dumps(value, default=str, ensure_ascii=False)
    return text if len(text) <= limit else text[:limit] + "..."


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _agent_response_text(agent_posts: list[dict[str, Any]]) -> str:
    """Extract only returned Agent content, excluding prompts and lead narration."""
    text_parts: list[str] = []
    for event in agent_posts:
        response = event.get("response")
        if isinstance(response, str):
            try:
                response = json.loads(response)
            except json.JSONDecodeError:
                response = None
        if not isinstance(response, dict):
            continue
        content = response.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if isinstance(block, dict) and isinstance(block.get("text"), str):
                text_parts.append(block["text"])
    return "\n".join(text_parts)


def _runtime_versions() -> dict[str, str]:
    try:
        sdk_version = importlib.metadata.version("claude-agent-sdk")
    except importlib.metadata.PackageNotFoundError:
        sdk_version = str(getattr(claude_agent_sdk, "__version__", "unavailable"))
    cli_name = "claude.exe" if platform.system() == "Windows" else "claude"
    bundled_cli = Path(claude_agent_sdk.__file__).resolve().parent / "_bundled" / cli_name
    executable = str(bundled_cli) if bundled_cli.is_file() else "claude"
    cli_source = "bundled" if bundled_cli.is_file() else "system"
    cli_version = "unavailable"
    try:
        completed = subprocess.run(
            [executable, "--version"],
            capture_output=True,
            text=True,
            timeout=20,
            check=True,
        )
        cli_version = (completed.stdout or completed.stderr or "").strip()[:120] or "unavailable"
    except (OSError, subprocess.SubprocessError):
        pass
    return {
        "claude_agent_sdk_version": sdk_version[:80],
        "claude_code_cli_version": cli_version,
        "claude_code_cli_source": cli_source,
    }


def _event_summary(result: dict[str, Any]) -> dict[str, Any]:
    events = result["events"]
    starts = [event for event in events if event.get("event") == "SubagentStart"]
    stops = [event for event in events if event.get("event") == "SubagentStop"]
    agent_posts = [
        event
        for event in events
        if event.get("event") == "post_tool" and event.get("tool") == DELEGATION_TOOL
    ]
    lead_posts = [
        event
        for event in events
        if event.get("event") == "post_tool" and event.get("tool") == LEAD_TOOL
    ]
    start_gap_ms = None
    if len(starts) >= 2:
        start_gap_ms = round(starts[1]["elapsed_ms"] - starts[0]["elapsed_ms"], 3)
    serialized_lead_results = json.dumps(lead_posts, ensure_ascii=False, default=str)
    assistant_text = "\n".join(result["assistant_text"])
    agent_response_text = _agent_response_text(agent_posts)
    expected_agent_sentinels = result["expected_agent_sentinels"]
    agent_content_returned = {
        sentinel: sentinel in agent_response_text
        for sentinel in expected_agent_sentinels
    }
    lead_content_returned = (
        LEAD_SENTINEL in serialized_lead_results or LEAD_SENTINEL in assistant_text
        if result["label"] == "lead_mcp"
        else None
    )
    assistant_agent_turns = [
        {
            "assistant_turn": turn["assistant_turn"],
            "message_id": turn.get("message_id"),
            "uuid": turn.get("uuid"),
            "agent_calls": [
                call for call in turn["tool_uses"] if call["name"] == DELEGATION_TOOL
            ],
        }
        for turn in result["assistant_turns"]
        if any(call["name"] == DELEGATION_TOOL for call in turn["tool_uses"])
    ]
    agent_message_ids = [
        str(turn["message_id"])
        for turn in assistant_agent_turns
        if turn.get("message_id")
    ]
    if result.get("exception"):
        status = "exception"
    elif result.get("result", {}).get("is_error"):
        status = "result_error"
    elif len(stops) < result["expected_subagent_stops"]:
        status = "missing_subagent_stop"
    elif not all(agent_content_returned.values()):
        status = "missing_agent_content"
    elif result["label"] == "lead_mcp" and not lead_content_returned:
        status = "missing_lead_tool_content"
    else:
        status = "completed_in_band"
    return {
        "status": status,
        "subagent_start_count": len(starts),
        "subagent_stop_count": len(stops),
        "subagent_start_gap_ms": start_gap_ms,
        "agent_post_tool_count": len(agent_posts),
        "agent_content_returned": agent_content_returned,
        "agent_response_text": agent_response_text,
        "agent_max_turns": result["agent_max_turns"],
        "lead_post_tool_count": len(lead_posts),
        "lead_content_returned": lead_content_returned,
        "assistant_agent_turns": assistant_agent_turns,
        "agent_call_message_ids": agent_message_ids,
        "agent_calls_share_one_message": (
            len(agent_message_ids) > 1 and len(set(agent_message_ids)) == 1
        ),
        "wall_clock_ms": result["wall_clock_ms"],
        "result": result.get("result"),
        "exception": result.get("exception"),
    }


async def run_arm(
    *,
    label: str,
    agent_max_turns: int = GRANULAR_NATIVE_AGENT_MAX_TURNS,
    turn_cap_override: bool = False,
) -> dict[str, Any]:
    if label not in ARM_PROMPTS:
        raise ValueError(f"Unknown probe arm: {label}")

    events: list[dict[str, Any]] = []
    started = time.perf_counter()

    def record(event: str, **details: Any) -> None:
        events.append(
            {
                "event": event,
                "elapsed_ms": round((time.perf_counter() - started) * 1_000, 3),
                "at": _utc_now(),
                **details,
            }
        )

    @tool(
        "read_alpha_value",
        "Return the deterministic alpha sentinel. Only alpha_probe_agent may call this.",
        {"request": str},
    )
    async def read_alpha_value(args: dict[str, Any]) -> dict[str, Any]:
        record("tool_handler", tool="read_alpha_value", args=dict(args))
        await anyio.sleep(0.25)
        return {
            "content": [
                {"type": "text", "text": f"{ALPHA_SENTINEL}: alpha completed in process."}
            ]
        }

    @tool(
        "read_beta_value",
        "Return the deterministic beta sentinel. Only beta_probe_agent may call this.",
        {"request": str},
    )
    async def read_beta_value(args: dict[str, Any]) -> dict[str, Any]:
        record("tool_handler", tool="read_beta_value", args=dict(args))
        await anyio.sleep(0.25)
        return {
            "content": [
                {"type": "text", "text": f"{BETA_SENTINEL}: beta completed in process."}
            ]
        }

    @tool(
        "read_lead_value",
        "Return the deterministic lead sentinel. The lead calls this directly.",
        {"request": str},
    )
    async def read_lead_value(args: dict[str, Any]) -> dict[str, Any]:
        record("tool_handler", tool="read_lead_value", args=dict(args))
        await anyio.sleep(0.25)
        return {
            "content": [
                {"type": "text", "text": f"{LEAD_SENTINEL}: lead tool completed in process."}
            ]
        }

    server = create_sdk_mcp_server(
        name=SERVER,
        version="1.0.0",
        tools=[read_alpha_value, read_beta_value, read_lead_value],
    )

    async def pre_agent(input_data: dict[str, Any], tool_use_id: str, _ctx: Any) -> dict[str, Any]:
        tool_input = dict(input_data.get("tool_input") or {})
        if "run_in_background" not in tool_input:
            input_state = "absent"
        elif tool_input.get("run_in_background") is True:
            input_state = "true"
        else:
            input_state = "present"
        updated = dict(tool_input)
        updated["run_in_background"] = False
        record(
            "delegation_input_rewrite",
            tool=input_data.get("tool_name"),
            tool_use_id=tool_use_id,
            agent_id=input_data.get("agent_id"),
            agent_type=input_data.get("agent_type"),
            input_state=input_state,
            original_input=_small(tool_input),
            updated_input=_small(updated),
        )
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
                "permissionDecisionReason": "Probe forces foreground Agent execution.",
                "updatedInput": updated,
            }
        }

    async def pre_mcp_access(
        input_data: dict[str, Any], tool_use_id: str, _ctx: Any
    ) -> dict[str, Any]:
        record(
            "native_access_gate",
            tool=input_data.get("tool_name"),
            tool_use_id=tool_use_id,
            agent_id=input_data.get("agent_id"),
            decision="allow",
        )
        return {}

    async def pre_compute_gate(
        input_data: dict[str, Any], tool_use_id: str, _ctx: Any
    ) -> dict[str, Any]:
        record(
            "compute_gate",
            tool=input_data.get("tool_name"),
            tool_use_id=tool_use_id,
            agent_id=input_data.get("agent_id"),
            decision="allow",
        )
        return {}

    async def post_tool(input_data: dict[str, Any], tool_use_id: str, _ctx: Any) -> dict[str, Any]:
        record(
            "post_tool",
            tool=input_data.get("tool_name"),
            tool_use_id=tool_use_id,
            agent_id=input_data.get("agent_id"),
            agent_type=input_data.get("agent_type"),
            input=_small(input_data.get("tool_input")),
            response=_small(input_data.get("tool_response")),
        )
        return {}

    async def post_tool_failure(
        input_data: dict[str, Any], tool_use_id: str, _ctx: Any
    ) -> dict[str, Any]:
        record(
            "post_tool_failure",
            tool=input_data.get("tool_name"),
            tool_use_id=tool_use_id,
            agent_id=input_data.get("agent_id"),
            error_type=type(input_data.get("error")).__name__,
            error=_small(input_data.get("error")),
        )
        return {}

    async def lifecycle(input_data: dict[str, Any], tool_use_id: str | None, _ctx: Any) -> dict[str, Any]:
        record(
            str(input_data.get("hook_event_name") or "lifecycle"),
            tool_use_id=tool_use_id,
            agent_id=input_data.get("agent_id"),
            agent_type=input_data.get("agent_type"),
            stop_hook_active=input_data.get("stop_hook_active"),
        )
        return {}

    async def stop_hook(input_data: dict[str, Any], tool_use_id: str | None, _ctx: Any) -> dict[str, Any]:
        record(
            "Stop",
            tool_use_id=tool_use_id,
            stop_hook_active=input_data.get("stop_hook_active"),
        )
        return {}

    async def pre_compact(
        input_data: dict[str, Any], tool_use_id: str | None, _ctx: Any
    ) -> dict[str, Any]:
        record(
            "PreCompact",
            tool_use_id=tool_use_id,
            trigger=input_data.get("trigger"),
        )
        return {}

    definition_background = False if label == "two_same_turn_definition_false" else None
    alpha_agent = AgentDefinition(
        description="Synthetic alpha worker for foreground result-return diagnostics.",
        prompt=(
            f"Call {ALPHA_TOOL} exactly once with request='alpha'. Then return the full "
            f"{ALPHA_SENTINEL} tool text to the lead and stop."
        ),
        tools=[ALPHA_TOOL],
        disallowedTools=list(DISALLOWED_SDK_BUILTINS),
        model="haiku",
        maxTurns=agent_max_turns,
        background=definition_background,
        permissionMode="dontAsk",
        mcpServers=[SERVER],
    )
    beta_agent = AgentDefinition(
        description="Synthetic beta worker for foreground result-return diagnostics.",
        prompt=(
            f"Call {BETA_TOOL} exactly once with request='beta'. Then return the full "
            f"{BETA_SENTINEL} tool text to the lead and stop."
        ),
        tools=[BETA_TOOL],
        disallowedTools=list(DISALLOWED_SDK_BUILTINS),
        model="haiku",
        maxTurns=agent_max_turns,
        background=definition_background,
        permissionMode="dontAsk",
        mcpServers=[SERVER],
    )

    expected_agent_sentinels = (
        []
        if label == "lead_mcp"
        else [ALPHA_SENTINEL]
        if label == "one_hook_rewrite"
        else [ALPHA_SENTINEL, BETA_SENTINEL]
    )
    expected_subagent_stops = len(expected_agent_sentinels)

    with tempfile.TemporaryDirectory(prefix=f"claude-native-{label}-") as config_dir:
        options = ClaudeAgentOptions(
            tools=["Task"],
            allowed_tools=["Task", ALPHA_TOOL, BETA_TOOL, LEAD_TOOL],
            agents={
                "alpha_probe_agent": alpha_agent,
                "beta_probe_agent": beta_agent,
            },
            mcp_servers={SERVER: server},
            strict_mcp_config=True,
            permission_mode="dontAsk",
            system_prompt=(
                "Run exactly the requested diagnostic arm. Never substitute direct MCP calls for "
                "a requested Agent call, never retry a refused or missing call, and finish as soon "
                "as the requested sentinel results have been quoted."
            ),
            model="claude-sonnet-4-6",
            max_turns=6,
            max_budget_usd=0.08,
            include_partial_messages=True,
            include_hook_events=True,
            hooks={
                "PreToolUse": [
                    HookMatcher(matcher=DELEGATION_TOOL, hooks=[pre_agent]),
                    HookMatcher(
                        matcher=r"^mcp__.*$",
                        hooks=[pre_mcp_access, pre_compute_gate],
                    ),
                ],
                "PostToolUse": [
                    HookMatcher(matcher=DELEGATION_OR_MCP_MATCHER, hooks=[post_tool])
                ],
                "PostToolUseFailure": [
                    HookMatcher(
                        matcher=DELEGATION_OR_MCP_MATCHER,
                        hooks=[post_tool_failure],
                    )
                ],
                "Stop": [HookMatcher(hooks=[stop_hook])],
                "PreCompact": [HookMatcher(hooks=[pre_compact])],
                "SubagentStart": [HookMatcher(hooks=[lifecycle])],
                "SubagentStop": [HookMatcher(hooks=[lifecycle])],
            },
            setting_sources=[],
            env={
                "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", ""),
                "CLAUDE_CONFIG_DIR": config_dir,
            },
            thinking={"type": "disabled"},
        )

        result: dict[str, Any] = {
            "label": label,
            "prompt": ARM_PROMPTS[label],
            "definition_background": definition_background,
            "agent_max_turns": agent_max_turns,
            "compiled_surface_comparison": {
                "production_granular_max_turns": GRANULAR_NATIVE_AGENT_MAX_TURNS,
                "turn_cap_override_explicit": turn_cap_override,
                "field_provenance": {
                    "description": "synthetic probe worker",
                    "prompt": "synthetic deterministic one-tool contract",
                    "tools": "synthetic in-process sentinel tool",
                    "disallowedTools": "matches production compiler constant",
                    "model": "synthetic haiku route",
                    "maxTurns": (
                        "explicit diagnostic override"
                        if turn_cap_override
                        else "matches production granular floor"
                    ),
                    "permissionMode": "matches production dontAsk",
                    "mcpServers": "synthetic in-process probe server",
                    "background": (
                        "explicit false diagnostic arm"
                        if definition_background is False
                        else "matches production unset value"
                    ),
                },
            },
            "runtime_versions": _runtime_versions(),
            "config_dir": config_dir,
            "expected_agent_sentinels": expected_agent_sentinels,
            "expected_subagent_stops": expected_subagent_stops,
            "assistant_turns": [],
            "assistant_text": [],
            "user_tool_results": [],
            "partial_message_count": 0,
            "events": events,
        }
        assistant_turn = 0
        try:
            async for message in query(prompt=ARM_PROMPTS[label], options=options):
                if isinstance(message, SystemMessage) and (message.data or {}).get("subtype") == "init":
                    result["init_tools"] = (message.data or {}).get("tools")
                    result["init_agents"] = (message.data or {}).get("agents")
                    result["cli_version"] = (message.data or {}).get("claude_code_version")
                elif isinstance(message, AssistantMessage):
                    assistant_turn += 1
                    turn: dict[str, Any] = {
                        "assistant_turn": assistant_turn,
                        "message_id": message.message_id,
                        "uuid": message.uuid,
                        "stop_reason": message.stop_reason,
                        "parent_tool_use_id": message.parent_tool_use_id,
                        "tool_uses": [],
                        "text": [],
                    }
                    for block in message.content or []:
                        if isinstance(block, ToolUseBlock):
                            turn["tool_uses"].append(
                                {"name": block.name, "input": block.input, "id": block.id}
                            )
                        elif hasattr(block, "text"):
                            text = str(block.text)
                            turn["text"].append(text)
                            result["assistant_text"].append(text)
                    result["assistant_turns"].append(turn)
                elif isinstance(message, UserMessage):
                    tool_results = []
                    if isinstance(message.content, list):
                        for block in message.content:
                            if isinstance(block, ToolResultBlock):
                                tool_results.append(
                                    {
                                        "tool_use_id": block.tool_use_id,
                                        "is_error": block.is_error,
                                        "content": _small(block.content),
                                    }
                                )
                    if tool_results or message.tool_use_result:
                        result["user_tool_results"].append(
                            {
                                "parent_tool_use_id": message.parent_tool_use_id,
                                "tool_results": tool_results,
                                "tool_use_result": _small(message.tool_use_result),
                            }
                        )
                elif isinstance(message, StreamEvent):
                    result["partial_message_count"] += 1
                elif isinstance(message, ResultMessage):
                    result["result"] = {
                        "subtype": message.subtype,
                        "is_error": message.is_error,
                        "num_turns": message.num_turns,
                        "total_cost_usd": message.total_cost_usd,
                        "duration_ms": message.duration_ms,
                        "result": message.result,
                    }
        except Exception as exc:  # noqa: BLE001 - diagnostic must retain raw exception
            result["exception"] = {
                "type": type(exc).__name__,
                "message": str(exc),
                "repr": repr(exc),
            }
        result["wall_clock_ms"] = round((time.perf_counter() - started) * 1_000, 3)
        result["summary"] = _event_summary(result)
        return result


async def main(
    labels: list[str],
    output: Path | None,
    agent_max_turns: int,
    turn_cap_override: bool,
) -> None:
    if not turn_cap_override:
        assert agent_max_turns == GRANULAR_NATIVE_AGENT_MAX_TURNS
    results = [
        await run_arm(
            label=label,
            agent_max_turns=agent_max_turns,
            turn_cap_override=turn_cap_override,
        )
        for label in labels
    ]
    payload = json.dumps(results, indent=2, ensure_ascii=False, default=str)
    if output is not None:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(payload + "\n", encoding="utf-8")
        print(
            json.dumps(
                {
                    "output": str(output),
                    "summaries": [result["summary"] for result in results],
                },
                indent=2,
                ensure_ascii=False,
            )
        )
    else:
        print(payload)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--arm",
        action="append",
        choices=tuple(ARM_PROMPTS),
        help="Run only this arm. Repeat to run multiple arms. Defaults to all arms.",
    )
    parser.add_argument("--output", type=Path, help="Optional JSON evidence file.")
    parser.add_argument(
        "--agent-max-turns",
        type=int,
        default=None,
        help=(
            "Explicit diagnostic override for both probe workers. "
            f"Default: production granular floor ({GRANULAR_NATIVE_AGENT_MAX_TURNS})."
        ),
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    turn_cap_override = args.agent_max_turns is not None
    agent_max_turns = (
        args.agent_max_turns
        if turn_cap_override
        else GRANULAR_NATIVE_AGENT_MAX_TURNS
    )
    if agent_max_turns < 1:
        raise SystemExit("--agent-max-turns must be at least 1")
    anyio.run(
        main,
        args.arm or list(ARM_PROMPTS),
        args.output,
        agent_max_turns,
        turn_cap_override,
    )
