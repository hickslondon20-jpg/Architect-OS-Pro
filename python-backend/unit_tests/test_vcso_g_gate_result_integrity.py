"""Focused G-gate regression tests for parent result integrity."""

from __future__ import annotations

import inspect
from types import SimpleNamespace

from services.vcso_chat_service import VcsoChatService


class _UpdateQuery:
    def __init__(self, client, values):
        self.client = client
        self.values = values

    def eq(self, *_args):
        return self

    def execute(self):
        self.client.updates.append(self.values)
        return SimpleNamespace(data=[self.values])


class _Table:
    def __init__(self, client):
        self.client = client

    def update(self, values):
        return _UpdateQuery(self.client, values)


class _Client:
    def __init__(self):
        self.updates = []

    def table(self, _name):
        return _Table(self)


def test_complete_main_run_persists_exact_g_gate_parent_attribution():
    client = _Client()
    service = VcsoChatService.__new__(VcsoChatService)
    service.supabase = client
    run_metadata = {
        "output_schema_version": "vcso_tool_loop_v1",
        "reasoning_visibility": "summary_only",
        "deep_mode": False,
        "sdk_native_lifecycle": [{"event": "runtime_manifest", "decision": "model_driven"}],
        "sdk_phase": "04B-G-GATE",
        "native_subagent_scope": "g_gate_model_choice",
        "delegation_selection": "model_choice",
        "available_subagents": [
            "structured_data_agent",
            "sandbox_execution_agent",
            "per_user_wiki",
        ],
        "required_subagents": [],
    }

    service._complete_main_run(
        "parent-run-1",
        "user-1",
        "assistant-1",
        "Bounded result.",
        [],
        result_schema_version="vcso_sdk_native_subagents_v1",
        metadata={"sdk_session_id": "session-1"},
        run_metadata=run_metadata,
    )

    run_update = client.updates[-1]
    assert run_update["metadata"] == run_metadata
    assert run_update["structured_result"]["sdk_session_id"] == "session-1"


def test_sdk_completion_caller_passes_attribution_and_lifecycle_to_run_metadata():
    source = inspect.getsource(VcsoChatService._stream_chat_impl)
    planner_branch = source.split("if planner_result is not None:", 1)[1].split("sdk_settings =", 1)[0]
    sdk_branch = source.split("if sdk_mode:", 1)[1]

    assert "sdk_run_attribution =" not in planner_branch
    assert "sdk_run_attribution =" in sdk_branch
    assert "run_metadata={" in sdk_branch
    assert '"sdk_native_lifecycle": final_sdk_lifecycle' in sdk_branch
    lifecycle_writer = sdk_branch.split("def persist_sdk_lifecycle", 1)[1].split("def record_sdk_usage", 1)[0]
    assert "**sdk_run_attribution" in lifecycle_writer
