from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1]))

from scripts import submit_vcso_canary_turn as harness
from services.vcso_canary_anchor import PINNED_ANCHOR_PROMPT


def _sse(*events):
    return io.BytesIO(
        "".join(
            f"event: {name}\ndata: {json.dumps(payload, separators=(',', ':'))}\n\n"
            for name, payload in events
        ).encode("utf-8")
    )


def test_anchor_mode_submits_the_imported_pinned_prompt_byte_for_byte():
    assert harness.prompt_for_mode("anchor") == PINNED_ANCHOR_PROMPT
    assert harness.prompt_for_mode("anchor").encode("utf-8") == PINNED_ANCHOR_PROMPT.encode(
        "utf-8"
    )


def test_parser_has_no_free_text_prompt_argument():
    parser = harness.build_parser()
    option_strings = {
        option
        for action in parser._actions
        for option in action.option_strings
    }
    assert "--prompt" not in option_strings
    assert {action.dest for action in parser._actions if action.dest.startswith("prompt")} == {
        "prompt_mode"
    }


def test_stream_records_order_ids_answer_and_terminal_done():
    response = _sse(
        (
            "ready",
            {
                "threadId": "thread-1",
                "userMessage": {"id": "message-1"},
            },
        ),
        ("token", {"text": "Hello"}),
        (
            "done",
            {
                "chat": {"id": "thread-1"},
                "assistantMessage": {"id": "assistant-1", "content": "Hello"},
                "usage": {"outputTokens": 4},
            },
        ),
    )

    observed = harness.consume_sse_stream(response)

    assert observed.event_sequence == ["ready", "token", "done"]
    assert observed.done_received is True
    assert observed.thread_id == "thread-1"
    assert observed.user_message_id == "message-1"
    assert observed.assistant_message_id == "assistant-1"
    assert observed.answer_text == "Hello"
    assert observed.answer_tokens == 4


@pytest.mark.parametrize(
    ("response", "message"),
    [
        (
            _sse(("ready", {"threadId": "thread-1", "userMessage": {"id": "message-1"}})),
            "without a terminal done event",
        ),
        (
            _sse(("error", {"message": "private backend detail"})),
            "emitted an error event",
        ),
        (
            _sse(("done", {"assistantMessage": {"id": "assistant-1"}})),
            "did not identify the submitted turn",
        ),
    ],
)
def test_stream_failures_close_without_accepting_partial_success(response, message):
    with pytest.raises(harness.HarnessFailure, match=message):
        harness.consume_sse_stream(response)


def test_main_exits_nonzero_with_bounded_failure_output(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["submit_vcso_canary_turn.py", "--prompt-mode", "smoke"])

    def _fail(_prompt_mode):
        raise harness.HarnessFailure("authentication", "Founder authentication failed.")

    monkeypatch.setattr(harness, "run_harness", _fail)

    with pytest.raises(SystemExit) as exc:
        harness.main()

    assert exc.value.code == 1
    output = json.loads(capsys.readouterr().out)
    assert output == {
        "failure_stage": "authentication",
        "message": "Founder authentication failed.",
        "ok": False,
    }
