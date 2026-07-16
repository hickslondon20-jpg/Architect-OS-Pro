"""Config-driven beta connector catalog for the Skills & Plugins workspace."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ConnectorCandidate:
    key: str
    label: str
    category: str
    description: str
    status: str = "coming_soon"
    feature_key: str | None = None
    sdk_pilot: bool = False

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
        feature_key="connector_quickbooks",
        sdk_pilot=True,
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


def connector_candidate(server_name: str) -> ConnectorCandidate | None:
    normalized = str(server_name or "").strip().lower()
    return next((item for item in CONNECTOR_CANDIDATES if item.key == normalized), None)


def sdk_connector_available(client: Any, *, user_id: str, server_name: str) -> bool:
    """Check the founder's beta week against the pilot feature gate.

    The connector catalog remains code-owned. ``feature_registry`` owns availability and
    ``mcp_connections`` owns the founder's actual connection. Missing rows or read failures fail
    closed, and non-pilot catalog entries never enter SDK config.
    """

    candidate = connector_candidate(server_name)
    if candidate is None or not candidate.sdk_pilot or not candidate.feature_key:
        return False
    try:
        features = (
            client.table("feature_registry")
            .select("key,beta_unlock_week,is_active")
            .eq("key", candidate.feature_key)
            .eq("is_active", True)
            .limit(1)
            .execute()
            .data
            or []
        )
        access = (
            client.table("beta_user_access")
            .select("beta_cohort_week,is_beta,status")
            .eq("user_id", str(user_id))
            .eq("is_beta", True)
            .eq("status", "active")
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception:
        return False
    if not features or not access:
        return False
    unlock_week = features[0].get("beta_unlock_week")
    founder_week = access[0].get("beta_cohort_week")
    if unlock_week is None or founder_week is None:
        return False
    try:
        return int(founder_week) >= int(unlock_week)
    except (TypeError, ValueError):
        return False
