"""SDK-M3 step A1 — the pinned anchor must actually trigger, and the control must not.

These tests are the guard that makes the reliability bar meaningful. A canary run against an anchor that
silently fails the trigger regex looks like a clean turn and proves nothing (`04B-D2-M2-FINISH-LOG.md`
documents the hyphenated "90-day" no-op). Pinning the string is only half the fix; asserting it still
matches the live regex is the other half.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.vcso_canary_anchor import (  # noqa: E402
    PINNED_ANCHOR_PROMPT,
    PINNED_CONTROL_PROMPT,
)
from services.vcso_sdk_loop import (  # noqa: E402
    P4_THIN_SLICE_REQUIRED_AGENTS,
    P4_THIN_SLICE_SIGNALS,
    native_subagent_requirements,
)

_DEEP_STRATEGIC = {"move_type": "strategic_synthesis", "depth": "deep"}


def test_pinned_anchor_matches_the_thin_slice_trigger():
    assert P4_THIN_SLICE_SIGNALS.search(PINNED_ANCHOR_PROMPT)


def test_pinned_anchor_requires_all_three_required_workers():
    assert (
        native_subagent_requirements(message=PINNED_ANCHOR_PROMPT, intent=_DEEP_STRATEGIC)
        == P4_THIN_SLICE_REQUIRED_AGENTS
    )


def test_pinned_control_does_not_trigger_decomposition():
    """Effort-scaling, the other direction: the control must require no workers at all."""

    assert not P4_THIN_SLICE_SIGNALS.search(PINNED_CONTROL_PROMPT)
    assert native_subagent_requirements(message=PINNED_CONTROL_PROMPT, intent=_DEEP_STRATEGIC) == ()


def test_hyphenated_ninety_day_variant_is_the_documented_no_op():
    """The exact edit most likely to be made by hand — and it silently disarms the canary."""

    hyphenated = PINNED_ANCHOR_PROMPT.replace("90 days", "90-day period")
    assert not P4_THIN_SLICE_SIGNALS.search(hyphenated)


def test_anchor_states_no_figures_so_the_lead_must_go_and_get_them():
    """Canary 9's replacement anchor stated the finding ('top two clients are a large share of revenue')
    and the lead did not delegate. Guard the property, not just the bytes: no digits other than the 90."""

    digits = [char for char in PINNED_ANCHOR_PROMPT if char.isdigit()]
    assert digits == ["9", "0"]


# ---------------------------------------------------------------------------------------------------
# SDK-M3 step C — reasoning quality: effort-scaling both ways + explicit per-worker contracts
# ---------------------------------------------------------------------------------------------------

import json  # noqa: E402

import pytest  # noqa: E402

from services.vcso_sdk_loop import (  # noqa: E402
    MIN_TASK_OBJECTIVE_CHARS,
    WORKER_DELEGATION_CONTRACTS,
    _native_lead_prompt,
    _parse_task_contract,
)


def _contract(objective, **over):
    body = {
        "objective": objective,
        "output_format": "compact cited findings",
        "tools_sources": ["founder_dataset"],
        "boundaries": ["founder isolation", "cite every claim", "compact output"],
        "context_scope": {},
    }
    body.update(over)
    return json.dumps(body)


def test_lead_prompt_states_effort_scaling_in_both_directions():
    prompt = _native_lead_prompt(P4_THIN_SLICE_REQUIRED_AGENTS)
    assert "EFFORT-SCALING" in prompt
    # Up: this turn decomposes. Down: a simple turn is answered directly and NOT decomposed.
    assert "must be decomposed" in prompt
    assert "answered DIRECTLY in one pass" in prompt
    assert "Never over-decompose" in prompt


def test_lead_prompt_carries_one_explicit_contract_per_required_worker():
    prompt = _native_lead_prompt(P4_THIN_SLICE_REQUIRED_AGENTS)
    assert "PER-WORKER DELEGATION CONTRACTS" in prompt
    for key in P4_THIN_SLICE_REQUIRED_AGENTS:
        spec = WORKER_DELEGATION_CONTRACTS[key]
        assert key in prompt
        # objective / output_format / tools_sources / boundaries all present for THIS worker.
        for field in ("objective", "output_format", "tools_sources", "boundaries"):
            assert spec[field] in prompt, f"{key}.{field} missing from the lead prompt"


def test_lead_prompt_contract_brief_follows_the_required_agent_set():
    """A diagnostic single-worker turn must not be handed the other workers' contracts."""

    prompt = _native_lead_prompt(("structured_data_agent",))
    assert WORKER_DELEGATION_CONTRACTS["structured_data_agent"]["objective"] in prompt
    assert WORKER_DELEGATION_CONTRACTS["sandbox_execution_agent"]["objective"] not in prompt


def test_contract_rejects_a_placeholder_objective():
    with pytest.raises(ValueError):
        _parse_task_contract(_contract("run it"))


def test_contract_accepts_a_real_per_worker_objective():
    objective = "Quantify client-concentration and margin trend from the founder dataset"
    assert len(objective) >= MIN_TASK_OBJECTIVE_CHARS
    assert _parse_task_contract(_contract(objective))["objective"] == objective


def test_contract_rejects_an_objective_reused_from_a_sibling_worker():
    """The copy-paste failure: one objective sent to two workers is not two delegation contracts."""

    objective = "Quantify client-concentration and margin trend from the founder dataset"
    with pytest.raises(ValueError) as excinfo:
        _parse_task_contract(
            _contract(objective), prior_objectives={"structured_data_agent": objective}
        )
    assert "structured_data_agent" in str(excinfo.value)


