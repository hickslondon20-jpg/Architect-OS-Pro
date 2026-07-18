"""Phase D2 (SDK-M2) — external (loopback HTTP) MCP transport for the scoped worker executor.

This is the **transport** layer over `services/vcso_worker_mcp.py` (the pure core). It exists so the
`run_<agent>` worker tools can be exposed from a server that is referenced **inline, per-agent** in each
worker's `AgentDefinition.mcpServers` and kept **out** of the lead's top-level `mcp_servers` — the only
construction the SDK source proves can hide those tools from the lead while keeping them callable inside a
Task-spawned subagent (`04B-D2-FINDINGS.md` §2–§3).

Loopback by design: this app is mounted on the same FastAPI process that runs the `claude` CLI subprocess,
so `TURN_REGISTRY` (in the core) is shared in-process and no cross-process store is needed. The subagent's
inline server URL carries the **per-turn token** as a query param (`?t=<token>`); a thin ASGI wrapper lifts
it into a `ContextVar` before delegating to FastMCP, so each tool call resolves to exactly one founder turn.

VALIDATION (local, no canary) — the checklist's Step 1: start the backend, then against
`<mount>/?t=<probe-token>` confirm `initialize` + `tools/list` return the three worker tools, a
`tools/call` with a registered token creates one `agent_delegation_runs` child row, and an unknown/expired
token yields a clean MCP `is_error` with no row.

SCOPE GUARD: imported only by `main.py` (to mount) and the SDK-M2 config/loop wiring, all reachable only
behind the dark `vcso_sdk_loop` sub-flag `native_model_driven_enabled`. Changes no live path on its own.
"""

from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from contextvars import ContextVar
from typing import Any, AsyncIterator
from urllib.parse import parse_qs

from mcp.server.fastmcp import FastMCP

from services.vcso_worker_mcp import (
    WORKER_CAPABILITY_KEYS,
    WorkerScopeError,
    run_worker_capability,
)

logger = logging.getLogger(__name__)

# Path this ASGI app is mounted at on the FastAPI backend (loopback only). Kept off the public `/api`
# surface; the per-turn token is the authorization (a call with no/foreign token is refused in the core).
WORKER_MCP_MOUNT_PATH = "/internal/mcp/workers"

# Per-request turn token, lifted from the URL query by the ASGI wrapper (below) and read by each tool.
_TURN_TOKEN: ContextVar[str] = ContextVar("vcso_worker_turn_token", default="")


def _current_token() -> str:
    return _TURN_TOKEN.get()


async def _dispatch(capability_key: str, args: dict[str, Any]) -> str:
    """Run one capability for the current turn token and return the compact result as JSON text.

    A `WorkerScopeError` (unknown/expired token or unpermitted capability) propagates so FastMCP marks the
    tool result `is_error` — the lead then sees a bounded failure, never a foreign founder's data."""

    token = _current_token()
    result = await run_worker_capability(token, capability_key, args)
    return json.dumps(result, default=str)[:12000]


