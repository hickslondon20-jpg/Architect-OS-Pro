# A4 RESEARCH — Verifier pattern + auth + persistence (extraction)

**Extraction target:** the utility-model job pattern, the resolver reuse, the user-auth dependency, and the
verdict persistence home. **Re-verify anchors before editing — they drift.** Verified 2026-07-06. Paths under
`python-backend/`.

---

## §1 Utility-model job pattern (L12 — the verifier's mold)

The verifier is a **direct-Anthropic-from-backend** service (CLAUDE.md Rule #1 lane 1), routed to a cheap
utility model. Two live templates:

- **`services/metadata_extractor.py`** — `store.resolve_platform_model(setting_key=…, fallback…)` (`:34`),
  then `log_ai_usage_event(..., role="utility", ...)` (`:82`).
- **`services/doc_wiki_synthesis.py`** — constructor `(store, anthropic_client)` (`:65`); `from_env()` builds
  `anthropic.Anthropic(api_key=settings.anthropic_api_key or "")` (`:78`); `_resolve_model` via
  `store.resolve_platform_model(setting_key=…, fallback_model_name=settings.claude_synthesis_model)` (`:413`);
  `role="utility"` logging (`:177`).

**For the verifier:** `CitationVerifierService(store, anthropic_client)` + `from_env()`; model via
`resolve_platform_model(setting_key="citation_verifier", fallback=<cheap/utility model>)`. **Must not** use the
conversation model. Register a `citation_verifier` platform-model setting pointing at a utility-class model
(e.g. a Haiku-class), fallback to the utility model — **not** `claude_synthesis_model` if that is the chat model.

## §2 Resolver reuse (A2)

Fetch each citation's source content through the A2 resolvers (`services/citations/resolvers/`): use
`CitationRef.verbatim` when present, else the resolver's resolved view (chunk text / wiki prose+evidence /
Tier 0 field table). The verifier grades the claim against **that** content — it does not re-retrieve. `web_dark`
/ `not_citable` / unresolvable → verdict `unresolvable` (do not fabricate).

## §3 Verdict taxonomy (DP4 — 4-way, not the reference's 5-way)

`{supported, partial, unsupported, unresolvable}`. The reference's "contradicted" folds into `unsupported`;
"verification failed" folds into `unresolvable` (CONTEXT §3.1 DP4 / §8). Grade **co-nothing** — per
`CitationRef`, one verdict each; overall = roll-up.

## §4 Auth dependency (the blessed standardization)

- **`get_current_user_id`** — `routers/kb_folders.py:55`; already the dependency on browser-called
  `/api/artifacts/*` (`main.py:636,650`). This is the browser-safe user-session/JWT path.
- **`require_ingest_secret`** — `main.py:560`; a **service-role secret** for server-to-server endpoints
  (`/api/ingest`, `/api/retrieve`, `/api/tools/*`). **Wrong for browser-called endpoints.**
- **A4 does:** switch `/api/citations/resolve` (`main.py:843`) to `get_current_user_id`, scope resolver reads to
  the authed `user_id`; build `/api/citations/check` on `get_current_user_id`. Frontend calls both with the user
  session (mirror `artifactsApi` / `getArtifact`, imported in `lib/virtualCsoApi.ts:16`).

## §5 Verdict persistence + reload

Verdicts persist on the **assistant message** (reload-safe home, like citations). A1 added
`vcso_chat_messages.citations jsonb` (migration `docs/migrations/20260706_vcso_message_citations.sql`). A4
either (a) extends each citation entry in that jsonb with a `verdict` field, or (b) adds a companion
`citation_verdicts jsonb` column — pick one; reload returns verdicts so chips recolor on load. Confirm the live
column before writing.

## §6 Surface — Check Citations action

The A3 chips already render numbered + clickable. A4 adds a **"Check Citations"** message action → `POST
/api/citations/check` (message/turn id) → verdicts → **recolor chips** by verdict + a summary line. Curated
verdict only, **no chain-of-thought** (L11). Quick (unchecked) vs Checked message state per the reference's
two-state model (C-16) — a message-level flag.

## §7 Scope discipline

Utility model only (L12); grades, never rewrites (C-17); on-demand (not every turn); derived refs skipped (not
citations); auth via `get_current_user_id`. No geometry, no artifact surface (A5).
