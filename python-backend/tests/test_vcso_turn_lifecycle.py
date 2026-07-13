from types import MethodType, SimpleNamespace

from services.sub_agent_orchestrator import SubAgentOrchestrator
from services.vcso_chat_service import VcsoChatService, _failure_trace_step, _safe_internal_error


class _UpdateQuery:
    def __init__(self, client, table_name, values):
        self.client = client
        self.table_name = table_name
        self.values = values

    def eq(self, *_args):
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
        rows = [{"step_index": 1}] if self.name == "agent_delegation_steps" else []
        return _SelectQuery(rows)


class _Client:
    def __init__(self):
        self.inserts = []
        self.updates = []

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
