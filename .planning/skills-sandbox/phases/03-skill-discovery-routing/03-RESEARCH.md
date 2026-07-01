# Phase 3 — Live Verification Pass (build-ready)

**Purpose:** confirm the actual current shape of skill discovery/routing before designing its
extension. Performed 2026-07-01 against the live Supabase project and the current codebase.

**Headline finding: a live production bug, found during this pass, confirmed with London and folded
into this phase (her call, not mine to silently fix or silently defer).** See §1.

---

## 1. Live bug: `api/vcso/chat.ts` still queries the table by its pre-rename name

`loadIpLayer()` (line 208) and `loadSelectedSkillBodies()` (line 223) both call
`.from('ip_skill_packs')`. Phase 1 renamed this table to `skill_packs` on 2026-07-01 — confirmed via
`information_schema.tables`: only `skill_packs` exists (`BASE TABLE`); `ip_skill_packs` does not
exist as a table or a view. `ALTER TABLE ... RENAME TO` only changes the Postgres catalog entry — it
does **not** update string literals in application code that reference the old name via
`.from('ip_skill_packs')`. PostgREST returns a "relation does not exist" error for those calls.

Both calls run inside an un-caught `Promise.all` in the main chat handler (`loadIpLayer(service,
allowDraftIp)` at line 594), with `if (skills.error) throw skills.error;` inside `loadIpLayer` itself.
**This means every Virtual CSO chat message has likely been failing since the Phase 1 migration went
live** — not a cosmetic issue, a live regression.

**Root cause of the mistake:** Phase 1's plan (`01-01-PLAN.md` success criterion #7) asserted
"Postgres rename preserves all references automatically at the DB level" — that assertion was wrong.
A rename changes the catalog object; it does nothing for a client library's literal string table-name
argument. The Phase 1 execution agent was correctly instructed not to modify `api/vcso/chat.ts` (that
file's changes were explicitly scoped to Phase 3), so this wasn't caught at the time.

**Confirmed with London (2026-07-01):** fold the fix into Phase 3 rather than a separate hotfix
thread, since Phase 3 already modifies both functions. This is the **first, most urgent item** in
Phase 3's build — everything else in this phase is additive improvement; this is a live break.

## 2. `classify()` / `scoreSkill()` — already generic over whatever skill list they're given

Read in full (`api/vcso/chat.ts` lines 139–176). **Neither function needs to change** to support
combined global+private scoring — they already operate on whatever `SkillIndexRow[]` they're handed.
The actual fix belongs upstream, in what `loadIpLayer()` fetches:

```ts
const loadIpLayer = async (service: SupabaseClient, allowDraftIp: boolean) => { ... }
```

`loadIpLayer` does not currently take a `userId` parameter at all, and its skills query
(`service.from('ip_skill_packs').select(...).in('status', statusFilter).order('slug', ...)`, no
other filter) fetches **every row in the table**, unscoped, using the service-role client (which
bypasses RLS entirely). Today this returns only the 6 global rows (no founder has created a private
skill yet — Phase 4 builds that). **Once Phase 4 ships, this same unscoped query would return every
founder's private skills to every other founder** — a real data-leakage bug waiting to happen, not
hypothetical. Phase 3 must fix this now, ahead of Phase 4, exactly per the roadmap's sequencing
(`ROADMAP.md`: Phase 4 depends on Phase 3).

`loadSelectedSkillBodies()` fetches skill bodies `.in('id', skillIds)` — safe by construction as long
as `skillIds` only ever contains IDs from the already-scoped list `classify()` was given (true today,
and stays true once `loadIpLayer`'s query is scoped). No additional filter needed there beyond the
table-name fix, but worth a defensive comment given `loadSelectedSkillBodies` also uses the
service-role client.

## 3. Explicit invocation (SKILL-09) — no existing convention to extend

Searched the Virtual CSO chat UI (`pages/ProSuite/virtual-cso/`) for any existing @-mention,
slash-command, or similar reference syntax — **none exists**. This is genuinely new design, not an
extension of something already there. `tokenize()` (line 134) already strips punctuation and
lowercases, which is useful context: it means a naive substring match against a skill's `name` field
risks false positives in ordinary prose (e.g., a NL message that happens to contain a skill's name
as regular words). An unambiguous, deliberate marker is the safer default for v1.

**Recommendation (see `CONTEXT.md` §2 for the confirmed design):** an `@slug` mention pattern
(word-bounded, case-insensitive) as the sole v1 explicit-invocation mechanism — unambiguous, simple
to detect with a regex against the founder's own already-scoped skill list, and a natural anchor for
Phase 4 to later build an `@`-autocomplete UI on top of (ROADMAP already notes Phase 4 depends on
Phase 3 for "'try in chat' / explicit invocation of a newly created skill").

**Security property that falls out for free:** because the explicit-invocation lookup only searches
within the founder's own combined (global + own-private) skill list — the same list §2's fix already
scopes — a founder can never explicitly invoke another founder's private skill by slug-guessing.
Nothing extra needs to be built for this; it's a consequence of doing the lookup against the correct
list, not a separate check.

## 4. `skill_packs.scope`/`user_id` — confirmed present and correct (Phase 1)

Re-confirmed live: `skill_packs.scope` (`global`|`private`) and `user_id` both exist, RLS in place,
write-lock trigger in place (Phase 1, done 2026-07-01). This phase's `loadIpLayer` fix reads these
columns; it does not need to add anything to the schema.

---
*Verification performed 2026-07-01 against Supabase project `pwacpjqkntnovndhspxt` and the live
`ArchitectOS Pro_beta` codebase (`api/vcso/chat.ts` in full; `pages/ProSuite/virtual-cso/` searched
for existing mention conventions). No production code was written during this pass.*
