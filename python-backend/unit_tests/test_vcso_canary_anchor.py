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
