"""Exec-channel bridge: lets sandboxed code call registry tools host-side.

Sandboxed code never sees credentials or the network. It writes a small JSON
request file into the pod and blocks; the host (already driving the pod over
the authenticated Kubernetes exec channel, see SandboxService) resolves the
request against the tool registry with real credentials via a
BridgeFulfiller, and writes the result back into the pod. This mirrors
Anthropic's native "pause-and-return" programmatic tool calling without any
pod networking. See phases/04-sandbox-bridge/CONTEXT.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from services.tool_registry import ToolDefinition, ToolExecutionContext, ToolRegistry

DEFAULT_BRIDGE_POLL_INTERVAL_SECONDS = 0.5
DEFAULT_BRIDGE_MAX_TOOL_CALLS = 20

# execute_code must never be reachable from inside its own sandboxed code
# (unbounded recursion). Enforced regardless of what the caller passes in as
# the scoped catalog - defense in depth beyond the caller's own filtering.
_BRIDGE_DENYLIST = frozenset({"execute_code"})


@dataclass(frozen=True)
class BridgeToolCall:
    """One host-fulfilled tool call made by sandboxed code during a run."""

    tool_name: str
    ok: bool
    arguments: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


@dataclass(frozen=True)
class BridgeRunOutput:
    stdout: str
    stderr: str
    exit_code: int
    tool_calls: list[BridgeToolCall] = field(default_factory=list)


class BridgeFulfiller:
    """Host-side dispatcher for exec-channel bridge tool requests.

    Only tools named in `allowed_tool_names` (minus the hard denylist) may be
    dispatched; everything else is rejected with a structured error rather
    than raising into the pod. This is the authorization boundary (BRIDGE-02)
    - it is enforced here, not trusted from the pod side.
    """

    def __init__(
        self,
        *,
        registry: ToolRegistry,
        context: ToolExecutionContext,
        allowed_tool_names: list[str],
    ) -> None:
        self._registry = registry
        self._context = context
        self._allowed = [
            name for name in dict.fromkeys(allowed_tool_names) if name not in _BRIDGE_DENYLIST
        ]

    @property
    def tool_definitions(self) -> list[ToolDefinition]:
        return [self._registry.get(name) for name in self._allowed]

    @property
    def allowed_tool_names(self) -> list[str]:
        return list(self._allowed)

    def fulfill(self, request_id: str, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if tool_name not in self._allowed:
            return {
                "id": request_id,
                "ok": False,
                "error": f"Tool {tool_name!r} is not available in this sandbox session.",
            }
        try:
            envelope = self._registry.execute(tool_name, self._context, dict(arguments))
        except Exception as exc:  # noqa: BLE001 - never raise into the pod
            return {"id": request_id, "ok": False, "error": str(exc)}
        return {"id": request_id, "ok": True, "result": envelope.to_dict()}


# Stdlib-only in-pod client. No network, no credentials - file I/O against the
# bridge directories only. Injected verbatim ahead of every bridge execution;
# `tool_client` and the typed stubs below are appended per-session.
_BRIDGE_CLIENT_BODY = '''
import json as _bridge_json
import os as _bridge_os
import time as _bridge_time
import uuid as _bridge_uuid


class _BridgeToolError(RuntimeError):
    pass


class _BridgeToolClient:
    def __init__(self, requests_dir, responses_dir, poll_interval, call_timeout):
        self._requests_dir = requests_dir
        self._responses_dir = responses_dir
        self._poll_interval = poll_interval
        self._call_timeout = call_timeout

    def call(self, tool_name, **kwargs):
        request_id = _bridge_uuid.uuid4().hex
        request_path = _bridge_os.path.join(self._requests_dir, request_id + ".json")
        response_path = _bridge_os.path.join(self._responses_dir, request_id + ".json")
        payload = {"id": request_id, "tool_name": tool_name, "arguments": kwargs}

        tmp_request_path = request_path + ".tmp"
        with open(tmp_request_path, "w", encoding="utf-8") as handle:
            _bridge_json.dump(payload, handle)
        _bridge_os.replace(tmp_request_path, request_path)

        deadline = _bridge_time.monotonic() + self._call_timeout if self._call_timeout else None
        while not _bridge_os.path.exists(response_path):
            if deadline is not None and _bridge_time.monotonic() >= deadline:
                raise _BridgeToolError("Tool call '" + tool_name + "' timed out waiting for a response.")
            _bridge_time.sleep(self._poll_interval)

        with open(response_path, "r", encoding="utf-8") as handle:
            response = _bridge_json.load(handle)
        if not response.get("ok"):
            raise _BridgeToolError(response.get("error") or ("Tool call '" + tool_name + "' failed."))
        return response.get("result")
'''.strip("\n")


def generate_bridge_module_source(
    tools: list[ToolDefinition],
    *,
    requests_dir: str,
    responses_dir: str,
    poll_interval: float = 0.2,
    call_timeout: float = 60.0,
) -> str:
    """Build the Python source injected ahead of user code for one execution.

    Defines `tool_client` plus one typed stub function per tool in the scoped
    catalog, generated from the registry's neutral JSON schema. Stdlib only -
    no network, no credentials in the generated source.
    """
    instantiation = (
        f"tool_client = _BridgeToolClient({requests_dir!r}, {responses_dir!r}, "
        f"{poll_interval!r}, {call_timeout!r})"
    )
    parts = [_BRIDGE_CLIENT_BODY, instantiation]
    stubs = "\n\n".join(_stub_function_source(tool) for tool in tools)
    if stubs:
        parts.append(stubs)
    return "\n\n".join(parts) + "\n"


def _stub_function_source(tool: ToolDefinition) -> str:
    schema = tool.json_schema or {}
    properties = schema.get("properties") or {}
    required_names = [
        name for name in (schema.get("required") or []) if name in properties and str(name).isidentifier()
    ]
    optional_names = [
        name for name in properties if name not in required_names and str(name).isidentifier()
    ]
    params = [*required_names, *[f"{name}=None" for name in optional_names]]
    call_kwargs = [f"{name}={name}" for name in [*required_names, *optional_names]]
    call_args = ", ".join([repr(tool.name), *call_kwargs]) if call_kwargs else repr(tool.name)
    return "\n".join(
        [
            f"def {tool.name}({', '.join(params)}):",
            f"    {tool.description!r}",
            f"    return tool_client.call({call_args})",
        ]
    )
