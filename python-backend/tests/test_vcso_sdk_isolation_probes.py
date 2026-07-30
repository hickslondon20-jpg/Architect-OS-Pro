import pytest

from services.tool_registry import ToolExecutionContext, ToolRegistry
from services.vcso_sdk_loop import (
    SDK_TOOL_PREFIX,
    founder_isolation_probe_dataset_id,
    founder_isolation_probe_decision,
    granular_cross_worker_probe_decision,
    granular_cross_worker_probe_enabled,
)


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_user():
    yield


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, rows):
        self._rows = list(rows)
        self._filters = []
        self._limit = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self._filters.append((key, value))
        return self

    def gte(self, *_args, **_kwargs):
        return self

    def lte(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, value):
        self._limit = value
        return self

    def execute(self):
        rows = [
            row
            for row in self._rows
            if all(str(row.get(key)) == str(value) for key, value in self._filters)
        ]
        if self._limit is not None:
            rows = rows[: self._limit]
        return _FakeResult(rows)


class _FakeSupabase:
    def __init__(self):
        self._tables = {
            "founder_datasets": [
                {
                    "id": "owned-dataset",
                    "user_id": "founder-a",
                    "dataset_name": "Owned dataset",
                    "dataset_type": "financial",
                    "status": "active",
                    "summary": "Owned by founder A.",
                    "confidence": "high",
                    "metadata": {},
                },
                {
                    "id": "foreign-dataset",
                    "user_id": "founder-b",
                    "dataset_name": "Foreign dataset",
                    "dataset_type": "financial",
                    "status": "active",
                    "summary": "Owned by founder B.",
                    "confidence": "high",
                    "metadata": {},
                },
            ],
            "founder_dataset_rows": [
                {
                    "id": "row-1",
                    "user_id": "founder-a",
                    "dataset_id": "owned-dataset",
                    "row_label": "April",
                    "period_start": "2026-04-01",
                    "period_end": "2026-04-30",
                    "values": {"revenue": 1000},
                    "normalized_values": {},
                    "provenance": {"source": "fixture"},
                    "source_row_index": 1,
                },
                {
                    "id": "row-2",
                    "user_id": "founder-b",
                    "dataset_id": "foreign-dataset",
                    "row_label": "April",
                    "period_start": "2026-04-01",
                    "period_end": "2026-04-30",
                    "values": {"revenue": 9999},
                    "normalized_values": {},
                    "provenance": {"source": "fixture"},
                    "source_row_index": 1,
                },
            ],
        }

    def table(self, name):
        return _FakeQuery(self._tables[name])


def test_granular_cross_worker_probe_gate_is_dark_by_default():
    assert granular_cross_worker_probe_enabled({}, "founder-a") is False
    assert (
        granular_cross_worker_probe_enabled(
            {"diagnostic_granular_cross_worker_probe_enabled": True},
            "founder-a",
        )
        is False
    )


def test_granular_cross_worker_probe_gate_requires_diagnostic_allowlist():
    settings = {
        "diagnostic_granular_cross_worker_probe_enabled": True,
        "diagnostic_user_ids": ["founder-a"],
    }
    assert granular_cross_worker_probe_enabled(settings, "founder-a") is True
    assert granular_cross_worker_probe_enabled(settings, "founder-b") is False


def test_founder_isolation_probe_gate_requires_flag_allowlist_and_dataset_id():
    assert founder_isolation_probe_dataset_id({}, "founder-a") is None
    assert (
        founder_isolation_probe_dataset_id(
            {
                "diagnostic_founder_isolation_probe_enabled": True,
                "diagnostic_user_ids": ["founder-a"],
            },
            "founder-a",
        )
        is None
    )
    assert (
        founder_isolation_probe_dataset_id(
            {
                "diagnostic_founder_isolation_probe_enabled": True,
                "diagnostic_user_ids": ["founder-a"],
                "diagnostic_founder_isolation_dataset_id": "foreign-dataset",
            },
            "founder-a",
        )
        == "foreign-dataset"
    )


def test_granular_cross_worker_probe_refuses_sibling_tool_and_allows_owned_tool():
    grants = {
        "structured_data_agent": {"list_founder_datasets", "get_dataset_periods"},
        "per_user_wiki": {"wiki_search", "wiki_get_page", "wiki_list"},
    }
    deny_decision, deny_reason = granular_cross_worker_probe_decision(
        agent_type="structured_data_agent",
        sibling_tool_name=f"{SDK_TOOL_PREFIX}wiki_search",
        lead_tool_names={"wiki_list", "wiki_get_page", "get_dataset_periods", "execute_code"},
        agent_tool_grants=grants,
    )
    assert deny_decision == "refused"
    assert "not granted to structured_data_agent" in deny_reason

    allow_decision, allow_reason = granular_cross_worker_probe_decision(
        agent_type="structured_data_agent",
        sibling_tool_name=f"{SDK_TOOL_PREFIX}get_dataset_periods",
        lead_tool_names={"wiki_list", "wiki_get_page", "get_dataset_periods", "execute_code"},
        agent_tool_grants=grants,
    )
    assert allow_decision == "allowed"
    assert "within the compiled structured_data_agent delegation grant" in allow_reason


@pytest.mark.parametrize(
    ("dataset_id", "expected_decision"),
    [
        ("foreign-dataset", "refused"),
        ("owned-dataset", "LEAKED"),
    ],
)
def test_founder_isolation_probe_exercises_tool_layer(dataset_id, expected_decision):
    registry = ToolRegistry(supabase_client=object())
    context = ToolExecutionContext(
        user_id="founder-a",
        supabase_client=_FakeSupabase(),
        metadata={"capability_key": "structured_data_agent"},
    )

    decision, reason = founder_isolation_probe_decision(
        registry=registry,
        tool_context=context,
        dataset_id=dataset_id,
    )

    assert decision == expected_decision
    if expected_decision == "refused":
        assert "current founder" in reason
    else:
        assert "returned rows" in reason
