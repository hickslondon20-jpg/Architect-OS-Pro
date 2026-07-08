"""Phase 4 (Sandbox Bridge / Code Mode) tests.

Two layers:
1. Pure unit tests for the stub generator and BridgeFulfiller's authorization
   boundary - no pod, no network.
2. A standalone harness that exercises the real
   KubernetesInteractiveSandboxSession.run_with_bridge poll loop against a
   local temp directory standing in for the pod filesystem, with a small
   background thread standing in for the persistent in-pod runner process.
   This proves the exec-channel protocol end to end without a live GKE
   cluster (no GCP credentials are available in this environment - see
   phases/04-sandbox-bridge/COMPLETION.md for the live-cluster gap).
"""

from __future__ import annotations

import io
import json
import subprocess
import threading
import time
import traceback
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from types import SimpleNamespace

import pytest

from services.sandbox_bridge import BridgeFulfiller, generate_bridge_module_source
from services.sandbox_service import KubernetesInteractiveSandboxSession, SandboxServiceError
from services.tool_registry import (
    RegistryNativeScopeSource,
    ToolDefinition,
    ToolExecutionContext,
    ToolRegistry,
    ToolResultEnvelope,
)


def _resolve_bash_executable() -> str | None:
    # Plain "bash" resolves to the non-functional WSL shim in some Windows
    # Python subprocess PATH-search orders even when Git Bash's real bash is
    # what an interactive shell would find - prefer Git Bash's own path.
    candidates = [
        "C:/Program Files/Git/bin/bash.exe",
        "C:/Program Files/Git/usr/bin/bash.exe",
        "bash",
    ]
    for candidate in candidates:
        try:
            completed = subprocess.run([candidate, "-c", "echo ok"], capture_output=True, text=True, timeout=5)
        except Exception:
            continue
        if completed.returncode == 0 and "ok" in completed.stdout:
            return candidate
    return None


BASH_EXECUTABLE = _resolve_bash_executable()
BASH_AVAILABLE = BASH_EXECUTABLE is not None


def _custom_add_executor(context: ToolExecutionContext, tool_input: dict) -> ToolResultEnvelope:
    total = int(tool_input.get("a", 0)) + int(tool_input.get("b", 0))
    return ToolResultEnvelope(content={"total": total})


def _build_test_registry() -> ToolRegistry:
    registry = ToolRegistry(scope_source=RegistryNativeScopeSource())
    registry.register(
        ToolDefinition(
            name="custom_add",
            description="Add two integers.",
            json_schema={
                "type": "object",
                "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}},
                "required": ["a", "b"],
            },
            source="native",
            executor_kind="native",
            executor=_custom_add_executor,
        )
    )
    return registry


# ---------------------------------------------------------------------------
# Pure unit tests: stub generation
# ---------------------------------------------------------------------------


def test_generate_bridge_module_source_produces_valid_typed_stubs():
    registry = _build_test_registry()
    tools = [registry.get("custom_add"), registry.get("kb_grep"), registry.get("kb_read")]

    source = generate_bridge_module_source(
        tools,
        requests_dir="/sandbox/.bridge/requests",
        responses_dir="/sandbox/.bridge/responses",
    )

    compile(source, "<bridge-module>", "exec")
    assert "def custom_add(a, b):" in source
    assert "def kb_grep(pattern, folder_id=None, limit=None):" in source
    assert "def kb_read(document_id, start_line=None, end_line=None):" in source
    assert "tool_client.call('custom_add', a=a, b=b)" in source
    # Stdlib only.
    assert "import json" in source
    assert "import requests" not in source
    assert "socket" not in source


# ---------------------------------------------------------------------------
# Pure unit tests: BridgeFulfiller authorization boundary
# ---------------------------------------------------------------------------


def test_bridge_fulfiller_resolves_in_catalog_tool():
    registry = _build_test_registry()
    fulfiller = BridgeFulfiller(
        registry=registry,
        context=ToolExecutionContext(user_id="user-1"),
        allowed_tool_names=["custom_add"],
    )

    response = fulfiller.fulfill("req-1", "custom_add", {"a": 2, "b": 3})

    assert response["ok"] is True
    assert response["result"]["content"]["total"] == 5


def test_bridge_fulfiller_rejects_out_of_catalog_tool():
    registry = _build_test_registry()
    fulfiller = BridgeFulfiller(
        registry=registry,
        context=ToolExecutionContext(user_id="user-1"),
        allowed_tool_names=["custom_add"],
    )

    response = fulfiller.fulfill("req-2", "wiki_search", {"query": "revenue"})

    assert response["ok"] is False
    assert "not available" in response["error"]


