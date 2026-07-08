"""Registered programmatic handlers for Domain Agent workflows.

Handlers live outside the generic harness engine so workflow-specific logic can
be added without changing engine dispatch.
"""

from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any

from core.config import get_settings
from services.harness_engine import BlockedResult, HarnessEngine, StepResult, register_programmatic_handler


@register_programmatic_handler("pnl_intake")
def pnl_intake(engine: HarnessEngine, task: dict[str, Any], workflow: dict[str, Any], step: dict[str, Any]) -> StepResult | BlockedResult:
    upload = _latest_uploaded_workspace_file(engine, task)
    if upload is None and not _has_pnl_context(engine, task):
        return BlockedResult(
            question=_upload_prompt(workflow),
            workspace_path=step.get("workspace_output"),
            details={"required": "monthly_pnl_document", "accepted_formats": ["csv", "xlsx", "pdf", "docx", "txt"]},
        )

    source_path = str((upload or {}).get("file_path") or "os-engine-pnl-presence")
    source_refs = [_source_ref(task, source_path, (upload or {}).get("id"))]
    content, parser_metadata = _parse_upload(engine, task, upload) if upload else _pnl_context_stub()
    metadata_block = json.dumps(parser_metadata, indent=2, sort_keys=True)
    workspace_content = "\n\n".join(
        [
            "# Monthly P&L source",
            "> POC parse output. Analytical IP is intentionally not encoded in this handler.",
            f"Source: `{source_path}`",
            "## Parsed content",
            content.strip() or "P&L presence was detected, but no parsed content was available.",
            "## Parser metadata",
            f"```json\n{metadata_block}\n```",
        ]
    )
    return StepResult(
        summary="P&L source prepared.",
        output={
            "schema_version": "pnl_intake_poc_v1",
            "source_path": source_path,
            "parser_metadata": parser_metadata,
            "source_refs": source_refs,
        },
        workspace_path=step.get("workspace_output"),
        workspace_content=workspace_content,
        source_refs=source_refs,
    )


@register_programmatic_handler("pnl_render")
def pnl_render(engine: HarnessEngine, task: dict[str, Any], workflow: dict[str, Any], step: dict[str, Any]) -> StepResult:
    assessment = engine._read_workspace_content(task, _first_input(step, "assessment.md"))
    parsed = _maybe_json(assessment)
    html_content = _assessment_html(task, workflow, parsed, assessment)
    source_refs = _collect_source_refs(task)
    return StepResult(
        summary="Assessment artifact rendered for review.",
        output={
            "schema_version": "pnl_render_poc_v1",
            "artifact_path": step.get("workspace_output") or "artifact.html",
            "render": "in_process_html",
            "source_refs": source_refs,
        },
        workspace_path=step.get("workspace_output") or "artifact.html",
        workspace_content=html_content,
        source_refs=source_refs,
    )


def _latest_uploaded_workspace_file(engine: HarnessEngine, task: dict[str, Any]) -> dict[str, Any] | None:
    rows = [row for row in engine._list_workspace(task["user_id"], task["id"]) if row.get("source") == "upload"]
    if not rows:
        return None
    preferred = [
        row
        for row in rows
        if any(token in str(row.get("file_path") or "").lower() for token in ("p&l", "pnl", "profit", "loss", "financial"))
    ]
    return (preferred or rows)[-1]


def _has_pnl_context(engine: HarnessEngine, task: dict[str, Any]) -> bool:
    user_id = task["user_id"]
    probes = [
        ("founder_datasets", "dataset_type", "pnl"),
        ("ose_raw_document_registry", "document_type", "pnl"),
    ]
    for table, column, value in probes:
        try:
            rows = (
                engine.client.table(table)
                .select("id")
                .eq("user_id", user_id)
                .eq(column, value)
                .limit(1)
                .execute()
                .data
                or []
            )
            if rows:
                return True
        except Exception:
            continue
    try:
        rows = (
            engine.client.table("ose_raw_document_registry")
            .select("id,file_name")
            .eq("user_id", user_id)
            .limit(20)
            .execute()
            .data
            or []
        )
        return any(_looks_like_pnl(row.get("file_name")) for row in rows)
    except Exception:
        return False


def _parse_upload(engine: HarnessEngine, task: dict[str, Any], upload: dict[str, Any] | None) -> tuple[str, dict[str, Any]]:
    if upload is None:
        return _pnl_context_stub()
    file_path = str(upload.get("file_path") or "uploaded-pnl.txt")
    content = upload.get("content")
    if content is None:
        content = engine._read_workspace_content(task, file_path)
    file_bytes = str(content or "").encode("utf-8")
    if not file_bytes and upload.get("storage_path"):
        file_bytes = _download_workspace_upload(engine, str(upload["storage_path"]))
    if not file_bytes:
        return "", {"parser": "workspace_upload", "warning": "Upload row had no text or downloadable storage content."}

    file_type = Path(file_path).suffix.lstrip(".") or "txt"
    try:
        from services.doc_processor import process_document_bytes

        processed = process_document_bytes(file_bytes, file_path, file_type)
        return processed.text, processed.metadata
    except Exception as exc:
        return file_bytes.decode("utf-8", errors="replace"), {
            "parser": "plain_text_fallback",
            "warning": str(exc),
            "file_name": file_path,
        }


