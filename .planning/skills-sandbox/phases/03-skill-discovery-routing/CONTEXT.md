# Phase 3 Context — Skill Discovery & Routing

**Written:** 2026-07-01, by the Orchestration Agent, after the `03-RESEARCH.md` verification pass.
**Format:** GSD per-phase CONTEXT.md — six sections, per `.claude/gsd-core/references/artifact-types.md`.

**Read `03-RESEARCH.md` first.** It found a live production bug (the pre-rename table name still
referenced in two live query calls) — confirmed with London to fold into this phase as its first,
most urgent item, not a separate hotfix.

---

## 1. Domain

Make the Virtual CSO's skill routing (`classify()`) aware of private, founder-owned skills — scored
together with global skills in one ranked pass — and add a way for a founder to force a specific
skill's use by naming it directly, bypassing ranking entirely. Concretely, three things, in priority
order:

1. **Fix the live bug:** `api/vcso/chat.ts` still queries `ip_skill_packs` (renamed to `skill_packs`
   in Phase 1) in two places. This is breaking every Virtual CSO chat message right now.
2. **Scope `loadIpLayer()`'s skill query** to `scope = 'global' OR user_id = <requesting founder>`,
   and thread `userId` into `loadIpLayer()` (it doesn't currently take it). This is the actual
   "extend `classify()` for private scoring" work — `classify()`/`scoreSkill()` themselves need no
   changes; they already score whatever list they're handed.
3. **Add explicit invocation:** an `@slug` mention in a message, matched against the founder's own
   scoped skill list, short-circuits straight to that skill regardless of ranking score.

## 2. Decisions

**Carried from the project-root `CONTEXT.md` (locked):**

- Two distinct routing paths: implicit (combined ranked scoring) and explicit (named/tagged,
  short-circuits ranking) — project `CONTEXT.md` §4.
- A private skill must never appear in another founder's results (project `CONTEXT.md` §3, RLS/
  ownership model from Phase 1).

**New for this phase — proposed by the Orchestration Agent, confirmed by London (2026-07-01) at the
checkpoint:**

- **Fold the live-bug fix into this phase rather than a separate hotfix.** London's explicit call —
  Phase 3 already touches both broken functions, so there's no reason to spin up a separate thread
  first. This is nonetheless the **first task** the execution agent does, verified in isolation
  before any of the scoping/explicit-invocation work, so a partial-completion state still leaves the
  live bug fixed even if the rest of the phase needs another pass.
