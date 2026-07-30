"""Submit one authenticated VCSO turn and drain its SSE stream to completion.

This is a read-only operator client for the chat endpoint. It never reads or writes
``platform_ai_settings`` and exposes no free-text prompt argument. Founder credentials and bearer
tokens remain process-local and are never included in output.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, BinaryIO, Callable

from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, str(Path(__file__).parents[1]))

from services.vcso_canary_anchor import PINNED_ANCHOR_PROMPT


ENV_PATH = Path(__file__).parents[1] / ".env"
FOUNDER_EMAIL_ENV = "VCSO_FOUNDER_EMAIL"
FOUNDER_PASSWORD_ENV = "VCSO_FOUNDER_PASSWORD"
SUPABASE_URL_ENV = "SUPABASE_URL"
SUPABASE_KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY"
BACKEND_URL_ENV = "ARCHITECTOS_PYTHON_BACKEND_URL"
READ_TIMEOUT_SECONDS = 600
SMOKE_PROMPT = "Reply with one short sentence confirming this message was received."


class HarnessFailure(RuntimeError):
    def __init__(self, stage: str, public_message: str) -> None:
        super().__init__(public_message)
        self.stage = stage
        self.public_message = public_message


@dataclass
class StreamObservation:
    event_sequence: list[str] = field(default_factory=list)
    done_received: bool = False
    thread_id: str | None = None
    user_message_id: str | None = None
    assistant_message_id: str | None = None
    answer_text: str = ""
    answer_tokens: int | None = None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt-mode", choices=("anchor", "smoke"), required=True)
    return parser


def prompt_for_mode(prompt_mode: str) -> str:
    if prompt_mode == "anchor":
        return PINNED_ANCHOR_PROMPT
    if prompt_mode == "smoke":
        return SMOKE_PROMPT
    raise HarnessFailure("prompt", "Unsupported prompt mode.")


def _required_env(name: str) -> str:
    value = str(os.getenv(name) or "").strip()
    if not value:
        raise HarnessFailure("configuration", f"Required environment variable {name} is absent.")
    return value


def _normalize_backend_url(value: str) -> str:
    normalized = value.strip().rstrip("/")
    if not normalized.startswith(("http://", "https://")):
        normalized = f"https://{normalized}"
    return normalized


def authenticate_founder() -> tuple[Any, str, str]:
    """Return the authenticated client, bearer token, and founder id without logging any credential."""

    load_dotenv(ENV_PATH, override=True)
    supabase_url = _required_env(SUPABASE_URL_ENV)
    supabase_key = _required_env(SUPABASE_KEY_ENV)
    founder_email = _required_env(FOUNDER_EMAIL_ENV)
    founder_password = _required_env(FOUNDER_PASSWORD_ENV)
    client = create_client(supabase_url, supabase_key)
    try:
        auth = client.auth.sign_in_with_password(
            {"email": founder_email, "password": founder_password}
        )
    except Exception as exc:
        raise HarnessFailure("authentication", "Founder authentication failed.") from exc
    session = getattr(auth, "session", None)
    user = getattr(auth, "user", None)
    token = str(getattr(session, "access_token", "") or "")
    user_id = str(getattr(user, "id", "") or "")
    if not token or not user_id:
        raise HarnessFailure("authentication", "Founder authentication returned no usable session.")
    return client, token, user_id


def _dispatch_sse_event(
    event_name: str,
    data_lines: list[str],
    observation: StreamObservation,
) -> None:
    if not data_lines:
        return
    try:
        payload = json.loads("\n".join(data_lines))
    except json.JSONDecodeError as exc:
        raise HarnessFailure("stream", "The SSE stream contained invalid JSON.") from exc
    observation.event_sequence.append(event_name)
    if event_name == "error":
        raise HarnessFailure("stream", "The VCSO stream emitted an error event.")
    if event_name == "ready":
        observation.thread_id = str(payload.get("threadId") or "") or None
        user_message = payload.get("userMessage") if isinstance(payload.get("userMessage"), dict) else {}
        observation.user_message_id = str(user_message.get("id") or "") or None
    elif event_name == "token":
        observation.answer_text += str(payload.get("text") or "")
    elif event_name == "done":
        observation.done_received = True
        chat = payload.get("chat") if isinstance(payload.get("chat"), dict) else {}
        assistant = (
            payload.get("assistantMessage")
            if isinstance(payload.get("assistantMessage"), dict)
            else {}
        )
        usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}
        observation.thread_id = observation.thread_id or str(chat.get("id") or "") or None
        observation.assistant_message_id = str(assistant.get("id") or "") or None
        persisted_answer = str(assistant.get("content") or "")
        if persisted_answer:
            observation.answer_text = persisted_answer
        raw_tokens = usage.get("outputTokens")
        observation.answer_tokens = int(raw_tokens) if raw_tokens is not None else None


def consume_sse_stream(response: BinaryIO) -> StreamObservation:
    observation = StreamObservation()
    event_name = "message"
    data_lines: list[str] = []
    try:
        for raw_line in response:
            line = raw_line.decode("utf-8").rstrip("\r\n")
            if not line:
                _dispatch_sse_event(event_name, data_lines, observation)
                event_name = "message"
                data_lines = []
                continue
            if line.startswith(":"):
                continue
            if line.startswith("event:"):
                event_name = line[6:].strip() or "message"
            elif line.startswith("data:"):
                data_lines.append(line[5:].lstrip())
        _dispatch_sse_event(event_name, data_lines, observation)
    except HarnessFailure:
        raise
    except Exception as exc:
        raise HarnessFailure("stream", "The SSE stream aborted before completion.") from exc
    if not observation.done_received:
        raise HarnessFailure("stream", "The SSE stream ended without a terminal done event.")
    if not observation.thread_id or not observation.user_message_id:
        raise HarnessFailure("stream", "The SSE stream did not identify the submitted turn.")
    return observation


def submit_turn(
    *,
    token: str,
    prompt: str,
    backend_url: str,
    opener: Callable[..., Any] = urllib.request.urlopen,
) -> StreamObservation:
    body = json.dumps(
        {
            "threadId": None,
            "text": prompt,
            "linkedFolder": None,
            "projectId": None,
            "forkSessionId": None,
        },
        separators=(",", ":"),
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{_normalize_backend_url(backend_url)}/api/vcso/chat",
        data=body,
        headers={
            "Accept": "text/event-stream",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": "ArchitectOS-04B-Turn-Harness/1.0",
        },
        method="POST",
    )
    try:
        with opener(request, timeout=READ_TIMEOUT_SECONDS) as response:
            status = int(getattr(response, "status", 0) or response.getcode())
            if status != 200:
                raise HarnessFailure("request", f"VCSO endpoint returned HTTP {status}.")
            return consume_sse_stream(response)
    except HarnessFailure:
        raise
    except urllib.error.HTTPError as exc:
        raise HarnessFailure("request", f"VCSO endpoint returned HTTP {exc.code}.") from exc
    except Exception as exc:
        raise HarnessFailure("request", "The VCSO request failed before stream completion.") from exc


def lookup_parent_run_id(
    client: Any,
    *,
    user_id: str,
    thread_id: str,
    user_message_id: str,
) -> str:
    try:
        response = (
            client.table("agent_delegation_runs")
            .select("id,parent_run_id,parent_thread_id,parent_message_id,status,created_at")
            .eq("user_id", user_id)
            .eq("parent_thread_id", thread_id)
            .eq("parent_message_id", user_message_id)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
    except Exception as exc:
        raise HarnessFailure("run_lookup", "Parent run lookup failed.") from exc
    parents = [
        row
        for row in (getattr(response, "data", None) or [])
        if isinstance(row, dict) and not row.get("parent_run_id")
    ]
    if len(parents) != 1 or not parents[0].get("id"):
        raise HarnessFailure("run_lookup", "The submitted turn did not resolve to exactly one parent run.")
    return str(parents[0]["id"])


def run_harness(prompt_mode: str) -> dict[str, Any]:
    prompt = prompt_for_mode(prompt_mode)
    client, token, user_id = authenticate_founder()
    backend_url = _required_env(BACKEND_URL_ENV)
    started = time.monotonic()
    observation = submit_turn(token=token, prompt=prompt, backend_url=backend_url)
    wall_clock_seconds = round(time.monotonic() - started, 3)
    run_id = lookup_parent_run_id(
        client,
        user_id=user_id,
        thread_id=str(observation.thread_id),
        user_message_id=str(observation.user_message_id),
    )
    return {
        "ok": True,
        "prompt_mode": prompt_mode,
        "run_id": run_id,
        "run_id_mechanism": "agent_delegation_runs lookup by parent_thread_id + parent_message_id",
        "thread_id": observation.thread_id,
        "user_message_id": observation.user_message_id,
        "assistant_message_id": observation.assistant_message_id,
        "event_sequence": observation.event_sequence,
        "done_received": observation.done_received,
        "wall_clock_seconds": wall_clock_seconds,
        "answer_bytes": len(observation.answer_text.encode("utf-8")),
        "answer_tokens": observation.answer_tokens,
    }


def main() -> None:
    args = build_parser().parse_args()
    try:
        summary = run_harness(args.prompt_mode)
    except HarnessFailure as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "failure_stage": exc.stage,
                    "message": exc.public_message,
                },
                indent=2,
                sort_keys=True,
            )
        )
        raise SystemExit(1)
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