def build_worker_fastmcp() -> FastMCP:
    """Construct the FastMCP server exposing one tool per P4 worker capability.

    Stateless HTTP + JSON responses keep each `tools/call` a standalone request, so the per-request token
    contextvar is sufficient and there is no session state to reconcile with the CLI client."""

    server = FastMCP(
        name="vcso_workers",
        stateless_http=True,
        json_response=True,
        streamable_http_path="/",
    )

    # One explicit tool per capability. Signatures mirror the in-process handler's input schema
    # (objective/output_format/tools_sources/boundaries/context_scope) so the delegation contract the lead
    # writes is identical regardless of transport. All are read-only bounded workers.
    def _args(objective: str, output_format: Any, tools_sources: Any, boundaries: Any, context_scope: Any) -> dict[str, Any]:
        return {
            "objective": objective,
            "output_format": output_format,
            "tools_sources": tools_sources,
            "boundaries": boundaries,
            "context_scope": context_scope if isinstance(context_scope, dict) else {},
        }

    @server.tool(
        name="run_structured_data_agent",
        description="Run the founder-scoped bounded structured_data_agent for an approved Task delegation.",
    )
    async def run_structured_data_agent(  # noqa: ANN202 - FastMCP infers schema from the signature
        objective: str,
        output_format: Any = "",
        tools_sources: Any = None,
        boundaries: Any = None,
        context_scope: dict[str, Any] | None = None,
    ) -> str:
        return await _dispatch(
            "structured_data_agent", _args(objective, output_format, tools_sources, boundaries, context_scope)
        )

    @server.tool(
        name="run_sandbox_execution_agent",
        description="Run the founder-scoped bounded sandbox_execution_agent for an approved Task delegation.",
    )
    async def run_sandbox_execution_agent(  # noqa: ANN202
        objective: str,
        output_format: Any = "",
        tools_sources: Any = None,
        boundaries: Any = None,
        context_scope: dict[str, Any] | None = None,
    ) -> str:
        return await _dispatch(
            "sandbox_execution_agent", _args(objective, output_format, tools_sources, boundaries, context_scope)
        )

    @server.tool(
        name="run_per_user_wiki",
        description="Run the founder-scoped bounded per_user_wiki worker for an approved Task delegation.",
    )
    async def run_per_user_wiki(  # noqa: ANN202
        objective: str,
        output_format: Any = "",
        tools_sources: Any = None,
        boundaries: Any = None,
        context_scope: dict[str, Any] | None = None,
    ) -> str:
        return await _dispatch(
            "per_user_wiki", _args(objective, output_format, tools_sources, boundaries, context_scope)
        )

    # Guard against drift between the exposed tools and the capabilities the core permits.
    exposed = {"structured_data_agent", "sandbox_execution_agent", "per_user_wiki"}
    assert exposed == set(WORKER_CAPABILITY_KEYS), "worker tool set drifted from WORKER_CAPABILITY_KEYS"

    return server


_WORKER_MCP: FastMCP | None = None
_WORKER_ASGI: Any = None


def build_worker_asgi_app() -> Any:
    """Return an ASGI app: a token-lifting wrapper around FastMCP's streamable-HTTP app.

    The wrapper reads `?t=<token>` from the request URL and stores it in the `_TURN_TOKEN` contextvar for
    the duration of the request, then delegates to FastMCP. Mounted on `main.py`'s FastAPI `app` at
    `WORKER_MCP_MOUNT_PATH`.

    Memoized: the parent app must run the *same* server instance's session manager (see
    `worker_session_manager_lifespan`), so building a second one would leave the mounted app dead."""

    global _WORKER_MCP, _WORKER_ASGI
    if _WORKER_ASGI is not None:
        return _WORKER_ASGI

    _WORKER_MCP = build_worker_fastmcp()
    inner = _WORKER_MCP.streamable_http_app()

    async def app(scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") != "http":
            await inner(scope, receive, send)
            return
        token = ""
        raw_qs = scope.get("query_string") or b""
        try:
            parsed = parse_qs(raw_qs.decode("latin-1"))
            token = (parsed.get("t") or [""])[0]
        except Exception:  # noqa: BLE001 - a malformed query must not 500; the core refuses an empty token
            token = ""
        reset = _TURN_TOKEN.set(token)
        try:
            await inner(scope, receive, send)
        finally:
            _TURN_TOKEN.reset(reset)

    _WORKER_ASGI = app
    return app


@asynccontextmanager
async def worker_session_manager_lifespan() -> AsyncIterator[None]:
    """Run FastMCP's StreamableHTTP session manager for the lifetime of the parent app.

    Starlette's `app.mount()` does NOT propagate lifespan to a mounted ASGI sub-app, so FastMCP's
    `StreamableHTTPSessionManager` task group is never started and every request to the mount fails with
    `RuntimeError: Task group is not initialized. Make sure to use run().` (confirmed locally, 04B-D2-M2
    Stage C). The parent app must therefore enter this context itself on startup."""

    if _WORKER_ASGI is None:
        build_worker_asgi_app()
    assert _WORKER_MCP is not None  # set by build_worker_asgi_app
    async with _WORKER_MCP.session_manager.run():
        yield


def worker_server_url(base_url: str, token: str) -> str:
    """Build the per-turn inline server URL an `AgentDefinition.mcpServers` entry points at.

    `base_url` is the loopback origin the CLI subprocess can reach (e.g. `http://127.0.0.1:${PORT}`)."""

    return f"{base_url.rstrip('/')}{WORKER_MCP_MOUNT_PATH}/?t={token}"


# Re-exported so callers do not import the exception from two places.
__all__ = [
    "WORKER_MCP_MOUNT_PATH",
    "build_worker_asgi_app",
    "build_worker_fastmcp",
    "worker_server_url",
    "worker_session_manager_lifespan",
    "WorkerScopeError",
]