- **Explicit invocation mechanism: `@slug` mention, word-bounded, case-insensitive — proposed here,
  not yet independently reviewed by London beyond the general "two paths" decision already locked.**
  No existing @-mention/slash-command convention exists anywhere in the Virtual CSO UI
  (`03-RESEARCH.md` §3) — this is new design, not an extension. Rejected alternative: bare
  substring-matching a skill's `name` in the message text — too prone to false positives in ordinary
  prose (a message that happens to contain the same words as a skill's name would falsely trigger).
  `@slug` is unambiguous and gives Phase 4 a natural anchor for an `@`-autocomplete UI later. **Flag
  to London if a different mention syntax is preferred** (e.g. a different sigil, or matching by
  skill `name` in quotes) — this specific detail wasn't discussed in the original Discuss/Plan
  session, only the two-path architecture was.
- **The explicit-invocation lookup must search only the founder's own already-scoped skill list**
  (global + own private, the same list item 2 above produces) — never a separate, unscoped lookup.
  This is what prevents a founder from invoking another founder's private skill by guessing its slug,
  and it falls out for free from reusing the scoped list rather than querying fresh.

## 3. Canonical Refs

- `.planning/skills-sandbox/CONTEXT.md` §4 ("Skill discovery and invocation: two paths, not one").
- `.planning/skills-sandbox/REQUIREMENTS.md` — SKILL-08, SKILL-09.
- `.planning/skills-sandbox/ROADMAP.md` — Phase 3 section.
- `03-RESEARCH.md` (this folder) — read in full before the plan file.
- `.planning/skills-sandbox/phases/01-schema-storage-foundation/CONTEXT.md` — the `scope`/`user_id`
  schema this phase's query fix depends on (done, Phase 1).

## 4. Code Context

- `api/vcso/chat.ts` lines 139–176: `scoreSkill()`, `classify()` — **no changes needed**, confirmed
  generic over input list.
- `api/vcso/chat.ts` lines 193–217: `loadIpLayer()` — fix the table name (line 208); add `userId`
  parameter; scope the skills query.
- `api/vcso/chat.ts` lines 219–247: `loadSelectedSkillBodies()` — fix the table name (line 223); no
  other change needed (safe by construction once its caller passes only already-scoped IDs).
- `api/vcso/chat.ts` line 594: `loadIpLayer(service, allowDraftIp)` call site — needs `userId` added
  to the call.
- New: an explicit-invocation detection function, called before/alongside `classify()`, operating on
  the same scoped skill list `loadIpLayer()` now returns.
- `pages/ProSuite/virtual-cso/` — confirmed no existing mention/tag UI; this phase is backend-only,
  no UI change (Phase 4 builds any UI affordance on top of this phase's detection logic later).

## 5. Specifics

**Live-bug fix (do first, verify in isolation):**
```ts
// loadIpLayer, line 208
.from('skill_packs')  // was 'ip_skill_packs'
// loadSelectedSkillBodies, line 223
.from('skill_packs')  // was 'ip_skill_packs'
```

**Scoped combined query — `loadIpLayer()`:**
```ts
const loadIpLayer = async (service: SupabaseClient, allowDraftIp: boolean, userId: string) => {
  // ...
  service
    .from('skill_packs')
    .select('id,slug,name,description,domain,skill_kind,trigger_tags,required_platform_context,status,scope,user_id')
    .in('status', statusFilter)
    .or(`scope.eq.global,user_id.eq.${userId}`)
    .order('slug', { ascending: true }),
  // ...
};
```
(Exact PostgREST `.or()` syntax/parameterization to confirm during execution — the point is one query
returning global rows ∪ the requesting founder's own rows, not two separate queries merged
client-side, and not string-interpolating `userId` unsafely — use the client library's parameterized
filter builder, not raw string concatenation, regardless of the shorthand above.) Update the call
site (line 594) to pass `userId`. Add `scope`/`user_id` to `SkillIndexRow`'s type if not already
present, since the explicit-invocation function and any future consumer may want to distinguish
global vs. private for display/logging purposes.

**Explicit invocation:**
```ts
const detectExplicitSkillInvocation = (text: string, skills: SkillIndexRow[]): SkillIndexRow | null => {
  const mention = text.match(/@([a-z0-9-]+)/i);
  if (!mention) return null;
  const slug = mention[1].toLowerCase();
  return skills.find((skill) => skill.slug.toLowerCase() === slug) ?? null;
};
```
Call this before `classify()`. If it returns a skill, that skill becomes `selected`/`primary`
directly — do not run it through `scoreSkill()` at all. If it returns `null` (no `@mention`, or a
mention that doesn't match anything in the founder's scoped list — including a typo or an attempt to
name a skill the founder can't see), fall through to the normal ranked `classify()` path unchanged.
Reflect which path was taken in the existing `route.reason` field (e.g. `"Explicit invocation:
@<slug>"` vs. the existing ranked-match reason string) so it's visible in `assembledContext`/routing
notices, not silently indistinguishable.

## 6. Deferred (explicitly not this phase's job)

- Any UI for browsing, creating, or mentioning skills (Phase 4 — Skills Library UI). This phase is
  backend routing logic only.
- SKILL.md body parsing/validation, ZIP import/export — Phase 4.
- Sandbox, artifacts — Phases 5–7.
- Changing `scoreSkill()`'s scoring heuristics themselves (trigger-tag weights, the hardcoded
  `sequence-the-priority` boost, etc.) — out of scope; this phase only changes what list reaches
  `classify()`, not how it scores.

---
*Context written: 2026-07-01 — Orchestration Agent, post-research.*
