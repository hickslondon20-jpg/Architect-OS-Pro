# Handoff Task Spec — #25: Architect Evolution — V-13 Naming Alignment

> **Status:** Ready for execution. **Frontend/code rename only** — no data/logic wiring (that's #26), no `fe_*` table/function changes.
> **Source of truth:** `UI-PROGRESS.md` V-13; `docs/content-provenance-manifest.md` (Architect Evolution Notes + Go-Live Gaps); `docs/architect-evolution-scoring-spec.md` Amendments.
> **Companions:** `CLAUDE.md`, `DESIGN-GUIDE-QUICK.md`.
> **Role boundary:** Executing agent. **Verify before changing.** Non-destructive — **keep redirects for moved routes**. Rename only; no behavior/wiring change. Flag, don't improvise.

---

## Objective

Complete the Architect Evolution rebrand on the code/structure side so the feature is consistently "Architect Evolution" before it's wired: rename the route, the feature-gate keys, and the `FounderEvolution*` components/files, and clean up any residual user-facing "Founder Evolution" tool-name copy. **No data wiring — components keep their current (mock) behavior; #26 wires them.**

---

## Context (verify first)

Gating is **code-based** in `lib/featureGates.ts` (there is **no** `beta_feature_gates` table — do not create one). Two keys are in play: `founder_evolution` and `founder_evolution_dashboard` (Results). Known reference set (verify each; there may be more — grep to confirm):
`App.tsx`, `lib/featureGates.ts`, `pages/FounderEvolutionPages.tsx`, `components/Sidebar.tsx`, `pages/Foundations/FoundationsLanding.tsx`, `components/FoundationsBreadcrumb.tsx`, `pages/ToolsPages.tsx`. **Ignore `.claude/worktrees/**` (stale copies) and `docs/**` + `UI-PROGRESS.md` (historical record — leave as-is).**

---

## In scope

1. **Route rename** — `/foundations/founder-evolution` → `/foundations/architect-evolution` (incl. `/assessment`, `/results`). **Add redirects** from the old paths (and sub-paths) to the new ones so existing deep links don't break. Update all internal `Link`/`navigate`/`href` references (App.tsx routes, the SectionLayout tab hrefs, the assessment Back/Start/Complete links, results links, Sidebar, Foundations landing card, breadcrumb).
2. **Feature-gate keys** — in `lib/featureGates.ts`: `founder_evolution → architect_evolution` and `founder_evolution_dashboard → architect_evolution_dashboard`, across the `FeatureKey` union, the `FEATURE_GATES` config entries (keep the existing user-facing labels), and the `PATH_FEATURE_GATES` paths + keys. Update the matching `gated(...)` calls in `App.tsx`. (The Results route's temporary gate stays temporary — just rename the key and its comment to `architect_evolution` / `architect_evolution_dashboard`; the pre-launch flip remains a separate Go-Live item.)
3. **Component/file rename** — `pages/FounderEvolutionPages.tsx` → `pages/ArchitectEvolutionPages.tsx`; exported `FounderEvolutionLanding/Assessment/Results` → `ArchitectEvolutionLanding/Assessment/Results`; update the `App.tsx` import (`import * as FounderEvolution …` → `ArchitectEvolution`) and every consumer/barrel export.
4. **Residual user-facing copy** — sweep for the **tool name** "Founder Evolution" in user-facing strings and align to "Architect Evolution."

---

## Out of scope (do not do)

- **No data/logic wiring** — components keep current mock behavior; reads/persistence are #26.
- **No `fe_*` table or function changes**; no scoring changes.
- **Do NOT touch other features' gates/routes.**
- **CRITICAL — do NOT rename the framework vocabulary.** "Founder Identity," "Founder Type," "Founder Role," and the role/type labels (Practitioner, Manager, CEO, Advisor, Investor / Visionary, Strategist, Builder) are intentional IP and **must stay**. Only the **tool/feature name** ("Founder Evolution" → "Architect Evolution") and the **backend identifiers** (route, gate keys, component/file names) change.
- Do not delete the old route — redirect it.

---

## Constraints

- TypeScript + build clean; AOS unaffected (no visual changes intended).
- Redirects preserved for the old route paths.
- Non-destructive; rename via move (preserve git history where the tooling allows).

---

## Acceptance criteria

1. New route `/foundations/architect-evolution` (+ `/assessment`, `/results`) works; old paths **redirect** to the new ones.
2. Gate keys are `architect_evolution` / `architect_evolution_dashboard` everywhere in code; gating still enforces correctly.
3. Components/files are `ArchitectEvolution*`; all imports/consumers updated; no broken references.
4. **No `founder_evolution` / `founder-evolution` / `FounderEvolution` left in active code** (excluding `docs/**`, `UI-PROGRESS.md`, `.claude/worktrees/**`).
5. Framework vocabulary untouched; no data/logic/visual changes.
6. Build + typecheck clean.

---

## Verification (before reporting done — written; no screenshots)

1. `grep` confirms zero `founder_evolution` / `founder-evolution` / `FounderEvolution` in active code (list the excluded paths).
2. Typecheck/build clean.
3. Confirm the old route paths redirect to the new ones (cite the redirect routes added).
4. Confirm gating: the page(s) still resolve under the renamed keys (cite the `featureGates.ts` + `App.tsx` changes).
5. Confirm framework terms ("Founder Identity/Type/Role" + labels) are intact (grep shows they remain).

---

## Report-back format

Files renamed/changed (one-line intent each); the route rename + the redirect routes added; the gate-key changes (both keys, all sites); the component/file rename + consumer updates; the copy-sweep results (what changed, what was intentionally left as framework vocabulary); the grep-clean confirmation; build/typecheck status; anything flagged.
