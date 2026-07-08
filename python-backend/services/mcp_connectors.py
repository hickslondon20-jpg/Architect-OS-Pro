"""Config-driven beta connector catalog for the Skills & Plugins workspace."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ConnectorCandidate:
    key: str
    label: str
    category: str
    description: str
    status: str = "coming_soon"

    def to_dict(self) -> dict[str, str]:
        return {
            "key": self.key,
            "label": self.label,
            "category": self.category,
            "description": self.description,
            "status": self.status,
        }


CONNECTOR_CANDIDATES = [
    ConnectorCandidate(
        key="quickbooks",
        label="QuickBooks",
        category="Finance",
        description="Financial source data for cash, revenue, expense, and margin context.",
    ),
    ConnectorCandidate(
        key="gohighlevel",
        label="GoHighLevel",
        category="CRM",
        description="Pipeline, client, campaign, and revenue operations context.",
    ),
    ConnectorCandidate(
        key="notion",
        label="Notion",
        category="Workspace",
        description="Operating docs, SOPs, planning notes, and execution records.",
    ),
]


def list_connector_candidates() -> list[dict[str, str]]:
    return [candidate.to_dict() for candidate in CONNECTOR_CANDIDATES]
