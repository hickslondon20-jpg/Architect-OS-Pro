"""Document Wiki - Sprint-history source adapter."""

from __future__ import annotations

import uuid
from typing import Any

from supabase import Client as SupabaseClient

from .doc_wiki_synthesis import DocWikiSynthesisService, SourcePayload


class DocWikiSprintAdapter:
    """Synthesizes sprint data into sprint_history pages."""

    def __init__(self, supabase: SupabaseClient, service: DocWikiSynthesisService) -> None:
        self._sb = supabase
        self._service = service

    async def synthesize_from_sprint(self, sprint_goal_id: str, user_id: str) -> dict[str, Any]:
        """
        Synthesize one sprint goal into wiki pages.

        Returns:
            {
              "sprint_history": SynthesisResult | None,
              "skipped": bool,
              "skip_reason": str | None,
            }
        """
        goal = self._load_sprint_goal(sprint_goal_id, user_id)
        initiatives = self._load_initiatives(sprint_goal_id, user_id)
        initiative_ids = [str(item["id"]) for item in initiatives if item.get("id")]
        milestones = self._load_milestones(initiative_ids, user_id)

        if not self._is_sprint_worthy(goal, initiatives):
            return {
                "sprint_history": None,
                "skipped": True,
                "skip_reason": "Sprint is draft or has no substantive initiatives.",
            }

        quarter = str(goal.get("quarter") or "unknown_quarter")
        sprint_title = self._sprint_title(goal)
        sprint_payload = SourcePayload(
            user_id=user_id,
            source_kind="sprint",
            source_id=sprint_goal_id,
            source_title=sprint_title,
            full_text=self._assemble_sprint_body(goal, initiatives, milestones),
            chunk_refs=[],
            metadata={
                "source_tables": ["sp_sprint_goals", "sp_sprint_initiatives", "sp_sprint_milestones"],
                "sprint_goal_id": sprint_goal_id,
                "effective_date": goal.get("kickoff_date"),
                "observed_date": goal.get("retrospective_completed_at") or goal.get("manually_closed_at"),
                "forced_page_kind": "sprint_history",
                "forced_canonical_key": self._sprint_canonical_key(quarter, sprint_goal_id),
                "forced_page_title": sprint_title,
                "synthesis_directive": (
                    "Synthesize this sprint record into one professional retrospective wiki page. "
                    "Use page_kind sprint_history and preserve the forced canonical key. "
                    "Capture goal, direction, initiatives, constraints, unlocks, and milestone outcomes."
                ),
            },
            synthesis_job_id=str(uuid.uuid4()),
        )
        sprint_result = self._service.synthesize(sprint_payload)

        return {
            "sprint_history": sprint_result,
            "skipped": False,
            "skip_reason": None,
        }

    def _load_sprint_goal(self, sprint_goal_id: str, user_id: str) -> dict[str, Any]:
        result = (
            self._sb.table("sp_sprint_goals")
            .select("*")
            .eq("id", sprint_goal_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            raise ValueError("Sprint goal not found.")
        return result.data

    def _load_initiatives(self, sprint_goal_id: str, user_id: str) -> list[dict[str, Any]]:
        result = (
            self._sb.table("sp_sprint_initiatives")
            .select("*")
            .eq("sprint_goal_id", sprint_goal_id)
            .eq("user_id", user_id)
            .execute()
        )
        return result.data or []

    def _load_milestones(self, initiative_ids: list[str], user_id: str) -> list[dict[str, Any]]:
        if not initiative_ids:
            return []
        result = (
            self._sb.table("sp_sprint_milestones")
            .select("*")
            .in_("initiative_id", initiative_ids)
            .eq("user_id", user_id)
            .execute()
        )
        return result.data or []

    def _is_sprint_worthy(self, goal: dict, initiatives: list[dict]) -> bool:
        """Return False for draft sprints or sprints with no substantive initiatives."""
        if goal.get("status") == "draft":
            return False
        has_substance = any(
            i.get("outcome_statement") or i.get("binary_done_definition")
            for i in initiatives
        )
        return has_substance

    def _sprint_canonical_key(self, quarter: str, sprint_goal_id: str) -> str:
        return f"sprint_{quarter}_{sprint_goal_id[:8]}"

    def _assemble_sprint_body(self, goal: dict, initiatives: list[dict], milestones: list[dict]) -> str:
        """Build the narrative body text for the sprint_history Claude call."""
        milestones_by_initiative: dict[str, list[dict]] = {}
        for milestone in milestones:
            key = str(milestone.get("initiative_id") or "")
            milestones_by_initiative.setdefault(key, []).append(milestone)

        lines = [
            f"## Sprint: {goal.get('name') or goal.get('quarter') or 'Untitled sprint'}",
            f"**Quarter:** {goal.get('quarter') or ''}",
            f"**Goal:** {goal.get('goal_text') or ''}",
            f"**Directional framing:** {goal.get('directional_framing') or ''}",
            f"**Kickoff:** {goal.get('kickoff_date') or ''} | **Closed:** {goal.get('manually_closed_at') or goal.get('retrospective_completed_at') or ''}",
            "",
            f"## Initiatives ({len(initiatives)} total)",
        ]
        for initiative in initiatives:
            initiative_milestones = milestones_by_initiative.get(str(initiative.get("id") or ""), [])
            milestone_text = ", ".join(
                f"{item.get('description') or 'Untitled milestone'} [{item.get('status') or 'unknown'}]"
                for item in initiative_milestones
            )
            lines.extend(
                [
                    "",
                    f"### {initiative.get('name') or 'Untitled initiative'} [{initiative.get('three_p_tier') or 'unclassified'}]",
                    f"- Outcome: {initiative.get('outcome_statement') or ''}",
                    f"- Connection to sprint: {initiative.get('sprint_connection') or ''}",
                    f"- Known constraints: {initiative.get('known_constraints') or ''}",
                    f"- Unlocks: {initiative.get('unlocks_future') or ''}",
                    f"- Done definition: {initiative.get('binary_done_definition') or ''}",
                    f"- Milestones ({len(initiative_milestones)} total): {milestone_text or 'None recorded'}",
                ]
            )
        return "\n".join(lines)

    def _sprint_title(self, goal: dict[str, Any]) -> str:
        label = goal.get("name") or str(goal.get("goal_text") or "")[:60] or "Untitled Sprint"
        return f"{goal.get('quarter') or 'Sprint'} Sprint: {label}"
