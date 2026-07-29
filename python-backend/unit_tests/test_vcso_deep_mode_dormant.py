from __future__ import annotations

import inspect
from pathlib import Path

from services.vcso_chat_service import VcsoChatService


def test_request_boundary_forces_deep_mode_off():
    source = (Path(__file__).parents[1] / "main.py").read_text(encoding="utf-8")
    route = source.split('@app.post("/api/vcso/chat")', 1)[1].split(
        '@app.post("/api/vcso/threads/{thread_id}/compact")', 1
    )[0]

    assert "deep_mode=False" in route
    assert "deep_mode=payload.deepMode" not in route


def test_pending_resume_cannot_reenable_deep_mode_or_bypass_native_routing():
    source = inspect.getsource(VcsoChatService._stream_chat_impl)
    routing = source.split("native_required_agents =", 1)[1].split(
        "sdk_native_subagent_mode =", 1
    )[0]

    assert "pending_sdk_resume = False" in source
    assert "deep_mode = False" in source
    assert "payload.deep_mode or pending_sdk_resume" not in source
    assert "not deep_mode" not in routing
    assert "not is_deep_resume" not in routing
