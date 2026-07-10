"""Supabase vector-store adapter for ArchitectOS document ingestion."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timezone
from hashlib import sha256
from typing import TYPE_CHECKING, Any, TypeVar

from openai import OpenAI, OpenAIError
from supabase import Client, create_client

from core.config import Settings, get_settings
from core.langsmith_tracing import trace_openai_client
from services.usage_events import log_ai_usage_event, openai_embedding_usage

if TYPE_CHECKING:
    from services.doc_processor import DocumentChunk

T = TypeVar('T')


class VectorStoreError(RuntimeError):
    pass


RAW_DOCUMENT_SIGNED_URL_EXPIRES_SECONDS = 300


class VectorStore:
    def __init__(self, client: Client, openai_client: OpenAI | None, settings: Settings) -> None:
        self.client = client
        self.openai_client = openai_client
        self.settings = settings

    @classmethod
    def from_env(cls) -> "VectorStore":
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise VectorStoreError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
        return cls(
            create_client(settings.supabase_url, settings.supabase_service_role_key),
            trace_openai_client(OpenAI(api_key=settings.openai_api_key)) if settings.openai_api_key else None,
            settings,
        )

    def download_raw_document(self, storage_path: str) -> bytes:
        try:
            return self.client.storage.from_(self.settings.raw_document_bucket).download(storage_path)
        except Exception as exc:
            raise VectorStoreError(f"Could not download raw document: {exc}") from exc

    def create_raw_document_signed_url(
        self,
        storage_path: str,
        expires_seconds: int = RAW_DOCUMENT_SIGNED_URL_EXPIRES_SECONDS,
    ) -> str:
        try:
            response = self.client.storage.from_(self.settings.raw_document_bucket).create_signed_url(
                storage_path,
                expires_seconds,
            )
        except Exception as exc:
            raise VectorStoreError(f"Could not create raw document signed URL: {exc}") from exc

        if isinstance(response, dict):
            signed_url = response.get("signedURL") or response.get("signedUrl") or response.get("signed_url")
        else:
            signed_url = getattr(response, "signed_url", None) or getattr(response, "signedURL", None)
        if not signed_url:
            raise VectorStoreError("Supabase did not return a raw document signed URL.")
        return str(signed_url)

    def get_document(self, document_id: str, user_id: str) -> dict[str, Any]:
        try:
            response = (
                self.client.table("ose_raw_document_registry")
                .select("*")
                .eq("id", document_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )
        except Exception as exc:
            raise VectorStoreError(f"Could not load document registry row: {exc}") from exc
        if not response.data:
            raise VectorStoreError("Document registry row was not found for this user.")
        return response.data

    def is_duplicate_document(self, document: dict[str, Any]) -> bool:
        return document.get("record_state") == "duplicate" or document.get("status") == "duplicate"

    def confirm_content_hash(
        self,
        document_id: str,
        user_id: str,
        file_bytes: bytes,
        document: dict[str, Any],
    ) -> None:
        actual_hash = sha256(file_bytes).hexdigest()
        expected_hash = document.get("content_hash")
        values: dict[str, Any] = {
            "content_hash": actual_hash,
            "hash_algorithm": "sha256",
            "last_hash_checked_at": datetime.now(timezone.utc).isoformat(),
        }
        if expected_hash and expected_hash != actual_hash:
            values["ingestion_error"] = "Content hash changed after upload."
            self._update_document(document_id, user_id, values)
            raise VectorStoreError("Content hash changed after upload.")
        self._update_document(document_id, user_id, values)

    def mark_processing(self, document_id: str, user_id: str) -> None:
        self._update_document(
            document_id,
            user_id,
            {
                "status": "processing",
                "ingestion_error": None,
                "embedding_model": self.settings.embedding_model,
            },
        )

    def mark_parser_processing(self, document_id: str, user_id: str) -> None:
        self._update_document(
            document_id,
            user_id,
            {
                "parser_status": "processing",
                "parser_warnings": [],
            },
        )

    def mark_parser_complete(self, document_id: str, user_id: str, metadata: dict[str, Any]) -> None:
        warnings = _string_list(metadata.get("warnings"))
        self._update_document(
            document_id,
            user_id,
            {
                "parser_status": "complete",
                "parser_name": metadata.get("parser"),
                "parser_version": metadata.get("parser_version"),
                "parser_format": metadata.get("parser_format") or metadata.get("file_type"),
                "parser_warnings": warnings,
                "extraction_quality": metadata.get("extraction_quality"),
                "source_format_metadata": _source_format_metadata(metadata),
            },
        )

    def store_full_markdown(self, document_id: str, user_id: str, text: str) -> None:
        """Persist the full extracted markdown text for grep/read tool access."""
        self._update_document(
            document_id,
            user_id,
            {"full_markdown": text or ""},
        )

    def mark_parser_failed(self, document_id: str, user_id: str, message: str, metadata: dict[str, Any] | None = None) -> None:
        parser_metadata = metadata or {}
        warnings = _string_list(parser_metadata.get("warnings"))
        warnings.append(message[:1000])
        self._update_document(
            document_id,
            user_id,
            {
                "parser_status": "failed",
                "parser_name": parser_metadata.get("parser"),
                "parser_version": parser_metadata.get("parser_version"),
                "parser_format": parser_metadata.get("parser_format") or parser_metadata.get("file_type"),
                "parser_warnings": warnings,
                "extraction_quality": "failed",
                "source_format_metadata": _source_format_metadata(parser_metadata),
                "ingestion_error": message[:1000],
            },
        )

    def mark_parser_skipped(self, document_id: str, user_id: str, reason: str) -> None:
        self._update_document(
            document_id,
            user_id,
            {
                "parser_status": "skipped",
                "parser_warnings": [reason[:1000]],
                "extraction_quality": "skipped",
            },
        )

    def mark_metadata_processing(self, document_id: str, user_id: str) -> None:
        self._update_document(
            document_id,
            user_id,
            {
                "metadata_extraction_status": "processing",
                "metadata_extraction_error": None,
            },
        )

    def mark_metadata_complete(
        self,
        document_id: str,
        user_id: str,
        metadata: dict[str, Any],
        model_name: str,
    ) -> None:
        self._update_document(
            document_id,
            user_id,
            {
                "extracted_metadata": metadata,
                "metadata_extraction_status": "complete",
                "metadata_extraction_model": model_name,
                "metadata_extracted_at": datetime.now(timezone.utc).isoformat(),
                "metadata_extraction_error": None,
                "metadata_document_type": _metadata_scalar(metadata.get("document_type")),
                "metadata_business_domain": _metadata_scalar(metadata.get("business_domain")),
                "metadata_time_period": _metadata_scalar(metadata.get("time_period")),
            },
        )

    def mark_metadata_failed(self, document_id: str, user_id: str, message: str) -> None:
        self._update_document(
            document_id,
            user_id,
            {
                "metadata_extraction_status": "failed",
                "metadata_extraction_error": message[:1000],
            },
        )

    def mark_ingested(self, document_id: str, user_id: str, chunk_count: int, metadata: dict[str, Any]) -> None:
        self._update_document(
            document_id,
            user_id,
            {
                "status": "ingested",
                "chunk_count": chunk_count,
                "ingested_at": datetime.now(timezone.utc).isoformat(),
                "embedding_model": self.settings.embedding_model,
                "metadata": metadata,
                "ingestion_error": None,
            },
        )

    def mark_failed(self, document_id: str, user_id: str, message: str) -> None:
        self._update_document(
            document_id,
            user_id,
            {
                "status": "failed",
                "ingestion_error": message[:1000],
                "embedding_model": self.settings.embedding_model,
            },
        )

    def clear_document_chunks(self, document_id: str, user_id: str) -> None:
        try:
            self.client.table("document_chunks").delete().eq("document_id", document_id).eq("user_id", user_id).execute()
        except Exception as exc:
            raise VectorStoreError(f"Could not clear document chunks: {exc}") from exc

    def replace_document_chunks(
        self,
        document_id: str,
        user_id: str,
        chunks: Iterable[DocumentChunk],
        metadata: dict[str, Any],
        document_metadata: dict[str, Any] | None = None,
    ) -> None:
        chunk_list = list(chunks)
        texts = [chunk.content for chunk in chunk_list]
        embeddings = self._embed_texts(
            texts,
            user_id=user_id,
            surface="ingestion",
            capability_key="ingestion_embeddings",
        ) if texts else []
        inherited_metadata = document_metadata or {}

        self.clear_document_chunks(document_id, user_id)

        rows = [
            {
                "document_id": document_id,
                "user_id": user_id,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "embedding": embedding,
                "embedding_model": self.settings.embedding_model,
                "metadata": {**metadata, **inherited_metadata, **chunk.metadata},
                "page_number": chunk.metadata.get("page_number"),
                "bbox": chunk.metadata.get("bbox"),
                "verbatim": chunk.metadata.get("verbatim") or chunk.content,
            }
            for chunk, embedding in zip(chunk_list, embeddings, strict=True)
        ]

        for batch in _batched(rows, 100):
            try:
                self.client.table("document_chunks").insert(batch).execute()
            except Exception as exc:
                raise VectorStoreError(f"Could not insert document chunks: {exc}") from exc

    def embed_query(
        self,
        query: str,
        *,
        user_id: str | None = None,
        surface: str = "retrieval",
        capability_key: str = "ingestion_embeddings",
    ) -> list[float]:
        embeddings = self._embed_texts(
            [query],
            user_id=user_id,
            surface=surface,
            capability_key=capability_key,
        )
        if not embeddings:
            raise VectorStoreError("Could not generate query embedding.")
        return embeddings[0]

    def load_metadata_schema_fields(self) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("metadata_schema_fields")
                .select("*")
                .eq("is_active", True)
                .order("display_order")
                .execute()
            )
        except Exception:
            return _default_metadata_schema_fields()
        return response.data or _default_metadata_schema_fields()

    def resolve_platform_model(
        self,
        *,
        setting_key: str,
        fallback_model_name: str,
        fallback_provider: str,
    ) -> dict[str, Any]:
        try:
            response = (
                self.client.table("platform_ai_settings")
                .select("provider,fallback_model_name,is_enabled,model_id,ai_models(provider,model_name,context_window)")
                .eq("setting_key", setting_key)
                .eq("is_enabled", True)
                .limit(1)
                .execute()
            )
        except Exception:
            return {"provider": fallback_provider, "model_name": fallback_model_name}

        setting = response.data[0] if response.data else None
        if not setting:
            return {"provider": fallback_provider, "model_name": fallback_model_name}

        model_row = setting.get("ai_models") or {}
        return {
            "provider": model_row.get("provider") or setting.get("provider") or fallback_provider,
            "model_name": model_row.get("model_name") or setting.get("fallback_model_name") or fallback_model_name,
            "context_window": model_row.get("context_window"),
        }

    def resolve_platform_setting(
        self,
        *,
        setting_key: str,
        fallback_model_name: str,
        fallback_provider: str,
    ) -> dict[str, Any]:
        try:
            response = (
                self.client.table("platform_ai_settings")
                .select("provider,fallback_model_name,is_enabled,settings,model_id,ai_models(provider,model_name,context_window)")
                .eq("setting_key", setting_key)
                .limit(1)
                .execute()
            )
        except Exception:
            return {
                "provider": fallback_provider,
                "model_name": fallback_model_name,
                "is_enabled": True,
                "settings": {},
            }

        setting = response.data[0] if response.data else None
        if not setting:
            return {
                "provider": fallback_provider,
                "model_name": fallback_model_name,
                "is_enabled": True,
                "settings": {},
            }

        model_row = setting.get("ai_models") or {}
        return {
            "provider": model_row.get("provider") or setting.get("provider") or fallback_provider,
            "model_name": model_row.get("model_name") or setting.get("fallback_model_name") or fallback_model_name,
            "context_window": model_row.get("context_window"),
            "is_enabled": bool(setting.get("is_enabled")),
            "settings": setting.get("settings") or {},
        }

    def _embed_texts(
        self,
        texts: list[str],
        *,
        user_id: str | None = None,
        surface: str = "ingestion",
        capability_key: str = "ingestion_embeddings",
    ) -> list[list[float]]:
        if not self.openai_client:
            raise VectorStoreError("OPENAI_API_KEY is required for embedding.")
        model = self.resolve_platform_model(
            setting_key=capability_key,
            fallback_model_name=self.settings.embedding_model,
            fallback_provider="openai",
        )
        if model.get("provider") and model["provider"] != "openai":
            raise VectorStoreError(f"Unsupported embedding provider: {model['provider']}")
        embeddings: list[list[float]] = []
        for batch in _batched(texts, self.settings.embedding_batch_size):
            try:
                response = self.openai_client.embeddings.create(
                    model=model["model_name"],
                    input=batch,
                )
            except OpenAIError as exc:
                raise VectorStoreError(f"OpenAI embedding request failed: {exc}") from exc
            if user_id:
                usage = openai_embedding_usage(response)
                log_ai_usage_event(
                    self.client,
                    user_id=user_id,
                    surface=surface,
                    model=model["model_name"],
                    role="utility",
                    provider="openai",
                    input_tokens=usage.input_tokens,
                    output_tokens=usage.output_tokens,
                    capability_key=capability_key,
                )
            embeddings.extend([item.embedding for item in response.data])
        return embeddings

    def _update_document(self, document_id: str, user_id: str, values: dict[str, Any]) -> None:
        try:
            self.client.table("ose_raw_document_registry").update(values).eq("id", document_id).eq("user_id", user_id).execute()
        except Exception as exc:
            raise VectorStoreError(f"Could not update document status: {exc}") from exc


def _batched(items: list[T], size: int) -> Iterable[list[T]]:
    step = max(1, size)
    for index in range(0, len(items), step):
        yield items[index : index + step]


def _metadata_scalar(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, list):
        return str(value[0]).strip() if value else None
    text = str(value).strip()
    return text or None


def _string_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value).strip()
    return [text] if text else []


def _source_format_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    keys = {
        "format_family",
        "file_type",
        "page_count",
        "sheet_count",
        "row_count",
        "column_count",
        "table_count",
        "image_count",
        "section_count",
        "section_headings",
        "preserves_structure",
        "docling_export_mode",
        "chunk_count",
    }
    return {key: value for key, value in metadata.items() if key in keys and value not in (None, [], {})}


def _default_metadata_schema_fields() -> list[dict[str, Any]]:
    return [
        {"field_key": "document_title", "data_type": "text", "description": "Best concise title for the document."},
        {"field_key": "document_type", "data_type": "text", "description": "Document category such as P&L, strategy deck, meeting notes, client list, or operating plan."},
        {"field_key": "business_domain", "data_type": "text", "description": "Primary business area such as financial, sales, marketing, delivery, operations, team, or strategy."},
        {"field_key": "time_period", "data_type": "text", "description": "Relevant date range, quarter, month, or year."},
        {"field_key": "summary", "data_type": "text", "description": "Short useful summary."},
        {"field_key": "topics", "data_type": "text_array", "description": "Important topics."},
        {"field_key": "entities", "data_type": "text_array", "description": "Important organizations, people, clients, or tools."},
        {"field_key": "metrics", "data_type": "text_array", "description": "Important metrics or KPIs."},
        {"field_key": "keywords", "data_type": "text_array", "description": "Search keywords."},
        {"field_key": "confidence", "data_type": "number", "description": "Extraction confidence from 0 to 1."},
        {"field_key": "extraction_notes", "data_type": "text", "description": "Brief caveats or uncertainty."},
    ]
