from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from services.vcso_phase_e_canary import evaluate_phase_e_countability


RUN_ID = "11111111-1111-4111-8111-111111111111"
THREAD_ID = "22222222-2222-4222-8222-222222222222"
SESSION_ID = "33333333-3333-4333-8333-333333333333"


def _paused_run(**overrides):
    row = {
        "id": RUN_ID,
        "parent_thread_id": THREAD_ID,
        "status": "running",
        "metadata": {
            "deep_mode": False,
            "sdk_session_mode": True,
            "sdk_phase": "04B-E",
            "sdk_session_id": SESSION_ID,
        },
        "structured_result": {},
    }
    row.update(overrides)
    return row


def _paused_thread(**overrides):
    row = {
        "id": THREAD_ID,
        "agent_status": "waiting_for_user",
        "active_sdk_session_id": SESSION_ID,
        "sdk_pending_tool_use_id": "tool-1",
        "sdk_pending_question": "Approval word?",
        "sdk_pending_run_id": RUN_ID,
    }
    row.update(overrides)
    return row


def test_pause_is_countable_only_with_persisted_phase_e_session():
    verdict = evaluate_phase_e_countability(
        run=_paused_run(),
        thread=_paused_thread(),
        transcript=[{"type": "user"}],
        stage="pause",
    )

    assert verdict["countable"] is True
    assert verdict["failures"] == []


def test_phase_c_run_is_void_even_if_ui_was_expected_to_be_deep():
    run = _paused_run(
        metadata={
            "deep_mode": False,
            "sdk_session_mode": False,
            "sdk_phase": "04B-C",
        }
    )

    verdict = evaluate_phase_e_countability(
        run=run,
        thread=_paused_thread(active_sdk_session_id=None),
        transcript=None,
        stage="pause",
    )

    assert verdict["countable"] is False
    assert "run_sdk_session_mode" in verdict["failures"]
    assert "phase_e_marker" in verdict["failures"]
    assert "run_session_pointer" in verdict["failures"]


def test_mismatched_thread_pointer_cannot_count():
    verdict = evaluate_phase_e_countability(
        run=_paused_run(),
        thread=_paused_thread(active_sdk_session_id="different-session"),
        transcript=[{"type": "user"}],
        stage="pause",
    )

    assert verdict["countable"] is False
    assert verdict["failures"] == ["thread_session_pointer_matches"]


def test_completed_resume_requires_pending_state_to_be_cleared():
    run = _paused_run(
        status="completed",
        metadata={"deep_mode": False, "sdk_session_mode": True, "sdk_phase": "04B-E"},
        structured_result={
            "sdk_phase": "04B-E",
            "sdk_session_id": SESSION_ID,
        },
    )
    thread = _paused_thread(
        agent_status="complete",
        sdk_pending_tool_use_id=None,
        sdk_pending_question=None,
        sdk_pending_run_id=None,
    )

    verdict = evaluate_phase_e_countability(
        run=run,
        thread=thread,
        transcript=[{"type": "assistant"}],
        stage="resume",
    )

    assert verdict["countable"] is True
