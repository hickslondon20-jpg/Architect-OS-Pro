"""Governed structured dataset registration for founder-owned uploads."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from services.vector_store import VectorStore, VectorStoreError


STRUCTURED_FILE_TYPES = {"csv", "tsv", "xlsx", "xls", "ods", "json", "xml", "xbrl"}
DATASET_TYPES = {"pnl", "expenses", "utilization", "capacity", "client_concentration", "pipeline", "generic_table"}
PERIOD_GRAINS = {"day", "week", "month", "quarter", "year", "mixed", "unknown"}


@dataclass(frozen=True)
class StructuredColumnInput:
    source_column_name: str
    source_column_index: int | None = None
    normalized_key: str | None = None
    data_type: str | None = None
    semantic_role: str | None = None
    unit: str | None = None
    confidence: float | None = None
    requires_review: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class StructuredRowInput:
    source_row_index: int | None = None
    row_label: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    period_grain: str | None = None
    entity_name: str | None = None
    values: dict[str, Any] = field(default_factory=dict)
    normalized_values: dict[str, Any] = field(default_factory=dict)
    provenance: dict[str, Any] = field(default_factory=dict)
    confidence: float | None = None
    requires_review: bool = False


@dataclass(frozen=True)
class StructuredTableInput:
    table_key: str
    label: str | None = None
    source_sheet_name: str | None = None
    source_table_name: str | None = None
    parser_metadata: dict[str, Any] = field(default_factory=dict)
    columns: list[StructuredColumnInput] = field(default_factory=list)
    rows: list[StructuredRowInput] = field(default_factory=list)


@dataclass(frozen=True)
class DatasetRegistrationInput:
    user_id: str
    dataset_name: str
    source_document_id: str | None = None
    dataset_type: str | None = "generic_table"
    source_period_grain: str | None = "unknown"
    normalized_period_grain: str | None = None
    source_time_zone: str | None = None
    currency_code: str | None = None
    confidence: float | None = None
    summary: str | None = None
    provenance: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    tables: list[StructuredTableInput] = field(default_factory=list)


class StructuredDataService:
    def __init__(self, store: VectorStore) -> None:
        self.store = store

    @classmethod
    def from_env(cls) -> "StructuredDataService":
        return cls(VectorStore.from_env())

    def register_dataset(self, payload: DatasetRegistrationInput) -> dict[str, Any]:
        if payload.dataset_type and payload.dataset_type not in DATASET_TYPES:
            raise VectorStoreError(f"Unsupported dataset type: {payload.dataset_type}")
        _validate_period_grain(payload.source_period_grain, allow_mixed=True)
        _validate_period_grain(payload.normalized_period_grain, allow_mixed=True)

        document = None
        if payload.source_document_id:
            document = self.store.get_document(payload.source_document_id, payload.user_id)
            file_type = str(document.get("file_type") or "").lower()
            parser_format = str(document.get("parser_format") or "").lower()
            if file_type not in STRUCTURED_FILE_TYPES and parser_format not in {"csv", "workbook", "xml", "json"}:
                raise VectorStoreError("Source document is not a supported structured dataset file.")

        dataset_row = {
            "user_id": payload.user_id,
            "source_document_id": payload.source_document_id,
            "dataset_name": payload.dataset_name,
            "dataset_type": payload.dataset_type or "generic_table",
            "status": "ready" if payload.tables else "created",
            "source_period_grain": payload.source_period_grain or "unknown",
            "normalized_period_grain": payload.normalized_period_grain,
            "source_time_zone": payload.source_time_zone,
            "currency_code": payload.currency_code,
            "confidence": payload.confidence,
            "summary": payload.summary,
            "provenance": {
                **payload.provenance,
                "source_document_id": payload.source_document_id,
                "source_file_name": document.get("file_name") if document else None,
            },
            "metadata": payload.metadata,
        }

        try:
            dataset_response = self.store.client.table("founder_datasets").insert(dataset_row).execute()
        except Exception as exc:
            raise VectorStoreError(f"Could not create founder dataset: {exc}") from exc

        dataset = _single_insert(dataset_response.data, "founder dataset")
        table_count = 0
        column_count = 0
        row_count = 0

        for table in payload.tables:
            table_count += 1
            table_row = {
                "user_id": payload.user_id,
                "dataset_id": dataset["id"],
                "table_key": table.table_key,
                "label": table.label,
                "source_sheet_name": table.source_sheet_name,
                "source_table_name": table.source_table_name,
                "row_count": len(table.rows),
                "column_count": len(table.columns),
                "parser_metadata": table.parser_metadata,
            }
            try:
                table_response = self.store.client.table("founder_dataset_tables").insert(table_row).execute()
            except Exception as exc:
                raise VectorStoreError(f"Could not create founder dataset table: {exc}") from exc
            table_record = _single_insert(table_response.data, "founder dataset table")

            column_rows = [
                {
                    "user_id": payload.user_id,
                    "dataset_id": dataset["id"],
                    "table_id": table_record["id"],
                    "source_column_name": column.source_column_name,
                    "source_column_index": column.source_column_index,
                    "normalized_key": column.normalized_key,
                    "data_type": column.data_type or _infer_column_type(column.source_column_name),
                    "semantic_role": column.semantic_role or _infer_semantic_role(column.source_column_name),
                    "unit": column.unit,
                    "confidence": column.confidence,
                    "requires_review": column.requires_review or not column.normalized_key,
                    "metadata": column.metadata,
                }
                for column in table.columns
            ]
            if column_rows:
                try:
                    self.store.client.table("founder_dataset_columns").insert(column_rows).execute()
                except Exception as exc:
                    raise VectorStoreError(f"Could not create founder dataset columns: {exc}") from exc
                column_count += len(column_rows)

            row_rows = [
                {
                    "user_id": payload.user_id,
                    "dataset_id": dataset["id"],
                    "table_id": table_record["id"],
                    "source_row_index": row.source_row_index,
                    "row_label": row.row_label,
                    "period_start": row.period_start.isoformat() if row.period_start else None,
                    "period_end": row.period_end.isoformat() if row.period_end else None,
                    "period_grain": _row_period_grain(row.period_grain),
                    "entity_name": row.entity_name,
                    "values": row.values,
                    "normalized_values": row.normalized_values,
                    "provenance": {"table_key": table.table_key, **row.provenance},
                    "confidence": row.confidence,
                    "requires_review": row.requires_review or row.period_grain in (None, "unknown"),
                }
                for row in table.rows
            ]
            for batch in _batched(row_rows, 200):
                try:
                    self.store.client.table("founder_dataset_rows").insert(batch).execute()
                except Exception as exc:
                    raise VectorStoreError(f"Could not create founder dataset rows: {exc}") from exc
                row_count += len(batch)

        return {
            "dataset_id": dataset["id"],
            "status": dataset.get("status", "created"),
            "table_count": table_count,
            "column_count": column_count,
            "row_count": row_count,
        }


def _infer_column_type(name: str) -> str:
    lowered = name.lower()
    if any(token in lowered for token in ("date", "month", "quarter", "year", "period")):
        return "date"
    if any(token in lowered for token in ("revenue", "cost", "expense", "amount", "margin", "price", "payroll")):
        return "currency"
    if any(token in lowered for token in ("percent", "rate", "utilization")):
        return "percent"
    if any(token in lowered for token in ("hours", "count", "fte", "capacity")):
        return "number"
    return "text"


def _infer_semantic_role(name: str) -> str:
    lowered = name.lower()
    if any(token in lowered for token in ("date", "month", "quarter", "year", "period")):
        return "period"
    if any(token in lowered for token in ("client", "customer", "team", "employee")):
        return "entity"
    if _infer_column_type(name) in {"currency", "percent", "number"}:
        return "metric"
    return "dimension"


def _validate_period_grain(value: str | None, *, allow_mixed: bool) -> None:
    if value is None:
        return
    allowed = PERIOD_GRAINS if allow_mixed else PERIOD_GRAINS - {"mixed"}
    if value not in allowed:
        raise VectorStoreError(f"Unsupported period grain: {value}")


def _row_period_grain(value: str | None) -> str:
    _validate_period_grain(value or "unknown", allow_mixed=False)
    return value or "unknown"


def _single_insert(data: Any, label: str) -> dict[str, Any]:
    if isinstance(data, list) and data:
        return data[0]
    if isinstance(data, dict):
        return data
    raise VectorStoreError(f"Could not read created {label} row.")


def _batched(rows: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [rows[index : index + size] for index in range(0, len(rows), size)]
