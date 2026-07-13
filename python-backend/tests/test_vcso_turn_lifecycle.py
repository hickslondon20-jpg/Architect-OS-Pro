from types import MethodType, SimpleNamespace

from services.agent_capabilities import AgentCapability
from services.agent_context import AgentContextBundle, AgentSourceRef
from services.sub_agent_orchestrator import SubAgentOrchestrator, SubAgentRunRequest
from services.vcso_chat_service import VcsoChatService, _failure_trace_step, _safe_internal_error


class _UpdateQuery:
    def __init__(self, client, table_name, values):
        self.client = client
        self.table_name = table_name
        self.values = values

    def eq(self, *_args):
        return self

    def in_(self, *_args):
        return self

    def execute(self):
        self.client.updates.append((self.table_name, self.values))
        return SimpleNamespace(data=[self.values])


class _SelectQuery:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *_args):
        return self

    def eq(self, *_args):
        return self

    def in_(self, *_args):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args):
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class _InsertQuery:
    def __init__(self, client, table_name, values):
        self.client = client
        self.table_name = table_name
        self.values = values

    def execute(self):
        self.client.inserts.append((self.table_name, self.values))
        return SimpleNamespace(data=[self.values])


class _Table:
    def __init__(self, client, name):
        self.client = client
        self.name = name

    def update(self, values):
        return _UpdateQuery(self.client, self.name, values)

    def insert(self, values):
        return _InsertQuery(self.client, self.name, values)

    def select(self, *_args):
        rows = self.client.rows_by_table.get(self.name)
        if rows is None:
            rows = [{"step_index": 1}] if self.name == "agent_delegation_steps" else []
        return _SelectQuery(rows)


class _Client:
    def __init__(self, rows_by_table=None):
        self.inserts = []
        self.updates = []
        self.rows_by_table = rows_by_table or {}

    def table(self, name):
        return _Table(self, name)


class _WrapperService(VcsoChatService):
    def __init__(self, mode):
        self.mode = mode
        self._active_turn = None
        self.recoveries = []

    def _stream_chat_impl(self, **_kwargs):
        self._active_turn = {"completed": False}
        if self.mode == "failure":
            raise RuntimeError("provider failed")
        yield {"event": "ready", "data": {}}
        yield {"event": "heartbeat", "data": {}}

    def _recover_failed_turn(self, _exc, *, terminal_status, emit_events):
        self.recoveries.append((terminal_status, emit_events))
        return [{"event": "done", "data": {}}] if emit_events else []


def _service_state(*, assistant_message=None, run_id=None, run_completed=False):
    return {
        "user_id": "user-1",
        "thread_id": "thread-1",
        "user_message": {"id": "user-message-1", "thread_id": "thread-1", "role": "user", "content": "Help"},
        "message_count_before": 0,
        "deep_mode": False,
        "run_id": run_id,
        "assistant_message": assistant_message,
        "trace_steps": [],
        "ready_emitted": False,
        "run_completed": run_completed,
        "completed": False,
    }


def test_failed_turn_recovery_persists_assistant_and_returns_terminal_done():
    service = VcsoChatService.__new__(VcsoChatService)
    service._active_turn = _service_state()
    inserted = []

    def insert_message(_self, thread_id, _user_id, role, content, **_kwargs):
        inserted.append((role, content))
        return {"id": "assistant-1", "thread_id": thread_id, "role": role, "content": content}

    service._insert_message = MethodType(insert_message, service)
    service._update_thread_count = MethodType(lambda *_args, **_kwargs: None, service)
    service._get_thread = MethodType(lambda *_args, **_kwargs: {"id": "thread-1", "title": "Test"}, service)

    events = service._recover_failed_turn(RuntimeError("provider unavailable"), terminal_status="failed", emit_events=True)

    assert inserted == [("assistant", "I couldn't complete that response. Your request was saved; please try again.")]
    assert [event["event"] for event in events] == ["ready", "done"]
    assert events[-1]["data"]["assistantMessage"]["id"] == "assistant-1"
    assert events[-1]["data"]["recoveredFailure"] is True


def test_stream_wrapper_converts_runtime_failure_to_terminal_done():
    service = _WrapperService("failure")

    events = list(service.stream_chat(user_id="user-1", payload=SimpleNamespace(), max_rounds=1))

    assert events == [{"event": "done", "data": {}}]
    assert service.recoveries == [("failed", True)]


def test_stream_wrapper_terminalizes_client_disconnect_without_emitting():
    service = _WrapperService("disconnect")
    stream = service.stream_chat(user_id="user-1", payload=SimpleNamespace(), max_rounds=1)

    assert next(stream)["event"] == "ready"
    stream.close()

    assert service.recoveries == [("cancelled", False)]


