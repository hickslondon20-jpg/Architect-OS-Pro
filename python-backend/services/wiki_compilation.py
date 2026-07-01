"""Compilation service for the ArchitectOS per-user wiki."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from core.wiki_schema import event_rebuild_targets, get_wiki_schema, valid_page_key
from services.wiki_health import WikiHealthError, WikiHealthService
from services.vector_store import VectorStoreError

if TYPE_CHECKING:
    from services.vector_store import VectorStore


class WikiCompilationError(RuntimeError):
    pass


@dataclass(frozen=True)
class CompileResult:
    user_id: str
    page_key: str
    claim_count: int
    evidence_count: int
    thin: bool
    digest_generated_at: str
    rebuilt_pages: list[str]
    validation_counts: dict[str, int]


SOURCE_TABLES_BY_PAGE = {
    "diagnostic_synthesis": [
        "ae_assessments",
        "ae_responses",
        "ae_assessment_snapshots",
        "ae_dimension_scores",
        "ae_assessment_insights",
        "vw_ae_dashboard_results",
        "vw_ae_stage_context",
        "gm_assessments",
        "gm_assessment_responses",
        "gm_assessment_checkpoint_scores",
        "gm_assessment_capability_scores",
        "gm_assessment_dimension_scores",
        "gm_assessment_pillar_scores",
        "gm_assessment_overall_scores",
        "gm_assessment_gpt_outputs",
        "gm_capability_rankings",
    ],
    "current_quarter_sprint": [
        "quarter_map_selections",
        "sp_sprint_goals",
        "sp_sprint_initiatives",
        "sp_sprint_milestones",
    ],
    "business_context": [
        "cc_versions",
        "cc_synthesis",
        "cc_drafts_global",
        "cc_version_horizon_snapshots",
        "clarity_compass_versions",
    ],
    "growth_constraints": [
        "gm_assessment_capability_scores",
        "gm_capability_rankings",
        "gm_assessment_checkpoint_scores",
        "quarter_map_selections",
        "cc_versions",
        "cc_synthesis",
        "gvs_saved_growth_scenarios",
        "gvs_comparison_runs",
    ],
    "financial_context": [
        "agency_snapshot_economic_foundation",
        "agency_snapshot_revenue_model",
        "agency_snapshot_delivery_architecture",
        "agency_snapshots",
        "founder_datasets",
        "founder_dataset_rows",
        "founder_dataset_rows_v",
        "ose_raw_document_registry",
        "document_chunks",
    ],
    "client_market_position": [
        "agency_snapshot_market_footprint",
        "agency_snapshot_agency_type_ref_table",
        "agency_snapshot_services_ref_table",
        "agency_snapshot_industries_ref_table",
        "agency_snapshot_revenue_model",
        "gvs_growth_scenarios",
        "gvs_saved_growth_scenarios",
        "gvs_comparison_runs",
        "gvs_scenario_synthesis",
    ],
    "open_questions": [],
}

SOURCE_OWNER_COLUMNS = {
    "gm_assessments": "respondent_user_id",
}


class WikiCompilationService:
    def __init__(self, store: "VectorStore") -> None:
        self.store = store

    @classmethod
    def from_env(cls) -> "WikiCompilationService":
        from services.vector_store import VectorStore

        return cls(VectorStore.from_env())

    def compile_page(self, user_id: str, page_key: str) -> CompileResult:
        if not valid_page_key(page_key):
            raise WikiCompilationError("invalid_page_key")
        page_config = get_wiki_schema()["pages"][page_key]
        source_rows = self._load_sources(user_id, page_key)
        claims = self._build_claims(user_id, page_key, source_rows)
        one_line = _one_line(page_config["title"], source_rows, claims)
        page_embedding = self.store.embed_query(f"{page_config['title']}\n{one_line}")
        if claims:
            claim_embeddings = self.store._embed_texts([claim["text"] for claim in claims])
            for claim, embedding in zip(claims, claim_embeddings, strict=True):
                claim["embedding"] = embedding

        digest = self._build_digest_payload(user_id, page_key, page_config["title"], one_line, claims)
        rpc_payload = {
            "p_user_id": user_id,
            "p_page_key": page_key,
            "p_title": page_config["title"],
            "p_page_kind": page_config["kind"],
            "p_one_line": one_line,
            "p_page_embedding": page_embedding,
            "p_claims": claims,
            "p_digest": digest,
        }
        try:
            self.store.client.rpc("replace_compiled_wiki_page", rpc_payload).execute()
        except Exception as exc:
            raise WikiCompilationError(f"Wiki compile write failed: {exc}") from exc

        try:
            validation_summary = WikiHealthService(self.store).run_post_compile(user_id, page_key)
        except WikiHealthError as exc:
            raise WikiCompilationError(f"Wiki post-compile validation failed: {exc}") from exc

        self._project_to_ose(
            user_id=user_id,
            page_key=page_key,
            page_title=page_config["title"],
            one_line=one_line,
            claims=claims,
        )

        return CompileResult(
            user_id=user_id,
            page_key=page_key,
            claim_count=len(claims),
            evidence_count=sum(len(claim["evidence"]) for claim in claims),
            thin=not claims,
            digest_generated_at=digest["generated_at"],
            rebuilt_pages=[page_key],
            validation_counts=validation_summary.counts,
        )

    def compile_event(self, user_id: str, event: str) -> list[CompileResult]:
        page_keys = event_rebuild_targets(event)
        if not page_keys:
            raise WikiCompilationError("event_has_no_rebuild_targets")
        return [self.compile_page(user_id, page_key) for page_key in page_keys]

    def rebuild_digest(self, user_id: str) -> dict[str, Any]:
        pages = self._load_pages_for_digest(user_id)
        claims_by_page = self._load_claims_for_digest(user_id)
        digest = _digest_from_rows(user_id, pages, claims_by_page)
        self.store.client.table("wiki_digest").upsert(
            {"user_id": user_id, "wiki_version": "wiki-1.0", "generated_at": digest["generated_at"], "digest": digest},
            on_conflict="user_id",
        ).execute()
        return digest

    def _load_sources(self, user_id: str, page_key: str) -> list[dict[str, Any]]:
        source_rows: list[dict[str, Any]] = []
        for table in SOURCE_TABLES_BY_PAGE.get(page_key, []):
            owner_column = SOURCE_OWNER_COLUMNS.get(table, "user_id")
            try:
                rows = (
                    self.store.client.table(table)
                    .select("*")
                    .eq(owner_column, user_id)
                    .limit(3)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                rows = []
            for row in rows:
                source_id = _source_id(row)
                if not source_id:
                    continue
                source_rows.append({"table": table, "source_id": source_id, "row": row})
        return source_rows

    def _build_claims(self, user_id: str, page_key: str, sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
        claims: list[dict[str, Any]] = []
        multi_source = len({source["table"] for source in sources}) > 1
        confidence = "high" if multi_source else "medium"
        recall_score = 0.82 if multi_source else 0.62
        for source in sources[:12]:
            text = _claim_text(page_key, source["table"], source["row"])
            if not text:
                continue
            claims.append(
                {
                    "id": str(uuid4()),
                    "user_id": user_id,
                    "page_key": page_key,
                    "text": text,
                    "class": "compiled",
                    "status": "active",
                    "confidence": confidence,
                    "recall_score": recall_score,
                    "evidence": [
                        {
                            "source_id": source["source_id"],
                            "source_kind": "tier0_record",
                            "path": f"{source['table']}/{source['source_id']}",
                            "lines": None,
                            "weight": 1.0,
                            "note": f"Compiled from Tier 0 source table {source['table']}.",
                        }
                    ],
                }
            )
        return claims

    def _project_to_ose(
        self,
        user_id: str,
        page_key: str,
        page_title: str,
        one_line: str,
        claims: list[dict[str, Any]],
    ) -> None:
        """Mirror a compiled Layer 1 wiki page into ose_knowledge_pages.

        This projects the Layer 1 compiled content into the shared knowledge
        page table so the Virtual CSO can load it alongside Layer 2 pages.
        Non-fatal: if the upsert fails, compile_page() still succeeds.
        """
        content_parts = [f"{page_title}\n\n{one_line}"]
        for claim in claims:
            text = claim.get("text", "").strip()
            if text:
                content_parts.append(text)
        content = "\n\n".join(content_parts)

        confidences = [claim.get("confidence", "medium") for claim in claims]
        if "high" in confidences:
            confidence = "high"
        elif claims:
            confidence = "medium"
        else:
            confidence = "low"

        try:
            self.store.client.table("ose_knowledge_pages").upsert(
                {
                    "user_id": user_id,
                    "canonical_key": page_key,
                    "page_title": page_title,
                    "page_kind": "wiki_layer1",
                    "page_type": "compiled_intelligence",
                    "category": "compiled_intelligence",
                    "domain": None,
                    "content": content,
                    "status": "active",
                    "confidence": confidence,
                    "source_file_ids": [],
                    "last_updated": _now(),
                },
                on_conflict="user_id,canonical_key",
            ).execute()
        except Exception:
            pass

    def _build_digest_payload(
        self,
        user_id: str,
        page_key: str,
        title: str,
        one_line: str,
        claims: list[dict[str, Any]],
    ) -> dict[str, Any]:
        existing_pages = [page for page in self._load_pages_for_digest(user_id) if page.get("page_key") != page_key]
        existing_claims = self._load_claims_for_digest(user_id)
        existing_claims.pop(page_key, None)
        page_row = {
            "page_key": page_key,
            "title": title,
            "one_line": one_line,
            "claim_count": len(claims),
            "top_claim_ids": [claim["id"] for claim in claims[:3]],
            "confidence_rollup": _rollup(claims),
            "last_compiled_at": _now(),
            "stale": False,
        }
        pages = existing_pages + [page_row]
        existing_claims[page_key] = [
            {
                "id": claim["id"],
                "page_key": page_key,
                "text": claim["text"],
                "confidence": claim["confidence"],
                "class": "compiled",
                "status": "active",
            }
            for claim in claims
        ]
        return _digest_from_rows(user_id, pages, existing_claims)

    def _load_pages_for_digest(self, user_id: str) -> list[dict[str, Any]]:
        rows = (
            self.store.client.table("wiki_pages")
            .select("page_key,title,one_line,last_compiled_at,stale")
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )
        claims_by_page = self._load_claims_for_digest(user_id)
        pages = []
        for row in rows:
            claims = claims_by_page.get(row["page_key"], [])
            pages.append(
                {
                    "page_key": row["page_key"],
                    "title": row.get("title"),
                    "one_line": row.get("one_line") or "",
                    "claim_count": len(claims),
                    "top_claim_ids": [claim["id"] for claim in claims[:3]],
                    "confidence_rollup": _rollup(claims),
                    "last_compiled_at": row.get("last_compiled_at"),
                    "stale": bool(row.get("stale")),
                }
            )
        return pages

    def _load_claims_for_digest(self, user_id: str) -> dict[str, list[dict[str, Any]]]:
        rows = (
            self.store.client.table("wiki_claims")
            .select("id,page_key,text,class,status,confidence")
            .eq("user_id", user_id)
            .neq("status", "retired")
            .execute()
            .data
            or []
        )
        grouped: dict[str, list[dict[str, Any]]] = {}
        for row in sorted(rows, key=_claim_digest_sort):
            grouped.setdefault(row["page_key"], []).append(row)
        return grouped


def _digest_from_rows(user_id: str, pages: list[dict[str, Any]], claims_by_page: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    all_claims = [claim for claims in claims_by_page.values() for claim in claims]
    low_confidence = sum(1 for claim in all_claims if claim.get("confidence") == "low")
    quarantined = sum(1 for claim in all_claims if claim.get("status") == "quarantined")
    page_digests = sorted(pages, key=lambda row: row.get("page_key") or "")
    top_claims = [
        {
            "claim_id": claim["id"],
            "page_key": claim["page_key"],
            "text": claim["text"],
            "confidence": claim.get("confidence") or "medium",
        }
        for claim in sorted(all_claims, key=_claim_digest_sort)[:8]
    ]
    return {
        "user_id": user_id,
        "wiki_version": "wiki-1.0",
        "generated_at": _now(),
        "pages": page_digests,
        "top_claims": top_claims,
        "counts": {
            "contradictions": 0,
            "open_questions": len(claims_by_page.get("open_questions", [])),
            "low_confidence": low_confidence,
            "quarantined": quarantined,
        },
        "qualifiers": {
            "overall_confidence": _overall_confidence(page_digests, low_confidence, quarantined),
            "oldest_page_age": _oldest_age(page_digests),
        },
    }


def _claim_text(page_key: str, table: str, row: dict[str, Any]) -> str:
    preferred = [
        "summary",
        "synthesis",
        "insight",
        "title",
        "name",
        "status",
        "stage_name",
        "dimension_name",
        "capability_name",
        "dataset_name",
        "file_name",
    ]
    facts = []
    for key in preferred:
        value = row.get(key)
        if value not in (None, "", [], {}):
            facts.append(f"{key}: {_short(value)}")
        if len(facts) >= 3:
            break
    if not facts:
        for key, value in row.items():
            if key in {"id", "user_id", "created_at", "updated_at"} or value in (None, "", [], {}):
                continue
            facts.append(f"{key}: {_short(value)}")
            if len(facts) >= 3:
                break
    if not facts:
        return ""
    page_label = get_wiki_schema()["pages"][page_key]["title"]
    return f"{page_label} includes {table} evidence ({'; '.join(facts)})."


def _one_line(title: str, sources: list[dict[str, Any]], claims: list[dict[str, Any]]) -> str:
    if not sources:
        return f"{title} is thin: no current Tier 0 source rows were available at compile time."
    return f"{title} compiled from {len(sources)} Tier 0 source row(s) into {len(claims)} evidence-bearing claim(s)."


def _source_id(row: dict[str, Any]) -> str | None:
    for key in ("id", "assessment_id", "snapshot_id", "run_id", "dataset_id", "document_id", "gm_assessment_id"):
        value = row.get(key)
        if value:
            return str(value)
    return None


def _rollup(claims: list[dict[str, Any]]) -> str:
    if not claims:
        return "low"
    if any(claim.get("confidence") == "low" for claim in claims):
        return "low"
    if all(claim.get("confidence") == "high" for claim in claims):
        return "high"
    return "medium"


def _overall_confidence(pages: list[dict[str, Any]], low_confidence: int, quarantined: int) -> str:
    if low_confidence or quarantined or any(page.get("confidence_rollup") == "low" for page in pages):
        return "low"
    if pages and all(page.get("confidence_rollup") == "high" for page in pages):
        return "high"
    return "medium"


def _oldest_age(pages: list[dict[str, Any]]) -> str:
    timestamps = [page.get("last_compiled_at") for page in pages if page.get("last_compiled_at")]
    if not timestamps:
        return "unknown"
    try:
        oldest = min(datetime.fromisoformat(str(value).replace("Z", "+00:00")) for value in timestamps)
    except ValueError:
        return "unknown"
    days = max(0, (datetime.now(timezone.utc) - oldest).days)
    return f"{days}d"


def _claim_digest_sort(claim: dict[str, Any]) -> tuple[int, int, str]:
    class_rank = {"override": 0, "compiled": 1, "insight": 2}.get(str(claim.get("class")), 9)
    confidence_rank = {"high": 0, "medium": 1, "low": 2}.get(str(claim.get("confidence")), 9)
    return (class_rank, confidence_rank, str(claim.get("id") or ""))


def _short(value: Any, max_chars: int = 160) -> str:
    text = " ".join(str(value).split())
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars].rstrip()}..."


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
