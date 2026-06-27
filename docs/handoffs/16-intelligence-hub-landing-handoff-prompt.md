# Handoff Prompt — #16: Intelligence Hub landing

Paste the following to the executing agent (the one who built #15 can continue).

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. Build one new landing page + one small wiring update. Cards link to existing pages; no destination-page changes, no wiring. Stay within scope; flag ambiguity rather than improvising.

**Read first:**
1. `DESIGN-GUIDE-QUICK.md` — Surface Hierarchy (parchment-as-signal), Width & density, navy-sparingly.
2. `docs/handoffs/16-intelligence-hub-landing-task-spec.md` — the exact task, structure, routes, and acceptance criteria.
Mirror the **Execution Hub landing** (`ExecutionLanding.tsx`) and the **Planning landing** as the template.

**Your task in one sentence:** build the **Intelligence Hub landing** at `/pro/intelligence` — a sibling of the Planning/Execution landings but **non-sequential** (three related standalone resources, no numbered operating path) — then wire the overview's "Open Intelligence" CTA to it.

**The landing:**
- Header: eyebrow "INTELLIGENCE HUB" + a brand-voice title + one-line subtitle. Top CTA: **"Talk to your Virtual CSO" → `/pro/virtual-cso`**.
- Three resource cards (NOT numbered): **Virtual CSO** (→ `/pro/virtual-cso`), **OS Engine** (→ `/pro/os-engine`), **Reports & Insights** (non-clickable placeholder, **"Coming Soon"** tag).
- A "how to use this" callout framed **non-sequentially** ("three intelligence resources, reach for the one you need" — not a step flow).

**The overview update:** add **"Open Intelligence" → `/pro/intelligence`** on the Intelligence Hub section of `ProMainPage.tsx` (it was omitted in #15 because the landing didn't exist yet).

**Hard guardrails:**
- **Do not move or change** the Virtual CSO / OS Engine pages or routes — link to them where they are. (Re-nesting them under `/pro/intelligence/...` is a later sidebar-cleanup task, V-02 — not now.)
- **Reports & Insights is a placeholder** (no page, inert). **No sidebar changes. No design-guide changes. No wiring.**
- **Non-sequential** — do not add the numbered 1→2→3 "operating path" element the Planning/Execution landings have.
- AOS + parchment-as-signal + Width & density; navy sparingly (match how the Execution landing uses it). TypeScript clean.

**Before coding:** review `ExecutionLanding.tsx` (the template), `ProMainPage.tsx` (the overview to update), and confirm the `pro` route group in `App.tsx`. Verify before changing.

**When done:** verify every acceptance criterion (sibling-looking non-sequential landing at `/pro/intelligence`; Virtual CSO + OS Engine clickable + Reports & Insights inert "Coming Soon"; top CTA → Virtual CSO; overview "Open Intelligence" → `/pro/intelligence`; existing pages/routes/sidebar unchanged; build clean; no dead links), include screenshots of the landing + the updated overview, and report back in the format the task spec specifies.
