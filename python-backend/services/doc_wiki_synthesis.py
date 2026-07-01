"""Layer 2 Document Wiki synthesis engine."""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import anthropic

from core.config import get_settings
from core.doc_wiki_config import doc_wiki_config
from services.vector_store import VectorStore


@dataclass(frozen=True)
class ChunkRef:
    chunk_id: str
    content: str
    score: float = 0.0


@dataclass(frozen=True)
class SourcePayload:
    user_id: str
    source_kind: str
    source_id: str
    source_title: str
    full_text: str
    chunk_refs: list[ChunkRef]
    metadata: dict[str, Any]
    synthesis_job_id: str


@dataclass
class SynthesisResult:
    user_id: str
    synthesis_job_id: str
    page_ids: list[str] = field(default_factory=list)
    pages_created: int = 0
    pages_updated: int = 0
    pages_skipped: int = 0
    log_event_ids: list[str] = field(default_factory=list)
    contradictions_flagged: int = 0


class DocWikiSynthesisError(RuntimeError):
    pass


class EmbeddingNotImplementedError(NotImplementedError):
    """Raised by the embedding stub - 05 implements this."""


class DocWikiSynthesisService:
    """
    Source-agnostic wiki page synthesis engine.
    The synthesis engine is the sole writer of ose_knowledge_pages.content.
    """

    def __init__(self, store: VectorStore, anthropic_client: anthropic.Anthropic) -> None:
        self._store = store
        self._anthropic = anthropic_client
        self._config = doc_wiki_config()
        self._settings = get_settings()
        self._last_write_created: bool = False

    @classmethod
    def from_env(cls) -> "DocWikiSynthesisService":
        settings = get_settings()
        return cls(
            store=VectorStore.from_env(),
            anthropic_client=anthropic.Anthropic(api_key=settings.anthropic_api_key or ""),
        )

    def synthesize(self, source_payload: SourcePayload) -> SynthesisResult:
        """
        Synthesize 1-N pages from a normalized SourcePayload.
        Implements the loop in 03-RESEARCH.md section 1.
        """
        result = SynthesisResult(
            user_id=source_payload.user_id,
            synthesis_job_id=source_payload.synthesis_job_id,
        )

        if not _is_source_worthy(source_payload):
            result.pages_skipped += 1
            self._write_log(
                source_payload.user_id,
                "decision",
                f"[SYNTHESIS_SKIPPED] Source not page-worthy | job:{source_payload.synthesis_job_id}",
                result,
            )
            return result

        synthesis_outputs = self._call_synthesis_claude(source_payload, result)

        for output in synthesis_outputs:
            if output.get("page_worthiness") == "skip":
                result.pages_skipped += 1
                self._write_log(
                    source_payload.user_id,
                    "decision",
                    f"[SYNTHESIS_SKIPPED] {output.get('page_title','unknown')} | job:{source_payload.synthesis_job_id}",
                    result,
                )
                continue

            try:
                page_id = self._upsert_page(source_payload, output, result)
                result.page_ids.append(page_id)
                if self._was_created(source_payload.user_id, output["canonical_key"]):
                    result.pages_created += 1
                else:
                    result.pages_updated += 1

                self._maintain_manifest(source_payload, page_id)
                self._write_page_links(source_payload.user_id, page_id, output.get("suggested_links", []))
                contradictions = self._flag_contradictions(source_payload.user_id, page_id, output)
                result.contradictions_flagged += contradictions

                # _embed_page handles its own exceptions internally.
                self._embed_page(page_id, output.get("content", ""))

                self._write_log(
                    source_payload.user_id,
                    "activity",
                    f"[SYNTHESIS_COMPLETE] {output.get('page_title','?')} | job:{source_payload.synthesis_job_id}",
                    result,
                )

            except Exception as exc:
                self._write_log(
                    source_payload.user_id,
                    "activity",
                    f"[SYNTHESIS_ERROR] {output.get('page_title','?')} | {exc} | job:{source_payload.synthesis_job_id}",
                    result,
                )

        return result

    def _call_synthesis_claude(self, payload: SourcePayload, result: SynthesisResult | None = None) -> list[dict[str, Any]]:
        """
        Call Claude Sonnet to discover topics and synthesize page content.
        Returns a list of page output dicts (one per entity/topic).
        """
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(payload)
        try:
            response = self._anthropic.messages.create(
                model=self._settings.claude_synthesis_model,
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
        except Exception as exc:
            if result:
                self._write_log(
                    payload.user_id,
                    "activity",
                    f"[SYNTHESIS_ERROR] Claude request failed | {exc} | job:{payload.synthesis_job_id}",
                    result,
                )
            return []

        text = _response_text(response)
        try:
            parsed = json.loads(_strip_json_fence(text))
        except json.JSONDecodeError as exc:
            if result:
                self._write_log(
                    payload.user_id,
                    "activity",
                    f"[SYNTHESIS_ERROR] Claude JSON parse failed | {exc} | job:{payload.synthesis_job_id}",
                    result,
                )
            return []

        outputs = parsed if isinstance(parsed, list) else [parsed]
        return [self._normalize_output(payload, item, result) for item in outputs if isinstance(item, dict)]

    def _upsert_page(self, payload: SourcePayload, output: dict[str, Any], result: SynthesisResult | None = None) -> str:
        """
        Create or update ose_knowledge_pages row (service-role).
        Returns page_id.
        Checks for pending corrections before re-synthesis and applies the overlay hook.
        """
        canonical_key = output["canonical_key"]
        existing = self._find_page(payload.user_id, canonical_key)
        now = _now()
        source_file_ids = (existing.get("source_file_ids") if existing else []) or []
        if payload.source_kind == "document":
            source_file_ids = _merge_uuid_lists(source_file_ids, [payload.source_id])
        content = str(output.get("content") or "")
        correction_rows: list[dict[str, Any]] = []
        if existing:
            correction_rows = self._pending_corrections(str(existing["id"]), payload.user_id)
            if correction_rows:
                content = _apply_corrections_overlay(content, correction_rows)

        page_kind = str(output.get("page_kind") or "entity")
        values: dict[str, Any] = {
            "user_id": payload.user_id,
            "page_type": self._page_type(page_kind),
            "page_kind": page_kind,
            "page_title": str(output.get("page_title") or "Untitled Wiki Page"),
            "content": content,
            "category": self._category(page_kind),
            "domain": output.get("domain"),
            "source_file_ids": source_file_ids,
            "canonical_key": canonical_key,
            "confidence": _clamp_float(output.get("confidence"), 0.0, 1.0, default=0.5),
            "word_count": len(content.split()),
            "status": "active",
            "effective_date": _date_or_none(output.get("effective_date") or payload.metadata.get("effective_date")),
            "observed_date": _date_or_none(payload.metadata.get("observed_date") or payload.metadata.get("ingested_at")),
            "review_date": _date_or_none(payload.metadata.get("review_date")),
            "origin_thread_id": payload.metadata.get("origin_thread_id"),
            "synthesis_job_id": payload.synthesis_job_id,
            "last_updated": now,
            "updated_at": now,
        }

        try:
            if existing:
                page_id = str(existing["id"])
                (
                    self._store.client.table("ose_knowledge_pages")
                    .update(values)
                    .eq("id", page_id)
                    .eq("user_id", payload.user_id)
                    .execute()
                )
                self._last_write_created = False
            else:
                values["promotion_state"] = "default"
                inserted = self._store.client.table("ose_knowledge_pages").insert(values).execute().data or []
                page_id = str(inserted[0]["id"]) if inserted else self._find_page(payload.user_id, canonical_key)["id"]
                self._last_write_created = True
        except Exception as exc:
            raise DocWikiSynthesisError(f"Doc Wiki page write failed: {exc}") from exc

        if correction_rows:
            self._mark_corrections_applied(correction_rows)
            if result:
                self._write_log(
                    payload.user_id,
                    "decision",
                    f"[CORRECTIONS_APPLIED] page:{page_id} count:{len(correction_rows)} | job:{payload.synthesis_job_id}",
                    result,
                )

        return page_id

    def _maintain_manifest(self, payload: SourcePayload, page_id: str) -> None:
        """Update source_file_ids on the page AND connected_pages on the registry row."""
        if payload.source_kind != "document":
            return
        try:
            document = self._store.get_document(payload.source_id, payload.user_id)
            connected_pages = _merge_uuid_lists(document.get("connected_pages"), [page_id])
            (
                self._store.client.table("ose_raw_document_registry")
                .update({"connected_pages": connected_pages})
                .eq("id", payload.source_id)
                .eq("user_id", payload.user_id)
                .execute()
            )
        except Exception as exc:
            raise DocWikiSynthesisError(f"Manifest update failed: {exc}") from exc

    def _write_page_links(self, user_id: str, page_id: str, suggested_keys: list[str]) -> None:
        """
        Upsert ose_page_links rows for each suggested canonical_key.
        Lookup page_id from canonical_key; skip if not found.
        """
        rows: list[dict[str, Any]] = []
        for key in _dedupe_strings(suggested_keys):
            if not key:
                continue
            target = self._find_page(user_id, key)
            if not target or str(target["id"]) == page_id:
                continue
            rows.append(
                {
                    "user_id": user_id,
                    "from_page_id": page_id,
                    "to_page_id": str(target["id"]),
                    "relation": "related",
                }
            )
        if not rows:
            return
        try:
            self._store.client.table("ose_page_links").upsert(
                rows,
                on_conflict="user_id,from_page_id,to_page_id",
            ).execute()
        except Exception:
            return

    def _flag_contradictions(self, user_id: str, page_id: str, output: dict[str, Any]) -> int:
        """Lightweight contradiction check. Returns count of contradictions flagged."""
        count = 0
        keys = _dedupe_strings(output.get("contradicts") or output.get("contradictory_canonical_keys") or [])
        mentioned = _dedupe_strings(output.get("topics_mentioned") or [])
        for key in keys + mentioned:
            existing = self._find_page(user_id, key)
            if not existing or str(existing["id"]) == page_id:
                continue
            confidence_gap = abs(
                _clamp_float(output.get("confidence"), 0.0, 1.0, default=0.5)
                - _clamp_float(existing.get("confidence"), 0.0, 1.0, default=0.5)
            )
            if key not in keys and confidence_gap < 0.35:
                continue
            text = (
                f"[CONTRADICTION_FLAGGED] page:{page_id} may contradict page:{existing['id']} "
                f"| job:{output.get('synthesis_job_id') or ''}"
            )
            try:
                self._store.client.table("ose_activity_log").insert(
                    {"user_id": user_id, "kind": "decision", "text": text, "icon": "alert-triangle"}
                ).execute()
                try:
                    self._store.client.table("ose_page_links").upsert(
                        {
                            "user_id": user_id,
                            "from_page_id": page_id,
                            "to_page_id": str(existing["id"]),
                            "relation": "contradicts",
                        },
                        on_conflict="user_id,from_page_id,to_page_id",
                    ).execute()
                except Exception:
                    pass
                count += 1
            except Exception:
                continue
        return count

    def _embed_page(self, page_id: str, content: str) -> None:
        """Embed the synthesized page content and store in ose_knowledge_pages.embedding.

        Uses VectorStore (text-embedding-3-small, vector(1536)) - same model as
        document_chunks. Skips silently on empty content. On embedding failure,
        logs and returns; the page record is already upserted so embedding
        failure never corrupts page data.
        """
        from .vector_store import VectorStore

        if not content or not content.strip():
            return

        words = content.split()
        if len(words) > 6000:
            content = " ".join(words[:6000])

        try:
            store = VectorStore.from_env()
            embedding: list[float] = store.embed_query(content)
            (
                self._store.client.table("ose_knowledge_pages")
                .update({"embedding": embedding})
                .eq("id", page_id)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001
            import logging

            logging.getLogger(__name__).warning(
                "doc_wiki: _embed_page failed for page_id=%s: %s", page_id, exc
            )

    def _write_log(self, user_id: str, kind: str, text: str, result: SynthesisResult) -> None:
        """Write an ose_activity_log row. Append id to result.log_event_ids."""
        try:
            response = (
                self._store.client.table("ose_activity_log")
                .insert({"user_id": user_id, "kind": kind, "text": text, "icon": _log_icon(kind, text)})
                .execute()
            )
        except Exception:
            return
        rows = response.data or []
        if rows and rows[0].get("id"):
            result.log_event_ids.append(str(rows[0]["id"]))

    def _was_created(self, user_id: str, canonical_key: str) -> bool:
        return self._last_write_created

    def _build_system_prompt(self) -> str:
        return (
            "You are the ArchitectOS Document Wiki synthesis engine for agency founders. "
            "Return only valid JSON, with no markdown fences or commentary. "
            "You may return one JSON object or an array of objects. "
            "Each object must use this schema: "
            '{"page_title": string, "page_kind": string, "canonical_key": string, "content": string, '
            '"confidence": number, "category": string, "domain": string|null, '
            '"effective_date": "YYYY-MM-DD"|null, "topics_mentioned": string[], '
            '"suggested_links": string[], "page_worthiness": "worthy"|"skip", '
            '"split_recommended": boolean, "contradictory_canonical_keys": string[]}. '
            f"Allowed page_kind values: {', '.join(self._config.get('page_kind_vocabulary', []))}. "
            "Use inline citations for factual statements. Citation format: "
            "[[Source: raw_document:{document_id}#chunk:{chunk_id}|{doc_title}]]. "
            "If no chunk supports a statement, omit the chunk segment. "
            "Do not invent facts. Lower confidence when evidence is thin, stale, or contradictory. "
            "Skip passing mentions; synthesize central or recurring entities only."
        )

    def _build_user_prompt(self, payload: SourcePayload) -> str:
        existing = self._existing_page_index(payload.user_id)
        pending = self._pending_correction_context(payload.user_id)
        evidence = "\n\n".join(
            f"Chunk {chunk.chunk_id} score={chunk.score}:\n{_truncate(chunk.content, 1800)}"
            for chunk in payload.chunk_refs[:8]
        )
        source_text = _truncate(payload.full_text, 60000)
        if len(payload.full_text) > 60000 and evidence:
            source_text = f"# Selected evidence excerpts\n{evidence}"

        directive = str(payload.metadata.get("synthesis_directive") or "").strip()
        directive_block = f"# Source-specific synthesis directive\n{directive}\n\n" if directive else ""
        return (
            f"# Source\nTitle: {payload.source_title}\n"
            f"Source kind: {payload.source_kind}\n"
            f"Document/source id: {payload.source_id}\n\n"
            f"# Source metadata\n{json.dumps(payload.metadata, default=str)[:6000]}\n\n"
            f"{directive_block}"
            f"# Source content\n{source_text}\n\n"
            f"# Citation refs available\n{evidence or 'No chunk refs available; cite the raw document id.'}\n\n"
            f"# Existing wiki context\n{existing or 'No existing pages.'}\n\n"
            f"# Pending founder corrections to preserve on matching updates\n{pending or 'None.'}\n\n"
            "# Instructions\n"
            "Discover the primary topic and any secondary topics that deserve their own pages. "
            "Apply the page-worthiness thresholds: primary subject is worthy; topic occupying about 15% "
            "or more is worthy; recurring topics across existing pages are worthy; one-off passing mentions are skip. "
            "Use stable lowercase snake_case canonical_key values. Prefer 1-3 high-value pages over many thin pages. "
            "Use source ids and chunk ids in citations exactly as provided."
        )

    def _normalize_output(
        self,
        payload: SourcePayload,
        output: dict[str, Any],
        result: SynthesisResult | None = None,
    ) -> dict[str, Any]:
        page_kind = str(output.get("page_kind") or "entity")
        forced_page_kind = payload.metadata.get("forced_page_kind")
        if forced_page_kind:
            page_kind = str(forced_page_kind)
        if page_kind not in set(self._config.get("page_kind_vocabulary", [])):
            if result:
                self._write_log(
                    payload.user_id,
                    "decision",
                    f"[SYNTHESIS_WARNING] Unknown page_kind {page_kind}; defaulted to entity | job:{payload.synthesis_job_id}",
                    result,
                )
            page_kind = "entity"
        forced_canonical_key = payload.metadata.get("forced_canonical_key")
        canonical_key = _canonical_key(forced_canonical_key or output.get("canonical_key") or output.get("page_title") or payload.source_title)
        output["page_kind"] = page_kind
        output["canonical_key"] = canonical_key
        output["synthesis_job_id"] = payload.synthesis_job_id
        if payload.metadata.get("forced_page_title"):
            output["page_title"] = str(payload.metadata["forced_page_title"])
        if not output.get("page_title"):
            output["page_title"] = canonical_key.replace("_", " ").title()
        if not output.get("content"):
            output["page_worthiness"] = "skip"
        if output.get("page_worthiness") not in {"worthy", "skip"}:
            output["page_worthiness"] = "worthy"
        return output

    def _find_page(self, user_id: str, canonical_key: str) -> dict[str, Any] | None:
        if not canonical_key:
            return None
        try:
            rows = (
                self._store.client.table("ose_knowledge_pages")
                .select("*")
                .eq("user_id", user_id)
                .eq("canonical_key", canonical_key)
                .limit(1)
                .execute()
                .data
                or []
            )
        except Exception:
            return None
        return rows[0] if rows else None

    def _pending_corrections(self, page_id: str, user_id: str) -> list[dict[str, Any]]:
        try:
            return (
                self._store.client.table("ose_page_corrections")
                .select("id,body")
                .eq("user_id", user_id)
                .eq("page_id", page_id)
                .eq("status", "pending")
                .execute()
                .data
                or []
            )
        except Exception:
            return []

    def _mark_corrections_applied(self, correction_rows: list[dict[str, Any]]) -> None:
        ids = [row["id"] for row in correction_rows if row.get("id")]
        if not ids:
            return
        try:
            self._store.client.table("ose_page_corrections").update({"status": "applied"}).in_("id", ids).execute()
        except Exception:
            return

    def _existing_page_index(self, user_id: str) -> str:
        try:
            rows = (
                self._store.client.table("ose_knowledge_pages")
                .select("id,page_title,page_kind,canonical_key,confidence,status")
                .eq("user_id", user_id)
                .neq("status", "deleted")
                .limit(50)
                .execute()
                .data
                or []
            )
        except Exception:
            return ""
        return "\n".join(
            f"- {row.get('page_title')} ({row.get('page_kind')}) key={row.get('canonical_key')} confidence={row.get('confidence')}"
            for row in rows
        )

    def _pending_correction_context(self, user_id: str) -> str:
        try:
            rows = (
                self._store.client.table("ose_page_corrections")
                .select("body,page_id,ose_knowledge_pages(page_title,canonical_key)")
                .eq("user_id", user_id)
                .eq("status", "pending")
                .limit(20)
                .execute()
                .data
                or []
            )
        except Exception:
            return ""
        lines = []
        for row in rows:
            page = row.get("ose_knowledge_pages") or {}
            lines.append(f"- {page.get('page_title')} key={page.get('canonical_key')}: {row.get('body')}")
        return "\n".join(lines)

    def _page_type(self, page_kind: str) -> str:
        return str(self._config.get("kind_to_page_type", {}).get(page_kind) or "custom")

    def _category(self, page_kind: str) -> str:
        return str(self._config.get("kind_to_category", {}).get(page_kind) or "founder_identity")


class DocWikiDocumentAdapter:
    """
    Reads a processed document from ose_raw_document_registry and normalizes
    it into a SourcePayload for DocWikiSynthesisService.
    """

    def __init__(self, store: VectorStore, synthesis_service: DocWikiSynthesisService) -> None:
        self._store = store
        self._synthesis = synthesis_service

    @classmethod
    def from_env(cls) -> "DocWikiDocumentAdapter":
        store = VectorStore.from_env()
        return cls(
            store=store,
            synthesis_service=DocWikiSynthesisService(
                store=store,
                anthropic_client=anthropic.Anthropic(api_key=get_settings().anthropic_api_key or ""),
            ),
        )

    def synthesize_from_document(
        self,
        document_id: str,
        user_id: str,
        file_name: str,
        synthesis_job_id: str | None = None,
    ) -> SynthesisResult:
        """
        1. Read full_markdown and metadata from ose_raw_document_registry.
        2. Read top chunks for citation evidence via match_document_chunks.
        3. Normalize into SourcePayload.
        4. Call synthesis_service.synthesize().
        """
        document = self._store.get_document(document_id, user_id)
        full_text = str(document.get("full_markdown") or "")
        if not full_text.strip():
            raise DocWikiSynthesisError("Document has no full_markdown to synthesize.")
        title = file_name or document.get("file_name") or document.get("name") or document_id
        metadata = {
            "file_name": title,
            "file_type": document.get("file_type"),
            "metadata": document.get("metadata") or {},
            "extracted_metadata": document.get("extracted_metadata") or {},
            "observed_date": document.get("ingested_at") or document.get("created_at"),
            "ingested_at": document.get("ingested_at"),
        }
        chunk_refs = self._read_chunk_refs(document_id, user_id, title, full_text)
        payload = SourcePayload(
            user_id=user_id,
            source_kind="document",
            source_id=document_id,
            source_title=str(title),
            full_text=full_text,
            chunk_refs=chunk_refs,
            metadata=metadata,
            synthesis_job_id=synthesis_job_id or str(uuid.uuid4()),
        )
        return self._synthesis.synthesize(payload)

    def _read_chunk_refs(self, document_id: str, user_id: str, title: str, full_text: str) -> list[ChunkRef]:
        try:
            rows = (
                self._store.client.table("document_chunks")
                .select("id,content,metadata,chunk_index")
                .eq("document_id", document_id)
                .eq("user_id", user_id)
                .order("chunk_index")
                .limit(8)
                .execute()
                .data
                or []
            )
        except Exception:
            rows = []

        refs = [
            ChunkRef(chunk_id=str(row["id"]), content=str(row.get("content") or ""), score=1.0)
            for row in rows
            if row.get("id") and row.get("content")
        ]
        if refs:
            return refs

        try:
            response = self._store.client.rpc(
                "match_document_chunks",
                {
                    "query_embedding": None,
                    "query_text": title,
                    "match_count": 8,
                    "target_user_id": user_id,
                    "metadata_filter": {"document_id": document_id},
                    "candidate_count": 40,
                    "rrf_k": 60,
                },
            ).execute()
            refs = [
                ChunkRef(
                    chunk_id=str(row["chunk_id"]),
                    content=str(row.get("content") or ""),
                    score=float(row.get("hybrid_score") or row.get("rrf_score") or 0),
                )
                for row in response.data or []
                if row.get("document_id") == document_id and row.get("chunk_id") and row.get("content")
            ]
            if refs:
                return refs
        except Exception:
            pass

        fallback = _truncate(full_text, 12000)
        return [ChunkRef(chunk_id="full_document", content=fallback, score=0.0)] if fallback else []


def _response_text(response: Any) -> str:
    parts = []
    for block in getattr(response, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "\n".join(parts)


def _strip_json_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?", "", stripped).strip()
        stripped = re.sub(r"```$", "", stripped).strip()
    return stripped


def _canonical_key(value: Any) -> str:
    text = str(value or "entity").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return re.sub(r"_+", "_", text).strip("_") or "entity"


def _is_source_worthy(payload: SourcePayload) -> bool:
    text = payload.full_text.strip()
    if len(text.split()) >= 80:
        return True
    return bool(payload.chunk_refs and any(len(chunk.content.split()) >= 60 for chunk in payload.chunk_refs))


def _apply_corrections_overlay(content: str, correction_rows: list[dict[str, Any]]) -> str:
    bodies = [str(row.get("body") or "").strip() for row in correction_rows if str(row.get("body") or "").strip()]
    if not bodies:
        return content
    overlay = "\n".join(f"- {body}" for body in bodies)
    return f"{content.rstrip()}\n\n## Founder Corrections Preserved\n{overlay}\n"


def _merge_uuid_lists(existing: Any, additions: list[str]) -> list[str]:
    values: list[str] = []
    for item in existing or []:
        text = str(item)
        if text and text not in values:
            values.append(text)
    for item in additions:
        text = str(item)
        if text and text not in values:
            values.append(text)
    return values


def _dedupe_strings(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    result: list[str] = []
    for value in values:
        text = str(value or "").strip()
        if text and text not in result:
            result.append(text)
    return result


def _clamp_float(value: Any, minimum: float, maximum: float, default: float) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = default
    return max(minimum, min(maximum, numeric))


def _date_or_none(value: Any) -> str | None:
    if not value:
        return None
    text = str(value)
    if re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        return text
    if re.match(r"^\d{4}-\d{2}-\d{2}T", text):
        return text[:10]
    return None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars].rstrip()}\n\n[truncated]"


def _log_icon(kind: str, text: str) -> str:
    if kind == "decision" or "CONTRADICTION" in text or "WARNING" in text:
        return "alert-triangle"
    if "ERROR" in text:
        return "x-circle"
    return "file-text"
