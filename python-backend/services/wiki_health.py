"""Validation and health wrappers for the ArchitectOS per-user wiki."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from services.vector_store import VectorStore

logger = logging.getLogger(__name__)


class WikiHealthError(RuntimeError):
    pass


@dataclass(frozen=True)
class ValidationSummary:
    user_id: str
    finding_count: int
    counts: dict[str, int]


class WikiHealthService:
    def __init__(self, store: "VectorStore") -> None:
        self.store = store

    @classmethod
    def from_env(cls) -> "WikiHealthService":
        from services.vector_store import VectorStore

        return cls(VectorStore.from_env())

    def validation_findings(self, user_id: str) -> list[dict[str, Any]]:
        try:
            return self.store.client.rpc("wiki_validation_findings", {"p_user_id": user_id}).execute().data or []
        except Exception as exc:
            raise WikiHealthError(f"Wiki validation failed: {exc}") from exc

    def health(self, user_id: str) -> dict[str, Any]:
        try:
            return self.store.client.rpc("wiki_health", {"p_user_id": user_id}).execute().data or {}
        except Exception as exc:
            raise WikiHealthError(f"Wiki health failed: {exc}") from exc

    def run_post_compile(self, user_id: str, page_key: str) -> ValidationSummary:
        health = self.health(user_id)
        counts = health.get("counts") or {}
        finding_count = sum(int(value or 0) for value in counts.values())
        if finding_count:
            logger.info(
                "wiki_post_compile_validation_findings",
                extra={"user_id": user_id, "page_key": page_key, "counts": counts},
            )
        return ValidationSummary(user_id=user_id, finding_count=finding_count, counts=counts)
