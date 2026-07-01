"""Read-only ArchitectOS wiki contract service."""

from __future__ import annotations

from datetime import datetime, timezone
from math import sqrt
from typing import TYPE_CHECKING, Any

from core.wiki_schema import valid_page_key
from services.agent_context import AgentSourceRef
from services.vector_store import VectorStoreError

if TYPE_CHECKING:
    from services.vector_store import VectorStore


class WikiReadError(RuntimeError):
    pass


class WikiReadService:
    def __init__(self, store: "VectorStore") -> None:
        self.store = store

    @classmethod
    def from_env(cls) -> "WikiReadService":
        from services.vector_store import VectorStore

        return cls(VectorStore.from_env())

    def get_page(self, user_id: str, page_key: str) -> dict[str, Any]:
        if not valid_page_key(page_key):
            raise WikiReadError("invalid_page_key")
        page = self._page(user_id, page_key)
        claims = self._claims(user_id, page_key=page_key, classes=["override", "compiled", "insight"])
        ordered = sorted(claims, key=_claim_precedence_key)
        finding = {
            "type": "wiki_page",
            "page_key": page_key,
            "title": page.get("title"),
            "one_line": page.get("one_line"),
            "stale": bool(page.get("stale")),
            "last_compiled_at": page.get("last_compiled_at"),
            "claims": ordered,
            "precedence": "override > compiled > insight",
        }
        summary = page.get("one_line") or f"{page.get('title')} has {len(ordered)} claim(s)."
        return _agent_result(summary, [finding], _sources_for_claims(ordered), confidence=_confidence(ordered))

    def get_claim(self, user_id: str, claim_id: str) -> dict[str, Any]:
        claims = self._claims(user_id, claim_id=claim_id, classes=["override", "compiled", "insight"])
        if not claims:
            raise WikiReadError("not_found")
        claim = claims[0]
        return _agent_result(
            claim["text"],
            [{"type": "wiki_claim", "claim": claim}],
            _sources_for_claims([claim]),
            confidence=_confidence([claim]),
        )

    def search(self, user_id: str, query: str, page_key: str | None = None, *, insight_only: bool = False) -> dict[str, Any]:
        cleaned = query.strip()
        if not cleaned:
            raise WikiReadError("invalid_query")
        if page_key and not valid_page_key(page_key):
            raise WikiReadError("invalid_page_key")

        classes = ["insight"] if insight_only else ["compiled", "insight"]
        claims = self._claims(user_id, page_key=page_key, classes=classes)
        query_embedding = self.store.embed_query(cleaned)
        ranked = sorted(
            (_rank_claim(claim, query_embedding) for claim in claims),
            key=lambda item: item["ranking"]["score"],
            reverse=True,
        )[:8]
        summary = f"Found {len(ranked)} wiki claim(s) for '{cleaned}'."
        return _agent_result(summary, ranked, _sources_for_claims([item["claim"] for item in ranked]), confidence=_confidence([item["claim"] for item in ranked]))

    def read_digest(self, user_id: str) -> dict[str, Any]:
        response = (
            self.store.client.table("wiki_digest")
            .select("user_id,wiki_version,generated_at,digest")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        row = response.data
        if not row:
            raise WikiReadError("not_found")
        digest = row.get("digest") or {}
        summary = f"Wiki digest generated at {row.get('generated_at')}."
        source = AgentSourceRef(
            source_kind="wiki_digest",
            source_id=user_id,
            source_label="Wiki digest",
            citation_payload={"user_id": user_id, "generated_at": row.get("generated_at")},
        )
        return _agent_result(summary, [{"type": "wiki_digest", "digest": digest}], [source], confidence=0.8)

    def _page(self, user_id: str, page_key: str) -> dict[str, Any]:
        response = (
            self.store.client.table("wiki_pages")
            .select("id,user_id,page_key,title,one_line,page_kind,wiki_version,last_compiled_at,stale,updated_at")
            .eq("user_id", user_id)
            .eq("page_key", page_key)
            .single()
            .execute()
        )
        if not response.data:
            raise WikiReadError("not_found")
        return response.data

    def _claims(
        self,
        user_id: str,
        *,
        page_key: str | None = None,
        claim_id: str | None = None,
        classes: list[str],
    ) -> list[dict[str, Any]]:
        query = (
            self.store.client.table("wiki_claims")
            .select(
                "id,user_id,page_id,page_key,text,class,status,confidence,recall_score,embedding,"
                "updated_at,wiki_evidence(source_id,source_kind,path,lines,weight,note),"
                "wiki_contradictions!wiki_contradictions_claim_fk(id,against_claim_id,against_page_ref,note,resolved,created_at),"
                "wiki_insight_records(trust_state,origin,recall_count,query_diversity,safe_to_act_after,expires_at)"
            )
            .eq("user_id", user_id)
            .in_("class", classes)
            .neq("status", "retired")
        )
        if page_key:
            query = query.eq("page_key", page_key)
        if claim_id:
            query = query.eq("id", claim_id)
        response = query.execute()
        return [_format_claim(row) for row in response.data or []]


def _format_claim(row: dict[str, Any]) -> dict[str, Any]:
    insight_records = row.get("wiki_insight_records") or []
    trust = row.get("status")
    if row.get("class") == "insight" and insight_records:
        trust = insight_records[0].get("trust_state") or trust
    return {
        "id": row.get("id"),
        "page_key": row.get("page_key"),
        "text": row.get("text"),
        "class": row.get("class"),
        "status": row.get("status"),
        "trust": trust,
        "confidence": row.get("confidence"),
        "recall_score": float(row.get("recall_score") or 0),
        "evidence": [_format_evidence(item) for item in row.get("wiki_evidence") or []],
        "contradictions": [item for item in row.get("wiki_contradictions") or [] if not item.get("resolved")],
        "updated_at": row.get("updated_at"),
        "_embedding": _embedding(row.get("embedding")),
    }


def _format_evidence(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_id": row.get("source_id"),
        "source_kind": row.get("source_kind"),
        "path": row.get("path"),
        "lines": row.get("lines"),
        "weight": float(row.get("weight") or 0),
        "note": row.get("note") or "",
    }


def _rank_claim(claim: dict[str, Any], query_embedding: list[float]) -> dict[str, Any]:
    similarity = _cosine(query_embedding, claim.get("_embedding") or [])
    stale_penalty = 0.08 if claim.get("stale") else 0
    contested_penalty = 0.1 if claim.get("contradictions") else 0
    trust_bonus = 0.05 if claim.get("class") == "compiled" else 0
    score = max(0.0, similarity + trust_bonus - stale_penalty - contested_penalty)
    public_claim = {key: value for key, value in claim.items() if key != "_embedding"}
    return {
        "type": "wiki_claim",
        "claim": public_claim,
        "ranking": {
            "score": score,
            "vector_similarity": similarity,
            "contested": bool(claim.get("contradictions")),
            "class": claim.get("class"),
            "trust": claim.get("trust"),
        },
    }


def _claim_precedence_key(claim: dict[str, Any]) -> tuple[int, int, str]:
    class_rank = {"override": 0, "compiled": 1, "insight": 2}.get(str(claim.get("class")), 9)
    trusted_rank = 0 if claim.get("trust") == "trusted" or claim.get("status") == "active" else 1
    return (class_rank, trusted_rank, str(claim.get("updated_at") or ""))


def _sources_for_claims(claims: list[dict[str, Any]]) -> list[AgentSourceRef]:
    sources: list[AgentSourceRef] = []
    seen: set[tuple[str | None, str | None]] = set()
    for claim in claims:
        public_claim = {key: value for key, value in claim.items() if key != "_embedding"}
        claim_key = ("wiki_claim", str(claim.get("id")))
        if claim_key not in seen:
            seen.add(claim_key)
            sources.append(
                AgentSourceRef(
                    source_kind="wiki_claim",
                    source_id=claim.get("id"),
                    source_label=claim.get("text"),
                    source_metadata={"page_key": claim.get("page_key"), "class": claim.get("class"), "trust": claim.get("trust")},
                    citation_payload={"claim": public_claim},
                )
            )
        for evidence in claim.get("evidence") or []:
            key = (evidence.get("source_kind"), evidence.get("source_id"))
            if key in seen:
                continue
            seen.add(key)
            sources.append(
                AgentSourceRef(
                    source_kind="wiki_evidence",
                    source_id=evidence.get("source_id"),
                    source_label=evidence.get("path"),
                    source_metadata={"source_kind": evidence.get("source_kind"), "weight": evidence.get("weight")},
                    citation_payload=evidence,
                )
            )
    return sources


def _agent_result(summary: str, findings: list[dict[str, Any]], sources: list[AgentSourceRef], *, confidence: float) -> dict[str, Any]:
    return {
        "schema_version": "agent_result_v1",
        "summary": summary,
        "findings": findings,
        "confidence": confidence,
        "needs_review": confidence < 0.5,
        "reasoning_visibility": "summary_only",
        "source_count": len(sources),
        "citations": [
            {
                "source_kind": source.source_kind,
                "source_id": source.source_id,
                "source_label": source.source_label,
                "source_metadata": source.source_metadata,
                "citation_payload": source.citation_payload,
            }
            for source in sources
        ],
    }


def _confidence(claims: list[dict[str, Any]]) -> float:
    if not claims:
        return 0.45
    values = {"high": 0.86, "medium": 0.68, "low": 0.42}
    return sum(values.get(str(claim.get("confidence")), 0.55) for claim in claims) / len(claims)


def _embedding(value: Any) -> list[float]:
    if isinstance(value, list):
        return [float(item) for item in value]
    if isinstance(value, str):
        stripped = value.strip("[] ")
        if not stripped:
            return []
        return [float(item) for item in stripped.split(",") if item.strip()]
    return []


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    numerator = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = sqrt(sum(a * a for a in left))
    right_norm = sqrt(sum(b * b for b in right))
    if not left_norm or not right_norm:
        return 0.0
    return numerator / (left_norm * right_norm)
