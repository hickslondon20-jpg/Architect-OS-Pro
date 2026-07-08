from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any, Callable, Iterable

from services.citations.models import CitationRef
from services.citations.normalize import (
    from_agent_source_ref,
    from_provenance_ref,
    from_tool_source_ref,
    from_vcso_stream_ref,
    parse_inline_source_marker,
)

ORDINAL_MARKER_RE = re.compile(r"\[(?P<index>\d+)\]")
INLINE_SOURCE_MARKER_RE = re.compile(
    r"\[\[Source:\s*raw_document:[^#|\]]+(?:#chunk:[^|\]]+)?\|[^\]]+\]\]"
)


@dataclass(frozen=True)
class NumberedCitationRef:
    ordinal: int
    ref: CitationRef


@dataclass(frozen=True)
class BoundCitation:
    ordinal: int | None
    ref: CitationRef
    marker: str
    offset: int
    quote: str | None = None


@dataclass(frozen=True)
class ParsedCitationBindings:
    text: str
    bound: list[BoundCitation]
    cited_refs: list[CitationRef]


def dedupe_citation_refs(refs: Iterable[CitationRef]) -> list[CitationRef]:
    seen: set[tuple[str, str]] = set()
    deduped: list[CitationRef] = []
    for ref in refs:
        key = citation_identity_key(ref)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(ref)
    return deduped


def number_citation_refs(refs: Iterable[CitationRef]) -> list[NumberedCitationRef]:
    return [NumberedCitationRef(ordinal=index, ref=ref) for index, ref in enumerate(dedupe_citation_refs(refs), start=1)]


def citation_identity_key(ref: CitationRef) -> tuple[str, str]:
    if ref.source_id:
        return (ref.source_kind, str(ref.source_id))
    fallback = "|".join(
        [
            ref.verbatim or "",
            ref.source_label or "",
            str(ref.source_metadata.get("raw_source_kind") or ""),
        ]
    )
    digest = hashlib.sha256(fallback.encode("utf-8")).hexdigest()
    return (ref.source_kind, f"content:{digest}")


def parse_answer_citations(answer_text: str, numbered_refs: Iterable[NumberedCitationRef]) -> ParsedCitationBindings:
    by_ordinal = {item.ordinal: item.ref for item in numbered_refs}
    bound: list[BoundCitation] = []

    def replace_ordinal(match: re.Match[str]) -> str:
        marker = match.group(0)
        ordinal = int(match.group("index"))
        ref = by_ordinal.get(ordinal)
        if not ref:
            return ""
        bound.append(BoundCitation(ordinal=ordinal, ref=ref, marker=marker, offset=match.start()))
        return marker

    text = ORDINAL_MARKER_RE.sub(replace_ordinal, answer_text)

    def replace_inline(match: re.Match[str]) -> str:
        marker = match.group(0)
        ref = parse_inline_source_marker(marker)
        quote = _quote_before_marker(text, match.start())
        bound.append(BoundCitation(ordinal=None, ref=ref, marker=marker, offset=match.start(), quote=quote))
        return ""

    text = INLINE_SOURCE_MARKER_RE.sub(replace_inline, text)
    cited_refs = dedupe_citation_refs(item.ref for item in bound)
    return ParsedCitationBindings(text=text, bound=bound, cited_refs=cited_refs)


def format_numbered_source_list(numbered_refs: Iterable[NumberedCitationRef]) -> str:
    lines: list[str] = []
    for item in numbered_refs:
        ref = item.ref
        detail_parts = [
            f"kind={ref.source_kind}",
            f"id={ref.source_id}" if ref.source_id else None,
            f"label={ref.source_label}" if ref.source_label else None,
            f"raw={ref.source_metadata.get('raw_source_kind')}" if ref.source_metadata.get("raw_source_kind") else None,
        ]
        if ref.locator:
            detail_parts.append(f"locator={ref.locator.to_dict()}")
        if ref.verbatim:
            detail_parts.append(f"verbatim={ref.verbatim[:500]}")
        lines.append(f"[{item.ordinal}] " + "; ".join(part for part in detail_parts if part))
    return "\n".join(lines) if lines else "No citation sources were collected for this turn."


def normalize_vcso_turn_sources(
    stream_refs: Iterable[dict[str, Any]],
    source_refs: Iterable[dict[str, Any]],
) -> list[CitationRef]:
    refs: list[CitationRef] = []
    for ref in stream_refs:
        refs.append(from_vcso_stream_ref(ref))
    for ref in source_refs:
        normalized = _normalize_source_ref(ref)
        if normalized:
            refs.append(normalized)
    return dedupe_citation_refs(refs)


def serialize_numbered_refs(numbered_refs: Iterable[NumberedCitationRef]) -> list[dict[str, Any]]:
    return [_with_ordinal(item.ref, item.ordinal) for item in numbered_refs]


def serialize_citation_refs(refs: Iterable[CitationRef]) -> list[dict[str, Any]]:
    return [ref.to_dict() for ref in refs]


def _normalize_source_ref(ref: dict[str, Any]) -> CitationRef | None:
    candidates: tuple[Callable[[dict[str, Any]], CitationRef], ...] = (
        from_provenance_ref,
        from_tool_source_ref,
        from_agent_source_ref,
    )
    for adapter in candidates:
        try:
            return adapter(ref)
        except Exception:
            continue
    return None


def _with_ordinal(ref: CitationRef, ordinal: int) -> dict[str, Any]:
    data = ref.to_dict()
    data["ordinal"] = ordinal
    return data


def _quote_before_marker(text: str, marker_start: int) -> str | None:
    prefix = text[:marker_start].rstrip()
    if not prefix:
        return None
    quoted = re.search(r'["“](?P<quote>[^"”]+)["”]\s*$', prefix)
    if quoted:
        return quoted.group("quote")
    sentence = re.search(r"(?P<quote>[^.!?\n]{12,})\s*$", prefix)
    return sentence.group("quote").strip() if sentence else None
