from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from services.citations.models import CitationRef
from services.structured_query import APPROVED_COLUMNS, APPROVED_SURFACES

if TYPE_CHECKING:
    from services.vector_store import VectorStore


@dataclass(frozen=True)
class PlatformRenderer:
    table: str
    columns: tuple[str, ...]
    label_fields: tuple[str, ...]
    deep_link: str
    owner_column: str = "user_id"


PLATFORM_RECORD_RENDERERS: dict[str, PlatformRenderer] = {
    "mra_checkpoints": PlatformRenderer(
        table="mra_checkpoints",
        columns=("id", "user_id", "checkpoint_id", "checkpoint_title", "stage_assessment", "score", "status", "updated_at"),
        label_fields=("checkpoint_title", "checkpoint_id", "id"),
        deep_link="/pro/diagnostics/mra",
    ),
    "gm_assessment_checkpoint_scores": PlatformRenderer(
        table="gm_assessment_checkpoint_scores",
        columns=("id", "user_id", "assessment_id", "checkpoint_id", "stage_id", "score", "notes", "updated_at"),
        label_fields=("checkpoint_id", "assessment_id", "id"),
        deep_link="/pro/diagnostics/mra",
    ),
    "ae_assessments": PlatformRenderer(
        table="ae_assessments",
        columns=("id", "user_id", "stage_id", "status", "completed_at", "created_at", "updated_at"),
        label_fields=("stage_id", "status", "id"),
        deep_link="/pro/diagnostics/ae-ladder",
    ),
    "ae_dimension_scores": PlatformRenderer(
        table="ae_dimension_scores",
        columns=("id", "user_id", "assessment_id", "dimension_key", "score", "stage_id", "updated_at"),
        label_fields=("dimension_key", "assessment_id", "id"),
        deep_link="/pro/diagnostics/ae-ladder",
    ),
    "ae_assessment_insights": PlatformRenderer(
        table="ae_assessment_insights",
        columns=("id", "user_id", "assessment_id", "insight_type", "title", "body", "updated_at"),
        label_fields=("title", "insight_type", "id"),
        deep_link="/pro/diagnostics/ae-ladder",
    ),
    "sp_sprint_goals": PlatformRenderer(
        table="sp_sprint_goals",
        columns=("id", "user_id", "name", "goal_text", "quarter", "status", "kickoff_date", "updated_at"),
        label_fields=("name", "goal_text", "quarter", "id"),
        deep_link="/pro/planning/sprint-planning",
    ),
    "sp_sprint_initiatives": PlatformRenderer(
        table="sp_sprint_initiatives",
        columns=("id", "user_id", "sprint_goal_id", "name", "outcome_statement", "three_p_tier", "status", "updated_at"),
        label_fields=("name", "outcome_statement", "id"),
        deep_link="/pro/planning/sprint-planning",
    ),
    "sp_sprint_milestones": PlatformRenderer(
        table="sp_sprint_milestones",
        columns=("id", "user_id", "initiative_id", "description", "status", "target_date", "updated_at"),
        label_fields=("description", "status", "id"),
        deep_link="/pro/planning/sprint-planning",
    ),
    "quarter_map_selections": PlatformRenderer(
        table="quarter_map_selections",
        columns=("id", "user_id", "quarter", "priority_area", "selected_capability", "selection_reason", "updated_at"),
        label_fields=("priority_area", "selected_capability", "quarter", "id"),
        deep_link="/pro/planning/quarter-map",
    ),
    "cc_versions": PlatformRenderer(
        table="cc_versions",
        columns=("id", "user_id", "version_name", "status", "created_at", "updated_at"),
        label_fields=("version_name", "status", "id"),
        deep_link="/pro/foundations/clarity-compass",
    ),
    "cc_synthesis": PlatformRenderer(
        table="cc_synthesis",
        columns=("id", "user_id", "version_id", "title", "summary", "updated_at"),
        label_fields=("title", "version_id", "id"),
        deep_link="/pro/foundations/clarity-compass",
    ),
    "clarity_compass_versions": PlatformRenderer(
        table="clarity_compass_versions",
        columns=("id", "user_id", "status", "created_at", "updated_at"),
        label_fields=("status", "id"),
        deep_link="/pro/foundations/clarity-compass",
    ),
    "reflection_reviews": PlatformRenderer(
        table="reflection_reviews",
        columns=("id", "user_id", "title", "period_label", "status", "created_at", "updated_at"),
        label_fields=("title", "period_label", "status", "id"),
        deep_link="/pro/execution/reflection-review",
    ),
    "founder_dataset_rows": PlatformRenderer(
        table="founder_dataset_rows",
        columns=tuple(sorted(APPROVED_COLUMNS | {"user_id"})),
        label_fields=("row_label", "entity_name", "id"),
        deep_link="/pro/intelligence/datasets",
    ),
    "founder_dataset_rows_v": PlatformRenderer(
        table="founder_dataset_rows_v",
        columns=tuple(sorted(APPROVED_COLUMNS | {"user_id"})),
        label_fields=("row_label", "entity_name", "dataset_name", "id"),
        deep_link="/pro/intelligence/datasets",
    ),
}


