# Skills & Sandbox Build — Phase 1 (Skills Schema & Storage Foundation) Execution Agent Prompt

> Copy everything below this line into a new Claude Code / Cowork session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **execution agent** for Phase 1 (Skills Schema & Storage Foundation) of the ArchitectOS
Agent Skills & Document Generation Engine build. You build two plans in order — **01-01 (`skill_packs`
rename/ownership/admin designation)** then **01-02 (`skill-files` bucket + `skill_files` table)** —
against **decided design**. You make implementation choices (exact migration filenames beyond what's
specified, index naming, trigger function naming beyond what's specified), never design choices. If
something needs a design decision beyond the inputs below, **stop and flag it** rather than guessing.

## Orient first (read these, in order)

1. `.planning/skills-sandbox/phases/01-schema-storage-foundation/01-RESEARCH.md` — the live
   verification pass. It documents the actual current shape of `ip_skill_packs`, the confirmed bucket
   RLS pattern, and the genuine gap in admin-account identification. **Do not re-derive any of this
   — it was queried directly against the live Supabase project on 2026-07-01. Re-verify only if you
   suspect drift since then (e.g., re-run the row-count / column-shape queries first).**
2. `.planning/skills-sandbox/phases/01-schema-storage-foundation/CONTEXT.md` — this phase's decisions,
   including the **one new (not-previously-locked) decision** this phase introduces: how the database
   identifies "the admin account" (§2 — `profiles.is_admin`, proposed and pending London's
   confirmation at the orchestration checkpoint before you begin, per the note below).
3. `01-01-PLAN.md` and `01-02-PLAN.md` (same folder) — the two build specs, including full migration
   SQL, pre-execution checks, and success criteria.
4. `.planning/skills-sandbox/CONTEXT.md` §3 and §6 — the project-wide decisions these plans implement.
5. `docs/migrations/20260628_kb_folders_schema.sql` — mirror this file's RLS + `updated_at`-trigger
   style exactly for the new `skill_files` table.

## Before you write any SQL

**Admin designation is confirmed, with one nuance that affects how you seed data.** London confirmed
(2026-07-01) `profiles.is_admin BOOLEAN` as the mechanism, and clarified two things worth internalizing
before you write the migration:

1. `is_admin` is a **general flag**, not a single hardcoded admin — any account with `is_admin = true`
   can hold/create global `skill_packs` rows. The trigger in `01-01-PLAN.md` already reflects this
   (it checks `EXISTS (... AND is_admin = true)`, not a specific UUID) — do not narrow it to a single
   hardcoded account.
2. The **primary path** for creating global skill content going forward is bulk CSV upload directly
   against `skill_packs`, or direct Supabase access (Supabase MCP / Cowork) — not the app UI. This
   doesn't change anything you build in Phase 1 (schema + RLS only), but it's why the global-scope
   rule must be a real DB-level trigger/RLS check and not something you could get away with enforcing
   only in application code — there may never be an "application code path" for most global-content
   writes at all.

For this migration, seed `is_admin = true` for London's own account only (the only admin-flagged
account that exists today) — confirm the real `user_id` before writing it into any migration. Run:
```sql
SELECT id, email FROM auth.users WHERE email = 'hicks.london20@gmail.com';
```
Use the returned `id` everywhere `01-01-PLAN.md` says `<ADMIN_USER_ID>`. Do not hardcode a UUID from
any planning document — none of them contain the real value; it must come from this live query.

## What you build

### Plan 01-01 — `docs/migrations/20260701_skill_packs_rename_and_ownership.sql`
Add `profiles.is_admin`; set it true for the confirmed admin `user_id`. Rename `ip_skill_packs` →
`skill_packs`. Add `user_id`/`scope` columns; backfill the 6 existing rows to the admin's `user_id`
and `scope='global'`; set `user_id NOT NULL`. Add the `BEFORE INSERT OR UPDATE` write-lock trigger
that rejects `scope='global'` for any non-admin-owned row. Add indexes. Replace the RLS with
founder-facing SELECT (global OR own) + owner-scoped INSERT/UPDATE/DELETE, keeping the existing
service-role `ALL` policy intact.

### Plan 01-02 — `docs/migrations/20260701_skill_files_storage.sql`
Create the `skill-files` bucket (private) and `skill_files` metadata table (FK to `skill_packs`,
`updated_at` trigger mirroring `kb_folders`). RLS on `skill_files` mirrors the parent skill's
scope/ownership. RLS on `storage.objects` for `skill-files`: owner-only read+write (mirroring
`kb_files_*_own_folder`), **plus** the one genuinely new policy — global-skill-file open-read, gated
on `profiles.is_admin` matching the path's owner segment.

## Hard constraints

- **Do not modify `api/vcso/chat.ts`.** Its `ip_skill_packs`-referencing queries resolve automatically
  against the renamed `skill_packs` table at the DB level; extending them for private-skill scoring
  is Phase 3's job, not yours. If you find a *literal* table-name reference elsewhere (raw SQL, not a
  Supabase client `.from()` call) that the rename would break, flag it — don't silently fix it.
- **Do not add an embedding/vector column** to `skill_packs` or `skill_files`. Not required by this
  phase's requirements (SKILL-05, SKILL-06, FILE-01, FILE-03, FILE-04); pgvector is available if
  Phase 3 needs it later, against a real requirement then.
- **Do not touch** `ip_rules`, `ip_prompts`, `ip_knowledge_pages`, `ip_relationships` — confirmed
  unaffected by the rename (`01-RESEARCH.md` §7).
- **Do not clean up** the duplicated old/new-style RLS policies on `raw-documents` noted in
  `01-RESEARCH.md` §3 — pre-existing, unrelated to this build.
- **No admin panel UI, no Skills Library UI, no sandbox, no artifacts.** Schema + storage + RLS +
  triggers only, for exactly the two plans above.
- Global skill content must remain **readable by every founder** and **writable only by the admin** —
  verify both directions, not just the write restriction.

## Done when

All success criteria in both `01-01-PLAN.md` and `01-02-PLAN.md` are met. Verify with real test
queries/uploads, not just by reading the migration back:
- Insert a test private `skill_packs` row for a non-admin user, attempt to set `scope='global'` on
  it directly — confirm the trigger rejects it.
- As a founder JWT (not service role), SELECT `skill_packs` and confirm you see global rows + your
  own rows, not another founder's private rows.
- Upload a file to `skill-files` under your own path and read it back; attempt to read a file under
  the admin's global path (should succeed); attempt to write to the admin's path as a non-admin
  (should fail).
- Re-run `generate_typescript_types` and confirm `skill_packs` and `skill_files` appear correctly
  (no `ip_skill_packs` remaining in generated types).

Report back: a one-paragraph summary, both migration filenames, the confirmed admin `user_id` used,
and confirmation of each verification query's result. Then stop — Phase 2 (Persistent Tool Memory) is
opened from the orchestration thread, not by you.