def test_bridge_fulfiller_denylists_execute_code_even_if_caller_allows_it():
    registry = _build_test_registry()
    fulfiller = BridgeFulfiller(
        registry=registry,
        context=ToolExecutionContext(user_id="user-1"),
        allowed_tool_names=["custom_add", "execute_code"],
    )

    assert "execute_code" not in fulfiller.allowed_tool_names
    response = fulfiller.fulfill("req-3", "execute_code", {"code": "print(1)"})
    assert response["ok"] is False


def test_bridge_fulfiller_returns_structured_error_instead_of_raising():
    registry = _build_test_registry()

    def _boom(context, tool_input):
        raise RuntimeError("boom")

    registry.register(
        ToolDefinition(
            name="broken_tool",
            description="Always fails.",
            json_schema={"type": "object", "properties": {}, "required": []},
            source="native",
            executor_kind="native",
            executor=_boom,
        )
    )
    fulfiller = BridgeFulfiller(
        registry=registry,
        context=ToolExecutionContext(user_id="user-1"),
        allowed_tool_names=["broken_tool"],
    )

    response = fulfiller.fulfill("req-4", "broken_tool", {})

    assert response["ok"] is False
    assert "boom" in response["error"]


# ---------------------------------------------------------------------------
# Standalone harness: real run_with_bridge poll loop, fake pod filesystem
# ---------------------------------------------------------------------------


class _HarnessSandboxSession(KubernetesInteractiveSandboxSession):
    """A KubernetesInteractiveSandboxSession that never touches Kubernetes.

    Deliberately skips InteractiveSandboxSession.__init__ (which would build a
    real K8s backend session) and instead duck-types just what run_with_bridge
    and its helpers touch, executing shell commands against a local temp
    directory via bash - the same commands the real class issues over the K8s
    exec channel, just against a local filesystem instead of a pod's.
    """

    def __init__(self, workdir: Path, timeout: float) -> None:  # noqa: super-init-not-called
        self._workdir_path = workdir
        self.container = "fake-pod"
        self.is_open = True
        self._runner_ready = True
        self.settings = SimpleNamespace(timeout=timeout)
        self.config = SimpleNamespace(workdir=workdir.as_posix(), get_execution_timeout=lambda: timeout)
        self._commands_dir = f"{workdir.as_posix()}/.interactive/commands"
        self._results_dir = f"{workdir.as_posix()}/.interactive/results"
        for sub in ("interactive/commands", "interactive/results", "bridge/requests", "bridge/responses"):
            (workdir / f".{sub}").mkdir(parents=True, exist_ok=True)
        self.interrupted = False

    def _check_session_timeout(self) -> None:
        return None

    def _interrupt_runner(self) -> None:
        self.interrupted = True

    def execute_command(self, command, workdir=None, on_stdout=None, on_stderr=None):  # noqa: ARG002
        completed = subprocess.run(
            [BASH_EXECUTABLE, "-c", command],
            cwd=str(self._workdir_path),
            capture_output=True,
            text=True,
            timeout=10,
        )
        return SimpleNamespace(stdout=completed.stdout, stderr=completed.stderr, exit_code=completed.returncode)


