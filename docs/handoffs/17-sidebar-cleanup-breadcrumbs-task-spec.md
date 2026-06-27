# Handoff Task Spec — #17: Pro Suite sidebar cleanup + breadcrumbs (two phases)

> **Status:** Ready for execution. (Implements V-02 + V-01.)
> **TWO PHASES. Do Phase 1, build, verify, screenshot, and PAUSE for review before starting Phase 2.**
> **This is the most structural pass we've done (sidebar + routes) — be careful and NON-DESTRUCTIVE.** Removing a sidebar item ≠ deleting a page. Any moved route keeps a redirect. Log moves in `docs/execution-hub-audit-inventory.md`. If anything seems to need a change beyond this scope, **flag it — don't do it.**
> **Companion docs:** `DESIGN-GUIDE-QUICK.md` (Surface Hierarchy, Width & density). Key files: `components/Sidebar.tsx`, `App.tsx` (the `pro` route group), the three hub landings, `ProMainPage.tsx`, `IntelligenceLanding.tsx`.

---

## PHASE 1 — Sidebar cleanup + Intelligence re-nesting

### In scope
1. **Sidebar (`components/Sidebar.tsx`), Pro Suite section only:**
   - The **"ArchitectOS Pro Suite" parent + caret is expand/collapse only — NOT a link/redirect** (match the Foundations/Diagnostics pattern).
   - Under it, **exactly four items:**
     - **Overview** → `/pro`
     - **Planning** → `/pro/planning`
     - **Execution** → `/pro/execution`
     - **Intelligence** → `/pro/intelligence`
   - (Labels: Overview / Planning / Execution / Intelligence — "Hub" suffix optional; match the existing label style.)
   - **Remove all other Pro Suite nav entries** — Sprint Launch, Status Tracker, Synthesis, Virtual CSO, OS Engine, and any old Planning/Execution duplicates — **and the dynamic `getExecutionLinks` logic.** This removes **nav entries only** — do NOT delete pages, components, or routes.
2. **Re-nest the Intelligence tool routes (`App.tsx`):**
   - `Virtual CSO` → **`/pro/intelligence/virtual-cso`**
   - `OS Engine` → **`/pro/intelligence/os-engine`**
   - **Add redirects** from the old paths (`/pro/virtual-cso` → new, `/pro/os-engine` → new) so old links/bookmarks don't break.
   - **Update internal links to the new paths:** the Intelligence landing's cards + its "Talk to your Virtual CSO" CTA, and the Pro Suite Hub overview's Intelligence cards.
   - **Log the route moves** in the ledger.
3. **Touch nothing else** — other sidebar sections (Dashboard, Foundations, Diagnostics, Resources) and all hub/sub-page content stay as-is.

### Out of scope (Phase 1)
- No page/component/route deletions (nav-entry removal only).
- No content/layout changes to any page.
- No breadcrumb yet (Phase 2).
- No other route changes — the execution `/launch` + `/status-tracker` stay as their existing redirects; `/synthesis` (Momentum) stays put (its relocation is parked).

### Verify Phase 1 (before reporting)
1. Build / typecheck — no new errors.
2. Sidebar Pro Suite shows **Overview + Planning + Execution + Intelligence**; the parent caret only expands/collapses (doesn't navigate).
3. Each of the four routes resolves; every hub landing, sub-page, and sub-tab is still reachable.
4. Old `/pro/virtual-cso` and `/pro/os-engine` **redirect** to the new `/pro/intelligence/...` paths; the Intelligence landing cards, the "Talk to your Virtual CSO" CTA, and the overview's Intelligence cards all resolve to the new paths.
5. Nothing else changed; no dead links anywhere in the Pro Suite.
6. Screenshot the cleaned sidebar. **Report + PAUSE — await go-ahead before Phase 2.**

---

## PHASE 2 — Breadcrumbs (only after Phase 1 is approved)

### In scope
1. A **page-level breadcrumb** in the **upper-left** of **every Pro Suite (`/pro/*`) page**, derived from the route — a **clickable trail**: `Overview › [Hub] › [Sub-page] › [Sub-tab]` (e.g., `Overview › Execution › Operate › Status Tracker`). Each segment links to its route; **Overview → `/pro`**.
2. **AOS styling, quiet/subtle** — the breadcrumb is light wayfinding text, not a parchment block (per parchment-as-signal). Consistent upper-left placement across all Pro Suite pages.
3. **Reuse an existing breadcrumb component if a suitable one exists** (check `components/`); otherwise build a small one driven by the route.
4. **Pro-Suite-scoped** this pass (the broader all-pages rollout, V-01, is a later follow-up).

### Out of scope (Phase 2)
- Non-Pro-Suite pages. No other changes.

### Verify Phase 2 (before reporting)
1. Build / typecheck — no new errors.
2. Breadcrumbs render upper-left on a representative hub landing, a sub-page, and a sub-tab; every segment navigates correctly; the Overview segment → `/pro`.
3. Screenshot a couple of pages showing the breadcrumb. Report.

---

## Constraints (both phases)

- **Non-destructive:** redirects for moved routes; no deletions; log moves. AOS + Width & density + parchment-as-signal. TypeScript clean. HashRouter nesting consistent.

## Acceptance criteria (overall)

1. Pro Suite sidebar = **Overview + Planning + Execution + Intelligence**, parent caret expand-only; all stale items + dynamic exec-link logic removed (nav only).
2. Intelligence tools **re-nested** under `/pro/intelligence/...` with **redirects** from the old paths; internal links updated; moves logged.
3. **Nothing deleted or broken** — every page reachable, no dead links.
4. **Breadcrumbs** on all Pro Suite pages — upper-left, clickable, correct trail, Overview → `/pro`.
5. Other sidebar sections + page content untouched; build clean.

## Report-back format (per phase)

Files changed (one-line intent each); for Phase 1: the final sidebar items + the route moves/redirects + ledger note + confirmation nothing else broke; for Phase 2: the breadcrumb approach (reused vs new) + where it renders; confirmation of acceptance criteria; screenshots; anything flagged. **After Phase 1, stop and wait for go-ahead.**
