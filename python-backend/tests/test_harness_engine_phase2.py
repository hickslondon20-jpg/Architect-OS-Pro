from __future__ import annotations

import time
import uuid
import asyncio
from types import SimpleNamespace

from services import harness_handlers as _harness_handlers  # noqa: F401
from services.doc_wiki_agent_artifact_adapter import DocWikiAgentArtifactAdapter
from services.doc_wiki_synthesis import SynthesisResult
from services.harness_engine import HarnessEngine


USER_ID = str(uuid.uuid4())
AGENT_ID = str(uuid.uuid4())
WORKFLOW_ID = str(uuid.uuid4())


def test_trivial_programmatic_and_llm_single_workflow_reaches_review_and_writes_workspace():
    client = _FakeClient()
    _seed_workflow(
        client,
        [
            _step(1, "Prepare", "programmatic", workspace_output="prepared.md", output_schema={"content": "prepared"}),
            _step(
                2,
                "Summarize",
                "llm_single",
                workspace_inputs=["prepared.md"],
                workspace_output="summary.json",
                output_schema={
                    "type": "object",
                    "properties": {"summary": {"type": "string"}},
                    "required": ["summary"],
                    "additionalProperties": True,
                },
            ),
        ],
    )
    engine = HarnessEngine(client, anthropic_client=_FakeAnthropic({"summary": "LLM summary"}))
    task = engine.create_task(user_id=USER_ID, agent_id=AGENT_ID, workflow_id=WORKFLOW_ID, origin="profile")

    events = list(engine.run_task(user_id=USER_ID, task_id=task["id"]))

    assert [event["event"] for event in events] == [
        "task_ready",
        "task_step_start",
        "task_step_complete",
        "task_step_start",
        "task_step_complete",
        "task_review",
    ]
    fresh = client.one("tasks", task["id"])
    assert fresh["status"] == "review"
    assert fresh["current_step"] == 2
    assert fresh["step_results"]["1"]["workspace_path"] == "prepared.md"
    assert client.workspace_content(task["id"], "prepared.md") == "prepared"
    assert "LLM summary" in client.workspace_content(task["id"], "summary.json")
    assert client.usage_rows[0]["surface"] == "domain_agents"
    assert client.usage_rows[0]["role"] == "main"
    assert client.usage_rows[0]["task_id"] == task["id"]


def test_human_input_blocks_then_resumes_from_current_step():
    client = _FakeClient()
    _seed_workflow(
        client,
        [
            _step(
                1,
                "Ask",
                "llm_human_input",
                workspace_output="answer.md",
                output_schema={"question": "What month should this use?"},
            ),
            _step(2, "Finish", "programmatic", workspace_inputs=["answer.md"], workspace_output="done.md"),
        ],
    )
    engine = HarnessEngine(client, anthropic_client=_FakeAnthropic({"summary": "unused"}))
    task = engine.create_task(user_id=USER_ID, agent_id=AGENT_ID, workflow_id=WORKFLOW_ID, origin="profile")

    blocked_events = list(engine.run_task(user_id=USER_ID, task_id=task["id"]))
    assert blocked_events[-1]["event"] == "task_blocked"
    assert blocked_events[-1]["data"]["question"] == "What month should this use?"
    assert client.one("tasks", task["id"])["status"] == "blocked"
    assert client.one("tasks", task["id"])["current_step"] == 0

    engine.record_human_reply(user_id=USER_ID, task_id=task["id"], message="Use June 2026.")
    resumed_events = list(engine.run_task(user_id=USER_ID, task_id=task["id"]))

    assert [event["event"] for event in resumed_events] == [
        "task_ready",
        "task_step_start",
        "task_step_complete",
        "task_step_start",
        "task_step_complete",
        "task_review",
    ]
    assert client.one("tasks", task["id"])["current_step"] == 2
    assert client.workspace_content(task["id"], "answer.md") == "Use June 2026."


