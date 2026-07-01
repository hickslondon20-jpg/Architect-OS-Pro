# Skills & Sandbox Build — Phase 4 Refinement Execution Agent Prompt

> Copy everything below this line into a new Claude Code / Cowork session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **execution agent** for a refinement pass on Phase 4 (Skill Creation & Skills Library UI) of
the ArchitectOS Agent Skills & Document Generation Engine build. Phase 4 itself is complete and
independently verified — this is a follow-up correcting two gaps found after the original execution agent
finished, both confirmed directly with London. You make implementation choices, never design choices. If
something needs a design decision beyond the inputs below, **stop and flag it**.

## Orient first (read these, in order)

1. `.planning/skills-sandbox/phases/04-skill-creation-library-ui/04-04-PLAN.md` — the full spec for both
   parts of this refinement, including exact current-state file/line references and success criteria.
2. `CLAUDE.md` (repo root) — Rule #1 was just revised (2026-07-01): N8N is no longer the default for all
   synthesis. Direct-Anthropic calls colocated in a Python backend service are now the sanctioned default
   for synthesis living inside `python-backend/` — this is the pattern Part A of this refinement uses.
3. `python-backend/services/doc_wiki_synthesis.py` and `python-backend/services/kb_explorer_service.py` —
   the two existing reference implementations of the direct-Anthropic-from-Python-service pattern. Mirror
   their client construction and error handling, don't invent a new shape.
4. `lib/skillsApi.ts` — the full current frontend API surface for skills, including
   `requestGuidedSkillDraft()` (lines 130-148) which Part A changes.
5. `components/pro-suite/virtual-cso/ChatRail.tsx` — the full current ChatRail implementation Part B
   changes (lines 81-152 specifically).
6. `pages/ProSuite/virtual-cso/VirtualCSOWorkspace.tsx` — read this to find where the active compose
   textbox's state lives before wiring Part B's `onUseSkill` callback; don't assume its shape.

## What you build

### Part A — Guided-draft synthesis migration (see 04-04-PLAN.md Part A in full)
Move `requestGuidedSkillDraft`'s synthesis from an N8N-webhook dependency (with a non-AI canned fallback
when unconfigured) to a new `POST /api/skills/guided-draft` endpoint on the Python backend's `skills`
router, calling Anthropic directly. Remove `SKILL_CREATOR_WEBHOOK_URL` and its fallback branch entirely.

### Part B — ChatRail search + insert-into-textbox (see 04-04-PLAN.md Part B in full)
Add a search input to the ChatRail skills view (filtering the already-loaded list client-side). Change the
primary action on a skill row from "navigate to full workspace" to "insert `@{slug} ` into the active
compose textbox and focus it," via a new `onUseSkill` callback prop threaded from wherever the compose
textbox's state actually lives. Keep a secondary way to still reach the full workspace for viewing/editing.

## Hard constraints

- **No global/private scope toggle anywhere in founder-facing UI** — unchanged standing constraint from the
  original Phase 4 work.
- **Do not touch `api/vcso/chat.ts`, `classify()`, `scoreSkill()`, or `detectExplicitSkillInvocation()`** —
  Phase 3 is done and independently verified; this refinement only changes what gets typed into the
  textbox, not how a sent message is routed.
- **Do not build a second skill-creation write path.** The guided-draft flow still terminates in the
  existing `POST /api/skills` (04-01) once `ready: true` — Part A only changes how the *conversation* is
  synthesized, not how the final skill gets saved.
- **Do not build the sandbox tool-calling loop.** Real Anthropic tool-use where a sub-agent invokes a skill
  mid-turn as a callable tool is Phase 7's job, explicitly out of scope here (see 04-04-PLAN.md's "Out of
  scope" section) — inserting `@slug` into a textbox is a UI convenience over Phase 3's already-built
  explicit-invocation path, nothing more.
- **Use ArchitectOS design tokens exactly** (`DESIGN-GUIDE-QUICK.md`) for the new search input — match the
  existing chats-mode search input's styling, don't invent a new visual pattern.

## Done when

Both parts' success criteria (04-04-PLAN.md) are met. Verify Part A with at least one deliberately-forced
malformed-model-response test (not just the happy path), and confirm zero remaining
`SKILL_CREATOR_WEBHOOK_URL` references anywhere in the frontend. Verify Part B by confirming search
filters correctly, the insert action appends (not clobbers) existing textbox content, and the
view/edit-in-full-workspace path still exists.

Report back: a one-paragraph summary; confirmation of each part's success criteria; the exact
prop/state-wiring path used for `onUseSkill` (which component owns the compose textbox, how the callback
reaches it); and confirmation `SKILL_CREATOR_WEBHOOK_URL` is fully removed from the frontend. Then stop —
Phase 5 (Sandbox Infrastructure) is opened from the orchestration thread, not by you.
