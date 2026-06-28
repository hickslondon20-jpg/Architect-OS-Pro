---
title: Codebase Testing Map
created: 2026-06-28
last_mapped_commit: 78f500da675e552dc42501e59e2578d0dce29984
focus: quality
---

# TESTING

## Summary

Testing is present but uneven. The repo has Vitest installed and unit tests for selected calculation utilities, Python compile checks have been used for ingestion work, and visual/browser screenshots exist from prior verification passes. There is no broad automated E2E test suite visible in the mapped codebase, and current TypeScript error logs show known compile issues that should be resolved before beta finalization.

## Frontend Unit Tests

- Test framework: Vitest, configured as a dependency in `package.json`.
- Growth Velocity engine tests live in `lib/growthVelocityEngine.test.ts`.
- Preset scenario tests live in `lib/presetScenarios.test.ts`.
- Formatting tests live in `lib/formatUtils.test.ts`.
- Tests use direct `describe`, `it`, and `expect` imports from `vitest`.
- Existing tests are domain-calculation focused rather than route/UI integration focused.

## Frontend Build and Type Checks

- Build command is `npm.cmd run build`.
- Vite build uses `vite.local.mjs`.
- TypeScript config sets `noEmit: true`, so type checking can run without output.
- `ts_errors.log`, `tsc_errors.log`, and `tsc-output.txt` preserve current compiler-error evidence.
- Known errors include `components/ErrorBoundary.tsx`, `components/tools/maturity-audit/dashboard/QuadrantWidget.tsx`, `pages/SprintPlanning/CapabilityContext/CapabilityContextPage.tsx`, `pages/SprintPlanning/ProgressPage.tsx`, and `temp_superpowers/skills/systematic-debugging/condition-based-waiting-example.ts`.

## Python Verification

- Python backend syntax verification is commonly done with `python -m compileall python-backend`.
- Prior progress entries note compileall passes for intelligence modules M3 through M8.
- Because local Windows Docling installation has known friction, parser fixture smoke is explicitly deferred to the hosted Python/FastAPI runtime.
- Current backend tests are not visible as a formal pytest suite in the mapped files.

## Live Supabase Verification

- Prior work in `Pro-Suite-Progress.md` records live schema application and smoke checks for migrations `004` through `009`.
- Verification has included RLS checks via `pg_class.relrowsecurity`, storage bucket separation, retrieval RPC signatures, metadata filters, synthetic dataset rows, structured query rejection, and sub-agent run isolation.
- Full upload-to-embedding-to-retrieval smoke remains blocked by OpenAI quota/key readiness.
- Cohere rerank live smoke remains pending until a Cohere key is configured.

## Browser and Visual Verification

- Screenshot artifacts exist under `outputs/`, including `outputs/sprint-goal-single-page.png` and `outputs/sprint-goal-route-check.png`.
- Playwright screenshot evidence exists under `outputs/playwright/`, including execution hub and orient/reflect surfaces.
- Protected-route browser checks may honestly stop at `/sign-in` when no logged-in browser session is available.
- Visual verification should account for the app’s hash routing and protected route behavior.

## Manual/Scripted Utility Checks

- `scripts/validate-gvi.ts` suggests targeted Growth Velocity validation exists.
- `verify-revenue-model.js` and `verify-revenue-model.cjs` are snapshot/versioning verification scripts.
- `test-schema.js` and `extract_schema.py` appear to support schema probing or validation.
- `capture-logs.mjs` is available for runtime log capture.

## Test Gaps

- No broad route smoke suite was identified for `App.tsx`.
- No automated Supabase integration test harness was identified in the frontend.
- No formal pytest suite was identified for `python-backend/`.
- No committed Playwright test files were identified; visual artifacts are present, but the test harness itself is not obvious.
- TypeScript errors are known and should be treated as beta-launch blockers until triaged or excluded intentionally.

## Recommended Verification Order

- First run a scoped TypeScript/build pass and resolve product-code errors while excluding generated/tooling folders such as `temp_superpowers/` where appropriate.
- Run Vitest for utility coverage after dependency health is confirmed.
- Run `python -m compileall python-backend` after backend edits.
- Smoke protected app routes in a logged-in browser session or document `/sign-in` as the expected stop.
- Verify Supabase migrations and RLS live before claiming schema-dependent features are complete.
- Return to hosted Docling, OpenAI quota, Cohere rerank, and end-to-end ingestion/retrieval smoke before declaring the intelligence layer beta-ready.
