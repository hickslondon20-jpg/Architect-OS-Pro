# Domain Agents — Wireframe & Page Skeleton Spec

**Platform:** ArchitectOS Pro Suite
**Area:** Domain Agents (third intelligence layer)
**Version:** 0.1 — Working Spec (for wireframe build)
**Date:** June 25, 2026
**Status:** Aligned skeleton; companion to `DomainAgents_Product_Vision.md`
**Consumer:** Wireframe / front-end build agent

---

## 0. Scope of this spec

This document defines the **page structure, surfaces, components, states, flows, and data objects** for the Domain Agents area. It is a *what and where* spec for producing a wireframe — not a backend or visual-design spec.

Out of scope here (handled elsewhere / later): n8n orchestration, Supabase schema, prompt/skill content, and final visual design (colors, type, spacing per the ArchitectOS Design System).

Design tokens for the eventual visual pass live in `ArchitectOS Design System/`. Hold to the platform pattern: Obsidian navy sidebar (`#193052`), Brass Gold (`#B8922A`) active states, Parchment canvas (`#F7F4EF`), Cloud White (`#FCFBF8`) card surfaces, Geist / Geist Mono type, Instrument Serif italic for editorial accents only.

---

## 1. Navigation model

Domain Agents is a **primary Pro Suite section**, peer to Virtual CSO and OS Engine in the main nav.

Inside the section, one nav bar exposes **four top-level surfaces**:

1. **Agents** — the gallery (section landing)
2. **Tasks** — the Kanban tracker
3. **Artifacts** — the artifacts library
4. *(Agent Profile and Agent Workspace are drill-in surfaces, not top-level tabs.)*

**Usage is NOT a tab here.** AI-usage reporting is a **global platform page** (lives in Settings, covers OS Engine + Virtual CSO + Domain Agents). This area links out to it; it does not own it.

---

## 2. Surface — Agent Gallery (section landing)

**Purpose:** Choose an agent. Agent-first, clean.

**Components:**

- **Agent grid** — five cards, one per discipline: Financial, Client, Operational, Team, Stewardship. Each card:
  - Agent identity: name, icon, discipline color.
  - One-line discipline statement (e.g., "Interprets any financial evidence placed in front of it").
  - A short "what it's good at" line.
  - A light activity hint (e.g., "3 artifacts · last run 2d ago").
  - Click target → that agent's **Profile**.
- **Recent Tasks strip** — a compact, secondary row at the **top of the gallery, above the agent grid**, giving quick re-entry into recent tasks across all agents. Each entry: task title, agent, status chip, timestamp; click → resumes the task in its **Workspace**. This is a convenience strip only — it must not visually compete with the agent cards.

**State notes:** Empty state (no recent tasks) hides the strip. Agent cards always present (the five are fixed).

---

## 3. Surface — Agent Profile (drill-in)

**Purpose:** Orientation + ignition. No execution happens here.

**Components (top → bottom):**

- **Header** — agent identity + full discipline description.
- **What it does** — the agent's **Capabilities** as orientation groupings (Analyze / Create / Plan). Communicates range without exposing raw skills.
- **Thought starters** — suggested prompts/questions that orient the founder and point toward available workflows. These are *prompts*, not actions — selecting one routes into the appropriate workflow or a scoped free-form ask.
- **Workflows shelf** — the primary action zone. Each workflow is a card: plain-language name (e.g., "Produce a Monthly P&L Assessment") + a one-line description. Click → launches the workflow, which **creates a task** and opens the **Workspace**.
- **Free-form ask** — an input that lets the founder describe a custom request. The agent maps it to existing skills/workflows, or reasons about what it can assemble for a net-new request (see §7). Every free-form ask is **logged to request-capture**.
- **Recent activity (this agent)** — this agent's recent tasks and artifacts, for quick re-entry. Scoped to the agent.

**Hidden by design:** skills, templates, internal workflow steps.

---

