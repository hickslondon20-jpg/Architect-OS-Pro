"""Local Phase E SDK session-store spike against the real Supabase RPC adapter.

This does not arm production flags or call the deployed VCSO backend. It creates
clearly labeled local-spike thread/message fixtures, runs the pinned Claude Agent
SDK with SupabaseVcsoSessionStore, and reports whether SDK append/load calls
actually happen for deferred, completed, resume, and fork shapes.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from claude_agent_sdk import ClaudeAgentOptions, create_sdk_mcp_server, query, tool
from claude_agent_sdk.types import DeferredToolUse, HookMatcher, ResultMessage, SessionKey
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, str(Path(__file__).parents[1]))

from core.config import get_settings
from services.vcso_session_store import SupabaseVcsoSessionStore


ENV_PATH = Path(__file__).parents[1] / ".env"
PROJECT_KEY_FALLBACK = "architectos-vcso-deep"
ASK_USER_TOOL = "mcp__architectos__ask_user"


class LoggingSupabaseSessionStore(SupabaseVcsoSessionStore):
    def __init__(self, *args: Any, label: str, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.label = label
        self.append_calls: list[dict[str, Any]] = []
        self.load_calls: list[dict[str, Any]] = []
        self.list_subkeys_calls: list[dict[str, Any]] = []

    async def append(self, key: SessionKey, entries: list[dict[str, Any]]) -> None:
        self.append_calls.append(
            {
                "project_key": str(key.get("project_key") or ""),
                "session_id": str(key.get("session_id") or ""),
                "subpath": str(key.get("subpath") or ""),
                "entry_count": len(entries),
            }
        )
        await super().append(key, entries)

    async def load(self, key: SessionKey) -> list[dict[str, Any]] | None:
        self.load_calls.append(
            {
                "project_key": str(key.get("project_key") or ""),
                "session_id": str(key.get("session_id") or ""),
                "subpath": str(key.get("subpath") or ""),
            }
        )
        return await super().load(key)

    async def list_subkeys(self, key: dict[str, Any]) -> list[str]:
        self.list_subkeys_calls.append(
            {
                "project_key": str(key.get("project_key") or ""),
                "session_id": str(key.get("session_id") or ""),
            }
        )
        return await super().list_subkeys(key)


def _single(response: Any, label: str) -> dict[str, Any]:
    data = getattr(response, "data", None)
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return data[0]
    if isinstance(data, dict):
        return data
    raise RuntimeError(f"{label} did not return one row")


def _fixture(client: Any, *, user_id: str, label: str, deep_mode: bool) -> dict[str, str]:
    marker = f"phase-e-store-spike-{label}-{uuid.uuid4().hex[:8]}"
    thread = _single(
        client.table("vcso_chat_threads")
        .insert(
            {
                "user_id": user_id,
                "title": f"[Phase E store spike] {marker}",
                "agent_status": "working",
            }
        )
        .execute(),
        "thread insert",
    )
    message = _single(
        client.table("vcso_chat_messages")
        .insert(
            {
                "thread_id": str(thread["id"]),
                "user_id": user_id,
                "role": "user",
                "content": f"Local SDK session-store spike fixture: {marker}",
                "deep_mode": deep_mode,
            }
        )
        .execute(),
        "message insert",
    )
    return {
        "marker": marker,
        "thread_id": str(thread["id"]),
        "message_id": str(message["id"]),
        "deep_mode": deep_mode,
    }


def _store(client: Any, *, user_id: str, fixture: dict[str, str], label: str) -> LoggingSupabaseSessionStore:
    return LoggingSupabaseSessionStore(
        client,
        user_id=user_id,
        thread_id=fixture["thread_id"],
        turn_message_id=fixture["message_id"],
        label=label,
    )


def _ask_user_server() -> dict[str, Any]:
    @tool(
        "ask_user",
        "Ask one founder-owned preference question.",
        {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "reason_code": {"type": "string"},
            },
            "required": ["question", "reason_code"],
        },
    )
    async def ask_user(_args: dict[str, Any]) -> dict[str, Any]:
        return {"content": [{"type": "text", "text": "unexpected ask_user execution"}]}

    return create_sdk_mcp_server(name="architectos", version="1.0.0", tools=[ask_user])


async def _run_query(
    *,
    prompt: str,
    system_prompt: str,
    model: str,
    api_key: str,
    store: LoggingSupabaseSessionStore,
    session_store_flush: str,
    resume: str | None = None,
    fork_session: bool = False,
    ask_user_defer: bool = False,
    max_budget_usd: float = 0.08,
) -> dict[str, Any]:
    hook_calls: list[dict[str, Any]] = []
    hooks: dict[str, Any] = {}
    mcp_servers: dict[str, Any] = {}
    allowed_tools: list[str] = []

    if ask_user_defer:
        mcp_servers["architectos"] = _ask_user_server()
        allowed_tools = [ASK_USER_TOOL]

        async def defer_ask_user(
            input_data: dict[str, Any],
            tool_use_id: str | None,
            _context: Any,
        ) -> dict[str, Any]:
            hook_calls.append(
                {
                    "tool_name": str(input_data.get("tool_name") or ""),
                    "tool_use_id": str(tool_use_id or ""),
                    "has_question": bool(
                        (input_data.get("tool_input") or {}).get("question")
                    ),
                }
            )
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "defer",
                    "permissionDecisionReason": "Pause for founder input.",
                }
            }

        hooks["PreToolUse"] = [HookMatcher(matcher=ASK_USER_TOOL, hooks=[defer_ask_user])]

    options = ClaudeAgentOptions(
        allowed_tools=allowed_tools,
        mcp_servers=mcp_servers,
        strict_mcp_config=True,
        permission_mode="dontAsk",
        system_prompt=system_prompt,
        model=model,
        max_turns=4,
        max_budget_usd=max_budget_usd,
        include_partial_messages=True,
        hooks=hooks,
        setting_sources=[],
        env={"ANTHROPIC_API_KEY": api_key},
        thinking={"type": "disabled"},
        session_store=store,
        session_store_flush=session_store_flush,  # type: ignore[arg-type]
        resume=resume,
        fork_session=fork_session,
    )
    started = time.monotonic()
    result_message: ResultMessage | None = None
    assistant_text_parts: list[str] = []
    message_types: list[str] = []
    async for message in query(prompt=prompt, options=options):
        message_types.append(type(message).__name__)
        if hasattr(message, "result") and isinstance(message, ResultMessage):
            result_message = message
        elif type(message).__name__ == "AssistantMessage":
            content = getattr(message, "content", []) or []
            for block in content:
                text = getattr(block, "text", None)
                if text:
                    assistant_text_parts.append(str(text))
    if result_message is None:
        raise RuntimeError("SDK query ended without a ResultMessage")
    deferred = getattr(result_message, "deferred_tool_use", None)
    return {
        "message_types": message_types,
        "session_id": str(getattr(result_message, "session_id", "") or ""),
        "result": str(getattr(result_message, "result", "") or ""),
        "assistant_text": "".join(assistant_text_parts),
        "is_error": bool(getattr(result_message, "is_error", False)),
        "subtype": str(getattr(result_message, "subtype", "") or ""),
        "total_cost_usd": getattr(result_message, "total_cost_usd", None),
        "duration_ms": getattr(result_message, "duration_ms", None),
        "wall_seconds": round(time.monotonic() - started, 3),
        "deferred_tool_use": (
            {
                "id": str(getattr(deferred, "id", "") or ""),
                "name": str(getattr(deferred, "name", "") or ""),
                "has_input": bool(getattr(deferred, "input", None)),
            }
            if isinstance(deferred, DeferredToolUse)
            else None
        ),
        "hook_calls": hook_calls,
        "append_calls": list(store.append_calls),
        "load_calls": list(store.load_calls),
        "confirmed_persisted": store.confirmed_persisted(
            str(getattr(result_message, "session_id", "") or "")
        ),
    }


async def _safe_run_query(**kwargs: Any) -> dict[str, Any]:
    store = kwargs.get("store")
    try:
        result = await _run_query(**kwargs)
        result["ok"] = not bool(result.get("is_error"))
        return result
    except Exception as exc:  # noqa: BLE001 - spike must preserve observed SDK/RPC failures.
        return {
            "ok": False,
            "error_type": type(exc).__name__,
            "error_message": str(exc),
            "append_calls": list(getattr(store, "append_calls", []) or []),
            "load_calls": list(getattr(store, "load_calls", []) or []),
            "confirmed_persisted": False,
        }


async def _fresh_load(
    client: Any,
    *,
    user_id: str,
    fixture: dict[str, str],
    project_key: str,
    session_id: str,
) -> dict[str, Any]:
    fresh = SupabaseVcsoSessionStore(
        client,
        user_id=user_id,
        thread_id=fixture["thread_id"],
        turn_message_id=fixture["message_id"],
    )
    loaded = await fresh.load(
        {"project_key": project_key, "session_id": session_id, "subpath": ""}
    )
    return {
        "project_key": project_key,
        "session_id": session_id,
        "loaded_entry_count": len(loaded or []),
        "loaded": bool(loaded),
    }


def _first_project_key(spike_result: dict[str, Any]) -> str:
    append_calls = spike_result.get("append_calls") or []
    if append_calls:
        return str(append_calls[0].get("project_key") or "") or PROJECT_KEY_FALLBACK
    load_calls = spike_result.get("load_calls") or []
    if load_calls:
        return str(load_calls[0].get("project_key") or "") or PROJECT_KEY_FALLBACK
    return PROJECT_KEY_FALLBACK


async def run(user_id: str) -> dict[str, Any]:
    load_dotenv(ENV_PATH, override=True)
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase service credentials are required")
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is required")
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    model = settings.claude_synthesis_model
    report: dict[str, Any] = {
        "user_id": user_id,
        "model": model,
        "sdk_store": "SupabaseVcsoSessionStore",
        "flags_armed": False,
        "spikes": [],
    }

    for deep_mode in (False, True):
        for flush_mode in ("eager", "batched"):
            label = f"defer-{'legacy-deep' if deep_mode else 'production'}-{flush_mode}"
            fixture = _fixture(client, user_id=user_id, label=label, deep_mode=deep_mode)
            store = _store(client, user_id=user_id, fixture=fixture, label=label)
            result = await _safe_run_query(
                prompt=(
                    "Call ask_user now. Ask exactly: Which strategic priority should I use "
                    "for the next 90 days?"
                ),
                system_prompt=(
                    "You are a local ArchitectOS Phase E session-store spike. "
                    "You must call the ask_user tool immediately and then stop."
                ),
                model=model,
                api_key=str(settings.anthropic_api_key),
                store=store,
                session_store_flush=flush_mode,
                ask_user_defer=True,
                max_budget_usd=0.05,
            )
            project_key = _first_project_key(result)
            reload_result = (
                await _fresh_load(
                    client,
                    user_id=user_id,
                    fixture=fixture,
                    project_key=project_key,
                    session_id=result["session_id"],
                )
                if result.get("session_id")
                else {"loaded": False, "loaded_entry_count": 0}
            )
            report["spikes"].append(
                {
                    "label": label.replace("-", "_"),
                    "fixture": fixture,
                    "result": result,
                    "fresh_load": reload_result,
                }
            )

    complete_fixture = _fixture(client, user_id=user_id, label="legacy-deep-complete", deep_mode=True)
    complete_store = _store(client, user_id=user_id, fixture=complete_fixture, label="complete")
    sentinel = f"AOS_REAL_STORE_RESUME_{uuid.uuid4().hex[:8]}"
    complete = await _safe_run_query(
        prompt=f"Remember this exact sentinel for the next turn: {sentinel}. Reply with only OK.",
        system_prompt="You are a local ArchitectOS Phase E completed-session spike.",
        model=model,
        api_key=str(settings.anthropic_api_key),
        store=complete_store,
        session_store_flush="eager",
        max_budget_usd=0.12,
    )
    project_key = _first_project_key(complete)
    complete_load = await _fresh_load(
        client,
        user_id=user_id,
        fixture=complete_fixture,
        project_key=project_key,
        session_id=complete.get("session_id") or "",
    ) if complete.get("session_id") else {"loaded": False, "loaded_entry_count": 0}
    resume_fixture = _fixture(client, user_id=user_id, label="legacy-deep-resume", deep_mode=True)
    resume_store = _store(client, user_id=user_id, fixture=resume_fixture, label="resume")
    resume = await _safe_run_query(
        prompt="What exact sentinel did I ask you to remember? Reply with only the sentinel.",
        system_prompt="You are a local ArchitectOS Phase E resume spike.",
        model=model,
        api_key=str(settings.anthropic_api_key),
        store=resume_store,
        session_store_flush="eager",
        resume=complete.get("session_id") if complete.get("session_id") else None,
        max_budget_usd=0.12,
    )
    resume_project_key = _first_project_key(resume) or project_key
    resume_load = await _fresh_load(
        client,
        user_id=user_id,
        fixture=resume_fixture,
        project_key=resume_project_key,
        session_id=resume.get("session_id") or "",
    ) if resume.get("session_id") else {"loaded": False, "loaded_entry_count": 0}
    fork_fixture = _fixture(client, user_id=user_id, label="legacy-deep-fork", deep_mode=True)
    fork_store = _store(client, user_id=user_id, fixture=fork_fixture, label="fork")
    fork = await _safe_run_query(
        prompt="Fork check: what exact sentinel is in this conversation history?",
        system_prompt="You are a local ArchitectOS Phase E fork spike.",
        model=model,
        api_key=str(settings.anthropic_api_key),
        store=fork_store,
        session_store_flush="eager",
        resume=complete.get("session_id") if complete.get("session_id") else None,
        fork_session=bool(complete.get("session_id")),
        max_budget_usd=0.12,
    )
    fork_project_key = _first_project_key(fork) or project_key
    fork_load = await _fresh_load(
        client,
        user_id=user_id,
        fixture=fork_fixture,
        project_key=fork_project_key,
        session_id=fork.get("session_id") or "",
    ) if fork.get("session_id") else {"loaded": False, "loaded_entry_count": 0}
    report["spikes"].append(
        {
            "label": "complete_resume_fork",
            "sentinel": sentinel,
            "complete": {
                "fixture": complete_fixture,
                "result": complete,
                "fresh_load": complete_load,
            },
            "resume": {
                "fixture": resume_fixture,
                "result": resume,
                "fresh_load": resume_load,
                "sentinel_recalled": sentinel in (resume.get("result") or "")
                or sentinel in (resume.get("assistant_text") or ""),
            },
            "fork": {
                "fixture": fork_fixture,
                "result": fork,
                "fresh_load": fork_load,
                "new_session_id": bool(fork.get("session_id"))
                and fork.get("session_id") != complete.get("session_id"),
                "sentinel_recalled": sentinel in (fork.get("result") or "")
                or sentinel in (fork.get("assistant_text") or ""),
            },
        }
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", required=True)
    args = parser.parse_args()
    print(json.dumps(asyncio.run(run(args.user_id)), indent=2, default=str))


if __name__ == "__main__":
    main()
