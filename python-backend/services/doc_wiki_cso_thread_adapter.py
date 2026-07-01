"""Document Wiki - Virtual CSO thread source adapter."""

from __future__ import annotations

import uuid
from typing import Any

from supabase import Client as SupabaseClient

from .doc_wiki_synthesis import DocWikiSynthesisService, SourcePayload, SynthesisResult


_MIN_MESSAGE_COUNT = 4
_MIN_ASSISTANT_CONTENT_LEN = 200
_TRUNCATION_TOTAL_MESSAGES = 30
_TRUNCATION_KEEP_FIRST = 20
_TRUNCATION_KEEP_LAST = 5


class DocWikiCSOThreadAdapter:
    """Synthesizes Virtual CSO threads into thread_synthesis wiki pages."""

    def __init__(self, supabase: SupabaseClient, service: DocWikiSynthesisService) -> None:
        self._sb = supabase
        self._service = service

    async def synthesize_from_thread(self, thread_id: str, user_id: str) -> SynthesisResult | None:
        """
        Synthesize one thread into a thread_synthesis page.

        Returns SynthesisResult on success, None if skipped.
        Sets synthesis_status='completed' or 'skipped' on vcso_chat_threads.
        """
        thread = self._load_thread(thread_id, user_id)
        messages = self._load_messages(thread_id, user_id)
        if not self._is_thread_worthy(thread, messages):
            self._set_synthesis_status(thread_id, "skipped")
            return None

        title = str(thread.get("title") or "New conversation")
        directive = (
            "Synthesize this Virtual CSO conversation into a knowledge page capturing key insights, "
            "decisions, strategic frameworks, and implications for the founder."
        )
        if title == "New conversation":
            directive += " Generate a meaningful page title from the conversation content."

        payload = SourcePayload(
            user_id=user_id,
            source_kind="cso_thread",
            source_id=thread_id,
            source_title=title,
            full_text=self._assemble_thread_body(thread, messages),
            chunk_refs=[],
            metadata={
                "source_tables": ["vcso_chat_threads", "vcso_chat_messages"],
                "thread_id": thread_id,
                "origin_thread_id": thread_id,
                "observed_date": thread.get("last_message_at") or thread.get("created_at"),
                "forced_page_kind": "thread_synthesis",
                "forced_canonical_key": self._thread_canonical_key(thread_id),
                "synthesis_directive": directive,
            },
            synthesis_job_id=str(uuid.uuid4()),
        )

        try:
            result = self._service.synthesize(payload)
        except Exception:
            raise
        self._set_synthesis_status(thread_id, "completed")
        return result

    async def synthesize_pending_threads(self, user_id: str, limit: int = 10) -> list[SynthesisResult | None]:
        """Synthesize all pending threads for a user, up to limit."""
        threads = (
            self._sb.table("vcso_chat_threads")
            .select("id")
            .eq("user_id", user_id)
            .eq("synthesis_status", "pending")
            .limit(limit)
            .execute()
        )
        results = []
        for thread in threads.data or []:
            result = await self.synthesize_from_thread(thread["id"], user_id)
            results.append(result)
        return results

    def _load_thread(self, thread_id: str, user_id: str) -> dict[str, Any]:
        result = (
            self._sb.table("vcso_chat_threads")
            .select("*")
            .eq("id", thread_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            raise ValueError("CSO thread not found.")
        return result.data

    def _load_messages(self, thread_id: str, user_id: str) -> list[dict[str, Any]]:
        result = (
            self._sb.table("vcso_chat_messages")
            .select("*")
            .eq("thread_id", thread_id)
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
        return result.data or []

    def _is_thread_worthy(self, thread: dict, messages: list[dict]) -> bool:
        """Return True if thread meets synthesis worthiness threshold."""
        if thread.get("message_count", 0) < _MIN_MESSAGE_COUNT:
            return False
        assistant_msgs = [m for m in messages if m.get("role") == "assistant"]
        return any(
            len(m.get("content", "")) >= _MIN_ASSISTANT_CONTENT_LEN
            for m in assistant_msgs
        )

    def _assemble_thread_body(self, thread: dict, messages: list[dict]) -> str:
        return "\n\n".join(
            [
                f"## Thread: {thread.get('title') or 'New conversation'}",
                f"Created: {thread.get('created_at') or ''} | Messages: {thread.get('message_count') or len(messages)}",
                "",
                self._build_transcript(messages),
            ]
        )

    def _build_transcript(self, messages: list[dict]) -> str:
        """Assemble message transcript with truncation if needed."""
        if len(messages) > _TRUNCATION_TOTAL_MESSAGES:
            kept = messages[:_TRUNCATION_KEEP_FIRST] + messages[-_TRUNCATION_KEEP_LAST:]
            omitted = len(messages) - len(kept)
            messages = (
                messages[:_TRUNCATION_KEEP_FIRST]
                + [{"role": "system", "content": f"[{omitted} messages omitted]"}]
                + messages[-_TRUNCATION_KEEP_LAST:]
            )
        lines = []
        for m in messages:
            role_label = m.get("role", "unknown").upper()
            lines.append(f"**{role_label}:** {m.get('content', '')}")
        return "\n\n".join(lines)

    def _set_synthesis_status(self, thread_id: str, status: str) -> None:
        self._sb.table("vcso_chat_threads").update({"synthesis_status": status}).eq("id", thread_id).execute()

    def _thread_canonical_key(self, thread_id: str) -> str:
        return f"thread_{thread_id[:8]}"
