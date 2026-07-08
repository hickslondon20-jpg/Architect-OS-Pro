from __future__ import annotations

from typing import Any

from services.citations.models import CitationRef


def resolve_web(ref: CitationRef, user_id: str) -> dict[str, Any]:
    return {
        "type": "web_dark",
        "source_kind": "web",
        "source_id": ref.source_id,
        "label": ref.source_label,
        "status": "dark",
        "code": "no_citable_web_producer",
        "message": "Web citations are not resolvable yet because no citable web producer or snapshot store is registered.",
        "snapshot": {
            "url": ref.source_metadata.get("url"),
            "title": ref.source_label,
            "retrieved_at": ref.source_metadata.get("retrieved_at"),
            "content": None,
            "highlights": [],
        },
        "owner_user_id": user_id,
    }