def resolve_platform_record(ref: CitationRef, user_id: str, store: "VectorStore") -> dict[str, Any]:
    parsed = _parse_record_path(ref)
    if not parsed:
        return _error(ref, "missing_record_path", "Platform citation is missing locator.record_path or source_metadata.record_path.")

    table, row_id, field = parsed
    renderer = PLATFORM_RECORD_RENDERERS.get(table)
    if not renderer:
        return _error(ref, "unsupported_table", f"Platform table is not registered as citable: {table}")

    if table.startswith("founder_dataset_rows") and table not in APPROVED_SURFACES:
        return _error(ref, "unsupported_table", f"Structured-query safe surface is not approved: {table}")

    response = (
        store.client.table(renderer.table)
        .select(",".join(renderer.columns))
        .eq(renderer.owner_column, user_id)
        .eq("id", row_id)
        .maybe_single()
        .execute()
    )
    row = response.data
    if not row:
        return _error(ref, "unresolvable", "Platform record was not found for this user.")

    fields = _field_table(row, renderer.columns, field)
    return {
        "type": "platform_record",
        "source_kind": "platform_record",
        "source_id": ref.source_id or row_id,
        "label": ref.source_label or _label(row, renderer),
        "table": table,
        "row_id": row_id,
        "field": field,
        "fields": fields,
        "deep_link": _deep_link(renderer.deep_link, table=table, row_id=row_id, field=field),
        "record": row,
    }


def _parse_record_path(ref: CitationRef) -> tuple[str, str, str | None] | None:
    record_path = (
        ref.locator.record_path
        if ref.locator and ref.locator.record_path
        else ref.source_metadata.get("record_path")
    )
    if not record_path and ref.source_id and "/" in ref.source_id:
        record_path = ref.source_id
    if not record_path:
        return None
    parts = [part for part in str(record_path).strip("/").split("/") if part]
    if len(parts) < 2:
        return None
    return parts[0], parts[1], parts[2] if len(parts) > 2 else None


def _field_table(row: dict[str, Any], columns: tuple[str, ...], focused_field: str | None) -> list[dict[str, Any]]:
    visible = [focused_field] if focused_field and focused_field in row else list(columns)
    return [{"key": key, "label": key.replace("_", " ").title(), "value": row.get(key)} for key in visible if key in row]


def _label(row: dict[str, Any], renderer: PlatformRenderer) -> str:
    for field in renderer.label_fields:
        value = row.get(field)
        if value:
            return str(value)
    return str(row.get("id") or renderer.table)


def _deep_link(base: str, *, table: str, row_id: str, field: str | None) -> str:
    link = f"{base}?sourceTable={table}&sourceId={row_id}"
    if field:
        link += f"&field={field}"
    return link


def _error(ref: CitationRef, code: str, message: str) -> dict[str, Any]:
    return {
        "type": "error",
        "source_kind": ref.source_kind,
        "source_id": ref.source_id,
        "code": code,
        "message": message,
    }
