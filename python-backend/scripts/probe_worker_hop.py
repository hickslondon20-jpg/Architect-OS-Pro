"""Phase D2 (SDK-M2) diagnostic — exercise the ONE span canary 3 left unexplained.

Canary 3 proved the lead delegates and the worker tool fires from inside the subagent
(`agent_id_present: true`) against the real deployment — but no child run and no worker spend followed,
so `run_worker_capability` failed after the call was attempted. That span has never been tested anywhere:
the CLI probe's stand-in server ignores tokens and always succeeds.

This drives the REAL app: uvicorn in-process (so `TURN_REGISTRY` is genuinely shared, exactly as on
Railway), a real `TurnScope`, and a real MCP client call carrying the per-turn token in `?t=`. It covers
the ASGI token lift, the ContextVar, scope resolution, founder isolation, the contract→args mapping,
`SubAgentOrchestrator.start_run`, and the child-row write.

Case 1: valid token   -> expect a compact cited result and one completed child row.
Case 2: bogus token   -> expect a clean WorkerScopeError and NO row.

No CLI, no founder turn, no canary. Case 1 does invoke the real worker (small haiku cost) and writes one
child `agent_delegation_runs` row linked to the parent below.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parents[1]))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv(Path(__file__).parents[1] / ".env")

import uvicorn
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

PORT = 8123
FOUNDER = "cd490873-99aa-4533-9240-f0aa04deb54f"
# The canary-3 parent, so the child lands linked exactly as a real model-driven turn would write it.
PARENT_RUN_ID = "9dbed506-8e9c-4ee7-8e71-8d8e055537f6"

# The argument set a Task-contract delegation actually produces.
ARGS = {
    "objective": (
        "Bind the founder's latest ready financial dataset and return the compact, cited figures "
        "needed to assess client concentration and margin."
    ),
    "output_format": "compact_json",
    "tools_sources": ["founder_dataset"],
    "boundaries": ["founder isolation", "citations required", "compact output", "no raw payloads"],
    "context_scope": {"delegation_depth": 1},
}


async def call_worker(token: str, label: str) -> None:
    url = f"http://127.0.0.1:{PORT}/internal/mcp/workers/?t={token}"
    print(f"\n--- {label} ---")
    try:
        async with streamablehttp_client(url) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool("run_structured_data_agent", ARGS)
                text = result.content[0].text if result.content else ""
                print(f"  is_error : {result.isError}")
                print(f"  content  : {text[:600]}")
    except Exception as exc:  # noqa: BLE001 - diagnostic
        print(f"  EXCEPTION: {type(exc).__name__}: {exc}")


async def main() -> None:
    from main import app  # noqa: PLC0415 - import after dotenv so settings resolve
    from services.vcso_worker_mcp import TURN_REGISTRY, TurnScope
    from services.vector_store import VectorStore

    config = uvicorn.Config(app, host="127.0.0.1", port=PORT, log_level="warning")
    server = uvicorn.Server(config)
    serve_task = asyncio.create_task(server.serve())
    while not server.started:
        await asyncio.sleep(0.2)
    print(f"[app] running in-process on :{PORT}")

    try:
        store = VectorStore.from_env()
        token = TURN_REGISTRY.mint(
            TurnScope(
                user_id=FOUNDER,
                parent_surface="virtual_cso",
                thread_id=None,
                parent_message_id=None,
                parent_run_id=PARENT_RUN_ID,
                allowed_capabilities=frozenset({"structured_data_agent"}),
                store=store,
                progress_bridge=None,
            )
        )
        print(f"[registry] minted token, active_count={TURN_REGISTRY.active_count()}")

        await call_worker(token, "CASE 1 valid token (expect a cited result + one child row)")
        await call_worker("BOGUS-TOKEN-NOT-REGISTERED", "CASE 2 bogus token (expect clean refusal, no row)")

        TURN_REGISTRY.unregister(token)
        print(f"\n[registry] unregistered, active_count={TURN_REGISTRY.active_count()}")
    finally:
        server.should_exit = True
        await serve_task


asyncio.run(main())
