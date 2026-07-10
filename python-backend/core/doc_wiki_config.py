"""Document Wiki schema config loader."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_CONFIG_PATHS = [
    Path(__file__).parent.parent / "config" / "doc_wiki_schema.json",
    Path(__file__).parent.parent.parent / "src" / "config" / "doc_wiki_schema.json",
]
_DOC_WIKI_CONFIG: dict[str, Any] | None = None


def get_doc_wiki_config() -> dict[str, Any]:
    """Load the doc wiki schema config (page_kind vocabulary, category/type maps)."""
    for path in _CONFIG_PATHS:
        if path.exists():
            with path.open(encoding="utf-8") as file:
                return json.load(file)
    searched = ", ".join(str(path) for path in _CONFIG_PATHS)
    raise FileNotFoundError(f"Could not find doc_wiki_schema.json. Searched: {searched}")


def doc_wiki_config() -> dict[str, Any]:
    global _DOC_WIKI_CONFIG
    if _DOC_WIKI_CONFIG is None:
        _DOC_WIKI_CONFIG = get_doc_wiki_config()
    return _DOC_WIKI_CONFIG
