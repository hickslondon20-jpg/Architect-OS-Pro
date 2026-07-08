from __future__ import annotations

from services.citations.binding import (
    dedupe_citation_refs,
    format_numbered_source_list,
    normalize_vcso_turn_sources,
    number_citation_refs,
    parse_answer_citations,
    serialize_numbered_refs,
)
from services.citations.models import CitationRef


def test_both_pool_collection_dedupes_and_numbers_refs():
    stream_refs = [
        {"kind": "wiki", "label": "Growth Constraints", "pageId": "wiki-1"},
        {"kind": "platform", "label": "MRA checkpoint"},
    ]
    tool_refs = [
        {
            "source_kind": "wiki_page",
            "source_id": "wiki-1",
            "label": "Growth Constraints",
            "metadata": {"page_key": "growth_constraints"},
        },
        {
            "source_kind": "tier0_record",
            "source_id": "checkpoint-1",
            "label": "Checkpoint 1",
            "metadata": {"record_path": "mra_checkpoints/checkpoint-1/stage_assessment"},
        },
        {
            "source_kind": "raw_document_chunk",
            "source_id": "chunk-1",
            "label": "Uploaded brief",
            "verbatim": "The offer is most constrained by delivery capacity.",
            "metadata": {"document_id": "doc-1"},
        },
    ]

    refs = normalize_vcso_turn_sources(stream_refs, tool_refs)
    numbered = number_citation_refs(refs)

    assert [item.ordinal for item in numbered] == [1, 2, 3, 4]
    assert [item.ref.source_kind for item in numbered] == [
        "wiki_page",
        "platform_record",
        "platform_record",
        "document_chunk",
    ]
    assert numbered[0].ref.source_id == "wiki-1"
    assert format_numbered_source_list(numbered).startswith("[1] kind=wiki_page")


def test_dedupe_uses_family_and_source_id_then_content_hash_fallback():
    duplicate_a = CitationRef(source_kind="wiki_page", source_id="wiki-1", source_label="A")
    duplicate_b = CitationRef(source_kind="wiki_page", source_id="wiki-1", source_label="B")
    hash_a = CitationRef(source_kind="document_chunk", source_id=None, source_label="Brief", verbatim="Same quote")
    hash_b = CitationRef(source_kind="document_chunk", source_id=None, source_label="Brief", verbatim="Same quote")

    refs = dedupe_citation_refs([duplicate_a, duplicate_b, hash_a, hash_b])

    assert refs == [duplicate_a, hash_a]


def test_parse_answer_binds_valid_indices_and_strips_out_of_range():
    refs = number_citation_refs(
        [
            CitationRef(source_kind="wiki_page", source_id="wiki-1", source_label="Wiki"),
            CitationRef(source_kind="platform_record", source_id="row-1", source_label="Row"),
        ]
    )

    parsed = parse_answer_citations("Use the wiki [1], the row [2], and never this [9].", refs)

    assert parsed.text == "Use the wiki [1], the row [2], and never this ."
    assert [(item.ordinal, item.ref.source_id) for item in parsed.bound] == [(1, "wiki-1"), (2, "row-1")]
    assert [ref.source_id for ref in parsed.cited_refs] == ["wiki-1", "row-1"]


def test_parse_answer_lifts_inline_source_marker_for_verbatim_quote():
    refs = number_citation_refs([CitationRef(source_kind="wiki_page", source_id="wiki-1", source_label="Wiki")])

    parsed = parse_answer_citations(
        'The source says "delivery capacity is the constraint" [[Source: raw_document:doc-1#chunk:chunk-7|Ops brief section Delivery]].',
        refs,
    )

    assert "[[Source:" not in parsed.text
    assert parsed.bound[0].ordinal is None
    assert parsed.bound[0].ref.source_kind == "document_chunk"
    assert parsed.bound[0].ref.source_id == "chunk-7"
    assert parsed.bound[0].quote == "delivery capacity is the constraint"
    assert parsed.cited_refs[0].source_id == "chunk-7"


def test_serialized_numbered_refs_are_reload_safe_citationref_shape():
    numbered = number_citation_refs([CitationRef(source_kind="platform_record", source_id="row-1", source_label="Row")])

    serialized = serialize_numbered_refs(numbered)

    assert serialized == [
        {
            "ordinal": 1,
            "source_kind": "platform_record",
            "source_id": "row-1",
            "source_label": "Row",
            "verbatim": None,
            "locator": None,
            "source_metadata": {},
        }
    ]
