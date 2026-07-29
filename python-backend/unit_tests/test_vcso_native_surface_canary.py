from __future__ import annotations

from services.vcso_native_surface_canary import evaluate_native_surface_countability


RUN_ID = "11111111-1111-4111-8111-111111111111"
AGENTS = ["structured_data_agent", "per_user_wiki"]


def _native_run(**overrides):
    row = {
        "id": RUN_ID,
        "metadata": {
            "sdk_phase": "04B-D",
            "available_subagents": AGENTS,
            "sdk_native_lifecycle": [
                {
                    "sequence": 1,
                    "event": "runtime_manifest",
                    "decision": "native_granular",
                    "reason_code": "none",
                }
            ],
        },
        "structured_result": {
            "sdk_phase": "04B-D",
            "native_subagent_mode": True,
            "available_subagents": AGENTS,
        },
    }
    row.update(overrides)
    return row


def test_native_surface_run_is_countable_only_with_all_three_markers():
    verdict = evaluate_native_surface_countability(run=_native_run())

    assert verdict["countable"] is True
    assert verdict["classification"] == "countable"
    assert verdict["available_subagents"] == AGENTS
    assert verdict["failures"] == []


def test_failed_native_run_is_countable_from_activation_evidence_without_success_only_mode_field():
    run = _native_run(
        structured_result={
            "sdk_phase": "04B-D",
            "status": "failed",
            "available_subagents": AGENTS,
        }
    )

    verdict = evaluate_native_surface_countability(run=run)

    assert verdict["countable"] is True
    assert verdict["checks"]["runtime_manifest_native_granular"] is True


def test_flat_deep_mode_run_is_void():
    verdict = evaluate_native_surface_countability(
        run=_native_run(
            metadata={"sdk_phase": "04B-E"},
            structured_result={
                "sdk_phase": "04B-E",
                "native_subagent_mode": False,
                "available_subagents": [],
            },
        )
    )

    assert verdict["countable"] is False
    assert verdict["classification"] == "void"
    assert verdict["failures"] == [
        "phase_d_marker",
        "runtime_manifest_native_granular",
        "available_subagents",
    ]


def test_conflicting_persisted_markers_fail_closed():
    verdict = evaluate_native_surface_countability(
        run=_native_run(
            structured_result={
                "sdk_phase": "04B-C",
                "native_subagent_mode": True,
                "available_subagents": ["structured_data_agent"],
            }
        )
    )

    assert verdict["countable"] is False
    assert "phase_d_marker" in verdict["failures"]
    assert "available_subagents" in verdict["failures"]


def test_missing_or_wrong_runtime_manifest_fails_closed():
    missing = _native_run(
        metadata={"sdk_phase": "04B-D", "available_subagents": AGENTS}
    )
    wrong = _native_run(
        metadata={
            "sdk_phase": "04B-D",
            "available_subagents": AGENTS,
            "sdk_native_lifecycle": [
                {"event": "runtime_manifest", "decision": "app_owned"}
            ],
        }
    )

    assert evaluate_native_surface_countability(run=missing)["failures"] == [
        "runtime_manifest_native_granular"
    ]
    assert evaluate_native_surface_countability(run=wrong)["failures"] == [
        "runtime_manifest_native_granular"
    ]
