from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1]))

from scripts.arm_native_capture_canary import (
    DIAGNOSTIC_FALSE_KEYS,
    assert_armed_state,
    assert_dark_state,
    build_armed_settings,
    build_dark_settings,
)
from scripts.verify_native_activation_smoke import evaluate_activation_smoke


FOUNDER_ID = "cd490873-99aa-4533-9240-f0aa04deb54f"


def test_atomic_arm_places_founder_in_both_allowlists_and_disables_other_diagnostics():
    armed = build_armed_settings({"unrelated": "preserved"}, FOUNDER_ID)
    row = {"is_enabled": True, "settings": armed}

    assert_armed_state(row, FOUNDER_ID)
    assert armed["test_user_ids"] == [FOUNDER_ID]
    assert armed["diagnostic_user_ids"] == [FOUNDER_ID]
    assert armed["diagnostic_sdk_stream_capture_enabled"] is True
    assert armed["unrelated"] == "preserved"
    assert all(armed[key] is False for key in DIAGNOSTIC_FALSE_KEYS)


def test_arm_readback_rejects_the_two_allowlist_trap():
    armed = build_armed_settings({}, FOUNDER_ID)
    armed["test_user_ids"] = []

    with pytest.raises(RuntimeError, match="test_user_ids"):
        assert_armed_state({"is_enabled": True, "settings": armed}, FOUNDER_ID)


def test_disarm_clears_both_allowlists_and_capture_switch():
    dark = build_dark_settings(build_armed_settings({}, FOUNDER_ID))
    row = {"is_enabled": False, "settings": dark}

    assert_dark_state(row)
    assert dark["test_user_ids"] == []
    assert dark["diagnostic_user_ids"] == []
    assert dark["native_model_driven_enabled"] is False
    assert dark["diagnostic_sdk_stream_capture_enabled"] is False


def test_activation_smoke_requires_exact_phase_workers_and_nonempty_capture():
    run = {
        "id": "run-1",
        "status": "completed",
        "metadata": {
            "sdk_phase": "04B-D",
            "native_subagent_mode": True,
            "available_subagents": ["structured_data_agent", "per_user_wiki"],
            "sdk_stream_capture_enabled": True,
            "sdk_raw_stream_capture": [{"event": "sdk_stream_message"}],
        },
        "structured_result": {
            "sdk_phase": "04B-D",
            "native_subagent_mode": True,
            "available_subagents": ["structured_data_agent", "per_user_wiki"],
            "sdk_stream_capture_enabled": True,
        },
    }

    assert evaluate_activation_smoke(run)["activated"] is True


@pytest.mark.parametrize(
    "mutation",
    [
        lambda run: run["metadata"].update({"sdk_phase": "04B-C"}),
        lambda run: run["metadata"].update({"native_subagent_mode": False}),
        lambda run: run["metadata"].update({"available_subagents": []}),
        lambda run: run["metadata"].update({"sdk_raw_stream_capture": []}),
    ],
)
def test_activation_smoke_fails_closed(mutation):
    run = {
        "id": "run-1",
        "status": "completed",
        "metadata": {
            "sdk_phase": "04B-D",
            "native_subagent_mode": True,
            "available_subagents": ["structured_data_agent", "per_user_wiki"],
            "sdk_stream_capture_enabled": True,
            "sdk_raw_stream_capture": [{"event": "sdk_stream_message"}],
        },
    }
    mutation(run)

    assert evaluate_activation_smoke(run)["activated"] is False
