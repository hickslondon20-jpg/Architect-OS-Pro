from __future__ import annotations

from typing import TYPE_CHECKING, Any

from services.citations.models import CitationRef
from services.citations.resolvers.chunk_resolver import resolve_chunk
from services.citations.resolvers.platform_record_resolver import resolve_platform_record
from services.citations.resolvers.web_resolver import resolve_web
from services.citations.resolvers.wiki_resolver import resolve_wiki

if TYPE_CHECKING:
    from services.vector_store import VectorStore


def resolve(ref: CitationRef, user_id: str, store: "VectorStore") -> dict[str, Any]:
    owner = ref.source_metadata.get("user_id") or ref.source_metadata.get("owner_user_id")
    if owner and str(owner) != str(user_id):
        return {
            "type": "error",
            "source_kind": ref.source_kind,
            "source_id": ref.source_id,
            "code": "unauthorized",
            "message": "Citation ref owner does not match caller.",
        }

    if ref.source_kind == "document_chunk":
        return resolve_chunk(ref, user_id, store)
    if ref.source_kind == "wiki_page":
        return resolve_wiki(ref, user_id, store)
    if ref.source_kind == "platform_record":
        return resolve_platform_record(ref, user_id, store)
    if ref.source_kind == "web":
        return resolve_web(ref, user_id)
    if ref.source_kind == "derived":
        return {
            "type": "not_citable",
            "source_kind": "derived",
            "source_id": ref.source_id,
            "code": "trace_only",
            "message": "Derived refs are trace-only and do not resolve to citation source views.",
            "trace": {
                "label": ref.source_label,
                "raw_source_kind": ref.source_metadata.get("raw_source_kind"),
                "metadata": ref.source_metadata,
            },
        }
    return {
        "type": "error",
        "source_kind": ref.source_kind,
        "source_id": ref.source_id,
        "code": "unsupported_source_kind",
        "message": f"Unsupported citation source kind: {ref.source_kind}",
    }


__all__ = ["resolve"]
