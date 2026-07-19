"""Phase D2 diagnostic — dump what the CLI actually returns for one model-driven variant."""

from __future__ import annotations

import anyio
import os
import sys
from pathlib import Path

# Windows console is cp1252; the model emits emoji. Never let a print crash the probe.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parents[1]))

from claude_agent_sdk import ClaudeAgentOptions, query
from claude_agent_sdk.types import AgentDefinition, HookMatcher

load_dotenv(Path(__file__).parents[1] / ".env")

WORKER_SERVER = "vcso_workers"
INLINE = {WORKER_SERVER: {"type": "http", "url": "http://127.0.0.1:8765/mcp/"}}
WORKER_TOOL = f"mcp__{WORKER_SERVER}__run_structured_data_agent"


async def main() -> None:
    events: list = []

    async def pre_tool(input_data, tool_use_id, _ctx):
        events.append(
            f"PreToolUse tool={input_data.get('tool_name')!r} "
            f"agent_id={'yes' if input_data.get('agent_id') else 'no'} id={tool_use_id}"
        )
        return {}

    async def post_tool(input_data, tool_use_id, _ctx):
        events.append(f"PostToolUse tool={input_data.get('tool_name')!r} id={tool_use_id}")
        return {}

    agent = AgentDefinition(
        description="Bounded structured data worker.",
        prompt="Call your one tool with the objective, then return its finding.",
        tools=[WORKER_TOOL],
        model="haiku",
        maxTurns=3,
        permissionMode="dontAsk",
        mcpServers=[INLINE],
    )
    options = ClaudeAgentOptions(
        tools=["Task"],
        allowed_tools=["Task"],
        agents={"structured_data_agent": agent},
        mcp_servers=dict(INLINE),
        strict_mcp_config=True,
        permission_mode="dontAsk",
        system_prompt=(
            "You are a bounded strategic assistant. You MUST call the Task tool with "
            "subagent_type='structured_data_agent' before answering. Do not answer directly."
        ),
        model="claude-sonnet-4-6",
        max_turns=6,
        max_budget_usd=0.15,
        hooks={
            # Deliberately unmatched (catch-all) so we see EVERY tool the CLI reports, not just the
            # ones a regex predicts — the question is whether Task fires a hook at all.
            "PreToolUse": [HookMatcher(hooks=[pre_tool])],
            "PostToolUse": [HookMatcher(hooks=[post_tool])],
        },
        setting_sources=[],
        env={"ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", "")},
        thinking={"type": "disabled"},
    )

    async for message in query(prompt="Delegate to structured_data_agent, then summarise.", options=options):
        name = type(message).__name__
        if name == "AssistantMessage":
            for block in getattr(message, "content", []) or []:
                bname = type(block).__name__
                if bname == "TextBlock":
                    print(f"[assistant text] {getattr(block, 'text', '')[:400]}")
                elif bname == "ToolUseBlock":
                    print(f"[assistant TOOL_USE] name={getattr(block, 'name', None)}")
                else:
                    print(f"[assistant {bname}]")
        elif name == "ResultMessage":
            print(f"[result] subtype={getattr(message,'subtype',None)} is_error={getattr(message,'is_error',None)}")
            print(f"[result] text={str(getattr(message,'result',''))[:400]}")
        elif name == "SystemMessage":
            data = getattr(message, "data", {}) or {}
            if data.get("subtype") == "init":
                print(f"[init] tools={data.get('tools')}")
                print(f"[init] agents={data.get('agents')}")
                print(f"[init] mcp_servers={data.get('mcp_servers')}")
        else:
            print(f"[{name}]")

    print(f"\nPreToolUse events: {events}")


anyio.run(main)
