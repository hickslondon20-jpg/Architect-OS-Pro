---
title: Codebase Structure Map
created: 2026-06-28
last_mapped_commit: 78f500da675e552dc42501e59e2578d0dce29984
focus: arch
---

# STRUCTURE

## Repository Root

- `App.tsx` is the root route tree.
- `index.tsx` is the React entry point and global style importer.
- `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, and `vite.local.mjs` define the frontend runtime.
- `AGENTS.md` and `CLAUDE.md` contain repo-specific agent instructions.
- `DESIGN-GUIDE-QUICK.md` is the local design-system reference.
- `Pro-Suite-Progress.md` is the ground-truth progress manifest for intelligence-layer work.
- `UI-PROGRESS.md` tracks UI/design pass history.
- `ts_errors.log`, `tsc_errors.log`, and `tsc-output.txt` preserve TypeScript error evidence.

## Main Product Directories

- `components/` contains shared UI shell components, route-support components, and feature component folders.
- `pages/` contains route-level page modules.
- `lib/` contains Supabase API helpers, calculations, mock data, and domain engines.
- `context/` contains React providers and product context/spec files.
- `hooks/` contains shared hooks such as `hooks/useSprintState.ts`.
- `style/` contains global CSS tokens and shared component styles.
- `config/` contains static configuration such as `config/ae-ladder-content.ts`.

## Backend and API Directories

- `api/vcso/` contains Vercel serverless handlers for Virtual CSO streaming and N8N writeback.
- `python-backend/` contains the FastAPI ingestion/retrieval backend.
- `python-backend/core/` contains backend settings.
- `python-backend/services/` contains document parsing, vector storage, retrieval, reranking, metadata extraction, structured data/query, web search, agent context, capabilities, and orchestration services.
- `docs/migrations/` contains Supabase SQL migration artifacts.
- `docs/migrations/pending/` contains migrations requiring explicit founder confirmation or follow-up.

## Product Page Structure

- `pages/PublicPages.tsx` contains landing/sign-in/sign-up surfaces.
- `pages/DashboardPage.tsx` contains the authenticated dashboard.
- `pages/Foundations/` contains Foundations layout and landing modules.
- `pages/Diagnostics/` contains Diagnostics layout and landing modules.
- `pages/SnapshotPages.tsx` contains multiple Agency Snapshot tab components in one large file.
- `pages/ClarityPages.tsx`, `pages/GVCalculatorPage.tsx`, `pages/ArchitectEvolutionPages.tsx`, and `pages/ToolsPages.tsx` hold major feature route modules.
- `pages/ProSuite/` contains Pro Suite routes, including planning, execution, intelligence, OS Engine, Virtual CSO, and Domain Agents.
- `pages/SprintPlanning/` contains Sprint Planning nested flows and pages.

## Component Structure

- `components/Layouts.tsx`, `components/Sidebar.tsx`, and `components/Header.tsx` define shell navigation.
- `components/FeatureGate.tsx` and `components/ProtectedRoute.tsx` enforce access states.
- `components/pro-suite/` contains Pro Suite shared and feature-specific UI.
- `components/pro-suite/os-engine/` contains OS Engine UI primitives and views.
- `components/pro-suite/virtual-cso/` contains chat UI pieces.
- `components/pro-suite/domain-agents/` contains Domain Agents primitives.
- `components/tools/` contains Maturity Audit, AE Ladder, and Growth Velocity tool components.
- `components/SprintPlanning/` contains Sprint Planning board, modal, initiative, progress, and synthesis components.

## Documentation and Planning Structure

- `docs/plans/ep1-agentic-rag-masterclass/` contains Episode 1 intelligence-layer plans.
- `docs/plans/ep2-knowledgebase-video/` through `docs/plans/ep7-citations/` contain future episode planning artifacts.
- `docs/handoffs/` contains handoff prompts and task specs for prior UI/backend passes.
- `context/` subfolders contain product specs for agency snapshot, sprint planning, MRA, GV simulator, Clarity Compass, and Pro Suite.
- `knowledgebase/` contains static knowledge base files for MRA, AE Ladder, KPIs, and Growth Velocity insights.

## Output and Test Artifacts

- `outputs/` contains generated screenshots and insertion/chunking reports.
- `outputs/playwright/` contains Playwright verification screenshots.
- `dist/` is present as a build output directory.
- `node_modules/` is present and should be excluded from codebase scans.
- `temp_superpowers/` appears to be imported tool/test material and should be excluded from product TypeScript/build analysis unless explicitly being maintained.

## Naming Conventions Seen

- Route/page components generally use PascalCase filenames, for example `SprintGoalFlowPage.tsx`.
- Feature folders use domain names, for example `components/pro-suite/os-engine/`.
- Some paths vary by casing: `pages/ProSuite/` and `pages/pro-suite/quarter-map/` both exist.
- Supabase migrations use numeric prefixes for intelligence-layer work, for example `007_hybrid_search_reranking.sql`.
- Handoff docs use numbered prefixes and descriptive slugs, for example `docs/handoffs/32-da-versioning-rework-task-spec.md`.

## Files To Check First For Future Work

- Routing or feature visibility: `App.tsx`, `lib/featureGates.ts`, `context/AppContext.tsx`.
- Auth/protected behavior: `context/AuthContext.tsx`, `components/ProtectedRoute.tsx`, `pages/PublicPages.tsx`.
- Supabase browser patterns: `lib/supabaseClient.ts`, feature-specific `lib/*Api.ts` files.
- Intelligence ingestion: `Pro-Suite-Progress.md`, `docs/intelligence-layer-storage-architecture.md`, `python-backend/main.py`.
- Design alignment: `DESIGN-GUIDE-QUICK.md`, `style/colors_and_type.css`, `style/components.css`.
