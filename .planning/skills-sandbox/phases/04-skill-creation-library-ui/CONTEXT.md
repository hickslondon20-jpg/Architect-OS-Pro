# Phase 4 Context — Skill Creation & Skills Library UI

**Written:** 2026-07-01, by the Orchestration Agent, after the `04-RESEARCH.md` verification pass.
**Status: both open questions resolved by London (2026-07-01) at the checkpoint.** Full plan files
follow this document.

---

## 1. Domain

Let founders create skills three ways (manual form, AI-guided conversation, SKILL.md ZIP import),
export a skill as a SKILL.md ZIP, and browse global + own skills in a dedicated UI surface.
Traces SKILL-01–04, SKILL-07.

## 2. Decisions — locked vs. open

**Locked (carried from project `CONTEXT.md` §5, not reopened):**
- `skill_packs.body` is natively authored/stored in SKILL.md format — confirmed 2026-07-01.
- No global/private toggle exposed to founders anywhere in this UI — scope is `is_admin`-derived
  only (Phase 1 amendment, 2026-07-01).
- All three creation paths ship together for beta, not staged.

**Resolved by this research pass (high confidence, not re-litigating unless London disagrees):**
- **SKILL.md export shape:** `name` + `description` (base-standard fields, map directly to existing
  columns) plus ArchitectOS-specific columns (`domain`, `skill_kind`, `trigger_tags`,
  `required_platform_context`) as additional custom frontmatter keys. Import requires only
  `name`/`description`; ArchitectOS-specific keys optional with sensible defaults, so a genuinely
  third-party/vanilla SKILL.md still imports (`04-RESEARCH.md` §2).
- **ZIP handling lives server-side (Python backend),** mirroring the existing `/api/ingest`
  pattern — `/api/skills/import` and `/api/skills/{id}/export` — not a client-side JS ZIP library.
  Nothing in the codebase does ZIP handling today; this is new code using Python's stdlib `zipfile`,
  not a new dependency (`04-RESEARCH.md` §3).

**Resolved by London at the checkpoint (2026-07-01):**

1. **IA placement — hybrid, both pieces confirmed:**
   - **Primary home: a fourth intelligence peer**, its own full workspace — working name **"Skills &
     Plugins"** (exact naming/copy is a lightweight open item for a later design pass, not an
     architecture blocker) — at `/pro/intelligence/skills`, following the exact `FeatureGate`-wrapped
     route pattern already used for `virtual-cso`/`os-engine`/`domain-agents`. This workspace holds
     **both** the full Skills Library (browse global + own) **and** the creation surfaces (manual
     form + AI-guided flow) — deliberately not split across two places, so skill development doesn't
     feel "jam-packed" inside another tool. `IntelligenceLanding.tsx`'s "three peers" copy becomes
     "four."
   - **Secondary: a lightweight entry point inside Virtual CSO itself.** A "Chats / Skills" toggle
     in `ChatRail.tsx` (`components/pro-suite/virtual-cso/ChatRail.tsx`), positioned above the
     existing "New chat" button (line ~69), switches the rail's list view between the current
     chat/project list and a **condensed** skill-library view (read-only browse, not creation) —
     scoped to the same global + own-private list Phase 3's `loadIpLayer()` already produces. This is
     a quick-glance/quick-invoke surface for while a founder is mid-chat, not a second place to build
     or manage skills — it should link out to the full Skills & Plugins workspace for anything beyond
     browsing.
2. **AI-guided creation flow architecture — Orchestration Agent's recommendation adopted** (London
   expressed no specific preference, deferring to the lower-risk option): a **separate, dedicated
   skill-creation conversational surface** — a structured multi-turn form-like flow living inside the
   new Skills & Plugins workspace, not a retrofit of Virtual CSO chat's tool-calling. Does not touch
   `api/vcso/chat.ts` or anything verified in Phases 2–3.

## 3. Canonical Refs

