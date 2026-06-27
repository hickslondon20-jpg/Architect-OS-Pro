# Handoff Prompt — #25: Architect Evolution V-13 Naming Alignment

You are the building agent for a **code rename / structural** unit on ArchitectOS Pro. Rename the Architect Evolution feature's route, gate keys, and components from the legacy `founder_evolution` naming. **No data/logic wiring (that's #26), no `fe_*` DB changes, no visual changes.**

## Read first (in order)
1. `docs/handoffs/25-architect-evolution-v13-rename-task-spec.md` — scope, acceptance criteria, report-back.
2. `UI-PROGRESS.md` V-13; `docs/content-provenance-manifest.md` (Architect Evolution section).
3. `CLAUDE.md`.

## Key facts
Gating is **code-based** in `lib/featureGates.ts` — there is **no `beta_feature_gates` table**, don't create one. Two keys: `founder_evolution` and `founder_evolution_dashboard`. Known files (verify + grep for more): `App.tsx`, `lib/featureGates.ts`, `pages/FounderEvolutionPages.tsx`, `components/Sidebar.tsx`, `pages/Foundations/FoundationsLanding.tsx`, `components/FoundationsBreadcrumb.tsx`, `pages/ToolsPages.tsx`. **Ignore `.claude/worktrees/**`, `docs/**`, and `UI-PROGRESS.md`** (stale/historical — leave as-is).

## What to do
1. **Route:** `/foundations/founder-evolution` → `/foundations/architect-evolution` (+ `/assessment`, `/results`); **add redirects** from old → new; update every internal Link/navigate/href (routes, SectionLayout tab hrefs, assessment Back/Start/Complete, results, Sidebar, Foundations landing card, breadcrumb).
2. **Gate keys:** `founder_evolution → architect_evolution`, `founder_evolution_dashboard → architect_evolution_dashboard` across the `FeatureKey` union, `FEATURE_GATES` (keep existing labels), `PATH_FEATURE_GATES` (paths + keys), and the `gated(...)` calls in `App.tsx`. The Results temp gate stays temporary — just rename it + its comment.
3. **Components/files:** `FounderEvolutionPages.tsx` → `ArchitectEvolutionPages.tsx`; `FounderEvolution{Landing,Assessment,Results}` → `ArchitectEvolution*`; update the `App.tsx` import and all consumers.
4. **Copy:** align residual user-facing **tool-name** "Founder Evolution" → "Architect Evolution."

## CRITICAL guardrail — do NOT rename framework vocabulary
"Founder Identity," "Founder Type," "Founder Role," and the labels Practitioner/Manager/CEO/Advisor/Investor and Visionary/Strategist/Builder are intentional IP and **must stay**. Only the **tool/feature name** and **backend identifiers** (route, gate keys, component/file names) change. Don't delete the old route — redirect it. No `fe_*`/scoring/data changes. No visual changes.

## Verify before reporting done (written — no screenshots)
`grep` shows zero `founder_evolution` / `founder-evolution` / `FounderEvolution` in active code (excluding `docs/**`, `UI-PROGRESS.md`, `.claude/worktrees/**`); typecheck/build clean; old routes redirect to new; gating resolves under the renamed keys; framework terms still present (grep-confirm).

## Report back
Per the task-spec's report-back format: files renamed/changed, route + redirects added, gate-key changes (both keys, all sites), component/file rename + consumers, copy-sweep results (changed vs intentionally-kept framework terms), grep-clean confirmation, build status. Flag anything ambiguous rather than guessing.
