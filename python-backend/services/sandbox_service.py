"""GKE-backed interactive sandbox execution for Phase 5 verification."""

from __future__ import annotations

from contextlib import suppress
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
import base64
import json
from pathlib import Path
import shlex
import tempfile
import threading
from typing import Any

from google.auth.transport.requests import Request
from google.cloud import container_v1
from google.oauth2 import service_account
from kubernetes import client as k8s_client
from kubernetes.client.exceptions import ApiException
from llm_sandbox import InteractiveSandboxSession, SandboxBackend
from llm_sandbox.interactive import _INTERACTIVE_RUNNER_SCRIPT
from supabase import Client, create_client

from core.config import Settings, get_settings


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


class KubernetesInteractiveSandboxSession(InteractiveSandboxSession):
    def _ensure_runtime_dependencies(self) -> None:
        self.execute_commands([
            (f"mkdir -p {self._commands_dir}", None),
            (f"mkdir -p {self._results_dir}", None),
        ])

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
