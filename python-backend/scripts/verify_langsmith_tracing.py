"""
Task 0.3 verification script — MA-01 Gate 1 preflight.

Run from the python-backend/ directory (so load_dotenv() finds python-backend/.env):

    python scripts/verify_langsmith_tracing.py

Makes exactly one Anthropic call and one OpenAI call through the same
wrap_anthropic/wrap_openai instrumentation now used in production
(services/vector_store.py, services/vcso_chat_service.py, etc.), so a
successful run here is real evidence the observability spine works for
every service — not just for this script.

What to check afterward:
  1. This script exits 0 and prints "Anthropic call OK" and "OpenAI call OK".
  2. Open https://smith.langchain.com , project "ArchitectOS-pro", and confirm
     two new runs appear with timestamps matching this run.
  3. Open each run and confirm the payload does NOT contain your API keys or
     any auth/header material — only the model name, the one-line test
     prompt, and the response. The prompt/response text legitimately showing
     up is the trace doing its job, not a leak — the thing to check for is
     credential material specifically.

If either call fails, the printed error is the diagnostic:
  - 401 / authentication error -> the key in python-backend/.env is wrong or expired.
  - a connection/timeout error -> outbound network egress is blocked.
  - the model call prints OK but no run shows up in LangSmith -> LANGSMITH_API_KEY /
    LANGSMITH_PROJECT / LANGSMITH_TRACING are missing or wrong, not the model call itself.
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

load_dotenv()

from anthropic import Anthropic
from langsmith.wrappers import wrap_anthropic, wrap_openai
from openai import OpenAI

SENTINEL = "MA01_GATE1_LANGSMITH_PREFLIGHT_CHECK"
REQUIRED_ENV = ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "LANGSMITH_API_KEY", "LANGSMITH_PROJECT")


def _check_env() -> None:
    missing = [name for name in REQUIRED_ENV if not os.environ.get(name)]
    if missing:
        print(f"FAIL: missing from process environment after load_dotenv(): {missing}")
        print("Check python-backend/.env has these keys, and that you're running this from")
        print("inside the python-backend/ directory (load_dotenv() searches from cwd upward).")
        sys.exit(1)
    if os.environ.get("LANGSMITH_TRACING", "").lower() not in ("true", "1"):
        print("WARN: LANGSMITH_TRACING is not 'true' — traces will not be sent even if the")
        print("      model calls below succeed.")
    print(f"Env OK. LANGSMITH_PROJECT={os.environ['LANGSMITH_PROJECT']!r}")


def _run_anthropic() -> None:
    client = wrap_anthropic(Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"]))
    resp = client.messages.create(
        model=os.environ.get("ARCHITECTOS_CLAUDE_SYNTHESIS_MODEL", "claude-sonnet-4-6"),
        max_tokens=20,
        messages=[{"role": "user", "content": f"Reply with exactly: {SENTINEL}"}],
    )
    text = resp.content[0].text if resp.content else ""
    print(f"Anthropic call OK — response: {text!r}")


def _run_openai() -> None:
    client = wrap_openai(OpenAI(api_key=os.environ["OPENAI_API_KEY"]))
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=20,
        messages=[{"role": "user", "content": f"Reply with exactly: {SENTINEL}"}],
    )
    text = resp.choices[0].message.content if resp.choices else ""
    print(f"OpenAI call OK — response: {text!r}")


if __name__ == "__main__":
    _check_env()
    _run_anthropic()
    _run_openai()
    print()
    print("Both calls completed. Now check https://smith.langchain.com , project")
    print(f"{os.environ.get('LANGSMITH_PROJECT')!r}, for two new runs and paste back what you see.")
