# Phase 1 Context — Object Model & Lineage

**Phase:** 01 of the Agent Harness (Episode 6) build.
**Read first:** the build-level `CONTEXT.md` and `ROADMAP.md`; this phase's `01-RESEARCH.md`
(live-verified schema); canonical `../../INTELLIGENCE-LAYER-EPISODE-MAP.md` §4 Ep6 + Refinement 2
+ §5 (L1–L21); and `DomainAgents_Wireframe_Spec.md` §11 (the object model the UI must reflect).
Canonical + Domain Agents docs win over the reference PRD.

---

## Why this phase, and what it is

Everything in Episode 6 hangs off one object model: **Agent → Workflow → Task → Artifact**, with
**Skills** and **Templates** as internal building blocks. This phase stands that model up in
Supabase, plus the **owner-flexible shared substrate** (`workspace_files` keyed to `task_id` **or**
`thread_id`, per L21) that both Domain Agents and VCSO Deep Mode reuse.

It is a **data-layer phase**: migration(s) + seed + regenerated TypeScript types. No engine (that
is Phase 2), no endpoints, no UI (Phase 4). But every field the engine, the surfaces, and Ep7
provenance need must exist now, so later phases **wire, not re-migrate**.

This phase is mostly SQL. Reuse-before-create is paramount: `artifacts`, `agent_capabilities`,
and `skill_packs` already exist and are **extended or referenced**, not recreated.

## What this phase is NOT

- **Not the harness engine.** No state machine, no step execution, no SSE. Phase 2.
- **Not any surface.** No Gallery/Profile/Workspace/Kanban/Library, no endpoints. Phase 4.
- **Not a new skills table.** `workflow_steps.skill_id → skill_packs.id` (the Ep4 primitive). Locked.
- **Not a new artifacts table.** `artifacts` (011) is **altered** (extend the `source_kind` CHECK
  + add lineage/provenance columns), never replaced.
- **Not Deep-Mode `agent_todos`.** That editable-plan table is built in Phase 6 (C4). Phase 1 builds
  `workspace_files` owner-flexible so Phase 6 reuses it — but not the todo table.
- **Not real financial content.** `domain_agents` seed for the four non-Financial agents and the
  Analyze/Create/Plan capabilities are POC placeholders (L19); the P&L workflow's real steps land
  in Phase 3.

## Decisions that shape this phase (locked 2026-07-03 — do not override)

1. **Task run-state lives on `tasks`.** A Task *is* one run of a Workflow; `status`,
   `current_step`, and `step_results` (JSONB) are columns on `tasks`. No separate `harness_runs`
   table (rejects the reference's thread-coupled run object — C2).
2. **Skills reuse `skill_packs` as-is.** `workflow_steps.skill_id → skill_packs.id`; skills stay
   non-domain-scoped (L2). A soft domain-tag can be added later; not now.
3. **Templates are their own table.** `workflows.template_id → templates.id`; `Template 1→N
   Artifacts`. Internal only — never surfaced to founders.
4. **Phase 1 scope = data model + seed + types.** No engine, endpoints, or UI.
5. **Global vs. founder-owned split** (grounded in the `skill_packs` global/private precedent):
   - **Global platform content** (admin/service_role write, all-authenticated read): `domain_agents`,
     `workflows`, `workflow_steps`, `templates`.
   - **Founder-owned** (RLS `auth.uid() = user_id`, mirror `artifacts`): `tasks`, `workspace_files`,
     `freeform_requests`, and artifact rows.
6. **`domain_agents` ≠ `agent_capabilities`.** The five disciplines are a new table; never overload
   the M8 sub-agent capability registry.

## The object model, concretely (the load-bearing part)

```
domain_agents (5 fixed, global)
   └─< workflows (global)  ──> templates (global, internal)
          └─< workflow_steps (global; ordered; typed)
                   step_type ∈ {programmatic, llm_single, llm_agent, llm_batch_agents, llm_human_input}
                   skill_id?      → skill_packs.id            (D1: Skill binding, LLM steps)
                   tools[]        → tool_registry ids         (D1 layer A: curated per-step subset)
                   capability_key → agent_capabilities        (D1 layer B: routing, agent/batch steps)
   tasks (founder-owned)  = one run of a workflow
          status ∈ {ready, running, blocked, review, done}, current_step, step_results(jsonb),
          origin ∈ {profile, kanban, vcso}, origin_thread_id?
          └─< workspace_files (owner_type ∈ {task, thread}, owner_id)   ← L21 owner-flexible
          └─> artifacts (011, ALTERed): + task_id, workflow_id, agent_id, template_id,
                                          provenance(jsonb), promoted_to_kb; source_kind += 'domain_agent_task'
   freeform_requests (founder-owned)  = request-capture log
```

**Provenance seam (Ep7):** `tasks.step_results` entries and `artifacts.provenance` carry the
citation-ready `source_refs` shape already emitted by `tool_registry.ToolSourceRef` / the VCSO
trace. Wire the columns now even though Ep7 consumes them later — no backfill (L10).

## Success criteria (from ROADMAP Phase 1 — OBJ-01…OBJ-06)

1. Migration `019` applies with founder-scoped RLS on `tasks`/`workspace_files`/`freeform_requests`
   and admin/global-read on `domain_agents`/`workflows`/`workflow_steps`/`templates`.
2. Five `domain_agents` rows seeded (vision §5 disciplines); one Financial `workflows` row + ordered
   `workflow_steps` placeholders present for Phase 3 to fill; at least one `templates` row.
3. Lineage resolves `Agent → Workflow → Task → Artifact`; `Workflow 1→N Tasks` and `Template 1→N
   Artifacts` hold. `artifacts` extended (CHECK + lineage/provenance), not replaced.
4. `workspace_files` accepts both `owner_type='task'` and `'thread'` (L21 proven by insert test).
5. `workflow_steps` carry step_type + nullable skill_id + tools[] + capability_key + workspace io.
6. TypeScript types regenerated; a lineage query returns joined agent→workflow→task→artifact.

## Checkpoint items — RESOLVED (confirmed by London 2026-07-05)

- **Single migration `019`** — confirmed (split to `019a/019b` only if it grows unwieldy).
- **`workspace_files` binary storage** — new **private `workspace` Storage bucket** for binaries
  (mirror the `artifacts` bucket's `auth.uid()`-foldername policies); text `content` stays in-DB.
- **`domain_agents` capability representation** — `capabilities jsonb` + `thought_starters jsonb`,
  seeded as POC placeholders.
- **`workflows`/`templates` ownership** — admin-global for beta; add nullable `created_by`
  (`references auth.users(id) on delete set null`) for forward-compat, no RLS branch.
- **`freeform_requests`** — nullable `resulting_task_id` (`references public.tasks(id) on delete set
  null`).

### Guardrails confirmed with the above
- On `artifacts.source_kind`: **drop and recreate** the `artifacts_source_kind_check` constraint
  with both values (`'vcso_thread'`, `'domain_agent_task'`) — do **not** add a second constraint.
- Global-table writes (`domain_agents`/`workflows`/`workflow_steps`/`templates`) gate through the
  existing `private.is_skill_admin()` function that `skill_packs` uses — do not invent a new admin
  path. All-authenticated `select`; writes via `service_role`/admin.
- Verification must prove a `workspace_files` insert for **both** `owner_type='task'` and
  `'thread'` — the L21 proof Phase 6 depends on.
