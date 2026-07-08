from dataclasses import dataclass, field

import pytest

from services.citations.models import RAW_TO_FAMILY, CitationRef, Locator, normalize_source_kind
from services.citations.normalize import (
    from_agent_source_ref,
    from_docwiki_citation,
    from_provenance_ref,
    from_retrieved_chunk,
    from_tool_source_ref,
    from_vcso_stream_ref,
    from_wiki_evidence,
    parse_inline_source_marker,
)


@dataclass(frozen=True)
class AgentSourceRefFixture:
    source_kind: str
    source_id: str | None
    source_label: str | None = None
    source_metadata: dict = field(default_factory=dict)
    citation_payload: dict = field(default_factory=dict)


@dataclass(frozen=True)
class ToolSourceRefFixture:
    source_kind: str
    source_id: str | None
    verbatim: str | None = None
    label: str | None = None
    metadata: dict = field(default_factory=dict)


@dataclass(frozen=True)
class RetrievedChunkFixture:
    chunk_id: str
    document_id: str
    content: str
    metadata: dict
    vector_similarity: float
    keyword_rank: float
    hybrid_score: float
    source_kind: str = "raw_document_chunk"
    vector_rank: int | None = None
    keyword_rank_position: int | None = None
    rrf_score: float | None = None
    rerank_score: float | None = None
    retrieval_stage: str = "rrf_fused"


def test_citation_ref_round_trips_and_serializes_agent_payload():
    ref = CitationRef(
        source_kind="document_chunk",
        source_id="chunk-1",
        source_label="Strategy Doc",
        verbatim="exact quote",
        locator=Locator(kind="lines", path="docs/strategy.md", lines={"start": 4, "end": 8}),
        source_metadata={"raw_source_kind": "raw_document_chunk"},
    )

    assert CitationRef.from_dict(ref.to_dict()) == ref
    agent_dict = ref.to_agent_source_ref_dict({"chunk_id": "chunk-1"})
    assert agent_dict["source_kind"] == "raw_document_chunk"
    assert agent_dict["citation_payload"]["citation_version"] == "citation-1.0"
    assert agent_dict["citation_payload"]["verbatim"] == "exact quote"
    assert agent_dict["citation_payload"]["locator"]["kind"] == "lines"
    assert agent_dict["citation_payload"]["chunk_id"] == "chunk-1"


def test_from_agent_source_ref_preserves_payload_locator_and_raw_kind():
    source = AgentSourceRefFixture(
        source_kind="wiki_page",
        source_id="page-1",
        source_label="Business Context",
        source_metadata={"page_key": "business_context"},
        citation_payload={
            "verbatim": "quoted page text",
            "locator": {"kind": "page_key", "page_key": "business_context"},
        },
    )

    ref = from_agent_source_ref(source)

    assert ref == CitationRef(
        source_kind="wiki_page",
        source_id="page-1",
        source_label="Business Context",
        verbatim="quoted page text",
        locator=Locator(kind="page_key", page_key="business_context"),
        source_metadata={"page_key": "business_context", "raw_source_kind": "wiki_page"},
    )


def test_from_tool_source_ref_maps_label_metadata_and_verbatim():
    source = ToolSourceRefFixture(
        source_kind="raw_document",
        source_id="doc-1",
        verbatim="file content",
        label="Client Brief",
        metadata={"start_line": 10, "end_line": 20},
    )

    ref = from_tool_source_ref(source)

    assert ref.source_kind == "document_chunk"
    assert ref.source_label == "Client Brief"
    assert ref.verbatim == "file content"
    assert ref.locator == Locator(kind="lines", lines={"start": 10, "end": 20})
    assert ref.source_metadata["raw_source_kind"] == "raw_document"


def test_from_docwiki_citation_uses_canonical_key_as_source_id():
    ref = from_docwiki_citation(
        {
            "source_kind": "wiki_page",
            "canonical_key": "offer-positioning",
            "title": "Offer Positioning",
            "page_kind": "offer",
            "similarity": 0.82,
        }
    )

    assert ref.source_kind == "wiki_page"
    assert ref.source_id == "offer-positioning"
    assert ref.source_label == "Offer Positioning"
    assert ref.source_metadata == {
        "canonical_key": "offer-positioning",
        "page_kind": "offer",
        "similarity": 0.82,
        "raw_source_kind": "wiki_page",
    }


