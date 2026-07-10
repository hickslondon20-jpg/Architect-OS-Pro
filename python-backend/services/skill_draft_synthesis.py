"""AI-guided SKILL.md draft synthesis for the Skills & Plugins workspace."""

from __future__ import annotations

from dataclasses import dataclass
import json
import re
from typing import Any

import anthropic

from core.config import get_settings
from core.langsmith_tracing import trace_anthropic_client


class SkillDraftSynthesisError(RuntimeError):
    pass


@dataclass(frozen=True)
class GuidedDraftRequest:
    messages: list[dict[str, str]]
    current_draft: dict[str, Any]


class SkillDraftSynthesisService:
    def __init__(self, anthropic_client: anthropic.Anthropic, model: str) -> None:
        self._anthropic = anthropic_client
        self._model = model

    @classmethod
    def from_env(cls) -> "SkillDraftSynthesisService":
        settings = get_settings()
        return cls(
            anthropic_client=trace_anthropic_client(
                anthropic.Anthropic(api_key=settings.anthropic_api_key_value)
            ),
            model=settings.claude_synthesis_model,
        )

    def draft(self, request: GuidedDraftRequest) -> dict[str, Any]:
        try:
            response = self._anthropic.messages.create(
                model=self._model,
                max_tokens=1800,
                system=_system_prompt(),
                messages=[{"role": "user", "content": _user_prompt(request)}],
            )
        except Exception as exc:
            raise SkillDraftSynthesisError(f"Claude skill-draft request failed: {exc}") from exc

        text = _response_text(response)
        try:
            parsed = json.loads(_strip_json_fence(text))
        except (json.JSONDecodeError, TypeError):
            return _fallback_response(request.current_draft)
        if not isinstance(parsed, dict):
            return _fallback_response(request.current_draft)
        return _normalize_draft(parsed, request.current_draft)


def _system_prompt() -> str:
    return (
        "You are the ArchitectOS Pro skill-creation interviewer for marketing agency founders. "
        "Help the founder define a reusable Virtual CSO skill in the SKILL.md open-standard style. "
        "Return only a valid JSON object with no markdown fence or commentary. "
        "Schema: {"
        '"assistant_message": string, "ready": boolean, "name": string|null, '
        '"description": string|null, "domain": string|null, "skill_kind": string|null, '
        '"trigger_tags": string[], "required_platform_context": string[], "body": string|null'
        "}. "
        "Ask one focused follow-up when the draft lacks enough detail. "
        "Set ready=true only when name, description, and body are complete enough for the founder to confirm. "
        "The body must be markdown instructions only, without YAML frontmatter, because the platform stores "
        "name and description separately and serializes frontmatter on export."
    )


def _user_prompt(request: GuidedDraftRequest) -> str:
    safe_messages = [
        {"role": str(item.get("role") or ""), "content": str(item.get("content") or "")}
        for item in request.messages[-12:]
    ]
    return (
        "# Conversation history\n"
        f"{json.dumps(safe_messages, ensure_ascii=False)}\n\n"
        "# Current draft\n"
        f"{json.dumps(request.current_draft, ensure_ascii=False)}\n\n"
        "# ArchitectOS skill fields\n"
        "Extract or refine: name, description, domain, skill_kind, trigger_tags, "
        "required_platform_context, and body. Use short trigger tags that Phase 3 routing can match. "
        "Use required_platform_context only when the skill clearly needs a known context key such as "
        "business_context, diagnostic_synthesis, financial_context, current_quarter_sprint, or open_questions. "
        "Keep assistant_message concise and founder-facing."
    )


def _normalize_draft(parsed: dict[str, Any], current_draft: dict[str, Any]) -> dict[str, Any]:
    merged = {**current_draft, **{key: value for key, value in parsed.items() if value is not None}}
    name = _optional_string(merged.get("name"))
    description = _optional_string(merged.get("description"))
    body = _optional_string(merged.get("body"))
    return {
        "assistant_message": _optional_string(parsed.get("assistant_message"))
        or "I updated the draft. Add any missing specifics, then confirm when it feels right.",
        "ready": bool(parsed.get("ready")) and bool(name and description and body),
        "name": name,
        "description": description,
        "domain": _optional_string(merged.get("domain")),
        "skill_kind": _optional_string(merged.get("skill_kind")),
        "trigger_tags": _string_list(merged.get("trigger_tags")),
        "required_platform_context": _string_list(merged.get("required_platform_context")),
        "body": body,
    }


def _fallback_response(current_draft: dict[str, Any]) -> dict[str, Any]:
    return {
        **current_draft,
        "assistant_message": (
            "I could not turn that into a clean skill draft yet. Rephrase the method or add the concrete "
            "steps you want the Virtual CSO to follow."
        ),
        "ready": False,
    }


def _response_text(response: Any) -> str:
    parts: list[str] = []
    for block in getattr(response, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "\n".join(parts)


def _strip_json_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?", "", stripped).strip()
        stripped = re.sub(r"```$", "", stripped).strip()
    return stripped


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _string_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value).split(",") if item.strip()]