def _run_fake_pod_runner_once(workdir: Path) -> None:
    """Stand-in for the persistent in-pod IPython runner: executes any
    submitted cell and writes the result file, mirroring
    llm_sandbox.interactive._INTERACTIVE_RUNNER_SCRIPT's own loop body."""
    commands_dir = workdir / ".interactive" / "commands"
    results_dir = workdir / ".interactive" / "results"
    for command_file in sorted(commands_dir.glob("command-*.json")):
        try:
            payload = json.loads(command_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        code = payload.get("code", "")
        request_id = payload.get("id")
        stdout_buffer, stderr_buffer = io.StringIO(), io.StringIO()
        success = True
        try:
            with redirect_stdout(stdout_buffer), redirect_stderr(stderr_buffer):
                exec(compile(code, "<bridge-cell>", "exec"), {"__name__": "__main__"})  # noqa: S102
        except Exception:
            success = False
            traceback.print_exc(file=stderr_buffer)
        result_payload = {
            "id": request_id,
            "success": success,
            "stdout": stdout_buffer.getvalue(),
            "stderr": stderr_buffer.getvalue(),
        }
        result_path = results_dir / f"result-{request_id}.json"
        tmp_path = result_path.with_suffix(".tmp")
        tmp_path.write_text(json.dumps(result_payload), encoding="utf-8")
        tmp_path.replace(result_path)
        command_file.unlink(missing_ok=True)


class _FakePodRunnerThread(threading.Thread):
    def __init__(self, workdir: Path):
        super().__init__(daemon=True)
        self._workdir = workdir
        self._stop = threading.Event()

    def run(self) -> None:
        while not self._stop.is_set():
            _run_fake_pod_runner_once(self._workdir)
            time.sleep(0.02)

    def stop(self) -> None:
        self._stop.set()
        self.join(timeout=2)


@pytest.fixture
def harness_session(tmp_path):
    if not BASH_AVAILABLE:
        pytest.skip("bash is not available on PATH in this environment")
    session = _HarnessSandboxSession(tmp_path, timeout=5.0)
    runner = _FakePodRunnerThread(tmp_path)
    runner.start()
    try:
        yield session
    finally:
        runner.stop()


def test_run_with_bridge_in_catalog_tool_resolves(harness_session):
    registry = _build_test_registry()
    fulfiller = BridgeFulfiller(
        registry=registry,
        context=ToolExecutionContext(user_id="user-1"),
        allowed_tool_names=["custom_add"],
    )

    output = harness_session.run_with_bridge(
        "result = custom_add(a=4, b=5)\nprint(result['content']['total'])",
        fulfiller=fulfiller,
        timeout=5,
        poll_interval=0.05,
    )

    assert output.exit_code == 0
    assert output.stdout.strip() == "9"
    assert len(output.tool_calls) == 1
    assert output.tool_calls[0].tool_name == "custom_add"
    assert output.tool_calls[0].ok is True


def test_run_with_bridge_rejects_out_of_catalog_tool_call(harness_session):
    registry = _build_test_registry()
    fulfiller = BridgeFulfiller(
        registry=registry,
        context=ToolExecutionContext(user_id="user-1"),
        allowed_tool_names=["custom_add"],
    )

    output = harness_session.run_with_bridge(
        "tool_client.call('wiki_search', query='revenue')",
        fulfiller=fulfiller,
        timeout=5,
        poll_interval=0.05,
    )

    assert output.exit_code == 1
    assert "not available in this sandbox session" in output.stderr


def test_run_with_bridge_rejects_execute_code_from_inside_code(harness_session):
    registry = _build_test_registry()
    # Deliberately pass execute_code in the allowed set - the fulfiller's
    # denylist must still block it (defense in depth, BRIDGE constraint).
    fulfiller = BridgeFulfiller(
        registry=registry,
        context=ToolExecutionContext(user_id="user-1"),
        allowed_tool_names=["custom_add", "execute_code"],
    )

    output = harness_session.run_with_bridge(
        "tool_client.call('execute_code', code='1')",
        fulfiller=fulfiller,
        timeout=5,
        poll_interval=0.05,
    )

    assert output.exit_code == 1
    assert "not available in this sandbox session" in output.stderr


def test_run_with_bridge_no_tool_cell_behaves_like_plain_run(harness_session):
    registry = _build_test_registry()
    fulfiller = BridgeFulfiller(
        registry=registry,
        context=ToolExecutionContext(user_id="user-1"),
        allowed_tool_names=[],
    )

    output = harness_session.run_with_bridge(
        "print('hello')",
        fulfiller=fulfiller,
        timeout=5,
        poll_interval=0.05,
    )

    assert output.exit_code == 0
    assert output.stdout.strip() == "hello"
    assert output.tool_calls == []


def test_run_with_bridge_enforces_max_tool_calls(harness_session):
    # A budget of 0 means even the first request exceeds it, so this resolves
    # as soon as the host sees that one request file - no dependency on a
    # second call completing within a wall-clock deadline (avoids flakiness
    # under variable subprocess/bash round-trip latency in CI-like conditions).
    registry = _build_test_registry()
    fulfiller = BridgeFulfiller(
        registry=registry,
        context=ToolExecutionContext(user_id="user-1"),
        allowed_tool_names=["custom_add"],
    )

    with pytest.raises(SandboxServiceError, match="maximum of 0 tool calls"):
        harness_session.run_with_bridge(
            "custom_add(a=1, b=1)\n",
            fulfiller=fulfiller,
            timeout=15,
            poll_interval=0.05,
            max_tool_calls=0,
        )
    assert harness_session.interrupted is True
