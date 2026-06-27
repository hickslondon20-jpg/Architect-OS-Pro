# Handoff Prompt — #19: Diagnostics landing + navigation (+ GV title fix)

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. Bring the **Diagnostics** section onto the patterns we built — this mirrors the Foundations pass (#18). **Non-destructive** — copy/title changes only, no route/code renames. Stay within scope; flag ambiguity rather than improvising.

**Read first:**
1. `DESIGN-GUIDE-QUICK.md` — Surface Hierarchy (parchment-as-signal), Width & density, navy-sparingly.
2. `docs/handoffs/19-diagnostics-landing-nav-task-spec.md` — the exact scope, framing, routes, and acceptance criteria.
Use the **Pro Suite Hub** (`ProMainPage.tsx`) as the launchpad template and the **Foundations** files (`FoundationsLanding.tsx`, `FoundationsLayout.tsx`, `FoundationsBreadcrumb.tsx`) as the direct model.

**Your task:** redesign `DiagnosticsLanding` to the launchpad style; use **sequential** framing (AE Ladder → M&R Audit); **correct the AE Ladder copy**; align the sidebar; add breadcrumbs; and apply one GV Simulator title fix in Foundations.

**The landing:** eyebrow "DIAGNOSTICS" + brand-voice title + subtitle, AOS / full width. **Sequential** "operating path" (numbered, 2 steps) — **AE Ladder → M&R Audit** — conveying that the AE Ladder stage anchors the stage-aware M&R Audit. Two cards in order:
- **AE Ladder** (→ `/diagnostics/ae-ladder`) — the **Agency Evolution Ladder**: your agency's growth-stage progression (Surviving → Compounding), the stage assessment that anchors stage-aware recommendations, the right M&R Audit, and platform insights. **NOT "Account Executive."**
- **M&R Audit** (→ `/diagnostics/mr-audit`) — Maturity & Readiness Audit, stage-calibrated by your AE stage.

**Copy correction:** fix the "Account Executive / sales proficiency" mislabel on the landing, and scan the AE Ladder tool's user-facing copy (e.g., `AEIntro`) for the same error → "Agency Evolution Ladder" / agency growth-stage. **User-facing copy only.**

**Sidebar (`Sidebar.tsx`, Diagnostics):** order Overview, AE Ladder, M&R Audit; parent caret expand-only; Overview → `/diagnostics`.

**Breadcrumbs:** add a `DiagnosticsLayout` wrapper (like `FoundationsLayout`) on `/diagnostics`, rendering a breadcrumb scoped to `/diagnostics/*` (reuse/generalize the Foundations/Pro breadcrumb). Upper-left, clickable, rooted at the Diagnostics landing.

**GV title fix (Foundations):** in `App.tsx` (~line 118), change the GV Simulator `SectionLayout title="GV Simulator"` → `"Growth Velocity Simulator"`. **Keep the sidebar label "GV Simulator."** Nothing else in Foundations.

**Hard guardrails:**
- **No route/gate/component renames** (copy/title only).
- **Diagnostics only** (+ the one GV title line in Foundations) — don't touch Pro Suite or anything else in Foundations. **Don't change the design guide.**
- AOS + parchment-as-signal + Width & density; navy sparingly. TypeScript clean.

**Before coding:** review `DiagnosticsLanding.tsx`, the Foundations #18 files (your model), the AE Ladder copy (`AEIntro` etc.), and the Diagnostics section in `Sidebar.tsx`. Verify before changing.

**When done:** verify every acceptance criterion (launchpad redesign + sequential AE→M&R framing; AE Ladder = Agency Evolution Ladder copy corrected; sidebar order/expand-only; breadcrumbs on Diagnostics pages; GV section title fixed with sidebar short label kept; no renames; nothing else touched; build clean), include screenshots of the landing + a Diagnostics tool page with the breadcrumb, and report back in the format the task spec specifies.
