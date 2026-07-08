"""Canonical ArchitectOS wiki schema declaration and helper predicates."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

# Two candidate locations, tried in order:
#   1. <repo-root>/config/wiki_schema.json - the monorepo layout used in local/dev checkouts,
#      where python-backend/ and config/ are siblings under the repo root.
#   2. <python-backend>/config/wiki_schema.json - a deploy-local copy, since some hosting
#      environments (confirmed live on Railway, 2026-07-08) only ship the python-backend/
#      subtree as the app root, so the repo-root config/ folder never reaches the container and
#      the 3-levels-up path silently resolves past the filesystem root. Keep both copies in sync
#      if wiki_schema.json changes; core/wiki_schema.py is the only reader either way.
_CANDIDATE_SCHEMA_PATHS = [
    Path(__file__).resolve().parents[2] / "config" / "wiki_schema.json",
    Path(__file__).resolve().parents[1] / "config" / "wiki_schema.json",
]


def _resolve_wiki_schema_path() -> Path:
    for candidate in _CANDIDATE_SCHEMA_PATHS:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        "wiki_schema.json not found in any candidate location: "
        + ", ".join(str(p) for p in _CANDIDATE_SCHEMA_PATHS)
    )


WIKI_SCHEMA_PATH = _resolve_wiki_schema_path()


@lru_cache(maxsize=1)
def get_wiki_schema() -> dict[str, Any]:
    with WIKI_SCHEMA_PATH.open("r", encoding="utf-8") as schema_file:
        return json.load(schema_file)


def valid_page_key(page_key: str) -> bool:
    return page_key in get_wiki_schema()["pages"]


def is_compiled_base_only(page_key: str) -> bool:
    schema = get_wiki_schema()
    return valid_page_key(page_key) and schema["pages"][page_key]["kind"] == "compiled_base_only"


def is_insight_accreting(page_key: str) -> bool:
    schema = get_wiki_schema()
    return valid_page_key(page_key) and schema["pages"][page_key]["kind"] == "insight_accreting"


def valid_confidence(value: str) -> bool:
    return value in get_wiki_schema()["confidence_enum"]


def valid_tag(tag: str) -> bool:
    taxonomy = get_wiki_schema()["tag_taxonomy"]
    stage_tags = {str(stage["id"]) for stage in taxonomy["stages"]} | {stage["name"] for stage in taxonomy["stages"]}
    return tag in taxonomy["domains"] or tag in taxonomy["tiers"] or tag in stage_tags


def event_rebuild_targets(event: str) -> list[str]:
    return list(get_wiki_schema()["event_rebuild_targets"].get(event, []))
