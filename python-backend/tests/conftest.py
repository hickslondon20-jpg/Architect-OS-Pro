"""
Conftest for Phase-08 Acceptance Harness.

Loads .env.local from the project root (mapping VITE_* keys to what the Python
backend expects), builds a VectorStore with the service-role key, and provides
session-scoped fixtures for the test user + teardown cleanup.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# ── Path setup ────────────────────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).parents[1]
_PROJECT_ROOT = _BACKEND_DIR.parents[0]
sys.path.insert(0, str(_BACKEND_DIR))

# ── Env loading ───────────────────────────────────────────────────────────────
# Map .env.local Vite/frontend names to backend names before any import that
# reads os.environ (pydantic-settings reads at import time of get_settings()).
_env_file = _PROJECT_ROOT / ".env.local"
if _env_file.exists():
    try:
        from dotenv import dotenv_values
        _vals = dotenv_values(str(_env_file))

        if not os.environ.get("SUPABASE_URL"):
            os.environ["SUPABASE_URL"] = _vals.get("VITE_SUPABASE_URL") or ""

        if not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
            for _k in ("service_role", "SUPABASE_SERVICE_KEY"):
                _v = _vals.get(_k)
                if _v:
                    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = _v
                    break

        if not os.environ.get("OPENAI_API_KEY"):
            os.environ["OPENAI_API_KEY"] = _vals.get("OPENAI_API_KEY") or ""
    except ImportError:
        pass  # python-dotenv not installed — env must be set externally

import pytest


# ── Isolated test user ────────────────────────────────────────────────────────
# Acceptance test user — created once via admin API; UUID is stable across runs.
_TEST_USER_EMAIL = "wiki08-acceptance-test@architectos.internal"
_TEST_USER_PASS = "Wiki08AcceptanceTest!99"
TEST_USER_ID: str = ""  # Populated in the store fixture.

WIKI_TABLES = [
    "wiki_digest",
    "wiki_action_log",
    "wiki_contradictions",
    "wiki_evidence",
    "wiki_insight_records",
    "wiki_claims",
    "wiki_pages",
]


@pytest.fixture(scope="session")
def store():
    """Service-role VectorStore + test-auth-user setup. Session-scoped."""
    global TEST_USER_ID
    try:
        from core.config import get_settings
        get_settings.cache_clear()
        from services.vector_store import VectorStore
        _store = VectorStore.from_env()
    except Exception as exc:
        pytest.skip(f"VectorStore unavailable (check SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY): {exc}")

    # Ensure the test auth user exists (create if absent, reuse if present).
    try:
        resp = _store.client.auth.admin.create_user({
            "email": _TEST_USER_EMAIL,
            "password": _TEST_USER_PASS,
            "email_confirm": True,
        })
        TEST_USER_ID = resp.user.id
    except Exception:
        # User probably already exists — look up by listing users.
        try:
            users = _store.client.auth.admin.list_users()
            for u in (users.users if hasattr(users, "users") else users):
                if getattr(u, "email", None) == _TEST_USER_EMAIL:
                    TEST_USER_ID = u.id
                    break
        except Exception as exc2:
            pytest.skip(f"Could not resolve test auth user: {exc2}")

    if not TEST_USER_ID:
        pytest.skip("Test auth user UUID could not be determined")

    return _store


@pytest.fixture(scope="session")
def test_user_id(store):
    return TEST_USER_ID


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_user(request):
    """Delete all wiki rows for the test user before and after the session."""
    needs_live_store = any(
        "store" in item.fixturenames or "test_user_id" in item.fixturenames
        for item in request.session.items
    )
    if not needs_live_store:
        yield
        return

    store = request.getfixturevalue("store")
    test_user_id = request.getfixturevalue("test_user_id")
    _purge(store, test_user_id)
    yield
    _purge(store, test_user_id)


def _purge(store, user_id: str) -> None:
    """Delete all test-user rows in reverse FK order."""
    if not user_id:
        return
    for table in WIKI_TABLES:
        try:
            store.client.table(table).delete().eq("user_id", user_id).execute()
        except Exception:
            pass  # Table may not exist yet or no rows — both are fine.


@pytest.fixture(scope="session")
def openai_available(store, test_user_id) -> bool:
    """True if a real embed_query round-trip succeeds (OpenAI quota check)."""
    try:
        vec = store.embed_query("agency revenue growth")
        return isinstance(vec, list) and len(vec) > 0
    except Exception:
        return False
