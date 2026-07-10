"""GKE-backed interactive sandbox execution for Phase 5 verification."""

from __future__ import annotations

from contextlib import suppress
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from functools import lru_cache
import base64
import json
from pathlib import Path
import shlex
import tempfile
import threading
import time
from typing import Any
import uuid

from google.auth.transport.requests import Request
from google.cloud import container_v1
from google.oauth2 import service_account
from kubernetes import client as k8s_client
from kubernetes.client.exceptions import ApiException
from llm_sandbox import InteractiveSandboxSession, SandboxBackend
from llm_sandbox.exceptions import ContainerError, NotOpenSessionError, SandboxTimeoutError
from llm_sandbox.interactive import _INTERACTIVE_RUNNER_SCRIPT
from supabase import Client, create_client

from core.config import Settings, get_settings
from services.sandbox_bridge import (
    DEFAULT_BRIDGE_MAX_TOOL_CALLS,
    DEFAULT_BRIDGE_POLL_INTERVAL_SECONDS,
    BridgeFulfiller,
    BridgeRunOutput,
    BridgeToolCall,
    generate_bridge_module_source,
)


class SandboxServiceError(RuntimeError):
    pass


@dataclass(frozen=True)
class SandboxExecutionResult:
    thread_id: str
    pod_name: str
    stdout: str
    stderr: str
    exit_code: int
    status: str


@dataclass(frozen=True)
class SandboxBridgeExecutionResult:
    thread_id: str
    pod_name: str
    stdout: str
    stderr: str
    exit_code: int
    status: str
    tool_calls: list[BridgeToolCall] = field(default_factory=list)


