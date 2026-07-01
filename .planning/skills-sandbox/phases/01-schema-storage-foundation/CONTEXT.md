# Phase 1 Context — Skills Schema & Storage Foundation

**Written:** 2026-07-01, by the Orchestration Agent, after the `01-RESEARCH.md` verification pass.
**Format:** GSD per-phase CONTEXT.md — six sections (domain, decisions, canonical_refs, code_context,
specifics, deferred), per `.claude/gsd-core/references/artifact-types.md`. This is a narrower,
build-facing document than the project-root `.planning/skills-sandbox/CONTEXT.md` — read that first
for the *why*; this file is the *what, exactly, for this phase*.

---

## 1. Domain

This phase establishes the storage foundation every later phase in this build stands on:

1. Renames and extends `ip_skill_packs` → `skill_packs`, adding founder ownership and an
   ownership-derived `scope` (`global` | `private`), enforced structurally.
2. Creates the `skill-files` Storage bucket and its `skill_files` metadata table, for a skill's own
   building-block resources (scripts/references/assets) — distinct from KB documents.

It does not touch skill discovery, creation UX, the sandbox, or artifacts delivery — those are
Phases 3–7. It also does not touch `ip_rules`, `ip_prompts`, `ip_knowledge_pages`, or
`ip_relationships` — confirmed untouched in `01-RESEARCH.md` §7.

## 2. Decisions

**Carried from the project-root `CONTEXT.md` (locked, not reopened here):**

- Rename `ip_skill_packs` → `skill_packs`; this is a rename + extension of the existing table, not a
  parallel table (project `CONTEXT.md` §3).
