from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Literal

logger = logging.getLogger(__name__)

SourceKind = Literal["document_chunk", "wiki_page", "platform_record", "web", "derived"]
LocatorKind = Literal["lines", "section", "page_key", "record_path", "bbox", "url_fragment"]

FAMILY_SOURCE_KINDS: tuple[str, ...] = (
    "document_chunk",
    "wiki_page",
    "platform_record",
    "web",
    "derived",
)

RAW_TO_FAMILY: dict[str, str] = {
    "raw_document": "document_chunk",
    "document_chunk": "document_chunk",
    "raw_document_chunk": "document_chunk",
    "wiki_page": "wiki_page",
    "wiki_claim": "wiki_page",
    "wiki_digest": "wiki_page",
    "global_ip_page": "wiki_page",
    "tier0_record": "platform_record",
    "founder_dataset": "platform_record",
    "dataset_row": "platform_record",
    "global_checkpoint": "platform_record",
    "web": "web",
    "computation": "derived",
    "skill_file": "derived",
    "skill_pack": "derived",
    "sub_agent_run": "derived",
    "workspace_file": "derived",
    "agent_todos": "derived",
    "human_input": "derived",
    "mcp": "derived",
    "tool_registry": "derived",
}


def normalize_source_kind(raw_source_kind: str | None) -> str:
    raw = str(raw_source_kind or "").strip()
    if raw in RAW_TO_FAMILY:
        return RAW_TO_FAMILY[raw]
    logger.warning("Unknown citation source_kind %r; normalizing to derived.", raw_source_kind)
    return "derived"


@dataclass(frozen=True)
class Locator:
    kind: LocatorKind
    path: str | None = None
    lines: dict[str, int] | None = None
    section_label: str | None = None
    page_key: str | None = None
    record_path: str | None = None
    page_number: int | None = None
    bbox: list[float] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "path": self.path,
            "lines": self.lines,
            "section_label": self.section_label,
            "page_key": self.page_key,
            "record_path": self.record_path,
            "page_number": self.page_number,
            "bbox": self.bbox,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "Locator | None":
        if not data:
            return None
        return cls(
            kind=data["kind"],
            path=data.get("path"),
            lines=_coerce_lines(data.get("lines")),
            section_label=data.get("section_label"),
            page_key=data.get("page_key"),
            record_path=data.get("record_path"),
            page_number=data.get("page_number"),
            bbox=list(data["bbox"]) if data.get("bbox") is not None else None,
        )


@dataclass(frozen=True)
class CitationRef:
    source_kind: SourceKind
    source_id: str | None
    source_label: str | None = None
    verbatim: str | None = None
    locator: Locator | None = None
    source_metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_kind": self.source_kind,
            "source_id": self.source_id,
            "source_label": self.source_label,
            "verbatim": self.verbatim,
            "locator": self.locator.to_dict() if self.locator else None,
            "source_metadata": dict(self.source_metadata),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CitationRef":
        return cls(
            source_kind=data["source_kind"],
            source_id=data.get("source_id"),
            source_label=data.get("source_label"),
            verbatim=data.get("verbatim"),
            locator=Locator.from_dict(data.get("locator")),
            source_metadata=dict(data.get("source_metadata") or {}),
        )

    def to_agent_source_ref_dict(self, citation_payload: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = dict(citation_payload or {})
        payload["citation_version"] = "citation-1.0"
        if self.verbatim is not None:
            payload["verbatim"] = self.verbatim
        if self.locator is not None:
            payload["locator"] = self.locator.to_dict()
        return {
            "source_kind": self.source_metadata.get("raw_source_kind") or self.source_kind,
            "source_id": self.source_id,
            "source_label": self.source_label,
            "source_metadata": dict(self.source_metadata),
            "citation_payload": payload,
        }


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

