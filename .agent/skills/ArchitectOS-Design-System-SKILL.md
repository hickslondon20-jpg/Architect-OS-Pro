# SKILL.md — Designing **for** ArchitectOS

This file tells Claude how to do design work in this project. Read it first when the user asks for new screens, marketing pages, decks, prototypes, or any artifact branded as ArchitectOS.

---

## What ArchitectOS is (in one sentence)

A **strategic operating system** for marketing, advertising and creative-services agencies scaling from $1M → $20M — the layer **above** ClickUp / Notion / Asana that decides what should be on the operating board this quarter. Five pillars: **Pressure Maps · Maturity Audit · 3P Sprints · Roadmaps · Virtual CSO.**

It is **not** a project manager, an assessment quiz, or a generic SaaS dashboard.

---

## Always start here

1. Read **`README.md`** — context, voice, anti-patterns.
2. Import **`colors_and_type.css`** and **`components.css`** in every page.
3. Look at the live previews to anchor visually:
   - `preview/typography.html` · `preview/colors.html` · `preview/spacing.html`
   - `preview/components.html` · `preview/iconography.html` · `preview/brand-mark.html`
   - `ui_kits/app/index.html` (dashboard reference)
   - `ui_kits/web/index.html` (marketing reference)
4. Use real ArchitectOS language. The voice cheat-sheet lives in README §2.

---

## Design DNA (non-negotiables)

- **Earned authority, architectural precision, unstoppable momentum.** Calm, premium, considered. Never excited, generic, or "elevated."
- **Architected, not decorative.** Hairline borders > drop shadows. Inner lines > outer glows. Brass is a *highlight*, never a fill.
- **Calm density.** Information-rich, never cramped. Refined density, not sparse-for-its-own-sake.
- **Asymmetric composition.** Avoid three-equal-cards-in-a-row. Use varied widths, split layouts, horizontal data bands. The marketing-site pillars row uses a **5/7 + 4/4/4** rhythm — copy that pattern.
- **Stage-aware always.** Whatever is on screen should reflect *where the user is now and what's next* — never generic dashboard chrome.

---

## Token & component shortcuts

```html
<link rel="stylesheet" href="colors_and_type.css">
<link rel="stylesheet" href="components.css">
```

Most-reached-for tokens:

| Need | Token / class |
|---|---|
| Canvas | `var(--bg-canvas)` (parchment) |
| Card surface | `var(--bg-surface)` (cloud) on `var(--bg-canvas)` |
| Inverse / nav / hero proof bg | `var(--aos-obsidian)` |
| Primary action | `.aos-btn.aos-btn--primary` |
| Premium / "Reviewed by CSO" | `.aos-btn--brass` · `.aos-chip--brass` |
| Status pills | `.aos-chip--ontrack` `--watch` `--risk` `--insight` `--complete` `--paused` `--notstarted` |
| Stage label | `.aos-chip--stage` (e.g. `Stage · Thriving`) |
| Eyebrow | `.aos-eyebrow` (11px, +0.18em tracking, uppercase) |
| Editorial italic moment | `font-family: var(--font-editorial)` (Instrument Serif, italic only) |
| Mono / numeric | `var(--font-mono)` (Geist Mono) — timestamps, ids, deltas |
| Hairline divider | `border: 1px solid var(--aos-mist)` |
| Card shadow | `var(--shadow-soft-1)` — never invent your own |
| Focus ring | `var(--shadow-focus-ring)` (brass at 22%) |

The numeric scale — when in doubt, **steal from the live previews**, don't invent.

---

## Type rules

- **Geist** for everything UI. **Geist Mono** for timestamps, deltas, ids, "v 4.2".
- **Instrument Serif** is editorial only — italic — used as a *single phrase* inside a sans headline (`<em>not your only constraint</em>`). Never inside dashboards. Never as body copy. Never set roman.
- Headlines max out around 62px on marketing, 30px in app. Display weight is **500**, never 700/800.
- Tracking: −1.4px on huge marketing H1s, −0.5px on display, −0.3px on H1, 0 on H2 down. Tighter never looks better.
- `text-wrap: balance` on every headline.
- **Forbidden**: Inter, system fonts, decorative serifs, oversized H1s, gradient text.