- `scope = 'global'` is valid **only** when the row's owning `user_id` is the platform admin account
  — derived from ownership, enforced structurally (constraint/trigger/RLS), never a founder-facing
  toggle (project `CONTEXT.md` §3; Architectural Decision #2).
- No user-to-global promotion path; no team/multi-user sharing (project `CONTEXT.md` Architectural
  Decisions #2–#3).
- Existing columns (`slug`, `trigger_tags`, `required_platform_context`, `body`, `output_contract`,
  `writeback_rules`, `status`) are a starting point to evaluate, not a contract to preserve untouched
  (project `CONTEXT.md` §3, "Explicit permission to diverge").
- `skill-files` bucket, paths `{owner_user_id}/{skill_id}/{category}/{filename}`, category ∈
  {scripts, references, assets}; a `skill_files` metadata table (skill_id, filename, category,
  mime_type, size, storage_path) mirroring how `ose_raw_document_registry` separates metadata from
  blob storage (project `CONTEXT.md` §6).
- The one genuinely new RLS shape needed: **global skill files are open-read, admin-only-write** —
  every founder's Virtual CSO must read the admin's global skill files. Every existing bucket today
  is strict single-owner; this is called out explicitly so it isn't built as a copy-paste of that
  boilerplate (project `CONTEXT.md` §6).

**New for this phase — proposed here, confirmed directly by London (2026-07-01) at the orchestration
checkpoint (not a re-litigation of anything already locked; no existing mechanism to inspect at
discussion time — see `01-RESEARCH.md` §4):**

- **How the database identifies "the admin account."** No `is_admin`/`role`/`admin_user_id` concept
  exists anywhere today (confirmed by direct query — `01-RESEARCH.md` §4). Repurposing `profiles.
  tier_id` was considered and rejected — it's a billing/subscription tier (`AppContext.tsx` treats it
  as `Tier`, defaulting new signups to `'beta_fit_call'`); conflating billing tier with platform-admin
  identity is exactly the kind of surface-level reuse the project's governing principle warns
  against ("a genuinely distinct... use case justifies a new" structure — here, admin identity *is*
  a genuinely distinct concept from billing tier, even though both currently live conceptually near
  `profiles`).
  - **Proposed:** add `is_admin BOOLEAN NOT NULL DEFAULT false` to the existing `profiles` table
    (reuse the table that already exists per founder, add one column — simpler than a new
    single-purpose table, and this is exactly the kind of "if something genuinely needs its own
    table... otherwise reuse" call the project CONTEXT.md's governing principle asks for). A `BEFORE
    INSERT OR UPDATE` trigger on `skill_packs` rejects `scope = 'global'` unless `EXISTS (SELECT 1
    FROM profiles WHERE user_id = NEW.user_id AND is_admin = true)`. The same `is_admin` check backs
    the `skill-files` bucket's global-read RLS policy (§5 below).
  - This is deliberately future-compatible with the deferred admin panel (`ADMIN-01`, v2): a boolean
    on `profiles` is trivial to expose as a toggle in an admin UI later; it does not need a migration
    to accommodate that.
  - **Confirmed by London (2026-07-01):** `is_admin` is a general flag, not a single hardcoded admin
    UUID — **any account with `is_admin = true` can create/hold global skills**, by design. This is
    not scoped to exactly one admin account; the trigger's `EXISTS (... AND is_admin = true)` check
    already supports multiple admin-flagged accounts with no further change needed.
  - **Confirmed primary creation path for global skills is NOT the app UI.** London's stated intent:
    global skill content will primarily be created via **bulk CSV upload directly against the
    `skill_packs` table**, or via direct Supabase access (e.g. through the Supabase MCP from a Cowork
    session) — not by clicking a "make global" button anywhere in the product. This is exactly why
    the rule is enforced at the database layer (trigger + RLS) rather than only in application code:
    the gate has to hold regardless of which path writes the row. Practical implication for **Phase 4**
    (Skills Library UI, not this phase): the manual creation form and AI-guided flow should not surface
    any global/private toggle to founders at all — scope is never a user-facing input, only ever an
    outcome of who's authenticated when a row is written. An `is_admin`-flagged founder using the
    in-app creation flow could in principle still produce a global row (the trigger allows it), but
    that is a side-effect of the schema rule, not a feature to design UI around — bulk CSV / direct
    Supabase access remains the intended primary path. Noted here so this doesn't get lost by the time
    Phase 4 is scoped.

## 3. Canonical Refs

- `.planning/skills-sandbox/CONTEXT.md` §3 ("Skills model: one table, renamed, ownership-gated global
  scope"), §6 ("Building-block files: distinct from KB documents, same storage conventions"), and
  "Architectural Decisions Execution Agents Must Not Override" #2–#4, #6.
- `.planning/skills-sandbox/REQUIREMENTS.md` — SKILL-05, SKILL-06, FILE-01, FILE-03, FILE-04 (this
  phase's traced requirements).
- `.planning/skills-sandbox/ROADMAP.md` — Phase 1 section (goal, depends-on, success criteria).
- `01-RESEARCH.md` (this folder) — the live-verification findings this CONTEXT.md and both plans
  build against.
- `docs/migrations/20260628_kb_folders_schema.sql` — the RLS + `updated_at`-trigger style to mirror.

## 4. Code Context

- `api/vcso/chat.ts` — current `classify()` / `loadSelectedSkillBodies()` queries `ip_skill_packs`
  with a service-role client, no user-scoping (there's nothing to scope by yet). **Do not modify this
  file in Phase 1** — extending these queries for private-skill scoring is Phase 3's job
  (`01-RESEARCH.md` §2).
- `context/AppContext.tsx` — reads `profiles.tier_id` as `Tier`; confirms `tier_id` is a
  billing/subscription concept, not a role field (informs the §2 decision above).
- `docs/migrations/` — date-prefixed convention (`YYYYMMDD_description.sql`) is current practice;
  name this phase's migration `20260701_skill_packs_rename_and_ownership.sql` and
  `20260701_skill_files_storage.sql` (or combine — execution agent's implementation choice, per
  01-01-PLAN / 01-02-PLAN).
- Live bucket RLS to mirror: `kb_files_select_own_folder` / `raw_documents_*_own_folder` style
  (`(storage.foldername(name))[1] = (SELECT auth.uid())::text`) — the current-generation form, not
  the older duplicated `raw-documents` policies (`01-RESEARCH.md` §3).

## 5. Specifics

**`skill_packs` (renamed from `ip_skill_packs`):**
- `ALTER TABLE ip_skill_packs RENAME TO skill_packs;` preserves the 6 existing rows and all 15
  existing columns.
- Add `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE` (nullable at the DB level only
  during backfill — see below) and `scope TEXT NOT NULL DEFAULT 'private' CHECK (scope IN ('global',
  'private'))`.
- **Backfill:** the 6 existing rows carry no owner today; they are today's de facto global admin IP.
  Backfill `user_id` = the designated admin's `user_id` and `scope = 'global'` for all 6 pre-existing
  rows as part of the same migration (do not leave them null/orphaned).
- After backfill, `user_id` becomes `NOT NULL`.
- Structural enforcement (write-lock trigger, mirroring the wiki-system precedent's `class='compiled'`
  write-lock pattern): `BEFORE INSERT OR UPDATE ON skill_packs` — reject if `NEW.scope = 'global'` and
  `NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = NEW.user_id AND is_admin = true)`.
- RLS: replace/extend the current service-role-only policy with founder-facing SELECT — a founder can
  read rows where `scope = 'global'` OR `user_id = auth.uid()`; INSERT/UPDATE/DELETE restricted to
  `user_id = auth.uid()` (a founder can only ever write their own rows; they cannot self-assign
  `scope='global'` even for their own row — the trigger blocks that regardless of RLS). Service role
  keeps its existing `ALL`/`true` policy for backend operations.

**`profiles.is_admin`:**
- `ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;`
- Execution agent sets `is_admin = true` for London's own account as part of the migration or a
  follow-up data step — confirm the correct `user_id`/email before writing this (do not guess;
  `hicks.london20@gmail.com` per the platform's own user record, but verify against `auth.users`
  live, don't hardcode from memory).

**`skill-files` bucket + `skill_files` table:**
- Bucket `skill-files`, private (not public), paths `{owner_user_id}/{skill_id}/{category}/
  {filename}`, category ∈ {scripts, references, assets}.
- `skill_files` table: `id UUID PK`, `skill_id UUID NOT NULL REFERENCES skill_packs(id) ON DELETE
  CASCADE`, `filename TEXT NOT NULL`, `category TEXT NOT NULL CHECK (category IN ('scripts',
  'references','assets'))`, `mime_type TEXT`, `size BIGINT`, `storage_path TEXT NOT NULL`,
  `created_at`/`updated_at` timestamps (mirror `kb_folders`' trigger style for `updated_at`).
- RLS on `storage.objects` for `skill-files`, two policies:
  - **Private-skill-file access:** owner-only read+write, mirroring `kb_files_*_own_folder` exactly
    — `(storage.foldername(name))[1] = (SELECT auth.uid())::text`.
  - **Global-skill-file access (the genuinely new shape):** SELECT allowed for anyone when
    `EXISTS (SELECT 1 FROM profiles p WHERE p.user_id::text = (storage.foldername(name))[1] AND
    p.is_admin = true)`; INSERT/UPDATE/DELETE on that same path restricted to the admin's own
    `auth.uid()` matching the path's owner segment.
- RLS on `skill_files` (the metadata table itself): SELECT allowed if the joined `skill_packs.scope =
  'global'` OR `skill_packs.user_id = auth.uid()`; INSERT/UPDATE/DELETE restricted to
  `skill_packs.user_id = auth.uid()`.
- Re-run `generate_typescript_types` after both migrations apply.

## 6. Deferred (explicitly not this phase's job)

- Extending `classify()`/`scoreSkill()` for private+global combined ranking, and explicit-invocation
  routing — Phase 3.
- Any embedding/vector column on `skill_packs` — not required by this phase's requirements; pgvector
  is available if Phase 3 later needs it, but that's Phase 3's decision against a real requirement,
  not this phase's to pre-guess (`01-RESEARCH.md` §6).
- SKILL.md body parsing/validation, manual form, AI-guided creation flow, ZIP import/export, Skills
  Library UI — Phase 4.
- Admin panel / settings UI for toggling `is_admin` — deferred (`ADMIN-01`, v2); the boolean column
  exists now so that panel is additive later, not a migration.
- Sandbox, artifacts, and delivery — Phases 5–7.
- Cleaning up the duplicated old/new `raw-documents` RLS policy generations noted in `01-RESEARCH.md`
  §3 — pre-existing, out of scope for this build entirely.

---
*Context written: 2026-07-01 — Orchestration Agent, post-research.*
