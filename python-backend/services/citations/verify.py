from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Literal

import anthropic

from core.config import get_settings
from core.langsmith_tracing import trace_anthropic_client
from services.citations.models import CitationRef
from services.citations.resolvers import resolve as resolve_citation_ref
from services.usage_events import anthropic_usage, log_ai_usage_event
from services.vector_store import VectorStore

CitationVerdict = Literal["supported", "partial", "unsupported", "unresolvable"]
UTILITY_FALLBACK_MODEL = "claude-3-5-haiku-latest"


@dataclass(frozen=True)
class CitationCheckResult:
    verdicts: list[dict[str, Any]] = field(default_factory=list)
    overall: CitationVerdict = "unresolvable"
    summary: str = ""
    model: str = UTILITY_FALLBACK_MODEL

    def to_dict(self) -> dict[str, Any]:
        return {
            "verdicts": self.verdicts,
            "overall": self.overall,
            "summary": self.summary,
            "model": self.model,
        }


class CitationVerifierService:
    def __init__(self, store: VectorStore, anthropic_client: anthropic.Anthropic) -> None:
        self._store = store
        self._anthropic = anthropic_client
        self._model_setting_key = "citation_verifier"

    @classmethod
    def from_env(cls) -> "CitationVerifierService":
        settings = get_settings()
        return cls(
            store=VectorStore.from_env(),
            anthropic_client=trace_anthropic_client(anthropic.Anthropic(api_key=settings.anthropic_api_key or "")),
        )

    def check_message(self, *, message_id: str, user_id: str) -> CitationCheckResult:
        message = self._load_message(message_id, user_id)
        citations = [
            CitationRef.from_dict(item)
            for item in message.get("citations") or []
            if isinstance(item, dict)
        ]
        result = self.check_answer(
            answer=str(message.get("content") or ""),
            citations=citations,
            user_id=user_id,
            thread_id=str(message.get("thread_id") or ""),
            message_id=message_id,
        )
        self._persist_message_verdicts(message_id, user_id, message.get("citations") or [], result)
        return result

    def check_answer(
        self,
        *,
        answer: str,
        citations: list[CitationRef],
        user_id: str,
        thread_id: str | None = None,
        message_id: str | None = None,
    ) -> CitationCheckResult:
        citable = [ref for ref in citations if ref.source_kind != "derived"]
        model = self._resolve_model()
        verdicts: list[dict[str, Any]] = []

        for index, ref in enumerate(citable, start=1):
            resolved = resolve_citation_ref(ref, user_id, self._store)
            source_text = _source_text(ref, resolved)
            base = {
                "ordinal": ref.source_metadata.get("ordinal") or getattr(ref, "ordinal", None) or index,
                "source_kind": ref.source_kind,
                "source_id": ref.source_id,
            }
            if _is_unresolvable(resolved) or not source_text.strip():
                verdicts.append(
                    {
                        **base,
                        "verdict": "unresolvable",
                        "summary": "Source could not be resolved for checking.",
                    }
                )
                continue

            verdicts.append(
                {
                    **base,
                    **self._grade_ref(
                        answer=answer,
                        source_text=source_text,
                        ref=ref,
                        model=model,
                        user_id=user_id,
                        thread_id=thread_id,
                        message_id=message_id,
                    ),
                }
            )

        overall = _roll_up([item["verdict"] for item in verdicts])
        return CitationCheckResult(
            verdicts=verdicts,
            overall=overall,
            summary=_summary(overall, verdicts),
            model=model,
        )

    def _grade_ref(
        self,
        *,
        answer: str,
        source_text: str,
        ref: CitationRef,
        model: str,
        user_id: str,
        thread_id: str | None,
        message_id: str | None,
    ) -> dict[str, str]:
        response = self._anthropic.messages.create(
            model=model,
            max_tokens=300,
            temperature=0,
            system=(
                "You verify one citation for ArchitectOS. Return only JSON with keys "
                'verdict and summary. verdict must be one of "supported", "partial", '
                '"unsupported", "unresolvable". Do not rewrite the answer. Do not include reasoning.'
            ),
            messages=[
                {
                    "role": "user",
                    "content": (
                        "# Assistant answer\n"
                        f"{_truncate(answer, 6000)}\n\n"
                        "# Citation label\n"
                        f"{ref.source_label or ref.source_id or ref.source_kind}\n\n"
                        "# Resolved source content\n"
                        f"{_truncate(source_text, 6000)}\n\n"
                        "Grade whether the answer's claim attached to this citation is supported by the source."
                    ),
                }
            ],
        )
        usage = anthropic_usage(response)
        log_ai_usage_event(
            self._store.client,
            user_id=user_id,
            surface="virtual_cso",
            model=model,
            role="utility",
            provider="anthropic",
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            thread_id=thread_id,
            capability_key=self._model_setting_key,
            run_id=message_id,
        )
        parsed = _parse_json(_response_text(response))
        verdict = _normalize_verdict(parsed.get("verdict"))
        return {
            "verdict": verdict,
            "summary": str(parsed.get("summary") or _default_summary(verdict))[:280],
        }

    def _resolve_model(self) -> str:
        resolved = self._store.resolve_platform_model(
            setting_key=self._model_setting_key,
            fallback_model_name=UTILITY_FALLBACK_MODEL,
            fallback_provider="anthropic",
        )
        model = str(resolved.get("model_name") or UTILITY_FALLBACK_MODEL)
        if resolved.get("provider") != "anthropic" or "claude" not in model.lower():
            return UTILITY_FALLBACK_MODEL
        return model

    def _load_message(self, message_id: str, user_id: str) -> dict[str, Any]:
        response = (
            self._store.client.table("vcso_chat_messages")
            .select("id,thread_id,user_id,role,content,citations")
            .eq("id", message_id)
            .eq("user_id", user_id)
            .eq("role", "assistant")
            .maybe_single()
            .execute()
        )
        row = response.data
        if not row:
            raise ValueError("Assistant message was not found for this user.")
        return row

    def _persist_message_verdicts(
        self,
        message_id: str,
        user_id: str,
        citations: list[dict[str, Any]],
        result: CitationCheckResult,
    ) -> None:
        verdicts_by_key = {
            _verdict_key(item.get("source_kind"), item.get("source_id"), item.get("ordinal")): item
            for item in result.verdicts
        }
        updated: list[dict[str, Any]] = []
        for citation in citations:
            if not isinstance(citation, dict):
                continue
            key = _verdict_key(citation.get("source_kind"), citation.get("source_id"), citation.get("ordinal"))
            verdict = verdicts_by_key.get(key)
            if verdict:
                updated.append({**citation, "verdict": verdict})
            else:
                updated.append(citation)
        (
            self._store.client.table("vcso_chat_messages")
            .update({"citations": updated})
            .eq("id", message_id)
            .eq("user_id", user_id)
            .execute()
        )