## 4. Surface — Agent Workspace (drill-in, the building layer)

**Purpose:** Run a task to completion. Reuses Virtual CSO chat components, but **task-bound**.

**Layout (two-pane):**

- **Main pane — conversation thread:**
  - Agent opens by stating its plan: what it will do, what it needs.
  - Asks clarifying questions; requests uploads/resources inline.
  - Founder attaches resources here → saved to storage + referenced by the task.
  - Founder can ask questions about what the agent produces (scoped — not open brainstorming).
- **Right pane — artifact render panel:**
  - Live HTML-rendered preview of the artifact as the markdown is produced.
  - Collapsible; appears/updates as the artifact takes shape.
- **Header / task meta bar:**
  - Which agent, which workflow, the task instance ID/title, current **status** (maps to Kanban state), and attached resources.
- **Progress indicator:**
  - "Going to do → in progress → done → waiting on you." Drives, and is driven by, the Kanban state.
- **Completion actions (when status = Review/Done):**
  - **Download** artifact.
  - **Add to Second Brain** (promote synthesis and/or artifact to OS Engine ingestion — see §8).

**Entry points into this surface:** (a) launching a workflow from a Profile, (b) clicking a Kanban card, (c) Virtual CSO invocation of an agent. All three resolve to the same workspace + task.

---

## 5. Surface — Tasks (Kanban)

**Purpose:** Cross-agent view of every job and its state.

**Components:**

- **Board** with columns (see state machine §6): **Ready → Running → Review → Blocked → Done**. (No "Triage" — tasks are deliberately founder-launched.)
- **Filters:** by agent, status, date. Search by task title.
- **Card anatomy:** task title, agent (icon/color), originating workflow, status, prominent **"waiting on you"** flag when Blocked, created/updated timestamps.
- **Card click → Agent Workspace** at that task.

The Kanban and the Workspace are two windows on the same task object; status is shared, not duplicated.

---

## 6. Kanban state machine (explicit)

Card movement is **systematic and automatic** (driven by task events), and **non-linear**.

**States:**

- **Ready** — task created/queued, not yet started.
- **Running** — agent actively working.
- **Blocked** — agent is waiting on the founder (a resource, an answer, an upload). This is the same event as the workspace resource-prompt; surfaces as "waiting on you."
- **Review** — artifact drafted; awaiting founder review/acceptance before final. The deliberate stopping point for every artifact.
- **Done** — terminal; founder has accepted/finalized.

**Allowed transitions:**

- Ready → Running (start / resources satisfied)
- Running → Blocked (agent needs founder input)
- Blocked → Running (founder provides input)
- Running → Review (draft artifact ready)
- Review → Done (founder accepts)
- Review → Running (founder requests changes — a revision simply **re-enters Running**; there is no separate revision state)
- Running → Done (only for workflows that need no review gate — confirm whether any qualify)

**Who triggers transitions:** mostly the system/agent (Ready→Running, Running→Blocked, Running→Review). Founder triggers Blocked→Running (by responding) and Review→Done (by accepting).

---

## 7. Free-form ask + request capture

**Behavior:**

1. Founder submits a free-form request on an Agent Profile.
2. Agent attempts to **map** it to an existing workflow or composition of existing skills.
3. If mappable → runs as a task like any workflow.
4. If **net-new** (no workflow covers it) → agent reasons about what it has access to, what it can create, and what it needs, then either assembles a scoped one-off or explains the limit. *(The exact guardrails for out-of-scope execution are an open product/safety decision — see §10.)*
5. **Every** free-form ask is written to a **request-capture log**: the raw request, mapped/unmapped, agent, timestamp.

**Why it matters:** the request-capture log is both a UI behavior and a **product-roadmap instrument** — the accumulating record of unmet demand directly informs which new skills, workflows, and templates to build next.

---

## 8. Second-brain promotion