class KubernetesInteractiveSandboxSession(InteractiveSandboxSession):
    def _ensure_runtime_dependencies(self) -> None:
        self.execute_commands([
            (f"mkdir -p {self._commands_dir}", None),
            (f"mkdir -p {self._results_dir}", None),
            (f"mkdir -p {self._bridge_requests_dir}", None),
            (f"mkdir -p {self._bridge_responses_dir}", None),
        ])

    @property
    def _bridge_dir(self) -> str:
        return f"{self.config.workdir.rstrip('/')}/.bridge"

    @property
    def _bridge_requests_dir(self) -> str:
        return f"{self._bridge_dir}/requests"

    @property
    def _bridge_responses_dir(self) -> str:
        return f"{self._bridge_dir}/responses"

    def _upload_runner_script(self) -> None:
        payload = base64.b64encode(_INTERACTIVE_RUNNER_SCRIPT.encode("utf-8")).decode("ascii")
        command = (
            "import base64, pathlib; "
            f"path = pathlib.Path({self._runner_script_path!r}); "
            "path.parent.mkdir(parents=True, exist_ok=True); "
            f"path.write_text(base64.b64decode({payload!r}).decode('utf-8'), encoding='utf-8')"
        )
        result = self.execute_command(f"python -c {shlex.quote(command)}")
        if result.exit_code:
            raise SandboxServiceError(f"Failed to upload interactive runner: {result.stderr or result.stdout}")

    def _write_remote_command(self, remote_path: str, request_id: str, code: str) -> None:
        payload = base64.b64encode(json.dumps({"id": request_id, "code": code}).encode("utf-8")).decode("ascii")
        command = (
            "import base64, pathlib; "
            f"path = pathlib.Path({remote_path!r}); "
            "path.parent.mkdir(parents=True, exist_ok=True); "
            f"path.write_text(base64.b64decode({payload!r}).decode('utf-8'), encoding='utf-8')"
        )
        result = self.execute_command(f"python -c {shlex.quote(command)}")
        if result.exit_code:
            raise SandboxServiceError(f"Failed to write interactive command: {result.stderr or result.stdout}")

    def _read_remote_result(self, remote_path: str) -> dict[str, Any]:
        result = self.execute_command(f"cat {shlex.quote(remote_path)}")
        if result.exit_code:
            raise SandboxServiceError(f"Failed to read interactive result: {result.stderr or result.stdout}")
        return json.loads(result.stdout)

    def _write_remote_json(self, remote_path: str, payload: dict[str, Any]) -> None:
        encoded = base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")
        command = (
            "import base64, pathlib; "
            f"path = pathlib.Path({remote_path!r}); "
            "path.parent.mkdir(parents=True, exist_ok=True); "
            "tmp_path = path.with_suffix('.tmp'); "
            f"tmp_path.write_text(base64.b64decode({encoded!r}).decode('utf-8'), encoding='utf-8'); "
            "tmp_path.replace(path)"
        )
        result = self.execute_command(f"python -c {shlex.quote(command)}")
        if result.exit_code:
            raise SandboxServiceError(f"Failed to write bridge response: {result.stderr or result.stdout}")

    def run_with_bridge(
        self,
        code: str,
        *,
        fulfiller: BridgeFulfiller,
        timeout: float | None = None,
        poll_interval: float = DEFAULT_BRIDGE_POLL_INTERVAL_SECONDS,
        max_tool_calls: int = DEFAULT_BRIDGE_MAX_TOOL_CALLS,
    ) -> BridgeRunOutput:
        """Run one cell with in-code tool calls resolved host-side (Code Mode).

        Reuses the same command/result file protocol as `run()` to detect
        completion, and interleaves polling the bridge request directory so a
        single execution can make several tool calls without a per-tool
        inference round trip. Plain cells that call no tools pay only the
        cost of one extra (near-instant) directory listing per poll tick.
        """
        if not self.container or not self.is_open:
            raise NotOpenSessionError
        if not self._runner_ready:
            msg = "Interactive runtime is not ready"
            raise ContainerError(msg)

        self._check_session_timeout()
        actual_timeout = timeout or self.settings.timeout or self.config.get_execution_timeout()

        stub_source = generate_bridge_module_source(
            fulfiller.tool_definitions,
            requests_dir=self._bridge_requests_dir,
            responses_dir=self._bridge_responses_dir,
            poll_interval=min(poll_interval, 1.0),
            call_timeout=actual_timeout or 60.0,
        )
        full_code = f"{stub_source}\n\n{code}"

        request_id = uuid.uuid4().hex
        command_path = f"{self._commands_dir}/command-{request_id}.json"
        result_path = f"{self._results_dir}/result-{request_id}.json"
        self._write_remote_command(command_path, request_id, full_code)

        deadline = time.monotonic() + actual_timeout if actual_timeout else None
        fulfilled_ids: set[str] = set()
        tool_calls: list[BridgeToolCall] = []

        while True:
            status = self.execute_command(f"test -f {result_path}")
            if status.exit_code == 0:
                break

            self._poll_bridge_requests(fulfiller, fulfilled_ids, tool_calls, max_tool_calls)

            if deadline and time.monotonic() >= deadline:
                self._interrupt_runner()
                msg = f"Interactive execution timed out after {actual_timeout} seconds"
                raise SandboxTimeoutError(msg, timeout_duration=actual_timeout)

            time.sleep(poll_interval)

        payload = self._read_remote_result(result_path)
        self.execute_command(f"rm -f {result_path}")
        exit_code = 0 if payload.get("success") else 1
        return BridgeRunOutput(
            stdout=payload.get("stdout", ""),
            stderr=payload.get("stderr", ""),
            exit_code=exit_code,
            tool_calls=tool_calls,
        )

    def _poll_bridge_requests(
        self,
        fulfiller: BridgeFulfiller,
        fulfilled_ids: set[str],
        tool_calls: list[BridgeToolCall],
        max_tool_calls: int,
    ) -> None:
        listing = self.execute_command(f"ls -1 {self._bridge_requests_dir} 2>/dev/null")
        if listing.exit_code:
            return
        names = [line.strip() for line in listing.stdout.splitlines() if line.strip().endswith(".json")]
        for name in names:
            request_path = f"{self._bridge_requests_dir}/{name}"
            try:
                request_payload = self._read_remote_result(request_path)
            except SandboxServiceError:
                continue
            request_id = str(request_payload.get("id") or "")
            if not request_id or request_id in fulfilled_ids:
                continue
            fulfilled_ids.add(request_id)
            if len(fulfilled_ids) > max_tool_calls:
                self._interrupt_runner()
                raise SandboxServiceError(
                    f"Sandbox code exceeded the maximum of {max_tool_calls} tool calls for this execution."
                )
            tool_name = str(request_payload.get("tool_name") or "")
            arguments = request_payload.get("arguments") or {}
            response_payload = fulfiller.fulfill(request_id, tool_name, arguments)
            tool_calls.append(
                BridgeToolCall(
                    tool_name=tool_name,
                    ok=bool(response_payload.get("ok")),
                    arguments=arguments,
                    error=response_payload.get("error"),
                )
            )
            self._write_remote_json(f"{self._bridge_responses_dir}/{name}", response_payload)
            self.execute_command(f"rm -f {request_path}")


