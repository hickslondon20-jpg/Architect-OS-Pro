"""Phase D2 (SDK-M2) Stage-C smoke: confirm the loopback worker MCP endpoint serves the three worker
tools and cleanly rejects an unregistered per-turn token (no child row, no LLM spend). Run against a
locally started backend: `python -m uvicorn main:app --port 8000`."""

import asyncio
import os

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

BASE = os.environ.get(
    "SMOKE_WORKER_MCP_URL",
    "http://127.0.0.1:8000/internal/mcp/workers/?t=SMOKE-DOES-NOT-EXIST",
)


async def main() -> None:
    async with streamablehttp_client(BASE) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("TOOLS:", [tool.name for tool in tools.tools])
            result = await session.call_tool("run_structured_data_agent", {"objective": "smoke"})
            content = result.content[0].text[:200] if result.content else None
            print("IS_ERROR:", result.isError, "| CONTENT:", content)


asyncio.run(main())
