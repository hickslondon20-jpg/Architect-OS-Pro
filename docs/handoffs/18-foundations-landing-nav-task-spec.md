# Handoff Task Spec — #18: Foundations landing + navigation

> **Status:** Ready for execution. (Foundations only — Diagnostics is a separate later handoff.)
> **Companion docs (read first):** `DESIGN-GUIDE-QUICK.md` — Surface Hierarchy (parchment-as-signal), Width & density, navy-sparingly. Use the **Pro Suite Hub** (`ProMainPage.tsx`) + the hub landings as the launchpad template, and the **#17 breadcrumb** component as the breadcrumb pattern.
> **Role boundary:** Executing agent. Landing redesign + user-facing rebrand + sidebar alignment + breadcrumbs. **Non-destructive** — no route-path/gate-key/component-name changes (that's a separate deferred pass, V-13). Flag, don't improvise.

---

## Objective

Bring the **Foundations** section onto the established patterns: redesign `FoundationsLanding` into the Pro-Suite-Hub launchpad style, reorder the tools, rebrand **Founder Evolution → Architect Evolution** (user-facing only), align the sidebar, and add breadcrumbs.

---

## In scope

### 1. Redesign `pages/Foundations/FoundationsLanding.tsx` to the Pro-Suite-Hub launchpad pattern
- **AOS tokens + Surface Hierarchy + parchment-as-signal + Width & density (full width).** Replace the old `bg-slate-900` hero and blue/purple/emerald/amber Tailwind styling.
- **Header:** eyebrow "FOUNDATIONS" + a brand-voice title + one-line subtitle.
- **Tool cards in this NEW order** (each → its existing route, unchanged):
  1. **Architect Evolution** → `/foundations/founder-evolution` *(route unchanged this pass)* — the entry point; reveals how the founder shows up and leads *as an architect*, giving the platform context on the person running the business.
  2. **Agency Snapshot** → `/foundations/snapshot` — the running essence of the business (markets, clients, services, current revenue; self-reported now).
  3. **Clarity Compass** → `/foundations/clarity-compass` — the start of the transformation: what they're optimizing for + 12/24/36-month + ultimate vision.
  4. **Growth Velocity Simulator** → `/foundations/gv-simulator` — model scenarios and the pressure each path creates; compare; retag scenarios back to the Compass horizons.
- **Flow framing — ordered, NOT rigid numbering.** A "how to use this" / flow callout that conveys the natural progression **Architect Evolution → Agency Snapshot → Clarity Compass ⇄ Growth Velocity Simulator**, explicitly noting the **Clarity Compass ⇄ GV Simulator relationship is iterative/back-and-forth, not linear**. Card descriptions reflect each tool's real purpose (use the descriptions above; correct, on-brand copy — no "AE/Account-Executive"-style errors).

### 2. Rebrand "Founder Evolution" → "Architect Evolution" — USER-FACING ONLY
Update every place the **displayed text** says "Founder Evolution": the landing card, the **sidebar label**, the `SectionLayout title="Founder Evolution"` (App.tsx ~line 130), and the headings/copy on the Founder-Evolution landing/assessment/results pages.
- **Do NOT change** the route path (`/foundations/founder-evolution`), the feature-gate key (`founder_evolution`), or component/file names (`FounderEvolution*`). Those are the deferred backend rename (V-13).

### 3. Sidebar (Foundations section, `components/Sidebar.tsx`)
- **Reorder children** to: **Overview, Architect Evolution, Agency Snapshot, Clarity Compass, GV Simulator** (Architect Evolution moves up to first after Overview, matching the landing order).
- Rebrand the label "Founder Evolution" → **"Architect Evolution."**
- Ensure the **"Foundations" parent caret is expand-only** (consistency with Pro Suite) and **Overview → `/foundations`**.

### 4. Breadcrumbs on Foundations pages
- Extend the **#17 breadcrumb** pattern/component to all `/foundations/*` pages — upper-left, clickable, rooted at the Foundations landing (e.g., `Foundations › Clarity Compass › Vision State`). Reuse the existing component; quiet AOS styling.

---

## Out of scope (do not do)

- **No route-path / feature-gate / component-name renames** for Architect Evolution (deferred, V-13) — user-facing text only.
- **No functional/structural changes** to the tool pages (Snapshot, Clarity, GV, Architect/Founder Evolution) — only their user-facing "Founder Evolution" wording + the landing/sidebar/breadcrumbs.
- **No Diagnostics changes** (separate handoff). **No other sections** (Pro Suite, etc.).
- Do not change the design guide.

---

## Constraints

- AOS + parchment-as-signal + Width & density; navy sparingly (mirror the Pro Suite Hub). Reuse the Pro-Suite-Hub landing pattern + the #17 breadcrumb component. TypeScript clean. Non-destructive (rebrand = display text only).

---

## Acceptance criteria

1. `FoundationsLanding` redesigned to the **Pro-Suite-Hub launchpad style** (AOS, full width), tools in the **new order**, with the **iterative-flow framing** (Clarity ⇄ GV noted as non-linear) and correct per-tool copy.
2. **"Founder Evolution" → "Architect Evolution"** on all user-facing text (landing card, sidebar label, section title, tool-page headings) — **route path, gate key, and component names unchanged.**
3. Sidebar Foundations children reordered (**Overview, Architect Evolution, Agency Snapshot, Clarity Compass, GV Simulator**), label rebranded, parent caret expand-only, Overview → `/foundations`.
4. **Breadcrumbs** on all Foundations pages (upper-left, clickable, rooted at the Foundations landing), reusing the existing component.
5. No route/gate/component renames; no Diagnostics or other sections touched; build clean.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Load `/foundations`: confirm the launchpad redesign, new order, flow framing; click each tool card (routes resolve).
3. Confirm "Architect Evolution" everywhere user-facing; confirm the route still works at `/foundations/founder-evolution` (unchanged).
4. Confirm the sidebar order/label/parent-expand; confirm breadcrumbs render + navigate on a Foundations tool + tab.
5. Confirm Diagnostics / Pro Suite / other sections unchanged.
6. Screenshot the landing + a Foundations tool page (showing breadcrumb). Diff summary.

---

## Report-back format

Files changed (one-line intent each); confirmation the rebrand was user-facing only (route/gate/component names untouched); how breadcrumbs were applied (reused component); confirmation of each acceptance criterion; screenshots; anything flagged rather than decided.
