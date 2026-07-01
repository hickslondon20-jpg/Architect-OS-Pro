"""Consolidation ('dreaming') cycle for the ArchitectOS per-user wiki.

Internal / unlaunched (L7, D2). Write-scoped to the insight layer + Open Questions only.
Never writes class='compiled'. Never auto-promotes. Never sets trust_state='trusted'.

n8n cron triggers the FastAPI /api/wiki/consolidate endpoint, which calls
run_consolidation(user_id). No founder-facing surface.

Hard guarantees enforced here AND at the DB trigger layer (enforce_wiki_compiled_claim_writer):
  - _assert_no_compiled_write()  → called before any wiki_claims insert
  - _assert_no_trusted_set()     → called before any wiki_insight_records trust_state update
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any

from services.wiki_health import WikiHealthService

if TYPE_CHECKING:
    from services.vector_store import VectorStore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Promotion-candidate gate thresholds (dormant in beta — recall signals are
# unincremented until the connection-phase recall tracking runs; expect 0 set).
#
# EXTENSIBILITY POINT (§3): tune these thresholds and add full 6-signal
# weighting (Frequency .24, Relevance .30, Query diversity .15, Recency .15,
# Consolidation .10, Conceptual richness .06) once recall data flows post-beta.
# ---------------------------------------------------------------------------
_MIN_RECALL_SCORE: float = 0.70
_MIN_RECALL_COUNT: int = 3
_MIN_QUERY_DIVERSITY: int = 2

# ---------------------------------------------------------------------------
# Staleness: insight claims older than this with recall_score == 0 are
# retirement candidates.
#
# EXTENSIBILITY POINT (§3): tune _STALENESS_DAYS and add activity signals
# (last referenced in retrieval, founder engagement score) once the founder's
# maintenance/dreaming material lands.
# ---------------------------------------------------------------------------
_STALENESS_DAYS: int = 90

# ---------------------------------------------------------------------------
# Dedup: insight claims whose normalized text hashes match are duplicates.
#
# EXTENSIBILITY POINT (§3): replace text-hash grouping with semantic cosine
# clustering once the founder's maintenance/dreaming material lands.
# ---------------------------------------------------------------------------


class WikiConsolidationError(RuntimeError):
    pass


@dataclass
class ConsolidationResult:
    user_id: str
    deduped: int = 0
    reconciled: int = 0
    contradictions_flagged: int = 0
    retired: int = 0
    gaps_surfaced: int = 0
    promotion_candidates_set: int = 0
    validation_counts_before: dict[str, int] = field(default_factory=dict)
    validation_counts_after: dict[str, int] = field(default_factory=dict)
    change_list: list[dict[str, Any]] = field(default_factory=list)
    action_log_id: str | None = None


class WikiConsolidationService:
    """assess → fix → verify consolidation cycle (insight layer + Open Questions only)."""

    def __init__(self, store: "VectorStore") -> None:
        self.store = store
        self._health = WikiHealthService(store)

    @classmethod
    def from_env(cls) -> "WikiConsolidationService":
        from services.vector_store import VectorStore

        return cls(VectorStore.from_env())

    # ── Public entry point ────────────────────────────────────────────────────

    def run_consolidation(self, user_id: str) -> ConsolidationResult:
        """Run the full assess → fix → verify loop for one user's insight layer.

        Write-scoped to insight claims + Open Questions page only.
        Every change lands in wiki_action_log and is reversible.
        """
        result = ConsolidationResult(user_id=user_id)

        # ── ASSESS ──────────────────────────────────────────────────────────
        # Consume the 06-validation-health checks (per plan: 07 adds no new checks).
        findings = self._health.validation_findings(user_id)
        health_before = self._health.health(user_id)
        result.validation_counts_before = health_before.get("counts") or {}
        logger.info(
            "wiki_consolidation_assess",
            extra={"user_id": user_id, "finding_count": len(findings)},
        )

        insight_claims = self._load_insight_claims(user_id)
        compiled_claims = self._load_compiled_claims(user_id)

        # ── FIX ─────────────────────────────────────────────────────────────
        changes: list[dict[str, Any]] = []

        # 2a. Deduplicate overlapping insight claims.
        n, ch = self._dedup_insights(user_id, insight_claims)
        result.deduped = n
        changes.extend(ch)
        if n:
            # Reload so later steps don't see retired claims.
            insight_claims = self._load_insight_claims(user_id)

        # 2b. Reconcile insight layer vs compiled base.
        n, ch = self._reconcile_insights(user_id, insight_claims, compiled_claims)
        result.reconciled = n
        changes.extend(ch)

        # 2c. Flag insight↔compiled contradictions not yet recorded.
        n, ch = self._flag_contradictions(user_id, insight_claims, compiled_claims, findings)
        result.contradictions_flagged = n
        changes.extend(ch)

        # 2d. Retire stale zero-recall candidates.
        n, ch = self._retire_stale(user_id, insight_claims)
        result.retired = n
        changes.extend(ch)

        # 2e. Surface validation gaps as Open Questions (never answers).
        n, ch = self._surface_gaps(user_id, findings)
        result.gaps_surfaced = n
        changes.extend(ch)

        # 2f. Promotion-candidate gate (built but dormant in beta).
        # EXTENSIBILITY POINT (§3): recall incrementing is connection-phase;
        # full 6-signal weighting is post-beta. Expect 0 set during beta.
        n, ch = self._promote_candidates(user_id)
        result.promotion_candidates_set = n
        changes.extend(ch)

        # ── VERIFY ──────────────────────────────────────────────────────────
        health_after = self._health.health(user_id)
        result.validation_counts_after = health_after.get("counts") or {}
        result.change_list = changes

        # Append the session-level consolidation summary to the action log.
        log_row = self._log_consolidation(user_id, result)
        result.action_log_id = log_row.get("id")

        logger.info(
            "wiki_consolidation_complete",
            extra={
                "user_id": user_id,
                "deduped": result.deduped,
                "reconciled": result.reconciled,
                "contradictions_flagged": result.contradictions_flagged,
                "retired": result.retired,
                "gaps_surfaced": result.gaps_surfaced,
                "promotion_candidates_set": result.promotion_candidates_set,
            },
        )
        return result

    # ── Assess helpers ────────────────────────────────────────────────────────

    def _load_insight_claims(self, user_id: str) -> list[dict[str, Any]]:
        """Load all active (non-retired) insight claims for this user."""
        response = (
            self.store.client.table("wiki_claims")
            .select("id,page_key,text,class,status,confidence,recall_score,updated_at")
            .eq("user_id", user_id)
            .eq("class", "insight")
            .neq("status", "retired")
            .execute()
        )
        return response.data or []

    def _load_compiled_claims(self, user_id: str) -> list[dict[str, Any]]:
        """Load compiled claims — read-only reference; never written by this service."""
        response = (
            self.store.client.table("wiki_claims")
            .select("id,page_key,text,class,status,confidence,recall_score,updated_at")
            .eq("user_id", user_id)
            .eq("class", "compiled")
            .execute()
        )
        return response.data or []

    def _load_insight_records(self, user_id: str) -> list[dict[str, Any]]:
        response = (
            self.store.client.table("wiki_insight_records")
            .select("id,claim_id,trust_state,recall_count,query_diversity")
            .eq("user_id", user_id)
            .execute()
        )
        return response.data or []

    # ── Fix helpers ───────────────────────────────────────────────────────────

    def _dedup_insights(
        self, user_id: str, claims: list[dict[str, Any]]
    ) -> tuple[int, list[dict[str, Any]]]:
        """Merge exact duplicate insight claims (same normalized text hash).

        The survivor is the oldest claim (earliest updated_at); duplicates are retired with
        action='retire' and reason='dedup_merged', pointing to the survivor's claim_id.

        EXTENSIBILITY POINT (§3): replace hash grouping with semantic cosine clustering
        once the founder's maintenance/dreaming material lands.
        """
        from collections import defaultdict

        groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for claim in claims:
            groups[_text_hash(claim["text"])].append(claim)

        deduped = 0
        changes: list[dict[str, Any]] = []
        for group in groups.values():
            if len(group) < 2:
                continue
            sorted_group = sorted(group, key=lambda c: c.get("updated_at") or "")
            survivor = sorted_group[0]
            for dup in sorted_group[1:]:
                self._retire_claim(user_id, dup, reason="dedup_merged", merged_into=survivor["id"])
                deduped += 1
                changes.append(
                    {
                        "action": "dedup",
                        "retired_claim_id": dup["id"],
                        "merged_into_claim_id": survivor["id"],
                        "page_key": dup["page_key"],
                    }
                )
        return deduped, changes

    def _reconcile_insights(
        self,
        user_id: str,
        insight_claims: list[dict[str, Any]],
        compiled_claims: list[dict[str, Any]],
    ) -> tuple[int, list[dict[str, Any]]]:
        """Retire insight claims whose text is fully absorbed by a compiled claim on the same page.

        'Absorbed' = the normalized insight text is a substring of the compiled claim text.
        The compiled claim is never touched.

        EXTENSIBILITY POINT (§3): replace substring check with semantic similarity
        scoring once the founder's maintenance/dreaming material lands.
        """
        compiled_by_page: dict[str, list[dict[str, Any]]] = {}
        for cc in compiled_claims:
            compiled_by_page.setdefault(cc["page_key"], []).append(cc)

        reconciled = 0
        changes: list[dict[str, Any]] = []
        for insight in insight_claims:
            page_compiled = compiled_by_page.get(insight["page_key"], [])
            for cc in page_compiled:
                if _is_absorbed(_norm(insight["text"]), _norm(cc["text"])):
                    self._retire_claim(
                        user_id, insight, reason="absorbed_by_compiled", merged_into=cc["id"]
                    )
                    reconciled += 1
                    changes.append(
                        {
                            "action": "reconcile_absorbed",
                            "insight_claim_id": insight["id"],
                            "compiled_claim_id": cc["id"],
                            "page_key": insight["page_key"],
                        }
                    )
                    break
        return reconciled, changes

    def _flag_contradictions(
        self,
        user_id: str,
        insight_claims: list[dict[str, Any]],
        compiled_claims: list[dict[str, Any]],
        validation_findings: list[dict[str, Any]],
    ) -> tuple[int, list[dict[str, Any]]]:
        """Write wiki_contradictions rows for contested insight claims not yet recorded.

        Contradictions are never resolved here (A3 record-both-positions). The row is
        written so the 06 health dashboards and Open Questions page can surface it.

        EXTENSIBILITY POINT (§3): add semantic contradiction detection (insight text
        negates compiled text on same page) once the founder's maintenance/dreaming
        material lands.
        """
        existing_claim_ids = self._existing_contradiction_claim_ids(user_id)
        insight_by_id = {c["id"]: c for c in insight_claims}
        compiled_by_page: dict[str, list[dict[str, Any]]] = {}
        for cc in compiled_claims:
            compiled_by_page.setdefault(cc["page_key"], []).append(cc)

        flagged = 0
        changes: list[dict[str, Any]] = []
        for finding in validation_findings:
            if finding.get("check") != "contested":
                continue
            claim_id = finding.get("claim_id")
            if not claim_id or claim_id in existing_claim_ids:
                continue
            insight = insight_by_id.get(claim_id)
            if not insight:
                continue  # Not an insight claim — skip; never touch compiled.
            page_compiled = compiled_by_page.get(insight["page_key"], [])
            if not page_compiled:
                continue
            against = page_compiled[0]
            row = self._insert_one(
                "wiki_contradictions",
                {
                    "user_id": user_id,
                    "claim_id": claim_id,
                    "against_claim_id": against["id"],
                    "note": "flagged by dreaming/consolidation cycle",
                },
            )
            flagged += 1
            changes.append(
                {
                    "action": "flag_contradiction",
                    "claim_id": claim_id,
                    "against_claim_id": against["id"],
                    "page_key": insight["page_key"],
                    "contradiction_id": row.get("id"),
                }
            )
        return flagged, changes

    def _retire_stale(
        self, user_id: str, claims: list[dict[str, Any]]
    ) -> tuple[int, list[dict[str, Any]]]:
        """Retire insight claims older than _STALENESS_DAYS with recall_score == 0.

        Reversible via the action log (restore status from the 'before' payload).

        EXTENSIBILITY POINT (§3): tune _STALENESS_DAYS and add activity signals
        (last retrieved, founder interaction) once the founder's maintenance/dreaming
        material lands.
        """
        cutoff = (datetime.now(timezone.utc) - timedelta(days=_STALENESS_DAYS)).isoformat()
        retired = 0
        changes: list[dict[str, Any]] = []
        for claim in claims:
            updated = claim.get("updated_at") or ""
            recall = float(claim.get("recall_score") or 0)
            if updated < cutoff and recall == 0.0:
                self._retire_claim(user_id, claim, reason="stale_zero_recall", merged_into=None)
                retired += 1
                changes.append(
                    {
                        "action": "retire_stale",
                        "claim_id": claim["id"],
                        "page_key": claim["page_key"],
                        "updated_at": updated,
                    }
                )
        return retired, changes

    def _surface_gaps(
        self, user_id: str, findings: list[dict[str, Any]]
    ) -> tuple[int, list[dict[str, Any]]]:
        """Append unresolved validation findings to the open_questions page as questions.

        Questions only — never fabricated answers (L7, spec §3). The claim is written
        as class='insight', status='quarantined' (insight_accreting page per L8), so it
        goes through the normal promote path if the founder wants to surface it higher.
        """
        if not findings:
            return 0, []
        page = self._ensure_open_questions_page(user_id)
        if not page:
            return 0, []

        appended = 0
        changes: list[dict[str, Any]] = []
        for finding in findings:
            question = _finding_to_question(finding)
            if not question:
                continue
            if self._question_already_surfaced(user_id, question):
                continue
            _assert_no_compiled_write("insight")  # Paranoia: page_key=open_questions is insight only.
            embedding = self.store.embed_query(question)
            claim = self._insert_one(
                "wiki_claims",
                {
                    "user_id": user_id,
                    "page_id": page["id"],
                    "page_key": "open_questions",
                    "text": question,
                    "class": "insight",
                    "status": "quarantined",
                    "confidence": "low",
                    "recall_score": 0,
                    "embedding": embedding,
                },
            )
            self._log_action(
                user_id,
                action="consolidate",
                actor="dreaming",
                page_key="open_questions",
                claim_id=claim.get("id"),
                payload={
                    "before": None,
                    "after": {"claim": claim},
                    "reason": "gap_surfaced",
                    "source_finding": finding,
                },
            )
            appended += 1
            changes.append(
                {
                    "action": "surface_gap",
                    "claim_id": claim.get("id"),
                    "page_key": "open_questions",
                    "question": question,
                    "source_finding": finding,
                }
            )
        return appended, changes

    def _promote_candidates(self, user_id: str) -> tuple[int, list[dict[str, Any]]]:
        """Set trust_state='promotion_candidate' where recall thresholds are met.

        DORMANT IN BETA: recall_count and query_diversity are unincremented until
        the connection-phase recall tracking runs. Expect 0 set during beta runs.

        This gate NEVER calls promote_insight and NEVER sets trust_state='trusted'.
        Setting promotion_candidate only surfaces the insight for founder confirmation
        via promote_insight (05-write-back, founder-only).

        EXTENSIBILITY POINT (§3): full 6-signal weighting is a post-beta enrichment;
        the connection-phase will populate recall_count / query_diversity.
        """
        records = self._load_insight_records(user_id)
        if not records:
            return 0, []

        claim_ids = [r["claim_id"] for r in records if r.get("claim_id")]
        recall_scores = self._claim_recall_scores(user_id, claim_ids)

        set_count = 0
        changes: list[dict[str, Any]] = []
        for record in records:
            if record.get("trust_state") not in ("quarantined",):
                continue  # Only eligible from quarantined.
            claim_id = record.get("claim_id")
            recall_score = float(recall_scores.get(claim_id, 0))
            recall_count = int(record.get("recall_count") or 0)
            query_diversity = int(record.get("query_diversity") or 0)
            if (
                recall_score >= _MIN_RECALL_SCORE
                and recall_count >= _MIN_RECALL_COUNT
                and query_diversity >= _MIN_QUERY_DIVERSITY
            ):
                _assert_no_trusted_set("promotion_candidate")  # Fine — just a check.
                self._update_one(
                    "wiki_insight_records",
                    {"trust_state": "promotion_candidate"},
                    "id",
                    record["id"],
                    user_id,
                )
                self._log_action(
                    user_id,
                    action="consolidate",
                    actor="dreaming",
                    page_key=None,
                    claim_id=claim_id,
                    payload={
                        "before": {"trust_state": record["trust_state"]},
                        "after": {"trust_state": "promotion_candidate"},
                        "reason": "promotion_candidate_gate",
                        "recall_score": recall_score,
                        "recall_count": recall_count,
                        "query_diversity": query_diversity,
                    },
                )
                set_count += 1
                changes.append(
                    {
                        "action": "promotion_candidate",
                        "insight_id": record["id"],
                        "claim_id": claim_id,
                        "recall_score": recall_score,
                    }
                )
        return set_count, changes

    # ── Shared mutation helper ────────────────────────────────────────────────

    def _retire_claim(
        self,
        user_id: str,
        claim: dict[str, Any],
        *,
        reason: str,
        merged_into: str | None,
    ) -> None:
        """Retire an insight claim: status→retired; insight record→rejected; action-logged.

        'retire' is a status, not a delete — fully reversible via the action log.
        The before-state is embedded in the log payload so demote-style restore is possible.
        """
        claim_id = claim["id"]
        insight = self._get_insight_for_claim(user_id, claim_id)
        before = {"claim": dict(claim), "insight": dict(insight) if insight else None}

        self._update_one("wiki_claims", {"status": "retired"}, "id", claim_id, user_id)
        if insight:
            # wiki_insight_records.trust_state valid values: quarantined/promotion_candidate/trusted/rejected
            # Use 'rejected' to mark the record as inactive (closest available value).
            _assert_no_trusted_set("rejected")  # 'rejected' != 'trusted' — assertion passes.
            self._update_one(
                "wiki_insight_records",
                {"trust_state": "rejected"},
                "id",
                insight["id"],
                user_id,
            )
        self._log_action(
            user_id,
            action="retire",
            actor="dreaming",
            page_key=claim.get("page_key"),
            claim_id=claim_id,
            payload={
                "before": before,
                "after": {"status": "retired", "trust_state": "rejected" if insight else None},
                "reason": reason,
                "merged_into_claim_id": merged_into,
            },
        )

    # ── DB helpers ────────────────────────────────────────────────────────────

    def _get_insight_for_claim(self, user_id: str, claim_id: str) -> dict[str, Any] | None:
        response = (
            self.store.client.table("wiki_insight_records")
            .select("id,trust_state,recall_count,query_diversity")
            .eq("user_id", user_id)
            .eq("claim_id", claim_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else None

    def _existing_contradiction_claim_ids(self, user_id: str) -> set[str]:
        response = (
            self.store.client.table("wiki_contradictions")
            .select("claim_id")
            .eq("user_id", user_id)
            .execute()
        )
        return {row["claim_id"] for row in (response.data or [])}

    def _claim_recall_scores(self, user_id: str, claim_ids: list[str]) -> dict[str, float]:
        if not claim_ids:
            return {}
        response = (
            self.store.client.table("wiki_claims")
            .select("id,recall_score")
            .eq("user_id", user_id)
            .in_("id", claim_ids)
            .execute()
        )
        return {row["id"]: float(row.get("recall_score") or 0) for row in (response.data or [])}

    def _ensure_open_questions_page(self, user_id: str) -> dict[str, Any] | None:
        response = (
            self.store.client.table("wiki_pages")
            .select("id,page_key")
            .eq("user_id", user_id)
            .eq("page_key", "open_questions")
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if rows:
            return rows[0]
        from core.wiki_schema import get_wiki_schema

        try:
            page_config = get_wiki_schema()["pages"].get("open_questions")
            if not page_config:
                return None
            return self._insert_one(
                "wiki_pages",
                {
                    "user_id": user_id,
                    "page_key": "open_questions",
                    "title": page_config["title"],
                    "page_kind": page_config["kind"],
                    "wiki_version": "wiki-1.0",
                    "stale": True,
                },
            )
        except Exception as exc:
            logger.warning(
                "wiki_consolidation_open_questions_missing", extra={"error": str(exc)}
            )
            return None

    def _question_already_surfaced(self, user_id: str, question: str) -> bool:
        response = (
            self.store.client.table("wiki_claims")
            .select("id")
            .eq("user_id", user_id)
            .eq("page_key", "open_questions")
            .eq("text", question)
            .neq("status", "retired")
            .limit(1)
            .execute()
        )
        return bool(response.data)

    def _insert_one(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        # Compiled-class write guard (belt-and-suspenders; DB trigger is the real lock).
        if row.get("class") == "compiled":
            _assert_no_compiled_write("compiled")
        response = self.store.client.table(table).insert(row).execute()
        data = response.data
        if isinstance(data, list) and data:
            return data[0]
        if isinstance(data, dict):
            return data
        raise WikiConsolidationError(f"{table}_write_failed")

    def _update_one(
        self,
        table: str,
        values: dict[str, Any],
        key: str,
        value: str,
        user_id: str,
    ) -> dict[str, Any]:
        # Trust-state guard.
        if table == "wiki_insight_records" and values.get("trust_state") == "trusted":
            _assert_no_trusted_set("trusted")
        # Class guard.
        if table == "wiki_claims" and values.get("class") == "compiled":
            _assert_no_compiled_write("compiled")
        response = (
            self.store.client.table(table)
            .update(values)
            .eq(key, value)
            .eq("user_id", user_id)
            .execute()
        )
        data = response.data
        if isinstance(data, list) and data:
            return data[0]
        if isinstance(data, dict):
            return data
        return {}

    def _log_action(
        self,
        user_id: str,
        *,
        action: str,
        actor: str,
        page_key: str | None,
        claim_id: str | None,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        response = (
            self.store.client.table("wiki_action_log")
            .insert(
                {
                    "user_id": user_id,
                    "action": action,
                    "actor": actor,
                    "page_key": page_key,
                    "claim_id": claim_id,
                    "payload": payload,
                }
            )
            .execute()
        )
        data = response.data
        if isinstance(data, list) and data:
            return data[0]
        return {}

    def _log_consolidation(self, user_id: str, result: ConsolidationResult) -> dict[str, Any]:
        """Append the session-level consolidation summary with the full per-claim change list."""
        return self._log_action(
            user_id,
            action="consolidate",
            actor="dreaming",
            page_key=None,
            claim_id=None,
            payload={
                "deduped": result.deduped,
                "reconciled": result.reconciled,
                "contradictions_flagged": result.contradictions_flagged,
                "retired": result.retired,
                "gaps_surfaced": result.gaps_surfaced,
                "promotion_candidates_set": result.promotion_candidates_set,
                "validation_counts_before": result.validation_counts_before,
                "validation_counts_after": result.validation_counts_after,
                "change_list": result.change_list,
            },
        )


# ── Module-level guardrail assertions ─────────────────────────────────────────

def _assert_no_compiled_write(claim_class: str) -> None:
    """Guard: consolidation cycle must never write class='compiled'.

    The DB trigger enforce_wiki_compiled_claim_writer() is the structural lock.
    This assertion is the code-layer pre-check.
    """
    if claim_class == "compiled":
        raise WikiConsolidationError(
            "GUARDRAIL_VIOLATION: consolidation may not write class='compiled'"
        )


def _assert_no_trusted_set(trust_state: str) -> None:
    """Guard: consolidation cycle must never set trust_state='trusted'.

    Only promote_insight (05-write-back, founder-only) may set this.
    """
    if trust_state == "trusted":
        raise WikiConsolidationError(
            "GUARDRAIL_VIOLATION: consolidation may not set trust_state='trusted'"
        )


# ── Pure utilities ─────────────────────────────────────────────────────────────

def _norm(text: str) -> str:
    return " ".join(str(text or "").lower().split())


def _text_hash(text: str) -> str:
    return hashlib.sha256(_norm(text).encode()).hexdigest()


def _is_absorbed(insight_norm: str, compiled_norm: str) -> bool:
    """True when the insight text is contained within or equal to the compiled claim text."""
    if not insight_norm or not compiled_norm:
        return False
    return insight_norm in compiled_norm


def _finding_to_question(finding: dict[str, Any]) -> str | None:
    """Convert a 06-validation finding into a surfaceable question for Open Questions.

    Returns None for findings that don't map to a natural question (e.g. already resolved).
    """
    check = str(finding.get("check") or "")
    page_key = str(finding.get("page_key") or finding.get("page") or "")
    claim_id = str(finding.get("claim_id") or "")
    reason = str(finding.get("reason") or "")

    templates: dict[str, str] = {
        "broken_provenance": (
            f"Why does claim {claim_id} on '{page_key}' have no resolvable evidence? ({reason})"
        ),
        "orphan_claim": (
            f"Claim {claim_id} on '{page_key}' has no page — should it be reassigned or retired?"
        ),
        "orphan_page": (
            f"Page '{page_key}' has no claims — is this a gap to fill or intentionally empty?"
        ),
        "stale_source": (
            f"Source for claim {claim_id} on '{page_key}' appears stale — does it need refreshing?"
        ),
        "off_taxonomy_tag": (
            f"A tag on '{page_key}' is outside the taxonomy — should it be corrected or "
            f"the taxonomy extended?"
        ),
        "contested": (
            f"Claim {claim_id} on '{page_key}' is contested — needs founder review to resolve "
            f"the contradiction."
        ),
        "missing_frontmatter": (
            f"Page '{page_key}' has missing or malformed frontmatter — {reason} — needs a fix."
        ),
    }
    return templates.get(check)
