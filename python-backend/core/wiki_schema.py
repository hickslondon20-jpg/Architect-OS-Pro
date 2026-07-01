"""Canonical ArchitectOS wiki schema declaration and helper predicates."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

WIKI_SCHEMA_PATH = Path(__file__).resolve().parents[2] / "config" / "wiki_schema.json"


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
