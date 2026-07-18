# Phase D2 Pre-fix Runbook (for London's host)

Both pre-fixes must be executed from London's environment. The agent sandbox cannot: (a) spend canary
credits or flip flags, and (b) commit — the sandbox mount of `ArchitectOS Pro_beta` is an OneDrive
placeholder (files read truncated; a commit from it would corrupt the working tree, and git already shows a
spurious whole-file CRLF churn). The code edit itself is applied on the hydrated file and parse-verified.

---

## Pre-fix (b) — commit the harness_engine.py sibling fix (do this first)

Already applied on disk: `python-backend/services/harness_engine.py` `HarnessEngine.from_env()` now builds
the store via `VectorStore.from_env()` and reuses `store.client` (mirrors the v0.6.59 `VcsoChatService`
fix), so any harness/domain-agent worker that embeds gets a wired OpenAI client instead of `None`.

From the host repo (NOT the OneDrive path):

```bash
git status                      # expect only python-backend/services/harness_engine.py modified
git diff python-backend/services/harness_engine.py   # confirm just the from_env() hunk (LF, not a whole-file churn)
git add python-backend/services/harness_engine.py
git commit -m "v0.6.60 Wire OpenAI client into HarnessEngine VectorStore (harness_engine.py:110 sibling)"
git push
```

If `git diff` shows a whole-file change, the working tree picked up the placeholder — re-save the file
from the hydrated copy (or re-apply the one hunk by hand) before committing. Confirm `py_compile` clean:
`python -m py_compile python-backend/services/harness_engine.py`.

The intended change (context):

```python
    @classmethod
    def from_env(cls) -> "HarnessEngine":
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise HarnessEngineError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
        store = VectorStore.from_env()      # was: client = create_client(...); VectorStore(client, None, settings)
        return cls(store.client, store=store)
```

---

## Pre-fix (a) — v0.6.59 confirmation turn (one founder-only anchor turn)

Goal: confirm `per_user_wiki` **completes** on the deployed v0.6.59 (the OpenAI embedding-client fix), then
re-darken. This exercises the full `structured → sandbox → wiki` path (wiki runs last, best-effort), so use
the **full** native path, not the single-worker diagnostic.

1. **Precondition — confirm the deploy (mandatory, a stale deploy already cost a run).**
   Deployed Railway head == v0.6.59 SHA `d9ecf25e511210401395b0387150c061e4dcf5b8`; `GET /api/health`
   returns `ok=true`. Do not proceed on a mismatch.
2. **Enroll founder only.** `vcso_sdk_loop`: add founder `cd490873-99aa-4533-9240-f0aa04deb54f` to
   `test_user_ids`; `diagnostic_single_worker_enabled=false` (full three-worker path); caps `max_turns=6`,
   `max_budget_usd=0.25`. `vcso_planner` stays **off**.
3. **Send exactly one retained anchor turn** through the authenticated Virtual CSO UI.
4. **Pass criteria.** Parent `agent_delegation_runs` completes with a cited answer; the `per_user_wiki`
   child row is **`completed`** (previously `failed` with "OPENAI_API_KEY is required for embedding");
   `structured_data_agent` completed; `sandbox_execution_agent` completed (working smoke). Logs show the
   VCSO store built via `VectorStore.from_env()` with a live embedding client.
5. **Re-darken immediately.** `vcso_sdk_loop` → `is_enabled=false`, `test_user_ids=[]`,
   `diagnostic_user_ids=[]`, `diagnostic_single_worker_enabled=false`, `enabled_for_all=false`,
   `default=false`. Read back both `vcso_sdk_loop` and `vcso_planner` dark.

Note: if wiki still fails while `GET /api/debug/provider-config` shows the key present, the deployed head is
not v0.6.59 (§23/§24) — re-check step 1 before any code hypothesis.

---

## After both pre-fixes

Proceed to the **SDK-M1 STOP gate**: review `04B-D2-FINDINGS.md` (worker-scoping mechanism) and approve the
chosen mechanism before any SDK-M2 build. Do not implement the scoping on the unproven CLI-consumption
assumption named in the findings §4.
