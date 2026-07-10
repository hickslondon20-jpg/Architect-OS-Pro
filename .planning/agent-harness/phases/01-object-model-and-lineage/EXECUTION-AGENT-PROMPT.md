# Execution Agent Brief — Phase 1: Object Model & Lineage

You are the Execution Agent for **Phase 1** of the Agent Harness (Episode 6) build in ArchitectOS
Pro. You implement this phase's migration and seed. You do not re-plan it and you do not start
other phases.

## Read these before writing any SQL (in order)
1. `.planning/agent-harness/CONTEXT.md` — the build's rationale, Rosetta, reuse map, and the
   decisions you must not override.
2. `.planning/agent-harness/ROADMAP.md` — Phase 1 goal, dependencies, success criteria.
3. `phases/01-object-model-and-lineage/01-RESEARCH.md` — the live-verified schema. **Trust it, but
   re-verify anything you're about to change** (live Supabase project `pwacpjqkntnovndhspxt`).
4. `phases/01-object-model-and-lineage/01-CONTEXT.md` — the locked forks + the object-model diagram.
5. `phases/01-object-model-and-lineage/01-01-PLAN.md` — the table-by-table plan you build.
6. Canonical: `../../INTELLIGENCE-LAYER-EPISODE-MAP.md` §5 (L1–L21) + `DomainAgents_Wireframe_Spec.md`
   §11. These win over the reference PRD.

## What you are building
One migration `docs/migrations/019_domain_agents_object_model.sql`, applied live, that:
- creates global platform tables `domain_agents`, `templates`, `workflows`, `workflow_steps`;
- creates founder-owned tables `tasks`, `workspace_files` (owner-flexible), `freeform_requests`;
- **ALTERs** `artifacts` (extend the `source_kind` CHECK + add lineage/provenance columns);
- adds a private `workspace` Storage bucket;
- seeds the 5 `domain_agents`, one Financial workflow + ordered step placeholders, one template;
- and you then regenerate the TypeScript types.

## Hard constraints (do not violate)
- **Reuse, don't recreate.** `artifacts` is ALTERed, not replaced. `workflow_steps.skill_id →
  skill_packs.id` (no new skills table). Never create or overload `agent_capabilities` — the five
  disciplines table is **`domain_agents`**.
- **Run-state on `tasks`** (fork #1): `status`/`current_step`/`step_results` are columns on `tasks`;
  do NOT add a `harness_runs` table.
- **Global vs. founder-owned split** (fork #5): global tables (`domain_agents`/`workflows`/
  `workflow_steps`/`templates`) are all-authenticated-read, service_role/admin-write; founder tables
  (`tasks`/`workspace_files`/`freeform_requests`) are RLS `auth.uid() = user_id`, mirroring the
  `artifacts` policy+grant pattern exactly.
- **`workspace_files` is owner-flexible** (L21): `owner_type ∈ {task, thread}` with unique
  `(owner_type, owner_id, file_path)`. A thread-owned insert MUST work — Phase 6 depends on it.
- **Provenance columns now, no backfill** (L10): `artifacts.provenance` + `tasks.step_results` hold
  the `source_refs` shape for Ep7; you populate nothing, just create the columns.
- **This is data-layer only.** No engine, no endpoints, no UI, no service code beyond regenerating
  types. If you're editing `vcso_chat_service.py` or writing a state machine, you've left Phase 1.
- **Seed is POC-grade** (L19): real discipline statements for the five agents; Analyze/Create/Plan
  capabilities + thought-starters as placeholders; only the Financial agent gets a workflow, and its
  steps are ordered placeholders (Phase 3 fills content).

## Checkpoint — CONFIRMED by London (2026-07-05), proceed on these (no further checkpoint needed)
- **Single `019` migration** (split only if unwieldy).
- **New private `workspace` Storage bucket** (mirror the `artifacts` bucket's `auth.uid()`-foldername
  policies); text `content` in-DB.
- **`domain_agents.capabilities` + `thought_starters` as `jsonb`**, seeded POC placeholders.
- **Nullable `created_by`** on `workflows`/`templates` (`references auth.users(id) on delete set
  null`); admin-global for beta.
- **Nullable `resulting_task_id`** on `freeform_requests` (`references public.tasks(id) on delete set
  null`).
- **Guardrails:** drop+recreate `artifacts_source_kind_check` with both values (no second
  constraint); gate global-table writes through the existing `private.is_skill_admin()` (reuse the
  `skill_packs` admin path); prove a `workspace_files` insert for **both** `owner_type='task'` and
  `'thread'` (L21).

Only pause for London if you discover a genuine conflict with these or with L1–L21 — otherwise
implement straight through.

## Done when
1. All Phase 1 success criteria in `ROADMAP.md` (OBJ-01…OBJ-06) are met and each is independently
   verified against live Supabase (not just reported).
2. `019` applied live; RLS/grants correct; the `artifacts` ALTER verified with existing rows intact.
3. Five `domain_agents` seeded; Financial workflow + ordered `workflow_steps` + one `templates` row
   present; a lineage query returns a joined agent→workflow→task→artifact shape.
4. `workspace_files` insert proven for both `owner_type='task'` and `'thread'`.
5. TypeScript types regenerated; `python -m compileall python-backend` clean (no code changes
   expected). Live-smoke gaps (missing env/creds) flagged honestly.
6. `Pro-Suite-Progress.md`, `.planning/agent-harness/ROADMAP.md`, `.planning/agent-harness/STATE.md`
   updated, and `phases/01-object-model-and-lineage/01-COMPLETION.md` written with the evidence
   summary, per standing process.

## Explicitly out of scope for you
The harness engine (Phase 2), the P&L step content (Phase 3), any endpoint or UI (Phase 4), the OS
Engine promotion trigger (Phase 5), and Deep-Mode `agent_todos` (Phase 6). Do not resolve anything
that `01-CONTEXT.md` marks as a later phase.
