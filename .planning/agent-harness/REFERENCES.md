# References: Agent Harness — Domain Agents + VCSO Deep Mode (Episode 6) — ArchitectOS Pro

The reference-pattern → phase → **extract / adapt / skip** map. The reference machinery is mined
for design lessons; it is **not** a blueprint. Build to the Domain Agents object model (see
`CONTEXT.md` Rosetta). Where the reference PRD and the Domain Agents docs conflict, the Domain
Agents docs win.

## Canonical sources (win over the reference)

- `../INTELLIGENCE-LAYER-ARCHITECTURE.md` — three surfaces, four-tier knowledge layer, one-writer/
  feeder model.
- `../INTELLIGENCE-LAYER-EPISODE-MAP.md` — §4 Episode 6 + Refinement + Refinement 2; §2 primitives;
  §3 cross-cutting layers (3.1 registry, 3.2 trace, 3.3 persistence, 3.4 metering, 3.5 routing);
  §5 locked **L1–L21**; §6 deferred; §8 post-Ep7 front-end audit.
- `../../docs/plans/ep6-agent-harness/DomainAgents_Product_Vision.md` — object model, five domains,
  production model, experience philosophy, founder journey, boundaries. **(Now mirrored in-repo — the
  canonical source also lives in the external `ArchitectOS Beta Launch` planning folder.)**
- `../../docs/plans/ep6-agent-harness/DomainAgents_Wireframe_Spec.md` — surfaces, components, states,
  the Kanban state machine (§6, source of truth), data objects, §12 open decisions. Companion:
  `DomainAgents_Wireframe.html` (the approved mockup the surface scaffold was built from — reference
  for the §8 front-end/UX audit).

## Reference material (source material — stays in `docs/plans/ep6-agent-harness/`)

- `PRD-Agent-Harness.md` — the reference episode PRD (Deep Mode, harness engine, 5 phase types,
  Contract Review). Reference for machinery only.
- `README.md`, `Ep6-Planning-Handoff-Prompt.md`, `Ep6-Planning-Feedback-Round1.md` — the episode's
  own source/handoff/feedback docs. Not our developed plans.

## Reference PRD → phase extract/adapt/skip

| Reference PRD element | Phase | Disposition |
|---|---|---|
| Part 2 harness engine (backend state machine) | P2 | **Adapt** — build generic; our Workflow/Task nomenclature; Claude structured output (not OpenAI `response_format`). |
| 5 phase types (`programmatic`/`llm_single`/`llm_agent`/`llm_batch_agents`/`llm_human_input`) | P2 | **Adapt** — become `step_type` execution modes on `workflow_steps`; LLM steps bind Ep4 Skills. |
| Workspace virtual filesystem (`workspace_files`) | P1/P2 | **Adapt** — owner-flexible (`task_id`/`thread_id`, L21); reuse for Deep Mode. |
| `harness_runs` table (one active run per thread) | P1 | **Adapt** — folded into first-class `tasks` (many-per-founder; Task ≠ thread, C2). |
| Gatekeeper LLM (pre-harness prerequisites) | P2/P3 | **Adapt** — a prereq check reading OS Engine → Blocked upload prompt; not a separate conversational agent. |
| Human-in-the-loop / `ask_user` | P2 | **Adapt** — `llm_human_input` step → Blocked "waiting on you". |
| Batched parallel sub-agents | P2 | **Adopt (reuse)** — via `SubAgentOrchestrator` + `asyncio.gather`; resumable from partial output. |
| Post-harness response LLM | P3/P4 | **Adapt** — completion narration → Review state + completion actions. |
| Plan panel + phase SSE events | P4 | **Adapt** — Kanban state + progress indicator + narration; **no editable todo panel** (C4). |
| DOCX via `post_execute` in sandbox | P3/P5 | **Adopt (scoped, L20)** — Ep4 sandbox export path; Rule #4 (N8N) is fixed-reports-only. |
| Part 3 Contract Review harness (8 phases) | — | **SKIP (L15)** — not ported. Anchor = Monthly P&L Assessment (generic POC, L19). |
| Part 1 Deep Mode (toggle, todos, workspace, `task`, `ask_user`) | P6 | **Adapt** — Virtual CSO only (L14); reuse the L21 substrate; `agent_todos` is the one editable-plan surface. |
| OpenAI-compatible / OpenRouter framing | — | **SKIP (L12/C1)** — Claude-locked orchestration. |
| Session persistence | P1/P6 | **Adopt** — reuse existing persistence + `workspace_files`. |

## Prior-build assets this episode inherits (do not rebuild — see `CONTEXT.md` reuse map)

- Ep4 — skills primitive, shared GKE sandbox, `artifacts` + `ArtifactService`.
- Ep5 — `tool_registry.py` (registry, scope sources, `tool_search`, citation-ready results),
  `vcso_chat_service.py` (streaming tool loop, curated trace, compaction), `usage_events` (tagged
  stream), MCP scaffold, `sub_agent_orchestrator.py` + `agent_capabilities`.
