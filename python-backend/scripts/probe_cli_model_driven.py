"""Phase D2 (SDK-M2) diagnostic — does the CLI consume an inline per-agent MCP server?

Stage H failed with the documented "no Task / max-turns" signature: the inverted manifest passed (a static
check on `options`), yet the lead never emitted a single `Task`. The hypothesis is that under
`--strict-mcp-config` the CLI only resolves servers that arrived via `--mcp-config` (top-level
`options.mcp_servers`), which by design excludes the worker server — leaving the worker agent's sole tool
unresolvable and `Task` with no valid `subagent_type`.

This varies ONE thing at a time against the real CLI and records, per variant:
  - did the lead emit `Task`?                      (task_seen)
  - did the worker tool fire, and from a subagent?  (worker_seen / agent_id_present)
  - did the lead call the worker tool DIRECTLY?     (leak — the §16 visibility trap)

Requires the probe server running (scripts/probe_cli_server.py) and ANTHROPIC_API_KEY in python-backend/.env.
"""

from __future__ import annotations

import anyio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parents[1]))

from claude_agent_sdk import ClaudeAgentOptions, query
from claude_agent_sdk.types import AgentDefinition, HookMatcher

load_dotenv(Path(__file__).parents[1] / ".env")

WORKER_SERVER = "vcso_workers"
WORKER_URL = "http://127.0.0.1:8765/mcp/"
WORKER_TOOL = f"mcp__{WORKER_SERVER}__run_structured_data_agent"
INLINE = {WORKER_SERVER: {"type": "http", "url": WORKER_URL}}

LEAD_PROMPT = (
    "You must delegate exactly once to the approved worker `structured_data_agent` using the SDK Task "
    "tool before answering. Do not answer from your own knowledge. The Task prompt must be exactly one "
    "JSON object with keys objective, output_format, tools_sources, boundaries, context_scope. After the "
    "Task returns, give a one-sentence answer citing its finding."
)
USER_PROMPT = "Our client concentration is rising and our margin is compressing. What should I do in the next 90 days?"


def build_options(*, strict: bool, worker_top_level: bool, events: list, provision_task: bool = False) -> ClaudeAgentOptions:
    async def pre_tool(input_data, tool_use_id, _ctx):
        events.append(
            {
                "tool": str(input_data.get("tool_name") or ""),
                "agent_id_present": bool(input_data.get("agent_id")),
            }
        )
        return {}

    agent = AgentDefinition(
        description="Bounded structured data worker.",
        prompt="Call your one tool with the objective from the Task contract, then return its finding.",
        tools=[WORKER_TOOL],
        model="haiku",
        maxTurns=3,
        permissionMode="dontAsk",
        mcpServers=[INLINE],
    )
    return ClaudeAgentOptions(
        # `tools` PROVISIONS built-in tools; `allowed_tools` only grants permission to ones already
        # provisioned. `tools=[]` disables every built-in INCLUDING Task, which is why the lead could
        # never delegate no matter what allowed_tools said.
        tools=["Task"] if provision_task else [],
        allowed_tools=["Task"],
        agents={"structured_data_agent": agent},
        mcp_servers=dict(INLINE) if worker_top_level else {},
        strict_mcp_config=strict,
        permission_mode="dontAsk",
        system_prompt="You are a bounded strategic assistant.\n\n" + LEAD_PROMPT,
        model="claude-sonnet-4-6",
        max_turns=6,
        max_budget_usd=0.15,
        include_partial_messages=False,
        hooks={"PreToolUse": [HookMatcher(matcher=r"^(Task|mcp__.*)$", hooks=[pre_tool])]},
        setting_sources=[],
        env={"ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", "")},
        thinking={"type": "disabled"},
    )


async def run_variant(label: str, *, strict: bool, worker_top_level: bool, provision_task: bool = False) -> None:
    events: list = []
    options = build_options(
        strict=strict, worker_top_level=worker_top_level, events=events, provision_task=provision_task
    )
    error = None
    try:
        async for _message in query(prompt=USER_PROMPT, options=options):
            pass
    except Exception as exc:  # noqa: BLE001 - diagnostic
        error = f"{type(exc).__name__}: {exc}"

    task_seen = [e for e in events if e["tool"] == "Task"]
    worker_calls = [e for e in events if e["tool"] == WORKER_TOOL]
    delegated = [e for e in worker_calls if e["agent_id_present"]]
    leaked = [e for e in worker_calls if not e["agent_id_present"]]

    print(f"\n--- {label} (strict_mcp_config={strict}, worker_top_level={worker_top_level}) ---")
    print(f"  Task emitted by lead : {'YES' if task_seen else 'NO'}")
    print(f"  worker tool called   : {'YES' if worker_calls else 'NO'}")
    print(f"  from a subagent      : {'YES' if delegated else 'NO'}")
    print(f"  LEAKED (lead direct) : {'YES' if leaked else 'NO'}")
    if error:
        print(f"  error                : {error[:200]}")
    verdict = "PASS" if (task_seen and delegated and not leaked) else "FAIL"
    print(f"  => {verdict}")


async def main() -> None:
    # A reproduces production exactly; B and C each change one thing; D applies the actual fix
    # (provision the Task built-in) while keeping production's strict/hidden-server construction.
    await run_variant("A production repro", strict=True, worker_top_level=False)
    await run_variant("B strict off", strict=False, worker_top_level=False)
    await run_variant("C server also top-level", strict=True, worker_top_level=True)
    await run_variant("D production + tools=['Task']", strict=True, worker_top_level=False, provision_task=True)


anyio.run(main)
