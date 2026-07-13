"""Founder-scoped resource annotations for orchestration scaffolding."""

from __future__ import annotations

import uuid
from typing import Any


RESOURCE_KINDS = {"wiki_component", "tool", "skill"}
MAX_NOTE_CHARS = 2000
MAX_ACTIVE_PER_RESOURCE = 8


class AgentAnnotationError(ValueError):
    pass


class AgentAnnotationService:
    def __init__(self, supabase_client: Any) -> None:
        self.supabase = supabase_client

    def annotate(
        self,
        *,
        user_id: str,
        resource_kind: str,
        resource_ref: str,
        note: str,
        created_by: str,
    ) -> dict[str, Any]:
        kind, ref = self._validate_identity(resource_kind, resource_ref)
        cleaned_note = " ".join(str(note or "").split())[:MAX_NOTE_CHARS]
        actor = " ".join(str(created_by or "main").split())[:160]
        if not cleaned_note:
            raise AgentAnnotationError("note is required")
        self._assert_resource_exists(user_id, kind, ref)
        response = self.supabase.table("agent_annotations").insert(
            {
                "user_id": user_id,
                "resource_kind": kind,
                "resource_ref": ref,
                "note": cleaned_note,
                "created_by": actor or "main",
                "status": "active",
            }
        ).execute()
        rows = response.data or []
        if not rows:
            raise AgentAnnotationError("annotation was not saved")
        return _public_annotation(rows[0])

    def clear(self, *, user_id: str, resource_kind: str, resource_ref: str) -> dict[str, Any]:
        kind, ref = self._validate_identity(resource_kind, resource_ref)
        response = (
            self.supabase.table("agent_annotations")
            .update({"status": "cleared"})
            .eq("user_id", user_id)
            .eq("resource_kind", kind)
            .eq("resource_ref", ref)
            .eq("status", "active")
            .execute()
        )
        return {"status": "cleared", "cleared_count": len(response.data or [])}

    def list_for_resources(
        self,
        *,
        user_id: str,
        resources: list[dict[str, str]],
    ) -> list[dict[str, Any]]:
        wanted = {
            self._validate_identity(item.get("resource_kind", ""), item.get("resource_ref", ""))
            for item in resources[:30]
        }
        if not wanted:
            return []
        rows = (
            self.supabase.table("agent_annotations")
            .select("id,resource_kind,resource_ref,note,created_by,status,created_at,updated_at")
            .eq("user_id", user_id)
            .eq("status", "active")
            .order("created_at", desc=True)
            .limit(len(wanted) * MAX_ACTIVE_PER_RESOURCE)
            .execute()
            .data
            or []
        )
        return [
            _public_annotation(row)
            for row in rows
            if (str(row.get("resource_kind")), str(row.get("resource_ref"))) in wanted
        ]

    def _validate_identity(self, resource_kind: str, resource_ref: str) -> tuple[str, str]:
        kind = str(resource_kind or "").strip()
        ref = str(resource_ref or "").strip()[:240]
        if kind not in RESOURCE_KINDS:
            raise AgentAnnotationError("unsupported resource_kind")
        if not ref:
            raise AgentAnnotationError("resource_ref is required")
        return kind, ref

    def _assert_resource_exists(self, user_id: str, kind: str, ref: str) -> None:
        if kind == "tool":
            rows = (
                self.supabase.table("tool_registry")
                .select("slug")
                .eq("slug", ref)
                .eq("enabled", True)
                .limit(1)
                .execute()
                .data
                or []
            )
        elif kind == "skill":
            rows = (
                self.supabase.table("skill_packs")
                .select("slug")
                .eq("slug", ref)
                .eq("status", "active")
                .or_(f"scope.eq.global,user_id.eq.{user_id}")
                .limit(1)
                .execute()
                .data
                or []
            )
        else:
            fixed = (
                self.supabase.table("wiki_pages")
                .select("page_key")
                .eq("user_id", user_id)
                .eq("page_key", ref)
                .limit(1)
                .execute()
                .data
                or []
            )
            emergent = []
            if not fixed:
                emergent = (
                    self.supabase.table("ose_knowledge_pages")
                    .select("id,canonical_key")
                    .eq("user_id", user_id)
                    .neq("status", "deleted")
                    .eq("canonical_key", ref)
                    .limit(1)
                    .execute()
                    .data
                    or []
                )
            if not fixed and not emergent:
                try:
                    page_id = str(uuid.UUID(ref))
                except ValueError:
                    page_id = ""
                if page_id:
                    emergent = (
                        self.supabase.table("ose_knowledge_pages")
                        .select("id,canonical_key")
                        .eq("user_id", user_id)
                        .neq("status", "deleted")
                        .eq("id", page_id)
                        .limit(1)
                        .execute()
                        .data
                        or []
                    )
            rows = fixed or emergent
        if not rows:
            raise AgentAnnotationError("resource is not available in founder scope")


def _public_annotation(row: dict[str, Any]) -> dict[str, Any]:
    return {
        key: row.get(key)
        for key in (
            "id",
            "resource_kind",
            "resource_ref",
            "note",
            "created_by",
            "status",
            "created_at",
            "updated_at",
        )
        if row.get(key) is not None
    }
