---
title: Codebase Concerns Map
created: 2026-06-28
last_mapped_commit: 78f500da675e552dc42501e59e2578d0dce29984
focus: concerns
---

# CONCERNS

## Summary

The codebase is materially built, but beta-readiness risk is concentrated in verification debt: TypeScript errors, feature-gate environment defaults, stale starter docs/config, live-key smoke blockers, hosted ingestion runtime uncertainty, and design-system drift in older UI states. None of these require greenfield rewrites, but they should be addressed before beta-launch finalization.

## Compile and Type Risk

- `ts_errors.log` and `tsc_errors.log` contain known TypeScript errors.
- Product-code errors include `components/ErrorBoundary.tsx`, `components/tools/maturity-audit/dashboard/QuadrantWidget.tsx`, `pages/SprintPlanning/CapabilityContext/CapabilityContextPage.tsx`, and `pages/SprintPlanning/ProgressPage.tsx`.
- Tooling/test-material errors under `temp_superpowers/` may be noise, but current TypeScript scans appear able to include them.
- `types.ts` is empty, increasing the chance that shared status unions and route-level types drift.

## Beta Access and Feature Gate Risk

- `context/AppContext.tsx` bypasses feature gates unless `VITE_BYPASS_FEATURE_GATES` is exactly `'false'`.
- This is a high-signal environment risk for beta launch because a missing env var could unlock surfaces unintentionally.
- Feature definitions are split between static `lib/featureGates.ts` and Supabase tables (`tier_features`, `feature_registry`, `beta_user_access`), so live schema/data must be verified before launch.
- `components/FeatureGate.tsx` locked-state UI still uses Tailwind slate defaults rather than AOS tokens.

## Auth and Protected Route Risk

- Protected routes depend on Supabase session state in `context/AuthContext.tsx`.
- Browser verification without a logged-in session will stop at `/sign-in`, which is expected but must be documented in test reports.
- Signup/profile/beta-access behavior depends on Supabase-side tables and triggers; verify live behavior rather than assuming frontend forms are the issue.

## AI and Provider Boundary Risk

- `package.json` includes the `openai` npm package even though repo instructions mark it as legacy dead code for synthesis.
- `vite.config.ts` still exposes Gemini-style `process.env.GEMINI_API_KEY` defines inherited from earlier setup.
- Python backend uses OpenAI for embeddings and metadata extraction; this is architecturally distinct from synthesis but is still an operational dependency.
- `Pro-Suite-Progress.md` records OpenAI quota as an active blocker for full ingestion/retrieval smoke.

## Ingestion Runtime Risk

- `python-backend/requirements.txt` pins Docling and related parser dependencies, but `Pro-Suite-Progress.md` records local Windows dependency friction.
- Hosted Python/FastAPI runtime for Docling is still a return-pass item.
- Parser fixture smoke for CSV, XLSX, PDF, DOCX, HTML/Markdown should happen in the hosted runtime before beta claims.
- OpenAI and Cohere key readiness still blocks full embedding, metadata, retrieval, and rerank verification.

## Supabase and Data Risk

- Many critical capabilities depend on live Supabase schema, RLS, storage policies, RPCs, and seed data.
- Previous work correctly emphasizes `pg_class.relrowsecurity`; keep using that for RLS checks.
- `raw-documents` and `kb-files` have distinct purposes and must not be collapsed.
- Document upload/delete behavior must preserve user-scoped storage paths and avoid deleting shared duplicate raw files.

## Product Surface Risk

