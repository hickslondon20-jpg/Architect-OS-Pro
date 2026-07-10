# Citations (Episode 7) — Sub-phase A4 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`. This session runs sub-phase **A4 only** (Check Citations verifier +
> the citation-endpoint auth standardization). Do **not** start A5.

---

You are the **execution agent** for Sub-phase A4 (Check Citations) of the ArchitectOS Episode 7 build. You build
against **decided design** — implementation choices only, never design choices. If something needs a design
decision beyond the inputs, **stop and flag it**.

You are in the `ArchitectOS Pro_beta` repo, canonical path `C:\Users\Hicks\ArchitectOS Pro_beta`. All paths
below are relative to that root.

**What A4 is, in one line:** an on-demand **utility-model** verifier that grades each citation against its
resolved source (`supported/partial/unsupported/unresolvable`), surfaced as a "Check Citations" action that
recolors chips — **plus** the blessed auth fix moving the citation endpoints onto user-session auth. Grades,
never rewrites. Not the conversation model.

---

## Orient first — read these in order, then build

1. `.planning/citations/phases/a4-check-citations/RESEARCH.md` — **primary build source.** Utility-model pattern
   (§1), resolver reuse (§2), verdict taxonomy (§3), auth dependency (§4), verdict persistence (§5), the check
   action (§6), scope (§7). **Re-verify every anchor before editing — they drift.**
2. `.planning/citations/phases/a4-check-citations/A4-01-PLAN.md` — task (auth-first) + criteria.
3. `.planning/citations/phases/a4-check-citations/CONTEXT.md` — scope, decided decisions, file list, criteria.
4. `.planning/citations/CONTEXT.md` — locked ledger (**wins on conflict**): §3.1 DP4, L11/L12, §8 amendments
   (A1 citations shape, A2 resolvers, **the A3 auth correction**).
5. `services/citations/resolvers/` (A2), `services/metadata_extractor.py` + `services/doc_wiki_synthesis.py`
   (utility-model templates), `routers/kb_folders.py:55` (`get_current_user_id`), `main.py:843` (resolve),
   `docs/migrations/20260706_vcso_message_citations.sql`.

Read 1–4 fully before writing a line.

---

## Step 0 — Auth standardization (do this first; blessed by London — CONTEXT §8)

- Switch **`/api/citations/resolve`** (`main.py:843`) from `require_ingest_secret` → **`get_current_user_id`**
  (`routers/kb_folders.py:55`). Scope every A2 resolver read to the authenticated `user_id`; reject refs whose
  owner ≠ caller.
- Build the new **`/api/citations/check`** on `get_current_user_id` from the start.
- Update the A3 frontend resolve call + the new check call to use the **user session** (mirror `artifactsApi` /
  `getArtifact`, `lib/virtualCsoApi.ts:16`) — drop the `x-ingest-secret` header stopgap.

## Step 1 — The verifier

`python-backend/services/citations/verify.py` — `CitationVerifierService(store, anthropic_client)` + `from_env()`
(mirror `doc_wiki_synthesis` / `metadata_extractor`: direct Anthropic from backend, Rule #1 lane 1). Model via
`store.resolve_platform_model(setting_key="citation_verifier", fallback=<cheap/utility model>)` — **never the
conversation model** (L12); log `role="utility"`. Register a `citation_verifier` platform-model setting →
utility-class model.

Per `CitationRef`: fetch source content via the A2 resolver (`verbatim` if present, else resolved view), grade
support ∈ `{supported, partial, unsupported, unresolvable}`; overall = roll-up. **Structured verdicts only — no
rewrite.** `web_dark`/`not_citable`/unresolvable → `unresolvable`. **Skip `derived` refs** (not citations).

## Step 2 — Endpoint + persistence

`POST /api/citations/check` (`get_current_user_id`) — message/turn id → per-citation verdicts + overall.
**Persist** verdicts on the assistant message (extend the `vcso_chat_messages.citations` jsonb entries with a
`verdict`, or add a `citation_verdicts jsonb` column — additive migration; confirm the live column first) so
they reload.

## Step 3 — Surface

A "Check Citations" message action → calls check → **recolors the A3 chips** by verdict + shows a summary
(curated verdict, no CoT — L11). A message-level Quick-vs-Checked flag (C-16). Reuse the A3 chip components.

## Hard constraints

- **Utility model only** (L12) — never the conversation model. `role="utility"` logged.
- **Grades, never rewrites** — structured verdicts only.
- **On-demand** — not every turn.
- **Auth via `get_current_user_id`** for resolve + check; user-scoped reads; **no ingest secret in the browser path.**
- **4-way verdicts** (DP4) — no "contradicted"/"verification failed" as separate verdicts.
- **Skip `derived` refs.** Reuse A2 resolvers — no new retrieval. No artifact surface (A5), no geometry (Ep7B).
- **Additive migration only** if adding a verdicts column. **CONTEXT wins** on conflict; if underspecified, stop and flag.

---

## Done when (A4 success criteria — CONTEXT §"Success criteria")

1. Planted unsupported claim → `unsupported`; faithful quote → `supported`; unreadable source → `unresolvable`.
2. Verdicts only — never a rewritten answer.
3. Utility model via registry (not the conversation model); `role="utility"` logged.
4. Verdicts persist on the assistant message + reload; the action recolors chips.
5. `/api/citations/resolve` + `/api/citations/check` use `get_current_user_id`; reads user-scoped; no browser ingest secret.
6. `compileall` exits 0; verifier tests green; frontend builds.

**Report back:**
- One paragraph on what was built.
- The `citation_verifier` model setting + fallback; how the verifier fetches source content; the verdict persistence shape.
- Confirmation both endpoints are on `get_current_user_id` and the browser no longer uses the ingest secret.
- Any implementation choice deviating from/extending the design (for CONTEXT §8 reconciliation).
- Any flag needing London or a judgment call.

Then stop. Sub-phase A5 is opened from the strategy thread.