---

## Color rules

- Pure `#000000` is forbidden. Use `var(--aos-obsidian)` or `var(--aos-ink)`.
- **Brass** (`#B8922A`) is for: focus rings, single accent strokes, the "OS" in the wordmark, "Reviewed by CSO" moments, key marks on dark surfaces. **Never** as a button fill except on the `--brass` button. **Never** as body text.
- Status colors come *only* from the semantic palette (`--aos-success`, `--aos-warning`, `--aos-risk`, `--aos-insight`). Don't invent new ones.
- Data viz: navy → slate → steel → teal — that's the chart ramp. Brass is a single highlight, not a series color.

---

## Iconography

- 1.5px stroke, 24px grid, rounded caps, `currentColor`. Strokes only — no filled glyphs, no AI-sparkle, no lightning bolts.
- Reuse the set in `assets/icons.html` and `preview/iconography.html`.
- If you need a new icon: thin-line, geometrically restrained, themes of *pressure / maturity / sprint / roadmap / leadership.* Never cartoony.

---

## Composition patterns to copy

- **Hero (marketing):** asymmetric 1.25fr / 1fr split. Left = eyebrow → display headline (with one italic editorial phrase + one brass word) → lede → CTA pair → proof meta. Right = a stack of three offset "blueprint cards" (parchment / navy / parchment) with corner registration ticks.
- **Dashboard page header:** eyebrow with quarter context → 30px H1 with one italic phrase → optional segmented quarter/12mo/24mo/36mo control on the right.
- **KPI strip:** 1.4fr score-ring card + 3 narrow KPIs. Score-ring card uses the parchment gradient `linear-gradient(180deg, #FCFBF8 0%, #F4EFE3 100%)` and brass eyebrow.
- **Two-column work zone:** 1.6fr pressure-map card + 1fr Virtual-CSO insight stacked over a 3-column 3P sprint board.
- **Roadmap:** 4-quarter swimlane with `NOW` brass dashed line. One brass-bordered bar per row marks the strategic anchor.
- **Editorial quote section:** parchment surface, 1px brass top rule, full-width Instrument Serif italic blockquote (~46px) with one sans phrase mid-sentence in `<span>`. Cite with mono initials avatar.

---

## Voice cheat-sheet

Use: *Diagnose pressure. Sequence the work. Recalibrate the quarter. Map constraints. Align leadership. Architected.*
Avoid: *Elevate. Unleash. Seamless. Supercharge. Next-gen. Transform your workflow. Unlock potential.*

Headline patterns that always land:
- "Diagnose pressure. Sequence the work."
- "The strategic layer **above** your operating tools."
- "Methodology first. **Software** second."
- "Numbers that look **real**, not **perfect**."

---

## Numbers — make them look real

Use: `73.8 / 125`, `31.6%`, `77.4%`, `$18.35M`, `3.42×`, `+6.2 pts`, `8.4 / 10`, `92 agencies`.
Never: `99.99%`, `50%`, `100%`, `10x`, `Acme`, `John Doe`, `customer@example.com`. Never round to a marketing-clean number.

---

## Anti-patterns (forbidden — ship-blocking)

- Pure black; gradient text; outer glows; neon shadows
- Inter; default shadcn / Material chrome
- Three equal cards in a row; oversized H1s
- Cartoon / mascot / isometric SaaS-art people; building photographs; T-squares; hardhats
- Custom mouse cursors
- Decorative serifs *inside* dashboards (Instrument Serif is marketing-only, italic-only)
- "Unleash / Elevate / Seamless / Supercharge"
- "Acme" / "John Doe" / round percentages
- AI-sparkle ✨, lightning ⚡, rocket 🚀, brain 🧠 emoji or icons
- Pages that look like project managers — ArchitectOS sits *above* them

---

## When in doubt

- Open `ui_kits/app/index.html` and `ui_kits/web/index.html`. Match those.
- The architect metaphor is **sensibility, not subject matter**: hairline grids, brass ticks, registration marks, restrained line work. **Never** a literal blueprint, T-square, or hardhat.
- One italic editorial phrase per headline. One brass accent per surface. One Virtual-CSO insight per workspace view. Restraint is the point.