- Execution section is marked partial in repo instructions, especially Reflection Review rollover logic.
- Foundations has a known Clarity Compass dev artifact to remove.
- Status Tracker needs a hide toggle for sensitive initiatives.
- Some large files such as `pages/SnapshotPages.tsx` contain multiple tabs and can be easy to over-edit.
- Domain Agents are scaffolded under `/pro/intelligence/domain-agents`, but should remain founder-facing and not expose internal skills/templates.
- **Virtual CSO canonical Python path is connected but not fully operational (Ep2 live verification, 2026-07-10).** A browser smoke from the logged-in `4ef8...` account reached `https://api.architectospro.com/api/vcso/chat`, created a `vcso_chat_threads` row, persisted user + assistant messages, and stored 9 citation refs. However, the assistant response did not render in real time; the founder had to refresh and log out/back in before seeing the returned assistant message. Treat streaming/realtime UI rendering as unresolved even though backend persistence worked.
- **Virtual CSO source coverage is incomplete for founder strategy questions.** The current CSO answer used available account sources and cited uploaded smoke docs/IP/platform placeholders, but it did not retrieve richer Tier-0 platform records such as Agency Snapshot sections, Growth Velocity/GV calculator results, financial KPI records, sprint/quarter records, or other self-reported tool tables. Financial questions should eventually search/read those structured platform records directly in addition to raw documents and compiled wiki pages, even though the long-term path should also feed them into Tier-1 wiki synthesis.
- **Virtual CSO source display needs product/design follow-up.** Citation refs persisted on the assistant message, but the right-side Sources panel did not populate with useful clickable source entries during the smoke. Future work should define which source kinds are clickable, how platform records versus wiki pages versus raw document chunks render, and how citations are shown inside the thread without exposing internals.

## Fixed This Session

- **`replace_compiled_wiki_page` RPC crashed on any null embedding (fixed 2026-07-08).** The function cast `p_page_embedding`/each claim's embedding straight from `jsonb` to `vector` via `(...::text)::vector`. When the embedding value was a JSON null (not SQL NULL — e.g. from an embedding-provider outage), `::text` produced the literal string `"null"`, which the `vector` type parser rejects (`invalid input syntax for type vector: "null"`, code `22P02`) since it isn't `[...]` syntax. This was a latent bug independent of any specific caller — any future embedding failure for any reason (quota, outage, bad key) would have hit it. Fixed by adding a `jsonb_typeof(...) <> 'array'` guard in the function so a missing/null embedding now writes real SQL NULL to the `vector` column instead of attempting the cast. Confirmed fixed via live trigger retest (`clarity_compass_changed` event, 2026-07-08 21:33 UTC) — `business_context`, `growth_constraints`, and chained `open_questions` all compiled cleanly with `embedding IS NULL` and `synthesis_model = 'mechanical_fallback'`.

## Secrets and Credential Risk

- **Resolved for the MA-03 live synthesis path (2026-07-09): Railway now authenticates to Anthropic and OpenAI for Tier-1 wiki compilation.** The 2026-07-08 live trigger tests failed with Anthropic `401 invalid x-api-key` and OpenAI `401 Incorrect API key provided`, then a 2026-07-09 Railway redeploy still showed Anthropic auth failure through the protected provider smoke endpoint. The fix was to normalize provider key values loaded from env/settings so accidental whitespace or quote wrappers cannot be sent to provider SDK clients. After redeploy, protected `/api/debug/anthropic-smoke` returned `ok = true` for `claude-sonnet-4-6`; all seven Tier-1 wiki pages compiled with `synthesis_model = claude-sonnet-4-6`, non-null embeddings, and `stale = false`; and a live `clarity_compass_changed` trigger queued through `pg_net` recompiled `business_context`, `growth_constraints`, and chained `open_questions` with real Claude synthesis. Keep the separate planned pre-launch secret rotation for broader security hygiene, especially `ARCHITECTOS_INGEST_SECRET` and Vault-stored trigger secrets.
- **`ANTHROPIC_API_KEY` and `OPENAI_API_KEY` full plaintext values exposed in an agent chat transcript (2026-07-08, MA-03 key-diagnosis pass).** While confirming whether Railway's variable naming matched what `core/config.py` expects, the build agent ran a grep across `python-backend/.env` for both key names instead of checking the code's expected variable names only - the grep tool returns full matching lines, so both complete key values were printed into the conversation transcript. This is the same class of mistake as the earlier `ARCHITECTOS_INGEST_SECRET` exposure below, and reinforces the existing rule: never grep, cat, or Read a `.env`/secrets file for a value-comparison check - check variable *names* against the code, or ask the founder to confirm values on their own screen. Folds into the founder's planned full key rotation.
- **`ARCHITECTOS_INGEST_SECRET` exposed in an agent chat transcript (2026-07-08, MA-03 Objective 4).** While verifying the Tier-1 wiki auto-trigger wiring (Supabase `pg_net` DB triggers on 12 tables calling `/api/wiki/compile-event`), the build agent ran `select decrypted_secret from vault.decrypted_secrets where name = 'wiki_autotrigger_ingest_secret'` to check whether the founder had set the Vault secret - the founder had deliberately chosen to set it themselves via the Supabase SQL editor specifically to keep the raw value out of the chat. That query returns the plaintext value rather than just confirming it's set, so the real secret is now present in that conversation's transcript. `ARCHITECTOS_INGEST_SECRET` gates every `dependencies=[Depends(require_ingest_secret)]` route in `python-backend/main.py` (ingestion, retrieval, wiki compile, doc-wiki synthesis, sandbox/artifact verification, structured-query tools, KB tools, agent-runs) - a leaked value doesn't grant Supabase/DB access directly, but does let anyone holding it call those backend routes. Founder has committed to a full key/secret rotation before beta launch, which covers this value; not rotating in isolation since the full pass is already planned. **Before beta launch:** generate a new `ARCHITECTOS_INGEST_SECRET`, update the Python backend's deployment env, redeploy, then update the Vault secret `wiki_autotrigger_ingest_secret` via `vault.update_secret()` to match - and as part of that same rotation pass, sweep for any other secret values that may have been read back (not just set) via `vault.decrypted_secrets` in an agent session. Going forward, Vault secret checks should use existence/placeholder comparisons (e.g. `select (decrypted_secret is not null and decrypted_secret <> 'SET_ME_...') as configured`), never select the raw `decrypted_secret` column.

