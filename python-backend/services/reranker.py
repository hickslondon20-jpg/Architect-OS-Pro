"""Optional Cohere reranking for RRF-fused retrieval candidates."""

from __future__ import annotations

import json
import logging
from dataclasses import replace
from typing import Any
from urllib import error, request

from core.config import Settings
from services.vector_store import VectorStore

logger = logging.getLogger(__name__)


class CohereReranker:
    def __init__(self, store: VectorStore, settings: Settings) -> None:
        self.store = store
        self.settings = settings

    def rerank_chunks(
        self,
        *,
        query: str,
        chunks: list[Any],
        enabled_override: bool | None = None,
        top_n: int | None = None,
    ) -> list[Any]:
        if not chunks:
            return chunks

        config = self._load_config()
        enabled = config["enabled"] if enabled_override is None else enabled_override
        if not enabled or not self.settings.cohere_api_key:
            return chunks

        rerank_top_n = max(1, min(top_n or config["top_n"], len(chunks)))
        documents = [_serialize_chunk(chunk) for chunk in chunks]
        payload = {
            "model": config["model"],
            "query": query,
            "documents": documents,
            "top_n": rerank_top_n,
        }

        try:
            response = self._post_rerank(payload, timeout_seconds=config["timeout_seconds"])
        except Exception as exc:
            logger.warning("Cohere rerank failed open: %s", exc)
            return chunks

        ranked_chunks: list[Any] = []
        used_indexes: set[int] = set()
        for result in response.get("results", []):
            index = result.get("index")
            if not isinstance(index, int) or index < 0 or index >= len(chunks):
                continue
            used_indexes.add(index)
            ranked_chunks.append(
                replace(
                    chunks[index],
                    rerank_score=_safe_float(result.get("relevance_score")),
                    retrieval_stage="cohere_reranked",
                )
            )

        ranked_chunks.extend(chunk for index, chunk in enumerate(chunks) if index not in used_indexes)
        return ranked_chunks[:rerank_top_n]

    def _load_config(self) -> dict[str, Any]:
        setting = self.store.resolve_platform_setting(
            setting_key="retrieval_reranker",
            fallback_model_name=self.settings.cohere_rerank_model,
            fallback_provider="cohere",
        )
        settings_json = setting.get("settings") or {}
        return {
            "enabled": bool(settings_json.get("enabled", self.settings.rerank_enabled)) and bool(setting.get("is_enabled", True)),
            "model": setting.get("model_name") or self.settings.cohere_rerank_model,
            "top_n": _positive_int(settings_json.get("top_n"), self.settings.rerank_top_n),
            "timeout_seconds": _positive_float(settings_json.get("timeout_seconds"), self.settings.rerank_timeout_seconds),
        }

    def _post_rerank(self, payload: dict[str, Any], timeout_seconds: float) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            "https://api.cohere.com/v2/rerank",
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.settings.cohere_api_key}",
                "Content-Type": "application/json",
                "X-Client-Name": "architectos-pro",
            },
        )
        try:
            with request.urlopen(req, timeout=timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Cohere rerank HTTP {exc.code}: {detail[:500]}") from exc


def _serialize_chunk(chunk: Any) -> str:
    metadata = chunk.metadata or {}
    metadata_lines = []
    for key in (
        "document_title",
        "document_type",
        "business_domain",
        "time_period",
        "topics",
        "keywords",
        "parser_format",
        "section_heading",
    ):
        value = metadata.get(key)
        if value not in (None, "", [], {}):
            metadata_lines.append(f"{key}: {value}")
    prefix = "\n".join(metadata_lines)
    return f"{prefix}\ncontent: {chunk.content}" if prefix else chunk.content


def _positive_int(value: Any, fallback: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return max(1, fallback)
    return max(1, parsed)


def _positive_float(value: Any, fallback: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return max(1.0, fallback)
    return max(1.0, parsed)


def _safe_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
