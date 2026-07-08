# Phase 4 Research — Frontend Scaffold + Wiring Surfaces (verified 2026-07-05)

**Phase 4 is a WIRING pass, not greenfield.** The Domain Agents UI already exists as a wireframe
scaffold on mock data. Phase 4 replaces mock with real Phase 1–3 backend + SSE. **Functional
wiring only — no visual redesign** (post-Ep7 §8). Trust this; re-verify before changing.

## Existing frontend scaffold (repo root, NOT `src/`)
- **Pages:** `pages/ProSuite/domain-agents/` — `DomainAgentsLayout.tsx`, `DomainAgentGallery.tsx`,
  `DomainAgentProfile.tsx`, `DomainAgentWorkspace.tsx`, `DomainAgentTasks.tsx` (Kanban),
  `DomainAgentArtifacts.tsx`, `README.md`, `mockDomainAgents.ts`, `types.ts`. Routed under
  `/pro/intelligence/domain-agents`; nav flows already wired; AOS tokens applied; `pro_suite`-gated.
- **Primitives:** `components/pro-suite/domain-agents/DomainAgentPrimitives.tsx` (AgentCard,
  RecentTaskChip, SectionEyebrow, …).
- **README state:** "No Supabase, n8n, file upload, storage, or AI calls were added." All five task
  states represented; free-form = local capture; Second Brain = deliberate button; AI Usage =
  Settings link; every workflow moves through Review; render preview is a fixed right rail (drawer-ready).

## Mock shape the components consume (`mockDomainAgents.ts` + `types.ts`) — the read endpoints must map to this
`DomainAgent { id, name, shortName, initial, color, discipline, strength, activity,
fullDescription, capabilities[{label,description}], thoughtStarters[{text, workflowId}],
workflows[{id, agentId, name, description, defaultTaskTitle}] }`; plus `DomainTask`,
`DomainArtifact`, `DomainWorkflow`, `DomainTaskStatus`.
- **DB→frontend field map (read endpoint):** `domain_agents.key`→`id`,
  `discipline_statement`→`discipline`, `what_its_good_at`→`strength`, `capabilities` jsonb→
  `capabilities[]`, `thought_starters` jsonb→`thoughtStarters[]`, `color`; derive `initial` +
  `activity` (from task counts). `workflows` joined from the `workflows` table.
- **Note:** mock shows 3 Financial workflows (P&L, hiring, pricing); DB seeds only P&L. Phase 4
  renders **real** DB workflows (P&L only for now) — fewer than the mock until more are seeded. Don't
  hardcode the extras.

## Reuse points for the Workspace (04-02)
- **SSE client:** `lib/virtualCsoApi.ts` (the VCSO fetch + `event:/data:` parser + reconstruct) —
  mirror as a tasks API client hitting the Phase-2 `/api/tasks/*` endpoints with the frozen `task_*`
  event vocabulary.
- **Chat components:** `components/pro-suite/virtual-cso/` — `ChatThread`, `Composer`,
  `MessageBubble`, `AgentStepsPanel` (curated trace), `SourcesPanel` — reuse in
  `DomainAgentWorkspace` for the task-bound thread + progress/trace, per the wireframe (§4).

## Backend endpoints today (main.py / routers)
- **Task execution (Phase 2, live):** `routers/tasks.py` mounted at `/api/tasks` — `POST /api/tasks`,
  `POST /{id}/run` (SSE), `GET /{id}` (reconstruct), `POST /{id}/messages`, `POST /{id}/files`,
  `POST /{id}/cancel`.
- **Artifacts (Ep4):** `GET /api/artifacts/{artifact_id}`, `DELETE /api/artifacts/{artifact_id}`.
- **MISSING (Phase 4 adds):** `GET /api/domain-agents` (gallery), `GET /api/domain-agents/{key}`
  (profile), `POST /api/domain-agents/{key}/freeform` (request-capture + mapping),
  `GET /api/tasks` (Kanban list), `GET /api/artifacts` (Library list).
- Founder endpoints use `Depends(get_current_user_id)`.

## Locked forks (2026-07-05)
1. **Split:** `04-01` = read/list wiring (Gallery/Profile/Kanban/Library + read endpoints);
   `04-02` = live Workspace (SSE run/stream, reply, upload, render panel, free-form ask UI).
2. **Read endpoints:** new `routers/domain_agents.py` for agent/profile/artifacts-list + freeform;
   the task **list** (`GET /api/tasks`) stays in `tasks.py` with its resource (minor cleaner
   deviation — same spirit as "don't cram everything into one router").
3. **Free-form:** capture (`freeform_requests`) + workflow-mapping (mappable→`create_task`) now;
   defer L16 net-new dynamic assembly.
4. **Second Brain button:** inert/disabled in Phase 4; the L17 promotion trigger is Phase 5.