def test_batch_agents_run_concurrently_and_resume_from_partial_output():
    client = _FakeClient()
    _seed_workflow(
        client,
        [
            _step(
                1,
                "Batch",
                "llm_batch_agents",
                workspace_inputs=["items.json"],
                workspace_output="batch.json",
                capability_key="kb_explorer_agent",
                tools=["kb_ls", "kb_read"],
            )
        ],
    )
    task = _insert_task(client)
    client.upsert_workspace(task["id"], "items.json", '["a","b","c"]', source="upload")
    client.upsert_workspace(
        task["id"],
        "batch.json",
        '[{"item_index":0,"run_id":"existing","status":"completed","summary":"done a"}]',
        source="agent",
    )
    sub_agents = _FakeSubAgentFactory(delay_seconds=0.05)
    engine = HarnessEngine(
        client,
        anthropic_client=_FakeAnthropic({"summary": "unused"}),
        sub_agent_factory=sub_agents,
        registry_factory=lambda _capability: _FakeRegistry(["kb_ls", "kb_read"]),
    )

    events = list(engine.run_task(user_id=USER_ID, task_id=task["id"]))

    assert [event["event"] for event in events].count("task_batch_progress") == 2
    assert len(sub_agents.calls) == 2
    assert max(sub_agents.call_started_at) - min(sub_agents.call_started_at) < 0.035
    assert all(call.context_scope["allowed_tools"] == ["kb_ls", "kb_read"] for call in sub_agents.calls)
    assert client.one("tasks", task["id"])["step_results"]["1"]["output"]["resumed_from_partial"] is True
    assert client.one("tasks", task["id"])["status"] == "review"


def test_llm_agent_step_uses_registry_subset_plus_capability_scope():
    client = _FakeClient()
    _seed_workflow(
        client,
        [
            _step(
                1,
                "Delegate",
                "llm_agent",
                workspace_output="agent.json",
                capability_key="kb_explorer_agent",
                tools=["kb_ls", "kb_read", "execute_code"],
            )
        ],
    )
    sub_agents = _FakeSubAgentFactory()
    engine = HarnessEngine(
        client,
        anthropic_client=_FakeAnthropic({"summary": "unused"}),
        sub_agent_factory=sub_agents,
        registry_factory=lambda _capability: _FakeRegistry(["kb_ls", "kb_read"]),
    )
    task = engine.create_task(user_id=USER_ID, agent_id=AGENT_ID, workflow_id=WORKFLOW_ID, origin="profile")

    list(engine.run_task(user_id=USER_ID, task_id=task["id"]))

    assert sub_agents.calls[0].capability_key == "kb_explorer_agent"
    assert sub_agents.calls[0].context_scope["allowed_tools"] == ["kb_ls", "kb_read"]
    output = client.one("tasks", task["id"])["step_results"]["1"]["output"]
    assert output["allowed_tools"] == ["kb_ls", "kb_read"]
    assert "execute_code" not in output["allowed_tools"]


def test_get_task_state_reconstructs_resume_from_current_step_without_workspace_content():
    client = _FakeClient()
    _seed_workflow(
        client,
        [
            _step(1, "One", "programmatic", workspace_output="one.md"),
            _step(2, "Two", "programmatic", workspace_output="two.md"),
        ],
    )
    task = _insert_task(client, current_step=1)
    client.upsert_workspace(task["id"], "one.md", "secret large content", source="agent")
    engine = HarnessEngine(client, anthropic_client=_FakeAnthropic({"summary": "unused"}))

    state = engine.get_task_state(user_id=USER_ID, task_id=task["id"])

    assert state["resume"]["current_step"] == 1
    assert state["resume"]["next_step"]["name"] == "Two"
    assert state["workspace"] == [
        {
            "id": state["workspace"][0]["id"],
            "file_path": "one.md",
            "source": "agent",
            "size": len("secret large content"),
            "storage_path": None,
            "created_at": state["workspace"][0]["created_at"],
            "updated_at": state["workspace"][0]["updated_at"],
        }
    ]
    assert "content" not in state["workspace"][0]


