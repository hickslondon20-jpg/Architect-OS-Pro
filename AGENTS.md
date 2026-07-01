# ArchitectOS Pro — Codex Instructions

> Auto-read by Codex at session start. Do not delete.

---

## Platform Overview

**ArchitectOS Pro** is a React 19 + Vite 6 + TypeScript SPA for marketing agency founders. It is a strategic operating system — diagnostics, planning, and execution tools in one platform.

**Status:** Substantially built. Pre-beta work is verify / wire / test / design — NOT greenfield development. Assume features exist until confirmed otherwise.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, TypeScript |
| Backend / DB | Supabase (PostgreSQL, Auth, Storage, Vector Stores) |
| AI Synthesis | Codex Sonnet  |
| PDF Generation | N8N + Google Docs merge field templates → Supabase Storage |
| Hosting | Vercel (frontend), Supabase (backend) |

---

## Critical Architecture Rules

### 1. AI synthesis routes through N8N — with one documented exception
All **synthesis / batch / scheduled** Codex AI calls go through N8N webhook workflows — never direct client-side Anthropic API calls, never Supabase Edge Functions for AI.

**Exception (decided 2026-06-12, Pro Suite build):** the **Virtual CSO interactive chat** path runs in a **Vercel serverless function** — context assembly (§6.4) + token-by-token streaming from Codex to the browser. n8n cannot stream tokens cleanly, so the real-time chat endpoint is the one place a Codex call lives outside n8n. The API key stays server-side in the function env (users never call Anthropic directly). All other synthesis (WF-PS-01..04) remains in n8n. Supabase Edge Functions are still NOT used for AI.

### 2. openai package is dead code — remove it
The `openai` npm package is a legacy remnant. All synthesis has migrated to Codex via N8N. Remove the package and any import that references it.

### 3. MRA checkpoint content is in Supabase — not a config file
125 checkpoints × 5 AE Ladder stages = 500 stage-calibrated definitions live in the `mra_checkpoints` table (or similar) in Supabase. Do not create a config file for this content. Verify the table, don't recreate it.

### 4. PDF exports use the established pattern
MRA Report and AE Ladder Report PDF downloads are already built via N8N + Google Docs merge fields. Sprint Launch Document PDF must be built using this same pattern — not a frontend PDF library (no jspdf, no react-to-pdf).

### 5. Beta is founder-only
No team member accounts exist in beta. Do not build or wire team access flows. Access is controlled via `beta_cohort_week` field and `beta_feature_gates` table in Supabase.

### 6. Execution hierarchy: Capability → Initiative → Milestone
The Status Tracker and Pro Suite operate on this hierarchy only. No task-level tracking (tasks live in ClickUp/Asana). The hierarchy stops at Milestone.

---

## Design System — Non-Negotiables

Full spec: `DESIGN-GUIDE-QUICK.md` (this repo root) and `../ArchitectOS Beta Launch/ArchitectOS Design System/`

### Core Palette
```
--aos-obsidian:   #193052  (sidebar background)
--aos-slate:      #335373  (sidebar hover / secondary nav)
--aos-steel:      #5F7EA3  (muted text on dark)
--aos-teal:       #143E43  (accent alt / deep feature)
--aos-brass:      #B8922A  (primary CTA, active states, gold accent)
--aos-parchment:  #F7F4EF  (canvas / main content bg)
--aos-cloud:      #FCFBF8  (card surfaces)
--aos-graphite:   #222B38  (primary body text)
```

### Typography
- **Primary:** Geist (all UI text)
- **Monospace:** Geist Mono (numbers, metrics, data)
- **Editorial only:** Instrument Serif italic — NEVER on dashboards or data UI

### Hard No's (ship-blocking anti-patterns)
- `font-family: Inter` — forbidden
- Pure black (`#000` or `#111`) backgrounds or text
- Neon / saturated colors
- Outer glows or box-shadow glow effects
- `background: linear-gradient(...)` on text
- Three equal-width cards in a row (use asymmetric layouts)
- Tailwind default grays (`gray-100`, `gray-900`, etc.) — use AOS tokens instead

---

## Session Rules

### Visual-only pass
When doing Phase 5B design alignment, change CSS/styles only. Do not touch component logic, data wiring, or API calls. Flag any issues found — don't fix them in the same pass.

### Logic / verification pass
When verifying features, check Supabase wiring, N8N webhook endpoints, and data flow first before writing any code. Most features are already built — verify before rewriting.

### One section at a time
Design and verification passes run section by section: Foundations → Diagnostics → Pro Suite → Execution. Do not batch across sections.

---

## Key File Pointers

```
src/
  App.tsx               — root routing
  types.ts              — shared TypeScript types
  context/              — React context providers
  components/           — shared UI components
  pages/                — route-level page components
  lib/                  — utility functions
  config/               — app configuration
  knowledgebase/        — static content / knowledge base files

docs/
  migrations/           — Supabase migration SQL files

DESIGN-GUIDE-QUICK.md   — condensed design token reference (this folder)
ts_errors.log           — TypeScript errors to fix (Phase 6 task)
tsc_errors.log          — TypeScript compile errors to fix (Phase 6 task)
```

