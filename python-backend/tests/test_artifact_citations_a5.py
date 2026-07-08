from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID

from fastapi.testclient import TestClient

from services.artifact_service import ArtifactService


USER_ID = "00000000-0000-0000-0000-000000000001"


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, client, table):
        self.client = client
        self.table = table
        self.filters = []
        self.limit_value = None

    def select(self, _columns):
        return self

    def eq(self, column, value):
        self.filters.append((column, str(value)))
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def execute(self):
        rows = list(self.client.tables.get(self.table, []))
        for column, value in self.filters:
            rows = [row for row in rows if str(row.get(column)) == value]
        if self.limit_value is not None:
            rows = rows[: self.limit_value]
        return FakeResponse(rows)


class FakeStorage:
    def __init__(self, objects):
        self.objects = objects

    def from_(self, _bucket):
        return self

    def download(self, path):
        return self.objects[path]

    def create_signed_url(self, path, _expires):
        return {"signedURL": f"https://signed.local/{path}"}


class FakeClient:
    def __init__(self, artifact_rows, objects=None):
        self.tables = {"artifacts": artifact_rows}
        self.storage = FakeStorage(objects or {})

    def table(self, name):
        return FakeQuery(self, name)


def test_artifact_delivery_includes_numbered_normalized_provenance_refs():
    storage_path = f"{USER_ID}/artifact-1/report.md"
    service = ArtifactService(
        settings=SimpleNamespace(),
        supabase_client=FakeClient(
            [
                {
                    "id": "artifact-1",
                    "user_id": USER_ID,
                    "source_kind": "domain_agent_task",
                    "source_id": "task-1",
                    "filename": "report.md",
                    "mime_type": "text/markdown",
                    "size": 12,
                    "storage_path": storage_path,
                    "renderable": True,
                    "description": "Monthly P&L",
                    "provenance": {
                        "schema_version": "domain_agent_artifact_provenance_v1",
                        "source_refs": [
                            {
                                "source_kind": "founder_dataset",
                                "source_id": "dataset-1",
                                "source_label": "Monthly P&L",
                                "source_metadata": {"record_path": "founder_dataset_rows/dataset-1/revenue"},
                                "citation_payload": {},
                            },
                            {
                                "source_kind": "founder_dataset",
                                "source_id": "dataset-1",
                                "source_label": "Monthly P&L duplicate",
                                "source_metadata": {"record_path": "founder_dataset_rows/dataset-1/revenue"},
                                "citation_payload": {},
                            },
                            {
                                "source_kind": "sub_agent_run",
                                "source_id": "run-1",
                                "source_label": "Analysis trace",
                                "source_metadata": {},
                                "citation_payload": {},
                            },
                        ],
                    },
                }
            ],
            {storage_path: b"Report body [1]."},
        ),
    )

    delivery = service.get_delivery("artifact-1", USER_ID)
    refs = delivery.provenance["source_refs"]

    assert delivery.content == "Report body [1]."
    assert [ref["ordinal"] for ref in refs] == [1, 2]
    assert refs[0]["source_kind"] == "platform_record"
    assert refs[0]["source_id"] == "dataset-1"
    assert refs[0]["locator"]["record_path"] == "founder_dataset_rows/dataset-1/revenue"
    assert refs[1]["source_kind"] == "derived"


def test_artifact_delivery_without_provenance_degrades_to_empty_refs():
    service = ArtifactService(
        settings=SimpleNamespace(),
        supabase_client=FakeClient(
            [
                {
                    "id": "artifact-2",
                    "user_id": USER_ID,
                    "source_kind": "vcso_thread",
                    "source_id": "thread-1",
                    "filename": "workbook.xlsx",
                    "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "size": 10,
                    "storage_path": f"{USER_ID}/artifact-2/workbook.xlsx",
                    "renderable": False,
                    "description": None,
                }
            ]
        ),
    )

    delivery = service.get_delivery("artifact-2", USER_ID)

    assert delivery.content is None
    assert delivery.signed_url
    assert delivery.provenance == {"source_refs": []}


def test_artifact_endpoint_returns_provenance_with_user_session(monkeypatch):
    import main
    from routers.kb_folders import get_current_user_id

    class FakeArtifactService:
        def get_delivery(self, artifact_id, user_id):
            assert artifact_id == "artifact-1"
            assert user_id == USER_ID
            return SimpleNamespace(
                to_dict=lambda: {
                    "id": "artifact-1",
                    "user_id": USER_ID,
                    "source_kind": "domain_agent_task",
                    "source_id": "task-1",
                    "filename": "report.md",
                    "mime_type": "text/markdown",
                    "size": 12,
                    "storage_path": f"{USER_ID}/artifact-1/report.md",
                    "renderable": True,
                    "description": "Monthly P&L",
                    "content": "Report body [1].",
                    "signed_url": None,
                    "provenance": {
                        "source_refs": [
                            {
                                "ordinal": 1,
                                "source_kind": "platform_record",
                                "source_id": "dataset-1",
                                "source_label": "Monthly P&L",
                                "verbatim": None,
                                "locator": None,
                                "source_metadata": {},
                            }
                        ]
                    },
                }
            )

    monkeypatch.setattr(main, "get_artifact_service", lambda: FakeArtifactService())
    client = TestClient(main.app)
    main.app.dependency_overrides[get_current_user_id] = lambda: UUID(USER_ID)
    response = client.get("/api/artifacts/artifact-1")
    main.app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["provenance"]["source_refs"][0]["source_kind"] == "platform_record"
