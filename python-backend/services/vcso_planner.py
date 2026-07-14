"""Distinct, bounded decompose -> delegate -> compose flow for strategic VCSO turns.

The planner is deliberately independent of the flat VCSO tool loop. It consumes
the Phase 2 intent gate, binds each sub-question through the Phase 3 router,
delegates one non-recursive level through the existing sub-agent orchestrator,
and composes only over compact worker findings through the Phase 1 assembly seam.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Callable

from core.langsmith_tracing import trace_scope
from services.citations.binding import (
    format_numbered_source_list,
    normalize_vcso_turn_sources,
    number_citation_refs,
    parse_answer_citations,
    serialize_numbered_refs,
)
from services.sub_agent_orchestrator import SubAgentOrchestrator, SubAgentRunRequest
from services.usage_events import anthropic_usage, log_ai_usage_event
from services.vcso_source_router import SourceRouter, SourceRoutingResult
from services.vcso_working_state import assemble, normalize_working_state


PLANNER_SCHEMA_VERSION = "vcso_planner_v1"
PLANNER_FLAG = "vcso_planner"
PLANNER_CAPABILITY_KEYS = frozenset(
    {
        "document_analysis_agent",
        "structured_data_agent",
        "kb_explorer_agent",
        "sandbox_execution_agent",
        "per_user_wiki",
        "per_user_document_wiki",
        "global_ip",
    }
)
COMPUTE_SIGNALS = re.compile(
    r"\b(calculate|compute|ratio|trend|variance|margin|concentration|percentage|percent|delta)\b",
    re.IGNORECASE,
)


class PlannerError(RuntimeError):
    """Planner failure that the caller must quarantine to the flat path."""


@dataclass(frozen=True)
class PlannerBudget:
    max_subquestions: int = 4
    max_rounds: int = 2
    max_depth: int = 1
    max_estimated_spend_usd: float = 0.12
    decompose_reserve_usd: float = 0.02
    compose_reserve_usd: float = 0.04
    worker_reserve_usd: float = 0.01
    max_finding_chars: int = 5000
    compose_token_budget: int = 6000

    @classmethod
    def from_settings(cls, settings: dict[str, Any] | None) -> "PlannerBudget":
        source = settings or {}
        return cls(
            max_subquestions=_bounded_int(source.get("max_subquestions"), 4, 1, 8),
            max_rounds=_bounded_int(source.get("max_rounds"), 2, 1, 3),
            max_depth=_bounded_int(source.get("max_depth"), 1, 1, 1),
            max_estimated_spend_usd=_bounded_float(source.get("max_estimated_spend_usd"), 0.12, 0.01, 2.0),
            decompose_reserve_usd=_bounded_float(source.get("decompose_reserve_usd"), 0.02, 0.0, 1.0),
            compose_reserve_usd=_bounded_float(source.get("compose_reserve_usd"), 0.04, 0.0, 1.0),
            worker_reserve_usd=_bounded_float(source.get("worker_reserve_usd"), 0.01, 0.0, 1.0),
            max_finding_chars=_bounded_int(source.get("max_finding_chars"), 5000, 1200, 12000),
            compose_token_budget=_bounded_int(source.get("compose_token_budget"), 6000, 1200, 10000),
        )


@dataclass
class PlannerBudgetLedger:
    budget: PlannerBudget
    estimated_spend_usd: float = 0.0
    worker_calls: int = 0
    rounds_used: int = 1
    cap_hits: list[str] = field(default_factory=list)

    def reserve_parent_calls(self) -> None:
        required = self.budget.decompose_reserve_usd + self.budget.compose_reserve_usd
        if required > self.budget.max_estimated_spend_usd:
            raise PlannerError("Planner parent-call reserve exceeds the configured spend cap.")
        self.estimated_spend_usd = required

    def allow_worker(self, *, pending_count: int) -> bool:
        if self.worker_calls >= self.budget.max_subquestions:
            self._hit("max_subquestions")
            return False
        if self.rounds_used > self.budget.max_rounds:
            self._hit("max_rounds")
            return False
        projected = self.estimated_spend_usd + self.budget.worker_reserve_usd
        if projected > self.budget.max_estimated_spend_usd:
            self._hit("max_estimated_spend_usd")
            return False
        if pending_count <= 0:
            return False
        self.worker_calls += 1
        self.estimated_spend_usd = projected
        return True

    def _hit(self, name: str) -> None:
        if name not in self.cap_hits:
            self.cap_hits.append(name)

    def to_dict(self) -> dict[str, Any]:
        return {
            "max_subquestions": self.budget.max_subquestions,
            "max_rounds": self.budget.max_rounds,
            "max_depth": self.budget.max_depth,
            "max_estimated_spend_usd": self.budget.max_estimated_spend_usd,
            "estimated_spend_usd": round(self.estimated_spend_usd, 6),
            "worker_calls": self.worker_calls,
            "rounds_used": self.rounds_used,
            "cap_hits": list(self.cap_hits),
        }


@dataclass(frozen=True)
class PlannerSubQuestion:
    id: str
    question: str
    purpose: str
    worker_hint: str | None
    status: str = "pending"
    route: dict[str, Any] | None = None
    capability_key: str | None = None
    context_scope: dict[str, Any] = field(default_factory=dict)

    def public_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["context_scope"] = _safe_scope(self.context_scope)
        return data


@dataclass(frozen=True)
class PlannerWorkerFinding:
    subquestion_id: str
    capability_key: str
    run_id: str
    summary: str
    claims: list[dict[str, Any]]
    evidence: list[dict[str, Any]]
    provenance: dict[str, Any]
    confidence: float | None
    citations: list[dict[str, Any]]
    computed_result: Any = None
    derivation: list[str] = field(default_factory=list)
    truncated: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class PlannerRunResult:
    answer_text: str
    citations: list[dict[str, Any]]
    plan: list[PlannerSubQuestion]
    findings: list[PlannerWorkerFinding]
    budget: dict[str, Any]
    trace_steps: list[dict[str, Any]]
    compose_input_tokens: int | None
    compose_output_tokens: int | None
    estimated_compose_tokens: int


def planner_entry_allowed(intent: dict[str, Any] | None, confidence_threshold: float) -> bool:
    """Conservative gate: missing Phase 2 output can never decompose."""

    if not intent or intent.get("status") != "classified":
        return False
    try:
        confidence = float(intent.get("confidence"))
    except (TypeError, ValueError):
        return False
    return (
        intent.get("move_type") == "strategic_synthesis"
        and intent.get("depth") == "deep"
        and confidence >= confidence_threshold
    )


class VcsoPlanner:
    """One-level planner over existing router, workers, and assembly seam."""

    def __init__(
        self,
        *,
        store: Any,
        anthropic_client: Any,
        router_factory: Callable[[Any], Any] = SourceRouter,
        orchestrator_factory: Callable[[Any], Any] = SubAgentOrchestrator,
    ) -> None:
        self.store = store
        self.supabase = store.client
        self.anthropic = anthropic_client
        self.router_factory = router_factory
        self.orchestrator_factory = orchestrator_factory

    def run(
        self,
        *,
        user_id: str,
        thread_id: str,
        user_message_id: str,
        parent_run_id: str,
        message: str,
        working_state: Any,
        intent: dict[str, Any],
        settings: dict[str, Any],
    ) -> PlannerRunResult:
        budget = PlannerBudget.from_settings(settings)
        ledger = PlannerBudgetLedger(budget)
        ledger.reserve_parent_calls()
        synthesis = self.store.resolve_platform_model(
            setting_key="tier_synthesis",
            fallback_model_name="claude-sonnet-4-6",
            fallback_provider="anthropic",
        )
        model = str(synthesis.get("model_name") or "")
        if synthesis.get("provider") != "anthropic" or "claude" not in model:
            raise PlannerError("Synthesis tier is unavailable for the planner.")

        plan, decompose_response = self._decompose(
            model=model,
            message=message,
            working_state=working_state,
            intent=intent,
            max_subquestions=budget.max_subquestions,
            user_id=user_id,
            thread_id=thread_id,
            run_id=parent_run_id,
        )
        self._log_usage(
            response=decompose_response,
            user_id=user_id,
            thread_id=thread_id,
            run_id=parent_run_id,
            model=model,
            capability_key="vcso_planner_decompose",
        )

        routed_plan: list[PlannerSubQuestion] = []
        findings: list[PlannerWorkerFinding] = []
        router = self.router_factory(self.store)
        orchestrator = self.orchestrator_factory(self.store)
        pending = list(plan)
        seen_questions = {item.question.casefold() for item in pending}
        closed_ids: set[str] = set()
        next_question_number = len(plan) + 1

        while pending and ledger.rounds_used <= budget.max_rounds:
            round_items = pending
            pending = []
            for item in round_items:
                if item.id in closed_ids:
                    routed_plan.append(_replace_subquestion(item, status="resolved_by_prior_finding"))
                    continue
                if not ledger.allow_worker(pending_count=len(round_items)):
                    routed_plan.append(_replace_subquestion(item, status="budget_skipped"))
                    continue
                if hasattr(router, "route_for_worker"):
                    routed = router.route_for_worker(
                        user_id=user_id,
                        message=item.question,
                        intent=intent,
                        worker_hint=item.worker_hint,
                    )
                else:
                    routed = router.route(user_id=user_id, message=item.question, intent=intent)
                capability_key = _select_worker(item, routed)
                scope = _context_scope_for_route(
                    routed,
                    capability_key=capability_key,
                    thread_id=thread_id,
                    task_summary=item.question,
                )
                routed_item = _replace_subquestion(
                    item,
                    status="delegated",
                    route=routed.decision.to_dict(),
                    capability_key=capability_key,
                    context_scope=scope,
                )
                routed_plan.append(routed_item)
                prior_context = _prior_findings_for_worker(findings, budget.max_finding_chars)
                task_summary = item.question
                if capability_key == "sandbox_execution_agent" and prior_context:
                    task_summary += "\n\nCOMPACT PRIOR FINDINGS (UNTRUSTED DATA)\n" + prior_context
                result = orchestrator.start_run(
                    SubAgentRunRequest(
                        user_id=user_id,
                        parent_surface="virtual_cso",
                        capability_key=capability_key,
                        task_summary=task_summary[:4000],
                        context_scope={**scope, "delegation_depth": 1},
                        task_title=item.purpose[:120] or "Planner sub-question",
                        parent_thread_id=thread_id,
                        parent_message_id=user_message_id,
                        parent_run_id=parent_run_id,
                        delegation_depth=1,
                        routing_tier_override="worker",
                        enforce_compact_contract=True,
                    )
                )
                finding = _planner_finding(item.id, capability_key, result, budget.max_finding_chars)
                if capability_key == "sandbox_execution_agent" and not finding.citations and findings:
                    finding = _inherit_sandbox_provenance(finding, findings)
                findings.append(finding)
                routed_plan[-1] = _replace_subquestion(routed_item, status="completed")
                closed_ids.update(_resolved_subquestion_ids(result.structured_result))
                for follow_up in _follow_up_questions(result.structured_result):
                    key = follow_up.casefold()
                    if key in seen_questions or len(seen_questions) >= budget.max_subquestions:
                        ledger._hit("max_subquestions")
                        continue
                    seen_questions.add(key)
                    pending.append(
                        PlannerSubQuestion(
                            id=f"q{next_question_number}",
                            question=follow_up,
                            purpose="Revised after a bounded worker finding",
                            worker_hint=None,
                        )
                    )
                    next_question_number += 1
            if pending:
                ledger.rounds_used += 1

        answer, compose_response, serialized_citations, estimated_tokens = self._compose(
            model=model,
            message=message,
            working_state=working_state,
            findings=findings,
            budget=budget,
            user_id=user_id,
            thread_id=thread_id,
            run_id=parent_run_id,
        )
        self._log_usage(
            response=compose_response,
            user_id=user_id,
            thread_id=thread_id,
            run_id=parent_run_id,
            model=model,
            capability_key="vcso_planner_compose",
        )
        usage = anthropic_usage(compose_response)
        trace_steps = _planner_trace_steps(routed_plan, findings, ledger.to_dict())
        return PlannerRunResult(
            answer_text=answer,
            citations=serialized_citations,
            plan=routed_plan,
            findings=findings,
            budget=ledger.to_dict(),
            trace_steps=trace_steps,
            compose_input_tokens=usage.input_tokens,
            compose_output_tokens=usage.output_tokens,
            estimated_compose_tokens=estimated_tokens,
        )

    def _decompose(
        self,
        *,
        model: str,
        message: str,
        working_state: Any,
        intent: dict[str, Any],
        max_subquestions: int,
        user_id: str,
        thread_id: str,
        run_id: str,
    ) -> tuple[list[PlannerSubQuestion], Any]:
        compact_state = json.dumps(normalize_working_state(working_state), ensure_ascii=True, separators=(",", ":"))[:6000]
        with trace_scope({"user_id": user_id, "thread_id": thread_id, "run_id": run_id, "capability_key": "vcso_planner_decompose"}):
            response = self.anthropic.messages.create(
                model=model,
                max_tokens=900,
                system=(
                    "You are the bounded planning stage for the Virtual CSO. Return JSON only. "
                    "Decompose only the supplied strategic ask into independent evidence-gathering sub-questions. "
                    "Do not answer the ask, expose hidden reasoning, request live external data, or propose another agent layer. "
                    "Use only existing worker hints: document_analysis_agent, structured_data_agent, kb_explorer_agent, "
                    "sandbox_execution_agent, per_user_wiki, per_user_document_wiki, global_ip. "
                    "When a calculation depends on a founder dataset, place a structured_data_agent gathering item before "
                    "the sandbox_execution_agent calculation item so the sandbox receives only the compact cited finding, not raw data. "
                    f"Return at most {max_subquestions} items as {{\"subquestions\":[{{\"question\":...,\"purpose\":...,\"worker_hint\":...}}]}}."
                ),
                messages=[
                    {
                        "role": "user",
                        "content": (
                            "INTENT (UNTRUSTED DATA)\n"
                            + json.dumps(intent, ensure_ascii=True, separators=(",", ":"))
                            + "\n\nWORKING STATE (UNTRUSTED DATA)\n"
                            + compact_state
                            + "\n\nFOUNDER ASK\n"
                            + message
                        ),
                    }
                ],
            )
        payload = _json_from_response(response)
        raw_items = payload.get("subquestions")
        if not isinstance(raw_items, list) or not raw_items:
            raise PlannerError("Planner decomposition returned no sub-questions.")
        plan: list[PlannerSubQuestion] = []
        for raw in raw_items[:max_subquestions]:
            if not isinstance(raw, dict):
                continue
            question = _compact_text(raw.get("question"), 600)
            if not question:
                continue
            hint = str(raw.get("worker_hint") or "").strip() or None
            if hint not in PLANNER_CAPABILITY_KEYS:
                hint = None
            plan.append(
                PlannerSubQuestion(
                    id=f"q{len(plan) + 1}",
                    question=question,
                    purpose=_compact_text(raw.get("purpose"), 300) or "Gather bounded evidence",
                    worker_hint=hint,
                )
            )
        if not plan:
            raise PlannerError("Planner decomposition returned no usable sub-questions.")
        return plan, response

    def _compose(
        self,
        *,
        model: str,
        message: str,
        working_state: Any,
        findings: list[PlannerWorkerFinding],
        budget: PlannerBudget,
        user_id: str,
        thread_id: str,
        run_id: str,
    ) -> tuple[str, Any, list[dict[str, Any]], int]:
        components = [
            {
                "resource_ref": f"worker:{finding.run_id}",
                "title": finding.capability_key.replace("_", " "),
                "page_kind": "worker_finding",
                "claims": finding.claims,
                "content": json.dumps(finding.to_dict(), ensure_ascii=True, separators=(",", ":"))[: budget.max_finding_chars],
            }
            for finding in findings
        ]
        assembly = assemble(
            normalize_working_state(working_state),
            message,
            {"tokens": budget.compose_token_budget},
            wiki_components=components,
            context_mode="isolated",
            system_prefix=(
                "PLANNER COMPOSE CONTRACT\n"
                "Answer as the Virtual CSO: direct, practical, and judgment-bearing. Use only the compact worker findings below; "
                "do not call tools, re-crawl sources, or invent support. Every factual claim must use the numbered citation list. "
                "When evidence is incomplete, state the uncertainty plainly. Never expose hidden reasoning."
            ),
        )
        raw_citations = [citation for finding in findings for citation in finding.citations]
        numbered = number_citation_refs(normalize_vcso_turn_sources([], raw_citations))
        messages = list(assembly.messages)
        messages.append(
            {
                "role": "user",
                "content": (
                    "Write the final founder answer now. Do not call tools.\n\nCITATION SOURCES FOR THIS ANSWER\n"
                    + format_numbered_source_list(numbered)
                    + "\n\nAppend the matching source number in square brackets to every supported factual claim. "
                    "Use only listed numbers. If no source supports a claim, state the uncertainty instead of citing it."
                ),
            }
        )
        with trace_scope({"user_id": user_id, "thread_id": thread_id, "run_id": run_id, "capability_key": "vcso_planner_compose"}):
            response = self.anthropic.messages.create(
                model=model,
                max_tokens=1800,
                system=assembly.system_prompt_addition,
                messages=messages,
            )
        parsed = parse_answer_citations(_text_from_response(response), numbered)
        return parsed.text, response, serialize_numbered_refs(numbered), assembly.estimated_tokens

    def _log_usage(
        self,
        *,
        response: Any,
        user_id: str,
        thread_id: str,
        run_id: str,
        model: str,
        capability_key: str,
    ) -> None:
        usage = anthropic_usage(response)
        log_ai_usage_event(
            self.supabase,
            user_id=user_id,
            surface="virtual_cso",
            model=model,
            role="main",
            provider="anthropic",
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            thread_id=thread_id,
            capability_key=capability_key,
            run_id=run_id,
        )


def _select_worker(item: PlannerSubQuestion, routed: SourceRoutingResult) -> str:
    hint = item.worker_hint
    if hint == "sandbox_execution_agent" and COMPUTE_SIGNALS.search(item.question):
        return hint
    if hint in PLANNER_CAPABILITY_KEYS and hint not in {"sandbox_execution_agent"}:
        return hint
    kinds = {str(ref.get("source_kind") or "") for ref in routed.source_refs}
    if "founder_dataset" in kinds:
        return "structured_data_agent"
    if kinds.intersection({"raw_document", "document_chunk", "raw_document_chunk"}):
        return "document_analysis_agent"
    if routed.decision.stop_tier == 1:
        return "per_user_wiki"
    if routed.decision.stop_tier in {2, 3}:
        return "kb_explorer_agent"
    return "structured_data_agent"


def _context_scope_for_route(
    routed: SourceRoutingResult,
    *,
    capability_key: str,
    thread_id: str,
    task_summary: str,
) -> dict[str, Any]:
    refs = routed.source_refs[:20]
    document_ids: list[str] = []
    chunk_ids: list[str] = []
    dataset_ids: list[str] = []
    page_keys: list[str] = []
    claim_ids: list[str] = []
    for ref in refs:
        kind = str(ref.get("source_kind") or "")
        source_id = str(ref.get("source_id") or "").strip()
        metadata = ref.get("source_metadata") if isinstance(ref.get("source_metadata"), dict) else {}
        if not source_id:
            continue
        if kind == "raw_document":
            document_ids.append(str(metadata.get("document_id") or source_id))
        elif kind in {"document_chunk", "raw_document_chunk"}:
            chunk_ids.append(source_id)
        elif kind == "founder_dataset":
            dataset_ids.append(source_id)
        elif kind == "wiki_claim":
            claim_ids.append(source_id)
        elif kind == "wiki_page":
            page_key = metadata.get("page_key") or source_id
            page_keys.append(str(page_key))
    scope: dict[str, Any] = {
        "document_ids": _dedupe(document_ids),
        "chunk_ids": _dedupe(chunk_ids),
        "dataset_ids": _dedupe(dataset_ids),
        "page_keys": _dedupe(page_keys),
        "claim_ids": _dedupe(claim_ids),
        "router_decision": routed.decision.to_dict(),
    }
    if capability_key == "sandbox_execution_agent":
        scope.pop("dataset_ids", None)
        scope["thread_id"] = thread_id
    elif capability_key == "per_user_wiki":
        scope.update({"wiki_tool": "wiki_search", "wiki_query": task_summary})
    elif capability_key == "per_user_document_wiki":
        scope.update({"docwiki_tool": "docwiki_search", "docwiki_query": task_summary})
    return {key: value for key, value in scope.items() if value not in (None, [], {})}


def _planner_finding(
    subquestion_id: str,
    capability_key: str,
    result: Any,
    max_chars: int,
) -> PlannerWorkerFinding:
    structured = result.structured_result if isinstance(result.structured_result, dict) else {}
    summary = _compact_text(structured.get("summary") or result.result_summary, 900)
    claims = _compact_claims(structured.get("claims") or structured.get("findings"), max_chars=max_chars)
    evidence = _compact_evidence(structured.get("evidence") or result.citations)
    provenance = structured.get("provenance") if isinstance(structured.get("provenance"), dict) else {}
    provenance = {
        **provenance,
        "worker_run_id": result.run_id,
        "capability_key": capability_key,
        "parent_linked": True,
    }
    derivation = [
        _compact_text(value, 500)
        for value in (structured.get("derivation") or [])[:8]
        if _compact_text(value, 500)
    ]
    finding = PlannerWorkerFinding(
        subquestion_id=subquestion_id,
        capability_key=capability_key,
        run_id=result.run_id,
        summary=summary,
        claims=claims,
        evidence=evidence,
        provenance=provenance,
        confidence=_optional_float(structured.get("confidence")),
        citations=list(result.citations or [])[:16],
        computed_result=structured.get("computed_result"),
        derivation=derivation,
        truncated=bool(structured.get("truncated")),
    )
    encoded = json.dumps(finding.to_dict(), ensure_ascii=True, default=str)
    if len(encoded) <= max_chars:
        return finding
    return PlannerWorkerFinding(
        subquestion_id=finding.subquestion_id,
        capability_key=finding.capability_key,
        run_id=finding.run_id,
        summary=finding.summary[:700],
        claims=finding.claims[:3],
        evidence=finding.evidence[:6],
        provenance=finding.provenance,
        confidence=finding.confidence,
        citations=finding.citations[:8],
        computed_result=_compact_text(finding.computed_result, 700) or None,
        derivation=finding.derivation[:4],
        truncated=True,
    )


def _inherit_sandbox_provenance(
    finding: PlannerWorkerFinding,
    prior_findings: list[PlannerWorkerFinding],
) -> PlannerWorkerFinding:
    citations = [citation for prior in prior_findings[-3:] for citation in prior.citations][:16]
    evidence = [item for prior in prior_findings[-3:] for item in prior.evidence][:16]
    return PlannerWorkerFinding(
        **{
            **finding.to_dict(),
            "citations": citations,
            "evidence": evidence,
            "provenance": {
                **finding.provenance,
                "derived_from_worker_runs": [prior.run_id for prior in prior_findings[-3:]],
            },
        }
    )


def _planner_trace_steps(
    plan: list[PlannerSubQuestion],
    findings: list[PlannerWorkerFinding],
    budget: dict[str, Any],
) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = [
        {
            "stepIndex": 0,
            "stepType": "context_build",
            "title": "Strategic plan prepared",
            "summary": f"Prepared {len(plan)} bounded sub-question(s) for evidence gathering.",
            "input": {},
            "output": json.dumps(
                {
                    "schema_version": PLANNER_SCHEMA_VERSION,
                    "subquestions": [item.public_dict() for item in plan],
                    "budget": budget,
                    "reasoning_visibility": "summary_only",
                }
            ),
            "status": "completed",
            "sourceRefs": [],
        }
    ]
    by_id = {finding.subquestion_id: finding for finding in findings}
    for item in plan:
        finding = by_id.get(item.id)
        children = []
        if finding:
            children = [
                {
                    "stepIndex": 1,
                    "stepType": "result",
                    "title": "Compact cited finding",
                    "summary": finding.summary,
                    "tool": item.capability_key,
                    "input": {},
                    "output": json.dumps(
                        {
                            "claims": finding.claims,
                            "evidence_count": len(finding.evidence),
                            "confidence": finding.confidence,
                            "truncated": finding.truncated,
                        }
                    ),
                    "status": "completed",
                    "sourceRefs": finding.citations,
                }
            ]
        steps.append(
            {
                "stepIndex": len(steps),
                "stepType": "sub_agent",
                "title": item.purpose,
                "summary": finding.summary if finding else "Skipped by the planner budget.",
                "tool": "delegate_to_sub_agent",
                "input": {
                    "question": item.question,
                    "capability_key": item.capability_key,
                    "source_tier": (item.route or {}).get("stop_tier"),
                },
                "output": json.dumps(
                    {
                        "status": item.status,
                        "run_id": finding.run_id if finding else None,
                        "confidence": finding.confidence if finding else None,
                    }
                ),
                "status": "completed" if finding else "failed",
                "sourceRefs": finding.citations if finding else [],
                "subAgent": {
                    "runId": finding.run_id if finding else None,
                    "capabilityKey": item.capability_key,
                    "status": "completed" if finding else item.status,
                    "summary": finding.summary if finding else None,
                },
                "children": children,
            }
        )
    return steps


def _replace_subquestion(item: PlannerSubQuestion, **changes: Any) -> PlannerSubQuestion:
    values = item.public_dict()
    values.update(changes)
    return PlannerSubQuestion(**values)


def _follow_up_questions(structured: dict[str, Any]) -> list[str]:
    raw = structured.get("follow_up_questions")
    if not isinstance(raw, list):
        return []
    return [_compact_text(value, 600) for value in raw[:4] if _compact_text(value, 600)]


def _resolved_subquestion_ids(structured: dict[str, Any]) -> set[str]:
    raw = structured.get("resolved_subquestion_ids")
    if not isinstance(raw, list):
        return set()
    return {
        str(value).strip()
        for value in raw[:8]
        if re.fullmatch(r"q[1-9][0-9]?", str(value).strip())
    }


def _prior_findings_for_worker(findings: list[PlannerWorkerFinding], max_chars: int) -> str:
    payload = [
        {"summary": item.summary, "claims": item.claims, "evidence": item.evidence}
        for item in findings[-3:]
    ]
    return json.dumps(payload, ensure_ascii=True, separators=(",", ":"))[:max_chars] if payload else ""


def _compact_claims(value: Any, *, max_chars: int) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    claims: list[dict[str, Any]] = []
    remaining = max_chars
    for raw in value[:8]:
        if isinstance(raw, dict):
            text = _compact_text(raw.get("text") or raw.get("summary") or raw.get("claim"), 600)
        else:
            text = _compact_text(raw, 600)
        if not text or len(text) > remaining:
            continue
        claims.append({"text": text})
        remaining -= len(text)
    return claims


def _compact_evidence(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    evidence: list[dict[str, Any]] = []
    for raw in value[:16]:
        if not isinstance(raw, dict):
            continue
        evidence.append(
            {
                "source_kind": raw.get("source_kind"),
                "source_id": raw.get("source_id"),
                "source_label": _compact_text(raw.get("source_label") or raw.get("label"), 240),
                "locator": (raw.get("citation_payload") or {}).get("locator")
                if isinstance(raw.get("citation_payload"), dict)
                else raw.get("locator"),
            }
        )
    return evidence


def _safe_scope(scope: dict[str, Any]) -> dict[str, Any]:
    safe: dict[str, Any] = {}
    for key in ("document_ids", "chunk_ids", "dataset_ids", "page_keys", "claim_ids", "thread_id", "delegation_depth"):
        if key in scope:
            safe[key] = scope[key]
    return safe


def _json_from_response(response: Any) -> dict[str, Any]:
    text = _text_from_response(response).strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0]
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise PlannerError("Planner decomposition returned invalid JSON.") from exc
    if not isinstance(payload, dict):
        raise PlannerError("Planner decomposition must return an object.")
    return payload


def _text_from_response(response: Any) -> str:
    return "".join(
        str(getattr(block, "text", ""))
        for block in getattr(response, "content", []) or []
        if getattr(block, "type", None) == "text"
    )


def _compact_text(value: Any, max_chars: int) -> str:
    return " ".join(str(value or "").split())[:max_chars]


def _dedupe(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def _bounded_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(parsed, maximum))


def _bounded_float(value: Any, default: float, minimum: float, maximum: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(parsed, maximum))


def _optional_float(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None
