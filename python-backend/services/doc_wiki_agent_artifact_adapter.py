"""Document Wiki - Domain-agent artifact source adapter."""

from __future__ import annotations

import uuid
from typing import Any

from supabase import Client as SupabaseClient

from .doc_wiki_synthesis import DocWikiSynthesisService, SourcePayload, SynthesisResult


_MIN_RESULT_SUMMARY_LEN = 150
_MIN_CONFIDENCE = 0.5
_VISIBLE_STEP_TYPES = {"tool_use", "reasoning", "output"}


class DocWikiAgentArtifactAdapter:
    """Synthesizes completed agent delegation runs into agent_artifact wiki pages."""

    def __init__(self, supabase: SupabaseClient, service: DocWikiSynthesisService) -> None:
        self._sb = supabase
        self._service = service

    async def synthesize_from_run(self, run_id: str, user_id: str) -> SynthesisResult | None:
        """
        Synthesize one completed run into an agent_artifact page.

        Returns SynthesisResult on success, None if skipped (below threshold).
        """
        run = self._load_run(run_id, user_id)
        steps = self._load_steps(run_id, user_id)
        sources = self._load_context_sources(run_id, user_id)
        if not self._is_artifact_worthy(run):
            return None

        title = self._artifact_title(run)
        related_keys = self._extract_related_canonical_keys(run.get("citations"))
        related_keys.extend(self._extract_related_canonical_keys(run.get("context_scope")))
        payload = SourcePayload(
            user_id=user_id,
            source_kind="agent_artifact",
            source_id=run_id,
            source_title=title,
            full_text=self._assemble_artifact_body(run, steps, sources),
            chunk_refs=[],
            metadata={
                "source_table": "agent_delegation_runs",
                "run_id": run_id,
                "capability_key": run.get("capability_key"),
                "observed_date": run.get("completed_at") or run.get("started_at"),
                "related_canonical_keys": list(dict.fromkeys(related_keys)),
                "forced_page_kind": "agent_artifact",
                "forced_canonical_key": self._artifact_canonical_key(run_id),
                "forced_page_title": title,
                "synthesis_directive": (
                    "Synthesize this domain agent run into a wiki page capturing the task, methodology, "
                    "findings, and implications for the founder's business. Avoid exposing internal plumbing."
                ),
            },
            synthesis_job_id=str(uuid.uuid4()),
        )
        result = self._service.synthesize(payload)
        self._write_related_page_links(user_id, result, related_keys)
        return result

    async def synthesize_from_task(
        self,
        task_id: str,
        user_id: str,
        *,
        artifact_id: str | None = None,
    ) -> SynthesisResult | None:
        """
        Trigger OS Engine synthesis from a promoted Domain Agent task artifact.

        This is the L17 task-sourced entry point. It reuses DocWikiSynthesisService
        and the agent_artifact page kind, but does not force Tasks through the
        agent_delegation_runs path.
        """
        task = self._load_task(task_id, user_id)
        artifact = self._load_task_artifact(task_id, user_id, artifact_id=artifact_id)
        workflow = self._load_workflow(task.get("workflow_id"))
        title = str(artifact.get("description") or task.get("title") or workflow.get("name") or "Domain agent artifact")
        provenance = artifact.get("provenance") if isinstance(artifact.get("provenance"), dict) else {}
        related_keys = self._extract_related_canonical_keys(provenance)
        related_keys.extend(self._extract_related_canonical_keys(task.get("step_results")))
        payload = SourcePayload(
            user_id=user_id,
            source_kind="agent_artifact",
            source_id=str(artifact["id"]),
            source_title=title,
            full_text=self._assemble_task_artifact_body(task, workflow, artifact),
            chunk_refs=[],
            metadata={
                "source_table": "artifacts",
                "source_task_table": "tasks",
                "task_id": task_id,
                "artifact_id": artifact.get("id"),
                "workflow_id": task.get("workflow_id"),
                "workflow_key": workflow.get("key"),
                "agent_id": task.get("agent_id"),
                "template_id": artifact.get("template_id") or workflow.get("template_id"),
                "observed_date": artifact.get("updated_at") or artifact.get("created_at") or task.get("updated_at"),
                "provenance": provenance,
                "source_refs": provenance.get("source_refs") or [],
                "related_canonical_keys": list(dict.fromkeys(related_keys)),
                "forced_page_kind": "agent_artifact",
                "forced_canonical_key": self._task_artifact_canonical_key(task_id),
                "forced_page_title": title,
                "synthesis_directive": (
                    "Synthesize this promoted Domain Agent artifact into a wiki page capturing the task, "
                    "artifact findings, founder-relevant implications, and provenance. OS Engine is the sole "
                    "knowledge-base writer; do not expose internal workflow plumbing."
                ),
            },
            synthesis_job_id=str(uuid.uuid4()),
        )
        result = self._service.synthesize(payload)
        self._write_related_page_links(user_id, result, related_keys)
        return result

    def _load_run(self, run_id: str, user_id: str) -> dict[str, Any]:
        result = (
            self._sb.table("agent_delegation_runs")
            .select("*")
            .eq("id", run_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            raise ValueError("Agent delegation run not found.")
        return result.data

    def _load_steps(self, run_id: str, user_id: str) -> list[dict[str, Any]]:
        result = (
            self._sb.table("agent_delegation_steps")
            .select("*")
            .eq("run_id", run_id)
            .eq("user_id", user_id)
            .order("step_index")
            .execute()
        )
        return result.data or []

    def _load_context_sources(self, run_id: str, user_id: str) -> list[dict[str, Any]]:
        result = (
            self._sb.table("agent_context_sources")
            .select("*")
            .eq("run_id", run_id)
            .eq("user_id", user_id)
            .execute()
        )
        return result.data or []

    def _load_task(self, task_id: str, user_id: str) -> dict[str, Any]:
        result = (
            self._sb.table("tasks")
            .select("*")
            .eq("id", task_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            raise ValueError("Task not found.")
        return result.data

    def _load_task_artifact(self, task_id: str, user_id: str, *, artifact_id: str | None = None) -> dict[str, Any]:
        query = (
            self._sb.table("artifacts")
            .select("*")
            .eq("user_id", user_id)
            .eq("source_kind", "domain_agent_task")
            .eq("task_id", task_id)
        )
        if artifact_id:
            query = query.eq("id", artifact_id)
        result = query.order("updated_at", desc=True).limit(1).execute()
        rows = result.data or []
        if not rows:
            raise ValueError("Registered Domain Agent artifact not found.")
        return rows[0]

    def _load_workflow(self, workflow_id: Any) -> dict[str, Any]:
        if not workflow_id:
            return {}
        result = self._sb.table("workflows").select("*").eq("id", str(workflow_id)).limit(1).execute()
        rows = result.data or []
        return rows[0] if rows else {}

    def _is_artifact_worthy(self, run: dict) -> bool:
        return (
            run.get("status") == "completed"
            and run.get("result_summary")
            and len(run["result_summary"]) >= _MIN_RESULT_SUMMARY_LEN
            and (run.get("confidence") or 0) >= _MIN_CONFIDENCE
        )

    def _artifact_canonical_key(self, run_id: str) -> str:
        return f"agent_artifact_{run_id[:8]}"

    def _task_artifact_canonical_key(self, task_id: str) -> str:
        return f"domain_agent_task_{task_id[:8]}"

    def _assemble_artifact_body(self, run: dict, steps: list[dict], sources: list[dict]) -> str:
        """Build body text. See 04-RESEARCH.md section 4.4 for template."""
        visible_steps = [step for step in steps if step.get("step_type") in _VISIBLE_STEP_TYPES]
        step_lines = [
            f"- {step.get('title') or step.get('step_type') or 'Step'}: {step.get('summary') or step.get('output_summary') or ''}"
            for step in visible_steps
        ]
        source_lines = [
            f"- {source.get('source_label') or source.get('source_id') or 'Source'} ({source.get('source_kind') or 'unknown'})"
            for source in sources
        ]
        return "\n".join(
            [
                f"## Agent run: {run.get('task_title') or run.get('task_summary') or 'Untitled run'}",
                f"Capability: {run.get('capability_key') or ''} | Surface: {run.get('parent_surface') or ''}",
                f"Completed: {run.get('completed_at') or ''} | Confidence: {run.get('confidence') or ''}",
                "",
                "## Task summary",
                str(run.get("task_summary") or ""),
                "",
                "## Result",
                str(run.get("result_summary") or ""),
                "",
                f"## Steps ({len(visible_steps)} total)",
                "\n".join(step_lines) or "No content-bearing steps recorded.",
                "",
                "## Sources used",
                "\n".join(source_lines) or "No context sources recorded.",
            ]
        )

    def _assemble_task_artifact_body(self, task: dict[str, Any], workflow: dict[str, Any], artifact: dict[str, Any]) -> str:
        step_results = task.get("step_results") if isinstance(task.get("step_results"), dict) else {}
        step_lines = []
        source_lines = []
        for key in sorted([item for item in step_results.keys() if str(item).isdigit()], key=lambda item: int(item)):
            result = step_results.get(key) or {}
            if not isinstance(result, dict):
                continue
            step_lines.append(
                f"- Step {key} - {result.get('name') or result.get('step_type') or 'Workflow step'}: {result.get('summary') or ''}"
            )
            for source in result.get("source_refs") or []:
                if isinstance(source, dict):
                    source_lines.append(
                        f"- {source.get('label') or source.get('path') or source.get('source_id') or 'Source'} "
                        f"({source.get('source_kind') or 'unknown'})"
                    )
        content = self._load_artifact_content(artifact)
        provenance = artifact.get("provenance") if isinstance(artifact.get("provenance"), dict) else {}
        return "\n".join(
            [
                f"## Domain Agent task: {task.get('title') or 'Untitled task'}",
                f"Workflow: {workflow.get('name') or task.get('workflow_id') or ''}",
                f"Task status: {task.get('status') or ''}",
                f"Artifact: {artifact.get('filename') or artifact.get('id')}",
                "",
                "## Artifact content",
                content,
                "",
                "## Workflow step summaries",
                "\n".join(step_lines) or "No content-bearing steps recorded.",
                "",
                "## Sources and provenance",
                "\n".join(source_lines) or "No explicit source refs recorded.",
                "",
                "## Provenance payload",
                str(provenance),
            ]
        )

    def _load_artifact_content(self, artifact: dict[str, Any]) -> str:
        storage_path = artifact.get("storage_path")
        if not storage_path:
            return str(artifact.get("description") or "")
        try:
            content = self._sb.storage.from_("artifacts").download(storage_path)
            if isinstance(content, bytes):
                return content.decode("utf-8", errors="replace")
            return str(content or "")
        except Exception:
            return str(artifact.get("description") or "")

    def _artifact_title(self, run: dict[str, Any]) -> str:
        if run.get("task_title"):
            return str(run["task_title"])
        summary = str(run.get("task_summary") or "")[:80]
        return f"{run.get('capability_key') or 'Agent artifact'}: {summary}"

    def _extract_related_canonical_keys(self, value: Any) -> list[str]:
        keys: list[str] = []
        if isinstance(value, dict):
            for key, item in value.items():
                if key in {"canonical_key", "page_canonical_key", "ose_page_canonical_key"} and item:
                    keys.append(str(item))
                else:
                    keys.extend(self._extract_related_canonical_keys(item))
        elif isinstance(value, list):
            for item in value:
                keys.extend(self._extract_related_canonical_keys(item))
        return keys

    def _write_related_page_links(self, user_id: str, result: SynthesisResult, related_keys: list[str]) -> None:
        if not result.page_ids or not related_keys:
            return
        for page_id in result.page_ids:
            self._service._write_page_links(user_id, page_id, related_keys)
