from __future__ import annotations

import sys
import types
from types import SimpleNamespace

from services.doc_processor import DocumentChunk, process_document_bytes
from services.retrieval import RetrievalService
from services.vector_store import VectorStore


def test_pdf_layout_chunks_capture_geometry_and_dual_faces(monkeypatch):
    install_fake_docling(
        monkeypatch,
        [
            FakeLayoutChunk(
                text="Raw quote face.",
                serialized="Section heading\nRaw quote face.",
                provs=[FakeProv(page_no=2, bbox=FakeBBox(10, 20, 100, 80, "BOTTOMLEFT"))],
            )
        ],
        page_size=(612, 792),
    )

    processed = process_document_bytes(b"%PDF-1.7\n/Font\nBT\n(Hello) Tj\nET", "brief.pdf", "application/pdf")

    assert processed.metadata["docling_export_mode"] == "hybrid_chunker_serialize"
    assert processed.metadata["layout_chunker"] == "HybridChunker"
    assert processed.metadata["ocr_preflight"] == {"enabled": False, "reason": "text_layer_detected"}
    assert len(processed.chunks) == 1
    chunk = processed.chunks[0]
    assert chunk.content == "Section heading\nRaw quote face."
    assert chunk.verbatim == "Raw quote face."
    assert chunk.page_number == 2
    assert chunk.bbox == {
        "page_no": 2,
        "l": 10.0,
        "t": 20.0,
        "r": 100.0,
        "b": 80.0,
        "coord_origin": "BOTTOMLEFT",
        "charspan": [],
        "page_w": 612.0,
        "page_h": 792.0,
    }


def test_scanned_pdf_requests_ocr_and_degrades_when_provenance_is_missing(monkeypatch):
    converter = install_fake_docling(
        monkeypatch,
        [FakeLayoutChunk(text="OCR text face.", serialized="OCR text face.", provs=[])],
        page_size=(612, 792),
    )

    processed = process_document_bytes(b"%PDF-1.7\n/ImageOnly", "scan.pdf", "application/pdf")

    assert processed.metadata["ocr_preflight"] == {"enabled": True, "reason": "no_text_layer_detected"}
    assert converter.last_kwargs["format_options"]["PDF"].pipeline_options.do_ocr is True
    assert processed.chunks[0].content == "OCR text face."
    assert processed.chunks[0].verbatim == "OCR text face."
    assert processed.chunks[0].page_number is None
    assert processed.chunks[0].bbox is None


def test_non_pdf_uses_existing_splitter_with_verbatim_and_null_geometry():
    processed = process_document_bytes(
        b"Heading\n\nPlain text source.",
        "notes.txt",
        "text/plain",
        chunk_size_tokens=100,
        chunk_overlap_tokens=20,
    )

    assert processed.metadata["parser"] == "plain_text"
    assert len(processed.chunks) == 1
    assert processed.chunks[0].content == "Heading\n\nPlain text source."
    assert processed.chunks[0].verbatim == "Heading\n\nPlain text source."
    assert processed.chunks[0].page_number is None
    assert processed.chunks[0].bbox is None


def test_replace_document_chunks_persists_geometry_columns():
    client = FakeClient()
    settings = SimpleNamespace(embedding_model="text-embedding-3-small", embedding_batch_size=100)
    store = VectorStore(client, openai_client=None, settings=settings)
    store._embed_texts = lambda texts, **_kwargs: [[0.1, 0.2, 0.3] for _text in texts]  # type: ignore[method-assign]

    store.replace_document_chunks(
        "doc-1",
        "user-1",
        [
            DocumentChunk(
                content="Enriched face",
                chunk_index=0,
                metadata={"chunk_strategy": "docling_hybrid_layout"},
                page_number=1,
                bbox={"page_no": 1, "l": 1, "t": 2, "r": 3, "b": 4},
                verbatim="Raw face",
            )
        ],
        metadata={"document_title": "Brief"},
    )

    assert client.inserted_rows == [
        {
            "document_id": "doc-1",
            "user_id": "user-1",
            "chunk_index": 0,
            "content": "Enriched face",
            "embedding": [0.1, 0.2, 0.3],
            "embedding_model": "text-embedding-3-small",
            "metadata": {"document_title": "Brief", "chunk_strategy": "docling_hybrid_layout"},
            "page_number": 1,
            "bbox": {"page_no": 1, "l": 1, "t": 2, "r": 3, "b": 4},
            "verbatim": "Raw face",
        }
    ]


