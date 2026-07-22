r"""Phase D2 (SDK-M3) — the PINNED canary anchor and its simple control.

WHY THIS MODULE EXISTS
----------------------
Through SDK-M2 the delegation anchor was an **uncontrolled variable**: each canary was typed fresh into
the chat box. Delegation then ran **3 passes / 2 failures across five live runs**, and the single clearest
failure (Canary 9) was traced to an agent-authored replacement anchor — 70% longer, two questions, and it
*stated* the concentration finding the lead was supposed to go and get
(`04B-D2-M2-FINISH-LOG.md` → "Canary 9"). You cannot measure reliability while the input keeps moving.

So the anchor is pinned **here, in version control**, and the M3 reliability bar (N consecutive passes)
is measured against this exact byte string. `PINNED_ANCHOR_PROMPT` is Canary 8's verbatim text — the only
wording that has ever produced a full three-worker model-driven delegation.

THE TRIGGER REGEX IS UNFORGIVING. `vcso_sdk_loop.P4_THIN_SLICE_SIGNALS` requires all three of a financial
term, `concentration`, and `\b90\s+days?\b` — **`90 days` with a space**. A hyphenated "90-day" silently
no-ops: the turn runs as an ordinary VCSO answer, no worker is required, and the canary proves nothing
while looking like it ran. `test_vcso_canary_anchor.py` asserts the pinned anchor matches and the control
does not, so a well-meaning edit to either string fails a test instead of a canary.

SCOPE GUARD: constants only. Imported by tests and canary scripts; no live path imports this module, so
it changes nothing about how a founder turn executes.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------------------------------
# The pinned anchor — MUST decompose (lead reasons, delegates to all three thin-slice workers)
# ---------------------------------------------------------------------------------------------------
# Canary 8 / Canary 9-retry verbatim. Do not "improve" it. Its properties are load-bearing: it supplies
# NO figures and asks only "what should I do", so the lead cannot answer from the assembled context and
# must go and get the numbers. Every M3 reliability run sends this byte-for-byte.
PINNED_ANCHOR_PROMPT = (
    "Our client concentration is rising and our margin is compressing. "
    "What should I do in the next 90 days?"
)

# ---------------------------------------------------------------------------------------------------
# The simple control — MUST answer directly (no decomposition, no Task, no child rows)
# ---------------------------------------------------------------------------------------------------
# Effort-scaling has two directions and only proving one is not proving it. This control is a plain
# lookup: it deliberately carries none of the three trigger signals, so a correctly-scaled system answers
# it in one pass. Its evidence is negative and cheap to check — zero `agent_delegation_runs` child rows
# for that parent, and a turn cost an order of magnitude below the anchor's.
#
# HONEST LIMIT OF THIS CONTROL: routing is app-gated first (`native_subagent_requirements` returns () when
# the signals are absent), so a passing control proves the SYSTEM does not over-decompose. It is not by
# itself proof of model-level restraint. The model-level claim rests on the lead prompt's own
# effort-scaling clause, and is only visible on turns that DO reach the model-driven branch.
PINNED_CONTROL_PROMPT = "What is my current quarter's sprint theme?"


# The three signals the thin-slice gate requires, kept here as documentation for whoever runs a canary by
# hand. The authoritative regex lives in `vcso_sdk_loop.P4_THIN_SLICE_SIGNALS`; the test asserts agreement.
ANCHOR_REQUIRED_SIGNALS: tuple[str, ...] = (
    "a financial term (financial / p&l / margin / revenue)",
    "the word 'concentration'",
    "'90 days' WITH A SPACE (a hyphenated '90-day' silently no-ops)",
)

__all__ = [
    "PINNED_ANCHOR_PROMPT",
    "PINNED_CONTROL_PROMPT",
    "ANCHOR_REQUIRED_SIGNALS",
]
