# ArchitectOS Pro — Claude Code Instructions

> Auto-read by Claude Code at session start. Do not delete.

---

## Platform Overview

**ArchitectOS Pro** is a React 19 + Vite 6 + TypeScript SPA for marketing agency founders. It is a strategic operating system — diagnostics, planning, and execution tools in one platform.

**Status:** Substantially built. Pre-beta work is verify / wire / test / design — NOT greenfield development. Assume features exist until confirmed otherwise.

---

## Commit & Versioning Convention

Every commit to this repo is version-tagged so the `git` history reads as an ordered version log. **Every commit message must begin with a semantic version prefix**, followed by a short description:

`vMAJOR.MINOR.PATCH <concise description>`  —  e.g. `v0.5.8 Repoint MRA citation resolver to gm_checkpoints`

**Increment rules:**
- **PATCH** (third digit) — bump for **every incremental push/commit**: routine work, fixes, doc updates, a single agent's deliverable. e.g. `v0.5.7 → v0.5.8`.
- **MINOR** (second digit) — bump on **every major phase / milestone completion** (an episode, or a major workstream such as the testing/verification-debt pass, the connection phase, or the §8 front-end pass). Reset PATCH to 0. e.g. `v0.5.9 → v0.6.0`.
- **MAJOR** (first digit) — bump to **`v1.0.0` only at the live MVP launch** (`0.x.0 → 1.0.0`).

**Rules of use:**
- Versions only move **forward** — never reuse, decrement, or duplicate a version.
- To find the current version, read the **most recent commit message's `vX.Y.Z` prefix** and increment from there. (Baseline as of this rule: **v0.5.7**.)
- Agents default to a **PATCH** bump for routine commits. **MINOR and MAJOR bumps are the founder's call** — do not bump them without explicit instruction.
- **Commit-after-every-file / logical unit is a hard rule** (uncommitted files do not persist across session boundaries): write a file, then immediately stage + commit it with a version-tagged message before moving on.
- **Never commit secrets.** `.env` and any credential file stay out of every commit and must be in `.gitignore`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, TypeScript |
| Backend / DB | Supabase (PostgreSQL, Auth, Storage, Vector Stores) |
| AI Synthesis | Claude Sonnet  |
| PDF Generation | N8N + Google Docs merge field templates → Supabase Storage |
| Hosting | Vercel (frontend), Supabase (backend) |

---

## Critical Architecture Rules

### 1. AI synthesis: three lanes, N8N is no longer the default fallback
**Revised 2026-06-30, Ep4 Phase 4 build.** The original rule ("all synthesis through N8N except Virtual CSO streaming") predates the platform's growth into a more expansive Python/FastAPI backend and no longer reflects reality — it was already being violated by two live services before this revision made it official: `python-backend/services/doc_wiki_synthesis.py` and `python-backend/services/kb_explorer_service.py` both call Anthropic directly today. The rule now has three lanes instead of one default + one exception:

- **Synthesis colocated with a Python backend service** (KB Explorer, doc/wiki synthesis, skill authoring/guided-creation, and similar) calls Anthropic directly from that service — the same pattern already proven in the two files above. This is the default for any new synthesis living inside `python-backend/`, not an exception that needs special justification.
- **Virtual CSO interactive chat** keeps its Vercel serverless streaming exception (decided 2026-06-12, unchanged): context assembly + token-by-token streaming from Claude to the browser, API key server-side in the function env. n8n still cannot stream tokens cleanly, so this stays a dedicated path.
- **Batch, scheduled, or cron-triggered workflows** — anything that genuinely needs external scheduling, retries, or non-code-owned orchestration (PDF generation via Google Docs merge fields, drip/nurture sequences, etc.) — stay on N8N. N8N remains the right tool here, just not the default for everything else.
- **Never, in any lane:** direct client-side (browser) Anthropic API calls, or Supabase Edge Functions for AI.

When adding new synthesis, ask: does this live inside a Python service, does it need token-by-token streaming to the browser, or does it need external scheduling/retries? That answers which lane it belongs to — N8N is no longer the fallback answer for "everything else."

### 2. openai package is dead code — remove it
The `openai` npm package is a legacy remnant. All synthesis has migrated to Claude (via N8N, direct Python-backend calls, or the Virtual CSO streaming function — see Rule #1). Remove the package and any import that references it.

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

### Work from live
The canonical working surface is production: `main` auto-deploys to Railway and Vercel, then verification happens against the live frontend URL and `https://api.architectospro.com`. Local servers are a pre-push safety net only, not the source of truth for acceptance.

For each milestone: run the narrow compile/import checks that fit the touched code, commit with the required version prefix, let the `main` deploy go green, then test the live URL. Do not add Vercel preview/branch environments unless the founder explicitly changes the deployment model.

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
| [`claude-code-agentic-rag-series`](https://github.com/theaiautomators/claude-code-agentic-rag-series) | PRDs, planning docs, and episode specs (7 episodes) |
| [`claude-code-agentic-rag-masterclass`](https://github.com/theaiautomators/claude-code-agentic-rag-masterclass) | Reference implementation (Python/FastAPI/React/Supabase) |

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
| LLM provider | Claude Sonnet (locked) | Our stack constraint — never swap for OpenAI-compatible |
| Observability | LangSmith adopted 2026-07-06; instrumentation rebuilt + outcome-verified 2026-07-10 | Standing bar: any Python-backend LLM call on an episode's critical path emits a LangSmith trace as evidence; traces are necessary, not sufficient, and must be paired with DB/output checks. |

### Intelligence Layer Vision

See `.planning/INTELLIGENCE-VISION.md` for the canonical architecture document — four-tier
retrieval model, the question types the platform must answer, the compiled wiki design, the
retrieval router, and the beta launch target state. **Read this before scoping any new
intelligence layer phase or episode.**

### Progress Tracking

See `Pro-Suite-Progress.md` (repo root) for the live episode-by-episode status tracker.
See `.planning/ROADMAP.md` for the KB Explorer build phase tracker (Phases 1–9).