def test_failed_turn_recovery_reuses_existing_assistant_without_duplicate_insert():
    service = VcsoChatService.__new__(VcsoChatService)
    service._active_turn = _service_state(
        assistant_message={"id": "assistant-1", "thread_id": "thread-1", "role": "assistant", "content": "Completed answer"},
        run_id="run-1",
        run_completed=True,
    )
    service._insert_message = MethodType(lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("duplicate insert")), service)
    service._get_thread = MethodType(lambda *_args, **_kwargs: {"id": "thread-1", "title": "Test"}, service)

    events = service._recover_failed_turn(RuntimeError("late failure"), terminal_status="failed", emit_events=True)

    assert events[-1]["data"]["assistantMessage"]["content"] == "Completed answer"


def test_failure_trace_and_internal_error_are_curated():
    step = _failure_trace_step(step_index=3, terminal_status="failed")

    assert step["stepType"] == "error"
    assert step["status"] == "failed"
    assert "sk-supersecretvalue" not in _safe_internal_error(RuntimeError("key sk-supersecretvalue"))


def test_sub_agent_failure_marks_run_failed_and_adds_terminal_step():
    client = _Client()
    orchestrator = SubAgentOrchestrator.__new__(SubAgentOrchestrator)
    orchestrator.store = SimpleNamespace(client=client)

    orchestrator._fail_run("run-1", "user-1", RuntimeError("worker failed"))

    step_rows = [values for table, values in client.inserts if table == "agent_delegation_steps"]
    run_updates = [values for table, values in client.updates if table == "agent_delegation_runs"]
    assert step_rows[0]["step_index"] == 2
    assert step_rows[0]["status"] == "failed"
    assert run_updates[-1]["status"] == "failed"
    assert run_updates[-1]["completed_at"] is not None


def test_document_analysis_builds_scoped_progressive_steps_without_persisting_raw_content():
    chunk = {
        "id": "chunk-1",
        "user_id": "user-1",
        "document_id": "doc-1",
        "chunk_index": 0,
        "content": "Private founder evidence that must reach synthesis but not the visible step payload.",
        "metadata": {"document_title": "Agency overview"},
        "page_number": 1,
    }
    client = _Client({"document_chunks": [chunk]})
    orchestrator = SubAgentOrchestrator.__new__(SubAgentOrchestrator)
    orchestrator.store = SimpleNamespace(client=client)
    orchestrator._synthesize_document_analysis = MethodType(
        lambda _self, _context, _capability, _run_id, chunks, _thread_id: (
            "Founder dependence is the primary constraint [Evidence 1]."
            if chunks == [chunk]
            else ""
        ),
        orchestrator,
    )
    capability = AgentCapability(
        capability_key="document_analysis_agent",
        label="Document analysis",
        description="Scoped document analysis",
        status="experimental",
        allowed_surfaces=["virtual_cso"],
        allowed_tools=["retrieve_document_chunks", "read_raw_document_metadata"],
        allowed_source_kinds=["raw_document", "document_chunk"],
        default_config={"max_sources": 8},
    )
    document = {"id": "doc-1", "file_name": "Agency overview", "status": "ingested", "parser_status": "complete"}
    document_source = AgentSourceRef(source_kind="raw_document", source_id="doc-1", source_label="Agency overview")
    context = AgentContextBundle(
        user_id="user-1",
        parent_surface="virtual_cso",
        task_summary="Identify the operating constraint and support it with evidence.",
        context_scope={"document_ids": ["doc-1"]},
        documents=[document],
        sources=[document_source],
    )
    progress = []
    request = SubAgentRunRequest(
        user_id="user-1",
        parent_surface="virtual_cso",
        capability_key="document_analysis_agent",
        task_summary=context.task_summary,
        context_scope=context.context_scope,
        progress_callback=progress.append,
    )

    result = orchestrator._handle_document_analysis(context, capability, "run-1", request)

    step_rows = [values for table, values in client.inserts if table == "agent_delegation_steps"]
    assert [step["step_index"] for step in step_rows] == [2, 3, 4]
    assert [step["tool_name"] for step in step_rows] == [
        "plan_document_analysis",
        "read_raw_document_metadata",
        "retrieve_document_chunks",
    ]
    assert len(progress) == 7
    assert [event["step"]["status"] for event in progress[:2]] == ["running", "completed"]
    assert progress[-1]["step"]["title"] == "Synthesize document findings"
    assert progress[-1]["step"]["status"] == "running"
    assert result["_next_step_index"] == 5
    assert result["structured_result"]["retrieval_strategy"][0] == "Review scoped document metadata"
    assert "Founder dependence" in result["result_summary"]
    assert "Private founder evidence" not in str(step_rows)
