# Handoff Prompt — #15: Pro Suite Hub (Overview) — four-hub launchpad

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. This is a **layout + content/structure pass** on the Pro Suite Hub (`pages/ProSuite/ProMainPage.tsx`, mounted at `/pro`). Cards link to existing pages; no destination-page changes, no wiring. Stay within scope; flag ambiguity rather than improvising.

**Read first:**
1. `DESIGN-GUIDE-QUICK.md` — Surface Hierarchy (parchment-as-signal), Width & density, navy-sparingly.
2. `docs/handoffs/15-pro-suite-hub-launchpad-task-spec.md` — the exact layout, routes, scope, and acceptance criteria.

**Your task in one sentence:** restructure the Pro Suite Hub into a **2×2 launchpad** — **Planning** (top-left) | **Execution** (top-right) | **Intelligence Hub** (bottom-left) | **Blue callout** (bottom-right) — under the existing navy hero banner.

**The pieces:**
- **Planning** — keep its 3 sub-cards (Strategic Roadmap, Quarter Map, Sprint Planning) + Open Planning.
- **Execution** — add 3 sub-cards (**Orient → `/pro/execution/orient`**, **Operate → `/pro/execution/operate`**, **Reflect → `/pro/execution/reflect`**) + Open Execution.
- **Intelligence Hub** (renamed from the OS Engine card) — **Virtual CSO** + **OS Engine** (clickable → their existing routes, confirm in `App.tsx`) + **Reports & Insights** (**non-clickable placeholder**, no route yet). No "Open Intelligence" link (that hub isn't built — omit/disable it).
- **Blue callout** — a navy block with a **high-level** read on how Planning → Execution → Intelligence come together for the transformation journey (**don't restate** each hub's description) + CTA **"Begin your transformation journey" → Strategic Roadmap** (`/pro/planning/roadmap`).

**Hard guardrails:**
- **Hub only** — do not change any destination page (Planning/Execution sub-pages, Virtual CSO, OS Engine), the sidebar, or the design guide. No wiring.
- **Reports & Insights is a placeholder** (inert); **no Intelligence Hub landing** exists yet.
- AOS + parchment-as-signal (white default surfaces w/ shadow; parchment only for header bars/input zones) + Width & density.
- **Navy:** the page will have two navy blocks — the hero banner (page header) and the new callout (the earned feature). That's acceptable, but **if the two together read heavy on screen, flag it** (we may lighten the hero). The callout is the intended navy moment.
- TypeScript clean.

**Before coding:** review the current `ProMainPage.tsx` (the existing Planning featured card + Execution/OS Engine cards) and confirm the Virtual CSO / OS Engine routes in `App.tsx`. Verify before changing.

**When done:** verify every acceptance criterion (2×2 layout; Planning + Execution each with their sub-cards and correct routes; Intelligence Hub with Virtual CSO + OS Engine clickable + Reports & Insights inert; callout with the journey framing + CTA → Strategic Roadmap; no dead links; destination pages + sidebar unchanged; build clean), include a screenshot, and report back in the format the task spec specifies.