def test_programmatic_handler_unknown_key_raises_harness_error_event():
    client = _FakeClient()
    _seed_workflow(
        client,
        [
            _step(
                1,
                "Unknown Handler",
                "programmatic",
                workspace_output="unknown.md",
                output_schema={"mode": "handler", "handler": "missing_handler"},
            )
        ],
    )
    engine = HarnessEngine(client, anthropic_client=_FakeAnthropic({"summary": "unused"}))
    task = engine.create_task(user_id=USER_ID, agent_id=AGENT_ID, workflow_id=WORKFLOW_ID, origin="profile")

    events = list(engine.run_task(user_id=USER_ID, task_id=task["id"]))

    assert events[-2]["event"] == "task_step_error"
    assert "Unknown programmatic handler" in events[-2]["data"]["error"]
    assert events[-1]["event"] == "task_error"


def test_pnl_anchor_workflow_blocks_for_upload_then_reaches_review_with_artifact_and_provenance():
    client = _FakeClient()
    source_ref = {"source_kind": "workspace_file", "source_id": "june-pnl.csv", "path": "june-pnl.csv"}
    _seed_workflow(
        client,
        [
            _step(
                1,
                "Prereq / Intake",
                "programmatic",
                workspace_output="pnl-source.md",
                output_schema={"mode": "handler", "handler": "pnl_intake"},
            ),
            _step(
                2,
                "Clarify Context",
                "llm_human_input",
                workspace_inputs=["pnl-source.md"],
                workspace_output="review-context.md",
                output_schema={"question": "What entity and period should I use?"},
            ),
            _step(
                3,
                "Analyze P&L",
                "llm_agent",
                workspace_inputs=["pnl-source.md", "review-context.md"],
                workspace_output="analysis.md",
                capability_key="document_analysis_agent",
            ),
            _step(
                4,
                "Synthesize Assessment",
                "llm_single",
                workspace_inputs=["analysis.md", "review-context.md"],
                workspace_output="assessment.md",
                output_schema={
                    "type": "object",
                    "properties": {
                        "summary": {"type": "string"},
                        "headline": {"type": "string"},
                        "findings": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
                        "risks": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
                        "questions": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
                        "source_refs": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
                    },
                    "required": ["summary", "headline", "findings", "risks", "questions", "source_refs"],
                    "additionalProperties": True,
                },
            ),
            _step(
                5,
                "Render Artifact",
                "programmatic",
                workspace_inputs=["assessment.md"],
                workspace_output="artifact.html",
                output_schema={"mode": "handler", "handler": "pnl_render"},
            ),
        ],
        key="produce_monthly_pnl_assessment",
        prereqs={"required": ["One or more monthly P&L documents"]},
    )
    sub_agents = _FakeSubAgentFactory(citations=[source_ref])
    engine = HarnessEngine(
        client,
        anthropic_client=_FakeAnthropic(
            {
                "summary": "Assessment synthesized.",
                "headline": "Revenue improved while margin needs review.",
                "findings": [{"summary": "Revenue rose in the uploaded month.", "source_refs": [source_ref]}],
                "risks": [{"summary": "Margin movement needs validation."}],
                "questions": [{"summary": "Which one-offs should be normalized?"}],
                "source_refs": [source_ref],
            }
        ),
        sub_agent_factory=sub_agents,
        registry_factory=lambda _capability: _FakeRegistry([]),
    )
    task = engine.create_task(user_id=USER_ID, agent_id=AGENT_ID, workflow_id=WORKFLOW_ID, origin="profile")

    blocked_events = list(engine.run_task(user_id=USER_ID, task_id=task["id"]))
    assert blocked_events[-1]["event"] == "task_blocked"
    assert "P&L" in blocked_events[-1]["data"]["question"]
    assert client.one("tasks", task["id"])["status"] == "blocked"

    engine.add_workspace_file(
        user_id=USER_ID,
        task_id=task["id"],
        file_path="june-pnl.csv",
        content="Account,June\nRevenue,120000\nExpenses,78000\nProfit,42000\n",
    )
    intake_events = list(engine.run_task(user_id=USER_ID, task_id=task["id"]))
    assert [event["event"] for event in intake_events] == [
        "task_ready",
        "task_step_start",
        "task_step_complete",
        "task_step_start",
        "task_blocked",
    ]
    assert "Revenue" in client.workspace_content(task["id"], "pnl-source.md")

    engine.record_human_reply(user_id=USER_ID, task_id=task["id"], message="Use June 2026 for the agency; compare to prior month.")
    final_events = list(engine.run_task(user_id=USER_ID, task_id=task["id"]))

    assert final_events[-1]["event"] == "task_review"
    fresh = client.one("tasks", task["id"])
    assert fresh["status"] == "review"
    assert fresh["current_step"] == 5
    assert "<h1>Produce a Monthly P&amp;L Assessment</h1>" in client.workspace_content(task["id"], "artifact.html")
    assert "Revenue improved while margin needs review" in client.workspace_content(task["id"], "artifact.html")
    assert fresh["step_results"]["3"]["source_refs"] == [source_ref]
    assert fresh["step_results"]["4"]["source_refs"] == [source_ref]
    assert fresh["step_results"]["5"]["source_refs"]
    artifacts = client.tables["artifacts"]
    assert len(artifacts) == 1
    assert artifacts[0]["source_kind"] == "domain_agent_task"
    assert artifacts[0]["task_id"] == task["id"]
    assert artifacts[0]["workflow_id"] == WORKFLOW_ID
    assert artifacts[0]["agent_id"] == AGENT_ID
    assert artifacts[0]["provenance"]["source_refs"]
    assert client.storage_download(artifacts[0]["storage_path"]).decode("utf-8").startswith("<!doctype html>")

    client.upsert_workspace(task["id"], "artifact.html", "<!doctype html><h1>Revised</h1>", source="agent")
    review_events = list(engine.run_task(user_id=USER_ID, task_id=task["id"]))

    assert review_events[-1]["event"] == "task_review"
    assert len(client.tables["artifacts"]) == 1
    assert client.tables["artifacts"][0]["size"] == len("<!doctype html><h1>Revised</h1>".encode("utf-8"))
    assert client.storage_download(artifacts[0]["storage_path"]).decode("utf-8") == "<!doctype html><h1>Revised</h1>"


