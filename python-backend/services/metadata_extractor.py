"""OpenAI-backed document metadata extraction for ingestion."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from openai import OpenAIError

from core.config import Settings
from services.usage_events import log_ai_usage_event, openai_chat_usage
from services.vector_store import VectorStore, VectorStoreError


@dataclass(frozen=True)
class MetadataExtractionResult:
    metadata: dict[str, Any]
    model: str


class MetadataExtractor:
    def __init__(self, store: VectorStore, settings: Settings) -> None:
        self.store = store
        self.settings = settings

    def extract(self, *, text: str, file_name: str, file_type: str, user_id: str | None = None) -> MetadataExtractionResult:
        if not self.settings.metadata_extraction_enabled:
            return MetadataExtractionResult(metadata={}, model="disabled")
        if not self.store.openai_client:
            raise VectorStoreError("OPENAI_API_KEY is required for metadata extraction.")

        fields = self.store.load_metadata_schema_fields()
        model = self.store.resolve_platform_model(
            setting_key="ingestion_metadata_extraction",
            fallback_model_name=self.settings.metadata_model,
            fallback_provider="openai",
        )
        if model.get("provider") and model["provider"] != "openai":
            raise VectorStoreError(f"Unsupported metadata extraction provider: {model['provider']}")

        input_text = text[: max(1000, self.settings.metadata_max_input_chars)]
        field_lines = "\n".join(_field_instruction(field) for field in fields)
        prompt = f"""
Extract concise, founder-useful metadata from this uploaded business document.

File name: {file_name}
File type: {file_type}

Return JSON only. Use these fields when evidence exists:
{field_lines}

Rules:
- Do not invent facts.
- Use null for unknown scalar values and [] for unknown array values.
- Keep summary under 90 words.
- Confidence must be a number from 0 to 1.

Document text:
{input_text}
""".strip()

        try:
            response = self.store.openai_client.chat.completions.create(
                model=model["model_name"],
                messages=[
                    {"role": "system", "content": "You extract structured metadata as strict JSON."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0,
            )
        except OpenAIError as exc:
            raise VectorStoreError(f"OpenAI metadata extraction request failed: {exc}") from exc
        if user_id:
            usage = openai_chat_usage(response)
            log_ai_usage_event(
                self.store.client,
                user_id=user_id,
                surface="ingestion",
                model=model["model_name"],
                role="utility",
                provider="openai",
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                capability_key="ingestion_metadata_extraction",
            )

        content = response.choices[0].message.content or "{}"
        try:
            raw_metadata = json.loads(content)
        except json.JSONDecodeError as exc:
            raise VectorStoreError(f"Metadata extraction returned invalid JSON: {exc}") from exc

        return MetadataExtractionResult(
            metadata=_normalize_metadata(raw_metadata, fields),
            model=model["model_name"],
        )


def _field_instruction(field: dict[str, Any]) -> str:
    data_type = field.get("data_type") or "text"
    hint = field.get("extraction_hint") or field.get("description") or ""
    return f"- {field['field_key']} ({data_type}): {hint}".rstrip()


def _normalize_metadata(metadata: dict[str, Any], fields: list[dict[str, Any]]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    fields_by_key = {field["field_key"]: field for field in fields}

    for key, field in fields_by_key.items():
        value = metadata.get(key)
        data_type = field.get("data_type")
        if value is None:
            if data_type in {"text_array", "array"}:
                normalized[key] = []
            elif key == "confidence":
                normalized[key] = 0
            else:
                normalized[key] = None
            continue

        if data_type in {"text_array", "array"}:
            if isinstance(value, list):
                normalized[key] = [str(item).strip() for item in value if str(item).strip()]
            elif str(value).strip():
                normalized[key] = [str(value).strip()]
            else:
                normalized[key] = []
        elif data_type in {"number", "numeric"}:
            try:
                normalized[key] = float(value)
            except (TypeError, ValueError):
                normalized[key] = 0
        else:
            normalized[key] = str(value).strip() if str(value).strip() else None

    for key, value in metadata.items():
        if key not in normalized:
            normalized[key] = value

    confidence = normalized.get("confidence")
    if isinstance(confidence, (int, float)):
        normalized["confidence"] = min(1, max(0, confidence))

    return normalized