## Design System Drift

- AOS tokens exist and are imported globally, but older locked/loading states use slate/white defaults.
- `DESIGN-GUIDE-QUICK.md` warns that some variable names are invalid, including `--aos-slate`, `--aos-steel`, `--aos-teal`, `--aos-fog`, and `--status-*`.
- `components/ProtectedRoute.tsx` uses `bg-slate-50` and `border-slate-900`.
- `components/FeatureGate.tsx` uses `rounded-2xl`, slate colors, and white card defaults, which may be visually off-brand.

## Documentation Drift

- `README.md` still describes an AI Studio app and Gemini key setup, not the current ArchitectOS Pro architecture.
- `CLAUDE.md`/`AGENTS.md` are more accurate operational references than `README.md`.
- `Pro-Suite-Progress.md` contains mojibake in some status symbols, though the functional content is readable.

## Local Development Environment Gotchas

**Status as of 2026-07-10: deprioritized by the work-from-live policy.** Keep these notes as historical diagnosis for rare local reproduction, but the default verification path is now `main` auto-deploys to Vercel/Railway, then tests run against the live frontend URL and `https://api.architectospro.com`.

- **Local Python version must match production (3.13), not 3.14.** Production (Railway) runs Python **3.13.14**. A local machine on **Python 3.14** cannot `pip install` some backend deps (e.g. `langsmith` → `zstandard`/`cffi`), because those lack prebuilt 3.14 wheels and fall back to building from source, which requires Microsoft C++ Build Tools. Symptom: `DistutilsPlatformError: Microsoft Visual C++ 14.0 or greater is required`. Fix: use a **Python 3.13 venv** matching production for any founder-run backend smoke, or verify in production instead of locally. (Encountered 2026-07-10 during MA-01 LangSmith verification — the smoke's fail-open helper correctly used unwrapped clients when `langsmith` was absent, so tracing couldn't be verified locally; it was verified in production instead.)
- **`.venv-kb-nav` is an execution-agent sandbox venv, not present on the founder's machine.** Prompts that reference activating it will fail locally; the founder should point at their own 3.13 venv.

## Ep2 Soft-Close — Deferred Items (backend-live-verified, not yet usable)

Ep2 (KB Explorer + wiki-read) is **soft-closed**: backend live-verified and directionally correct on the seeded
account `cd490873-…`, LangSmith production tracing confirmed. "Fully closed" waits on:

