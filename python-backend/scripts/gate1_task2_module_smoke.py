"""
Task 2 -- one consolidated smoke run covering M3 (dedup skip), M5 (CSV format +
a deliberate parser-failure case), M7 (structured dataset + read-only SQL
validator safety), and M8 (a real sub-agent run, not a simulated one).

Run from python-backend/, inside the venv:

    python scripts/gate1_task2_module_smoke.py

Each section prints PASS/FAIL lines. Paste the full output back.

Note on M3: the actual duplicate-DETECTION logic (SHA-256 hash + lookup) lives
in the frontend (lib/osEngineApi.ts), confirmed present there by code read, but
not exercised by this script since it requires a browser. This script instead
proves the backend half of the M3 contract: once a row is marked
record_state='duplicate' (as the frontend would do), does the ingest pipeline
correctly skip parsing/embedding for it.
"""

from __future__ import annotations

import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from supabase import create_client  # noqa: E402

from core.config import get_settings  # noqa: E402

TEST_USER_ID = "5aae2cc2-624e-40ba-b14d-909b66be5f74"
EXISTING_GATE1_DOCUMENT_ID = "3b26fe0f-57bf-4fcb-8738-57556638e198"  # from gate1_ingest_smoke.py


def line(label: str) -> None:
    print(f"\n===== {label} =====")


# Must match the raw-documents bucket's configured allowed_mime_types exactly
# (confirmed live via Supabase MCP) -- application/octet-stream is rejected.
CONTENT_TYPE_BY_FILE_TYPE = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv",
    "txt": "text/plain",
    "png": "image/png",
    "jpg": "image/jpeg",
}


def insert_registry_row(client, settings, *, file_name, file_type, content, extra=None):
    document_id = str(uuid.uuid4())
    storage_path = f"{TEST_USER_ID}/{document_id}-{file_name}"
    file_bytes = content if isinstance(content, bytes) else content.encode("utf-8")
    content_type = CONTENT_TYPE_BY_FILE_TYPE.get(file_type, "text/plain")
    client.storage.from_(settings.raw_document_bucket).upload(
        storage_path, file_bytes, {"content-type": content_type}
    )
    row = {
        "id": document_id,
        "user_id": TEST_USER_ID,
        "file_name": file_name,
        "file_type": file_type,
        "storage_path": storage_path,
        "size_bytes": len(file_bytes),
        "status": "uploaded",
        "hash_algorithm": "sha256",
        "record_state": "active",
        "source_version": 1,
        "upload_timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": {"smoke_test": "ma01_task2"},
    }
    if extra:
        row.update(extra)
    client.table("ose_raw_document_registry").insert(row).execute()
    return document_id, storage_path, file_bytes


def m3_dedup_skip(client, settings, backend_main):
    line("M3 -- backend duplicate-skip contract")
    document_id, storage_path, _ = insert_registry_row(
        client,
        settings,
        file_name="m3-dedup-note.txt",
        file_type="txt",
        content="M3 dedup smoke -- this row is pre-marked as a duplicate.",
        extra={
            "record_state": "duplicate",
            "status": "duplicate",
            "duplicate_of_document_id": EXISTING_GATE1_DOCUMENT_ID,
            "content_hash": "0" * 64,
        },
    )
    payload = backend_main.IngestRequest(
        document_id=document_id,
        user_id=TEST_USER_ID,
        storage_path=storage_path,
        file_name="m3-dedup-note.txt",
        file_type="txt",
    )
    backend_main._process_ingestion(payload)  # noqa: SLF001
    row = client.table("ose_raw_document_registry").select("status,parser_status,chunk_count").eq("id", document_id).single().execute().data
    chunks = client.table("document_chunks").select("id").eq("document_id", document_id).execute().data
    print(f"registry row after ingest attempt: {row}")
    print(f"document_chunks created for this row: {len(chunks)}")
    if row["parser_status"] in (None, "pending") and not chunks:
        print("PASS: duplicate row was skipped before parsing/embedding, no chunks created.")
    else:
        print("FAIL: duplicate row was processed as if it were new -- backend skip contract is broken.")


