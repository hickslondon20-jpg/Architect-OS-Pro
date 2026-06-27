# Handoff Task Spec — #14: Full-width + parchment cleanup — Orient & Operate (one page at a time)

> **Status:** Ready for execution.
> **This is a STRICTLY VISUAL pass** — full-width layout + the parchment-as-signal rule. **No logic, content, data, route, or structural changes.**
> **Work ONE page at a time. After each page: build, screenshot, report, and PAUSE — do not start the next page until told to proceed.**
> **Companion docs (read first):** `DESIGN-GUIDE-QUICK.md` — **Width & density** + the **parchment-as-signal** rule (Surface Hierarchy). Use the finished **Wind-Down / Retrospective / Reflection & Review** as the reference for the target width and surface treatment. Log notable surface changes in `docs/execution-hub-audit-inventory.md`.
> **Role boundary:** Executing agent. If you find anything that needs a structural/logic change, **flag it — do not fix it in this pass.**

---

## Why

Orient and Operate were built **before** the Width & density standard and the parchment-as-signal rule were codified. So their content is narrower than the rest of the hub, and they use parchment (`--bg-sunken`) as a generic nested background. Bring them up to the standard the other sections now follow — **and change nothing else.**

---

## The rules to apply (identical on every page)

1. **Full width:** the top bar + the workspace below should match the width of Wind-Down / Retrospective / Reflection (the codified Width & density standard). Keep body/prose at a comfortable reading measure *inside* cards — wide is for structure/grids, not stretched text.
2. **Parchment-as-signal:**
   - **White (`--bg-surface`)** is the **default** surface for nested content (rows, list items, sub-blocks) — clean on white with a subtle shadow for lift.
   - **Parchment (`--bg-sunken`)** ONLY for **subsection header bars** and **open-text/input zones**. **Remove all parchment-as-generic-nesting** (no parchment → white → parchment stacking).
   - **Obsidian (`--bg-inverse`)** for hero-metric moments / the occasional earned feature — sparingly.
3. **Zero regressions:** routes, functionality, content, copy, and behavior stay **identical**. Nothing moved, removed, renamed, or rewired. Only layout width + surface tokens change.

---

## Page-by-page sequence (STOP + report + await go-ahead after each)

**Page A — Orient · Overview** (`OrientOverviewPage.tsx`; also confirm/widen the `OrientLayout` top bar). Apply the rules. → build, screenshot, report, **PAUSE.**

**Page B — Orient · Alignment Tools & Resources** (`OrientAlignmentPage.tsx`). Apply the rules. → build, screenshot, report, **PAUSE.**

**Page C — Operate · Timeline** (`OperateTimelinePage.tsx`; also confirm/widen the `OperateLayout` top bar). Apply the rules. → build, screenshot, report, **PAUSE.**

**Page D — Operate · Status Tracker** (`StatusTracker.tsx`, mounted at `operate/status-tracker`). Apply the rules. → build, screenshot, report, **PAUSE.**

Do not batch. One page, then stop for review.

---

## Out of scope (do not do)

- **No logic / data / content / copy / route / structural changes.** Visual width + surface tokens only.
- **No removing, renaming, or moving** any element. (If something seems to need it, flag — don't do it.)
- **Do not touch** Wind-Down, Retrospective, Reflection, the hub landing, the sidebar, or Planning in this pass.
- **Do not change the design guide.**

---

## Constraints

- AOS tokens only; the Width & density + parchment-as-signal rules govern. TypeScript clean. No new errors/warnings introduced.

---

## Acceptance criteria (per page)

1. The page (top bar + workspace) is **full width**, matching Wind-Down/Retro/Reflection.
2. **Parchment-as-signal applied** — white default nesting w/ shadow; parchment only on header bars / input zones; no generic parchment nesting.
3. **Zero functional/content regressions** — same routes, behavior, copy; nothing moved/removed/renamed.
4. Build clean; no new TS errors.
5. Screenshot provided; **paused for review** before the next page.

---

## Verification (per page, before reporting)

1. Build / typecheck — no new errors.
2. Visually compare width + surfaces against Wind-Down/Retro/Reflection.
3. Click through the page to confirm behavior is unchanged.
4. Screenshot. Then **STOP and report.**

---

## Report-back format (per page)

Page name; file(s) changed (one-line intent); which surfaces moved parchment → white; confirmation of full width + zero functional change; screenshot; anything flagged. Then **wait for go-ahead** before the next page.

---

## Note (not in this pass)

Wind-Down, Retrospective, and the hub landing also predate the parchment-as-signal rule (they're already full width) and still need the parchment cleanup (V-12). They are **out of scope here** per the Orient/Operate focus — flagged so they're folded into a follow-up.
