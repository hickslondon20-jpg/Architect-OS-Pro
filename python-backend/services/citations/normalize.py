from __future__ import annotations

import re
from dataclasses import asdict, is_dataclass
from typing import Any

from services.citations.models import CitationRef, Locator, normalize_source_kind

INLINE_SOURCE_RE = re.compile(
    r"^\[\[Source:\s*raw_document:(?P<document_id>[^#|\]]+)"
    r"(?:#chunk:(?P<chunk_id>[^|\]]+))?\|(?P<label>[^\]]+)\]\]$"
)

VCSO_KIND_TO_RAW_SOURCE_KIND = {
    "wiki": "wiki_page",
    "platform": "tier0_record",
    "ip": "global_ip_page",
    "context": "derived",
}


def from_agent_source_ref(ref: Any) -> CitationRef:
    data = _as_dict(ref)
    payload = _as_dict(data.get("citation_payload") or {})
    metadata = _metadata_with_raw(data.get("source_metadata") or {}, data.get("source_kind"))
    locator = _locator_from_payload(payload) or _locator_from_metadata(metadata)
    return CitationRef(
        source_kind=normalize_source_kind(data.get("source_kind")),
        source_id=data.get("source_id"),
        source_label=data.get("source_label"),
        verbatim=payload.get("verbatim"),
        locator=locator,
        source_metadata=metadata,
    )


def from_tool_source_ref(ref: Any) -> CitationRef:
    data = _as_dict(ref)
    metadata = _metadata_with_raw(data.get("metadata") or {}, data.get("source_kind"))
    return CitationRef(
        source_kind=normalize_source_kind(data.get("source_kind")),
        source_id=data.get("source_id"),
        source_label=data.get("label"),
        verbatim=data.get("verbatim"),
        locator=_locator_from_metadata(metadata),
        source_metadata=metadata,
    )


def from_docwiki_citation(citation: dict[str, Any]) -> CitationRef:
    raw_kind = citation.get("source_kind") or "wiki_page"
    metadata = _metadata_with_raw(
        {
            "canonical_key": citation.get("canonical_key"),
            "page_kind": citation.get("page_kind"),
            **({"similarity": citation.get("similarity")} if "similarity" in citation else {}),
        },
        raw_kind,
    )
    return CitationRef(
        source_kind=normalize_source_kind(raw_kind),
        source_id=citation.get("canonical_key"),
        source_label=citation.get("title"),
        source_metadata=metadata,
    )


def from_wiki_evidence(evidence: dict[str, Any]) -> CitationRef:
    raw_kind = evidence.get("source_kind")
    metadata = _metadata_with_raw(
        {"weight": evidence.get("weight"), "note": evidence.get("note")},
        raw_kind,
    )
    return CitationRef(
        source_kind=normalize_source_kind(raw_kind),
        source_id=evidence.get("source_id"),
        source_label=evidence.get("path"),
        locator=Locator(kind="lines", path=evidence.get("path"), lines=_coerce_lines(evidence.get("lines"))),
        source_metadata=metadata,
    )


def from_retrieved_chunk(chunk: Any) -> CitationRef:
    data = _as_dict(chunk)
    chunk_metadata = dict(data.get("metadata") or {})
    raw_kind = data.get("source_kind") or "raw_document_chunk"
    metadata = _metadata_with_raw(
        {
            "document_id": data.get("document_id"),
            "document_title": chunk_metadata.get("document_title"),
            "metadata": chunk_metadata,
            "vector_similarity": data.get("vector_similarity"),
            "keyword_rank": data.get("keyword_rank"),
            "hybrid_score": data.get("hybrid_score"),
            "vector_rank": data.get("vector_rank"),
            "keyword_rank_position": data.get("keyword_rank_position"),
            "rrf_score": data.get("rrf_score"),
            "rerank_score": data.get("rerank_score"),
            "retrieval_stage": data.get("retrieval_stage"),
        },
        raw_kind,
    )
    return CitationRef(
        source_kind=normalize_source_kind(raw_kind),
        source_id=data.get("chunk_id"),
        source_label=chunk_metadata.get("document_title"),
        verbatim=data.get("content"),
        source_metadata=metadata,
    )