def test_from_wiki_evidence_maps_path_lines_weight_and_note():
    ref = from_wiki_evidence(
        {
            "source_id": "record-1",
            "source_kind": "tier0_record",
            "path": "mra/checkpoints/1",
            "lines": {"start": 2, "end": 5},
            "weight": 0.7,
            "note": "Supports claim.",
        }
    )

    assert ref.source_kind == "platform_record"
    assert ref.source_label == "mra/checkpoints/1"
    assert ref.locator == Locator(kind="lines", path="mra/checkpoints/1", lines={"start": 2, "end": 5})
    assert ref.source_metadata == {"weight": 0.7, "note": "Supports claim.", "raw_source_kind": "tier0_record"}


def test_from_retrieved_chunk_maps_content_to_verbatim():
    chunk = RetrievedChunkFixture(
        chunk_id="chunk-9",
        document_id="doc-9",
        content="retrieved chunk text",
        metadata={"document_title": "Ops Manual"},
        vector_similarity=0.91,
        keyword_rank=0.2,
        hybrid_score=0.77,
        vector_rank=1,
        keyword_rank_position=3,
        rrf_score=0.44,
        rerank_score=0.88,
    )

    ref = from_retrieved_chunk(chunk)

    assert ref.source_kind == "document_chunk"
    assert ref.source_id == "chunk-9"
    assert ref.source_label == "Ops Manual"
    assert ref.verbatim == "retrieved chunk text"
    assert ref.source_metadata["document_id"] == "doc-9"
    assert ref.source_metadata["raw_source_kind"] == "raw_document_chunk"


def test_parse_inline_source_marker_handles_chunk_present_and_absent():
    with_chunk = parse_inline_source_marker(
        "[[Source: raw_document:doc-1#chunk:chunk-1|Client Brief section Pricing]]"
    )
    without_chunk = parse_inline_source_marker("[[Source: raw_document:doc-2|Strategy Memo section Context]]")

    assert with_chunk.source_id == "chunk-1"
    assert with_chunk.source_kind == "document_chunk"
    assert with_chunk.source_metadata == {"document_id": "doc-1", "raw_source_kind": "raw_document"}
    assert with_chunk.locator == Locator(kind="section", section_label="Pricing")
    assert without_chunk.source_id == "doc-2"
    assert without_chunk.source_metadata["document_id"] == "doc-2"


def test_from_vcso_stream_ref_maps_display_kind_axis():
    assert from_vcso_stream_ref({"kind": "wiki", "label": "Page", "pageId": "page-1"}).source_kind == "wiki_page"
    assert from_vcso_stream_ref({"kind": "platform", "label": "mra results"}).source_kind == "platform_record"
    ip_ref = from_vcso_stream_ref({"kind": "ip", "label": "Sequence The Priority"})
    assert ip_ref.source_kind == "wiki_page"
    assert ip_ref.source_metadata["raw_source_kind"] == "global_ip_page"
    assert from_vcso_stream_ref({"kind": "context", "label": "linked: folder"}).source_kind == "derived"


def test_from_provenance_ref_normalizes_citation_adjacent_dicts():
    ref = from_provenance_ref(
        {
            "source_kind": "founder_dataset",
            "source_id": "dataset-1",
            "source_label": "Revenue",
            "source_metadata": {"record_path": "founder_datasets/dataset-1/rows"},
            "citation_payload": {},
        }
    )

    assert ref.source_kind == "platform_record"
    assert ref.locator == Locator(kind="record_path", record_path="founder_datasets/dataset-1/rows")
    assert ref.source_metadata["raw_source_kind"] == "founder_dataset"


def test_raw_to_family_is_exhaustive_over_research_taxonomy_and_unknown_warns(caplog):
    expected = {
        "raw_document",
        "document_chunk",
        "raw_document_chunk",
        "wiki_page",
        "wiki_claim",
        "wiki_digest",
        "global_ip_page",
        "tier0_record",
        "founder_dataset",
        "dataset_row",
        "global_checkpoint",
        "web",
        "computation",
        "skill_file",
        "skill_pack",
        "sub_agent_run",
        "workspace_file",
        "agent_todos",
        "human_input",
        "mcp",
        "tool_registry",
    }

    assert set(RAW_TO_FAMILY) == expected
    assert all(normalize_source_kind(raw) in {"document_chunk", "wiki_page", "platform_record", "web", "derived"} for raw in expected)
    with caplog.at_level("WARNING"):
        assert normalize_source_kind("new_future_kind") == "derived"
    assert "Unknown citation source_kind" in caplog.text


def test_invalid_inline_source_marker_raises():
    with pytest.raises(ValueError):
        parse_inline_source_marker("[[Source: unsupported]]")
