# Sub-phase A4 Context — Check Citations Verifier (+ auth standardization)

**Date:** 2026-07-06
**Outcome:** Ready to execute. No open decisions; carries the blessed resolve/check auth fix (CONTEXT §8). The
execution agent makes implementation choices only, not design choices.

---

## What this sub-phase is

On-demand grading of an answer's citations against their resolved sources — a **utility-model** verifier (L12)
that grades, never re-authors (L11). Plus the **auth standardization** London blessed: move the citation
endpoints off the ingest secret onto user-session auth. Single deliverable: **A4-01** (see `A4-01-PLAN.md`).

---

## Inputs the agent must read first (in order)

1. `RESEARCH.md` (this folder) — **primary build source.** The utility-model pattern (§1), resolver reuse (§2),
   verdict taxonomy (§3), the auth dependency (§4), persistence (§5), the check action (§6), scope (§7).
2. `A4-01-PLAN.md` (this folder) — task (incl. auth-first) + criteria.
3. `../../CONTEXT.md` — locked ledger. §3.1 DP4 (verifier), L11/L12, §8 amendments (A1 citations shape; A2
   resolvers; **the A3 auth correction**). **CONTEXT wins on conflict.**
4. `python-backend/services/citations/resolvers/` (A2), `services/metadata_extractor.py` +
   `services/doc_wiki_synthesis.py` (utility-model templates), `routers/kb_folders.py:55` (`get_current_user_id`),
   `main.py:843` (resolve endpoint), `docs/migrations/20260706_vcso_message_citations.sql` (citations column).

---

## Decisions already made (do not re-open)

- **Utility model only** (L12) — `resolve_platform_model(setting_key="citation_verifier", …)`; never the
  conversation model; `role="utility"` logging.
- **Grades, never re-authors** (C-17/L11) — structured verdicts, no CoT.
- **4-way verdicts** `{supported, partial, unsupported, unresolvable}` (DP4) — "contradicted"→`unsupported`,
  "verification failed"→`unresolvable`.
- **On-demand only** — not every turn.
- **Auth = `get_current_user_id`** for both `/api/citations/resolve` (switch) and `/api/citations/check` (new);
  reads scoped to the authed user; no ingest secret in the browser path (blessed correction).
- **Derived refs are not verified** (not citations, O1).
- **Verdicts persist on the assistant message** (reload-safe).

---

## What this sub-phase does NOT do

- No every-turn verification; no rewrite of answers.
- No artifact-library rendering (A5); no geometry (Ep7B); no new resolvers (reuse A2).
- No conversation-model use for grading.
- No visual polish beyond functional chip-recolor + summary (§8 owns polish).

---

## Files to create or modify

| File | Action | Notes |
|---|---|---|
| `python-backend/services/citations/verify.py` | Create | `CitationVerifierService(store, anthropic_client)` + `from_env()`; utility model; per-ref verdict + overall; reuses A2 resolvers. |
| `python-backend/main.py` | Modify | `POST /api/citations/check` on `get_current_user_id`; **switch `/api/citations/resolve` to `get_current_user_id`** + user-scoped reads. |
| `python-backend/services/citations/resolvers/*` | Modify | Accept/enforce the authed `user_id` (owner-scoping). |
| messages persistence | Modify/migration | Persist verdicts on `vcso_chat_messages` (extend `citations` jsonb entries or add `citation_verdicts jsonb`). |
| `lib/virtualCsoApi.ts` + `components/pro-suite/virtual-cso/*` | Modify | Check-Citations action; recolor chips by verdict; user-session auth for resolve + check (drop secret header). |
| `python-backend/tests/test_citations_verify_a4.py` | Create | supported/partial/unsupported/unresolvable; no-rewrite; utility-model routing; user-scoping. |

---

## Success criteria (A4-01)

1. Planted unsupported claim → `unsupported`; faithful quote → `supported`; unreadable source → `unresolvable`.
2. Verdicts only — never a rewritten answer.
3. Utility model via registry (not the conversation model); `role="utility"` logged.
4. Verdicts persist on the assistant message + reload; the action recolors chips.
5. `/api/citations/resolve` + `/api/citations/check` use `get_current_user_id`; reads user-scoped; no browser ingest secret.
6. `compileall` exits 0; verifier tests green; frontend builds.

---

## Handoff

When the verifier + check action land, the endpoints are on user-session auth, and verdicts persist/reload, the
strategy thread logs an A4 completion amendment in `../../CONTEXT.md §8`, then opens **sub-phase A5 (Domain
Agents artifact citations)**.

*Context written: 2026-07-06 — Ep7 citations planning thread, at A4 sub-phase entry (carries the blessed auth fix).*
