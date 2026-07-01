"""Service-role-only global IP and GM checkpoint reads."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from services.agent_context import AgentSourceRef

if TYPE_CHECKING:
    from services.vector_store import VectorStore


class GlobalIpReadError(RuntimeError):
    pass


class GlobalIpReadService:
    def __init__(self, store: "VectorStore") -> None:
        self.store = store

    @classmethod
    def from_env(cls) -> "GlobalIpReadService":
        from services.vector_store import VectorStore

        return cls(VectorStore.from_env())

    def get(self, selector: dict[str, Any]) -> dict[str, Any]:
        if not _has_selector(selector):
            raise GlobalIpReadError("invalid_selector")
        pages = self._global_pages(selector)
        checkpoint_result = self.get_checkpoints(selector, allow_empty=True)
        findings = [
            {
                "type": "global_ip_page",
                "slug": page.get("slug"),
                "title": page.get("title"),
                "body": page.get("body"),
                "domain": page.get("domain"),
                "stage": page.get("ladder_stage"),
                "tier": page.get("revenue_tier"),
                "topic": page.get("topic") or [],
                "updated_at": page.get("updated_at"),
            }
            for page in pages
        ]
        findings.extend(checkpoint_result["findings"])
        if not findings:
            raise GlobalIpReadError("not_found")
        sources = _page_sources(pages) + checkpoint_result["sources"]
        summary = f"Read {len(pages)} global IP page(s) and {len(checkpoint_result['findings'])} checkpoint row(s)."
        return _agent_result(summary, findings, sources, confidence=0.82)

    def get_checkpoints(self, selector: dict[str, Any], *, allow_empty: bool = False) -> dict[str, Any]:
        stage_id = _stage_id(selector)
        capability_id = selector.get("capability_id") or selector.get("capability")
        if not stage_id and not capability_id:
            if allow_empty:
                return {"findings": [], "sources": []}
            raise GlobalIpReadError("invalid_selector")

        stages = self._stages()
        ae_stage_id = None
        stage_name = None
        if stage_id:
            stage = stages.get(stage_id)
            if not stage:
                if allow_empty:
                    return {"findings": [], "sources": []}
                raise GlobalIpReadError("not_found")
            ae_stage_id = stage.get("ae_frontend_stage_id")
            stage_name = stage.get("stage_name")

        query = (
            self.store.client.table("gm_audit_questions")
            .select(
                "gm_audit_question_id,gm_checkpoint_id,stage_id,checkpoint_id_display,"
                "checkpoint_title_display,question_text,question_help_text,gm_dimension_id,"
                "gm_pillar_id,gm_capability_id,question_order,is_active"
            )
            .eq("is_active", True)
            .limit(100)
        )
        if ae_stage_id:
            query = query.eq("stage_id", ae_stage_id)
        if capability_id:
            query = query.eq("gm_capability_id", str(capability_id))
        rows = query.execute().data or []
        if not rows and not allow_empty:
            raise GlobalIpReadError("not_found")

        checkpoint_ids = sorted({row["gm_checkpoint_id"] for row in rows if row.get("gm_checkpoint_id")})
        checkpoints = self._by_key("gm_checkpoints", "checkpoint_id", checkpoint_ids)
        meanings = self._meanings(checkpoint_ids, stage_id)
        scoring = self._scoring(checkpoint_ids, stage_id)
        capabilities = self._by_key("gm_capabilities", "capability_id", sorted({row.get("gm_capability_id") for row in rows if row.get("gm_capability_id")}))
        pillars = self._by_key("gm_pillars", "pillar_id", sorted({row.get("gm_pillar_id") for row in rows if row.get("gm_pillar_id")}))
        dimensions = self._by_key("gm_dimensions", "dimension_id", sorted({row.get("gm_dimension_id") for row in rows if row.get("gm_dimension_id")}))

        findings = []
        for row in rows:
            checkpoint_id = row.get("gm_checkpoint_id")
            finding = {
                "type": "global_checkpoint",
                "source_kind": "global_checkpoint",
                "source_id": row.get("gm_audit_question_id"),
                "gm_checkpoint_id": checkpoint_id,
                "ae_stage_id": row.get("stage_id"),
                "gm_stage_id": stage_id,
                "stage_name": stage_name,
                "checkpoint_id_display": row.get("checkpoint_id_display"),
                "checkpoint_title_display": row.get("checkpoint_title_display"),
                "question_text": row.get("question_text"),
                "question_help_text": row.get("question_help_text"),
                "checkpoint": checkpoints.get(checkpoint_id, {}),
                "meaning": meanings.get(checkpoint_id, {}),
                "scoring": scoring.get(checkpoint_id, {}),
                "capability": capabilities.get(row.get("gm_capability_id"), {}),
                "pillar": pillars.get(row.get("gm_pillar_id"), {}),
                "dimension": dimensions.get(row.get("gm_dimension_id"), {}),
            }
            findings.append(finding)

        sources = [
            AgentSourceRef(
                source_kind="global_checkpoint",
                source_id=finding["source_id"],
                source_label=finding.get("checkpoint_title_display"),
                source_metadata={
                    "gm_checkpoint_id": finding.get("gm_checkpoint_id"),
                    "stage_name": finding.get("stage_name"),
                    "capability_id": finding.get("capability", {}).get("capability_id"),
                },
                citation_payload=finding,
            )
            for finding in findings
        ]
        return {"findings": findings, "sources": sources}

    def _global_pages(self, selector: dict[str, Any]) -> list[dict[str, Any]]:
        query = self.store.client.table("global_ip_pages").select("*").limit(20)
        if selector.get("domain"):
            query = query.eq("domain", str(selector["domain"]))
        if selector.get("stage"):
            query = query.eq("ladder_stage", int(selector["stage"]))
        if selector.get("tier"):
            query = query.eq("revenue_tier", str(selector["tier"]))
        if selector.get("topic"):
            query = query.contains("topic", [str(selector["topic"])])
        return query.execute().data or []

    def _stages(self) -> dict[str, dict[str, Any]]:
        rows = self.store.client.table("gm_stages").select("*").execute().data or []
        return {str(row.get("stage_id")): row for row in rows}

    def _by_key(self, table: str, key: str, ids: list[Any]) -> dict[Any, dict[str, Any]]:
        cleaned = [item for item in ids if item]
        if not cleaned:
            return {}
        rows = self.store.client.table(table).select("*").in_(key, cleaned).execute().data or []
        return {row.get(key): row for row in rows}

    def _meanings(self, checkpoint_ids: list[str], stage_id: str | None) -> dict[str, dict[str, Any]]:
        if not checkpoint_ids or not stage_id:
            return {}
        rows = (
            self.store.client.table("gm_checkpoint_stage_meaning")
            .select("*")
            .in_("checkpoint_id", checkpoint_ids)
            .eq("stage_id", stage_id)
            .execute()
            .data
            or []
        )
        return {row.get("checkpoint_id"): row for row in rows}

    def _scoring(self, checkpoint_ids: list[str], stage_id: str | None) -> dict[str, dict[str, Any]]:
        if not checkpoint_ids or not stage_id:
            return {}
        rows = (
            self.store.client.table("gm_checkpoint_scoring")
            .select("*")
            .in_("checkpoint_id", checkpoint_ids)
            .eq("stage_id", stage_id)
            .execute()
            .data
            or []
        )
        return {row.get("checkpoint_id"): row for row in rows}


def _stage_id(selector: dict[str, Any]) -> str | None:
    value = selector.get("stage_id") or selector.get("stage")
    if value is None:
        return None
    text = str(value)
    return text if text.startswith("gm_stg_") else f"gm_stg_{text}"


def _has_selector(selector: dict[str, Any]) -> bool:
    return any(selector.get(key) for key in ("domain", "stage", "stage_id", "tier", "topic", "capability_id", "capability"))


def _page_sources(pages: list[dict[str, Any]]) -> list[AgentSourceRef]:
    return [
        AgentSourceRef(
            source_kind="global_ip_page",
            source_id=page.get("id"),
            source_label=page.get("title"),
            source_metadata={"slug": page.get("slug"), "domain": page.get("domain")},
            citation_payload={"slug": page.get("slug"), "title": page.get("title"), "updated_at": page.get("updated_at")},
        )
        for page in pages
    ]


def _agent_result(summary: str, findings: list[dict[str, Any]], sources: list[AgentSourceRef], *, confidence: float) -> dict[str, Any]:
    return {
        "schema_version": "agent_result_v1",
        "summary": summary,
        "findings": findings,
        "confidence": confidence,
        "needs_review": False,
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
