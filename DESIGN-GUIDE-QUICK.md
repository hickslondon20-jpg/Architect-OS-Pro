# ArchitectOS Design Guide — Quick Reference

> Condensed working reference for Claude Code design passes.
> Full spec: `../ArchitectOS Beta Launch/ArchitectOS Design System/uploads/ArchitectOS-design-system.md`
> Full CSS tokens: `../ArchitectOS Beta Launch/ArchitectOS Design System/colors_and_type.css`

---

## Color Tokens

### Brand Palette
| Token | Hex | CSS Variable | Use |
|---|---|---|---|
| Obsidian Navy | `#193052` | `var(--aos-obsidian)` | Sidebar bg, dark sections |
| Obsidian Deep | `#11233F` | `var(--aos-obsidian-deep)` | Logo bar, pressed state |
| Obsidian Hover | `#213E63` | `var(--aos-obsidian-hover)` | Hover on dark surfaces |
| Slate Blue | `#335373` | `var(--aos-slate-blue)` | Sidebar hover bg, secondary nav |
| Steel Blue | `#5F7EA3` | `var(--aos-steel-blue)` | Muted text on dark surfaces |
| Deep Teal | `#143E43` | `var(--aos-deep-teal)` | Score rings, confidence states |
| Brass Gold | `#B8922A` | `var(--aos-brass)` | Primary CTA, active nav, accent |
| Brass Soft | `#D4B45F` | `var(--aos-brass-soft)` | Hover/lighter brass |

### Neutral Palette
| Token | Hex | CSS Variable | Use |
|---|---|---|---|
| Parchment | `#F7F4EF` | `var(--aos-parchment)` | Main canvas / page background |
| Parchment Deep | `#EFEAE0` | `var(--aos-parchment-deep)` | Sunken areas, table stripe |
| Cloud White | `#FCFBF8` | `var(--aos-cloud)` | Card surfaces, panels |
| Graphite | `#222B38` | `var(--aos-graphite)` | Primary body text |
| Cool Gray | `#667085` | `var(--aos-cool-gray)` | Metadata, quiet labels |
| Mist | `#E6E8EC` | `var(--aos-mist)` | Hairlines, dividers, borders |
| Sage | `#C7D5CF` | `var(--aos-sage)` | Soft secondary surfaces |

### Semantic Palette
| Token | Hex | CSS Variable | Tint Variable | Use |
|---|---|---|---|---|
| Success | `#2E7D5B` | `var(--aos-success)` | `var(--aos-success-tint)` | THRIVING, on track |
| Warning | `#C79A2E` | `var(--aos-warning)` | `var(--aos-warning-tint)` | AT STAGE, caution |
| Insight | `#3B6EA8` | `var(--aos-insight)` | `var(--aos-insight-tint)` | BELOW STAGE, informational |
| Risk | `#9A5B52` | `var(--aos-risk)` | `var(--aos-risk-tint)` | Critical, at risk |

### Foreground Aliases
```css
var(--fg-1)        /* Graphite — default body text and headings */
var(--fg-2)        /* #3F4A59 — secondary text */
var(--fg-3)        /* Cool Gray — tertiary / metadata */
var(--fg-4)        /* #93999F — placeholder, disabled */
var(--fg-on-dark)  /* Cloud White — text on navy/teal surfaces */
var(--fg-accent)   /* Brass — accent text */
```

### Background Semantic Shortcuts
```css
var(--bg-canvas)   /* Parchment — page/canvas background */
var(--bg-surface)  /* Cloud White — card/panel bg */
var(--bg-sunken)   /* Parchment Deep — inset/table areas */
var(--bg-inverse)  /* Obsidian Navy — sidebar, dark sections */
```

> ⚠️ **Critical:** `--bg-sidebar`, `--aos-slate`, `--aos-steel`, `--aos-teal`, `--aos-fog`, `--aos-ash`, and `--status-*` are NOT defined in the CSS file. Using them produces invisible failures (browser silently ignores undefined variables). Always use the exact names from this table.

---

## Typography

