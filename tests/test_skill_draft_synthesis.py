from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python-backend"))

from services.skill_draft_synthesis import GuidedDraftRequest, SkillDraftSynthesisService


class FakeMessages:
    def __init__(self, text: str) -> None:
        self._text = text

    def create(self, **_kwargs):
        return SimpleNamespace(content=[SimpleNamespace(text=self._text)])


class FakeAnthropic:
    def __init__(self, text: str) -> None:
        self.messages = FakeMessages(text)


def test_guided_draft_normalizes_valid_json_response():
    service = SkillDraftSynthesisService(
        anthropic_client=FakeAnthropic(
            '{"assistant_message":"Looks ready.","ready":true,"name":"Margin Review",'
            '"description":"Reviews margin decisions.","domain":"financial","skill_kind":"diagnostic",'
            '"trigger_tags":["margin"],"required_platform_context":["financial_context"],'
            '"body":"# Margin Review\\n\\nReview the numbers."}'
        ),
        model="test-model",
    )

    result = service.draft(GuidedDraftRequest(messages=[], current_draft={}))

    assert result["ready"] is True
    assert result["name"] == "Margin Review"
    assert result["trigger_tags"] == ["margin"]
    assert result["body"].startswith("# Margin Review")


def test_guided_draft_malformed_model_response_degrades_gracefully():
    service = SkillDraftSynthesisService(
        anthropic_client=FakeAnthropic("this is not json"),
        model="test-model",
    )

    result = service.draft(
        GuidedDraftRequest(
            messages=[{"role": "founder", "content": "Build a review skill."}],
            current_draft={"name": "Existing Draft"},
        )
    )

    assert result["ready"] is False
    assert result["name"] == "Existing Draft"
    assert "could not turn that" in result["assistant_message"].lower()
