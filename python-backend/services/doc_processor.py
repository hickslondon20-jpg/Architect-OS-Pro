"""Document parsing and token-aware chunking helpers for the ingestion backend."""

from __future__ import annotations

import csv
import io
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter

try:
    from importlib.metadata import version
except ImportError:  # pragma: no cover
    version = None  # type: ignore[assignment]


DOCLING_FORMATS: dict[str, dict[str, Any]] = {
    "pdf": {"family": "document", "parser": "docling", "extensions": {"pdf"}},
    "word": {"family": "document", "parser": "docling", "extensions": {"docx", "doc"}},
    "powerpoint": {"family": "presentation", "parser": "docling", "extensions": {"pptx", "ppt"}},
    "workbook": {"family": "workbook", "parser": "docling", "extensions": {"xlsx", "xls"}},
    "html": {"family": "html", "parser": "docling", "extensions": {"html", "htm", "xhtml"}},
    "markdown": {"family": "markdown", "parser": "plain_text", "extensions": {"md", "markdown", "adoc", "asciidoc"}},
    "text": {"family": "text", "parser": "plain_text", "extensions": {"txt", "text", "rtf"}},
    "csv": {"family": "table", "parser": "csv_structured", "extensions": {"csv", "tsv"}},
    "opendocument": {"family": "document", "parser": "docling", "extensions": {"odt", "ods", "odp"}},
    "epub": {"family": "document", "parser": "docling", "extensions": {"epub"}},
    "image": {"family": "image", "parser": "docling", "extensions": {"png", "jpg", "jpeg", "tif", "tiff", "bmp", "webp"}},
    "xml": {"family": "xml", "parser": "docling", "extensions": {"xml", "xbrl"}},
    "json": {"family": "docling_json", "parser": "docling", "extensions": {"json"}},
}

SUPPORTED_EXTENSIONS: dict[str, dict[str, Any]] = {
    extension: {"format_key": format_key, **metadata}
    for format_key, metadata in DOCLING_FORMATS.items()
    for extension in metadata["extensions"]
}

_DOC_HEADING_RE = re.compile(r"^(#{1,6}\s+.+|[A-Z][A-Za-z0-9 &/,\-]{2,80})$")


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
    sample = text[:2048]
    delimiter = "\t" if "\t" in sample and sample.count("\t") >= sample.count(",") else ","
    rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    if not rows:
        return "", {
            "parser": "csv_structured",
            "format_family": "table",
            "row_count": 0,
            "column_count": 0,
            "table_count": 0,
            "preserves_structure": True,
            "warnings": ["No rows were found in the CSV file."],
            "extraction_quality": "empty",
        }

    header = rows[0]
    lines = ["## CSV table", "Table columns: " + ", ".join(header)]
    for row_number, row in enumerate(rows[1:], start=2):
        pairs = []
        for index, value in enumerate(row):
            label = header[index] if index < len(header) and header[index] else f"column_{index + 1}"
            pairs.append(f"{label}: {value}")
        lines.append(f"Row {row_number}: " + "; ".join(pairs))

    return "\n".join(lines), {
        "parser": "csv_structured",
        "format_family": "table",
        "row_count": max(0, len(rows) - 1),
        "column_count": len(header),
        "table_count": 1,
        "preserves_structure": True,
        "warnings": [],
        "extraction_quality": "structured",
    }


def _docling_version() -> str | None:
    if version is None:
        return None
    try:
        return version("docling")
    except Exception:
        return None


def _read_with_docling(file_bytes: bytes, file_name: str, format_family: str) -> tuple[str, dict[str, Any]]:
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
            export_mode = "markdown"
        else:
            text = str(document)
            export_mode = "string"

        metadata = _infer_structure_metadata(text, format_family)
        metadata.update(
            {
                "parser": "docling",
                "parser_version": _docling_version(),
                "format_family": format_family,
                "docling_export_mode": export_mode,
                "preserves_structure": True,
                "warnings": [],
                "extraction_quality": "structured" if text.strip() else "empty",
            }
        )
        if not text.strip():
            metadata["warnings"] = ["Docling conversion returned no text."]
        return text, metadata
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _read_plain_text(file_bytes: bytes, format_family: str) -> tuple[str, dict[str, Any]]:
    text = file_bytes.decode("utf-8", errors="replace")
    metadata = _infer_structure_metadata(text, format_family)
    metadata.update(
        {
            "parser": "plain_text",
            "format_family": format_family,
            "preserves_structure": format_family in {"markdown", "html"},
            "warnings": [],
            "extraction_quality": "text" if text.strip() else "empty",
        }
    )
    return text, metadata