### Fonts
```css
font-family: 'Geist', sans-serif;          /* All UI text */
font-family: 'Geist Mono', monospace;      /* Numbers, metrics, data values */
font-family: 'Instrument Serif', serif;    /* Italic only — editorial/marketing, NEVER dashboards */
```

### Scale (8pt base)
| Label | Size | Weight | Use |
|---|---|---|---|
| Display | 48–72px | 300–400 | Hero statements only |
| H1 | 32px | 500 | Page titles |
| H2 | 24px | 500 | Section headers |
| H3 | 18px | 500 | Card titles, sub-sections |
| Body | 15px | 400 | Primary content |
| Small | 13px | 400 | Supporting / metadata |
| Micro | 11px | 500 | Labels, chips, badges |

### Typography Rules
- Line height: 1.5 for body, 1.2 for headings
- Letter spacing: `-0.01em` for headings, `0.04em` for all-caps labels
- Max line length: 680px (72ch) for reading columns
- Instrument Serif italic triggers: pull quotes, insight headers, editorial callouts only

---

## Spacing System (8pt grid)

```
4px   — micro gap (icon + label)
8px   — tight (within a component)
12px  — snug (related items)
16px  — base (standard padding)
24px  — comfortable (section internal)
32px  — section gap
48px  — major section break
64px  — page-level breathing room
```

---

## Shadow Tokens

```css
var(--shadow-soft-1)   /* Subtle lift: 0 1px 2px rgba(25,48,82,0.04), 0 4px 12px rgba(25,48,82,0.04) */
var(--shadow-soft-2)   /* Medium card: 0 2px 4px rgba(25,48,82,0.06), 0 8px 24px rgba(25,48,82,0.08) */
var(--shadow-raised)   /* Elevated panels: 0 4px 8px rgba(25,48,82,0.08), 0 16px 40px rgba(25,48,82,0.12) */
```

No outer glows. No colored shadows. Shadow base color always derived from `--aos-obsidian` RGB.

---

## Layout

- **Desktop canvas:** 1440px max-width
- **Grid:** 12 columns, 24px gutters
- **Sidebar:** 240px fixed, Obsidian Navy
- **Content area:** fluid, Parchment background
- **Card border-radius:** 8px (standard), 12px (featured)
- **Border color:** `var(--aos-fog)` — `1px solid`

### Width & density (updated 2026-06-19 — approved on the Wind-Down exemplar)
- Working/operational surfaces (hubs, cockpits, grids, trackers) should **use a wider content width** with a **full-width top bar** — the hub/element title + sub-tab nav runs across the screen, not boxed in a narrow card. The strict 1440 single-column default is **superseded for these surfaces**; favor the wider, grid-first proportions of the Wind-Down cockpit.
- **Grid-first, less scroll:** place sections adjacent (two-column cockpits, card grids) so a page reads in fewer screens rather than one long scroll.
- **Reading-measure caveat:** width is for structure / grids / nav / data — keep **body and prose text in a comfortable measure (~70–80ch) inside its card**, never stretched edge-to-edge.
- **Exemplar:** Execution Hub · Wind-Down (two-panel cockpit). Carry this proportion/spacing across the Execution Hub now, and the other areas in later passes.

---

## Component Patterns

### Button — Primary
```css
background: var(--aos-brass);
color: white;
border-radius: 6px;
padding: 10px 20px;
font: 14px/1 'Geist', sans-serif;
font-weight: 500;
/* Class: .aos-btn--primary */
```

### Button — Secondary (Ghost)
```css
background: transparent;
border: 1px solid var(--aos-fog);
color: var(--aos-graphite);
/* Hover: border-color var(--aos-brass) */
/* Class: .aos-btn--ghost */
```

### Status Chip / Badge
```css
/* Class: .aos-chip--brass / .aos-chip--success / .aos-chip--warning */
font-family: 'Geist Mono';
font-size: 11px;
font-weight: 500;
letter-spacing: 0.04em;
text-transform: uppercase;
padding: 3px 8px;
border-radius: 4px;
```

### KPI / Metric Card
- White (`var(--bg-surface)`) card on Parchment canvas
- Number in Geist Mono, large (32–48px), Graphite or Brass
- Label in Geist 12px, Ash, uppercase
- Subtle `--shadow-soft-1` lift
- Thin left border accent in semantic color (optional)