def test_hybrid_retrieval_still_returns_sensible_enriched_chunks(monkeypatch):
    store = SimpleNamespace(
        embed_query=lambda query: [0.1, 0.2],
        client=FakeRpcClient(
            [
                {
                    "chunk_id": "chunk-1",
                    "document_id": "doc-1",
                    "content": "Section heading\nRaw quote face.",
                    "metadata": {"chunk_strategy": "docling_hybrid_layout"},
                    "vector_similarity": 0.91,
                    "keyword_rank": 1,
                    "hybrid_score": 0.88,
                    "source_kind": "raw_document_chunk",
                    "vector_rank": 1,
                    "keyword_rank_position": 1,
                    "rrf_score": 0.88,
                }
            ]
        ),
    )

    class NoopReranker:
        def __init__(self, *_args, **_kwargs):
            pass

        def rerank_chunks(self, **kwargs):
            return kwargs["chunks"][: kwargs["top_n"]]

    monkeypatch.setattr("services.retrieval.CohereReranker", NoopReranker)

    results = RetrievalService(store).hybrid_search("user-1", "raw quote", match_count=3)

    assert len(results) == 1
    assert results[0].content == "Section heading\nRaw quote face."
    assert results[0].metadata["chunk_strategy"] == "docling_hybrid_layout"
    assert store.client.rpc_args["query_text"] == "raw quote"


class FakeBBox:
    def __init__(self, l, t, r, b, coord_origin):
        self.l = l
        self.t = t
        self.r = r
        self.b = b
        self.coord_origin = coord_origin


class FakeProv:
    def __init__(self, page_no, bbox, charspan=None):
        self.page_no = page_no
        self.bbox = bbox
        self.charspan = charspan


class FakeLayoutChunk:
    def __init__(self, text, serialized, provs):
        self.text = text
        self.serialized = serialized
        self.meta = SimpleNamespace(doc_items=[SimpleNamespace(prov=provs)])


def install_fake_docling(monkeypatch, chunks, page_size=(612, 792)):
    document = SimpleNamespace(
        chunks=chunks,
        pages={1: SimpleNamespace(size=SimpleNamespace(width=page_size[0], height=page_size[1])), 2: SimpleNamespace(size=SimpleNamespace(width=page_size[0], height=page_size[1]))},
    )

    class FakeDocumentConverter:
        last_kwargs = {}

        def __init__(self, **kwargs):
            type(self).last_kwargs = kwargs

        def convert(self, source):
            assert source
            return SimpleNamespace(document=document)

    class FakeHybridChunker:
        def chunk(self, dl_doc):
            return list(dl_doc.chunks)

        def serialize(self, chunk):
            return chunk.serialized

    class FakePdfPipelineOptions:
        def __init__(self, do_ocr=False):
            self.do_ocr = do_ocr

    class FakePdfFormatOption:
        def __init__(self, pipeline_options):
            self.pipeline_options = pipeline_options

    monkeypatch.setitem(sys.modules, "docling", types.ModuleType("docling"))
    chunking = types.ModuleType("docling.chunking")
    chunking.HybridChunker = FakeHybridChunker
    monkeypatch.setitem(sys.modules, "docling.chunking", chunking)

    document_converter = types.ModuleType("docling.document_converter")
    document_converter.DocumentConverter = FakeDocumentConverter
    document_converter.PdfFormatOption = FakePdfFormatOption
    monkeypatch.setitem(sys.modules, "docling.document_converter", document_converter)

    base_models = types.ModuleType("docling.datamodel.base_models")
    base_models.InputFormat = SimpleNamespace(PDF="PDF")
    monkeypatch.setitem(sys.modules, "docling.datamodel.base_models", base_models)

    pipeline_options = types.ModuleType("docling.datamodel.pipeline_options")
    pipeline_options.PdfPipelineOptions = FakePdfPipelineOptions
    monkeypatch.setitem(sys.modules, "docling.datamodel.pipeline_options", pipeline_options)

    return FakeDocumentConverter


class FakeClient:
    def __init__(self):
        self.inserted_rows = []

    def table(self, _name):
        return self

    def delete(self):
        return self

    def eq(self, *_args):
        return self

    def insert(self, rows):
        self.inserted_rows.extend(rows)
        return self

    def execute(self):
        return SimpleNamespace(data=None)


class FakeRpcClient:
    def __init__(self, rows):
        self.rows = rows
        self.rpc_args = None

    def rpc(self, _name, args):
        self.rpc_args = args
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)
