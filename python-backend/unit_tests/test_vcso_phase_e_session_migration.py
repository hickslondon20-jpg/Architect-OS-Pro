from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "docs" / "migrations" / "20260810_phase_e_sdk_session_append_native_turns.sql"


def test_phase_e_append_rpc_no_longer_requires_deleted_deep_mode_flag() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    assert "m.deep_mode is true" not in sql
    assert "SDK session turn ownership or Deep Mode check failed" not in sql
    assert "m.id = p_turn_message_id" in sql
    assert "m.thread_id = p_thread_id" in sql
    assert "m.user_id = p_user_id" in sql
