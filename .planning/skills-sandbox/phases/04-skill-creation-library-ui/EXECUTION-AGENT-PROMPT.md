# Skills & Sandbox Build — Phase 4 (Skill Creation & Skills Library UI) Execution Agent Prompt

> Copy everything below this line into a new Claude Code / Cowork session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **execution agent** for Phase 4 (Skill Creation & Skills Library UI) of the ArchitectOS
Agent Skills & Document Generation Engine build. This is the largest phase so far — three plans, in
order: **04-01 (backend)** → **04-02 (AI-guided flow)** → **04-03 (Skills & Plugins workspace + Virtual
CSO mini-toggle)**. You make implementation choices, never design choices. If something needs a
design decision beyond the inputs below, **stop and flag it**.

**This phase required a mid-planning checkpoint with London before plan files were written — read
`CONTEXT.md` §2 in full.** The original session assumed the Skills Library would sit "alongside Chat
and Documents/Uploads" as top-level areas — that assumption didn't match the live app (neither exists
as a top-level area). London resolved this directly: a **fourth intelligence peer workspace**
("Skills & Plugins," working name — exact copy is a lightweight open item) housing both the full
library and both creation surfaces, **plus** a lightweight Chats/Skills toggle inside Virtual CSO's
`ChatRail` for quick browsing. She also deferred to the Orchestration Agent's recommendation on the
AI-guided flow's architecture (a dedicated surface, not a Virtual CSO chat retrofit).

## Orient first (read these, in order)

1. `.planning/skills-sandbox/phases/04-skill-creation-library-ui/04-RESEARCH.md` — live verification:
   the IA mismatch, the real SKILL.md frontmatter shape (confirmed against an actual installed
   skill — `name`/`description` base fields only), no existing ZIP handling anywhere, no existing
   tool-loop in Virtual CSO chat.
2. `.planning/skills-sandbox/phases/04-skill-creation-library-ui/CONTEXT.md` — both open questions
   from research, and exactly how London resolved them (§2). This is not a hypothetical or a proposal
   — both are confirmed decisions.
3. `04-01-PLAN.md`, `04-02-PLAN.md`, `04-03-PLAN.md` (same folder) — the three build specs, in order.
4. `.planning/skills-sandbox/CONTEXT.md` §5, §6 — the project-wide decisions this phase implements
   (SKILL.md-native storage, no global/private toggle anywhere in founder-facing UI).
5. `.planning/skills-sandbox/phases/01-schema-storage-foundation/` and
   `.planning/skills-sandbox/phases/03-skill-discovery-routing/` — the schema and routing this phase
   builds on top of; both done and independently verified.
6. `DESIGN-GUIDE-QUICK.md` (repo root) — canonical design tokens for every new UI surface.
7. `CLAUDE.md` (repo root) — Critical Architecture Rule #1: all synthesis routes through N8N *except*
   the Virtual CSO streaming chat endpoint. The AI-guided creation flow (04-02) is **not** that
   exception — confirm it routes through N8N like other synthesis, don't give it a new direct
   Anthropic call path by default.

## What you build

### Plan 04-01 — Backend (do first)
`POST /api/skills`, `PATCH /api/skills/{id}`, `DELETE /api/skills/{id}` (founder-owned rows only,
never accepting a client-supplied `scope`); `parse_skill_md`/`serialize_skill_md` helpers (verify
round-trip losslessness yourself, don't defer to later plans); `POST /api/skills/import` and
`GET /api/skills/{id}/export` (ZIP ↔ `skill_packs` + `skill_files` + `skill-files` bucket), on the
Python backend, mirroring `/api/ingest`'s existing pattern.

### Plan 04-02 — AI-guided creation flow
A dedicated, bounded conversational flow (not Virtual CSO chat) that ends by calling 04-01's `POST
/api/skills`. Route its synthesis calls through N8N per the architecture rule above. Does not touch
`api/vcso/chat.ts`.

### Plan 04-03 — Skills & Plugins workspace + Virtual CSO mini-toggle
Fourth peer route at `/pro/intelligence/skills` (new `FeatureKey`, updated `IntelligenceLanding.tsx`
copy from "three" to "four," full library + both creation surfaces). Plus a Chats/Skills toggle in
`ChatRail.tsx` above the existing "New chat" button (~line 69), showing a condensed, browse-only
skill list that links out to the full workspace.

## Hard constraints

- **No global/private toggle anywhere in any founder-facing UI in this phase.** Scope is always
  `is_admin`-derived, never a user control — this was confirmed twice now (Phase 1 amendment, and
  implicitly reaffirmed here). If you find yourself wanting to add one "just for admins to use," stop
  — admins create global content via bulk CSV/direct Supabase access, not this UI (Phase 1 CONTEXT.md
  §2, and the project-root CONTEXT.md Amendments section).
- **Do not modify `api/vcso/chat.ts`, `classify()`, or `detectExplicitSkillInvocation()`.** Phase 3 is
  done and independently verified; this phase only needs to confirm a newly-created skill flows
  through that existing routing unchanged.
- **Do not give the AI-guided flow (04-02) a new direct-Anthropic streaming path** without confirming
  it against `CLAUDE.md`'s architecture rule first. The Virtual CSO streaming exception was a
  specific, deliberate, documented decision — this flow doesn't need streaming, and defaulting to "just
  reuse the Virtual CSO pattern" would silently create a second undocumented exception.
- **One skill-creation write path underneath all three creation surfaces** — manual form, AI-guided
  flow, and ZIP import all terminate in 04-01's `POST /api/skills` (or its import equivalent). Do not
  build a second, parallel row-creation path for any of them.
- **Use ArchitectOS design tokens exactly** (`DESIGN-GUIDE-QUICK.md`) for every new UI surface — no
  Inter, no pure black, no Tailwind default grays, no three-equal-width-card rows.

## Done when

All success criteria across all three plan files are met. Verify the SKILL.md round-trip, the
cross-founder CRUD isolation, the ZIP import/export end to end (not just reading the code), the "no
scope toggle anywhere" constraint by inspection of every new UI surface, and — critically — that a
skill created through each of the three paths is immediately usable in Virtual CSO chat via both
ranked `classify()` and `@slug` with zero changes to Phase 3's code.

Report back: a one-paragraph summary; confirmation of each plan's success criteria; the final
name/copy chosen for the fourth peer (if different from the "Skills & Plugins" working name);
confirmation of the N8N-routing check for 04-02; and anything about the `ChatRail` toggle's condensed
list implementation (new endpoint vs. direct scoped query) worth noting for future phases. Then stop
— Phase 5 (Sandbox Infrastructure) is opened from the orchestration thread, not by you.
