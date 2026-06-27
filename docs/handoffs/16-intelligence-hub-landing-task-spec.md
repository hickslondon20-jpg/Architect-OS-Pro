# Handoff Task Spec — #16: Intelligence Hub landing

> **Status:** Ready for execution. (Continuation for the agent that built #15.)
> **Companion docs (read first):** `DESIGN-GUIDE-QUICK.md` — Surface Hierarchy (parchment-as-signal), Width & density, navy-sparingly. Use the **Execution Hub landing** (`ExecutionLanding.tsx`, refined in #06) and the **Planning landing** as the template to mirror. The overview to update is `pages/ProSuite/ProMainPage.tsx`.
> **Role boundary:** Executing agent. Build one new landing page + one small wiring update on the overview. Cards link to existing pages; no destination-page changes, no wiring. Flag, don't improvise.

---

## Objective

Build the **Intelligence Hub landing** at `/pro/intelligence`, mirroring the Planning/Execution landing template — **but non-sequential.** Intelligence is **three related, standalone resources** (not a 1→2→3 flow), so it does NOT get the numbered "operating path" element; it presents three related intelligence tools. Then wire the overview's "Open Intelligence" CTA to the new landing.

Most of the work is the landing itself — Virtual CSO and OS Engine already exist; the landing launches into them.

---

## In scope

### 1. New Intelligence Hub landing (`/pro/intelligence`)
New component (e.g., `pages/ProSuite/IntelligenceLanding.tsx`) + a new route in `App.tsx` under `pro` → `intelligence`. Mirror the Execution/Planning landing template on the wider layout + surface hierarchy:
- **Header:** eyebrow "INTELLIGENCE HUB" + a title (brand voice; theme = AI strategic support, synthesized knowledge, performance insight — e.g., "Strategy that knows your business." — refine as you see fit) + a one-line subtitle.
- **Top CTA:** **"Talk to your Virtual CSO" → `/pro/virtual-cso`.**
- **Three element cards** (related resources, **not numbered/sequenced**):
  - **Virtual CSO** — AI-powered strategic advisor for your agency. → `/pro/virtual-cso`
  - **OS Engine** — uploads, synthesized knowledge, your second brain. → `/pro/os-engine`
  - **Reports & Insights** — synthesized performance reports + trend analysis. **Non-clickable placeholder** with a subtle **"Coming Soon"** tag (no route yet).
- **A "how to use this" callout** framed **non-sequentially** — e.g., "Three intelligence resources, always in context — reach for the one you need" — describing what each is for / when to use it, NOT a step sequence.

### 2. Update the overview (`ProMainPage.tsx`)
Add the now-valid **"Open Intelligence" CTA → `/pro/intelligence`** on the Intelligence Hub section/card (it was intentionally omitted in #15 because the landing didn't exist yet).

---

## Out of scope (do not do)

- **No changes to Virtual CSO or OS Engine pages**, and **do not move their routes** — the landing links to them where they are. (Re-nesting `/pro/virtual-cso` + `/pro/os-engine` under `/pro/intelligence/...` is a **sidebar-cleanup task**, logged as part of V-02 — not now.)
- **No Reports & Insights page** (placeholder only).
- **No sidebar changes.** **No design-guide changes.** No wiring/data.

---

## Constraints

- AOS + **Width & density** (full width, matching the other hub landings) + **parchment-as-signal** (white default surfaces w/ shadow; parchment only for header bars/input zones) + **navy sparingly** (mirror however the Execution landing uses it — likely none or one accent).
- Mirror the Execution/Planning landing structure for consistency (it should feel like a sibling of those two), minus the numbered sequence.
- TypeScript clean.

---

## Acceptance criteria

1. `/pro/intelligence` renders an Intelligence Hub landing that **looks like a sibling** of the Planning/Execution landings (eyebrow + title + subtitle + top CTA + three cards + a how-to-use callout), on the wider layout.
2. The three cards: **Virtual CSO** (→ `/pro/virtual-cso`) and **OS Engine** (→ `/pro/os-engine`) are clickable; **Reports & Insights** is a non-clickable placeholder with a "Coming Soon" tag.
3. **Non-sequential framing** — no numbered "1→2→3 operating path"; it reads as three related resources.
4. Top CTA **"Talk to your Virtual CSO" → `/pro/virtual-cso`**.
5. The overview's **"Open Intelligence" CTA → `/pro/intelligence`** is wired and works.
6. Virtual CSO / OS Engine pages, their routes, and the sidebar are **unchanged**; design guide unchanged.
7. AOS + parchment-as-signal + width standards; build clean; no dead links.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Navigate to `/pro/intelligence`; click Virtual CSO + OS Engine (resolve), confirm Reports & Insights is inert, click the top CTA (→ Virtual CSO).
3. From the Pro Suite Hub overview, click **Open Intelligence** → confirm it lands on `/pro/intelligence`.
4. Confirm the Intelligence landing reads as a sibling of the Planning/Execution landings.
5. Screenshot the landing + the updated overview.
6. Diff summary of files changed.

---

## Report-back format

Files changed (one-line intent each); the final header/CTA copy used; confirmation the landing mirrors the Planning/Execution template (non-sequential); confirmation of each acceptance criterion; screenshots; anything flagged rather than decided.
