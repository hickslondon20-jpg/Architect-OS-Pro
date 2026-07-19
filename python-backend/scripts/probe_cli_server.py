"""Phase D2 (SDK-M2) diagnostic — a standalone stand-in for the worker MCP server.

Deliberately isolated from `vcso_worker_mcp*`: the open question is whether the *CLI* consumes an inline
per-agent MCP server, not whether our worker core works. This exposes one trivially-succeeding tool with
the same name the real server uses, so any failure is unambiguously SDK/CLI wiring.

Run: python scripts/probe_cli_server.py   (serves streamable-http on 127.0.0.1:8765/mcp/)
"""

from mcp.server.fastmcp import FastMCP

server = FastMCP(name="vcso_workers", host="127.0.0.1", port=8765)


@server.tool(
    name="run_structured_data_agent",
    description="Run the bounded structured_data_agent worker for an approved Task delegation.",
)
async def run_structured_data_agent(objective: str = "") -> str:
    print(f"[probe-server] TOOL CALLED objective={objective[:80]!r}", flush=True)
    return '{"status":"completed","finding":"client_concentration=41%","citations":["ds-1"]}'


if __name__ == "__main__":
    server.run(transport="streamable-http")
