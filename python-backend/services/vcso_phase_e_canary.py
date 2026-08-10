"""Fail-closed countability checks for Phase E live canaries."""

from __future__ import annotations

from typing import Any, Literal

PHASE_E_MARKER = "04B-E"
CanaryStage = Literal["pause", "resume"]


def _mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def sdk_session_pointer(run: dict[str, Any]) -> str:
    metadata = _mapping(run.get("metadata"))
    structured_result = _mapping(run.get("structured_result"))
    pointers = {
        str(value).strip()
        for value in (
            metadata.get("sdk_session_id"),
            structured_result.get("sdk_session_id"),
        )
        if str(value or "").strip()
    }
    if len(pointers) != 1:
        return ""
    return pointers.pop()


def evaluate_phase_e_countability(
    *,
    run: dict[str, Any],
    thread: dict[str, Any],
    transcript: list[dict[str, Any]] | None,
    stage: CanaryStage,
    pending_question: str | None = None,
    resumed_answer: str | None = None,
) -> dict[str, Any]:
    """Return an auditable verdict; callers must not count a failed verdict."""

    metadata = _mapping(run.get("metadata"))
    structured_result = _mapping(run.get("structured_result"))
    observed_phases = {
        str(value).strip()
        for value in (metadata.get("sdk_phase"), structured_result.get("sdk_phase"))
        if str(value or "").strip()
    }
    session_id = sdk_session_pointer(run)
    thread_session_id = str(thread.get("active_sdk_session_id") or "").strip()
    checks = {
        "run_sdk_session_mode": metadata.get("sdk_session_mode") is True,
        "phase_e_marker": observed_phases == {PHASE_E_MARKER},
        "run_session_pointer": bool(session_id),
        "thread_session_pointer_matches": bool(session_id)
        and thread_session_id == session_id,
        "sdk_transcript_reloads": bool(transcript),
        "run_belongs_to_thread": str(run.get("parent_thread_id") or "")
        == str(thread.get("id") or ""),
    }
    if stage == "pause":
        checks.update(
            {
                "run_is_live_for_resume": run.get("status") == "running",
                "thread_waiting_for_user": thread.get("agent_status")
                == "waiting_for_user",
                "pending_tool_pointer": bool(thread.get("sdk_pending_tool_use_id")),
                "pending_question": bool(thread.get("sdk_pending_question")),
                "pending_run_matches": str(thread.get("sdk_pending_run_id") or "")
                == str(run.get("id") or ""),
            }
        )
    else:
        normalized_question = str(pending_question or "").strip().lower()
        normalized_answer = str(resumed_answer or "").strip().lower()
        checks.update(
            {
                "run_completed": run.get("status") == "completed",
                "thread_not_waiting": thread.get("agent_status")
                != "waiting_for_user",
                "pending_tool_cleared": not thread.get("sdk_pending_tool_use_id"),
                "pending_question_cleared": not thread.get("sdk_pending_question"),
                "pending_run_cleared": not thread.get("sdk_pending_run_id"),
                "resume_pending_question_observed": bool(normalized_question),
                "resumed_answer_present": bool(normalized_answer),
                "resumed_answer_does_not_restate_pending_question": (
                    bool(normalized_answer)
                    and bool(normalized_question)
                    and normalized_question not in normalized_answer
                ),
            }
        )
    failures = [name for name, passed in checks.items() if not passed]
    return {
        "countable": not failures,
        "phase": PHASE_E_MARKER,
        "stage": stage,
        "run_id": str(run.get("id") or ""),
        "thread_id": str(thread.get("id") or ""),
        "sdk_session_id": session_id or None,
        "checks": checks,
        "failures": failures,
    }