---

## Platform Sections

| Section | Status | Notes |
|---|---|---|
| Foundations | Built | Clarity Compass has "Dev: Force Generate" artifact to remove |
| Diagnostics | Built | MRA + AE Ladder results fully functional |
| Pro Suite | Built | Quarter Map, Sprint Board, GV Simulator operational |
| Execution | Partial | Reflection Review rollover logic incomplete |
| Status Tracker | Built | Founder-only, milestone-level, needs hide toggle for sensitive initiatives |

---

## Design Target

Dark Obsidian Navy sidebar (`#193052`) with Brass Gold active states. Parchment canvas (`#F7F4EF`) for main content. Clean card surfaces in Cloud White (`#FCFBF8`). Metric cards with Geist Mono numbers. Gantt-style roadmap view in Pro Suite. Virtual CSO insight panel with editorial type treatment.

See `../ArchitectOS Beta Launch/ArchitectOS Design System/uploads/ArchitectOS-design-system.md` for full specification.

---

## Intelligence Layer — Ways of Working

**Context:** Starting 2026-06-26, we are systematically expanding the ArchitectOS Pro Suite intelligence and ingestion capabilities by studying two reference repos and adapting their patterns to our platform. This is NOT a rewrite. It is an additive, episode-by-episode integration process.

### Reference Repositories

| Repo | Purpose |
|---|---|
| [`Codex-agentic-rag-series`](https://github.com/theaiautomators/Codex-agentic-rag-series) | PRDs, planning docs, and episode specs (7 episodes) |
| [`Codex-agentic-rag-masterclass`](https://github.com/theaiautomators/Codex-agentic-rag-masterclass) | Reference implementation (Python/FastAPI/React/Supabase) |

### Episode Map (Reference Series)

| Episode | Title | Core Capability |
|---|---|---|
| Ep1 | Agentic RAG Masterclass | RAG foundation: ingestion, hybrid search, tool calling, sub-agents |
| Ep2 | Knowledge Base Explorer | Filesystem-like hierarchical KB navigation tools |
| Ep3 | PII Redaction & Anonymization | Privacy layer before cloud LLMs |
| Ep4 | Agent Skills & Code Sandbox | Reusable skills system + Python execution |
| Ep5 | Advanced Tool Calling | Dynamic tool registry, sandbox bridge, MCP integration |
| Ep6 | Agent Harness & Workflows | Deep Mode autonomous agent, domain-specific harness |
| Ep7 | Citations & Source Grounding | Evidence-marked responses, clickable citations |

### How We Work Through Each Episode

1. **Review** — In the strategy thread, read the episode PRD and modules from the reference series
2. **Delta Analysis** — Identify what they do that we don't, what we do better, and where approaches conflict
3. **Adapt Decision** — For each module: Adopt as-is / Adapt to our stack / Skip with documented reason
4. **Create Plan** — Write a focused `docs/plans/plan-[feature-slug].md` for anything we're building
5. **Execute** — Spin up a dedicated execution agent in a new thread, pointing it at the plan file
6. **Update Progress** — Agent updates `Pro-Suite-Progress.md` when done; strategy thread picks up next episode

### Core Adaptation Principles

- **Never rewrite what works.** Our frontend (React 19 / Vite 6 / TypeScript) stays. Our N8N synthesis pipeline stays. The Virtual CSO streaming endpoint stays.
- **Weigh the stack tradeoffs explicitly.** For every reference-repo pattern (e.g. Python/FastAPI backend, Docling doc processing, LangSmith observability), we evaluate: adopt into our stack, find an equivalent that fits our stack, or skip.
- **Align to our use case.** Their KB is generic documents. Ours is structured founder context (MRA results, AE Ladder, initiatives, sprints, brand briefs). Every adaptation must respect that specificity.
- **One plan file per feature.** Plans live in `docs/plans/`. Plans are the handoff artifact to execution agents — they must be self-contained and executable without this conversation thread.
- **Progress manifest is ground truth.** `Pro-Suite-Progress.md` is the single source of truth for what has been decided, what is in flight, and what is done. Every agent reads it first. Every agent updates it when done.

### Key Architectural Decisions (Living — updated as decisions are made)

| Decision | Choice | Rationale |
|---|---|---|
| Backend for ingestion | TBD — evaluate Ep1 | Weigh Python/FastAPI vs. extending N8N or Vercel serverless |
| Doc processing | TBD — evaluate Ep1 | Weigh Docling vs. N8N-native processing |
| Vector search | Supabase pgvector (already in use) | Confirmed — matches their stack |
| Hybrid search / reranking | TBD — evaluate Ep1 | Their approach is a clear upgrade over static KB |
| LLM provider | Codex Sonnet (locked) | Our stack constraint — never swap for OpenAI-compatible |
| Observability | TBD — evaluate Ep1 | LangSmith vs. N8N execution logs |

### Progress Tracking

See `Pro-Suite-Progress.md` (repo root) for the live episode-by-episode status tracker.