def parse_inline_source_marker(marker: str) -> CitationRef:
    match = INLINE_SOURCE_RE.match(marker.strip())
    if not match:
        raise ValueError("Invalid inline source marker.")
    document_id = match.group("document_id")
    chunk_id = match.group("chunk_id")
    label = match.group("label").strip()
    section_label = _section_label(label)
    return CitationRef(
        source_kind="document_chunk",
        source_id=chunk_id or document_id,
        source_label=label,
        locator=Locator(kind="section", section_label=section_label),
        source_metadata={"document_id": document_id, "raw_source_kind": "raw_document"},
    )


def from_vcso_stream_ref(ref: dict[str, Any]) -> CitationRef:
    display_kind = ref.get("kind")
    raw_kind = VCSO_KIND_TO_RAW_SOURCE_KIND.get(display_kind, display_kind)
    metadata = _metadata_with_raw({"display_kind": display_kind}, raw_kind)
    return CitationRef(
        source_kind=normalize_source_kind(raw_kind),
        source_id=ref.get("pageId") or ref.get("source_id") or ref.get("id"),
        source_label=ref.get("label"),
        source_metadata=metadata,
    )


def from_provenance_ref(ref: dict[str, Any]) -> CitationRef:
    if ref.get("verbatim") is not None or "locator" in ref:
        normalized = CitationRef.from_dict(
            {
                "source_kind": normalize_source_kind(ref.get("source_metadata", {}).get("raw_source_kind") or ref.get("source_kind")),
                "source_id": ref.get("source_id"),
                "source_label": ref.get("source_label") or ref.get("label"),
                "verbatim": ref.get("verbatim"),
                "locator": ref.get("locator"),
                "source_metadata": _metadata_with_raw(ref.get("source_metadata") or ref.get("metadata") or {}, ref.get("source_kind")),
            }
        )
        return normalized
    if "label" in ref or "metadata" in ref:
        return from_tool_source_ref(ref)
    return from_agent_source_ref(ref)


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    if is_dataclass(value):
        return asdict(value)
    return {
        key: getattr(value, key)
        for key in dir(value)
        if not key.startswith("_") and not callable(getattr(value, key))
    }


def _metadata_with_raw(metadata: dict[str, Any], raw_source_kind: Any) -> dict[str, Any]:
    result = dict(metadata or {})
    result["raw_source_kind"] = raw_source_kind
    return result


def _locator_from_payload(payload: dict[str, Any]) -> Locator | None:
    return Locator.from_dict(payload.get("locator") if isinstance(payload, dict) else None)


def _locator_from_metadata(metadata: dict[str, Any]) -> Locator | None:
    if metadata.get("record_path"):
        return Locator(kind="record_path", record_path=metadata.get("record_path"))
    if metadata.get("page_key"):
        return Locator(kind="page_key", page_key=metadata.get("page_key"))
    if metadata.get("start_line") is not None and metadata.get("end_line") is not None:
        return Locator(
            kind="lines",
            lines={"start": int(metadata["start_line"]), "end": int(metadata["end_line"])},
        )
    return None


def _coerce_lines(value: Any) -> dict[str, int] | None:
    if value is None:
        return None
    if isinstance(value, dict):
        if "start" in value and "end" in value:
            return {"start": int(value["start"]), "end": int(value["end"])}
        if "from" in value and "to" in value:
            return {"start": int(value["from"]), "end": int(value["to"])}
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        return {"start": int(value[0]), "end": int(value[1])}
    return None


def _section_label(label: str) -> str | None:
    marker = " section "
    if marker not in label:
        return None
    return label.rsplit(marker, 1)[1].strip() or None
