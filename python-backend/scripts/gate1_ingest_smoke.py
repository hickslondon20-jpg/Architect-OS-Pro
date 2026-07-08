"""
Task 1 — Gate 1 smoke script: upload -> ingest -> doc-wiki synthesis, in one run.

Run from the python-backend/ directory, inside the venv:

    python scripts/gate1_ingest_smoke.py

What this does, and why it's a single script instead of hitting HTTP endpoints:
  1. Uploads a small real text document to the `raw-documents` Storage bucket and
     inserts its `ose_raw_document_registry` row directly via the Supabase
     service-role client -- this is the one step the Python backend has no HTTP
     endpoint for (the frontend normally does this with the browser Supabase
     client before ever calling the backend).
  2. Calls `main._process_ingestion(...)` DIRECTLY (the same function
     `/api/ingest` schedules as a background task) rather than going over HTTP.
     Reading the code: this one function already does the entire Gate 1 core
     flow in sequence -- Docling/plain-text parse -> metadata extraction
     (OpenAI) -> chunk -> embed -> `document_chunks` -> mark ingested -> doc-wiki
     Tier-2 synthesis (Claude) -> direct write to `ose_knowledge_pages`. There is
     no separate "compile" step for document-sourced pages -- that mechanism
     (`WikiCompilationService` / `_project_to_ose`) is a different, independent
     path used only for the 7 fixed structured-data pages (diagnostic_synthesis,
     current_quarter_sprint, etc., see config/wiki_schema.json), not for
     documents. Calling it directly also means any exception surfaces here in
     the console instead of vanishing into a background task.
  3. Prints the document_id, storage_path, and final registry-row status so the
     agent can pull the rest (document_chunks, ose_knowledge_pages,
     ose_activity_log, LangSmith trace) via the Supabase MCP connector.

Uses the same test account prior smoke tests in this repo used
(user_id 5aae2cc2-624e-40ba-b14d-909b66be5f74, the "TEST ACCOUNT" beta row) --
not your real founder account -- so this doesn't pollute real data.
"""

from __future__ import annotations

import json
import mimetypes
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
SENTINEL = f"MA01_GATE1_SMOKE_{uuid.uuid4().hex[:8]}"
FILE_NAME = "ma01-gate1-smoke-note.txt"
# ose_raw_document_registry.file_type is a constrained short code, NOT a MIME
# type -- the DB check constraint only allows: pdf, docx, csv, xlsx, txt, png,
# jpg (confirmed live via Supabase MCP). Note 'html' and 'md' are NOT in that
# list despite being in the M5 Docling multiformat plan -- flagged separately.
FILE_TYPE = "txt"

DOCUMENT_CONTENT = f"""ArchitectOS Beta -- Q3 Operations Note ({SENTINEL})

We are seeing a recurring constraint in delivery capacity: account managers are
spending roughly 30% of their week on manual reporting instead of client
strategy work. This is the single largest drag on our ability to take on new
retainer clients this quarter.

Financially, retainer churn has stayed flat at 4% month over month, but the
cost to service each account has crept up as reporting overhead grows. If we
do not automate the reporting workflow before Q4, we will hit a delivery
capacity ceiling before we hit a revenue ceiling.

Recommended next step: prioritize the reporting automation workstream in the
current sprint, ahead of new-logo acquisition work, since capacity is now the
binding constraint on growth rather than demand.
"""


def main_() -> None:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        print("FAIL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not resolved from env.")
        sys.exit(1)

    client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    document_id = str(uuid.uuid4())
    storage_path = f"{TEST_USER_ID}/{document_id}-{FILE_NAME}"
    file_bytes = DOCUMENT_CONTENT.encode("utf-8")

    print(f"document_id   = {document_id}")
    print(f"storage_path  = {storage_path}")
    print(f"sentinel      = {SENTINEL}")
    print()

    print("Step 1/3: uploading to raw-documents bucket + inserting registry row...")
    content_type = mimetypes.guess_type(FILE_NAME)[0] or FILE_TYPE
    client.storage.from_(settings.raw_document_bucket).upload(
        storage_path,
        file_bytes,
        {"content-type": content_type},
    )
    now = datetime.now(timezone.utc).isoformat()
    client.table("ose_raw_document_registry").insert(
        {
            "id": document_id,
            "user_id": TEST_USER_ID,
            "file_name": FILE_NAME,
            "file_type": FILE_TYPE,
            "storage_path": storage_path,
            "size_bytes": len(file_bytes),
            "status": "uploaded",
            "hash_algorithm": "sha256",
            "record_state": "active",
            "source_version": 1,
            "upload_timestamp": now,
            "metadata": {"smoke_test": "ma01_gate1", "marker": SENTINEL},
        }
    ).execute()
    print("  done.")
    print()

    print("Step 2/3: running the full ingest pipeline in-process")
    print("  (parse -> metadata extraction -> chunk -> embed -> doc-wiki synthesis)...")
    import main as backend_main  # noqa: PLC0415

    payload = backend_main.IngestRequest(
        document_id=document_id,
        user_id=TEST_USER_ID,
        storage_path=storage_path,
        file_name=FILE_NAME,
        file_type=FILE_TYPE,
    )
    backend_main._process_ingestion(payload)  # noqa: SLF001
    print("  done (see registry row below for outcome).")
    print()

    print("Step 3/3: reading back the registry row...")
    row = (
        client.table("ose_raw_document_registry")
        .select(
            "status,chunk_count,ingestion_error,error_message,parser_status,"
            "metadata_extraction_status,connected_pages,ingested_at"
        )
        .eq("id", document_id)
        .single()
        .execute()
        .data
    )
    print(json.dumps(row, indent=2, default=str))
    print()
    print("Give the agent this document_id and sentinel to verify the rest via Supabase MCP")
    print("(document_chunks, ose_knowledge_pages, ose_activity_log) and via the LangSmith")
    print("ArchitectOS-pro project (should show new Anthropic + OpenAI runs from this script).")


if __name__ == "__main__":
    main_()