- **CSO responses don't render in real time** — the canonical Python CSO persists the turn (thread + user/assistant messages + citations) to the DB, but the assistant response only appears after refresh/relogin. Streaming/SSE UI rendering is unresolved. **→ §8** (priority, since real-time response is central UX).
- **Sources panel / citation UX not product-ready** — citations persist and are citation-shaped (`wiki_page`), but clickable/useful source rendering in the panel is pending. **→ §8.**
- **CSO retrieval does not reach Tier-0 platform records** — it reaches Tier-1 (synthesized wiki) + docs/IP, but not the base structured records directly (Agency Snapshot, GV calculator, financial KPIs, sprint, quarter). Needed for founder strategy questions grounded in exact records. **→ connection-phase scope item** (decide MVP-vs-v1 after the remaining episodes).
- **Split test accounts** — UI uploads land under the founder's real `4ef8…` account (auth requires `storage_path` to start with the logged-in user id), while the seeded Tier-1 data lives under `cd490873…` (`hicks.london25@gmail.com`), for which we have no login. Being resolved by the forgot-password feature so the seeded account can be used for all UI tests. Also: two smoke docs/chunks to clean up from `4ef8…`.

## Systemic Code-Quality Flags (Ep4 carry-forwards, 2026-07-11)

Surfaced repeatedly during live verification; codebase-wide, not Ep4-specific. Address in a cleanup/§8 pass or incidentally:

- **Uniqueness-assumption mismatches.** App-level user-scoped checks against **globally-unique** DB columns (and vice versa) have recurred (the MRA/`agent_capabilities` collision; the Ep4 Skills `last_updated`→`updated_at` alias). Audit for app uniqueness assumptions that don't match the actual DB constraints.
- **Error-swallowing around Supabase/PostgREST/Storage.** `error instanceof Error ? error.message` on those plain-object errors loses the real diagnostic (related to the earlier "Failed to fetch" panel-blanking). Grep for that pattern and preserve the underlying error detail.
- **Structured backend errors.** Fold the actionable text into `detail` unless the frontend error parser is broadened — otherwise the useful message is dropped before the UI sees it.

## Deferred / Likely-Retire (product decisions)

- **Tier-1 input sources & update governance — dedicated design pass (2026-07-11).** Tier-1 foundational pages
  should be feedable by **documents + MCP data**, not just the fixed platform tables, per the architecture
  ("OS Engine generates/updates Tier-1 from both the documents and platform interactions"). Current impl is
  narrower (fixed `SOURCE_TABLES_BY_PAGE` only), so a document upload doesn't recompile Tier-1 *today* — an
  implementation state, not a design boundary. Needs its own working session for the rules/timing of Tier-1
  updates/resynthesis. Full note: `.planning/wiki-system/TIER1-SYNTHESIS-UPGRADE-DESIGN-BRIEF.md` → §8 Future
  Work. **Not in scope for Ep4–Ep7.**
- **Guided Skill Creator — likely retire for MVP** (founder decision, 2026-07-11). Not verified in Ep4 by design (the guided-draft direct-Anthropic path is left alone). Revisit in the §8 UI pass: keep or retire. Skill **import/export + CRUD + `@slug`** are the verified, kept paths.

## Launch Readiness Concerns

- Resolve or explicitly scope TypeScript errors before beta finalization.
- Confirm feature-gate env configuration in the actual Vercel environment.
- Verify live Supabase access, RLS, migrations, and seed data for founder-only beta behavior.
- Run hosted ingestion/parser smoke and OpenAI/Cohere return passes.
- Verify N8N webhook URLs and PDF/workflow endpoints from the deployed environment.
- Confirm Supabase Auth Site URL and Redirect URLs point at the live frontend domain, including `/reset-password`, before starting the forgot-password feature.
- Keep future work section-by-section and avoid broad rewrites of already-built product surfaces.
- Rotate exposed or transcript-touched secrets before go-live, especially `ARCHITECTOS_INGEST_SECRET` and the Vault-stored `wiki_autotrigger_ingest_secret`. `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are no longer blocked for MA-03 production synthesis as of 2026-07-09, but should still be included in any full hygiene rotation if the founder chooses a complete pre-launch sweep.
