"""Founder-bound Supabase SessionStore for model-driven VCSO Deep Mode."""

from __future__ import annotations

import threading
import uuid
from typing import Any

import anyio
from claude_agent_sdk.types import (
    SessionKey,
    SessionListSubkeysKey,
    SessionStoreEntry,
)


def _uuid(value: str, label: str) -> str:
    try:
        return str(uuid.UUID(str(value)))
    except (TypeError, ValueError, AttributeError) as exc:
        raise ValueError(f"{label} must be a UUID") from exc


def _rpc_data(response: Any) -> Any:
    return getattr(response, "data", None)


class SupabaseVcsoSessionStore:
    """SDK transcript adapter bound to one founder and initiating Deep Mode turn.

    The backing table is in the unexposed ``private`` schema. All access goes
    through service-role-only RPCs which independently verify thread/message
    ownership on append. Loads remain founder-bound while allowing a legitimate
    same-founder fork to materialize a source session into a new thread.
    """

    def __init__(
        self,
        client: Any,
        *,
        user_id: str,
        thread_id: str,
        turn_message_id: str,
    ) -> None:
        self._client = client
        self.user_id = _uuid(user_id, "user_id")
        self.thread_id = _uuid(thread_id, "thread_id")
        self.turn_message_id = _uuid(turn_message_id, "turn_message_id")
        self._confirmed_sessions: set[str] = set()
        self._confirmation_lock = threading.Lock()

    async def append(self, key: SessionKey, entries: list[SessionStoreEntry]) -> None:
        session_id = _uuid(key["session_id"], "session_id")
        if not entries:
            return
        payload = {
            "p_user_id": self.user_id,
            "p_thread_id": self.thread_id,
            "p_turn_message_id": self.turn_message_id,
            "p_project_key": str(key["project_key"]),
            "p_session_id": session_id,
            "p_subpath": str(key.get("subpath") or ""),
            "p_entries": entries,
        }

        def execute() -> None:
            self._client.rpc("vcso_sdk_session_append", payload).execute()

        await anyio.to_thread.run_sync(execute)
        with self._confirmation_lock:
            self._confirmed_sessions.add(session_id)

    async def load(self, key: SessionKey) -> list[SessionStoreEntry] | None:
        session_id = _uuid(key["session_id"], "session_id")
        payload = {
            "p_user_id": self.user_id,
            "p_project_key": str(key["project_key"]),
            "p_session_id": session_id,
            "p_subpath": str(key.get("subpath") or ""),
        }

        def execute() -> Any:
            return _rpc_data(self._client.rpc("vcso_sdk_session_load", payload).execute())

        rows = await anyio.to_thread.run_sync(execute)
        if not isinstance(rows, list) or not rows:
            return None
        return [row for row in rows if isinstance(row, dict)]

    async def list_subkeys(self, key: SessionListSubkeysKey) -> list[str]:
        session_id = _uuid(key["session_id"], "session_id")
        payload = {
            "p_user_id": self.user_id,
            "p_project_key": str(key["project_key"]),
            "p_session_id": session_id,
        }

        def execute() -> Any:
            return _rpc_data(
                self._client.rpc("vcso_sdk_session_list_subkeys", payload).execute()
            )

        rows = await anyio.to_thread.run_sync(execute)
        if not isinstance(rows, list):
            return []
        return [str(value) for value in rows if str(value).strip()]

    def confirmed_persisted(self, session_id: str | None) -> bool:
        if not session_id:
            return False
        normalized = _uuid(session_id, "session_id")
        with self._confirmation_lock:
            return normalized in self._confirmed_sessions

