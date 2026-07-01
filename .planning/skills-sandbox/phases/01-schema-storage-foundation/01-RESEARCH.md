# Phase 1 — Live Verification Pass (build-ready)

**Purpose:** confirm the actual current shape of everything Phase 1 touches before any migration is
written. Per the project `CONTEXT.md`'s governing principle ("verify before rewriting" / "reuse
before creating"), this is a read-only pass against the live Supabase project (`pwacpjqkntnovndhspxt`,
"Architect OS") and the current codebase. No design was assumed — everything below was queried or
read directly on 2026-07-01.

---

## 1. `ip_skill_packs` — current live shape

Queried via `information_schema.columns`. Actual columns today:

```
id                          uuid        PK, gen_random_uuid()
slug                        text        NOT NULL
name                        text        NOT NULL
description                 text        NOT NULL
skill_kind                  text        nullable
domain                      text        nullable
trigger_tags                text[]      NOT NULL, default '{}'
body                        text        NOT NULL, default ''
status                      text        NOT NULL, default 'active'
version                     integer     NOT NULL, default 1
last_updated                timestamptz NOT NULL, default now()
created_at                  timestamptz NOT NULL, default now()
required_platform_context   text[]      NOT NULL, default '{}'
output_contract             text        nullable
writeback_rules             text        nullable
```

**No `user_id` column exists today.** Every row is implicitly global admin IP — there is no
ownership concept on this table yet. **Row count: 6** (all pre-existing admin-authored skill packs
— these must survive the rename/backfill with `scope='global'`, not be treated as orphaned data).

**RLS:** enabled (`relrowsecurity = true`), but the only policy is `"Service role can manage IP
skill packs"` (`cmd = ALL`, `qual = true`, `with_check = true`). **There is no founder-facing read
policy at all today** — every read goes through the service-role client in
`api/vcso/chat.ts`. This matters for scoping the RLS work in Phase 1: today, nothing breaks if a
founder-facing SELECT policy doesn't exist yet, but Phase 1's ownership model must add one (private
skills readable by their owner, global skills readable by everyone) — Phase 3/4 will be the first
things that actually rely on a founder JWT reading this table directly, but the RLS should be
correct starting now per the roadmap's success criteria, not deferred.

## 2. `classify()` / `loadSelectedSkillBodies()` — current query shape

`api/vcso/chat.ts` (service-role client, confirmed by direct read):

```ts
service.from('ip_skill_packs')
  .select('id,slug,name,description,domain,skill_kind,trigger_tags,required_platform_context,status')
  .in('status', statusFilter)
  .order('slug', { ascending: true })
```
and, once skills are selected:
```ts
service.from('ip_skill_packs').select('*').in('id', skillIds).in('status', statusFilter)
```

Both queries run with **no scoping by user at all** today — there's nothing to scope by, since
there's no ownership column. Phase 1 only needs to make the column/constraint changes; **extending
these two queries to add the private-skill filter is explicitly Phase 3's job** (`classify()`
extension), not Phase 1's. Phase 1 must not touch `api/vcso/chat.ts` — noted here only so the
execution agent doesn't accidentally scope-creep into Phase 3's work.

## 3. Existing bucket RLS conventions — confirmed pattern

Live buckets (`storage.buckets`): `raw-documents` (private), `kb-files` (private), `platform_ip`
(private), `ae_report-template-assets` (public), `AEReports` (private), `MR-Audit_Reports` (public),
`reports` (private). No `skill-files` or `artifacts` bucket exists yet — confirmed, not assumed.

Confirmed RLS pattern on `storage.objects` for the two buckets CONTEXT.md names as the model
(`kb-files`, `raw-documents`):

```sql
-- kb-files (the current, canonical-style policy — use this shape, not the older raw-documents style)
CREATE POLICY "kb_files_select_own_folder" ON storage.objects FOR SELECT
  USING (bucket_id = 'kb-files' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
-- mirrored for insert/update/delete
```

