from __future__ import annotations

from typing import TYPE_CHECKING, Any

from services.citations.models import CitationRef
from services.doc_wiki_read_service import DocWikiReadError, DocWikiReadService
from services.wiki_read import WikiReadError, WikiReadService

if TYPE_CHECKING:
    from services.vector_store import VectorStore


def resolve_wiki(ref: CitationRef, user_id: str, store: "VectorStore") -> dict[str, Any]:
    raw_kind = ref.source_metadata.get("raw_source_kind") or ref.source_kind
    try:
        if raw_kind == "wiki_claim":
            return _claim_view(ref, WikiReadService(store).get_claim(user_id, _required_source_id(ref)))

        page_key = _page_key(ref)
        if page_key:
            return _page_view(ref, WikiReadService(store).get_page(user_id, page_key), tier="tier_1")

        canonical_key = ref.source_metadata.get("canonical_key") or ref.source_id
        page_id = ref.source_metadata.get("page_id")
        result = DocWikiReadService(store).get_page(
            user_id,
            canonical_key=str(canonical_key) if canonical_key else None,
            page_id=str(page_id) if page_id else None,
        )
        return _page_view(ref, result, tier="tier_2")
    except (ValueError, WikiReadError, DocWikiReadError) as exc:
        return _error(ref, "unresolvable", str(exc) or "Wiki source could not be resolved.")


def _required_source_id(ref: CitationRef) -> str:
    if not ref.source_id:
        raise ValueError("Wiki claim citation is missing a source id.")
    return ref.source_id


def _page_key(ref: CitationRef) -> str | None:
    if ref.locator and ref.locator.page_key:
        return ref.locator.page_key
    value = ref.source_metadata.get("page_key")
    return str(value) if value else None


def _claim_view(ref: CitationRef, result: dict[str, Any]) -> dict[str, Any]:
    finding = (result.get("findings") or [{}])[0]
    claim = finding.get("claim") or {}
    return {
        "type": "wiki",
        "source_kind": "wiki_page",
        "source_id": ref.source_id,
        "label": ref.source_label or claim.get("text"),
        "wiki_kind": "claim",
        "tier": "tier_1",
        "summary": result.get("summary"),
        "prose": claim.get("text") or result.get("summary") or "",
        "claim": claim,
        "evidence": claim.get("evidence") or [],
        "locator": {
            "kind": "page_key",
            "page_key": claim.get("page_key") or ref.source_metadata.get("page_key"),
            "page_number": None,
            "bbox": None,
        },
        "result": result,
    }


def _page_view(ref: CitationRef, result: dict[str, Any], *, tier: str) -> dict[str, Any]:
    finding = (result.get("findings") or [{}])[0]
    content = finding.get("content") or finding.get("one_line") or result.get("summary") or ""
    page_key = finding.get("page_key") or finding.get("canonical_key") or ref.source_metadata.get("page_key")
    return {
        "type": "wiki",
        "source_kind": "wiki_page",
        "source_id": ref.source_id or finding.get("page_id") or page_key,
        "label": ref.source_label or finding.get("title"),
        "wiki_kind": "page",
        "tier": tier,
        "summary": result.get("summary"),
        "prose": content,
        "page": finding,
        "evidence": _evidence_from_page(finding),
        "locator": {
            "kind": "page_key",
            "page_key": page_key,
            "page_number": None,
            "bbox": None,
        },
        "result": result,
    }


def _evidence_from_page(finding: dict[str, Any]) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    for claim in finding.get("claims") or []:
        evidence.extend(claim.get("evidence") or [])
    return evidence


def _error(ref: CitationRef, code: str, message: str) -> dict[str, Any]:
    return {
        "type": "error",
        "source_kind": ref.source_kind,
        "source_id": ref.source_id,
        "code": code,
        "message": message,
    }
