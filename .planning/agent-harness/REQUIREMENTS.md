# Requirements: Agent Harness — Domain Agents + VCSO Deep Mode (Episode 6) — ArchitectOS Pro

**Defined:** 2026-07-03 (Ep6 planning pass)
**Core Value:** A founder can enter a specialist Domain Agent and **get a finished, downloadable
artifact produced through an enforced, repeatable workflow** — grounded in the platform's
knowledge, tracked from Agent → Workflow → Task → Artifact — while the Virtual CSO separately
gains an open-ended **Deep Mode** for autonomous multi-step work. Both run on one shared
substrate (workspace, sub-agents, ask-user, curated trace, persistence).

> Read `CONTEXT.md`, then `../INTELLIGENCE-LAYER-ARCHITECTURE.md` and
> `../INTELLIGENCE-LAYER-EPISODE-MAP.md` (§4 Ep6 + Refinements, §5 locked L1–L21). Where the
> reference PRD (`../../docs/plans/ep6-agent-harness/PRD-Agent-Harness.md`) and the Domain Agents
> docs conflict, the Domain Agents docs win. This build is mapped to our use case, not
> reverse-engineered from the reference.

---

## Adaptation Notes (vs. Reference Ep6 PRD)

| Reference Element | ArchitectOS Decision |
|---|---|
| Two harness types as one feature on one surface | **SPLIT across surfaces (L14).** Hard harness → Domain Agents; soft harness (Deep Mode) → Virtual CSO only. |
| harness / run / phase / gatekeeper nomenclature | **REMAPPED** to Workflow / Task / typed-step (Skill or programmatic) / prereq-check. Skills + Templates internal; founders see Workflows + Artifacts. |
| Contract Review as the first harness | **NOT PORTED (L15).** First anchor = **Monthly P&L Assessment (Financial)**, built generic as a POC (L19). |
| OpenAI `response_format` + "OpenRouter/Ollama compatible" | **DROPPED (L12/C1).** Claude-locked orchestration; structured output via Claude schema; cheap models only inside utility/sub-agent steps. |
| One active harness run per thread | **NOT INHERITED (C2).** Tasks are first-class, many-per-founder across agents; Task ≠ VCSO thread. |
| Editable todo/plan panel for the harness | **DEEP-MODE-ONLY (C4).** Domain Agents shows fixed workflow steps via progress indicator + Kanban + narration. |
| post_execute DOCX in-sandbox | **KEPT, scoped (L20).** Domain Agent artifacts render/export via the Ep4 sandbox path; CLAUDE.md Rule #4 (N8N) governs fixed platform reports only. |
| Artifact auto-promotion to memory | **DELIBERATE, trigger-only (L17/L6).** Promotion triggers an OS Engine ingestion workflow; OS Engine synthesizes as sole writer. |
| Workspace as generic per-thread FS | **OWNER-FLEXIBLE (L21).** Keyed `task_id` or `thread_id` so Deep Mode reuses it. |

---

## v1 Requirements

### Object Model & Lineage (OBJ) — Phase 1
- [ ] **OBJ-01**: Tables `domain_agents` (5 fixed disciplines, seeded), `workflows`,
  `workflow_steps`, `templates`, `tasks`, `workspace_files`, `freeform_requests` exist with
  founder-scoped RLS. `domain_agents` is distinct from the M8 `agent_capabilities` registry.
- [ ] **OBJ-02**: Lineage `Agent → Workflow → Task → Artifact` resolves end to end; `Workflow 1→N
  Tasks` and `Template 1→N Artifacts` hold. `artifacts` (011) extended with lineage + `provenance`
  columns rather than replaced.
- [ ] **OBJ-03**: `workspace_files` is **owner-flexible** — accepts `owner_type='task'` and
  `owner_type='thread'` (L21), unique on `(owner_type, owner_id, file_path)`.
- [ ] **OBJ-04**: `workflow_steps` carry a `step_type`, an optional bound `skill_id`, a curated
  `tools` registry-id subset (D1 layer A) and an optional `capability_key` (D1 layer B), plus
  `workspace_inputs`/`workspace_output`.
- [ ] **OBJ-05**: Skills reference the Ep4 skill primitive (no new skills table); Templates are
  internal (never surfaced to founders).
- [ ] **OBJ-06**: `freeform_requests` (request-capture) logs every free-form ask (raw text,
  mapped/unmapped, agent, resulting task, timestamp).

