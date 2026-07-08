---
title: Codebase Concerns Map
created: 2026-06-28
last_mapped_commit: 78f500da675e552dc42501e59e2578d0dce29984
focus: concerns
---

# CONCERNS

## Summary

The codebase is materially built, but beta-readiness risk is concentrated in verification debt: TypeScript errors, feature-gate environment defaults, stale starter docs/config, live-key smoke blockers, hosted ingestion runtime uncertainty, and design-system drift in older UI states. None of these require greenfield rewrites, but they should be addressed before beta-launch finalization.

## Verified Live Bugs (blocking — route to a core-platform dev pass before go-live)

- **GVS "save scenario" is broken for every user (verified live 2026-07-08).** `check_gvs_save_limit()` (trigger `enforce_gvs_save_limit`, `BEFORE INSERT` on `gvs_saved_growth_scenarios`) joins `subscription_tiers t on t.id = p.tier_id`, but `subscription_tiers.id` is `uuid` and `profiles.tier_id` is `text` → every insert throws `operator does not exist: uuid = text`. It also matches `profiles.id` instead of `profiles.user_id`. The join runs on every insert regardless of tier, so **no founder can save a Growth Velocity Simulator scenario in production right now.** Surfaced during Tier-1 wiki source-table seeding (the trigger was disabled for one transaction and re-enabled — no permanent change). Fix, verified against live column types: join `on t.code = p.tier_id` and match `where p.user_id = new.user_id`. **Out of scope for the intelligence-layer arc** — flagged here for a core-platform fix pass. Detail: seed report `seed-report-test-user-2026-07-08.md`; verified function definition + column types via Supabase MCP.

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

## Secrets and Credential Risk

- **`ARCHITECTOS_INGEST_SECRET` exposed in an agent chat transcript (2026-07-08, MA-03 Objective 4).** While verifying the Tier-1 wiki auto-trigger wiring (Supabase `pg_net` DB triggers on 12 tables calling `/api/wiki/compile-event`), the build agent ran `select decrypted_secret from vault.decrypted_secrets where name = 'wiki_autotrigger_ingest_secret'` to check whether the founder had set the Vault secret — the founder had deliberately chosen to set it themselves via the Supabase SQL editor specifically to keep the raw value out of the chat. That query returns the plaintext value rather than just confirming it's set, so the real secret is now present in that conversation's transcript. `ARCHITECTOS_INGEST_SECRET` gates every `dependencies=[Depends(require_ingest_secret)]` route in `python-backend/main.py` (ingestion, retrieval, wiki compile, doc-wiki synthesis, sandbox/artifact verification, structured-query tools, KB tools, agent-runs) — a leaked value doesn't grant Supabase/DB access directly, but does let anyone holding it call those backend routes. Founder has committed to a full key/secret rotation before beta launch, which covers this value; not rotating in isolation since the full pass is already planned. **Before beta launch:** generate a new `ARCHITECTOS_INGEST_SECRET`, update the Python backend's deployment env, redeploy, then update the Vault secret `wiki_autotrigger_ingest_secret` via `vault.update_secret()` to match — and as part of that same rotation pass, sweep for any other secret values that may have been read back (not just set) via `vault.decrypted_secrets` in an agent session. Going forward, Vault secret checks should use existence/placeholder comparisons (e.g. `select (decrypted_secret is not null and decrypted_secret <> 'SET_ME_...') as configured`), never select the raw `decrypted_secret` column.

## Design System Drift

- AOS tokens exist and are imported globally, but older locked/loading states use slate/white defaults.
- `DESIGN-GUIDE-QUICK.md` warns that some variable names are invalid, including `--aos-slate`, `--aos-steel`, `--aos-teal`, `--aos-fog`, and `--status-*`.
- `components/ProtectedRoute.tsx` uses `bg-slate-50` and `border-slate-900`.
- `components/FeatureGate.tsx` uses `rounded-2xl`, slate colors, and white card defaults, which may be visually off-brand.

## Documentation Drift

- `README.md` still describes an AI Studio app and Gemini key setup, not the current ArchitectOS Pro architecture.
- `CLAUDE.md`/`AGENTS.md` are more accurate operational references than `README.md`.
- `Pro-Suite-Progress.md` contains mojibake in some status symbols, though the functional content is readable.

## Launch Readiness Concerns

- Resolve or explicitly scope TypeScript errors before beta finalization.
- Confirm feature-gate env configuration in the actual Vercel environment.
- Verify live Supabase access, RLS, migrations, and seed data for founder-only beta behavior.
- Run hosted ingestion/parser smoke and OpenAI/Cohere return passes.
- Verify N8N webhook URLs and PDF/workflow endpoints from the deployed environment.
- Keep future work section-by-section and avoid broad rewrites of already-built product surfaces.
- Rotate all API keys/secrets before go-live, including `ARCHITECTOS_INGEST_SECRET` (see Secrets and Credential Risk above) and the Vault-stored `wiki_autotrigger_ingest_secret`.