### Sidebar Navigation Item
- Default: Geist 14px, Steel Blue (`#5F7EA3`)
- Hover: background `var(--aos-slate)`, text Cloud White
- Active: Brass Gold text + left border `3px solid var(--aos-brass)`
- Icon + label, 40px row height, 16px horizontal padding

### Dashboard Hero Strip
- Full-width, Obsidian Navy background
- White headline (H1), Steel Blue subtext
- Brass CTA button
- Subtle texture or minimal pattern (no photographic imagery)

### Editorial Callout / Insight Panel
- Cloud White card, left border `4px solid var(--aos-brass)` or `var(--status-insight)`
- Instrument Serif italic for the insight headline (18–22px)
- Geist body text for supporting copy
- No heavy shadow — `--shadow-soft-1` only

---

## Surface Hierarchy (figure/ground — avoid flat parchment)

> The #1 flatness failure is **parchment-on-parchment**: making cards the same tone as the canvas so nothing stands out and every block carries equal weight. Use the surface stack below to create figure/ground and focal points. North star: the Strategic Overview dashboard (`ui_kits/app/index.html`).

| Layer | Token | Role |
|---|---|---|
| **Canvas** | `var(--bg-canvas)` Parchment | Page background **only** — never the card surface |
| **Primary surface** | `var(--bg-surface)` Cloud White | The main cards/containers — they sit *on* parchment and carry the content |
| **Nested / inset** | `var(--bg-sunken)` Parchment Deep | **A signal, not a nesting background** — earns its place ONLY for (1) subsection header bars and (2) open-text / input zones. Never a generic nested fill inside a white card. |
| **Feature / accent** | `var(--bg-inverse)` Obsidian Navy | A contrasting callout used **sparingly**, only when it earns the emphasis (often zero or one per page) — accent, never decoration or large fields |
| **Actions** | Brass primary / ghost-or-navy secondary | One brass primary per screen; ghost/navy for secondary |
| **Status** | Semantic tints / pills | Every chip has a semantic reason (success / warning / insight / risk) |

**Rules:**
- Default a container to **white on parchment**, not parchment on parchment.
- Reserve **navy** for a contrasting callout that genuinely earns the emphasis — used **sparingly** (frequently zero or one per page), never by default, on every page, or as decoration. Don't force a navy box onto a page that doesn't need one.
- **White is the default surface for nested content** (data rows, list items, sub-blocks) — sit them clean on white with a subtle shadow for lift, **not** on parchment.
- **Parchment (`--bg-sunken`) is a signal, not a nesting background.** Use it only for **subsection header bars** (structural dividers) and **open-text / input zones** ("type here"). **No parchment → white → parchment stacking.** An obsidian header bar is a valid higher-weight alternative for those dividers.
- **Obsidian (`--bg-inverse`) earns hero-metric moments** (hard-earned numbers that deserve weight/contrast), plus the occasional sparing feature/callout.
- Brass stays precious — one primary action per screen.
- A page that is all one tone has failed this rule.

---

## Composition Rules

1. **Asymmetric over symmetric** — avoid three equal-width cards. Use 2+1 or 1+2 splits, or a featured card with supporting stack.
2. **Section rhythm** — alternate surface colors between sections (Parchment → Cloud White → Parchment)
3. **Sidebar always Obsidian** — never change sidebar background color
4. **Brass gold is precious** — use for one primary action per screen only
5. **Breathing room** — minimum 48px between major sections
6. **Data density** — Geist Mono for all numbers, right-aligned in tables
7. **No orphan labels** — every chip, badge, and tag must have a semantic color reason

---

## Anti-Patterns (Ship-Blocking)

