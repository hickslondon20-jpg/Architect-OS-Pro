"""Narrow write-back surface for the ArchitectOS per-user wiki."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from core.wiki_schema import is_insight_accreting, valid_confidence, valid_page_key
from services.vector_store import VectorStoreError
from services.wiki_read import WikiReadError, WikiReadService

if TYPE_CHECKING:
    from services.vector_store import VectorStore


class WikiWritebackError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProposedInsightResult:
    insight_id: str | None
    claim_id: str | None
    status: str
    gate_flags: dict[str, bool]
    rejection_reasons: list[str]


@dataclass(frozen=True)
class ConfidenceResult:
    claim_id: str
    confidence: str
    updated_at: str


@dataclass(frozen=True)
class ContradictionResult:
    contradiction_id: str
    status: str


@dataclass(frozen=True)
class OverrideResult:
    override_id: str
    class_name: str
    precedence: str


@dataclass(frozen=True)
class InsightTrustResult:
    insight_id: str
    trust: str


class WikiWritebackService:
    def __init__(self, store: "VectorStore") -> None:
        self.store = store

    @classmethod
    def from_env(cls) -> "WikiWritebackService":
        from services.vector_store import VectorStore

        return cls(VectorStore.from_env())

    def propose_insight_claim(
        self,
        user_id: str,
        page_key: str,
        text: str,
        evidence: list[dict[str, Any]],
        confidence: str,
        *,
        actor: str = "domain_agent",
    ) -> ProposedInsightResult:
        self._require_actor(actor, {"domain_agent"})
        cleaned_text = _clean_text(text)
        if not valid_page_key(page_key):
            raise WikiWritebackError("invalid_page_key")
        if not is_insight_accreting(page_key):
            flags = _gate_flags(about_business_ok=False, novelty_ok=False, confidence_bar_ok=_confidence_bar_ok(confidence))
            self._log_action(
                user_id,
                action="propose_insight",
                actor=actor,
                page_key=page_key,
                claim_id=None,
                payload={"before": None, "after": None, "gate_flags": flags, "rejected": ["compiled_base_only_page"]},
            )
            return ProposedInsightResult(None, None, "rejected", flags, ["compiled_base_only_page"])
        if not valid_confidence(confidence):
            raise WikiWritebackError("invalid_confidence")
        if not cleaned_text:
            raise WikiWritebackError("invalid_text")
        if not evidence:
            raise WikiWritebackError("invalid_evidence")

        page = self._ensure_page(user_id, page_key)
        flags = _gate_flags(
            about_business_ok=_about_business_ok(cleaned_text, evidence),
            novelty_ok=self._novelty_ok(user_id, page_key, cleaned_text),
            confidence_bar_ok=_confidence_bar_ok(confidence),
        )
        rejection_reasons = [name for name, ok in flags.items() if not ok]
        if rejection_reasons:
            self._log_action(
                user_id,
                action="propose_insight",
                actor=actor,
                page_key=page_key,
                claim_id=None,
                payload={"before": None, "after": None, "gate_flags": flags, "rejected": rejection_reasons, "text": cleaned_text},
            )
            return ProposedInsightResult(None, None, "rejected", flags, rejection_reasons)

        embedding = self.store.embed_query(cleaned_text)
        claim_row = {
            "user_id": user_id,
            "page_id": page["id"],
            "page_key": page_key,
            "text": cleaned_text,
            "class": "insight",
            "status": "quarantined",
            "confidence": confidence,
            "recall_score": 0,
            "embedding": embedding,
        }
        inserted_claim = self._insert_one("wiki_claims", claim_row)
        claim_id = inserted_claim["id"]
        self._insert_evidence(user_id, claim_id, evidence)
        insight_row = self._insert_one(
            "wiki_insight_records",
            {
                "user_id": user_id,
                "claim_id": claim_id,
                "trust_state": "quarantined",
                "origin": "domain_agent_writeback",
                "novelty_ok": flags["novelty_ok"],
                "about_business_ok": flags["about_business_ok"],
                "confidence_bar_ok": flags["confidence_bar_ok"],
            },
        )
        self._log_action(
            user_id,
            action="propose_insight",
            actor=actor,
            page_key=page_key,
            claim_id=claim_id,
            payload={"before": None, "after": {"claim": inserted_claim, "insight": insight_row}, "gate_flags": flags},
        )
        return ProposedInsightResult(insight_row["id"], claim_id, "quarantined", flags, [])

    def set_claim_confidence(self, user_id: str, claim_id: str, confidence: str, *, actor: str) -> ConfidenceResult:
        if not valid_confidence(confidence):
            raise WikiWritebackError("invalid_confidence")
        claim = self._claim(user_id, claim_id)
        if actor == "compilation_service" and claim["class"] != "compiled":
            raise WikiWritebackError("unauthorized")
        if actor == "founder" and (
            claim["class"] == "compiled" or (claim["class"] == "insight" and claim["status"] != "trusted")
        ):
            raise WikiWritebackError("unauthorized")
        if actor not in {"compilation_service", "founder"}:
            raise WikiWritebackError("unauthorized")

        before = dict(claim)
        updated = self._update_one("wiki_claims", {"confidence": confidence}, "id", claim_id, user_id)
        self._log_action(
            user_id,
            action="set_confidence",
            actor=actor,
            page_key=claim["page_key"],
            claim_id=claim_id,
            payload={"before": before, "after": updated},
        )
        return ConfidenceResult(claim_id, updated["confidence"], updated["updated_at"])

    def flag_contradiction(
        self,
        user_id: str,
        claim_id: str,
        *,
        note: str,
        actor: str,
        against_claim_id: str | None = None,
        page_ref: str | None = None,
    ) -> ContradictionResult:
        self._require_actor(actor, {"compilation_service", "domain_agent", "founder"})
        if not against_claim_id and not page_ref:
            raise WikiWritebackError("invalid_target")
        claim = self._claim(user_id, claim_id)
        against_claim = self._claim(user_id, against_claim_id) if against_claim_id else None
        if page_ref and not valid_page_key(page_ref):
            raise WikiWritebackError("invalid_page_key")

        row = self._insert_one(
            "wiki_contradictions",
            {
                "user_id": user_id,
                "claim_id": claim_id,
                "against_claim_id": against_claim_id,
                "against_page_ref": page_ref,
                "note": note,
            },
        )
        if against_claim:
            self._insert_one(
                "wiki_contradictions",
                {
                    "user_id": user_id,
                    "claim_id": against_claim_id,
                    "against_claim_id": claim_id,
                    "against_page_ref": None,
                    "note": note,
                },
            )
            self._update_one("wiki_claims", {"status": "contested"}, "id", against_claim_id, user_id)
        updated_claim = self._update_one("wiki_claims", {"status": "contested"}, "id", claim_id, user_id)
        self._log_action(
            user_id,
            action="flag_contradiction",
            actor=actor,
            page_key=claim["page_key"],
            claim_id=claim_id,
            payload={
                "before": {"claim": claim, "against_claim": against_claim},
                "after": {"contradiction": row, "claim": updated_claim, "records_both_positions": bool(against_claim)},
            },
        )
        return ContradictionResult(row["id"], "open")

    def add_override(
        self,
        user_id: str,
        page_key: str,
        text: str,
        *,
        actor: str,
        claim_id: str | None = None,
    ) -> OverrideResult:
        self._require_actor(actor, {"founder"})
        if not valid_page_key(page_key):
            raise WikiWritebackError("invalid_page_key")
        cleaned_text = _clean_text(text)
        if not cleaned_text:
            raise WikiWritebackError("invalid_text")
        page = self._ensure_page(user_id, page_key)
        target_claim = self._claim(user_id, claim_id) if claim_id else None
        if target_claim and target_claim["page_key"] != page_key:
            raise WikiWritebackError("invalid_target")

        embedding = self.store.embed_query(cleaned_text)
        override = self._insert_one(
            "wiki_claims",
            {
                "user_id": user_id,
                "page_id": page["id"],
                "page_key": page_key,
                "text": cleaned_text,
                "class": "override",
                "status": "active",
                "confidence": "high",
                "recall_score": 1,
                "embedding": embedding,
            },
        )
        superseded = None
        if target_claim and target_claim["class"] == "compiled":
            superseded = self._update_one("wiki_claims", {"superseded_by": override["id"]}, "id", claim_id, user_id)
        self._log_action(
            user_id,
            action="add_override",
            actor=actor,
            page_key=page_key,
            claim_id=override["id"],
            payload={"before": {"target_claim": target_claim}, "after": {"override": override, "superseded_claim": superseded}},
        )
        return OverrideResult(override["id"], "override", "highest")

    def promote_insight(self, user_id: str, insight_id: str, *, actor: str) -> InsightTrustResult:
        self._require_actor(actor, {"founder"})
        insight = self._insight(user_id, insight_id)
        if insight["trust_state"] != "quarantined":
            raise WikiWritebackError("not_quarantined")
        claim = self._claim(user_id, insight["claim_id"])
        before = {"insight": insight, "claim": claim}
        updated_insight = self._update_one("wiki_insight_records", {"trust_state": "trusted"}, "id", insight_id, user_id)
        updated_claim = self._update_one("wiki_claims", {"status": "trusted"}, "id", insight["claim_id"], user_id)
        self._log_action(
            user_id,
            action="promote",
            actor=actor,
            page_key=claim["page_key"],
            claim_id=claim["id"],
            payload={"before": before, "after": {"insight": updated_insight, "claim": updated_claim}},
        )
        return InsightTrustResult(insight_id, "trusted")

    def demote_insight(self, user_id: str, insight_id: str, *, actor: str) -> InsightTrustResult:
        self._require_actor(actor, {"founder"})
        insight = self._insight(user_id, insight_id)
        if insight["trust_state"] != "trusted":
            raise WikiWritebackError("not_trusted")
        claim = self._claim(user_id, insight["claim_id"])
        promote_payload = self._latest_promote_payload(user_id, claim["id"])
        before_state = promote_payload.get("before") if promote_payload else None
        claim_status = ((before_state or {}).get("claim") or {}).get("status") or "quarantined"
        trust_state = ((before_state or {}).get("insight") or {}).get("trust_state") or "quarantined"
        updated_insight = self._update_one("wiki_insight_records", {"trust_state": trust_state}, "id", insight_id, user_id)
        updated_claim = self._update_one("wiki_claims", {"status": claim_status}, "id", claim["id"], user_id)
        self._log_action(
            user_id,
            action="demote",
            actor=actor,
            page_key=claim["page_key"],
            claim_id=claim["id"],
            payload={
                "before": {"insight": insight, "claim": claim},
                "after": {"insight": updated_insight, "claim": updated_claim},
                "reversed_promote_payload": promote_payload,
            },
        )
        return InsightTrustResult(insight_id, "quarantined")

    def flush_candidate_insights(
        self,
        user_id: str,
        candidates: list[dict[str, Any]],
        *,
        actor: str = "domain_agent",
    ) -> list[ProposedInsightResult]:
        self._require_actor(actor, {"domain_agent"})
        results: list[ProposedInsightResult] = []
        for candidate in candidates:
            results.append(
                self.propose_insight_claim(
                    user_id,
                    str(candidate.get("page_key") or ""),
                    str(candidate.get("text") or ""),
                    list(candidate.get("evidence") or []),
                    str(candidate.get("confidence") or "low"),
                    actor=actor,
                )
            )
        return results

    def reject_compiled_write(self, *, actor: str) -> None:
        raise WikiWritebackError("compiled_base_unreachable")

    def _ensure_page(self, user_id: str, page_key: str) -> dict[str, Any]:
        response = (
            self.store.client.table("wiki_pages")
            .select("id,user_id,page_key,title,page_kind,wiki_version")
            .eq("user_id", user_id)
            .eq("page_key", page_key)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if rows:
            return rows[0]
        from core.wiki_schema import get_wiki_schema

        page_config = get_wiki_schema()["pages"][page_key]
        return self._insert_one(
            "wiki_pages",
            {
                "user_id": user_id,
                "page_key": page_key,
                "title": page_config["title"],
                "page_kind": page_config["kind"],
                "wiki_version": "wiki-1.0",
                "stale": True,
            },
        )

    def _claim(self, user_id: str, claim_id: str | None) -> dict[str, Any]:
        if not claim_id:
            raise WikiWritebackError("invalid_claim_id")
        response = (
            self.store.client.table("wiki_claims")
            .select("id,user_id,page_id,page_key,text,class,status,confidence,recall_score,superseded_by,updated_at")
            .eq("user_id", user_id)
            .eq("id", claim_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            raise WikiWritebackError("not_found")
        return rows[0]

    def _insight(self, user_id: str, insight_id: str) -> dict[str, Any]:
        response = (
            self.store.client.table("wiki_insight_records")
            .select("id,user_id,claim_id,trust_state,origin,novelty_ok,about_business_ok,confidence_bar_ok,updated_at")
            .eq("user_id", user_id)
            .eq("id", insight_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            raise WikiWritebackError("not_found")
        return rows[0]

    def _novelty_ok(self, user_id: str, page_key: str, text: str) -> bool:
        try:
            result = WikiReadService(self.store).search(user_id, text, page_key=page_key)
        except (WikiReadError, VectorStoreError) as exc:
            raise WikiWritebackError(f"novelty_gate_unavailable: {exc}") from exc
        for finding in result.get("findings") or []:
            ranking = finding.get("ranking") or {}
            claim = finding.get("claim") or {}
            if ranking.get("score", 0) >= 0.92:
                return False
            if _normalized(claim.get("text")) == _normalized(text):
                return False
        return True

    def _insert_evidence(self, user_id: str, claim_id: str, evidence: list[dict[str, Any]]) -> None:
        rows = []
        for item in evidence:
            source_id = str(item.get("source_id") or "").strip()
            source_kind = str(item.get("source_kind") or "").strip()
            path = str(item.get("path") or source_id).strip()
            if not source_id or source_kind not in {"raw_document", "document_chunk", "tier0_record", "global_checkpoint"}:
                raise WikiWritebackError("invalid_evidence")
            rows.append(
                {
                    "user_id": user_id,
                    "claim_id": claim_id,
                    "source_id": source_id,
                    "source_kind": source_kind,
                    "path": path,
                    "lines": item.get("lines"),
                    "weight": float(item.get("weight") or 1.0),
                    "note": str(item.get("note") or ""),
                }
            )
        self.store.client.table("wiki_evidence").insert(rows).execute()

    def _insert_one(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        response = self.store.client.table(table).insert(row).execute()
        return _single_response(response.data, table)

    def _update_one(self, table: str, values: dict[str, Any], key: str, value: str, user_id: str) -> dict[str, Any]:
        response = (
            self.store.client.table(table)
            .update(values)
            .eq(key, value)
            .eq("user_id", user_id)
            .execute()
        )
        return _single_response(response.data, table)

    def _log_action(
        self,
        user_id: str,
        *,
        action: str,
        actor: str,
        page_key: str | None,
        claim_id: str | None,
        payload: dict[str, Any],
    ) -> None:
        self.store.client.table("wiki_action_log").insert(
            {
                "user_id": user_id,
                "action": action,
                "actor": actor,
                "page_key": page_key,
                "claim_id": claim_id,
                "payload": payload,
            }
        ).execute()

    def _latest_promote_payload(self, user_id: str, claim_id: str) -> dict[str, Any] | None:
        response = (
            self.store.client.table("wiki_action_log")
            .select("payload")
            .eq("user_id", user_id)
            .eq("claim_id", claim_id)
            .eq("action", "promote")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        return rows[0].get("payload") if rows else None

    @staticmethod
    def _require_actor(actor: str, allowed: set[str]) -> None:
        if actor not in allowed:
            raise WikiWritebackError("unauthorized")


def _single_response(data: Any, table: str) -> dict[str, Any]:
    if isinstance(data, list) and data:
        return data[0]
    if isinstance(data, dict):
        return data
    raise WikiWritebackError(f"{table}_write_failed")


def _gate_flags(*, about_business_ok: bool, novelty_ok: bool, confidence_bar_ok: bool) -> dict[str, bool]:
    return {
        "about_business_ok": about_business_ok,
        "novelty_ok": novelty_ok,
        "confidence_bar_ok": confidence_bar_ok,
    }


def _confidence_bar_ok(confidence: str) -> bool:
    return confidence in {"medium", "high"}


def _about_business_ok(text: str, evidence: list[dict[str, Any]]) -> bool:
    lowered = text.lower()
    business_signals = [
        "agency",
        "client",
        "revenue",
        "pipeline",
        "margin",
        "offer",
        "delivery",
        "team",
        "founder",
        "sprint",
        "quarter",
        "assessment",
        "snapshot",
        "growth",
    ]
    generic_phrases = [
        "businesses should",
        "companies should",
        "best practice",
        "it is important to",
        "generally",
    ]
    has_business_signal = any(signal in lowered for signal in business_signals)
    has_resolvable_evidence = any(item.get("source_id") and item.get("source_kind") for item in evidence)
    generic_only = any(phrase in lowered for phrase in generic_phrases) and not has_business_signal
    return has_business_signal and has_resolvable_evidence and not generic_only


def _clean_text(text: str) -> str:
    return " ".join(str(text or "").split())


def _normalized(value: Any) -> str:
    return _clean_text(str(value or "")).lower()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