def test_doc_wiki_adapter_synthesizes_from_task_artifact_payload():
    client = _FakeClient()
    task_id = str(uuid.uuid4())
    artifact_id = str(uuid.uuid4())
    client.tables["tasks"].append(
        {
            "id": task_id,
            "user_id": USER_ID,
            "agent_id": AGENT_ID,
            "workflow_id": WORKFLOW_ID,
            "title": "Monthly P&L Assessment",
            "status": "review",
            "step_results": {
                "1": {"name": "Analyze", "summary": "Revenue improved.", "source_refs": [{"source_kind": "workspace_file", "path": "pnl.csv"}]}
            },
            "updated_at": "now",
        }
    )
    client.tables["workflows"].append({"id": WORKFLOW_ID, "name": "Produce a Monthly P&L Assessment", "key": "produce_monthly_pnl_assessment"})
    storage_path = f"{USER_ID}/{artifact_id}/artifact.html"
    client.storage.upload(storage_path, b"<h1>Assessment</h1>")
    client.tables["artifacts"].append(
        {
            "id": artifact_id,
            "user_id": USER_ID,
            "source_kind": "domain_agent_task",
            "task_id": task_id,
            "filename": "artifact.html",
            "description": "Monthly P&L Assessment",
            "storage_path": storage_path,
            "provenance": {"source_refs": [{"source_kind": "workspace_file", "path": "pnl.csv"}]},
            "created_at": "now",
            "updated_at": "now",
        }
    )
    service = _FakeSynthesisService()
    adapter = DocWikiAgentArtifactAdapter(client, service)

    result = asyncio.run(adapter.synthesize_from_task(task_id, USER_ID, artifact_id=artifact_id))

    assert result is not None
    assert service.payload.source_kind == "agent_artifact"
    assert service.payload.source_id == artifact_id
    assert service.payload.metadata["forced_page_kind"] == "agent_artifact"
    assert service.payload.metadata["task_id"] == task_id
    assert service.payload.metadata["source_refs"] == [{"source_kind": "workspace_file", "path": "pnl.csv"}]
    assert "<h1>Assessment</h1>" in service.payload.full_text
    assert "Revenue improved." in service.payload.full_text


