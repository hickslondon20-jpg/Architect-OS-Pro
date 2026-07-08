# Plan A4-01 — Check Citations verifier (+ resolve/check auth standardization)

**Sub-phase:** A4 — Check Citations
**Plan:** 1 of 1
**Depends on:** A2 (resolvers), A1 (turn `CitationRef[]` on the message)
**Status:** Ready for execution — carries the blessed auth fix (CONTEXT §8, 2026-07-06).
**Decisions:** `../../CONTEXT.md` §3.1 DP4, L11/L12, §8 (auth correction) · **Ref:** `../../REFERENCES.md` C-16/C-17/C-18

---

## Goal

On-demand grading of an answer's citations against their resolved sources — a **utility-model** pass (L12,
never the conversation model). Grades, never re-authors; curated verdict, no raw CoT (L11). **Also standardize
the citation endpoints on user-session auth** (the fix London blessed).

## Auth standardization (do first — blessed correction, CONTEXT §8)
- Switch **`/api/citations/resolve`** (A2, `main.py:843`) from `require_ingest_secret` → **`get_current_user_id`**
  (`routers/kb_folders.py:55`, already used by `/api/artifacts/*`). Scope every resolver read to the
  authenticated `user_id`; reject refs whose owner ≠ caller.
- Build **`/api/citations/check`** on `get_current_user_id` from the start.
- Update the A3 frontend resolve call + the new check call to use the **user session** (like artifactsApi) —
  drop the `x-ingest-secret` header stopgap.

## Pre-Execution Checks
1. Read `RESEARCH.md` (this folder) — the utility-model routing pattern, resolver reuse, auth dependency, persistence.
2. Confirm the `citations jsonb` shape on `vcso_chat_messages` (A1) — the reload-safe home for verdicts.
3. Confirm the model-setting registry key convention (`resolve_platform_model(setting_key=…)`).

## Build
- **`python-backend/services/citations/verify.py`** — `CitationVerifierService(store, anthropic_client)` +
  `from_env()` (mirror `doc_wiki_synthesis` / `metadata_extractor`: direct Anthropic from backend, Rule #1 lane 1).
  Model via `resolve_platform_model(setting_key="citation_verifier", fallback=<utility/cheap model>)` — **never
  the conversation model** (L12); log `role="utility"`. For each `CitationRef`: fetch source content (A2
  resolver — `verbatim` or resolved view), grade support ∈ `{supported, partial, unsupported, unresolvable}`;
  compute an overall roll-up. Structured verdicts only — **no rewrite** (C-17/C-18).
- **`POST /api/citations/check`** (`get_current_user_id`) — takes a message/turn id → per-citation verdicts +
  overall; **persist** verdicts on the assistant message (extend the `citations` jsonb entries or a companion
  field) so they reload.
- **VCSO surface** — a "Check Citations" action (message action) that calls check and **recolors the A3 chips**
  by verdict + shows the summary (C-16). Curated verdict only (L11).
- **Derived refs are not verified** — they aren't citations (O1); skip them.

## Surface manifestation
**Virtual CSO** — the "Check Citations" action + per-chip verdict badges + summary (curated; no CoT). Reuses the
A3 chip components (adds a verdict state).

## Success criteria
1. A planted unsupported claim grades `unsupported`; a faithful quote grades `supported`; an unreadable source `unresolvable`.
2. Grader output is verdicts only — never a rewritten answer.
3. Runs on the utility model via registry routing (not the conversation model); `role="utility"` logged.
4. Verdicts persist on the assistant message + reload; the action recolors chips.
5. **Auth:** `/api/citations/resolve` + `/api/citations/check` use `get_current_user_id`; reads scoped to the
   authed user; no ingest secret in the browser path.
6. `python -m compileall python-backend` exits 0; verifier tests green; frontend builds.

## Out of scope
Every-turn verification (on-demand only); artifact rendering (A5); geometry (Ep7B); the "contradicted" 5th
verdict (folded into `unsupported` per DP4).
