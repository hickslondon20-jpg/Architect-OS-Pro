"""Reconciliation sync for the tool_registry catalog (MA-06 Objective 1).

The code registry (``tool_registry.py``) is authoritative for *existence* — what tools exist and
what they do. The ``tool_registry`` table is the runtime-editable *catalog + governance overlay*
(enabled, routing_tier). This module keeps the table honest against the code:

- upsert every code-registered ToolDefinition by slug (catalog-derived fields only),
- flag drift (rows in the table, in scope, that the code no longer registers -> is_code_registered=false).

Governance fields (``enabled``, ``routing_tier``) and the curated ``label`` are NEVER overwritten on
update — only insert seeds a derived label. The sync does not touch models, cost, or usage; those
live in platform_ai_settings / ai_usage_log.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

from services.tool_registry import ToolDefinition, _native_tool_definitions


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _source_ref(defn: ToolDefinition) -> dict[str, Any]:
    if defn.source == "mcp":
        meta = defn.mcp_metadata or {}
        return {
            "kind": "mcp",
            "server_name": meta.get("server_name"),
            "tool_name": meta.get("tool_name"),
            "read_only": meta.get("read_only"),
        }
    if defn.source == "skill":
        meta = defn.skill_metadata or {}
        return {
            "kind": "skill",
            "id": meta.get("id"),
            "slug": meta.get("slug"),
            "scope": meta.get("scope"),
        }
    return {"kind": "native"}


def _derived_label(defn: ToolDefinition) -> str:
    """Only used when inserting a newly-discovered tool; curated labels are preserved on update."""
    if defn.source == "skill":
        name = (defn.skill_metadata or {}).get("name")
        if name:
            return str(name)
    if defn.source == "mcp":
        tool_name = (defn.mcp_metadata or {}).get("tool_name")
        if tool_name:
            return str(tool_name)
    return defn.name.replace("_", " ").title()


def sync_registry_catalog(
    client: Any,
    definitions: Iterable[ToolDefinition],
    *,
    tool_type_scope: str,
) -> dict[str, Any]:
    """Reconcile the catalog for one tool_type scope. Fail-open — never raises to the caller."""
    summary: dict[str, Any] = {
        "scope": tool_type_scope,
        "inserted": 0,
        "updated": 0,
        "drift_flagged": 0,
        "code_tools": 0,
        "errors": [],
    }
    try:
        defs = [d for d in definitions if d.source == tool_type_scope]
        summary["code_tools"] = len(defs)
        code_slugs = {d.name for d in defs}

        existing = (
            client.table("tool_registry")
            .select("slug")
            .eq("tool_type", tool_type_scope)
            .execute()
            .data
            or []
        )
        existing_slugs = {row["slug"] for row in existing}

        for defn in defs:
            catalog = {
                "description": defn.description,
                "tool_type": defn.source,
                "source_ref": _source_ref(defn),
                "persistence_semantics": defn.persistence_semantics,
                "is_code_registered": True,
                "last_synced_at": _now_iso(),
            }
            if defn.name in existing_slugs:
                # Update catalog-derived fields only; preserve label / enabled / routing_tier.
                client.table("tool_registry").update(catalog).eq("slug", defn.name).execute()
                summary["updated"] += 1
            else:
                client.table("tool_registry").insert(
                    {"slug": defn.name, "label": _derived_label(defn), **catalog}
                ).execute()
                summary["inserted"] += 1

        # Drift: rows in scope the code no longer registers.
        drift_slugs = existing_slugs - code_slugs
        for slug in drift_slugs:
            client.table("tool_registry").update(
                {"is_code_registered": False, "last_synced_at": _now_iso()}
            ).eq("slug", slug).execute()
            summary["drift_flagged"] += 1
    except Exception as exc:  # fail-open: catalog sync must never break boot or a request
        summary["errors"].append(str(exc))
    return summary


def sync_native_tools(client: Any) -> dict[str, Any]:
    """Boot-time sync of the static native tool set (no user context required)."""
    return sync_registry_catalog(client, _native_tool_definitions(), tool_type_scope="native")
