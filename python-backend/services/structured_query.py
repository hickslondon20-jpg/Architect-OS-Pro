"""Fail-closed read-only query tool for approved founder dataset surfaces."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
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
AGGREGATE_FUNCTIONS = {"sum", "count", "avg", "min", "max"}
AGGREGATE_VALUE_KEYS = {
    "revenue_usd",
    "delivery_cost_usd",
    "net_revenue",
    "net_income",
}
AGGREGATE_GROUP_ENUM = {
    "dataset_id": "dataset_id",
    "table_id": "table_id",
    "period_start": "period_start",
    "period_end": "period_end",
    "period_grain": "period_grain",
    "client": "entity_name",
    "client_name": "entity_name",
    "entity_name": "entity_name",
    "row_label": "row_label",
}
AGGREGATE_SOURCE_COLUMNS = (
    "id,dataset_id,table_id,row_label,period_start,period_end,period_grain,"
    "entity_name,normalized_values,provenance"
)
AGGREGATE_SOURCE_ROW_CAP = 5000
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
EQUALITY_RE = re.compile(
    r"\b(?P<column>dataset_id|table_id|period_start|period_end|period_grain|entity_name|row_label)\s*=\s*'(?P<value>[^']*)'",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class StructuredQueryRequest:
    user_id: str
    question: str
    generated_sql: str
    thread_id: str | None = None
    tool_call_id: str | None = None
    max_rows: int = 25


@dataclass(frozen=True)
class AggregateMetricRequest:
    function: str
    value_key: str | None = None


@dataclass(frozen=True)
class TypedAggregateRequest:
    user_id: str
    question: str
    dataset_id: str
    group_by: list[str]
    metrics: list[AggregateMetricRequest]
    period_start: str | None = None
    period_end: str | None = None
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
            metadata={
                "limit": validated["limit"],
                "filters": validated["filters"],
                "query_kind": validated.get("query_kind", "row"),
                "aggregate": {
                    "group_by": validated.get("group_by", []),
                    "aggregates": validated.get("aggregates", []),
                }
                if validated.get("query_kind") == "aggregate"
                else None,
            },
        )
        self._store_result(query_id, payload.user_id, rows)
        return StructuredQueryResult(
            accepted=True,
            status="executed",
            query_id=query_id,
            rows=rows,
            execution_ms=execution_ms,
        )

    def execute_typed_aggregate(self, payload: TypedAggregateRequest) -> StructuredQueryResult:
        validated = validate_typed_aggregate(payload)
        query_id = self._create_audit(
            StructuredQueryRequest(
                user_id=payload.user_id,
                question=payload.question,
                generated_sql="typed:aggregate_founder_dataset",
                thread_id=payload.thread_id,
                tool_call_id=payload.tool_call_id,
                max_rows=payload.max_rows,
            )
        )
        started = time.perf_counter()
        try:
            rows = self._execute_aggregate(payload.user_id, validated)
        except Exception as exc:
            message = str(exc)
            self._update_audit(query_id, payload.user_id, status="failed", rejection_reason=message[:1000])
            raise StructuredQueryError(f"Typed aggregate execution failed: {message}") from exc

        execution_ms = int((time.perf_counter() - started) * 1000)
        self._update_audit(
            query_id,
            payload.user_id,
            status="executed",
            approved_query_surface=validated["surface"],
            execution_ms=execution_ms,
            row_count=len(rows),
            metadata={
                "limit": validated["limit"],
                "filters": validated["filters"],
                "range_filters": validated.get("range_filters", {}),
                "query_kind": "typed_aggregate",
                "aggregate": {
                    "requested_group_by": validated.get("requested_group_by", []),
                    "group_by": validated.get("group_by", []),
                    "aggregates": validated.get("aggregates", []),
                },
            },
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
        if validated.get("query_kind") == "aggregate":
            return self._execute_aggregate(user_id, validated)

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

    def _execute_aggregate(self, user_id: str, validated: dict[str, Any]) -> list[dict[str, Any]]:
        query = (
            self.store.client.table(validated["surface"])
            .select(AGGREGATE_SOURCE_COLUMNS)
            .eq("user_id", user_id)
            .limit(AGGREGATE_SOURCE_ROW_CAP + 1)
        )
        for column, value in validated["filters"].items():
            query = query.eq(column, value)
        range_filters = validated.get("range_filters") or {}
        if range_filters.get("period_start"):
            query = query.gte("period_end", range_filters["period_start"])
        if range_filters.get("period_end"):
            query = query.lte("period_start", range_filters["period_end"])
        response = query.execute()
        source_rows = list(response.data or [])
        if len(source_rows) > AGGREGATE_SOURCE_ROW_CAP:
            raise StructuredQueryError(
                f"Aggregate input row cap exceeded ({AGGREGATE_SOURCE_ROW_CAP}); add approved filters."
            )

        group_columns = list(validated["group_by"])
        grouped: dict[tuple[Any, ...], list[dict[str, Any]]] = {}
        for row in source_rows:
            key = tuple(_group_value(row, column) for column in group_columns) if group_columns else ("__all__",)
            grouped.setdefault(key, []).append(row)

        result_rows: list[dict[str, Any]] = []
        for key, rows in grouped.items():
            result: dict[str, Any] = {
                column: key[index] for index, column in enumerate(group_columns)
            }
            if "dataset_id" not in result and len({row.get("dataset_id") for row in rows}) == 1:
                result["dataset_id"] = rows[0].get("dataset_id")
            for aggregate in validated["aggregates"]:
                result[aggregate["alias"]] = _compute_aggregate(rows, aggregate)
            result["aggregate"] = {
                "functions": [
                    {
                        "function": aggregate["function"],
                        "value_key": aggregate.get("value_key"),
                        "alias": aggregate["alias"],
                        "contributing_row_count": _aggregate_contribution_count(rows, aggregate),
                    }
                    for aggregate in validated["aggregates"]
                ],
                "group_by": group_columns,
            }
            provenance = _aggregate_provenance(
                rows,
                surface=validated["surface"],
                filters=validated["filters"],
                group_by=group_columns,
                aggregates=validated["aggregates"],
            )
            result["provenance"] = provenance
            result.setdefault("period_start", provenance.get("period_start"))
            result.setdefault("period_end", provenance.get("period_end"))
            result_rows.append(result)

        order_column = validated.get("order_column")
        if order_column:
            result_rows.sort(
                key=lambda row: (row.get(order_column) is None, row.get(order_column)),
                reverse=bool(validated.get("order_desc")),
            )
        return result_rows[: validated["limit"]]

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
        approved = ", ".join(sorted(APPROVED_SURFACES))
        raise StructuredQueryError(
            f"Query references an unapproved dataset surface. Approved surfaces: {approved}."
        )

    columns = _parse_columns(match.group("columns"), surface=surface)
    limit = min(int(match.group("limit") or max_rows), max(1, max_rows))
    filters = _parse_filters(match.group("where") or "")
    order_column, order_desc = _parse_order(match.group("order"))
    return {
        "surface": surface,
        "query_kind": "row",
        "columns": columns,
        "limit": limit,
        "filters": filters,
        "order_column": order_column,
        "order_desc": order_desc,
    }


def validate_typed_aggregate(payload: TypedAggregateRequest) -> dict[str, Any]:
    dataset_id = payload.dataset_id.strip()
    if not dataset_id:
        raise StructuredQueryError("dataset_id is required.")
    limit = min(payload.max_rows, 100)
    if limit < 1:
        raise StructuredQueryError("limit must be at least 1.")

    group_by: list[str] = []
    requested_group_by: list[str] = []
    for raw_group in payload.group_by:
        requested = str(raw_group or "").strip()
        mapped = AGGREGATE_GROUP_ENUM.get(requested)
        if not mapped:
            raise StructuredQueryError(f"Aggregate group_by value is not approved: {requested}")
        requested_group_by.append(requested)
        group_by.append(mapped)
    if len(set(group_by)) != len(group_by):
        raise StructuredQueryError("Aggregate group_by values must be unique after mapping.")

    if not payload.metrics:
        raise StructuredQueryError("At least one aggregate metric is required.")
    if len(payload.metrics) > 5:
        raise StructuredQueryError("Typed aggregate queries may request at most five metrics.")

    aggregates: list[dict[str, Any]] = []
    seen_aliases: set[str] = set()
    for metric in payload.metrics:
        function = str(metric.function or "").strip().lower()
        value_key = str(metric.value_key).strip() if metric.value_key is not None else None
        if function not in AGGREGATE_FUNCTIONS:
            raise StructuredQueryError(f"Aggregate function is not approved: {function}")
        if function == "count" and value_key in {"", "*"}:
            value_key = None
        if function != "count" and not value_key:
            raise StructuredQueryError(f"{function} requires an approved value_key.")
        if value_key is not None and value_key not in AGGREGATE_VALUE_KEYS:
            raise StructuredQueryError(f"Aggregate value_key is not approved: {value_key}")
        alias = _aggregate_alias(function, value_key)
        if alias in seen_aliases:
            raise StructuredQueryError(f"Duplicate aggregate metric requested: {alias}")
        seen_aliases.add(alias)
        aggregates.append({"function": function, "value_key": value_key, "alias": alias})

    return {
        "surface": "founder_dataset_rows",
        "query_kind": "aggregate",
        "columns": [],
        "limit": limit,
        "filters": {"dataset_id": dataset_id},
        "range_filters": {
            key: value
            for key, value in {
                "period_start": payload.period_start,
                "period_end": payload.period_end,
            }.items()
            if value
        },
        "order_column": None,
        "order_desc": False,
        "requested_group_by": requested_group_by,
        "group_by": group_by,
        "aggregates": aggregates,
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


def _aggregate_alias(function: str, value_key: str | None) -> str:
    return "row_count" if function == "count" and not value_key else f"{function}_{value_key}"


def _compute_aggregate(rows: list[dict[str, Any]], aggregate: dict[str, Any]) -> int | float | None:
    function = aggregate["function"]
    value_key = aggregate.get("value_key")
    if function == "count" and not value_key:
        return len(rows)

    values = [
        value
        for row in rows
        for value in [_numeric_value(row, str(value_key))]
        if value is not None
    ]
    if function == "count":
        return len(values)
    if not values:
        return None
    if function == "sum":
        return _json_number(sum(values, Decimal("0")))
    if function == "avg":
        return _json_number(sum(values, Decimal("0")) / Decimal(len(values)))
    if function == "min":
        return _json_number(min(values))
    if function == "max":
        return _json_number(max(values))
    raise StructuredQueryError(f"Aggregate function is not approved: {function}")


def _aggregate_contribution_count(rows: list[dict[str, Any]], aggregate: dict[str, Any]) -> int:
    if aggregate["function"] == "count" and not aggregate.get("value_key"):
        return len(rows)
    return sum(
        1 for row in rows if _numeric_value(row, str(aggregate.get("value_key"))) is not None
    )


def _numeric_value(row: dict[str, Any], key: str) -> Decimal | None:
    values = row.get("normalized_values")
    if not isinstance(values, dict) or key not in values or values.get(key) in (None, ""):
        return None
    raw = values.get(key)
    if isinstance(raw, str):
        raw = raw.replace(",", "").replace("$", "").strip()
    try:
        return Decimal(str(raw))
    except (InvalidOperation, ValueError):
        return None


def _group_value(row: dict[str, Any], column: str) -> Any:
    if column != "client_name":
        return row.get(column)
    provenance = row.get("provenance")
    if isinstance(provenance, dict) and provenance.get("client_name"):
        return provenance.get("client_name")
    normalized_values = row.get("normalized_values")
    if isinstance(normalized_values, dict) and normalized_values.get("client_name"):
        return normalized_values.get("client_name")
    values = row.get("values")
    if isinstance(values, dict):
        return values.get("client_name")
    return None


def _json_number(value: Decimal) -> int | float:
    if value == value.to_integral_value():
        return int(value)
    return float(value)


def _aggregate_provenance(
    rows: list[dict[str, Any]],
    *,
    surface: str,
    filters: dict[str, str],
    group_by: list[str],
    aggregates: list[dict[str, Any]],
) -> dict[str, Any]:
    period_starts = [row.get("period_start") for row in rows if row.get("period_start")]
    period_ends = [row.get("period_end") for row in rows if row.get("period_end")]
    dataset_ids = sorted({str(row.get("dataset_id")) for row in rows if row.get("dataset_id")})
    table_ids = sorted({str(row.get("table_id")) for row in rows if row.get("table_id")})
    period_grains = sorted({str(row.get("period_grain")) for row in rows if row.get("period_grain")})
    return {
        "provenance_kind": "aggregate_inputs",
        "input_surface": surface,
        "filters": filters,
        "dataset_ids": dataset_ids,
        "table_ids": table_ids,
        "period_start": min(period_starts) if period_starts else None,
        "period_end": max(period_ends) if period_ends else None,
        "period_grains": period_grains,
        "rows_in_scope_count": len(rows),
        "source_row_count": len(rows),
        "source_row_ids": [row.get("id") for row in rows[:100] if row.get("id")],
        "source_row_ids_truncated": len(rows) > 100,
        "group_by": group_by,
        "aggregates": [
            {
                "function": aggregate["function"],
                "value_key": aggregate.get("value_key"),
                "alias": aggregate["alias"],
                "contributing_row_count": _aggregate_contribution_count(rows, aggregate),
            }
            for aggregate in aggregates
        ],
        "row_provenance_sample": [
            row.get("provenance") for row in rows[:5] if isinstance(row.get("provenance"), dict)
        ],
    }
