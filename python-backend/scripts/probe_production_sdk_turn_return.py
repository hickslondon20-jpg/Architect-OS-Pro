"""Local-only production-loop probe for native subagent result return.

This deliberately calls ``services.vcso_sdk_loop._run_sdk_turn`` through either
the production thread/queue bridge or a plain asyncio driver. Founder storage is
replaced with an in-memory evidence store and every granted registry tool is a
deterministic stub, so no feature flag, deployed service, or founder row is
touched.

The matrix varies one factor at a time:

* registry tool latency (sub-second versus multi-second);
* production threaded bridge versus plain asyncio;
* no-op SubagentStart persistence versus a delayed loopback HTTP write;
* small versus production-sized prompt/context.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import queue
import sys
import threading
import time
import urllib.request
import uuid
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Iterator

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parents[1]))

from core.config import get_settings
from services.tool_registry import (
    ToolDefinition,
    ToolExecutionContext,
    ToolResultEnvelope,
    ToolSourceRef,
)
from services.vcso_sdk_config import NATIVE_GRANULAR_AGENT_TOOL_GRANTS
from services.vcso_sdk_loop import _run_sdk_turn, sdk_runtime_versions, stream_vcso_sdk_turn


load_dotenv(Path(__file__).parents[1] / ".env")

PROBE_USER_ID = "00000000-0000-0000-0000-00000000004b"
REQUIRED_AGENTS = ("structured_data_agent", "per_user_wiki")
BASE_QUESTION = (
    "Our client concentration is rising and our margin is compressing. "
    "What should I do in the next 90 days?"
)
TOOL_SCHEMAS: dict[str, dict[str, Any]] = {
    name: {
        "type": "object",
        "properties": {
            "request": {
                "type": "string",
                "description": "A compact request for the deterministic probe finding.",
            }
        },
        "additionalProperties": True,
    }
    for grants in NATIVE_GRANULAR_AGENT_TOOL_GRANTS.values()
    for name in grants
}
TOOL_SCHEMAS["execute_code"] = {
    "type": "object",
    "properties": {"code": {"type": "string"}},
    "required": ["code"],
    "additionalProperties": True,
}


@dataclass(frozen=True)
class ProbeArm:
    label: str
    driver: str
    tool_latency_seconds: float
    hook_network_delay_seconds: float
    prompt_scale: str


DEFAULT_ARMS = (
    ProbeArm("baseline_fast_threaded", "threaded", 0.2, 0.0, "small"),
    ProbeArm("tool_latency_slow_threaded", "threaded", 2.0, 0.0, "small"),
    ProbeArm("bridge_plain_asyncio", "plain", 2.0, 0.0, "small"),
    ProbeArm("hook_loopback_network_write", "threaded", 2.0, 0.75, "small"),
    ProbeArm("prompt_production_scale", "threaded", 2.0, 0.0, "production"),
)


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _production_sized_context(target_chars: int = 308_000) -> str:
    """Build inert founder-like context at roughly 77k tokens without real data."""

    line = (
        "PROBE CONTEXT RECORD: synthetic operating history, source [probe], "
        "founder-isolated, read-only, and intentionally irrelevant to the answer. "
    )
    count = max(1, target_chars // len(line))
    return (line * count)[:target_chars]


class _ProbeQuery:
    def __init__(self, client: "_ProbeClient", table_name: str) -> None:
        self.client = client
        self.table_name = table_name
        self.operation = "select"
        self.payload: Any = None
        self.filters: list[tuple[str, Any]] = []
        self.limit_count: int | None = None

    def select(self, _columns: str = "*") -> "_ProbeQuery":
        self.operation = "select"
        return self

    def insert(self, payload: Any) -> "_ProbeQuery":
        self.operation = "insert"
        self.payload = payload
        return self

    def update(self, payload: Any) -> "_ProbeQuery":
        self.operation = "update"
        self.payload = payload
        return self

    def eq(self, column: str, value: Any) -> "_ProbeQuery":
        self.filters.append((column, value))
        return self

    def in_(self, column: str, values: list[Any]) -> "_ProbeQuery":
        self.filters.append((f"{column}__in", list(values)))
        return self

    def order(self, _column: str, **_kwargs: Any) -> "_ProbeQuery":
        return self

    def limit(self, count: int) -> "_ProbeQuery":
        self.limit_count = count
        return self

    def single(self) -> "_ProbeQuery":
        self.limit_count = 1
        return self

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self.client.execute_query(self))


class _ProbeClient:
    def __init__(
        self,
        *,
        network_write_url: str | None,
        record: Any,
    ) -> None:
        self.network_write_url = network_write_url
        self.record = record
        self.rows: dict[str, list[dict[str, Any]]] = {
            "agent_capabilities": [_capability_row(key) for key in REQUIRED_AGENTS],
            "agent_delegation_runs": [],
            "agent_run_steps": [],
            "agent_run_sources": [],
        }

    def table(self, name: str) -> _ProbeQuery:
        return _ProbeQuery(self, name)

    def execute_query(self, query: _ProbeQuery) -> list[dict[str, Any]]:
        if query.table_name in {"tool_registry", "mcp_connections"}:
            raise RuntimeError(f"{query.table_name} overlay intentionally absent in the local probe")
        rows = self.rows.setdefault(query.table_name, [])
        if query.operation == "insert":
            payloads = query.payload if isinstance(query.payload, list) else [query.payload]
            inserted: list[dict[str, Any]] = []
            for raw in payloads:
                row = dict(raw or {})
                if query.table_name == "agent_delegation_runs":
                    if self.network_write_url:
                        started = time.perf_counter()
                        request = urllib.request.Request(
                            self.network_write_url,
                            data=json.dumps({"table": query.table_name, "operation": "insert"}).encode(),
                            headers={"Content-Type": "application/json"},
                            method="POST",
                        )
                        with urllib.request.urlopen(request, timeout=10) as response:
                            response.read()
                        self.record(
                            "hook_network_write_return",
                            elapsed_ms=round((time.perf_counter() - started) * 1000, 1),
                        )
                    row.setdefault("id", str(uuid.uuid4()))
                rows.append(row)
                inserted.append(dict(row))
            return inserted
        if query.operation == "update":
            matched = self._filtered(rows, query.filters)
            for row in matched:
                row.update(dict(query.payload or {}))
            return [dict(row) for row in matched]
        selected = self._filtered(rows, query.filters)
        if query.limit_count is not None:
            selected = selected[: query.limit_count]
        return [dict(row) for row in selected]

    @staticmethod
    def _filtered(
        rows: list[dict[str, Any]], filters: list[tuple[str, Any]]
    ) -> list[dict[str, Any]]:
        selected = list(rows)
        for column, value in filters:
            if column.endswith("__in"):
                key = column.removesuffix("__in")
                selected = [row for row in selected if row.get(key) in value]
            else:
                selected = [row for row in selected if str(row.get(column)) == str(value)]
        return selected


class _ProbeStore:
    def __init__(self, client: _ProbeClient, model: str) -> None:
        self.client = client
        self.model = model

    def resolve_platform_model(self, **_kwargs: Any) -> dict[str, str]:
        return {"provider": "anthropic", "model_name": self.model}


class _ProbeRegistry:
    def __init__(self, *, latency_seconds: float, record: Any) -> None:
        self.latency_seconds = latency_seconds
        self.record = record
        self._definitions = {
            name: self._definition(name) for name in sorted(TOOL_SCHEMAS)
        }

    def _definition(self, name: str) -> ToolDefinition:
        is_compute = name == "execute_code"

        def execute(
            _context: ToolExecutionContext, tool_input: dict[str, Any]
        ) -> ToolResultEnvelope:
            started = time.perf_counter()
            self.record("stub_tool_start", tool_name=name)
            time.sleep(self.latency_seconds)
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            source_kind = "computation" if is_compute else "probe_source"
            source_id = f"probe-{name}"
            self.record("stub_tool_return", tool_name=name, elapsed_ms=elapsed_ms)
            return ToolResultEnvelope(
                content={
                    "status": "completed",
                    "summary": f"{name} returned deterministic probe evidence.",
                    "value": 42 if is_compute else f"{name}-sentinel",
                    "input_keys": sorted(tool_input),
                },
                sources=[
                    ToolSourceRef(
                        source_kind=source_kind,
                        source_id=source_id,
                        label=f"Deterministic {name} probe",
                        metadata={"probe": True},
                    )
                ],
                provenance={"probe": True, "tool": name},
            )

        return ToolDefinition(
            name=name,
            description=(
                f"Deterministic read-only probe tool {name}. Call once and use its cited sentinel."
            ),
            json_schema=TOOL_SCHEMAS[name],
            source="native",
            executor_kind="native",
            persistence_semantics="read_only",
            executor=execute,
            citation={"source_kind": "computation" if is_compute else "probe_source"},
            surface_tags=["virtual_cso"],
        )

    def definitions(self) -> list[ToolDefinition]:
        return list(self._definitions.values())

    def tool_names(self) -> list[str]:
        return list(self._definitions)

    def get(self, name: str) -> ToolDefinition:
        return self._definitions[name]

    def execute(
        self,
        name: str,
        context: ToolExecutionContext,
        tool_input: dict[str, Any],
    ) -> ToolResultEnvelope:
        definition = self.get(name)
        assert definition.executor is not None
        return definition.executor(context, tool_input)


def _capability_row(key: str) -> dict[str, Any]:
    grants = list(NATIVE_GRANULAR_AGENT_TOOL_GRANTS[key])
    return {
        "id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"architectos-probe:{key}")),
        "capability_key": key,
        "label": key.replace("_", " ").title(),
        "description": (
            f"Bounded local probe worker. Call each useful granted probe tool and return compact cited evidence."
        ),
        "status": "experimental",
        "allowed_surfaces": ["virtual_cso"],
        "allowed_tools": grants,
        "allowed_source_kinds": ["probe_source"],
        "model_setting_key": key,
        "routing_tier": "worker",
        "output_schema": {"version": "agent_result_v1"},
        "default_config": {"max_rounds": 4},
        "can_spawn_agents": False,
    }


class _WriteHandler(BaseHTTPRequestHandler):
    delay_seconds = 0.0

    def do_POST(self) -> None:  # noqa: N802 - stdlib handler API
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            self.rfile.read(length)
        time.sleep(self.delay_seconds)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def log_message(self, _format: str, *_args: Any) -> None:
        return


@contextmanager
def _loopback_write_server(delay_seconds: float) -> Iterator[str | None]:
    if delay_seconds <= 0:
        yield None
        return
    handler = type("DelayedWriteHandler", (_WriteHandler,), {"delay_seconds": delay_seconds})
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = server.server_address
        yield f"http://{host}:{port}/probe-write"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _call_kwargs(
    *,
    arm: ProbeArm,
    api_key: str,
    model: str,
    store: _ProbeStore,
    registry: _ProbeRegistry,
    lifecycle_sink: Any,
    stream_sink: Any,
    events: queue.Queue[Any] | None = None,
) -> dict[str, Any]:
    large_context = (
        "\n\nSYNTHETIC PRODUCTION-SCALE CONTEXT\n" + _production_sized_context()
        if arm.prompt_scale == "production"
        else ""
    )
    return {
        "prompt": BASE_QUESTION,
        "system_prompt": (
            "You are the local ArchitectOS VCSO production-loop return probe. "
            "Follow the native granular-worker contract exactly. Use the deterministic "
            "probe tools, cite their returned source markers, and finish compactly."
            + large_context
        ),
        "model": model,
        "api_key": api_key,
        "registry": registry,
        "tool_names": list(registry.tool_names()),
        "tool_context": ToolExecutionContext(
            user_id=PROBE_USER_ID,
            store=store,
            thread_id="local-probe-thread",
            metadata={
                "surface": "virtual_cso",
                "parent_message_id": str(uuid.uuid4()),
                "parent_run_id": str(uuid.uuid4()),
            },
        ),
        "trace_metadata": {
            "run_id": str(uuid.uuid4()),
            "user_id": PROBE_USER_ID,
            "thread_id": "local-probe-thread",
            "sdk_phase": "04B-D-local-probe",
        },
        "initial_sources": [],
        "step_index_offset": 0,
        "max_turns": 6,
        "max_budget_usd": 0.25,
        "tool_timeout_seconds": 60.0,
        "heartbeat_seconds": 1.0,
        "usage_sink": None,
        "native_subagent_required_agents": REQUIRED_AGENTS,
        "native_subagent_scopes": {
            "structured_data_agent": {"probe": True},
            "per_user_wiki": {"probe": True},
        },
        "native_lifecycle_sink": lifecycle_sink,
        "native_stream_diagnostic_sink": stream_sink,
        "native_model_driven": True,
        "founder_question": BASE_QUESTION,
        **({"events": events} if events is not None else {}),
    }


def _summarize(
    *,
    arm: ProbeArm,
    started: float,
    observations: list[dict[str, Any]],
    lifecycle: list[dict[str, Any]],
    stream: list[dict[str, Any]],
    sse_events: list[dict[str, Any]],
    result: Any,
    error: BaseException | None,
) -> dict[str, Any]:
    starts = [event for event in lifecycle if event.get("event") == "subagent_start"]
    stops = [event for event in lifecycle if event.get("event") == "subagent_stop"]
    agent_results = [event for event in stream if event.get("event") == "agent_tool_result"]
    termination = next(
        (event for event in reversed(stream) if event.get("event") == "sdk_iteration_terminated"),
        None,
    )
    start_elapsed = {
        event.get("capability_key"): event.get("probe_elapsed_ms") for event in starts
    }
    stop_relative: dict[str, float | None] = {}
    for event in stops:
        capability = str(event.get("capability_key") or "")
        start_ms = start_elapsed.get(capability)
        stop_ms = event.get("probe_elapsed_ms")
        stop_relative[capability] = (
            round(float(stop_ms) - float(start_ms), 1)
            if start_ms is not None and stop_ms is not None
            else None
        )
    return {
        "arm": asdict(arm),
        "status": "completed" if error is None else "exception",
        "wall_clock_ms": round((time.perf_counter() - started) * 1000, 1),
        "subagent_start_count": len(starts),
        "subagent_stop_count": len(stops),
        "subagent_starts": starts,
        "subagent_stops": stops,
        "subagent_stop_after_start_ms": stop_relative,
        "agent_result_count": len(agent_results),
        "agent_results": agent_results,
        "iteration_termination": termination,
        "result_returned": result is not None,
        "answer_chars": len(str(getattr(result, "answer_text", "") or "")),
        "session_id_present": bool(getattr(result, "session_id", None)),
        "sse_event_counts": {
            name: sum(1 for event in sse_events if event.get("event") == name)
            for name in sorted({str(event.get("event")) for event in sse_events})
        },
        "lifecycle_events": lifecycle,
        "stream_diagnostic_events": stream,
        "stub_tools": [event for event in observations if event["event"].startswith("stub_tool_")],
        "hook_network_writes": [
            event for event in observations if event["event"] == "hook_network_write_return"
        ],
        "exception": (
            {"type": type(error).__name__, "message": str(error)[:500]} if error else None
        ),
    }


def run_arm(arm: ProbeArm, *, api_key: str, model: str) -> dict[str, Any]:
    started = time.perf_counter()
    observations: list[dict[str, Any]] = []
    lifecycle: list[dict[str, Any]] = []
    stream: list[dict[str, Any]] = []
    sse_events: list[dict[str, Any]] = []

    def record(event: str, **details: Any) -> None:
        observations.append(
            {
                "event": event,
                "probe_elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
                **details,
            }
        )

    def lifecycle_sink(event: dict[str, Any]) -> None:
        lifecycle.append(
            {
                **event,
                "probe_elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
            }
        )

    def stream_sink(event: dict[str, Any]) -> None:
        stream.append(
            {
                **event,
                "probe_elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
            }
        )

    result = None
    error: BaseException | None = None
    with _loopback_write_server(arm.hook_network_delay_seconds) as write_url:
        client = _ProbeClient(network_write_url=write_url, record=record)
        store = _ProbeStore(client, model)
        registry = _ProbeRegistry(latency_seconds=arm.tool_latency_seconds, record=record)
        try:
            if arm.driver == "threaded":
                generator = stream_vcso_sdk_turn(
                    **_call_kwargs(
                        arm=arm,
                        api_key=api_key,
                        model=model,
                        store=store,
                        registry=registry,
                        lifecycle_sink=lifecycle_sink,
                        stream_sink=stream_sink,
                    )
                )
                while True:
                    try:
                        sse_events.append(next(generator))
                    except StopIteration as stop:
                        result = stop.value
                        break
            elif arm.driver == "plain":
                event_queue: queue.Queue[Any] = queue.Queue()
                result = asyncio.run(
                    _run_sdk_turn(
                        **_call_kwargs(
                            arm=arm,
                            api_key=api_key,
                            model=model,
                            store=store,
                            registry=registry,
                            lifecycle_sink=lifecycle_sink,
                            stream_sink=stream_sink,
                            events=event_queue,
                        ),
                        query_impl=__import__("claude_agent_sdk").query,
                    )
                )
                while not event_queue.empty():
                    item = event_queue.get_nowait()
                    if isinstance(item, dict):
                        sse_events.append(item)
            else:
                raise ValueError(f"Unknown driver: {arm.driver}")
        except BaseException as exc:  # noqa: BLE001 - the probe must report the production exception
            error = exc
    return _summarize(
        arm=arm,
        started=started,
        observations=observations,
        lifecycle=lifecycle,
        stream=stream,
        sse_events=sse_events,
        result=result,
        error=error,
    )


def _selected_arms(labels: list[str]) -> list[ProbeArm]:
    by_label = {arm.label: arm for arm in DEFAULT_ARMS}
    if not labels:
        return list(DEFAULT_ARMS)
    unknown = [label for label in labels if label not in by_label]
    if unknown:
        raise ValueError("Unknown arm(s): " + ", ".join(unknown))
    return [by_label[label] for label in labels]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--arm",
        action="append",
        default=[],
        help="Run one named arm; repeat to select several. Default: full matrix.",
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument("--model")
    args = parser.parse_args()

    settings = get_settings()
    api_key = settings.anthropic_api_key_value
    if not api_key:
        raise SystemExit("ANTHROPIC_API_KEY is required")
    model = args.model or settings.claude_synthesis_model
    report: dict[str, Any] = {
        "probe": "production_sdk_turn_return",
        "started_at": _utc_now(),
        "runtime": sdk_runtime_versions(),
        "model": model,
        "pid": os.getpid(),
        "arms": [],
    }
    for arm in _selected_arms(args.arm):
        print(f"running {arm.label}", flush=True)
        result = run_arm(arm, api_key=api_key, model=model)
        report["arms"].append(result)
        print(
            json.dumps(
                {
                    "arm": arm.label,
                    "status": result["status"],
                    "stops": result["subagent_stop_count"],
                    "agent_results": result["agent_result_count"],
                    "termination": result["iteration_termination"],
                    "wall_clock_ms": result["wall_clock_ms"],
                },
                ensure_ascii=True,
            ),
            flush=True,
        )
        if result["status"] != "completed":
            break
    report["finished_at"] = _utc_now()
    rendered = json.dumps(report, indent=2, ensure_ascii=True)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
