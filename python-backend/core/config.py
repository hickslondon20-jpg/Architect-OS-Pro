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

    raw_document_bucket: str = Field(default="raw-documents", validation_alias="ARCHITECTOS_RAW_DOCUMENT_BUCKET")
    ingest_secret: str | None = Field(default=None, validation_alias="ARCHITECTOS_INGEST_SECRET")
    cors_origins: str = Field(default="http://127.0.0.1:5180,http://localhost:5180", validation_alias="ARCHITECTOS_CORS_ORIGINS")

    embedding_model: str = Field(default="text-embedding-3-small", validation_alias="OPENAI_EMBEDDING_MODEL")
    metadata_model: str = Field(default="gpt-4o-mini", validation_alias="OPENAI_METADATA_MODEL")
    metadata_extraction_enabled: bool = Field(default=True, validation_alias="ARCHITECTOS_METADATA_EXTRACTION_ENABLED")
    metadata_max_input_chars: int = Field(default=24000, validation_alias="ARCHITECTOS_METADATA_MAX_INPUT_CHARS")
    embedding_batch_size: int = Field(default=64, validation_alias="ARCHITECTOS_EMBEDDING_BATCH_SIZE")
    chunk_size_tokens: int = Field(default=1000, validation_alias="ARCHITECTOS_CHUNK_SIZE_TOKENS")
    chunk_overlap_tokens: int = Field(default=200, validation_alias="ARCHITECTOS_CHUNK_OVERLAP_TOKENS")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