class SandboxService:
    def __init__(self, settings: Settings, supabase_client: Client) -> None:
        self._settings = settings
        self._supabase = supabase_client
        self._sessions: dict[str, InteractiveSandboxSession] = {}
        self._lock = threading.RLock()

    @classmethod
    def from_env(cls) -> "SandboxService":
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise SandboxServiceError("Supabase service-role configuration is required for sandbox sessions.")
        if not settings.gke_service_account_key:
            raise SandboxServiceError("ARCHITECTOS_GKE_SERVICE_ACCOUNT_KEY is required for sandbox sessions.")
        return cls(
            settings=settings,
            supabase_client=create_client(settings.supabase_url, settings.supabase_service_role_key),
        )

    def execute_code(self, thread_id: str, code: str, timeout_seconds: float | None = None) -> SandboxExecutionResult:
        if not thread_id:
            raise SandboxServiceError("thread_id is required.")
        if not code.strip():
            raise SandboxServiceError("code is required.")

        with self._lock:
            session, row = self._get_or_create_session(thread_id)
            self._refresh_session_client(session)

        try:
            output = session.run(code, timeout=timeout_seconds)
        except Exception as exc:
            with self._lock:
                self._expire_thread_session(thread_id, reason="run_failed")
            raise SandboxServiceError(f"Sandbox execution failed: {exc}") from exc

        pod_name = str(row["pod_name"])
        self._touch_session_row(str(row["id"]))
        return SandboxExecutionResult(
            thread_id=thread_id,
            pod_name=pod_name,
            stdout=output.stdout,
            stderr=output.stderr,
            exit_code=output.exit_code,
            status="active",
        )

    def execute_code_with_bridge(
        self,
        thread_id: str,
        code: str,
        *,
        fulfiller: BridgeFulfiller,
        timeout_seconds: float | None = None,
        poll_interval: float = DEFAULT_BRIDGE_POLL_INTERVAL_SECONDS,
        max_tool_calls: int = DEFAULT_BRIDGE_MAX_TOOL_CALLS,
    ) -> SandboxBridgeExecutionResult:
        """Code Mode: same session/pod as execute_code, with in-code tool calls."""
        if not thread_id:
            raise SandboxServiceError("thread_id is required.")
        if not code.strip():
            raise SandboxServiceError("code is required.")

        with self._lock:
            session, row = self._get_or_create_session(thread_id)
            self._refresh_session_client(session)

        if not isinstance(session, KubernetesInteractiveSandboxSession):
            raise SandboxServiceError("Bridge execution requires the Kubernetes interactive sandbox session.")

        try:
            output = session.run_with_bridge(
                code,
                fulfiller=fulfiller,
                timeout=timeout_seconds,
                poll_interval=poll_interval,
                max_tool_calls=max_tool_calls,
            )
        except Exception as exc:
            with self._lock:
                self._expire_thread_session(thread_id, reason="run_failed")
            raise SandboxServiceError(f"Sandbox bridge execution failed: {exc}") from exc

        pod_name = str(row["pod_name"])
        self._touch_session_row(str(row["id"]))
        return SandboxBridgeExecutionResult(
            thread_id=thread_id,
            pod_name=pod_name,
            stdout=output.stdout,
            stderr=output.stderr,
            exit_code=output.exit_code,
            status="active",
            tool_calls=output.tool_calls,
        )

    def close_session(self, thread_id: str, status: str = "closed") -> None:
        with self._lock:
            self._close_thread_session(thread_id, status=status)

    def get_active_session(self, thread_id: str) -> InteractiveSandboxSession:
        with self._lock:
            row = self._lookup_active_session_row(thread_id)
            session = self._sessions.get(thread_id)
            if (
                row
                and session
                and session.is_open
                and self._pod_is_running(str(row["pod_name"]), str(row["kube_namespace"]))
            ):
                self._refresh_session_client(session)
                return session
        raise SandboxServiceError("No active in-process sandbox session exists for this thread.")

    def sweep_idle_sessions_once(self) -> int:
        cutoff = datetime.now(UTC) - timedelta(minutes=self._settings.sandbox_idle_ttl_minutes)
        rows = (
            self._supabase.table("sandbox_sessions")
            .select("id,thread_id,pod_name,kube_namespace,status,last_active_at")
            .eq("status", "active")
            .lt("last_active_at", cutoff.isoformat())
            .execute()
            .data
            or []
        )
        expired = 0
        for row in rows:
            thread_id = str(row["thread_id"])
            with self._lock:
                if self._close_thread_session(thread_id, status="expired"):
                    expired += 1
        return expired

    def _get_or_create_session(self, thread_id: str) -> tuple[InteractiveSandboxSession, dict[str, Any]]:
        existing = self._lookup_active_session_row(thread_id)
        if existing:
            cached = self._sessions.get(thread_id)
            if cached and cached.is_open and self._pod_is_running(str(existing["pod_name"]), str(existing["kube_namespace"])):
                return cached, existing

            self._expire_row(existing, reason="stale_or_missing_process_session")

        session = self._new_session()
        try:
            session.open()
            pod_name = str(session.container)
            inserted = (
                self._supabase.table("sandbox_sessions")
                .insert({
                    "thread_id": thread_id,
                    "pod_name": pod_name,
                    "kube_namespace": "default",
                    "status": "active",
                })
                .execute()
                .data
                or []
            )
            if not inserted:
                raise SandboxServiceError("Sandbox session row was not created.")
        except Exception:
            with suppress(Exception):
                session.close()
            raise

        self._sessions[thread_id] = session
        return session, inserted[0]

    def _lookup_active_session_row(self, thread_id: str) -> dict[str, Any] | None:
        rows = (
            self._supabase.table("sandbox_sessions")
            .select("id,thread_id,pod_name,kube_namespace,status,last_active_at")
            .eq("thread_id", thread_id)
            .eq("status", "active")
            .order("last_active_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        return rows[0] if rows else None

    def _new_session(self) -> InteractiveSandboxSession:
        return KubernetesInteractiveSandboxSession(
            backend=SandboxBackend.KUBERNETES,
            client=self._build_kubernetes_client(),
            image=self._settings.sandbox_image,
            kube_namespace="default",
            skip_environment_setup=True,
            workdir="/sandbox",
            timeout=60.0,
        )

    def _refresh_session_client(self, session: InteractiveSandboxSession) -> None:
        backend_session = getattr(session, "_backend_session", None)
        if not backend_session:
            return
        refreshed_client = self._build_kubernetes_client()
        backend_session.client = refreshed_client
        if getattr(backend_session, "container_api", None):
            backend_session.container_api.client = refreshed_client
        if getattr(session, "container_api", None):
            session.container_api.client = refreshed_client

    def _build_kubernetes_client(self) -> k8s_client.CoreV1Api:
        credentials_info = self._service_account_info()
        project_id = self._settings.gcp_project_id or credentials_info.get("project_id")
        if not project_id:
            raise SandboxServiceError("ARCHITECTOS_GCP_PROJECT_ID or project_id in the service account key is required.")

        credentials = service_account.Credentials.from_service_account_info(
            credentials_info,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        credentials.refresh(Request())
        cluster = container_v1.ClusterManagerClient(credentials=credentials).get_cluster(
            request={
                "name": (
                    f"projects/{project_id}/locations/{self._settings.gcp_region}"
                    f"/clusters/{self._settings.gke_cluster_name}"
                )
            }
        )
        ca_path = self._write_ca_cert(cluster.master_auth.cluster_ca_certificate)

        configuration = k8s_client.Configuration()
        configuration.host = f"https://{cluster.endpoint}"
        configuration.ssl_ca_cert = ca_path
        configuration.api_key = {"authorization": f"Bearer {credentials.token}"}
        return k8s_client.CoreV1Api(k8s_client.ApiClient(configuration))

    def _service_account_info(self) -> dict[str, Any]:
        raw_key = self._settings.gke_service_account_key or ""
        if raw_key.strip().startswith("{"):
            return json.loads(raw_key)
        key_path = Path(raw_key)
        if key_path.exists():
            return json.loads(key_path.read_text(encoding="utf-8"))
        raise SandboxServiceError("ARCHITECTOS_GKE_SERVICE_ACCOUNT_KEY must be raw JSON or a readable JSON file path.")

    def _write_ca_cert(self, encoded_ca_cert: str) -> str:
        with tempfile.NamedTemporaryFile("wb", delete=False, suffix=".crt") as ca_file:
            ca_file.write(base64.b64decode(encoded_ca_cert))
            return ca_file.name

    def _pod_is_running(self, pod_name: str, namespace: str) -> bool:
        try:
            pod = self._build_kubernetes_client().read_namespaced_pod(name=pod_name, namespace=namespace)
        except ApiException as exc:
            if exc.status == 404:
                return False
            raise SandboxServiceError(f"Failed to inspect sandbox pod {pod_name}: {exc}") from exc
        return pod.status.phase == "Running"

    def _touch_session_row(self, row_id: str) -> None:
        self._supabase.table("sandbox_sessions").update({"last_active_at": datetime.now(UTC).isoformat()}).eq(
            "id",
            row_id,
        ).execute()

    def _expire_row(self, row: dict[str, Any], reason: str) -> None:
        thread_id = str(row["thread_id"])
        session = self._sessions.pop(thread_id, None)
        if session:
            with suppress(Exception):
                session.close()
        else:
            with suppress(Exception):
                self._build_kubernetes_client().delete_namespaced_pod(
                    name=str(row["pod_name"]),
                    namespace=str(row["kube_namespace"]),
                    body=k8s_client.V1DeleteOptions(),
                )
        self._supabase.table("sandbox_sessions").update({"status": "expired"}).eq("id", str(row["id"])).execute()

    def _expire_thread_session(self, thread_id: str, reason: str) -> bool:
        row = self._lookup_active_session_row(thread_id)
        if not row:
            return False
        self._expire_row(row, reason=reason)
        return True

    def _close_thread_session(self, thread_id: str, status: str) -> bool:
        row = self._lookup_active_session_row(thread_id)
        if not row:
            return False

        session = self._sessions.pop(thread_id, None)
        if session:
            with suppress(Exception):
                session.close()
        else:
            with suppress(Exception):
                self._build_kubernetes_client().delete_namespaced_pod(
                    name=str(row["pod_name"]),
                    namespace=str(row["kube_namespace"]),
                    body=k8s_client.V1DeleteOptions(),
                )
        self._supabase.table("sandbox_sessions").update({"status": status}).eq("id", str(row["id"])).execute()
        return True


@lru_cache(maxsize=1)
def get_sandbox_service() -> SandboxService:
    return SandboxService.from_env()
