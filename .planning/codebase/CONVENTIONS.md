---
title: Codebase Conventions Map
created: 2026-06-28
last_mapped_commit: 78f500da675e552dc42501e59e2578d0dce29984
focus: quality
---

# CONVENTIONS

## Summary

The codebase is a pragmatic brownfield SPA with feature-local types, route-local state, direct Supabase helpers, and a token-driven design system. Conventions are present but uneven: newer work tends to use AOS CSS variables and scoped helper APIs, while older/starter surfaces still show Tailwind slate defaults, AI Studio/Gemini remnants, and broad page files.

## React and TypeScript Style

- Components are mostly functional React components with explicit `React.FC` in many files, for example `components/FeatureGate.tsx`.
- Route modules often export multiple named components from one file, for example `pages/SnapshotPages.tsx` and `pages/ToolsPages.tsx`.
- Feature-local types are common, for example `components/pro-suite/quarter-map/types.ts`, `pages/ProSuite/domain-agents/types.ts`, and `components/tools/ae-ladder/types.ts`.
- Global `types.ts` exists but is empty, so shared typing is not centralized.
- TypeScript strictness is limited by config choices such as `allowJs: true`, `skipLibCheck: true`, and no explicit `"strict": true` in `tsconfig.json`.

## Routing Conventions

- `App.tsx` is the single source of route registration.
- Routes are nested by product section and frequently wrap the route element in `gated(featureKey, element)`.
- Legacy redirects are implemented with `<Navigate ... replace />`.
- Section-level tab shells use `SectionLayout` from `components/Layouts.tsx`.
- Protected app access is enforced by nesting authenticated routes under `components/ProtectedRoute.tsx`.

## Supabase Conventions

- Browser code imports the shared `supabase` client from `lib/supabaseClient.ts`.
- API helpers commonly define `toX(row)` mapping functions, as seen in `lib/virtualCsoApi.ts`.
- User-scoped writes usually obtain the current user first through `supabase.auth.getUser()` or a bearer token.
- Serverless handlers validate the bearer token, create user-scoped clients, and only use service-role clients for server-side-only reads.
- Python backend always scopes document and chunk operations by `user_id`.

## Access and Feature Gate Conventions

- Static feature definitions live in `lib/featureGates.ts`.
- UI gates use `FeatureGate` and locked-state components.
- App runtime access loads tier and beta cohort data from Supabase in `context/AppContext.tsx`.
- The beta is founder-only in current app shape; team-member flows should not be added unless requirements change.
- `VITE_BYPASS_FEATURE_GATES` controls whether gates are enforced, with current logic bypassing unless the value is exactly `'false'`.

## Design Conventions

- Use AOS CSS variables from `style/colors_and_type.css`.
- Design guidance is codified in `DESIGN-GUIDE-QUICK.md`.
- Newer components use classes such as `aos-h1`, `aos-mono`, `aos-eyebrow`, and token colors like `var(--fg-1)`.
- Lucide icons are the default icon source.
- Card-like surfaces generally use `var(--bg-surface)`, `var(--border-hairline)`, and `var(--shadow-soft-1)`.
- Known drift: some components still use Tailwind defaults like `bg-slate-50`, `text-slate-900`, and `border-slate-200`, for example `components/ProtectedRoute.tsx` and `components/FeatureGate.tsx`.

## Backend Conventions

- Python service code uses dataclasses for internal result types and Pydantic models for FastAPI payloads.
- Backend configuration is centralized in `python-backend/core/config.py` with environment aliases and defaults.
- Errors from backend service wrappers use domain-specific exceptions such as `VectorStoreError`, `StructuredQueryError`, and `SubAgentError`.
- Structured query execution is fail-closed: only approved SELECT shapes, surfaces, columns, equality filters, and limits are allowed.
- Ingestion status updates are explicit and granular: processing, parser processing/complete/failed/skipped, metadata processing/complete/failed, ingested, failed.

## Documentation Conventions

- Intelligence-layer progress and return-pass state is tracked in `Pro-Suite-Progress.md`.
- Plans live under `docs/plans/`, often grouped by episode.
- Supabase SQL artifacts live under `docs/migrations/`.
- Handoff prompts and task specs live under `docs/handoffs/`.
- Architecture decisions should be reflected in progress docs before execution agents assume completion.

## Error Handling Patterns

- Frontend API wrappers throw `Error` with user-readable messages when Supabase or fetch calls fail.
- Serverless handlers return JSON errors for non-streaming failures and SSE `error` events for streaming failures.
- Python ingestion catches background-task failures and attempts to mark both parser and document status as failed.
- Protected routes show loading states while auth is resolving, then redirect unauthenticated users to `/sign-in`.

## Practical Guidance For Future GSD Work

- Verify the real route, live Supabase shape, and runtime behavior before changing features.
- Preserve `raw-documents` versus `kb-files` storage responsibilities.
- Keep N8N synthesis and PDF patterns intact except for the documented Virtual CSO streaming endpoint.
- Avoid broad refactors of large shared files during verification or design-only passes.
- Exclude `node_modules/`, `dist/`, and `temp_superpowers/` from product scans unless the task explicitly targets them.