def m5_csv_and_failure(client, settings, backend_main):
    line("M5 -- CSV parse (non-Docling multiformat path) + deliberate parser failure")

    csv_content = (
        "metric,q1,q2,q3\n"
        "revenue,120000,131000,128000\n"
        "cogs,40000,42000,41500\n"
        "retainer_churn_pct,4,4,4\n"
    )
    doc_id, storage_path, _ = insert_registry_row(
        client, settings, file_name="m5-agency-metrics.csv", file_type="csv", content=csv_content
    )
    payload = backend_main.IngestRequest(
        document_id=doc_id, user_id=TEST_USER_ID, storage_path=storage_path,
        file_name="m5-agency-metrics.csv", file_type="csv",
    )
    backend_main._process_ingestion(payload)
    row = client.table("ose_raw_document_registry").select(
        "status,parser_status,chunk_count,ingestion_error,error_message,metadata"
    ).eq("id", doc_id).single().execute().data
    print(f"CSV registry row: {row}")
    if row["status"] == "ingested" and (row.get("chunk_count") or 0) > 0:
        parser = (row.get("metadata") or {}).get("parser")
        print(f"PASS: CSV ingested successfully, parser={parser!r}.")
    else:
        print("FAIL: CSV did not ingest cleanly.")

    # Deliberate failure case: claim file_type="docx" but the bytes are not a
    # real docx (not a valid zip/OOXML container) -> Docling conversion should
    # fail, and that failure should be recorded cleanly, not silently ignored.
    bad_id, bad_storage_path, _ = insert_registry_row(
        client, settings, file_name="m5-corrupt.docx", file_type="docx",
        content=b"this is not a real docx file, just plain garbage bytes",
    )
    payload = backend_main.IngestRequest(
        document_id=bad_id, user_id=TEST_USER_ID, storage_path=bad_storage_path,
        file_name="m5-corrupt.docx", file_type="docx",
    )
    backend_main._process_ingestion(payload)
    bad_row = client.table("ose_raw_document_registry").select(
        "status,parser_status,ingestion_error,error_message"
    ).eq("id", bad_id).single().execute().data
    print(f"Corrupt-docx registry row: {bad_row}")
    if bad_row["status"] == "failed" and (bad_row.get("ingestion_error") or bad_row.get("error_message")):
        print("PASS: malformed docx produced a clean recorded failure state, not a silent success.")
    else:
        print(f"FAIL or UNEXPECTED: status={bad_row['status']!r} -- check whether this needs reporting as a gap.")


