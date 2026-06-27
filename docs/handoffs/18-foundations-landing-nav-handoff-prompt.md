# Handoff Prompt — #18: Foundations landing + navigation

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. Bring the **Foundations** section onto the patterns we built for the Pro Suite. **Non-destructive** — user-facing rebrand only, no route/code renames. Stay within scope; flag ambiguity rather than improvising.

**Read first:**
1. `DESIGN-GUIDE-QUICK.md` — Surface Hierarchy (parchment-as-signal), Width & density, navy-sparingly.
2. `docs/handoffs/18-foundations-landing-nav-task-spec.md` — the exact scope, order, routes, and acceptance criteria.
Use the **Pro Suite Hub** (`ProMainPage.tsx`) as the launchpad template and the **#17 breadcrumb** as the breadcrumb pattern.

**Your task:** redesign `FoundationsLanding` to the Pro-Suite-Hub launchpad style; reorder + reframe the tools; rebrand Founder Evolution → Architect Evolution (user-facing only); align the sidebar; add breadcrumbs.

**The landing:** eyebrow "FOUNDATIONS" + brand-voice title + subtitle, on AOS / full width. Tool cards in this **new order** (routes unchanged): **Architect Evolution** (→ `/foundations/founder-evolution`), **Agency Snapshot** (→ `/foundations/snapshot`), **Clarity Compass** (→ `/foundations/clarity-compass`), **Growth Velocity Simulator** (→ `/foundations/gv-simulator`). Use a **"how it flows" framing — ordered, not numbered** — and explicitly note **Clarity Compass ⇄ GV Simulator is iterative, not linear**. Write correct per-tool copy (purposes are in the task spec).

**The rebrand (user-facing ONLY):** change every displayed "Founder Evolution" → "Architect Evolution" — landing card, sidebar label, the `SectionLayout title` (~App.tsx line 130), and the Founder-Evolution page headings/copy. **Do NOT rename** the route path `/foundations/founder-evolution`, the `founder_evolution` gate key, or the `FounderEvolution*` component/file names — that's a separate deferred pass (V-13).

**Sidebar (`Sidebar.tsx`, Foundations section):** reorder children to **Overview, Architect Evolution, Agency Snapshot, Clarity Compass, GV Simulator**; rebrand the label; parent caret expand-only; Overview → `/foundations`.

**Breadcrumbs:** extend the #17 breadcrumb to all `/foundations/*` pages (upper-left, clickable, rooted at the Foundations landing). Reuse the existing component.

**Hard guardrails:**
- **User-facing rebrand only** — no route/gate/component renames.
- **Foundations only** — don't touch Diagnostics, Pro Suite, or other sections. **Don't change the design guide.**
- AOS + parchment-as-signal + Width & density; navy sparingly. TypeScript clean.

**Before coding:** review the current `FoundationsLanding.tsx` (old styling), `ProMainPage.tsx` (the template), the `#17` breadcrumb component, and the Foundations section in `Sidebar.tsx`. Verify before changing.

**When done:** verify every acceptance criterion (launchpad redesign on AOS + new order + iterative-flow framing; Architect Evolution on all user-facing text with route/gate/component names untouched; sidebar reordered/relabeled/expand-only; breadcrumbs on Foundations pages; nothing else changed; build clean), include screenshots of the landing + a Foundations tool page with the breadcrumb, and report back in the format the task spec specifies.
