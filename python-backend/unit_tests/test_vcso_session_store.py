from __future__ import annotations

import asyncio
import uuid
from typing import Any

import pytest

from services.vcso_session_store import SupabaseVcsoSessionStore


USER_ID = str(uuid.uuid4())
THREAD_ID = str(uuid.uuid4())
MESSAGE_ID = str(uuid.uuid4())
SESSION_ID = str(uuid.uuid4())


class _Response:
    def __init__(self, data: Any) -> None:
        self.data = data


class _Rpc:
    def __init__(self, client: "_Client", name: str, payload: dict[str, Any]) -> None:
        self.client = client
        self.name = name
        self.payload = payload

    def execute(self) -> _Response:
        self.client.calls.append((self.name, self.payload))
        return _Response(self.client.results.get(self.name))


class _Client:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.results: dict[str, Any] = {}

    def rpc(self, name: str, payload: dict[str, Any]) -> _Rpc:
        return _Rpc(self, name, payload)


def _store(client: _Client) -> SupabaseVcsoSessionStore:
    return SupabaseVcsoSessionStore(
        client,
        user_id=USER_ID,
        thread_id=THREAD_ID,
        turn_message_id=MESSAGE_ID,
    )


def test_append_binds_founder_thread_message_and_confirms_durability() -> None:
    client = _Client()
    store = _store(client)
    entries = [{"type": "user", "uuid": "entry-1"}]

    asyncio.run(
        store.append(
            {"project_key": "architectos", "session_id": SESSION_ID},
            entries,
        )
    )

    assert client.calls == [
        (
            "vcso_sdk_session_append",
            {
                "p_user_id": USER_ID,
                "p_thread_id": THREAD_ID,
                "p_turn_message_id": MESSAGE_ID,
                "p_project_key": "architectos",
                "p_session_id": SESSION_ID,
                "p_subpath": "",
                "p_entries": entries,
            },
        )
    ]
    assert store.confirmed_persisted(SESSION_ID) is True


def test_load_is_founder_scoped_and_returns_opaque_entries() -> None:
    client = _Client()
    client.results["vcso_sdk_session_load"] = [
        {"type": "user", "uuid": "entry-1"},
        {"type": "assistant", "uuid": "entry-2"},
    ]
    store = _store(client)

    loaded = asyncio.run(
        store.load(
            {
                "project_key": "architectos",
                "session_id": SESSION_ID,
                "subpath": "subagents/agent-1",
            }
        )
    )

    assert loaded == client.results["vcso_sdk_session_load"]
    assert client.calls[0] == (
        "vcso_sdk_session_load",
        {
            "p_user_id": USER_ID,
            "p_project_key": "architectos",
            "p_session_id": SESSION_ID,
            "p_subpath": "subagents/agent-1",
        },
    )


def test_empty_load_returns_none_and_subkeys_are_filtered() -> None:
    client = _Client()
    client.results["vcso_sdk_session_load"] = []
    client.results["vcso_sdk_session_list_subkeys"] = [
        "subagents/agent-1",
        "",
        "subagents/agent-2",
    ]
    store = _store(client)

    loaded = asyncio.run(
        store.load({"project_key": "architectos", "session_id": SESSION_ID})
    )
    subkeys = asyncio.run(
        store.list_subkeys({"project_key": "architectos", "session_id": SESSION_ID})
    )

    assert loaded is None
    assert subkeys == ["subagents/agent-1", "subagents/agent-2"]


def test_invalid_identifiers_fail_before_rpc() -> None:
    client = _Client()
    with pytest.raises(ValueError, match="user_id must be a UUID"):
        SupabaseVcsoSessionStore(
            client,
            user_id="not-a-uuid",
            thread_id=THREAD_ID,
            turn_message_id=MESSAGE_ID,
        )
    assert client.calls == []
