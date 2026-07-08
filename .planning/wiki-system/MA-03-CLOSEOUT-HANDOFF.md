---
title: MA-03 Tier-1 Wiki Synthesis Upgrade — Closeout Handoff
created: 2026-07-08
status: CLOSED — build and wiring complete and proven; real-synthesis path verification explicitly deferred by founder decision (see §6)
supersedes: .planning/wiki-system/TIER1-SYNTHESIS-UPGRADE-DESIGN-BRIEF.md (lost — never committed, never recreated; do not look for it)
audience: orchestration/strategy thread + any execution agent picking up wiki-system or MA-01 work next
---

# MA-03 Closeout Handoff

## 1. What MA-03 Set Out To Do

Upgrade the 7 fixed Tier-1 wiki pages (`business_context`, `diagnostic_synthesis`, `current_quarter_sprint`, `growth_constraints`, `financial_context`, `client_market_position`, `open_questions`) from mechanical claim-rollups to real Sonnet-synthesized narrative pages, grounded in structured platform data, with automatic recompilation whenever the underlying source data changes — no manual "rebuild wiki" action required.

Five objectives:
- **Objective 0** — narrative home + input-gathering upgrade to `wiki_pages`/`wiki_claims`.
- **Objective 1** — Sonnet synthesis step, reusing the `DocWikiSynthesisService` direct-Anthropic pattern (per `CLAUDE.md` Rule #1, this lane is correct: synthesis colocated with a Python backend service).
- **Objective 2** — 7 page-specific synthesis directives (founder-reviewed and approved).
- **Objective 3** — fix `_project_to_ose` and embed the projected page correctly.
- **Objective 4** — wire `event_rebuild_targets` so 12 underlying tables auto-trigger recompilation via Supabase `pg_net`, not scattered frontend call-sites.

## 2. What Is Actually Built and Where

- `python-backend/services/wiki_compilation.py` — the full compilation service: source loading (two-hop owner joins for `ae_*`/`gm_*` tables, table-aware primary-key resolution), Sonnet synthesis with a mechanical fallback when synthesis is ungrounded or unavailable, embedding with graceful degradation to `None` on provider failure, `replace_compiled_wiki_page` RPC write, 10-minute recompile debounce, event chaining (`open_questions` recompiles after any of the other 6 pages).
- `python-backend/main.py` — `/api/wiki/compile-page` and `/api/wiki/compile-event` endpoints, both converted to FastAPI `BackgroundTasks` fire-and-forget (matches the pre-existing pattern used by `/api/ingest` and `/api/doc-wiki/synthesize-document`) so Railway/Cloudflare's ~10-12s edge-gateway timeout can't kill a multi-second synthesis call mid-flight.
- `python-backend/core/wiki_schema.py` + `python-backend/config/wiki_schema.json` — schema/event-map loader, now resolves correctly inside Railway's `python-backend`-only deploy root (previously assumed a full monorepo checkout).
- `python-backend/scripts/ma03_tier1_synthesis_smoke.py` — founder-runnable smoke script for direct `compile_page` testing outside the trigger path.
- Supabase, applied via migration (all live, versioned in Supabase's own migration history — see §6):
  - `ma03_tier1_synthesis_narrative_and_projection_fix`, `ma03_drop_legacy_replace_compiled_wiki_page_overload`, `ma03_fix_ose_knowledge_pages_canonical_key_arbiter`, `ma03_extend_wiki_source_resolves_id_columns` — Objective 0/3 schema and RPC work.
  - `ma03_tier1_wiki_autotrigger` — `pg_net` extension, Vault secrets (`wiki_autotrigger_backend_url`, `wiki_autotrigger_ingest_secret`), 13 triggers across 12 source tables, all mapped through `event_rebuild_targets` in `wiki_schema.json`.
  - `fix_replace_compiled_wiki_page_null_embedding` (2026-07-08, this session) — see §4.

## 3. The Incident: Total Loss of Uncommitted Work, and the New Working Agreement

Earlier in this build, a full MA-01 Gate 1 pass (LangSmith instrumentation) and the original MA-03 Objectives 0-3 build were both completed in an agent session but never `git commit`-ed before the session ended. File edits made through this agent's tools are **not durably persisted to the founder's real disk across a session boundary unless a commit happens first** — they look consistent within a session (self-reads reflect them) but silently revert to the last real commit afterward. Both bodies of work were confirmed gone via the founder's own `git log --all --grep` on their real machine.

Everything described in §2 above for MA-03 Objectives 0-3 was **rebuilt from scratch on 2026-07-08** from detailed recollection, then verified against the founder's own editor before each commit. Objective 4 was newly built in the same session (it was never part of the original lost work).

**Working agreement going forward, confirmed with the founder: commit to git after every major milestone, not just at the end.** Any agent picking up wiki-system or related work should treat this as a hard rule, not a suggestion.

A second, unrelated issue: bash reads of this specific repo (`C:\Users\Hicks\ArchitectOS Pro_beta`, mounted at `/sessions/.../mnt/ArchitectOS Pro_beta/` in this environment) have repeatedly shown stale or truncated file content even when the Read/Edit tools show correct, current content. **Do not trust `py_compile`, `git status`, `cat`, etc. run via bash on this repo for verification.** Use Read/Grep/Glob, and when in doubt, have the founder verify directly on their machine.

## 4. Bugs Found and Fixed During Live Verification (2026-07-08)

All found via founder-supplied Railway Deploy Logs — this agent has no direct log access; the founder pastes logs back on request.

1. **`FileNotFoundError: /config/wiki_schema.json`** — the schema loader's path resolution (`Path(__file__).resolve().parents[2] / "config" / "wiki_schema.json"`) only works in a full monorepo checkout. Railway deploys only the `python-backend/` subtree as `/app`. Fixed with a deploy-local `python-backend/config/wiki_schema.json` copy plus a two-candidate fallback resolver.
2. **502 Bad Gateway on trigger fire** — synchronous multi-page compile requests exceeded Railway/Cloudflare's edge-gateway timeout. Fixed by converting both wiki compile endpoints to `BackgroundTasks` fire-and-forget (see §2). Also caught a real latent gap while fixing this: `main.py` had no `import logging` at all, which would have silently produced a `NameError` masking any real background-task exception.
3. **Uncaught `VectorStoreError` on OpenAI embedding failure killed the entire `compile_event` loop** — one page's embedding failure was aborting all remaining pages in the same event chain. Fixed by wrapping both `embed_query` and `_embed_texts` in try/except, falling back to `page_embedding = None` / `claim["embedding"] = None`.
4. **`replace_compiled_wiki_page` RPC crashed on that `None` embedding** — `postgrest.exceptions.APIError: invalid input syntax for type vector: "null"`. The RPC cast `p_page_embedding`/each claim's embedding straight from `jsonb` to `vector` via `(...::text)::vector`; a JSON `null` scalar casts to the literal text `"null"`, which the `vector` input parser rejects (it requires `[...]` syntax). This was a **latent, pre-existing bug in the RPC itself**, independent of any specific caller — any embedding failure for any reason (quota, outage, bad key) would have hit it eventually. Fixed via migration `fix_replace_compiled_wiki_page_null_embedding`: both the page-level and claim-level embedding assignments now go through a `jsonb_typeof(...) <> 'array'` guard that writes real SQL `NULL` instead of attempting the cast.

## 5. Current Verified State

Live trigger test, 2026-07-08 21:33 UTC: a real `UPDATE` on `cc_synthesis` fired the `clarity_compass_changed` event → `pg_net` POST → `200 {"status":"queued"}` in ~3 seconds (BackgroundTasks working) → background task correctly compiled exactly `business_context` and `growth_constraints` (the two pages mapped to that event) plus the chained `open_questions` → all three wrote cleanly with `stale = false`, real narrative text, `embedding IS NULL`, `synthesis_model = 'mechanical_fallback'`. No crash, no error. **The full auto-trigger pipeline is proven correct end to end.**

## 6. Real-Synthesis Path Verification — Deferred by Founder Decision, Not an Open Defect

**`ANTHROPIC_API_KEY` and `OPENAI_API_KEY` return 401s from the providers themselves in Railway production** (`invalid x-api-key` from Anthropic, `Incorrect API key provided` from OpenAI, confirmed in Railway Deploy Logs at 2026-07-08 21:24 and 21:33 UTC). This means **every live test to date has exercised the mechanical-fallback / null-embedding safety path** — the three pages compiled during live verification (`business_context`, `growth_constraints`, `open_questions`) all wrote `synthesis_model = 'mechanical_fallback'` and `embedding = NULL` to `wiki_pages`, confirmed by direct query. The actual MA-03 deliverable — Sonnet-written narrative with real semantic embeddings — has not yet been observed running in production.

Diagnosis work this session (naming check against `core/config.py`, suffix comparison against the local `.env`) confirmed the correct variable names and correct key values are deployed to Railway; the provider APIs are rejecting the keys themselves, which points to revocation/rotation at the provider (OpenAI Platform / Anthropic Console) rather than a Railway or code configuration problem. Full detail in `.planning/codebase/Concerns.md` under "Secrets and Credential Risk."

**Founder's explicit decision (2026-07-08): do not rotate these in isolation.** All deployment credentials — Anthropic, OpenAI, Supabase, N8N, and any other service key — will be refreshed together in a single pre-launch rotation pass, specifically to avoid reconfiguring keys piecemeal every time one is found stale. This is a deliberate operational choice, not an oversight, and should not be treated as a blocker on MA-03 closure.

**MA-03 is closed on the build/wiring scope it owned.** The real-synthesis path is verified-pending, not broken — it will be confirmed as part of the founder's planned rotation pass, not as follow-up MA-03 work. Whoever executes that rotation pass should re-run the live trigger test (or the smoke script) afterward and confirm `synthesis_model` returns a real Claude model string (not `mechanical_fallback`) and `embedding IS NOT NULL`, but that check belongs to the rotation pass's own verification, not to this initiative.

## 7. Other Open Items (not MA-03-blocking, but should carry forward)

- **MA-01 Gate 1 (LangSmith instrumentation)** was lost in the same incident described in §3 and has not been rebuilt. Founder's explicit sequencing decision: MA-03 first, then MA-01 separately. This is the natural next build after MA-03's verification gap (§6) closes.
- **Secret/key rotation, planned by the founder before beta launch, still pending:** `ARCHITECTOS_INGEST_SECRET` (briefly exposed in an agent transcript), the Vault-stored `wiki_autotrigger_ingest_secret`, and now confirmed-invalid `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`. All logged in `.planning/codebase/Concerns.md` under "Secrets and Credential Risk."
- **This handoff doc replaces the design brief reference** (`.planning/wiki-system/TIER1-SYNTHESIS-UPGRADE-DESIGN-BRIEF.md`) previously cited in `Pro-Suite-Progress.md` — that file was lost in the same incident and was never recreated. The `Pro-Suite-Progress.md` row has been updated to point here instead.
- **Migration mirroring:** none of the wiki-system or MA-03 Supabase migrations are mirrored into `docs/migrations/` as local `.sql` files (unlike Ep1-Ep4 and kb-explorer work, which are mirrored there). They are fully tracked in Supabase's own migration history (`ma03_tier1_synthesis_narrative_and_projection_fix` through `fix_replace_compiled_wiki_page_null_embedding`), so this is a documentation-parity nice-to-have, not a functional gap — flagging in case the project wants consistency across episodes.

## 8. Recommended Next Focus Order

1. **MA-03 is closed.** No further build work required on this initiative.
2. Move to MA-01 Gate 1 rebuild (LangSmith instrumentation, lost in §3's incident) — next per the founder's own MA-03-first-then-MA-01 sequencing decision.
3. Whenever the founder schedules the full pre-launch credential rotation (Anthropic, OpenAI, Supabase, N8N, `ARCHITECTOS_INGEST_SECRET`, Vault `wiki_autotrigger_ingest_secret` — see §7 and `Concerns.md`), re-run the MA-03 live trigger test or smoke script afterward as that pass's own verification step, confirming `synthesis_model` returns a real Claude model string and `embedding IS NOT NULL`. This is not new MA-03 work — it's closing the loop on a deferred verification, owned by the rotation pass.