def _seed_workflow(client, steps, *, key="trivial_test_workflow", prereqs=None):
    client.tables["workflows"] = [
        {
            "id": WORKFLOW_ID,
            "agent_id": AGENT_ID,
            "key": key,
            "name": "Produce a Monthly P&L Assessment" if key == "produce_monthly_pnl_assessment" else "Trivial Test Workflow",
            "template_id": None,
            "prereqs": prereqs or {},
            "is_active": True,
        }
    ]
    client.tables["workflow_steps"] = steps


def _step(
    position,
    name,
    step_type,
    *,
    workspace_inputs=None,
    workspace_output=None,
    output_schema=None,
    capability_key=None,
    tools=None,
):
    return {
        "id": str(uuid.uuid4()),
        "workflow_id": WORKFLOW_ID,
        "position": position,
        "name": name,
        "step_type": step_type,
        "skill_id": None,
        "system_prompt_template": None,
        "tools": tools or [],
        "capability_key": capability_key,
        "output_schema": output_schema or {},
        "workspace_inputs": workspace_inputs or [],
        "workspace_output": workspace_output,
        "batch_size": None,
    }


def _insert_task(client, *, current_step=0):
    task = {
        "id": str(uuid.uuid4()),
        "user_id": USER_ID,
        "agent_id": AGENT_ID,
        "workflow_id": WORKFLOW_ID,
        "title": "Task",
        "status": "ready",
        "current_step": current_step,
        "step_results": {},
        "origin": "profile",
        "origin_thread_id": None,
    }
    client.tables["tasks"].append(task)
    return task


class _FakeAnthropic:
    def __init__(self, output):
        self.messages = _FakeMessages(output)


class _FakeMessages:
    def __init__(self, output):
        self.output = output

    def create(self, **_kwargs):
        return SimpleNamespace(
            usage=SimpleNamespace(input_tokens=10, output_tokens=5),
            content=[
                SimpleNamespace(
                    type="tool_use",
                    name="record_step_output",
                    input=self.output,
                )
            ],
        )


class _FakeSubAgentFactory:
    def __init__(self, delay_seconds=0, citations=None):
        self.calls = []
        self.call_started_at = []
        self.delay_seconds = delay_seconds
        self.citations = citations or []

    def __call__(self):
        return self

    def start_run(self, request):
        self.calls.append(request)
        self.call_started_at.append(time.perf_counter())
        if self.delay_seconds:
            time.sleep(self.delay_seconds)
        return SimpleNamespace(
            run_id=str(uuid.uuid4()),
            status="completed",
            result_summary=f"Completed {request.task_title}",
            structured_result={"summary": f"Completed {request.task_title}", "source_refs": self.citations},
            trace=[{"step_index": 1, "summary": "curated only", "input_summary": {"hidden": "not returned"}}],
            citations=self.citations,
        )


class _FakeRegistry:
    def __init__(self, allowed):
        self.allowed = allowed

    def get_tools(self, *, names=None, **_kwargs):
        selected = [name for name in self.allowed if names is None or name in names]
        return [SimpleNamespace(name=name) for name in selected]


class _FakeSynthesisService:
    def __init__(self):
        self.payload = None

    def synthesize(self, payload):
        self.payload = payload
        return SynthesisResult(user_id=payload.user_id, synthesis_job_id=payload.synthesis_job_id, page_ids=["page-1"], pages_created=1)

    def _write_page_links(self, *_args, **_kwargs):
        return None


