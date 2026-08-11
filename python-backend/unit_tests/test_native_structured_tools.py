from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any

import pytest

from services.structured_query import (
    APPROVED_SURFACES,
    StructuredQueryError,
    StructuredQueryRequest,
    StructuredQueryResult,
    StructuredQueryService,
    validate_structured_sql,
)
from services.tool_registry import ToolExecutionContext, ToolRegistry


@dataclass
class _Response:
    data: Any


class _Query:
    def __init__(self, client: "_Client", table_name: str) -> None:
        self.client = client
        self.table_name = table_name
        self.operations: list[tuple[str, Any]] = []

    def select(self, columns: str) -> "_Query":
        self.operations.append(("select", columns))
        return self

    def eq(self, column: str, value: Any) -> "_Query":
        self.operations.append(("eq", (column, value)))
        return self

    def gte(self, column: str, value: Any) -> "_Query":
        self.operations.append(("gte", (column, value)))
        return self

    def lte(self, column: str, value: Any) -> "_Query":
        self.operations.append(("lte", (column, value)))
        return self

    def order(self, column: str, *, desc: bool = False) -> "_Query":
        self.operations.append(("order", (column, desc)))
        return self

    def limit(self, value: int) -> "_Query":
        self.operations.append(("limit", value))
        return self

    def insert(self, value: Any) -> "_Query":
        self.operations.append(("insert", value))
        return self

    def update(self, value: Any) -> "_Query":
        self.operations.append(("update", value))
        return self

    def execute(self) -> _Response:
        self.client.calls.append((self.table_name, list(self.operations)))
        if any(operation == "insert" for operation, _value in self.operations):
            configured = self.client.responses.get(self.table_name, [{"id": "query-1"}])
            return _Response(configured)
        if any(operation == "update" for operation, _value in self.operations):
            configured = self.client.responses.get(self.table_name, [])
            return _Response(configured)
        configured = self.client.responses[self.table_name]
        if isinstance(configured, BaseException):
            raise configured
        return _Response(configured)


class _Client:
    def __init__(self, responses: dict[str, Any]) -> None:
        self.responses = responses
        self.calls: list[tuple[str, list[tuple[str, Any]]]] = []

    def table(self, table_name: str) -> _Query:
        return _Query(self, table_name)


def _context(client: _Client) -> ToolExecutionContext:
    store = SimpleNamespace(client=client)
    return ToolExecutionContext(
        user_id="founder-1",
        store=store,
        thread_id="thread-1",
        metadata={"tool_call_id": "tool-1"},
    )


def _dataset() -> dict[str, Any]:
    return {
        "id": "00000000-0000-0000-0000-000000000111",
        "user_id": "founder-1",
        "source_document_id": None,
        "dataset_name": "Monthly P&L",
        "dataset_type": "profit_and_loss",
        "status": "ready",
        "summary": "Monthly financial series.",
        "confidence": 0.98,
        "provenance": {"source_file_name": "northlight-pnl.csv", "ingested_by": "seed"},
        "metadata": {"currency": "USD"},
    }


def _row(index: int, *, normalized: bool = True) -> dict[str, Any]:
    return {
        "id": f"00000000-0000-0000-0000-{index:012d}",
        "dataset_id": _dataset()["id"],
        "row_label": "Revenue",
        "period_start": f"2026-0{index}-01",
        "period_end": f"2026-0{index}-28",
        "period_grain": "month",
        "entity_name": "Client A" if index < 3 else "Client B",
        "values": {"revenue": index * 100},
        "normalized_values": {"revenue_usd": index * 1000, "delivery_cost_usd": index * 100} if normalized else {},
        "provenance": {"sheet": "P&L", "row": index},
    }


def test_structured_tool_contracts_and_authority_descriptions() -> None:
    registry = ToolRegistry()
    for name in ("list_founder_datasets", "get_dataset_periods", "run_structured_query"):
        definition = registry.get(name)
        assert definition.persistence_semantics == "read_only"
        assert definition.citation["source_kind"] == "founder_dataset"
        assert definition.capability_hints == ["structured_data_agent"]
        assert {"virtual_cso", "domain_agent"}.issubset(definition.surface_tags)
        assert "Authoritative" in definition.description

    for name in ("kb_ls", "kb_tree", "kb_grep", "kb_glob", "kb_read", "wiki_search", "wiki_get_page", "wiki_list"):
        assert "authoritative" in registry.get(name).description.lower()