Note: `raw-documents` actually carries **two overlapping generations of the same policy** — an
older style (`(auth.uid())::text = (storage.foldername(name))[1]`, four policies named "Users
{action} own raw documents") and a newer style (`(storage.foldername(name))[1] = (SELECT
auth.uid())::text`, four policies named `raw_documents_{action}_own_folder`). Both are live
simultaneously. This is pre-existing duplication, **not something Phase 1 should clean up** — out
of scope, flagged only so the execution agent doesn't mistake it for something Phase 1 broke.
**Mirror the newer `kb_files_*` / `raw_documents_*_own_folder` style** (the `(SELECT auth.uid())`
wrapper is the current Postgres-recommended form — it lets the planner cache the auth call once per
statement instead of once per row).

## 4. The "admin account" — no existing concept found (real gap, not assumed)

CONTEXT.md says: *"The admin account does not need to be a separately built concept yet; it is
simply whichever `user_id` is designated as the admin."* Searched for any existing mechanism this
could hook into:

- No `is_admin`, `role`, `admin_user_id`, or `platform_admin` column/table anywhere in the schema
  (checked `information_schema.columns` across all tables, and grepped the codebase — zero hits
  outside an unrelated GSD template file).
- The closest existing table is `profiles` (columns: `id`, `user_id`, `tier_id`, `email`,
  `first_name`, `last_name`, `gvs_credits_remaining`, `gvs_last_reset_date`, `gvs_saves_count`,
  `ghl_contact_id`, timestamps). `tier_id` is a subscription/billing tier (`AppContext.tsx` reads
  it as `Tier`, defaults new signups to `'beta_fit_call'`) — **not** a role field, and repurposing it
  for admin-designation would conflate billing tier with platform-admin identity. Confirmed by
  reading `AppContext.tsx` directly, not assumed from the column name.

**This is a genuine, undecided build question — not something the original Discuss/Plan `CONTEXT.md`
already answered.** It answered *what* global-scope derivation means philosophically (ownership, not
a toggle); it did not answer *how* the database identifies which `user_id` counts as the admin,
because no admin concept existed anywhere to inspect at discussion time. A decision is proposed in
this phase's `CONTEXT.md` (§2) and flagged explicitly at the orchestration checkpoint for London to
confirm before the execution agent builds against it — this is new ground, not a re-litigation of a
locked decision.

## 5. Migration file convention — confirmed

`docs/migrations/` uses two eras of naming that coexist: `NNN_description.sql` (numbered, e.g.
`009_sub_agent_orchestration.sql`, oldest) and `YYYYMMDD_description.sql` (date-prefixed, current —
`20260630_wiki_schema.sql` is the latest). **The date-prefixed convention is current practice**
(every migration since 2026-06-28 uses it). Phase 1's migration file should be named
`20260701_skill_packs_rename_and_ownership.sql` (or similar), following that convention, not the
older numbered one.

`20260628_kb_folders_schema.sql` was read in full and is the cleanest small reference for the
per-user RLS + `updated_at` trigger style to mirror (see `01-02-PLAN.md`).

## 6. pgvector — already enabled, but not needed here

`vector` extension is already installed (confirmed via `pg_extension`). Noted only because the
wiki-system precedent phase added `VECTOR` columns at schema-foundation time — **Phase 1 of this
build does not need one.** Skill discovery (SKILL-08, Phase 3) is scoped in `CONTEXT.md` §4 as an
extension of the existing keyword/trigger-tag `classify()`/`scoreSkill()` scoring, not a semantic
embedding search. Do not add an `embedding` column to `skill_packs` speculatively — if Phase 3 later
needs one, that is Phase 3's schema change to make, against a real requirement, not Phase 1's to
guess at now.

## 7. `ip_rules`, `ip_prompts`, `ip_knowledge_pages`, `ip_relationships` — confirmed untouched

All four tables' current columns were pulled and inspected. Nothing about their shape suggests any
of them need to change for this build, and CONTEXT.md's constraint (#4 in "Architectural Decisions
Execution Agents Must Not Override") already forbids touching them. Confirmed no name collision, no
FK dependency on `ip_skill_packs` that the rename would break (`ip_relationships` references skills
by `(from_kind, from_id)` / `(to_kind, to_id)` — a polymorphic pair, not a FK constraint — so
renaming the table does not require touching `ip_relationships` rows or schema at all).

---

## Extract / Decide summary

| Confirmed as-is (build against this) | Genuinely new decision this phase must make (see `CONTEXT.md` §2) |
|---|---|
| `ip_skill_packs` current 15-column shape; 6 existing rows; RLS enabled with service-role-only policy | How the DB identifies "the admin account" (no existing mechanism) |
| `kb_files_*` / `raw_documents_*_own_folder` RLS style as the pattern to mirror for `skill-files` | — |
| Date-prefixed migration naming (`YYYYMMDD_description.sql`) | — |
| `classify()` / `loadSelectedSkillBodies()` current query shape (untouched by Phase 1) | — |
| pgvector already enabled but not needed for this phase | — |
| `ip_rules`/`ip_prompts`/`ip_knowledge_pages`/`ip_relationships` unaffected by the rename | — |

*Verification performed 2026-07-01 against Supabase project `pwacpjqkntnovndhspxt` and the live
`ArchitectOS Pro_beta` codebase. No production code, schema, or migration was written during this
pass — read-only throughout.*