class _FakeClient:
    def __init__(self):
        self.tables = {
            "tasks": [],
            "workflows": [],
            "workflow_steps": [],
            "workspace_files": [],
            "artifacts": [],
            "ai_usage_log": [],
        }
        self.usage_rows = []
        self.storage = _FakeStorage()

    def table(self, name):
        return _FakeQuery(self, name)

    def one(self, table, row_id):
        return next(row for row in self.tables[table] if row["id"] == row_id)

    def workspace_content(self, task_id, path):
        row = next(row for row in self.tables["workspace_files"] if row["owner_id"] == task_id and row["file_path"] == path)
        return row["content"]

    def upsert_workspace(self, task_id, path, content, *, source):
        existing = next(
            (
                row
                for row in self.tables["workspace_files"]
                if row["owner_type"] == "task" and row["owner_id"] == task_id and row["file_path"] == path
            ),
            None,
        )
        row = {
            "id": str(uuid.uuid4()),
            "owner_type": "task",
            "owner_id": task_id,
            "user_id": USER_ID,
            "file_path": path,
            "content": content,
            "storage_path": None,
            "source": source,
            "size": len(content),
            "created_at": "now",
            "updated_at": "now",
        }
        if existing:
            existing.update({**row, "id": existing["id"], "created_at": existing["created_at"]})
            return
        self.tables["workspace_files"].append(row)

    def storage_download(self, path):
        return self.storage.objects[path]


class _FakeStorage:
    def __init__(self):
        self.objects = {}

    def from_(self, _bucket):
        return self

    def upload(self, path, content, _options=None):
        self.objects[path] = content
        return SimpleNamespace(path=path)

    def download(self, path):
        return self.objects[path]

    def remove(self, paths):
        for path in paths:
            self.objects.pop(path, None)
        return SimpleNamespace(data=paths)

    def create_signed_url(self, path, _expires):
        return {"signedURL": f"https://signed.local/{path}"}


class _FakeQuery:
    def __init__(self, client, table):
        self.client = client
        self.table = table
        self.filters = []
        self.payload = None
        self.mode = "select"
        self.order_key = None
        self.order_desc = False
        self.limit_count = None
        self.single = False

    def select(self, *_args, **_kwargs):
        self.mode = "select"
        return self

    def insert(self, payload):
        self.mode = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.mode = "update"
        self.payload = payload
        return self

    def upsert(self, payload, **_kwargs):
        self.mode = "upsert"
        self.payload = payload
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def order(self, key, **kwargs):
        self.order_key = key
        self.order_desc = bool(kwargs.get("desc"))
        return self

    def maybe_single(self):
        self.single = True
        return self

    def limit(self, count):
        self.limit_count = count
        return self

    def execute(self):
        if self.mode == "insert":
            row = dict(self.payload)
            row.setdefault("id", str(uuid.uuid4()))
            row.setdefault("created_at", "now")
            row.setdefault("updated_at", "now")
            self.client.tables[self.table].append(row)
            if self.table == "ai_usage_log":
                self.client.usage_rows.append(row)
            return SimpleNamespace(data=[row])

        rows = [row for row in self.client.tables[self.table] if all(str(row.get(k)) == str(v) for k, v in self.filters)]

        if self.mode == "update":
            for row in rows:
                row.update(self.payload)
            return SimpleNamespace(data=rows)

        if self.mode == "upsert":
            row = dict(self.payload)
            match = next(
                (
                    existing
                    for existing in self.client.tables[self.table]
                    if existing.get("owner_type") == row.get("owner_type")
                    and existing.get("owner_id") == row.get("owner_id")
                    and existing.get("file_path") == row.get("file_path")
                ),
                None,
            )
            if match:
                match.update(row)
                return SimpleNamespace(data=[match])
            row.setdefault("id", str(uuid.uuid4()))
            row.setdefault("created_at", "now")
            row.setdefault("updated_at", "now")
            self.client.tables[self.table].append(row)
            return SimpleNamespace(data=[row])

        if self.order_key:
            rows = sorted(rows, key=lambda row: row.get(self.order_key) or 0, reverse=self.order_desc)
        if self.limit_count is not None:
            rows = rows[: self.limit_count]
        if self.single:
            return SimpleNamespace(data=rows[0] if rows else None)
        return SimpleNamespace(data=rows)