### Harness Engine (HARN) — Phase 2
- [ ] **HARN-01**: A generic backend state machine advances a Task through its Workflow's ordered
  steps deterministically; the system advances steps, not the LLM. Built domain-agnostic (not
  P&L-specific).
- [ ] **HARN-02**: Five step-execution modes work: `programmatic`, `llm_single` (structured output
  via **Claude** schema, not OpenAI `response_format`), `llm_agent` (bound Skill, reuses
  `SubAgentOrchestrator`), `llm_batch_agents` (concurrent, resumable from partial output),
  `llm_human_input` (→ Blocked).
- [ ] **HARN-03**: Context passes via `workspace_files` (paths, not inline content) — a thin
  orchestrator whose main-window overhead stays small regardless of task size.
- [ ] **HARN-04**: Each step's tool set is built from the Ep5 registry using its `tools` subset +
  `capability_key` (D1 two-layer bridge); never a flat global list.
- [ ] **HARN-05**: A prereq check reads OS Engine for the workflow's required resources before
  step 1; missing resources emit a **Blocked** upload/resource prompt (not a separate gatekeeper
  agent).
- [ ] **HARN-06**: State transitions Ready → Running → Blocked → Review → Done are driven by task
  events; revision re-enters Running; **no Running→Done skip** (review gate always on).
- [ ] **HARN-07**: Every model call emits a `usage_events` record tagged `surface='domain_agents'`,
  `role` (`main`/`sub_agent`/`utility`), `model`, `task_id` (L13). Trace is curated only (L11).

### Anchor Workflow (ANCH) — Phase 3
- [ ] **ANCH-01**: A generic **Monthly P&L Assessment** workflow (prereq/intake → clarify →
  analyze → synthesize → template→artifact) runs end to end on the HARN engine with **zero
  P&L-specific engine code** (L15/L19).
- [ ] **ANCH-02**: The happy path is provable: launch → Task + Workspace open → OS Engine prereq
  check → Blocked upload prompt → run with narration → artifact renders live → lands in Library →
  ends at Review.
- [ ] **ANCH-03**: The downloadable artifact is produced through the **Ep4 sandbox export path**
  (L20), registered with full provenance.

### Surfaces (SURF) — Phase 4
- [ ] **SURF-01**: Agent Gallery (5 fixed cards + Recent Tasks strip), Agent Profile
  (Capabilities, thought-starters, Workflows shelf, free-form ask, recent activity), Agent
  Workspace (two-pane: task-bound thread reusing VCSO chat components + artifact render panel),
  Tasks/Kanban, Artifacts Library — all wired to real backend data (no mocks).
- [ ] **SURF-02**: Kanban board renders the HARN state machine; Blocked shows the "waiting on you"
  flag; all three entry points (Profile launch, Kanban card, VCSO `@Agent`) resolve to one task.
- [ ] **SURF-03**: Free-form ask runs broad-but-bounded (L16) — maps to a workflow or assembles a
  scoped artifact within the agent's registered capability surface incl. peer-agent consultation;
  artifact-bound; always logged to `freeform_requests`.
- [ ] **SURF-04**: Skills and Templates never appear on any founder-facing screen. AI Usage links
  out to the global Settings page (not a Domain Agents tab).

### Graduation & OS Engine Feeder (GRAD) — Phase 5
- [ ] **GRAD-01**: On reaching Review, the terminal workspace deliverable graduates to an
  `artifacts` row via `ArtifactService`, carrying lineage + provenance.
- [ ] **GRAD-02**: "Add to Second Brain" (deliberate/opt-in) emits a well-formed **OS Engine
  ingestion trigger** (L17) carrying artifact ref + provenance + lineage; OS Engine synthesizes as
  sole writer. No artifact auto-promotes.
- [ ] **GRAD-03**: Completion actions (Download, Add to Second Brain) surface in the Workspace and
  the Artifacts Library; the Library shows a provenance link back to task→workflow→agent.

### VCSO Deep Mode (DEEP) — Phase 6
- [ ] **DEEP-01**: A per-message Deep Mode toggle in Virtual CSO loads deep-mode tools + extended
  prompt + higher iteration cap; OFF is byte-for-byte current behavior.