- On task completion, the founder can **Add to Second Brain** from the Workspace and from the Artifacts library.
- Promotion sends the **task synthesis and/or the artifact** into OS Engine ingestion → stored and referenced in future conversations across the platform.
- **Open decision:** auto-ingest every artifact vs. deliberate promotion. **Recommended: deliberate**, to keep the second brain high-signal and avoid polluting it with overlapping draft/variant artifacts (e.g., the April–May and May–June tasks).

---

## 9. Surface — Artifacts Library

**Purpose:** The vault of everything produced. Gated to the founder's own files.

**Components:**

- **Filter/sort:** by agent, artifact type (brief / memo / review / audit / analysis), date, originating workflow.
- **Views:** grid with preview thumbnails and/or table (title, type, agent, source session/task, date) — mirror the Hermes artifacts pattern.
- **Preview mode:** HTML render shown before download.
- **Row/item actions:** open/preview, **download**, **delete**, **Add to Second Brain** (if not already promoted), and a **provenance link** back to the originating task → workflow → agent.

**Gating:** strictly the authenticated founder's artifacts (beta is founder-only; access via `beta_cohort_week` / `beta_feature_gates`). No team/shared views.

---

## 10. Cross-surface connections

- **OS Engine (read):** during a task, the agent first checks OS Engine / knowledge tables for needed context before prompting the founder.
- **OS Engine (write):** second-brain promotion feeds artifacts/synthesis back in.
- **Virtual CSO:** can invoke an agent (`@FinancialAgent …`); the invocation spawns a task in the **same** plumbing and appears in the same Kanban + Artifacts library.
- **Usage (global):** linked out to the Settings-level AI-usage page.

---

## 11. Data objects & relationships (for the wireframe's mental model)

> Not a DB schema — the object model the UI must reflect.

- **Agent** (5 fixed) — has Capabilities, Workflows, Knowledge refs.
- **Capability** — user-facing grouping of workflows/actions (Analyze/Create/Plan). Presentation only.
- **Workflow** — definition; ordered chain of Skills; targets a Template. Surfaced as a package.
- **Skill** *(internal)* — atomic operation; reused across workflows. Not shown to founders.
- **Template** *(internal)* — output contract for an artifact type. Not shown to founders.
- **Task** — a single **run** of a Workflow. Has status (Kanban state), attached resources, a workspace thread. `Workflow 1→N Tasks`.
- **Artifact** — output of a Task; rendered (markdown→HTML), stored, gated. Carries provenance (task/workflow/agent/template). `Template 1→N Artifacts`.
- **Request-capture entry** — logged free-form ask (raw text, mapped/unmapped, agent, timestamp).

---

## 12. Open decisions (carry into spec finalization)

1. **Out-of-scope guardrails** — how far a net-new free-form request may go before it must defer to roadmap. (Product + safety.)
2. **Auto-ingest vs. deliberate promotion** to the second brain (recommended: deliberate).
3. **Usage page** — confirm it lives in global Settings and the exact link affordance from this area.
4. **Review-gate skips** — confirm whether any workflows are allowed to go Running→Done with no Review gate.

**Resolved (June 25, 2026):** A revision re-enters **Running** (no separate revision state, kept simple for now). The **Recent Tasks strip sits at the top** of the gallery.

---

## 13. Handoff notes (for the wireframe build agent)

- Produce wireframes for: **Agent Gallery**, **Agent Profile**, **Agent Workspace** (with render panel), **Tasks/Kanban**, **Artifacts Library**. Plus the **Settings → AI Usage** link target as a stub.
- Reuse Virtual CSO chat components for the Workspace thread and the right-pane render panel.
- Reuse the existing Pro Suite shell (sidebar nav, canvas, card surfaces) per the ArchitectOS Design System.
- Keep skills and templates **invisible** in all founder-facing screens.
- Treat the Kanban state machine in §6 as the source of truth for card states and transitions.
- This is a working skeleton — annotate, don't finalize; we expect iteration through the beta.