def test_list_founder_datasets_preserves_summary_findings_and_reports_truncation() -> None:
    client = _Client({"founder_datasets": [_dataset(), {**_dataset(), "id": "00000000-0000-0000-0000-000000000222"}]})
    result = ToolRegistry(supabase_client=client).execute(
        "list_founder_datasets",
        _context(client),
        {"limit": 1},
    )

    structured = result.content["structured_result"]
    assert structured["schema_version"] == "agent_result_v1"
    assert structured["reasoning_visibility"] == "summary_only"
    assert structured["truncated"] is True
    assert structured["returned_count"] == 1
    assert structured["findings"][0]["type"] == "dataset_summary"
    assert structured["findings"][0]["provenance"] == {"source_file_name": "northlight-pnl.csv", "ingested_by": "seed"}
    assert result.sources[0].source_kind == "founder_dataset"
    assert result.sources[0].metadata["dataset_provenance"] == {
        "source_file_name": "northlight-pnl.csv",
        "ingested_by": "seed",
    }
    assert ("eq", ("user_id", "founder-1")) in client.calls[0][1]


def test_get_dataset_periods_double_scopes_prefers_normalized_and_exposes_truncation() -> None:
    client = _Client(
        {
            "founder_datasets": [_dataset()],
            "founder_dataset_rows": [_row(1), _row(2, normalized=False), _row(3)],
        }
    )
    result = ToolRegistry(supabase_client=client).execute(
        "get_dataset_periods",
        _context(client),
        {
            "dataset_id": _dataset()["id"],
            "period_start": "2026-01-01",
            "period_end": "2026-03-31",
            "limit": 2,
        },
    )

    structured = result.content["structured_result"]
    row_findings = [item for item in structured["findings"] if item["type"] == "dataset_row"]
    assert structured["truncated"] is True
    assert structured["requested_limit"] == 2
    assert row_findings[0]["values"] == {"revenue_usd": 1000, "delivery_cost_usd": 100}
    assert row_findings[1]["values"] == {"revenue": 200}
    assert row_findings[0]["provenance"] == {"sheet": "P&L", "row": 1}
    row_call = next(operations for table, operations in client.calls if table == "founder_dataset_rows")
    assert ("eq", ("user_id", "founder-1")) in row_call
    assert ("eq", ("dataset_id", _dataset()["id"])) in row_call
    assert ("gte", ("period_end", "2026-01-01")) in row_call
    assert ("lte", ("period_start", "2026-03-31")) in row_call
    assert ("limit", 3) in row_call


def test_get_dataset_periods_surfaces_row_failures_as_findings() -> None:
    client = _Client(
        {
            "founder_datasets": [_dataset()],
            "founder_dataset_rows": RuntimeError("database unavailable"),
        }
    )
    result = ToolRegistry(supabase_client=client).execute(
        "get_dataset_periods",
        _context(client),
        {"dataset_id": _dataset()["id"]},
    )

    structured = result.content["structured_result"]
    assert structured["needs_review"] is True
    assert any(item["type"] == "dataset_row_error" for item in structured["findings"])


def test_run_structured_query_validates_before_service_and_returns_agent_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    class _Service:
        def __init__(self, store: Any) -> None:
            captured["store"] = store

        def execute(self, payload: Any) -> StructuredQueryResult:
            captured["payload"] = payload
            return StructuredQueryResult(
                accepted=True,
                status="executed",
                query_id="query-1",
                rows=[
                    {
                        "dataset_id": _dataset()["id"],
                        "period_start": "2026-01-01",
                        "period_end": "2026-01-31",
                        "normalized_values": {"revenue": 1000},
                        "provenance": {"sheet": "P&L"},
                    }
                ],
                execution_ms=12,
            )

    monkeypatch.setattr("services.structured_query.StructuredQueryService", _Service)
    client = _Client({})
    result = ToolRegistry(supabase_client=client).execute(
        "run_structured_query",
        _context(client),
        {
            "question": "What was revenue?",
            "generated_sql": (
                "select dataset_id,period_start,period_end,normalized_values,provenance "
                f"from founder_dataset_rows where dataset_id = '{_dataset()['id']}' limit 5"
            ),
            "max_rows": 5,
        },
    )

    structured = result.content["structured_result"]
    assert structured["schema_version"] == "agent_result_v1"
    assert structured["query_id"] == "query-1"
    assert structured["row_count"] == 1
    assert structured["truncated"] is False
    assert captured["payload"].user_id == "founder-1"
    assert result.sources[0].source_id == _dataset()["id"]


