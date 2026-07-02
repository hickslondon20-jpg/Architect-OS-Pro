"""Delivery service for sandbox-generated founder artifacts."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from contextlib import suppress
import base64
import mimetypes
from pathlib import Path
import shlex
import tempfile
from typing import Any
from uuid import UUID, uuid4

from supabase import Client, create_client

from core.config import Settings, get_settings
from services.sandbox_service import SandboxService, SandboxServiceError, get_sandbox_service


ARTIFACT_BUCKET = "artifacts"
SIGNED_URL_EXPIRES_SECONDS = 3600
RENDERABLE_EXTENSIONS = {".md", ".markdown", ".html", ".htm"}


class ArtifactServiceError(RuntimeError):
    pass


@dataclass(frozen=True)
class ArtifactDeliveryResult:
    id: str
    user_id: str
    source_kind: str
    source_id: str
    filename: str
    mime_type: str
    size: int
    storage_path: str
    renderable: bool
    description: str | None = None
    content: str | None = None
    signed_url: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ArtifactService:
    def __init__(self, settings: Settings, supabase_client: Client, sandbox_service: SandboxService) -> None:
        self._settings = settings
        self._supabase = supabase_client
        self._sandbox_service = sandbox_service

    @classmethod
    def from_env(cls) -> "ArtifactService":
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise ArtifactServiceError("Supabase service-role configuration is required for artifact delivery.")
        return cls(
            settings=settings,
            supabase_client=create_client(settings.supabase_url, settings.supabase_service_role_key),
            sandbox_service=get_sandbox_service(),
        )

    def deliver_from_sandbox(
        self,
        user_id: str | UUID,
        thread_id: str | UUID,
        container_path: str,
        filename: str | None = None,
        description: str | None = None,
    ) -> ArtifactDeliveryResult:
        user_id_str = str(user_id)
        thread_id_str = str(thread_id)
        clean_filename = self._safe_filename(filename or Path(container_path).name)
        artifact_id = str(uuid4())
        mime_type = mimetypes.guess_type(clean_filename)[0] or "application/octet-stream"
        renderable = Path(clean_filename).suffix.lower() in RENDERABLE_EXTENSIONS
        storage_path = f"{user_id_str}/{artifact_id}/{clean_filename}"

        content = self._extract_file(thread_id_str, container_path)
        uploaded = False
        inserted = False
        try:
            self._supabase.storage.from_(ARTIFACT_BUCKET).upload(
                storage_path,
                content,
                {"content-type": mime_type, "upsert": "false"},
            )
            uploaded = True
            row = {
                "id": artifact_id,
                "user_id": user_id_str,
                "source_kind": "vcso_thread",
                "source_id": thread_id_str,
                "filename": clean_filename,
                "mime_type": mime_type,
                "size": len(content),
                "storage_path": storage_path,
                "renderable": renderable,
                "description": description,
            }
            self._supabase.table("artifacts").insert(row).execute()
            inserted = True
            signed_url = None
            text_content = None
            if renderable:
                text_content = content.decode("utf-8", errors="replace")
            else:
                signed_url = self.create_signed_url(storage_path)
            return ArtifactDeliveryResult(
                id=artifact_id,
                user_id=user_id_str,
                source_kind="vcso_thread",
                source_id=thread_id_str,
                filename=clean_filename,
                mime_type=mime_type,
                size=len(content),
                storage_path=storage_path,
                renderable=renderable,
                description=description,
                content=text_content,
                signed_url=signed_url,
            )
        except Exception as exc:
            if inserted:
                with suppress(Exception):
                    self._supabase.table("artifacts").delete().eq("id", artifact_id).execute()
            if uploaded:
                with suppress(Exception):
                    self._supabase.storage.from_(ARTIFACT_BUCKET).remove([storage_path])
            raise ArtifactServiceError(f"Could not deliver artifact: {exc}") from exc

    def get_delivery(self, artifact_id: str | UUID, user_id: str | UUID) -> ArtifactDeliveryResult:
        row = self._get_owned_row(artifact_id, user_id)
        content = None
        signed_url = None
        if row.get("renderable"):
            content = self._supabase.storage.from_(ARTIFACT_BUCKET).download(row["storage_path"]).decode(
                "utf-8",
                errors="replace",
            )
        else:
            signed_url = self.create_signed_url(row["storage_path"])
        return ArtifactDeliveryResult(
            id=str(row["id"]),
            user_id=str(row["user_id"]),
            source_kind=str(row["source_kind"]),
            source_id=str(row["source_id"]),
            filename=str(row["filename"]),
            mime_type=str(row.get("mime_type") or "application/octet-stream"),
            size=int(row.get("size") or 0),
            storage_path=str(row["storage_path"]),
            renderable=bool(row["renderable"]),
            description=row.get("description"),
            content=content,
            signed_url=signed_url,
        )

    def delete_artifact(self, artifact_id: str | UUID, user_id: str | UUID) -> None:
        row = self._get_owned_row(artifact_id, user_id)
        storage_path = row.get("storage_path")
        if storage_path:
            self._supabase.storage.from_(ARTIFACT_BUCKET).remove([storage_path])
        self._supabase.table("artifacts").delete().eq("id", str(artifact_id)).eq("user_id", str(user_id)).execute()

    def create_signed_url(self, storage_path: str) -> str:
        response = self._supabase.storage.from_(ARTIFACT_BUCKET).create_signed_url(
            storage_path,
            SIGNED_URL_EXPIRES_SECONDS,
        )
        if isinstance(response, dict):
            signed_url = response.get("signedURL") or response.get("signedUrl") or response.get("signed_url")
        else:
            signed_url = getattr(response, "signed_url", None) or getattr(response, "signedURL", None)
        if not signed_url:
            raise ArtifactServiceError("Supabase did not return a signed URL.")
        return str(signed_url)

    def _get_owned_row(self, artifact_id: str | UUID, user_id: str | UUID) -> dict[str, Any]:
        rows = (
            self._supabase.table("artifacts")
            .select("*")
            .eq("id", str(artifact_id))
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
            .data
            or []
        )
        if not rows:
            raise ArtifactServiceError("Artifact not found or access denied.")
        return rows[0]

    def _extract_file(self, thread_id: str, container_path: str) -> bytes:
        session = self._sandbox_service.get_active_session(thread_id)
        with tempfile.NamedTemporaryFile(delete=False) as copied:
            local_path = copied.name
        try:
            try:
                session.copy_from_runtime(container_path, local_path)
                content = Path(local_path).read_bytes()
                if content:
                    return content
            except Exception:
                pass
            return self._extract_file_via_exec(session, container_path)
        finally:
            with suppress(FileNotFoundError):
                Path(local_path).unlink()

    def _extract_file_via_exec(self, session: Any, container_path: str) -> bytes:
        command = (
            "import base64, pathlib; "
            f"data = pathlib.Path({container_path!r}).read_bytes(); "
            "print(base64.b64encode(data).decode('ascii'))"
        )
        result = session.execute_command(f"python -c {shlex.quote(command)}")
        if result.exit_code:
            raise ArtifactServiceError(f"Could not extract artifact file: {result.stderr or result.stdout}")
        try:
            return base64.b64decode(result.stdout.strip())
        except Exception as exc:
            raise ArtifactServiceError("Extracted artifact content was not valid base64.") from exc

    def _safe_filename(self, filename: str) -> str:
        clean = Path(filename.replace("\\", "/")).name.strip()
        if not clean or clean in {".", ".."}:
            raise ArtifactServiceError("filename is required.")
        return clean


def get_artifact_service() -> ArtifactService:
    return ArtifactService.from_env()