def _source_text(ref: CitationRef, view: dict[str, Any]) -> str:
    if ref.verbatim:
        return ref.verbatim
    if view.get("type") == "chunk":
        return str(view.get("verbatim") or "")
    if view.get("type") == "wiki":
        evidence = "\n".join(json.dumps(item, default=str) for item in view.get("evidence") or [])
        return "\n\n".join(part for part in [str(view.get("prose") or view.get("summary") or ""), evidence] if part)
    if view.get("type") == "platform_record":
        fields = view.get("fields") or []
        return "\n".join(f"{item.get('label') or item.get('key')}: {item.get('value')}" for item in fields)
    return ""


def _is_unresolvable(view: dict[str, Any]) -> bool:
    return view.get("type") in {"error", "web_dark", "not_citable"} or view.get("code") in {
        "unresolvable",
        "unauthorized",
        "trace_only",
    }


def _roll_up(verdicts: list[str]) -> CitationVerdict:
    if not verdicts:
        return "unresolvable"
    if any(verdict == "unsupported" for verdict in verdicts):
        return "unsupported"
    if any(verdict == "partial" for verdict in verdicts):
        return "partial"
    if all(verdict == "supported" for verdict in verdicts):
        return "supported"
    return "unresolvable"


def _summary(overall: CitationVerdict, verdicts: list[dict[str, Any]]) -> str:
    counts = {name: 0 for name in ("supported", "partial", "unsupported", "unresolvable")}
    for item in verdicts:
        counts[str(item.get("verdict"))] = counts.get(str(item.get("verdict")), 0) + 1
    return (
        f"Checked {len(verdicts)} citation(s): "
        f"{counts['supported']} supported, {counts['partial']} partial, "
        f"{counts['unsupported']} unsupported, {counts['unresolvable']} unresolvable. "
        f"Overall: {overall}."
    )


def _normalize_verdict(value: Any) -> CitationVerdict:
    text = str(value or "").strip().lower()
    if text in {"supported", "partial", "unsupported", "unresolvable"}:
        return text  # type: ignore[return-value]
    if text in {"contradicted", "refuted"}:
        return "unsupported"
    return "unresolvable"


def _default_summary(verdict: CitationVerdict) -> str:
    return f"Citation check returned {verdict}."


def _response_text(response: Any) -> str:
    chunks: list[str] = []
    for block in getattr(response, "content", []) or []:
        text = getattr(block, "text", None)
        if isinstance(text, str):
            chunks.append(text)
    return "\n".join(chunks).strip()


def _parse_json(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?", "", stripped).strip()
        stripped = re.sub(r"```$", "", stripped).strip()
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return {"verdict": "unresolvable", "summary": "Verifier returned invalid structured output."}
    return parsed if isinstance(parsed, dict) else {"verdict": "unresolvable"}


def _truncate(value: str, max_chars: int) -> str:
    return value if len(value) <= max_chars else value[:max_chars].rstrip() + "\n\n[truncated]"


def _verdict_key(source_kind: Any, source_id: Any, ordinal: Any) -> tuple[str, str, str]:
    return (str(source_kind or ""), str(source_id or ""), str(ordinal or ""))