def test_aggregate_query_shape_validates_with_whitelisted_group_and_function() -> None:
    validated = validate_structured_sql(
        (
            "select period_start, sum((normalized_values->>'revenue_usd')::numeric) as total_revenue, "
            "count(*) as row_count from founder_dataset_rows "
            f"where dataset_id = '{_dataset()['id']}' group by period_start order by period_start limit 10"
        )
    )

    assert validated["query_kind"] == "aggregate"
    assert validated["group_by"] == ["period_start"]
    assert validated["aggregates"] == [
        {"function": "sum", "value_key": "revenue_usd", "alias": "total_revenue"},
        {"function": "count", "value_key": None, "alias": "row_count"},
    ]
    assert validated["filters"] == {"dataset_id": _dataset()["id"]}


def test_aggregate_query_shape_allows_client_dimension_without_retrieving_percentages() -> None:
    validated = validate_structured_sql(
        (
            "select period_start, client_name, sum((normalized_values->>'revenue_usd')::numeric) as total_revenue "
            "from founder_dataset_rows group by period_start, client_name order by period_start limit 25"
        )
    )

    assert validated["query_kind"] == "aggregate"
    assert validated["group_by"] == ["period_start", "client_name"]
    assert validated["aggregates"] == [
        {"function": "sum", "value_key": "revenue_usd", "alias": "total_revenue"}
    ]


def test_aggregate_query_shape_accepts_multiline_order_after_client_group() -> None:
    validated = validate_structured_sql(
        (
            "select client_name, sum((normalized_values->>'revenue_usd')::numeric) as total_revenue "
            "from founder_dataset_rows where period_start = '2026-06-01' group by client_name\n"
            "order by total_revenue desc limit 10"
        )
    )

    assert validated["filters"]["period_start"] == "2026-06-01"
    assert validated["group_by"] == ["client_name"]
    assert validated["order_column"] == "total_revenue"
    assert validated["order_desc"] is True


def test_aggregate_query_shape_accepts_cast_syntax_for_same_whitelisted_value_key() -> None:
    validated = validate_structured_sql(
        (
            "select client_name, sum(cast(normalized_values->>'revenue_usd' as numeric)) as total_revenue "
            "from founder_dataset_rows group by client_name order by total_revenue desc limit 10"
        )
    )

    assert validated["group_by"] == ["client_name"]
    assert validated["aggregates"] == [
        {"function": "sum", "value_key": "revenue_usd", "alias": "total_revenue"}
    ]


@pytest.mark.parametrize(
    "sql, message",
    [
        (
            "select period_start, ratio(normalized_values->>'revenue_usd') as share "
            "from founder_dataset_rows group by period_start",
            "Query shape is not approved",
        ),
        (
            "select created_at, sum(normalized_values->>'revenue_usd') as total_revenue "
            "from founder_dataset_rows group by created_at",
            "GROUP BY column is not approved",
        ),
        (
            "select period_start, sum(values->>'revenue_usd') as total_revenue "
            "from founder_dataset_rows group by period_start",
            "Only approved aggregate expressions",
        ),
    ],
)
def test_aggregate_query_shape_rejects_non_whitelisted_shapes(sql: str, message: str) -> None:
    with pytest.raises(StructuredQueryError, match=message):
        validate_structured_sql(sql)


