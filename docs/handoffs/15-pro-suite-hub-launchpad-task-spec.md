# Handoff Task Spec — #15: Pro Suite Hub (Overview) — four-hub launchpad

> **Status:** Ready for execution.
> **Companion docs (read first):** `DESIGN-GUIDE-QUICK.md` — Surface Hierarchy (parchment-as-signal), Width & density, navy-sparingly. The current Pro Suite Hub component is the Pro Suite index/landing — `pages/ProSuite/ProMainPage.tsx` (mounted at `/pro`).
> **Role boundary:** Executing agent. **Layout + content/structure pass.** Routes link to existing pages; no destination-page changes, no wiring. Flag, don't improvise.

---

## Objective

Restructure the Pro Suite Hub into the **four-hub launchpad** — the Overview page that presents **Planning · Execution · Intelligence**, each with its sub-areas as clickable cards (consistent treatment), plus a guidance callout. This sets up the eventual 4-item sidebar (Overview + the three hubs).

---

## Target layout

```
[ Navy hero banner — "Pro Suite Hub / command center" ]   (page header — keep)

┌───────────────────────────┬───────────────────────────┐
│  PLANNING            (½)   │  EXECUTION           (½)   │
│  Strategic Roadmap ·       │  Orient · Operate ·       │
│  Quarter Map ·             │  Reflect                   │
│  Sprint Planning           │  [Open Execution →]        │
│  [Open Planning →]         │                            │
├───────────────────────────┼───────────────────────────┤
│  INTELLIGENCE HUB    (½)   │  BLUE CALLOUT        (½)   │
│  Virtual CSO · OS Engine · │  How the three come        │
│  Reports & Insights        │  together for the          │
│  (Reports & Insights =     │  transformation journey    │
│   non-clickable for now)   │  [Begin your transformation│
│                            │   journey →]  → Strategic   │
│                            │   Roadmap                   │
└───────────────────────────┴───────────────────────────┘
```

Top row: **Planning | Execution**. Bottom row: **Intelligence Hub | Blue callout.**

---

## In scope

1. **Planning (top-left, ½):** keep its three sub-cards — **Strategic Roadmap** (→ `/pro/planning/roadmap`), **Quarter Map** (→ `/pro/planning/quarter-map`), **Sprint Planning** (→ `/pro/planning/sprint-planning`) — and "Open Planning" (→ `/pro/planning`).
2. **Execution (top-right, ½):** add three sub-cards — **Orient** (→ `/pro/execution/orient`), **Operate** (→ `/pro/execution/operate`), **Reflect** (→ `/pro/execution/reflect`) — and "Open Execution" (→ `/pro/execution`). (Orient/Operate/Reflect are working titles — keep consistent.)
3. **Intelligence Hub (bottom-left, ½):** rename from the OS-Engine card to **Intelligence Hub**, with three sub-cards:
   - **Virtual CSO** → the existing Virtual CSO route (confirm the exact route in `App.tsx`).
   - **OS Engine** → the existing OS Engine route.
   - **Reports & Insights** → **non-clickable placeholder** (disabled styling + a subtle "coming soon"); no route yet.
   - The hub-level "Open Intelligence" CTA: **omit or disable** for now (no Intelligence Hub landing exists yet — the sub-cards route directly to the existing pages).
4. **Blue callout (bottom-right, ½):** a navy/obsidian callout giving a **high-level** read on **how Planning, Execution, and Intelligence come together for the overall transformation journey** — **do not restate** each hub's own description. CTA: **"Begin your transformation journey"** → **Strategic Roadmap** (`/pro/planning/roadmap`).
5. **Keep the navy hero banner** as the page header.

---

## Out of scope (do not do)

- **No changes to any destination page** (Planning, Execution sub-pages, Virtual CSO, OS Engine) — this is the hub only.
- **No wiring / data.**
- **No Reports & Insights page** (placeholder only). **No Intelligence Hub landing** (not built yet).
- **Do not change the design guide or the sidebar.**

---

## Constraints

- AOS + **Width & density** (use the page width well) + **parchment-as-signal** (white default surfaces w/ shadow; parchment only for header bars/input zones) + **navy sparingly**.
- **Navy note:** the page now has two navy blocks — the hero banner (page header) and the new callout (the earned feature). Acceptable as header + one feature, but if the two together feel heavy on screen, **flag it** (we may lighten the hero). The callout is the intended navy moment.
- Avoid the monotonous "three equal cards in a row" feel at the page level — the 2×2 quad handles that; within each hub half, the sub-cards follow the existing Planning pattern.
- TypeScript clean.

---

## Acceptance criteria

1. Pro Suite Hub is a **2×2 launchpad**: Planning (top-left) | Execution (top-right) | Intelligence Hub (bottom-left) | Blue callout (bottom-right), under the navy hero banner.
2. **Planning** shows its 3 sub-cards + Open Planning (routes correct).
3. **Execution** shows **Orient / Operate / Reflect** sub-cards + Open Execution (routes correct).
4. **Intelligence Hub** shows **Virtual CSO + OS Engine** (clickable → existing pages) + **Reports & Insights** (non-clickable placeholder); no broken "Open Intelligence" link.
5. **Blue callout** gives high-level transformation-journey framing (not restating the hub descriptions) + **"Begin your transformation journey" → Strategic Roadmap**.
6. AOS + parchment-as-signal + width standards; navy used as header + the one callout (flagged if heavy); build clean; no destination pages or sidebar changed.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Click every card/CTA: Planning ×4, Execution ×4, Intelligence (Virtual CSO, OS Engine resolve; Reports & Insights is inert), callout CTA → Strategic Roadmap. No dead links.
3. Confirm the destination pages and sidebar are unchanged.
4. Screenshot the hub.
5. Diff summary of files changed.

---

## Report-back format

Files changed (one-line intent each); the routes you wired each card to (confirm the Virtual CSO / OS Engine routes); how you handled the two-navy-blocks question (and whether it reads heavy); confirmation of each acceptance criterion; screenshot; anything flagged rather than decided.