def _infer_structure_metadata(text: str, format_family: str) -> dict[str, Any]:
    lines = [line.strip() for line in text.splitlines()]
    headings = [line for line in lines if line.startswith("#")]
    return {
        "page_count": len(re.findall(r"\bpage\s+\d+\b", text, flags=re.IGNORECASE)) or None,
        "sheet_count": len(re.findall(r"^#{1,3}\s*Sheet\b", text, flags=re.IGNORECASE | re.MULTILINE)) or None,
        "table_count": max(text.count("\n|"), len(re.findall(r"\btable\b", text, flags=re.IGNORECASE))) or None,
        "image_count": len(re.findall(r"!\[|<img\b", text, flags=re.IGNORECASE)) or None,
        "section_count": len(headings) or None,
        "section_headings": headings[:20],
        "format_family": format_family,
    }


def _normalize_file_type(file_name: str, file_type: str) -> tuple[str, dict[str, Any]]:
    raw_type = (file_type or "").lower().strip().split(";")[0]
    suffix = Path(file_name).suffix.lower().lstrip(".")
    normalized = raw_type.split("/")[-1].replace("vnd.openxmlformats-officedocument.", "").replace("x-", "")
    candidates = [suffix, raw_type, normalized]
    mime_map = {
        "ms-excel": "xls",
        "spreadsheetml.sheet": "xlsx",
        "wordprocessingml.document": "docx",
        "presentationml.presentation": "pptx",
        "plain": "txt",
        "jpeg": "jpg",
    }
    candidates.extend(mime_map.get(candidate, candidate) for candidate in list(candidates))
    for candidate in candidates:
        cleaned = candidate.lower().lstrip(".")
        if cleaned in SUPPORTED_EXTENSIONS:
            return cleaned, SUPPORTED_EXTENSIONS[cleaned]
    cleaned = (suffix or normalized or raw_type or "unknown").lower().lstrip(".")
    raise ValueError(f"Unsupported file type for Docling ingestion: {cleaned}")


def _split_text(text: str, file_type: str, chunk_size_tokens: int, chunk_overlap_tokens: int) -> list[str]:
    if not text.strip():
        return []

    if file_type.lower() in {"csv", "tsv", "xlsx", "xls", "ods"}:
        separators = ["\n## Sheet", "\n## CSV table", "\n### Table", "\nRow ", "\n|", "\n", "; ", " ", ""]
    else:
        separators = ["\n# ", "\n## ", "\n### ", "\n#### ", "\n\n", "\n", ". ", " ", ""]

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size_tokens,
        chunk_overlap=chunk_overlap_tokens,
        length_function=_token_length,
        separators=separators,
    )
    return [chunk.strip() for chunk in splitter.split_text(text) if chunk.strip()]


def _chunk_context(chunk: str, format_family: str) -> dict[str, Any]:
    metadata: dict[str, Any] = {"format_family": format_family}
    sheet_match = re.search(r"^#{1,3}\s*Sheet[:\s]+(.+)$", chunk, flags=re.IGNORECASE | re.MULTILINE)
    if sheet_match:
        metadata["sheet_name"] = sheet_match.group(1).strip()
    page_match = re.search(r"\bpage\s+(\d+)\b", chunk, flags=re.IGNORECASE)
    if page_match:
        metadata["page_number"] = int(page_match.group(1))
    table_match = re.search(r"\btable\s+(\d+)\b", chunk, flags=re.IGNORECASE)
    if table_match:
        metadata["table_index"] = int(table_match.group(1))
    heading = next((line.strip("# ").strip() for line in chunk.splitlines() if line.strip().startswith("#")), None)
    if not heading:
        heading = next((line.strip() for line in chunk.splitlines() if _DOC_HEADING_RE.match(line.strip())), None)
    if heading:
        metadata["section_heading"] = heading[:160]
    return metadata


def process_document_bytes(
    file_bytes: bytes,
    file_name: str,
    file_type: str,
    chunk_size_tokens: int = 1000,
    chunk_overlap_tokens: int = 200,
) -> ProcessedDocument:
    normalized_type, format_info = _normalize_file_type(file_name, file_type)
    format_family = str(format_info["family"])
    parser = str(format_info["parser"])

    if parser == "csv_structured":
        text, parser_metadata = _read_csv(file_bytes)
    elif parser == "plain_text":
        text, parser_metadata = _read_plain_text(file_bytes, format_family)
    else:
        text, parser_metadata = _read_with_docling(file_bytes, file_name, format_family)

    raw_chunks = _split_text(text, normalized_type, chunk_size_tokens, chunk_overlap_tokens)
    chunks = [
        DocumentChunk(
            content=chunk,
            chunk_index=index,
            metadata={
                "file_type": normalized_type,
                "parser": parser_metadata.get("parser"),
                **_chunk_context(chunk, format_family),
                "token_count": _token_length(chunk),
                "chunk_strategy": "structure_first_token",
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
            "parser_format": str(format_info["format_key"]),
            "supported_by_docling": parser != "plain_text" or format_family in {"markdown", "text"},
            "chunk_count": len(chunks),
            "chunk_size_tokens": chunk_size_tokens,
            "chunk_overlap_tokens": chunk_overlap_tokens,
        },
    )
