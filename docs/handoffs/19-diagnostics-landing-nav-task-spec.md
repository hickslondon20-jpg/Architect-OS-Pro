# Handoff Task Spec — #19: Diagnostics landing + navigation (+ GV title fix)

> **Status:** Ready for execution. (Diagnostics — mirrors the Foundations pass #18.)
> **Companion docs (read first):** `DESIGN-GUIDE-QUICK.md` — Surface Hierarchy (parchment-as-signal), Width & density, navy-sparingly. Use the **Pro Suite Hub** (`ProMainPage.tsx`) launchpad template and the **Foundations** pass (#18: `FoundationsLanding.tsx`, `FoundationsLayout.tsx`, `FoundationsBreadcrumb.tsx`) as the direct model.
> **Role boundary:** Executing agent. Landing redesign + copy correction + sidebar alignment + breadcrumbs, plus one small Foundations title fix. **Non-destructive** — no route/gate/component renames. Flag, don't improvise.

---

## Objective

Bring the **Diagnostics** section onto the established patterns (same as Foundations): redesign `DiagnosticsLanding` into the Pro-Suite-Hub launchpad style with **sequential** framing, **correct the AE Ladder copy**, align the sidebar, and add breadcrumbs. Also apply a one-line **GV Simulator title fix** in Foundations.

---

## In scope

### 1. Redesign `pages/Diagnostics/DiagnosticsLanding.tsx` to the launchpad pattern
- **AOS tokens + Surface Hierarchy + parchment-as-signal + Width & density (full width).** Replace the old `bg-slate-900` hero and indigo/cyan/slate styling.
- **Header:** eyebrow "DIAGNOSTICS" + brand-voice title + one-line subtitle.
- **Sequential framing** (unlike Foundations) — AE Ladder is the **prerequisite** for the M&R Audit, so use the numbered "operating path" treatment (a 2-step sequence) like Planning/Execution: **AE Ladder → M&R Audit**, conveying that your AE Ladder *stage* anchors the stage-aware M&R Audit.
- **Two tool cards, in order:**
  1. **AE Ladder** → `/diagnostics/ae-ladder` — **corrected copy:** the **Agency Evolution Ladder** — your agency's **growth-stage progression** (Surviving → Rising → Driving → Thriving → Compounding). A stage assessment that **anchors the stage-aware recommendations, the right M&R Audit, and platform insights.** (NOT "Account Executive" / sales proficiency.)
  2. **M&R Audit** → `/diagnostics/mr-audit` — the **Maturity & Readiness Audit**, stage-calibrated by your AE Ladder stage; identifies constraints and readiness for growth.

### 2. Correct the AE Ladder copy everywhere it's mislabeled
The landing currently describes AE Ladder as "Account Executive maturity / sales proficiency" — **wrong.** Fix it on the landing, and **scan the AE Ladder tool's user-facing copy** (e.g., `AEIntro`, headers/descriptions) for any "Account Executive"-style mislabeling and correct to **"Agency Evolution Ladder" / agency growth-stage** language. **User-facing copy only** — no route/component renames. Flag if it appears in many places.

### 3. Sidebar (Diagnostics section, `components/Sidebar.tsx`)
- Confirm order: **Overview, AE Ladder, M&R Audit.** Ensure the **"Diagnostics" parent caret is expand-only** and **Overview → `/diagnostics`** (consistency with Pro Suite / Foundations).

### 4. Breadcrumbs on Diagnostics pages
- Mirror the Foundations approach: a **`DiagnosticsLayout`** wrapper (like `FoundationsLayout`) on the `/diagnostics` parent route, rendering a breadcrumb scoped to `/diagnostics/*` (reuse/generalize `FoundationsBreadcrumb`/`ProBreadcrumb`). Upper-left, clickable, rooted at the Diagnostics landing.

### 5. GV Simulator title fix (Foundations follow-up)
- In `App.tsx` (~line 118), change the GV Simulator `SectionLayout title="GV Simulator"` → **`"Growth Velocity Simulator"`**. **Keep the sidebar label "GV Simulator"** (short). One-liner; nothing else in Foundations.

---

## Out of scope (do not do)

- **No route/gate/component renames** (AE Ladder, M&R, GV all keep their paths/keys/component names — copy/title only).
- **No functional/structural changes** to the tool pages (copy correction only) — and nothing else in Foundations beyond the GV title.
- **No Pro Suite or other-section changes.** Do not change the design guide.

---

## Constraints

- AOS + parchment-as-signal + Width & density; navy sparingly. Reuse the Pro-Suite-Hub launchpad pattern + the Foundations breadcrumb/layout approach. **Sequential** (numbered) framing for the 2-step AE → M&R. TypeScript clean; non-destructive.

---

## Acceptance criteria

1. `DiagnosticsLanding` redesigned to the launchpad style (AOS, full width) with **sequential AE Ladder → M&R framing** and correct per-tool copy.
2. **AE Ladder = Agency Evolution Ladder** corrected on the landing and anywhere else it was mislabeled as "Account Executive" (user-facing copy only).
3. Sidebar Diagnostics: order **Overview, AE Ladder, M&R Audit**; parent caret expand-only; Overview → `/diagnostics`.
4. **Breadcrumbs** on all Diagnostics pages (via `DiagnosticsLayout`), upper-left, clickable, rooted at the Diagnostics landing.
5. **GV Simulator section title → "Growth Velocity Simulator"** (sidebar short label kept); nothing else in Foundations.
6. No route/gate/component renames; Pro Suite + other sections untouched; build clean.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Load `/diagnostics`: confirm the launchpad redesign, sequential framing, corrected AE Ladder copy; click both tool cards (routes resolve).
3. Confirm no "Account Executive" mislabeling remains in AE Ladder user-facing copy.
4. Confirm sidebar order/parent-expand/Overview; breadcrumbs render + navigate on a Diagnostics tool + tab.
5. Confirm the GV Simulator title now reads "Growth Velocity Simulator" (section header) with the sidebar still "GV Simulator."
6. Confirm Foundations (otherwise) / Pro Suite / other sections unchanged.
7. Screenshot the landing + a Diagnostics tool page (breadcrumb). Diff summary.

---

## Report-back format

Files changed (one-line intent each); where the AE Ladder copy was corrected; how breadcrumbs were applied (DiagnosticsLayout + reused/generalized breadcrumb); confirmation of the GV title fix; confirmation of each acceptance criterion; screenshots; anything flagged rather than decided.
