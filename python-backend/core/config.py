"""Runtime configuration for the ArchitectOS ingestion backend."""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", ".env.local"), extra="ignore")

    supabase_url: str | None = Field(default=None, validation_alias="SUPABASE_URL")
    supabase_service_role_key: str | None = Field(default=None, validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    openai_api_key: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    cohere_api_key: str | None = Field(default=None, validation_alias="COHERE_API_KEY")
    anthropic_api_key: str | None = Field(default=None, validation_alias="ANTHROPIC_API_KEY")
    claude_synthesis_model: str = Field(
        default="claude-sonnet-4-6",
        validation_alias="ARCHITECTOS_CLAUDE_SYNTHESIS_MODEL",
    )
    llm_context_window: int = Field(default=200000, validation_alias="ARCHITECTOS_LLM_CONTEXT_WINDOW")

    raw_document_bucket: str = Field(default="raw-documents", validation_alias="ARCHITECTOS_RAW_DOCUMENT_BUCKET")
    ingest_secret: str | None = Field(default=None, validation_alias="ARCHITECTOS_INGEST_SECRET")
    cors_origins: str = Field(default="http://127.0.0.1:5180,http://localhost:5180", validation_alias="ARCHITECTOS_CORS_ORIGINS")

    embedding_model: str = Field(default="text-embedding-3-small", validation_alias="OPENAI_EMBEDDING_MODEL")
    metadata_model: str = Field(default="gpt-4o-mini", validation_alias="OPENAI_METADATA_MODEL")
    metadata_extraction_enabled: bool = Field(default=True, validation_alias="ARCHITECTOS_METADATA_EXTRACTION_ENABLED")
    metadata_max_input_chars: int = Field(default=24000, validation_alias="ARCHITECTOS_METADATA_MAX_INPUT_CHARS")
    cohere_rerank_model: str = Field(default="rerank-v4.0-pro", validation_alias="COHERE_RERANK_MODEL")
    rerank_enabled: bool = Field(default=False, validation_alias="ARCHITECTOS_RERANK_ENABLED")
    rerank_top_n: int = Field(default=8, validation_alias="ARCHITECTOS_RERANK_TOP_N")
    retrieval_candidate_count: int = Field(default=40, validation_alias="ARCHITECTOS_RETRIEVAL_CANDIDATE_COUNT")
    rrf_k: int = Field(default=60, validation_alias="ARCHITECTOS_RRF_K")
    rerank_timeout_seconds: float = Field(default=6.0, validation_alias="ARCHITECTOS_RERANK_TIMEOUT_SECONDS")
    web_search_enabled: bool = Field(default=False, validation_alias="ARCHITECTOS_WEB_SEARCH_ENABLED")
    web_search_provider: str | None = Field(default=None, validation_alias="ARCHITECTOS_WEB_SEARCH_PROVIDER")
    web_search_api_key: str | None = Field(default=None, validation_alias="ARCHITECTOS_WEB_SEARCH_API_KEY")
    embedding_batch_size: int = Field(default=64, validation_alias="ARCHITECTOS_EMBEDDING_BATCH_SIZE")
    chunk_size_tokens: int = Field(default=1000, validation_alias="ARCHITECTOS_CHUNK_SIZE_TOKENS")
    chunk_overlap_tokens: int = Field(default=200, validation_alias="ARCHITECTOS_CHUNK_OVERLAP_TOKENS")
    gcp_project_id: str | None = Field(default=None, validation_alias="ARCHITECTOS_GCP_PROJECT_ID")
    gcp_region: str = Field(default="us-west2", validation_alias="ARCHITECTOS_GCP_REGION")
    gke_cluster_name: str = Field(
        default="architectos-sandbox-cluster",
        validation_alias="ARCHITECTOS_GKE_CLUSTER_NAME",
    )
    gke_service_account_key: str | None = Field(
        default=None,
        validation_alias="ARCHITECTOS_GKE_SERVICE_ACCOUNT_KEY",
    )
    sandbox_image: str = Field(
        default="us-west2-docker.pkg.dev/architectos-sandbox/sandbox-images/sandbox-python:latest",
        validation_alias="ARCHITECTOS_SANDBOX_IMAGE",
    )
    sandbox_idle_ttl_minutes: int = Field(default=20, validation_alias="ARCHITECTOS_SANDBOX_IDLE_TTL_MINUTES")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def anthropic_api_key_value(self) -> str:
        """Return the Anthropic key with common deployment paste wrappers removed."""
        return (self.anthropic_api_key or "").strip().strip('"').strip("'")

    @property
    def anthropic_api_key_has_wrapping(self) -> bool:
        raw = self.anthropic_api_key or ""
        return bool(raw) and raw != self.anthropic_api_key_value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

