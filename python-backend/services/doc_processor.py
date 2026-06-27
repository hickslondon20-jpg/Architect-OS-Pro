"""Document parsing and token-aware chunking helpers for the ingestion backend."""

from __future__ import annotations

import csv
import io
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter


@dataclass(frozen=True)
class DocumentChunk:
    content: str
    chunk_index: int
    metadata: dict[str, Any]


@dataclass(frozen=True)
class ProcessedDocument:
    text: str
    chunks: list[DocumentChunk]
    metadata: dict[str, Any]


def _token_counter() -> Any:
    try:
        return tiktoken.get_encoding("cl100k_base")
    except Exception:
        return None


def _token_length(text: str) -> int:
    encoder = _token_counter()
    if encoder is None:
        return max(1, len(text) // 4)
    return len(encoder.encode(text))


def _read_csv(file_bytes: bytes) -> tuple[str, dict[str, Any]]:
    text = file_bytes.decode("utf-8-sig", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return "", {"parser": "csv", "row_count": 0, "column_count": 0}

    header = rows[0]
    lines = ["Table columns: " + ", ".join(header)]
    for row_number, row in enumerate(rows[1:], start=2):
        pairs = []
        for index, value in enumerate(row):
            label = header[index] if index < len(header) and header[index] else f"column_{index + 1}"
            pairs.append(f"{label}: {value}")
        lines.append(f"Row {row_number}: " + "; ".join(pairs))

    return "\n".join(lines), {
        "parser": "csv",
        "row_count": max(0, len(rows) - 1),
        "column_count": len(header),
        "preserves_rows": True,
    }


def _read_with_docling(file_bytes: bytes, file_name: str) -> tuple[str, dict[str, Any]]:
    from docling.document_converter import DocumentConverter

    suffix = Path(file_name).suffix or ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        result = DocumentConverter().convert(tmp_path)
        document = result.document
        if hasattr(document, "export_to_markdown"):
            text = document.export_to_markdown()
            parser = "docling_markdown"
        else:
            text = str(document)
            parser = "docling_string"
        return text, {"parser": parser, "preserves_structure": True}
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _split_text(text: str, file_type: str, chunk_size_tokens: int, chunk_overlap_tokens: int) -> list[str]:
    if not text.strip():
        return []

    if file_type.lower() in {"csv", "xlsx"}:
        separators = ["\nRow ", "\n## ", "\n### ", "\n", "; ", " ", ""]
    else:
        separators = ["\n## ", "\n### ", "\n", ". ", " ", ""]

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size_tokens,
        chunk_overlap=chunk_overlap_tokens,
        length_function=_token_length,
        separators=separators,
    )
    return [chunk.strip() for chunk in splitter.split_text(text) if chunk.strip()]


def process_document_bytes(
    file_bytes: bytes,
    file_name: str,
    file_type: str,
    chunk_size_tokens: int = 1000,
    chunk_overlap_tokens: int = 200,
) -> ProcessedDocument:
    normalized_type = file_type.lower().lstrip(".")
    if normalized_type == "csv":
        text, parser_metadata = _read_csv(file_bytes)
    elif normalized_type in {"txt", "md"}:
        text = file_bytes.decode("utf-8", errors="replace")
        parser_metadata = {"parser": "plain_text"}
    else:
        text, parser_metadata = _read_with_docling(file_bytes, file_name)

    raw_chunks = _split_text(text, normalized_type, chunk_size_tokens, chunk_overlap_tokens)
    chunks = [
        DocumentChunk(
            content=chunk,
            chunk_index=index,
            metadata={
                "file_type": normalized_type,
                "token_count": _token_length(chunk),
                "chunk_strategy": "recursive_token",
            },
        )
        for index, chunk in enumerate(raw_chunks)
    ]

    return ProcessedDocument(
        text=text,
        chunks=chunks,
        metadata={
            **parser_metadata,
            "file_name": file_name,
            "file_type": normalized_type,
            "chunk_count": len(chunks),
            "chunk_size_tokens": chunk_size_tokens,
            "chunk_overlap_tokens": chunk_overlap_tokens,
        },
    )
