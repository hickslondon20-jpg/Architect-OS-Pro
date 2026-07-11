"""Skill pack CRUD plus SKILL.md import/export helpers."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import mimetypes
import re
from typing import Any
from uuid import UUID
from zipfile import ZIP_DEFLATED, ZipFile

from supabase import Client


SKILL_FILE_BUCKET = "skill-files"
SKILL_FILE_CATEGORIES = {"scripts", "references", "assets"}


class SkillServiceError(RuntimeError):
    pass


@dataclass
class ParsedSkill:
    name: str
    description: str
    body: str
    domain: str | None = None
    skill_kind: str | None = None
    trigger_tags: list[str] | None = None
    required_platform_context: list[str] | None = None


def parse_skill_md(content: str) -> dict[str, Any]:
    frontmatter, body = _split_frontmatter(content)
    values = _parse_frontmatter(frontmatter)
    name = _required_string(values, "name")
    description = _required_string(values, "description")
    return {
        "name": name,
        "description": description,
        "domain": _optional_string(values.get("domain")),
        "skill_kind": _optional_string(values.get("skill_kind")),
        "trigger_tags": _string_list(values.get("trigger_tags")),
        "required_platform_context": _string_list(values.get("required_platform_context")),
        "body": body,
    }


def serialize_skill_md(skill_pack_row: dict[str, Any]) -> str:
    lines = [
        "---",
        f"name: {_yaml_scalar(str(skill_pack_row.get('name') or '').strip())}",
        f"description: {_yaml_scalar(str(skill_pack_row.get('description') or '').strip())}",
    ]
    for key in ("domain", "skill_kind"):
        value = skill_pack_row.get(key)
        if value:
            lines.append(f"{key}: {_yaml_scalar(str(value))}")
    for key in ("trigger_tags", "required_platform_context"):
        value = _string_list(skill_pack_row.get(key))
        if value:
            lines.append(f"{key}: [{', '.join(_yaml_scalar(item) for item in value)}]")
    lines.append("---")
    return "\n".join(lines) + "\n" + str(skill_pack_row.get("body") or "")


class SkillService:
    def __init__(self, client: Client) -> None:
        self._client = client

    def list_visible(self, user_id: UUID) -> list[dict[str, Any]]:
        response = (
            self._client.table("skill_packs")
            .select(
                "id,slug,name,description,domain,skill_kind,trigger_tags,"
                "required_platform_context,status,scope,user_id,created_at,updated_at:last_updated"
            )
            .or_(f"scope.eq.global,user_id.eq.{user_id}")
            .order("scope", desc=False)
            .order("name")
            .execute()
        )
        return response.data or []

    def create(self, user_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
        name = str(payload.get("name") or "").strip()
        description = str(payload.get("description") or "").strip()
        body = str(payload.get("body") or "").strip()
        if not name or not description or not body:
            raise SkillServiceError("Skill name, description, and body are required.")
        row = {
            "user_id": str(user_id),
            "scope": "private",
            "slug": self._unique_slug(name, user_id),
            "name": name,
            "description": description,
            "domain": _optional_string(payload.get("domain")),
            "skill_kind": _optional_string(payload.get("skill_kind")),
            "trigger_tags": _string_list(payload.get("trigger_tags")),
            "required_platform_context": _string_list(payload.get("required_platform_context")),
            "body": str(payload.get("body") or ""),
            "status": "active",
        }
        response = self._client.table("skill_packs").insert(row).execute()
        rows = response.data or []
        if not rows:
            raise SkillServiceError("Could not create skill.")
        return rows[0]

    def update(self, user_id: UUID, skill_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
        existing = self._get_owned(skill_id, user_id)
        updates: dict[str, Any] = {}
        for key in ("name", "description", "body", "domain", "skill_kind"):
            if key in payload:
                updates[key] = _optional_string(payload[key]) if key in {"domain", "skill_kind"} else str(payload[key])
        for key in ("trigger_tags", "required_platform_context"):
            if key in payload:
                updates[key] = _string_list(payload[key])
        if "name" in updates and str(updates["name"]).strip() != existing.get("name"):
            updates["slug"] = self._unique_slug(str(updates["name"]), user_id, exclude_id=skill_id)
        if not updates:
            return existing
        response = (
            self._client.table("skill_packs")
            .update(updates)
            .eq("id", str(skill_id))
            .eq("user_id", str(user_id))
            .execute()
        )
        rows = response.data or []
        if not rows:
            raise SkillServiceError("Skill not found or access denied.")
        return rows[0]

    def delete(self, user_id: UUID, skill_id: UUID) -> None:
        self._get_owned(skill_id, user_id)
        files = self._list_files(skill_id)
        paths = [row["storage_path"] for row in files if row.get("storage_path")]
        if paths:
            self._client.storage.from_(SKILL_FILE_BUCKET).remove(paths)
        self._client.table("skill_packs").delete().eq("id", str(skill_id)).eq("user_id", str(user_id)).execute()

    def import_zip(self, user_id: UUID, zip_bytes: bytes) -> dict[str, Any]:
        created: dict[str, Any] | None = None
        uploaded_paths: list[str] = []
        try:
            with ZipFile(BytesIO(zip_bytes)) as archive:
                skill_name = next((name for name in archive.namelist() if name.replace("\\", "/") == "SKILL.md"), None)
                if not skill_name:
                    raise SkillServiceError("ZIP must include SKILL.md at the root.")
                parsed = parse_skill_md(archive.read(skill_name).decode("utf-8"))
                created = self.create(user_id, parsed)
                skill_id = UUID(str(created["id"]))
                metadata_rows: list[dict[str, Any]] = []
                for member in archive.infolist():
                    path = member.filename.replace("\\", "/")
                    if member.is_dir() or path == "SKILL.md":
                        continue
                    category, filename = _categorized_path(path)
                    if not category:
                        continue
                    blob = archive.read(member)
                    storage_path = f"{user_id}/{skill_id}/{category}/{filename}"
                    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
                    self._client.storage.from_(SKILL_FILE_BUCKET).upload(
                        storage_path,
                        blob,
                        {"content-type": content_type, "upsert": "false"},
                    )
                    uploaded_paths.append(storage_path)
                    metadata_rows.append(
                        {
                            "skill_id": str(skill_id),
                            "filename": filename,
                            "category": category,
                            "mime_type": content_type,
                            "size": len(blob),
                            "storage_path": storage_path,
                        }
                    )
                if metadata_rows:
                    self._client.table("skill_files").insert(metadata_rows).execute()
                created["files"] = metadata_rows
                return created
        except Exception:
            if uploaded_paths:
                self._client.storage.from_(SKILL_FILE_BUCKET).remove(uploaded_paths)
            if created:
                self._client.table("skill_packs").delete().eq("id", created["id"]).eq("user_id", str(user_id)).execute()
            raise

    def export_zip(self, user_id: UUID, skill_id: UUID) -> tuple[str, bytes]:
        skill = self._get_visible(skill_id, user_id)
        files = self._list_files(skill_id)
        output = BytesIO()
        with ZipFile(output, "w", ZIP_DEFLATED) as archive:
            archive.writestr("SKILL.md", serialize_skill_md(skill))
            for file_row in files:
                path = file_row.get("storage_path")
                category = file_row.get("category")
                filename = file_row.get("filename")
                if not path or category not in SKILL_FILE_CATEGORIES or not filename:
                    continue
                archive.writestr(f"{category}/{filename}", self._client.storage.from_(SKILL_FILE_BUCKET).download(path))
        return f"{skill.get('slug') or 'skill'}.zip", output.getvalue()

    def _get_owned(self, skill_id: UUID, user_id: UUID) -> dict[str, Any]:
        response = (
            self._client.table("skill_packs")
            .select("*")
            .eq("id", str(skill_id))
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            raise SkillServiceError("Skill not found or access denied.")
        return rows[0]

    def _get_visible(self, skill_id: UUID, user_id: UUID) -> dict[str, Any]:
        response = (
            self._client.table("skill_packs")
            .select("*")
            .eq("id", str(skill_id))
            .or_(f"scope.eq.global,user_id.eq.{user_id}")
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            raise SkillServiceError("Skill not found or access denied.")
        return rows[0]

    def _list_files(self, skill_id: UUID) -> list[dict[str, Any]]:
        response = self._client.table("skill_files").select("*").eq("skill_id", str(skill_id)).execute()
        return response.data or []

    def _unique_slug(self, name: str, user_id: UUID, exclude_id: UUID | None = None) -> str:
        base = _slugify(name)
        slug = base
        suffix = 2
        while True:
            query = self._client.table("skill_packs").select("id").eq("slug", slug).eq("user_id", str(user_id)).limit(1)
            if exclude_id:
                query = query.neq("id", str(exclude_id))
            rows = query.execute().data or []
            if not rows:
                return slug
            slug = f"{base}-{suffix}"
            suffix += 1


def _split_frontmatter(content: str) -> tuple[str, str]:
    normalized = content.replace("\r\n", "\n")
    if not normalized.startswith("---\n"):
        raise SkillServiceError("SKILL.md must start with YAML frontmatter.")
    end = normalized.find("\n---", 4)
    if end == -1:
        raise SkillServiceError("SKILL.md frontmatter is missing a closing delimiter.")
    body_start = end + len("\n---")
    if normalized[body_start:body_start + 1] == "\n":
        body_start += 1
    return normalized[4:end], normalized[body_start:]


def _parse_frontmatter(text: str) -> dict[str, Any]:
    values: dict[str, Any] = {}
    current_list_key: str | None = None
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if current_list_key and line.lstrip().startswith("- "):
            values.setdefault(current_list_key, []).append(_unquote(line.lstrip()[2:].strip()))
            continue
        current_list_key = None
        if ":" not in line:
            raise SkillServiceError(f"Unsupported frontmatter line: {line}")
        key, raw_value = line.split(":", 1)
        key = key.strip()
        raw_value = raw_value.strip()
        if not raw_value:
            values[key] = []
            current_list_key = key
        elif raw_value.startswith("[") and raw_value.endswith("]"):
            items = [item.strip() for item in raw_value[1:-1].split(",") if item.strip()]
            values[key] = [_unquote(item) for item in items]
        else:
            values[key] = _unquote(raw_value)
    return values


def _required_string(values: dict[str, Any], key: str) -> str:
    value = _optional_string(values.get(key))
    if not value:
        raise SkillServiceError(f"SKILL.md frontmatter requires {key}.")
    return value


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value).split(",") if item.strip()]


def _yaml_scalar(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1].replace('\\"', '"').replace("\\\\", "\\")
    return value


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "skill"


def _categorized_path(path: str) -> tuple[str | None, str]:
    clean = path.strip("/")
    if ".." in clean.split("/"):
        raise SkillServiceError("ZIP paths may not include parent-directory segments.")
    parts = clean.split("/", 1)
    if len(parts) != 2 or parts[0] not in SKILL_FILE_CATEGORIES or not parts[1]:
        return None, ""
    return parts[0], parts[1]
