from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any

import pytest

from services.structured_query import (
    APPROVED_SURFACES,
    StructuredQueryError,
    StructuredQueryResult,
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

    def execute(self) -> _Response:
        self.client.calls.append((self.table_name, list(self.operations)))
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
        "metadata": {"currency": "USD"},
    }


def _row(index: int, *, normalized: bool = True) -> dict[str, Any]:
    return {
        "id": f"00000000-0000-0000-0000-{index:012d}",
        "dataset_id": _dataset()["id"],
        "row_label": "Revenue",
        "period_start": f"2026-0{index}-01",
        "period_end": f"2026-0{index}-28",
        "values": {"revenue": index * 100},
        "normalized_values": {"revenue": index * 1000} if normalized else {},
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
    assert result.sources[0].source_kind == "founder_dataset"
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
    assert row_findings[0]["values"] == {"revenue": 1000}
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