def test_contract_objective_reuse_check_ignores_case_and_whitespace():
    objective = "Quantify client-concentration and margin trend from the founder dataset"
    with pytest.raises(ValueError):
        _parse_task_contract(
            _contract("  QUANTIFY   client-concentration and margin trend from the founder DATASET "),
            prior_objectives={"structured_data_agent": objective},
        )


def test_distinct_objectives_are_accepted_for_different_workers():
    _parse_task_contract(
        _contract("Retrieve this founder's strategic context on client mix and positioning"),
        prior_objectives={
            "structured_data_agent": "Quantify client-concentration and margin trend from the dataset"
        },
    )


# ---------------------------------------------------------------------------------------------------
# Gate 2 delivery-close — stream-disconnect injection gate + keepalive observability
# ---------------------------------------------------------------------------------------------------

from services.vcso_sdk_loop import stream_disconnect_injection_after  # noqa: E402

_FOUNDER = "cd490873-99aa-4533-9240-f0aa04deb54f"


def _disconnect_settings(**over):
    base = {
        "diagnostic_stream_disconnect_enabled": True,
        "diagnostic_user_ids": [_FOUNDER],
        "diagnostic_stream_disconnect_after_events": 4,
    }
    base.update(over)
    return base


def test_disconnect_injection_returns_cut_point_for_the_enrolled_founder():
    assert stream_disconnect_injection_after(_disconnect_settings(), _FOUNDER) == 4


def test_disconnect_injection_is_inert_when_the_enable_bool_is_off():
    assert (
        stream_disconnect_injection_after(
            _disconnect_settings(diagnostic_stream_disconnect_enabled=False), _FOUNDER
        )
        is None
    )


def test_disconnect_injection_is_inert_for_a_user_not_on_the_allowlist():
    assert stream_disconnect_injection_after(_disconnect_settings(), "4ef80000-0000-0000-0000-000000000000") is None
    assert stream_disconnect_injection_after(_disconnect_settings(), None) is None


def test_disconnect_injection_never_cuts_before_ready():
    """0 or negative must yield None: the client needs `ready` (thread id + user message) for the Defect-8
    recovery to find this turn's answer without risking an older one. Cutting before ready tests nothing."""

    assert stream_disconnect_injection_after(_disconnect_settings(diagnostic_stream_disconnect_after_events=0), _FOUNDER) is None
    assert stream_disconnect_injection_after(_disconnect_settings(diagnostic_stream_disconnect_after_events=-3), _FOUNDER) is None


def test_disconnect_injection_tolerates_a_garbage_after_value():
    assert stream_disconnect_injection_after(_disconnect_settings(diagnostic_stream_disconnect_after_events="nope"), _FOUNDER) is None


def test_disconnect_injection_is_inert_on_empty_settings():
    assert stream_disconnect_injection_after(None, _FOUNDER) is None
    assert stream_disconnect_injection_after({}, _FOUNDER) is None


# ---------------------------------------------------------------------------------------------------
# Gate 2 delivery-close, follow-up — drop-done (in-flight recovery) + cross-worker probe gates
# ---------------------------------------------------------------------------------------------------

from services.vcso_sdk_loop import (  # noqa: E402
    STREAM_DROP_DONE_EVENTS,
    cross_worker_probe_enabled,
    stream_drop_done_injection,
)


def test_drop_done_gate_on_for_the_enrolled_founder():
    assert stream_drop_done_injection(
        {"diagnostic_stream_drop_done_enabled": True, "diagnostic_user_ids": [_FOUNDER]}, _FOUNDER
    ) is True


def test_drop_done_gate_inert_when_disabled_or_off_allowlist():
    assert stream_drop_done_injection(
        {"diagnostic_stream_drop_done_enabled": False, "diagnostic_user_ids": [_FOUNDER]}, _FOUNDER
    ) is False
    assert stream_drop_done_injection(
        {"diagnostic_stream_drop_done_enabled": True, "diagnostic_user_ids": [_FOUNDER]}, "someone-else"
    ) is False
    assert stream_drop_done_injection(None, _FOUNDER) is False


def test_drop_done_event_set_withholds_answer_and_terminal_but_not_keepalive():
    # The connection must stay alive (heartbeat kept) and steps must still render; only the answer tokens
    # and the terminal done are withheld so the answer arrives via recovery.
    assert "token" in STREAM_DROP_DONE_EVENTS
    assert "done" in STREAM_DROP_DONE_EVENTS
    assert "heartbeat" not in STREAM_DROP_DONE_EVENTS
    assert "step" not in STREAM_DROP_DONE_EVENTS
    assert "sub_agent_step" not in STREAM_DROP_DONE_EVENTS
    assert "ready" not in STREAM_DROP_DONE_EVENTS


def test_cross_worker_probe_gate_on_for_the_enrolled_founder():
    assert cross_worker_probe_enabled(
        {"diagnostic_cross_worker_probe_enabled": True, "diagnostic_user_ids": [_FOUNDER]}, _FOUNDER
    ) is True


def test_cross_worker_probe_gate_inert_when_disabled_or_off_allowlist():
    assert cross_worker_probe_enabled(
        {"diagnostic_cross_worker_probe_enabled": False, "diagnostic_user_ids": [_FOUNDER]}, _FOUNDER
    ) is False
    assert cross_worker_probe_enabled(
        {"diagnostic_cross_worker_probe_enabled": True, "diagnostic_user_ids": [_FOUNDER]}, "someone-else"
    ) is False
    assert cross_worker_probe_enabled(None, _FOUNDER) is False