def test_structured_query_service_executes_aggregate_with_input_provenance() -> None:
    non_contributing_row = {
        **_row(1),
        "id": "00000000-0000-0000-0000-000000000901",
        "normalized_values": {"net_revenue": 45000},
        "provenance": {"sheet": "P&L", "row": "seed-marker"},
    }
    client = _Client(
        {
            "founder_dataset_queries": [{"id": "query-1"}],
            "founder_dataset_query_results": [],
            "founder_dataset_rows": [_row(1), non_contributing_row, _row(2), _row(3)],
        }
    )
    service = StructuredQueryService(SimpleNamespace(client=client))

    result = service.execute(
        StructuredQueryRequest(
            user_id="founder-1",
            question="Revenue by month",
            generated_sql=(
                "select period_start, sum((normalized_values->>'revenue_usd')::numeric) as total_revenue, "
                "count(*) as row_count "
                f"from founder_dataset_rows where dataset_id = '{_dataset()['id']}' "
                "group by period_start order by period_start limit 5"
            ),
        )
    )

    assert result.accepted is True
    assert [row["total_revenue"] for row in result.rows] == [1000, 2000, 3000]
    assert [row["row_count"] for row in result.rows] == [2, 1, 1]
    assert result.rows[0]["provenance"]["provenance_kind"] == "aggregate_inputs"
    assert result.rows[0]["provenance"]["dataset_ids"] == [_dataset()["id"]]
    assert result.rows[0]["provenance"]["rows_in_scope_count"] == 2
    assert result.rows[0]["provenance"]["source_row_count"] == 2
    assert result.rows[0]["aggregate"]["functions"][0]["contributing_row_count"] == 1
    assert result.rows[0]["provenance"]["aggregates"][0]["contributing_row_count"] == 1
    assert result.rows[0]["provenance"]["aggregates"][1]["contributing_row_count"] == 2
    row_call = next(operations for table, operations in client.calls if table == "founder_dataset_rows")
    assert ("eq", ("user_id", "founder-1")) in row_call
    assert ("eq", ("dataset_id", _dataset()["id"])) in row_call


def test_structured_query_service_groups_aggregate_by_client_provenance_dimension() -> None:
    client_a_1 = {
        **_row(1),
        "provenance": {"sheet": "P&L", "row": 1, "client_name": "Client A"},
    }
    client_a_2 = {
        **_row(2),
        "provenance": {"sheet": "P&L", "row": 2, "client_name": "Client A"},
    }
    client_b = {
        **_row(4),
        "provenance": {"sheet": "P&L", "row": 4, "client_name": "Client B"},
    }
    client = _Client(
        {
            "founder_dataset_queries": [{"id": "query-1"}],
            "founder_dataset_query_results": [],
            "founder_dataset_rows": [client_a_1, client_a_2, client_b],
        }
    )
    service = StructuredQueryService(SimpleNamespace(client=client))

    result = service.execute(
        StructuredQueryRequest(
            user_id="founder-1",
            question="Revenue by client",
            generated_sql=(
                "select client_name, sum((normalized_values->>'revenue_usd')::numeric) as total_revenue "
                "from founder_dataset_rows group by client_name order by total_revenue desc limit 5"
            ),
        )
    )

    assert result.accepted is True
    assert [(row["client_name"], row["total_revenue"]) for row in result.rows] == [
        ("Client B", 4000),
        ("Client A", 3000),
    ]
    assert result.rows[0]["aggregate"]["group_by"] == ["client_name"]
    assert result.rows[0]["provenance"]["group_by"] == ["client_name"]


def test_run_structured_query_does_not_invoke_service_for_invalid_sql(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _Service:
        def __init__(self, _store: Any) -> None:
            raise AssertionError("service must not be constructed before validation")

    monkeypatch.setattr("services.structured_query.StructuredQueryService", _Service)
    client = _Client({})
    with pytest.raises(StructuredQueryError):
        ToolRegistry(supabase_client=client).execute(
            "run_structured_query",
            _context(client),
            {"question": "Delete it", "generated_sql": "delete from founder_dataset_rows"},
        )


def test_structured_query_surface_refusal_names_the_approved_surfaces() -> None:
    with pytest.raises(StructuredQueryError) as exc_info:
        validate_structured_sql("select * from invented_financial_surface limit 5")

    message = str(exc_info.value)
    assert "unapproved dataset surface" in message
    assert all(surface in message for surface in APPROVED_SURFACES)


def test_run_structured_query_description_limits_when_it_is_appropriate() -> None:
    definition = ToolRegistry().get("run_structured_query")

    assert "aggregation across many rows" in definition.description
    assert "complete, untruncated bounded read" in definition.description
