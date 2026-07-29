"""Local-only probe for execute_code outside sandbox_execution_agent.

Uses the production registry and sandbox service directly, with a synthetic
thread id. Captures the full exception chain instead of the SDK wrapper's
``sdk_tool_failure`` code. If a session is created, the exact thread session
is closed in ``finally``.
"""

from __future__ import annotations

import json
import sys
import traceback
import uuid
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).parents[1]))
load_dotenv(Path(__file__).parents[1] / ".env")

from services.sandbox_service import SandboxService  # noqa: E402
from services.tool_registry import ToolExecutionContext, ToolRegistry  # noqa: E402


def _exception_chain(exc: BaseException) -> list[dict[str, str]]:
    chain: list[dict[str, str]] = []
    current: BaseException | None = exc
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        chain.append(
            {
                "type": type(current).__name__,
                "message": str(current),
                "repr": repr(current),
            }
        )
        current = current.__cause__ or current.__context__
    return chain


def main() -> None:
    thread_id = f"local-native-execute-probe-{uuid.uuid4()}"
    service: SandboxService | None = None
    report: dict[str, Any] = {
        "thread_id": thread_id,
        "context": "direct ToolRegistry call; no sandbox_execution_agent run",
        "code": "print(2 + 2)",
    }

    try:
        try:
            service = SandboxService.from_env()
            report["sandbox_service"] = type(service).__name__
        except Exception as exc:  # noqa: BLE001 - production helper also degrades this to None
            report["sandbox_service"] = None
            report["sandbox_service_initialization_exception"] = _exception_chain(exc)

        registry = ToolRegistry()
        context = ToolExecutionContext(
            user_id="00000000-0000-0000-0000-000000000000",
            sandbox_service=service,
            thread_id=thread_id,
            timeout_seconds=30,
            metadata={
                "enforce_persistence_guardrail": True,
                "confirmed_tool_names": ["execute_code"],
            },
        )
        envelope = registry.execute(
            "execute_code",
            context,
            {"code": "print(2 + 2)", "description": "Local native lead dependency probe"},
        )
        report["status"] = "completed"
        report["result"] = envelope.to_dict()
    except Exception as exc:  # noqa: BLE001 - raw diagnostic is the purpose
        report["status"] = "failed"
        report["exception_chain"] = _exception_chain(exc)
        report["traceback"] = traceback.format_exc()
    finally:
        if service is not None:
            try:
                service.close_session(thread_id, status="closed")
                report["cleanup"] = "close_session completed for the synthetic thread id"
            except Exception as exc:  # noqa: BLE001 - preserve cleanup evidence
                report["cleanup"] = {
                    "status": "failed",
                    "exception_chain": _exception_chain(exc),
                }

    print(json.dumps(report, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