- `.planning/skills-sandbox/CONTEXT.md` §5, §6.
- `.planning/skills-sandbox/REQUIREMENTS.md` — SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-07.
- `.planning/skills-sandbox/ROADMAP.md` — Phase 4 section.
- `04-RESEARCH.md` (this folder).
- `DESIGN-GUIDE-QUICK.md` (repo root) — canonical design tokens; already in live use in
  `IntelligenceLanding.tsx`, confirmed current.

## 4. Code Context

- `App.tsx` lines 243–269 — the `/pro/intelligence` route block; the new `skills` route sits here,
  following the exact `FeatureGate`-wrapped pattern used for `virtual-cso`/`os-engine`/`domain-agents`.
- `lib/featureGates.ts` — `FeatureKey` union, `FEATURE_GATES` record, `PATH_FEATURE_GATES` array — add
  a `skills_library` (or similar) key following the `virtual_cso`/`os_engine` pattern exactly.
- `pages/ProSuite/IntelligenceLanding.tsx` — the "three peers" tile picker; add a fourth tile, update
  the "three" → "four" copy (both the eyebrow-adjacent header text and the resource-card intro).
- `python-backend/main.py` `/api/ingest` (line 494) — the precedent pattern for new
  `/api/skills/import`/`/api/skills/{id}/export` endpoints.
- `api/vcso/chat.ts` — confirmed no tool-loop exists; **do not modify this file in Phase 4** — the
  AI-guided creation flow is a separate surface entirely, per the confirmed decision above.
- `components/pro-suite/virtual-cso/ChatRail.tsx` — the "New chat" button is at line ~69
  (`onClick={onNewChat}`, brass-filled button). The Chats/Skills toggle sits directly above this,
  inside the same rail header block. `getPinnedChats`/`getRecentChats` (from `lib/virtualCsoApi.ts`)
  are the existing list-rendering precedent to mirror for the condensed skills list.

## 5. Specifics

This phase splits into three plans:

**04-01 — Backend:** `skill_packs` CRUD for the manual form (create/update/delete scoped to the
founder's own rows — RLS from Phase 1 already enforces ownership, so this is mostly thin route
handlers); SKILL.md parse/serialize helpers (frontmatter ↔ `name`/`description`/ArchitectOS-extension
columns, `body` = markdown as-is, per `04-RESEARCH.md` §2); `/api/skills/import` and
`/api/skills/{id}/export` on the Python backend (ZIP ↔ `skill_packs` row + categorized `skill_files` +
`skill-files` bucket uploads, per `04-RESEARCH.md` §3).

**04-02 — AI-guided creation flow:** a new, dedicated conversational surface (not Virtual CSO chat)
inside the Skills & Plugins workspace — structured multi-turn flow that ends by calling the same
create-skill backend path 04-01 builds for the manual form (one creation code path underneath, two
front-doors — do not build a second, parallel skill-creation write path).

**04-03 — Skills & Plugins workspace + Virtual CSO mini-toggle:** the fourth intelligence peer route
(`/pro/intelligence/skills`) housing the full library (global + own, ArchitectOS design tokens,
asymmetric layout) and the manual creation form; plus the `ChatRail.tsx` Chats/Skills toggle and its
condensed library view, linking out to the full workspace.
parse/serialize + ZIP import/export endpoints; (04-02) the AI-guided creation flow; (04-03) the Skills
Library UI surface + manual creation form, in whichever IA location is chosen.

## 6. Deferred (explicitly not this phase's job)

- Sandbox, artifacts (Phases 5–7).
- Any change to `classify()`/routing (Phase 3, done) — a newly created skill becomes usable via
  existing routing with zero changes needed here.
- Admin panel UI for the `is_admin` flag (deferred, v2 per Phase 1 CONTEXT.md).

---
*Context written: 2026-07-01 — Orchestration Agent, post-research, pre-checkpoint.*
