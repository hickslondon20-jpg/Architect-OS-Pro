from __future__ import annotations

from typing import TYPE_CHECKING, Any

from services.citations.models import CitationRef

if TYPE_CHECKING:
    from services.vector_store import VectorStore


def resolve_chunk(ref: CitationRef, user_id: str, store: "VectorStore") -> dict[str, Any]:
    source_id = ref.source_id
    if not source_id:
        return _error(ref, "missing_source_id", "Document chunk citation is missing a source id.")

    response = (
        store.client.table("document_chunks")
        .select("id,user_id,document_id,chunk_index,content,metadata,page_number,bbox,verbatim")
        .eq("user_id", user_id)
        .eq("id", source_id)
        .maybe_single()
        .execute()
    )
    chunk = response.data
    if not chunk:
        return _error(ref, "unresolvable", "Document chunk was not found for this user.")

    metadata = chunk.get("metadata") or {}
    document = _load_document(store, user_id, chunk.get("document_id"))
    lines = _lines_from(ref, metadata)
    section = (
        ref.locator.section_label
        if ref.locator and ref.locator.section_label
        else metadata.get("section_label")
        or metadata.get("section")
    )
    label = (
        ref.source_label
        or metadata.get("document_title")
        or (document or {}).get("file_name")
        or f"Document chunk {chunk.get('chunk_index')}"
    )
    locator = _locator_from(chunk, lines, section)

    return {
        "type": "chunk",
        "source_kind": "document_chunk",
        "source_id": chunk.get("id"),
        "label": label,
        "verbatim": chunk.get("verbatim") or chunk.get("content") or "",
        "locator": locator,
        "document": {
            "id": chunk.get("document_id"),
            "title": (document or {}).get("file_name") or metadata.get("document_title"),
            "file_type": (document or {}).get("file_type"),
            "metadata": {
                "status": (document or {}).get("status"),
                "parser_status": (document or {}).get("parser_status"),
                "metadata_document_type": (document or {}).get("metadata_document_type"),
                "metadata_business_domain": (document or {}).get("metadata_business_domain"),
            },
        },
        "chunk": {
            "chunk_index": chunk.get("chunk_index"),
            "metadata": metadata,
        },
    }


def _locator_from(chunk: dict[str, Any], lines: dict[str, int] | None, section: str | None) -> dict[str, Any]:
    page_number = chunk.get("page_number")
    bbox = chunk.get("bbox")
    if page_number is not None and bbox is not None:
        return {
            "kind": "bbox",
            "lines": lines,
            "section": section,
            "page_number": page_number,
            "bbox": bbox,
        }
    return {
        "kind": "lines" if lines else "section",
        "lines": lines,
        "section": section,
        "page_number": None,
        "bbox": None,
    }


def _load_document(store: "VectorStore", user_id: str, document_id: Any) -> dict[str, Any] | None:
    if not document_id:
        return None
    response = (
        store.client.table("ose_raw_document_registry")
        .select(
            "id,user_id,file_name,file_type,status,parser_status,metadata_document_type,"
            "metadata_business_domain,metadata_time_period,extracted_metadata,chunk_count"
        )
        .eq("user_id", user_id)
        .eq("id", str(document_id))
        .maybe_single()
        .execute()
    )
    return response.data or None


def _lines_from(ref: CitationRef, metadata: dict[str, Any]) -> dict[str, int] | None:
    if ref.locator and ref.locator.lines:
        return ref.locator.lines
    raw = (
        metadata.get("lines")
        or metadata.get("line_range")
        or (
            {"start": metadata.get("start_line"), "end": metadata.get("end_line")}
            if metadata.get("start_line") and metadata.get("end_line")
            else None
        )
    )
    if isinstance(raw, dict) and raw.get("start") is not None and raw.get("end") is not None:
        return {"start": int(raw["start"]), "end": int(raw["end"])}
    if isinstance(raw, (list, tuple)) and len(raw) >= 2:
        return {"start": int(raw[0]), "end": int(raw[1])}
    return None


def _error(ref: CitationRef, code: str, message: str) -> dict[str, Any]:
    return {
        "type": "error",
        "source_kind": ref.source_kind,
        "source_id": ref.source_id,
        "code": code,
        "message": message,
    }
