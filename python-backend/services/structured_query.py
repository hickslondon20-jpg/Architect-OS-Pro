"""Fail-closed read-only query tool for approved founder dataset surfaces."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from services.vector_store import VectorStore


class StructuredQueryError(RuntimeError):
    pass


APPROVED_SURFACES = {
    "founder_dataset_rows",
    "founder_dataset_rows_v",
}
BASE_ROW_COLUMNS = {
    "id",
    "dataset_id",
    "table_id",
    "source_row_index",
    "row_label",
    "period_start",
    "period_end",
    "period_grain",
    "entity_name",
    "values",
    "normalized_values",
    "provenance",
    "confidence",
    "requires_review",
    "created_at",
}
VIEW_ONLY_COLUMNS = {"dataset_name", "dataset_type", "table_key", "table_label"}
APPROVED_COLUMNS = BASE_ROW_COLUMNS | VIEW_ONLY_COLUMNS
DANGEROUS_TOKENS = {
    "alter",
    "call",
    "copy",
    "create",
    "delete",
    "do",
    "drop",
    "execute",
    "grant",
    "insert",
    "revoke",
    "set",
    "truncate",
    "update",
}
SQL_RE = re.compile(
    r"^\s*select\s+(?P<columns>[\*\w\s,._>-]+)\s+from\s+(?:(?:public)\.)?(?P<surface>[a-z_][a-z0-9_]*)"
    r"(?:\s+where\s+(?P<where>.*?))?(?:\s+order\s+by\s+(?P<order>[a-z_][a-z0-9_]*(?:\s+(?:asc|desc))?))?"
    r"(?:\s+limit\s+(?P<limit>\d+))?\s*$",
    re.IGNORECASE | re.DOTALL,
)
EQUALITY_RE = re.compile(r"\b(?P<column>dataset_id|table_id|period_grain|entity_name|row_label)\s*=\s*'(?P<value>[^']*)'", re.IGNORECASE)


@dataclass(frozen=True)
class StructuredQueryRequest:
    user_id: str
    question: str
    generated_sql: str
    thread_id: str | None = None
    tool_call_id: str | None = None
    max_rows: int = 25


@dataclass(frozen=True)
class StructuredQueryResult:
    accepted: bool
    status: str
    query_id: str
    rows: list[dict[str, Any]]
    rejection_reason: str | None = None
    execution_ms: int | None = None


class StructuredQueryService:
    def __init__(self, store: "VectorStore") -> None:
        self.store = store

    @classmethod
    def from_env(cls) -> "StructuredQueryService":
        from services.vector_store import VectorStore

        return cls(VectorStore.from_env())

    def execute(self, payload: StructuredQueryRequest) -> StructuredQueryResult:
        query_id = self._create_audit(payload)
        started = time.perf_counter()
        try:
            validated = validate_structured_sql(payload.generated_sql, max_rows=payload.max_rows)
        except StructuredQueryError as exc:
            self._update_audit(query_id, payload.user_id, status="rejected", rejection_reason=str(exc))
            return StructuredQueryResult(
                accepted=False,
                status="rejected",
                query_id=query_id,
                rows=[],
                rejection_reason=str(exc),
            )

        try:
            rows = self._execute_validated(payload.user_id, validated)
        except Exception as exc:
            message = str(exc)
            self._update_audit(query_id, payload.user_id, status="failed", rejection_reason=message[:1000])
            raise StructuredQueryError(f"Structured query execution failed: {message}") from exc

        execution_ms = int((time.perf_counter() - started) * 1000)
        self._update_audit(
            query_id,
            payload.user_id,
            status="executed",
            approved_query_surface=validated["surface"],
            execution_ms=execution_ms,
            row_count=len(rows),
            metadata={"limit": validated["limit"], "filters": validated["filters"]},
        )
        self._store_result(query_id, payload.user_id, rows)
        return StructuredQueryResult(
            accepted=True,
            status="executed",
            query_id=query_id,
            rows=rows,
            execution_ms=execution_ms,
        )

    def _execute_validated(self, user_id: str, validated: dict[str, Any]) -> list[dict[str, Any]]:
        columns = ",".join(validated["columns"])
        query = (
            self.store.client.table(validated["surface"])
            .select(columns)
            .eq("user_id", user_id)
            .limit(validated["limit"])
        )
        for column, value in validated["filters"].items():
            query = query.eq(column, value)
        if validated.get("order_column"):
            query = query.order(validated["order_column"], desc=validated.get("order_desc", False))
        response = query.execute()
        return response.data or []

    def _create_audit(self, payload: StructuredQueryRequest) -> str:
        row = {
            "user_id": payload.user_id,
            "thread_id": payload.thread_id,
            "tool_call_id": payload.tool_call_id,
            "question": payload.question,
            "generated_sql": payload.generated_sql,
            "status": "created",
            "metadata": {"max_rows": payload.max_rows},
        }
        try:
            response = self.store.client.table("founder_dataset_queries").insert(row).execute()
        except Exception as exc:
            raise StructuredQueryError(f"Could not create structured query audit row: {exc}") from exc
        data = response.data[0] if isinstance(response.data, list) and response.data else response.data
        if not data:
            raise StructuredQueryError("Could not read structured query audit row.")
        return data["id"]

    def _update_audit(self, query_id: str, user_id: str, **values: Any) -> None:
        try:
            self.store.client.table("founder_dataset_queries").update(values).eq("id", query_id).eq("user_id", user_id).execute()
        except Exception as exc:
            raise StructuredQueryError(f"Could not update structured query audit row: {exc}") from exc

    def _store_result(self, query_id: str, user_id: str, rows: list[dict[str, Any]]) -> None:
        snapshot = {
            "user_id": user_id,
            "query_id": query_id,
            "result_rows": rows,
            "result_summary": f"Returned {len(rows)} row{'s' if len(rows) != 1 else ''}.",
        }
        try:
            self.store.client.table("founder_dataset_query_results").insert(snapshot).execute()
        except Exception as exc:
            raise StructuredQueryError(f"Could not store structured query result snapshot: {exc}") from exc


def validate_structured_sql(sql: str, *, max_rows: int = 25) -> dict[str, Any]:
    cleaned = _clean_sql(sql)
    lowered = cleaned.lower()
    tokens = set(re.findall(r"\b[a-z_][a-z0-9_]*\b", lowered))
    if not lowered.startswith("select "):
        raise StructuredQueryError("Only SELECT queries are allowed.")
    dangerous = sorted(tokens & DANGEROUS_TOKENS)
    if dangerous:
        raise StructuredQueryError(f"Unsafe SQL token rejected: {dangerous[0]}")

    match = SQL_RE.match(cleaned)
    if not match:
        raise StructuredQueryError("Query shape is not approved for structured dataset reads.")

    surface = match.group("surface").lower()
    if surface not in APPROVED_SURFACES:
        raise StructuredQueryError("Query references an unapproved dataset surface.")

    columns = _parse_columns(match.group("columns"), surface=surface)
    limit = min(int(match.group("limit") or max_rows), max(1, max_rows))
    filters = _parse_filters(match.group("where") or "")
    order_column, order_desc = _parse_order(match.group("order"))
    return {
        "surface": surface,
        "columns": columns,
        "limit": limit,
        "filters": filters,
        "order_column": order_column,
        "order_desc": order_desc,
    }


def _clean_sql(sql: str) -> str:
    if not sql or not sql.strip():
        raise StructuredQueryError("Generated SQL is required.")
    if "--" in sql or "/*" in sql or "*/" in sql:
        raise StructuredQueryError("SQL comments are not allowed.")
    stripped = sql.strip()
    if ";" in stripped.rstrip(";"):
        raise StructuredQueryError("Multi-statement SQL is not allowed.")
    return stripped.rstrip(";").strip()


def _parse_columns(raw_columns: str, *, surface: str) -> list[str]:
    allowed = APPROVED_COLUMNS if surface == "founder_dataset_rows_v" else BASE_ROW_COLUMNS
    if raw_columns.strip() == "*":
        return sorted(allowed | {"user_id"})
    columns = [column.strip().split(".")[-1] for column in raw_columns.split(",")]
    rejected = [column for column in columns if column not in allowed and column != "user_id"]
    if rejected:
        raise StructuredQueryError(f"Column is not approved for structured dataset reads: {rejected[0]}")
    if "user_id" not in columns:
        columns.append("user_id")
    return columns


def _parse_filters(where_clause: str) -> dict[str, str]:
    if not where_clause:
        return {}
    unsupported = re.sub(EQUALITY_RE, "", where_clause)
    unsupported = re.sub(r"\s+and\s+", "", unsupported, flags=re.IGNORECASE).strip()
    if unsupported:
        raise StructuredQueryError("Only simple equality filters on approved columns are allowed.")
    return {match.group("column").lower(): match.group("value") for match in EQUALITY_RE.finditer(where_clause)}


def _parse_order(order_clause: str | None) -> tuple[str | None, bool]:
    if not order_clause:
        return None, False
    parts = order_clause.lower().split()
    column = parts[0]
    if column not in APPROVED_COLUMNS:
        raise StructuredQueryError("ORDER BY column is not approved.")
    return column, len(parts) > 1 and parts[1] == "desc"
