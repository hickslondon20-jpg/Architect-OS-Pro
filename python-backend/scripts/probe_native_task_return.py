"""Local-only probe for SDK Agent result-return semantics.

Runs two isolated sessions against one synthetic in-process MCP server:
1. the Agent call exactly as emitted by the model;
2. the same call with ``run_in_background: false`` injected by PreToolUse.

Each session uses an ephemeral CLAUDE_CONFIG_DIR and records the actual Agent
input, subagent lifecycle, in-process tool attribution, returned Agent result,
final lead text, turns, and spend.
"""

from __future__ import annotations

import anyio
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).parents[1]))

from claude_agent_sdk import (  # noqa: E402
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    SystemMessage,
    ToolUseBlock,
    create_sdk_mcp_server,
    query,
    tool,
)
from claude_agent_sdk.types import AgentDefinition, HookMatcher  # noqa: E402


load_dotenv(Path(__file__).parents[1] / ".env")

SERVER = "return_probe"
TOOL = f"mcp__{SERVER}__read_probe_value"
SENTINEL = "IN_PROCESS_RESULT_RETURNED"


def _small(value: Any, limit: int = 800) -> Any:
    text = json.dumps(value, default=str, ensure_ascii=False)
    return text if len(text) <= limit else text[:limit] + "…"


async def run_variant(*, label: str, agent_input_mode: str) -> dict[str, Any]:
    events: list[dict[str, Any]] = []

    @tool(
        "read_probe_value",
        "Return the deterministic probe sentinel. The worker must call this once.",
        {"request": str},
    )
    async def read_probe_value(args: dict[str, Any]) -> dict[str, Any]:
        events.append({"event": "tool_handler", "args": dict(args)})
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"{SENTINEL}: the in-process worker tool completed.",
                }
            ]
        }

    server = create_sdk_mcp_server(name=SERVER, version="1.0.0", tools=[read_probe_value])

    async def pre_tool(input_data: dict[str, Any], tool_use_id: str, _ctx: Any) -> dict[str, Any]:
        tool_name = str(input_data.get("tool_name") or "")
        tool_input = dict(input_data.get("tool_input") or {})
        events.append(
            {
                "event": "pre_tool",
                "tool": tool_name,
                "tool_use_id": tool_use_id,
                "agent_id": input_data.get("agent_id"),
                "agent_type": input_data.get("agent_type"),
                "input": tool_input,
            }
        )
        if tool_name in {"Agent", "Task"} and agent_input_mode in {"omit", "explicit_false"}:
            updated = dict(tool_input)
            if agent_input_mode == "omit":
                updated.pop("run_in_background", None)
            else:
                updated["run_in_background"] = False
            events.append(
                {
                    "event": "pre_tool_updated_input",
                    "tool": tool_name,
                    "input": updated,
                }
            )
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "allow",
                    "permissionDecisionReason": f"Probe Agent input mode: {agent_input_mode}.",
                    "updatedInput": updated,
                }
            }
        return {}

    async def post_tool(input_data: dict[str, Any], tool_use_id: str, _ctx: Any) -> dict[str, Any]:
        events.append(
            {
                "event": "post_tool",
                "tool": input_data.get("tool_name"),
                "tool_use_id": tool_use_id,
                "agent_id": input_data.get("agent_id"),
                "agent_type": input_data.get("agent_type"),
                "input": input_data.get("tool_input"),
                "response": _small(input_data.get("tool_response")),
            }
        )
        return {}

    async def post_tool_failure(
        input_data: dict[str, Any], tool_use_id: str, _ctx: Any
    ) -> dict[str, Any]:
        events.append(
            {
                "event": "post_tool_failure",
                "tool": input_data.get("tool_name"),
                "tool_use_id": tool_use_id,
                "agent_id": input_data.get("agent_id"),
                "error": input_data.get("error"),
            }
        )
        return {}

    async def lifecycle(input_data: dict[str, Any], _tool_use_id: str | None, _ctx: Any) -> dict[str, Any]:
        events.append(
            {
                "event": input_data.get("hook_event_name"),
                "agent_id": input_data.get("agent_id"),
                "agent_type": input_data.get("agent_type"),
                "stop_hook_active": input_data.get("stop_hook_active"),
            }
        )
        return {}

    agent = AgentDefinition(
        description="Synthetic worker that proves in-process result return.",
        prompt=(
            f"Call {TOOL} exactly once with request='probe'. Then return the tool's full "
            f"sentinel text to the lead. Do not do any other work."
        ),
        tools=[TOOL],
        model="haiku",
        maxTurns=3,
        permissionMode="dontAsk",
        mcpServers=[SERVER],
    )

    with tempfile.TemporaryDirectory(prefix=f"claude-native-{label}-") as config_dir:
        options = ClaudeAgentOptions(
            tools=["Task"],
            allowed_tools=["Task", TOOL],
            agents={"return_probe_agent": agent},
            mcp_servers={SERVER: server},
            strict_mcp_config=True,
            permission_mode="dontAsk",
            system_prompt=(
                "Delegate exactly once to return_probe_agent using the Agent tool. "
                "Do not call MCP tools yourself. Wait for the worker result, then quote its "
                f"{SENTINEL} text exactly and finish."
            ),
            model="claude-sonnet-4-6",
            max_turns=4,
            max_budget_usd=0.08,
            hooks={
                "PreToolUse": [HookMatcher(hooks=[pre_tool])],
                "PostToolUse": [HookMatcher(hooks=[post_tool])],
                "PostToolUseFailure": [HookMatcher(hooks=[post_tool_failure])],
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
            "agent_input_mode": agent_input_mode,
            "config_dir": config_dir,
            "assistant_tool_uses": [],
            "assistant_text": [],
            "events": events,
        }
        try:
            async for message in query(
                prompt="Run the one required return probe now.",
                options=options,
            ):
                if isinstance(message, SystemMessage) and (message.data or {}).get("subtype") == "init":
                    result["init_tools"] = (message.data or {}).get("tools")
                    result["init_agents"] = (message.data or {}).get("agents")
                elif isinstance(message, AssistantMessage):
                    for block in message.content or []:
                        if isinstance(block, ToolUseBlock):
                            result["assistant_tool_uses"].append(
                                {"name": block.name, "input": block.input}
                            )
                        elif hasattr(block, "text"):
                            result["assistant_text"].append(str(block.text))
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
        return result


async def main() -> None:
    results = [
        await run_variant(label="omitted", agent_input_mode="omit"),
        await run_variant(label="explicit_false", agent_input_mode="explicit_false"),
    ]
    print(json.dumps(results, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    anyio.run(main)
