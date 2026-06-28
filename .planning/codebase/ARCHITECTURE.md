---
title: Codebase Architecture Map
created: 2026-06-28
last_mapped_commit: 78f500da675e552dc42501e59e2578d0dce29984
focus: arch
---

# ARCHITECTURE

## Summary

ArchitectOS Pro is a route-heavy SPA organized by product sections: public auth, dashboard, Foundations, Diagnostics, Pro Suite, Sprint Planning, Execution, Intelligence, Resources, and Settings. The architecture is intentionally brownfield and additive: React page/component modules own the UI, Supabase owns persistent state, Vercel handles the one real-time streaming exception, and Python/FastAPI handles document ingestion and retrieval.

## Application Entry Flow

- `index.tsx` mounts React into `#root`, wraps the app in `React.StrictMode`, and applies a top-level `ErrorBoundary`.
- `App.tsx` wraps everything in `AuthProvider`, `AppProvider`, `ErrorBoundary`, and `HashRouter`.
- Public routes are `/`, `/sign-in`, and `/sign-up`.
- Authenticated routes are nested under `<ProtectedRoute />` and `<DashboardLayout />`.
- `DashboardLayout` in `components/Layouts.tsx` owns the sidebar/header/content shell.

## Route Architecture

- Foundations routes are nested under `/foundations` and include Agency Snapshot, Clarity Compass, GV Simulator, and Architect Evolution.
- Diagnostics routes are nested under `/diagnostics` and include AE Ladder and M&R Audit.
- Pro Suite routes are nested under `/pro` and branch into Planning, Execution, and Intelligence.
- Sprint Planning routes live under `/pro/planning/sprint-planning`.
- Intelligence routes live under `/pro/intelligence` and include Virtual CSO, OS Engine, and Domain Agents.
- Legacy redirects in `App.tsx` preserve old paths such as `/pro/virtual-cso` and `/pro/os-engine`.

## State Providers

- `context/AuthContext.tsx` owns Supabase session/user state and sign-out.
- `context/AppContext.tsx` owns beta access, tier, feature unlock state, and sidebar UI state.
- Several feature areas use local component state rather than global stores, which fits the brownfield SPA pattern.
- Sprint Planning has route-local state utilities such as `hooks/useSprintState.ts`.

## Data Access Pattern

- Shared Supabase browser client is exported from `lib/supabaseClient.ts`.
- Feature modules call Supabase directly from frontend helper files, for example `lib/virtualCsoApi.ts` and `lib/osEngineApi.ts`.
- User ID/session checks are usually local helper functions inside API wrappers, for example `requireUserId()` and `requireAccessToken()` in `lib/virtualCsoApi.ts`.
- Vercel handlers create either user-scoped Supabase clients from the bearer JWT or service-role clients for server-only IP/context reads.
- Python backend uses service-role Supabase through `python-backend/services/vector_store.py`.

## Feature Gate Architecture

- Static feature definitions live in `lib/featureGates.ts`.
- Runtime unlock decisions live in `context/AppContext.tsx`.
- `FeatureGate` in `components/FeatureGate.tsx` controls locked versus unlocked rendering.
- `App.tsx` wraps many route elements with a `gated(featureKey, element)` helper.
- Feature gates are founder-only and week-based; no team-member account architecture is present in the mapped flow.

## Intelligence Layer Architecture

- OS Engine upload UI appears in `components/pro-suite/os-engine/views/UploadsView.tsx`.
- Storage split is documented in `docs/intelligence-layer-storage-architecture.md`: raw intake in `raw-documents`, synthesized artifacts in `kb-files`.
- Python ingestion flow in `python-backend/main.py` validates user-scoped storage paths, detects duplicates, downloads raw files, parses with Docling/plain-text/CSV logic, extracts metadata, embeds chunks, and marks registry rows complete/failed.
- Retrieval uses a hybrid RRF Supabase RPC and optional reranking through `python-backend/services/retrieval.py`.
- Structured dataset and bounded sub-agent scaffolds are present in `python-backend/services/structured_data.py`, `structured_query.py`, `agent_context.py`, `agent_capabilities.py`, and `sub_agent_orchestrator.py`.

## Virtual CSO Architecture

- `pages/ProSuite/virtual-cso/VirtualCSOWorkspace.tsx` renders the workspace surface.
- `components/pro-suite/virtual-cso/*` contains chat UI primitives.
- `lib/virtualCsoApi.ts` loads projects/chats/messages from Supabase and streams turns from `/api/vcso/chat`.
- `api/vcso/chat.ts` is the streaming exception to the normal N8N synthesis rule. It assembles context server-side and streams Anthropic responses token-by-token to the browser.
- `api/vcso/writeback.ts` bridges chat writeback into an N8N workflow.

## Design Architecture

- Global CSS token files are imported once from `index.tsx`.
- Shared UI primitives live in `components/ui.tsx`.
- Product shells live in `components/Layouts.tsx`, `components/Sidebar.tsx`, and `components/Header.tsx`.
- Many feature components use AOS CSS variables inline or in class names; some older components still contain Tailwind default colors.
- The design system is not a separate package; it is local CSS plus conventions documented in `DESIGN-GUIDE-QUICK.md`.

## Brownfield Architecture Notes

- The app still has root-level source directories (`components`, `pages`, `lib`, `context`) rather than a conventional `src/` directory.
- `types.ts` exists but is empty, so shared types are currently distributed across feature-local files.
- `README.md` still reflects an AI Studio/Gemini starter rather than the current ArchitectOS architecture.
- `temp_superpowers/` is present in the repo tree and can affect broad TypeScript scans if not excluded.
