"""Run the bounded Phase-2 intent calibration set against the configured worker model.

This is a read-only model eval: it does not persist messages, usage, flags, or wiki data.
"""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass
from pathlib import Path

import anthropic
from dotenv import load_dotenv

from core.config import get_settings
from core.langsmith_tracing import trace_anthropic_client
from services.vcso_intent_read import IntentReadService


@dataclass(frozen=True)
class EvalCase:
    name: str
    prompt: str
    move_type: str
    depth: str
    should_decompose: bool


CASES = (
    EvalCase(
        "capstone",
        "My top-three client concentration is climbing while margin compresses — what should I do?",
        "strategic_synthesis",
        "deep",
        True,
    ),
    EvalCase(
        "connected_metrics",
        "Revenue is up but cash is tighter. How do those two metrics connect, and what should I change?",
        "strategic_synthesis",
        "deep",
        True,
    ),
    EvalCase(
        "priority_constraint",
        "Should I prioritize hiring a sales lead or fixing delivery capacity given a three-month runway?",
        "strategic_synthesis",
        "deep",
        True,
    ),
    EvalCase(
        "utilization_tradeoff",
        "Utilization is at 90% and pipeline is growing. What tradeoff should I make next quarter?",
        "strategic_synthesis",
        "deep",
        True,
    ),
    EvalCase(
        "churn_win_rate",
        "Client churn is rising while win rate improves. What does that combination mean for our strategy?",
        "strategic_synthesis",
        "deep",
        True,
    ),
    EvalCase(
        "risk_sequence",
        "Given founder dependency and weak margins, what sequence would reduce risk fastest?",
        "strategic_synthesis",
        "deep",
        True,
    ),
    EvalCase(
        "specialize_or_expand",
        "We can expand services or specialize further. Which path fits our constraints and why?",
        "strategic_synthesis",
        "deep",
        True,
    ),
    EvalCase("record_lookup", "What's my current sprint goal and top initiative?", "lookup", "shallow", False),
    EvalCase(
        "document_lookup",
        "What does the Northlight Digital Agency Overview say about our delivery model?",
        "lookup",
        "shallow",
        False,
    ),
    EvalCase(
        "brainstorm",
        "I'm thinking about productizing our retainer — help me think it through.",
        "brainstorm",
        "deep",
        False,
    ),
    EvalCase("ambient_update", "We signed the operations lead today.", "ambient", "shallow", False),
    EvalCase("produce", "Draft a one-page 90-day operating plan.", "produce", "deep", False),
    EvalCase("metric_lookup", "What is our current operating margin?", "lookup", "shallow", False),
    EvalCase("ambient_observation", "The team finally feels stable this week.", "ambient", "shallow", False),
)


def _metrics(rows: list[dict[str, object]], threshold: float) -> dict[str, object]:
    tp = fp = fn = 0
    for row in rows:
        predicted = row["move_type"] == "strategic_synthesis" and float(row["confidence"]) >= threshold
        expected = bool(row["should_decompose"])
        tp += int(predicted and expected)
        fp += int(predicted and not expected)
        fn += int(not predicted and expected)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {
        "threshold": threshold,
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
    }


def main() -> int:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is required")
    model = os.environ.get("VCSO_INTENT_EVAL_MODEL", "claude-haiku-4-5-20251001")
    client = trace_anthropic_client(anthropic.Anthropic(api_key=settings.anthropic_api_key))
    service = IntentReadService(client)
    rows: list[dict[str, object]] = []
    for case in CASES:
        result, _response = service.classify(
            user_id="intent-calibration-eval",
            thread_id="intent-calibration-eval",
            run_id=str(uuid.uuid4()),
            working_state=None,
            latest_message=case.prompt,
            model=model,
            settings={"confidence_threshold": 0.5, "timeout_ms": 10_000},
        )
        row = {
            "name": case.name,
            "expected_move_type": case.move_type,
            "expected_depth": case.depth,
            "should_decompose": case.should_decompose,
            "status": result.status,
            "move_type": result.move_type,
            "depth": result.depth,
            "confidence": result.confidence,
            "label_correct": result.move_type == case.move_type and result.depth == case.depth,
        }
        rows.append(row)
    thresholds = [_metrics(rows, value) for value in (0.75, 0.80, 0.85, 0.90)]
    report = {
        "model": model,
        "case_count": len(rows),
        "label_accuracy": round(sum(bool(row["label_correct"]) for row in rows) / len(rows), 4),
        "cases": rows,
        "threshold_sweep": thresholds,
    }
    print(json.dumps(report, indent=2))
    selected = next(item for item in thresholds if item["threshold"] == 0.80)
    capstone = next(row for row in rows if row["name"] == "capstone")
    return 0 if (
        all(bool(row["label_correct"]) for row in rows)
        and capstone["move_type"] == "strategic_synthesis"
        and capstone["depth"] == "deep"
        and float(capstone["confidence"] or 0.0) >= 0.80
        and selected["precision"] == 1.0
        and selected["recall"] == 1.0
    ) else 1


if __name__ == "__main__":
    raise SystemExit(main())
