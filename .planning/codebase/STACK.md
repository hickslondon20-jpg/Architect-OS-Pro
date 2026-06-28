---
title: Codebase Stack Map
created: 2026-06-28
last_mapped_commit: 78f500da675e552dc42501e59e2578d0dce29984
focus: tech
---

# STACK

## Summary

ArchitectOS Pro is a brownfield React/Vite single-page app with a Supabase-backed product data layer, Vercel serverless endpoints for the Virtual CSO streaming path, and a separate Python/FastAPI ingestion backend for OS Engine document processing. The repository is the live app checkout at `C:\Users\Hicks\ArchitectOS Pro_beta`, with Git root `C:/Users/Hicks/ArchitectOS Pro_beta` and remote `https://github.com/hickslondon20-jpg/Architect-OS-Pro.git`.

## Frontend Runtime

- App framework: React 19 (`react`, `react-dom`) with TypeScript and Vite 6, configured in `package.json`, `vite.config.ts`, and `vite.local.mjs`.
- Routing: `react-router-dom` v7 with `HashRouter` in `App.tsx`.
- Entry point: `index.tsx` mounts `<App />` and imports global styles from `style/colors_and_type.css` and `style/components.css`.
- UI libraries: `lucide-react` for icons and `recharts` for charts.
- Markdown rendering: `react-markdown`, used for reader/wiki style surfaces.
- TypeScript config: `tsconfig.json` uses `moduleResolution: "bundler"`, `jsx: "react-jsx"`, `allowJs: true`, `isolatedModules: true`, `noEmit: true`, and alias `@/* -> ./*`.

## Frontend Commands

- `npm.cmd run dev` runs Vite using `vite.local.mjs` on `127.0.0.1:5180`.
- `npm.cmd run build` runs `vite build --config vite.local.mjs --configLoader runner`.
- `npm.cmd run preview` serves the built app on `127.0.0.1:4173`.
- On this Windows setup, prefer `npm.cmd run ...` over plain `npm run ...` when PowerShell execution policy interferes.

## Backend Runtime

- Main backend: Supabase, accessed from frontend via `lib/supabaseClient.ts`.
- Serverless API: Vercel-style handlers live in `api/vcso/chat.ts` and `api/vcso/writeback.ts`.
- Ingestion backend: Python FastAPI app in `python-backend/main.py`, with config in `python-backend/core/config.py`.
- Python dependencies are pinned in `python-backend/requirements.txt`: FastAPI, Uvicorn, Supabase Python client, Docling, OpenAI, tiktoken, LangChain text splitters, LangSmith, and pydantic-settings.
- Python syntax verification pattern used by prior work: `python -m compileall python-backend`.

## Data and AI Dependencies

- Supabase JS client: `@supabase/supabase-js` v2.93.3 in `package.json`.
- Supabase Python client: `supabase==2.16.0` in `python-backend/requirements.txt`.
- Embeddings: OpenAI `text-embedding-3-small`, configured in `python-backend/core/config.py` and used by `python-backend/services/vector_store.py`.
- Metadata extraction: OpenAI chat completions, default `gpt-4o-mini`, in `python-backend/services/metadata_extractor.py`.
- Reranking: optional Cohere rerank config in `python-backend/core/config.py` and retrieval flow in `python-backend/services/retrieval.py`.
- Synthesis/chat: Virtual CSO streaming uses Anthropic/Claude through `api/vcso/chat.ts`; batch/scheduled synthesis is documented as N8N-routed.

## Design Stack

- Global design tokens live in `style/colors_and_type.css`.
- Shared component styles live in `style/components.css`.
- Design rules are summarized in `DESIGN-GUIDE-QUICK.md`.
- Primary font family is Geist; Geist Mono is used for metric/data values; Instrument Serif is reserved for editorial moments.
- AOS tokens include `--aos-obsidian`, `--aos-brass`, `--aos-parchment`, `--aos-cloud`, and `--aos-graphite`.

## Test and Verification Stack

- Vitest is installed (`vitest` v4.0.18).
- Existing tests are concentrated in utility/domain logic files such as `lib/growthVelocityEngine.test.ts`, `lib/presetScenarios.test.ts`, and `lib/formatUtils.test.ts`.
- Current repo contains TypeScript error snapshots in `ts_errors.log`, `tsc_errors.log`, and `tsc-output.txt`.
- Browser/visual evidence screenshots exist under `outputs/` and `outputs/playwright/`.

## Notable Stack Mismatch

- `package.json` still includes the `openai` npm package, but the repo instructions mark this as legacy dead code for frontend synthesis. The current scan did not need to edit it.
- Python ingestion intentionally uses the Python `openai` package for embeddings and metadata extraction. That is separate from the “no direct client-side OpenAI synthesis” rule and should be treated as ingestion infrastructure, not user-facing chat synthesis.