| ❌ Forbidden | ✅ Use Instead |
|---|---|
| `font-family: Inter` | `font-family: 'Geist', sans-serif` |
| `background: #000` or `#111` | `var(--aos-obsidian)` or `var(--aos-graphite)` |
| `color: #000` | `var(--aos-graphite)` |
| Tailwind `gray-*` classes | AOS token variables |
| Neon / saturated accent colors | Brass Gold or semantic palette only |
| `box-shadow: 0 0 20px rgba(...)` (glow) | `var(--shadow-soft-1)` or `--shadow-soft-2` |
| `background: linear-gradient(...)` on text | Solid color only for text |
| Three equal-width cards in a row | Asymmetric grid or 2+1 layout |
| Instrument Serif on dashboards or data | Geist only for UI; Instrument Serif for editorial |
| `border-radius: 0` on interactive elements | Minimum 4px |
| Default blue links (`#0000EE`) | `var(--aos-brass)` or `var(--status-insight)` |

---

## Target Design Reference

The approved visual target (screenshots in `../ArchitectOS Beta Launch/Platform MVP Visuals/`) shows:

- **Sidebar:** Obsidian Navy (#193052), narrow, fixed. Active item in Brass Gold with left accent bar.
- **Canvas:** Parchment (#F7F4EF), generous whitespace, 12-column grid.
- **Cards:** Cloud White (#FCFBF8) on Parchment, soft shadow, 8px radius.
- **Metrics:** Large Geist Mono numbers, Brass or semantic color. KPI strip at top of dashboards.
- **Roadmap view:** Gantt-style timeline, Obsidian header bar, milestone markers in semantic colors.
- **Insight panel:** Editorial treatment — Instrument Serif italic headline, Brass left border, Cloud White bg.
- **CTAs:** Single Brass Gold primary button per view. Ghost secondary for supporting actions.
- **Status badges:** Uppercase Geist Mono chips — THRIVING (Success green), AT STAGE (Warning amber), BELOW STAGE (Insight blue), AHEAD OF STAGE (contextual).

---

## Phase 5B Design Pass Order

```
TASK-044  Read this file + full design system spec (start of every session)
TASK-045  Apply CSS tokens globally (colors_and_type.css → src/)
TASK-046  Foundations section design pass
TASK-047  Diagnostics section design pass
TASK-048  Pro Suite section design pass
TASK-049  Execution section design pass
TASK-050  Navigation / sidebar alignment
TASK-051  Remove dev-mode artifacts (e.g., "Dev: Force Generate Dashboard" button in Clarity Compass)
```
# ArchitectOS — Design System

**Version:** 1.0
**Brand:** ArchitectOS
**Product category:** Strategic Operating System for scaling agencies
**Primary audience:** Marketing, advertising, and creative-services agency founders scaling from $1M → $20M

---

## 1. Company context

ArchitectOS is an AI-powered growth-transformation and strategic-planning platform. It is positioned as the **strategic layer above** the agency's operating tools (ClickUp, Notion, Asana) — not next to them. The platform helps founders:

- Run a comprehensive financial, operational, and strategic diagnostic
- Map and compare growth scenarios; surface where pressure will appear
- Complete a stage-specific 125-point growth maturity audit
- Build 12 / 24 / 36 month strategic roadmaps
- Plan quarterly **3P Sprints** (Prioritize, Plant, Progressively Iterate)
- Generate a Leadership, Culture & Team Development plan
- Talk to a **Virtual CSO** — an AI strategic partner that knows the business

The five pillars: **Pressure Maps · Maturity Audit · 3P Sprints · Roadmaps · Virtual CSO.**

ArchitectOS is **not** a project manager, an assessment quiz, or a generic SaaS dashboard. It is the strategic layer that decides what the operational tools should be working on.

### The architect metaphor

Architecture is the brand's **mental scaffolding**, not its subject matter. We design strategic plans the way an architect designs buildings — pressure-bearing decisions, sequenced construction, blueprints reviewed by a senior. Use the metaphor as a *sensibility*: hairline grids, brass measurement marks, restrained line work. **Never** literally — no T-squares, drafting tables, hardhats, building photographs.

---

## 2. Brand voice

ArchitectOS sounds like a senior strategic partner, not a productivity app. Calm. Concrete. Operationally grounded.

| Use | Avoid |
|---|---|
| Diagnose pressure | Elevate |
| Sequence the work | Seamless |
| Recalibrate the quarter | Unleash |
| Map constraints | Next-gen |
| Align leadership | Supercharge |
| Turn strategy into coordinated execution | All-in-one |
| Keep strategy in motion | Transform your workflow |
| Identify capacity pressure | Unlock your potential |

**Headline patterns:** "Diagnose pressure. Sequence the work." · "Build clarity into the operating rhythm." · "Keep strategy in motion every quarter."

**Numbers should look real, not perfect.** Use `73.8 / 125`, `31.6% delivery margin`, `77.4% utilization`, `$18.35M revenue forecast`, `3.42x pipeline coverage`, `6 capability risks flagged`. **Never** `99.99%`, `50%`, `100%`, or placeholder names like "Acme" or "John Doe."

---

## 3. Sources

This system is built from three primary inputs:

- `uploads/ArchitectOS-design-system.md` — full text spec for tokens, components, copy library, and anti-patterns. Treat as canonical.
- `uploads/ArchitectOS_Pro_Suite_Positioning.pdf` — 52-page positioning & feature synthesis. Establishes that ArchitectOS is positioned as a *Strategic OS* not a SaaS tool, methodology-first, software-second.
- `uploads/amgp_brand_moodboard_v2 (1).html` — moodboard. Brand essence: **Earned Authority. Architectural Precision. Unstoppable Momentum.** Materials: brushed gold, deep navy, warm leather, slate steel, aged parchment.

---

## 4. Design principles

1. **Architected, not decorative.** Every element earns its place. Hairline borders > drop shadows. Inner lines > outer glows.
2. **Calm density.** Information-rich without feeling cramped. Refined density, not sparse-for-its-own-sake.
3. **Asymmetric composition.** Avoid equal three-card rows. Use varied card sizes, split layouts, horizontal data bands.
4. **Premium restraint.** Brass gold is a **highlight**, not a fill. Color comes from data and structure, not decoration.
5. **Operationally grounded language.** Real numbers, strategic verbs, named modules.
6. **Stage-aware always.** Anything the user sees should reflect *where they are now and what to do next* — not generic dashboard chrome.

### Anti-patterns (forbidden AI-tells)

- Pure black `#000000`
- Inter as the primary typeface
- Outer glows / neon shadows / gradient text
- Generic shadcn buttons / default Material chrome
- Three equal cards in a row
- Oversized H1s
- Cartoon / mascot illustration
- Isometric SaaS-art people
- "Unleash, Elevate, Seamless, Supercharge" copy
- Names like "John Doe" or "Acme Inc."
- Round percentages (50% / 100% / 99.99%)
- Custom mouse cursors
- Decorative serifs inside dashboards

---

## 5. File index

### Foundations
- `colors_and_type.css` — design tokens (color, type, spacing, radii, shadows, motion) + semantic type classes. **Import in every page.**
- `components.css` — buttons, chips, status pills, inputs, switches, tables, fields. **Import alongside the tokens.**

### Previews (visible in the Design System tab)
- `preview/typography.html` — type ramp, editorial italic, mono, semantic blocks
- `preview/colors.html` — primary, neutral, semantic palettes with usage notes
- `preview/spacing.html` — radii, shadows, spacing scale, motion
- `preview/iconography.html` — 1.5 px stroke icon system + product themes
- `preview/brand-mark.html` — logomark, lockups, construction
- `preview/components.html` — buttons, chips, inputs, module cards, pressure-map table

### UI kits (full pages)
- `ui_kits/web/index.html` — marketing site (hero, pillars, methodology, proof)
- `ui_kits/app/index.html` — Strategic Overview dashboard

### Brand assets
- `assets/logo.svg` — primary brand mark
- `assets/icons.html` — copy-paste source SVG for the icon set

### Reference
- `ArchitectOS-Design-System-SKILL.md` — how Claude should design **for** ArchitectOS in future chats

---

## 6. Quick start

```html
<link rel="stylesheet" href="../colors_and_type.css">

<h1 class="aos-display">Diagnose pressure. Sequence the work.</h1>
<p class="aos-body">ArchitectOS helps agency founders keep strategy in motion every quarter.</p>

<button class="aos-btn aos-btn--primary">Run Audit</button>
```
