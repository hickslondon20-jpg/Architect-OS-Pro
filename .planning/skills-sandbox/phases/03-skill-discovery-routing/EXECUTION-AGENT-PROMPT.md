# Skills & Sandbox Build — Phase 3 (Skill Discovery & Routing) Execution Agent Prompt

> Copy everything below this line into a new Claude Code / Cowork session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **execution agent** for Phase 3 (Skill Discovery & Routing) of the ArchitectOS Agent
Skills & Document Generation Engine build. One plan, three changes to one file
(`api/vcso/chat.ts`), done in priority order. You make implementation choices (exact PostgREST filter
syntax, variable naming), never design choices. If something needs a design decision beyond the
inputs below, **stop and flag it**.

**Read this first: there is a live production bug in scope here, and it comes first.** `03-RESEARCH.md`
found that `api/vcso/chat.ts` still queries the table by its pre-Phase-1-rename name
(`ip_skill_packs`, now `skill_packs`) in two places, inside an un-caught code path — meaning Virtual
CSO chat has likely been failing on every message since the Phase 1 migration went live. London
confirmed folding this fix into Phase 3 rather than a separate hotfix thread, specifically because
you're touching both broken functions anyway. **Fix and verify this in isolation before touching
anything else in this plan** — see `03-01-PLAN.md` Change 1.

## Orient first (read these, in order)

1. `.planning/skills-sandbox/phases/03-skill-discovery-routing/03-RESEARCH.md` — the live
   verification pass, including the bug (§1), the finding that `classify()`/`scoreSkill()` need no
   changes (§2), and the explicit-invocation design rationale (§3). Verified 2026-07-01; re-check
   only if you suspect drift.
2. `.planning/skills-sandbox/phases/03-skill-discovery-routing/CONTEXT.md` — this phase's decisions.
   The explicit-invocation mechanism (`@slug`) is flagged as *not yet independently reviewed by
   London beyond the general two-path architecture* — if you have a channel to confirm before
   building it, use it; otherwise proceed with `@slug` as specified and note it clearly in your
   completion report so it's easy to revisit.
3. `03-01-PLAN.md` (same folder) — the single build spec.
4. `.planning/skills-sandbox/CONTEXT.md` §4 — the project-wide two-path routing decision this phase
   implements.
5. `.planning/skills-sandbox/phases/01-schema-storage-foundation/` — Phase 1's `CONTEXT.md`/
   `01-01-PLAN.md`, for the `skill_packs.scope`/`user_id` shape this phase's query depends on.
6. `api/vcso/chat.ts` in full. Line numbers in the research/plan docs were accurate as of Phase 2's
   completion but may have shifted — re-locate `loadIpLayer`, `loadSelectedSkillBodies`, `classify`,
   `scoreSkill`, and the `loadIpLayer(...)` call site directly rather than trusting line numbers.

## What you build

### Change 1 (do first, verify in isolation) — fix the live bug
Both `.from('ip_skill_packs')` calls → `.from('skill_packs')`. Send a real test message through the
Virtual CSO chat path and confirm it no longer throws, before moving to Change 2.

### Change 2 — scope `loadIpLayer()`'s skill query
Add a `userId` parameter to `loadIpLayer()`; scope its `skill_packs` query to `scope = 'global' OR
user_id = <that userId>` using the client's parameterized filter builder (not raw string
concatenation); update the call site to pass `userId` (already in scope there). Add `scope`/`user_id`
to the `SkillIndexRow` type. `loadSelectedSkillBodies()` needs only the table-name fix — it's safe by
construction once fed only already-scoped IDs.

### Change 3 — explicit invocation via `@slug`
New function `detectExplicitSkillInvocation(text, skills)`: regex-match `@([a-z0-9-]+)`, look up the
matched slug against the (now correctly scoped) skill list, return the match or `null`. Call it
before `classify()`; if it matches, build the route result directly from that skill (skip
`scoreSkill()` entirely, `confidence: 1`, a reason string identifying explicit invocation); if it
returns `null`, call `classify()` exactly as today.

## Hard constraints

- **Do not modify `classify()` or `scoreSkill()`.** Confirmed generic over their input list already —
  the fix is entirely in what list reaches them (Change 2) plus the new short-circuit (Change 3).
- **Do not build any UI.** This phase is backend-only. Phase 4 builds Skills Library UI and any
  `@`-mention affordance on top of what you build here.
- **Do not weaken the scoping to make testing easier.** The explicit-invocation lookup must search
  only the already-scoped list — never fall back to an unscoped query "just to check" if a slug
  exists. A founder should get identical behavior (fall through to ranked `classify()`) whether an
  `@mention` typo'd a real skill's slug or named another founder's private skill they can't see —
  don't leak the difference between those two cases.
- **Verify Change 1 in isolation before Changes 2/3.** If you only get partway through this plan,
  the live bug fix should already be safely landed and verified on its own.

## Done when

All 7 success criteria in `03-01-PLAN.md` are met, verified with real test calls/messages and at
least one real cross-founder private-skill test (create a test private skill for a test founder,
confirm a second founder's `classify()` never sees it, by slug or by ranking).

Report back: a one-paragraph summary; explicit confirmation the live bug is fixed and verified;
confirmation of each of the 7 success criteria; and a clear note that the `@slug` explicit-invocation
syntax was not independently re-confirmed by London beyond the general two-path decision, in case
that detail needs revisiting. Then stop — Phase 4 (Skill Creation & Skills Library UI) is opened from
the orchestration thread, not by you.
