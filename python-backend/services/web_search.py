"""Disabled-by-default external web search scaffold."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from core.config import Settings, get_settings


@dataclass(frozen=True)
class WebSearchResult:
    enabled: bool
    provider: str | None
    retrieved_at: str
    results: list[dict[str, str]]
    message: str


class WebSearchService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @classmethod
    def from_env(cls) -> "WebSearchService":
        return cls(get_settings())

    def search(self, query: str, *, include_private_context: bool = False) -> WebSearchResult:
        if include_private_context:
            return self._disabled("Private founder context is not allowed in external web search queries.")
        if not self.settings.web_search_enabled or not self.settings.web_search_provider:
            return self._disabled("Web search fallback is disabled until provider, key, citation, and privacy policy are configured.")
        return self._disabled("Web search provider execution is not implemented in Module 7.")

    def _disabled(self, message: str) -> WebSearchResult:
        return WebSearchResult(
            enabled=False,
            provider=self.settings.web_search_provider,
            retrieved_at=datetime.now(timezone.utc).isoformat(),
            results=[],
            message=message,
        )