- [ ] **DEEP-02**: Deep-mode tools work: `write_todos`/`read_todos` (→ new `agent_todos`, editable
  plan panel — the only editable-plan surface, C4), `write_file`/`read_file`/`edit_file`/
  `list_files` (**reuse `workspace_files`, `owner_type='thread'`**, L21), `task` (sub-agent
  delegation), `ask_user` (pause/resume).
- [ ] **DEEP-03**: Deep Mode is **Virtual CSO only** (L14) — no Deep Mode / open-chat surface in
  Domain Agents. Orchestration = Claude (L12); usage tagged `surface='virtual_cso'` (L13).
- [ ] **DEEP-04**: Todos + workspace persist and survive reload; a thread resumes after reconnect.

### VCSO → Domain Agent Invocation (INVK) — Phase 7
- [ ] **INVK-01**: `@Agent …` in a VCSO thread spawns a Task via the shared `create_task`
  (`origin='vcso'`) — indistinguishable in Kanban/Library from a Profile-launched task except for
  `origin`.
- [ ] **INVK-02**: The VCSO thread receives a task handle + live status + artifact link and does
  **not** morph into a Domain Agent workspace (L14 boundary). The task runs its own task-bound
  workspace on the HARN engine.

### Verification & Seams (VERIF) — Phase 8
- [ ] **VERIF-01**: The anchor workflow runs end to end from all three entry points; state machine,
  resumability (batch + Blocked), and review gate hold.
- [ ] **VERIF-02**: Locked-decision assertions pass — L14 (no Deep Mode in Domain Agents), L11
  (curated trace only), L12/C1 (Claude orchestration), L13 (tagged usage + role split), L20
  (sandbox export path), L21 (one `workspace_files` serving task + thread).
- [ ] **VERIF-03**: Ep7 forward seams verified — `tasks.step_results` + `artifacts.provenance`
  carry `source_refs` end to end; the L17 promotion trigger payload is well-formed (downstream may
  be stubbed).

---

## v2 / Deferred

| Item | Deferred reason |
|---|---|
| OS Engine wiki-page generation + vectorization from a promoted artifact | OS Engine's own build; Ep6 emits only the L17 trigger. |
| Additional workflows for Client / Operational / Team / Stewardship agents | Roadmap posture — start narrow, expand through beta (vision §10). |
| Real financial IP for the P&L recipe | L19 — anchor is a generic POC; content refined later. |
| Live MCP connectors feeding workflows with live external data | L7 — scaffold only at beta. |
| Ep5 live verification debt (egress policy, live smokes, stream flip) | L18 — non-gating; folds into consolidated smoke/credentials phase (§8). |
| Visual/UX design polish of all surfaces | Post-Ep7 front-end audit (§8). |
| Deep Mode context auto-compaction; background/async agent runs | Reference post-MVP; not beta scope. |
| Account-level metering ledger / quotas / admin panel | Deferred from Ep5; unchanged. |

---

## Out of Scope

| Feature | Reason |
|---|---|
| Domain Agents as an open-ended strategy chat | L14 — not a second CSO; artifact-bound only. |
| Any Domain Agent / Deep Mode tool writing to the knowledge base | One-writer rule (architecture §5); promotion triggers the OS Engine feeder. |
| New-skill authoring mid-task inside a free-form ask; out-of-registry tool reach | L16 capability-surface bound. |
| Model-agnostic / OpenRouter primary chat | L12 / CLAUDE.md — Claude-locked orchestration. |
| Team / multi-user task or artifact sharing | Beta is founder-only. |
| Porting the reference Contract Review harness | L15 — anchor is Monthly P&L Assessment. |

---

## Requirement Traceability

| Requirement group | Phase |
|---|---|
| OBJ-01 … OBJ-06 | Phase 1 |
| HARN-01 … HARN-07 | Phase 2 |
| ANCH-01 … ANCH-03 | Phase 3 |
| SURF-01 … SURF-04 | Phase 4 |
| GRAD-01 … GRAD-03 | Phase 5 |
| DEEP-01 … DEEP-04 | Phase 6 |
| INVK-01 … INVK-02 | Phase 7 |
| VERIF-01 … VERIF-03 | Phase 8 |

---
*Requirements defined: 2026-07-03 (Ep6 planning pass). Adapted from the Ep6 reference PRD and
mapped to our use case per the canonical architecture + episode map (L1–L21). D1/D2/D4 resolved
in `CONTEXT.md`.*