def m7_structured_data_and_query_safety(client, settings):
    line("M7 -- governed structured dataset + read-only SQL validator")
    from services.structured_data import (
        DatasetRegistrationInput, StructuredColumnInput, StructuredDataService,
        StructuredRowInput, StructuredTableInput,
    )
    from services.structured_query import StructuredQueryError, StructuredQueryRequest, StructuredQueryService
    from services.vector_store import VectorStore

    store = VectorStore.from_env()
    ds_service = StructuredDataService(store)
    result = ds_service.register_dataset(
        DatasetRegistrationInput(
            user_id=TEST_USER_ID,
            dataset_name="MA01 Task2 Smoke Dataset",
            dataset_type="pnl",
            source_period_grain="quarter",
            tables=[
                StructuredTableInput(
                    table_key="metrics",
                    label="Metrics",
                    columns=[StructuredColumnInput(source_column_name="metric")],
                    rows=[
                        StructuredRowInput(row_label="revenue", values={"q1": 120000, "q2": 131000}),
                        StructuredRowInput(row_label="cogs", values={"q1": 40000, "q2": 42000}),
                    ],
                )
            ],
        )
    )
    dataset_id = result.get("id") or result.get("dataset_id")
    print(f"Registered dataset: {result}")
    row_count = client.table("founder_dataset_rows").select("id", count="exact").eq("dataset_id", dataset_id).execute()
    print(f"founder_dataset_rows for this dataset: {getattr(row_count, 'count', 'unknown')}")
    if dataset_id:
        print("PASS: dataset + table + rows registered.")
    else:
        print("FAIL: dataset registration did not return an id.")

    q_service = StructuredQueryService(store)

    # 1. Valid, approved SELECT -- should be accepted.
    valid_sql = f"select id, row_label, values from founder_dataset_rows where dataset_id = '{dataset_id}' limit 10"
    valid_result = q_service.execute(
        StructuredQueryRequest(user_id=TEST_USER_ID, question="Show my metrics rows", generated_sql=valid_sql)
    )
    print(f"Valid SELECT -> accepted={valid_result.accepted} rows={len(valid_result.rows)}")

    # 2. DDL -- must be rejected.
    try:
        ddl_result = q_service.execute(
            StructuredQueryRequest(user_id=TEST_USER_ID, question="drop it", generated_sql="drop table founder_dataset_rows")
        )
        ddl_ok = not ddl_result.accepted
    except StructuredQueryError:
        ddl_ok = True

    # 3. Unapproved table (platform table) -- must be rejected.
    try:
        platform_result = q_service.execute(
            StructuredQueryRequest(user_id=TEST_USER_ID, question="peek at profiles", generated_sql="select id from profiles limit 5")
        )
        platform_ok = not platform_result.accepted
    except StructuredQueryError:
        platform_ok = True

    # 4. Multi-statement -- must be rejected.
    try:
        multi_result = q_service.execute(
            StructuredQueryRequest(
                user_id=TEST_USER_ID, question="sneaky",
                generated_sql="select id from founder_dataset_rows limit 1; drop table founder_dataset_rows;",
            )
        )
        multi_ok = not multi_result.accepted
    except StructuredQueryError:
        multi_ok = True

    print(f"DDL rejected: {ddl_ok}")
    print(f"Unapproved platform table rejected: {platform_ok}")
    print(f"Multi-statement rejected: {multi_ok}")
    if valid_result.accepted and ddl_ok and platform_ok and multi_ok:
        print("PASS: SQL validator accepts the approved read and rejects all three unsafe cases.")
    else:
        print("FAIL: at least one SQL validator safety case did not behave as expected -- reporting as structural finding.")


def m8_real_subagent_run():
    line("M8 -- real sub-agent orchestration run (not the stale phase-2 simulation row)")
    from services.sub_agent_orchestrator import SubAgentOrchestrator, SubAgentRunRequest
    from services.vector_store import VectorStore

    orchestrator = SubAgentOrchestrator(VectorStore.from_env())
    capabilities = orchestrator.list_capabilities()
    print(f"list_capabilities() returned {len(capabilities)} capabilities.")

    result = orchestrator.start_run(
        SubAgentRunRequest(
            user_id=TEST_USER_ID,
            parent_surface="virtual_cso",
            capability_key="document_analysis_agent",
            task_summary="MA01 Task2 smoke: summarize the Gate 1 test document.",
            context_scope={"document_ids": [EXISTING_GATE1_DOCUMENT_ID]},
        )
    )
    print(f"run_id={result.run_id} status={result.status}")
    print(f"result_summary={result.result_summary!r}")
    print(f"error_message={result.error_message!r}")
    print(f"trace steps: {len(result.trace)}")
    print(f"citations: {len(result.citations)}")
    if result.status == "completed" and not result.error_message:
        print("PASS: real sub-agent run completed with a trace and result.")
    else:
        print("FAIL or PARTIAL: check status/error above.")


def main() -> None:
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    import main as backend_main  # noqa: PLC0415

    m3_dedup_skip(client, settings, backend_main)
    m5_csv_and_failure(client, settings, backend_main)
    m7_structured_data_and_query_safety(client, settings)
    m8_real_subagent_run()


if __name__ == "__main__":
    main()