def _download_workspace_upload(engine: HarnessEngine, storage_path: str) -> bytes:
    try:
        return engine.client.storage.from_("workspace").download(storage_path)
    except Exception:
        settings = get_settings()
        return engine.client.storage.from_(settings.raw_document_bucket).download(storage_path)


def _assessment_html(task: dict[str, Any], workflow: dict[str, Any], parsed: dict[str, Any] | None, raw: str) -> str:
    title = html.escape(str(workflow.get("name") or task.get("title") or "Monthly P&L Assessment"))
    if parsed:
        headline = html.escape(str(parsed.get("headline") or parsed.get("summary") or "Monthly P&L assessment"))
        sections = [
            ("Findings", parsed.get("findings") or []),
            ("Risks", parsed.get("risks") or []),
            ("Questions", parsed.get("questions") or []),
        ]
        body = [f"<h1>{title}</h1>", "<p><strong>POC artifact.</strong> Content is placeholder-grade pending the financial IP pass.</p>", f"<h2>{headline}</h2>"]
        for label, items in sections:
            body.append(f"<h3>{html.escape(label)}</h3>")
            body.append(_items_html(items))
    else:
        body = [
            f"<h1>{title}</h1>",
            "<p><strong>POC artifact.</strong> Content is placeholder-grade pending the financial IP pass.</p>",
            f"<pre>{html.escape(raw or 'No assessment content was produced.')}</pre>",
        ]
    return "\n".join(["<!doctype html>", '<html lang="en">', "<head>", '<meta charset="utf-8">', f"<title>{title}</title>", _artifact_css(), "</head>", "<body>", "<main>", *body, "</main>", "</body>", "</html>"])


def _items_html(items: Any) -> str:
    values = items if isinstance(items, list) else [items]
    if not values:
        return "<p>No items recorded.</p>"
    rendered = []
    for item in values:
        if isinstance(item, dict):
            text = item.get("summary") or item.get("title") or item.get("text") or json.dumps(item, sort_keys=True)
        else:
            text = str(item)
        rendered.append(f"<li>{html.escape(str(text))}</li>")
    return "<ul>" + "".join(rendered) + "</ul>"


def _artifact_css() -> str:
    return (
        "<style>"
        "body{margin:0;background:#F7F4EF;color:#222B38;font-family:Geist,Arial,sans-serif;}"
        "main{max-width:880px;margin:0 auto;padding:40px 28px;}"
        "h1{font-size:32px;margin:0 0 12px;}h2{font-size:24px;margin:28px 0 12px;}h3{font-size:18px;margin:24px 0 8px;}"
        "p,li,pre{font-size:15px;line-height:1.6;}pre{white-space:pre-wrap;background:#FCFBF8;border:1px solid #E4DED4;padding:16px;}"
        "strong{color:#143E43;}"
        "</style>"
    )


def _collect_source_refs(task: dict[str, Any]) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    for result in (task.get("step_results") or {}).values():
        if isinstance(result, dict):
            refs.extend(ref for ref in result.get("source_refs") or [] if isinstance(ref, dict))
    seen = set()
    unique = []
    for ref in refs:
        key = json.dumps(ref, sort_keys=True)
        if key not in seen:
            seen.add(key)
            unique.append(ref)
    return unique


def _source_ref(task: dict[str, Any], path: str, row_id: Any = None) -> dict[str, Any]:
    return {
        "source_kind": "workspace_file",
        "source_id": str(row_id or path),
        "path": path,
        "task_id": task["id"],
    }


def _upload_prompt(workflow: dict[str, Any]) -> str:
    prereqs = workflow.get("prereqs") or {}
    required = prereqs.get("required") if isinstance(prereqs, dict) else None
    label = ", ".join(str(item) for item in required) if isinstance(required, list) and required else "a monthly P&L document"
    return f"Please upload {label} so I can prepare the assessment."


def _pnl_context_stub() -> tuple[str, dict[str, Any]]:
    return "Recent P&L context detected in existing founder data. POC intake did not copy raw source content.", {
        "parser": "os_engine_presence_probe",
        "extraction_quality": "presence_only",
    }


def _looks_like_pnl(value: Any) -> bool:
    lowered = str(value or "").lower()
    return any(token in lowered for token in ("p&l", "pnl", "profit", "loss", "income statement"))


def _maybe_json(value: str) -> dict[str, Any] | None:
    try:
        parsed = json.loads(value)
    except Exception:
        return None
    return parsed if isinstance(parsed, dict) else None


def _first_input(step: dict[str, Any], fallback: str) -> str:
    inputs = step.get("workspace_inputs") if isinstance(step.get("workspace_inputs"), list) else []
    return str(inputs[0]) if inputs else fallback
