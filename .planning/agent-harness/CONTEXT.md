# Context: Agent Harness — Domain Agents + VCSO Deep Mode (Episode 6) — ArchitectOS Pro

**Written:** 2026-07-03 (Ep6 planning pass, post-alignment Round 1)
**Audience:** The Orchestration Agent and every Execution Agent that touches this build. This
document has no dependency on the conversation that produced it — everything load-bearing is
written down here.

> **Canonical sources this build sits under.** Read these before anything here:
> `../INTELLIGENCE-LAYER-ARCHITECTURE.md` (three surfaces, four-tier knowledge layer, the
> one-writer/feeder rule) and `../INTELLIGENCE-LAYER-EPISODE-MAP.md` (§4 Episode 6 + Refinement
> + Refinement 2, §2 primitives, §3 cross-cutting layers, §5 locked **L1–L21**, §6 deferred).
> Build-to-vision: `../../../ArchitectOS Beta Launch/DomainAgents_Product_Vision.md` and
> `DomainAgents_Wireframe_Spec.md`. Reference-only (machinery, **not** nomenclature or scope):
> `../../docs/plans/ep6-agent-harness/PRD-Agent-Harness.md`. Where the reference PRD and the
> Domain Agents docs conflict, **the Domain Agents docs win.**

---

## Why This Build Exists

Ep1–Ep5 gave the platform a RAG substrate, a KB Explorer, a document wiki engine, a skills +
sandbox artifact engine (Ep4), and a shared, discoverable tool registry with a real Virtual CSO
tool loop (Ep5). What it can't do yet is let a founder **walk into a specialist and get a
finished deliverable produced through an enforced, repeatable process** — and it can't let a
Virtual CSO thread go **autonomous and multi-step** when a question needs it.

Episode 6 builds **two control models over one shared substrate**, landing on **different
surfaces**:

- **Domain Agents (center of gravity) — the hard harness.** A backend state machine drives a
  Task through a Workflow's deterministic, ordered steps. The LLM executes *within* a step; the
  **system** advances steps. Scoped, task-bound, outcome-oriented.
- **Virtual CSO Deep Mode (L14) — the soft harness.** The LLM drives an open-ended, multi-step
  flow (plan, workspace, sub-agents, ask-user). **Lives in Virtual CSO only.** Domain Agents is
  deliberately *not a second CSO*.

The shared substrate — task/thread-scoped **workspace**, **sub-agent** delegation, **ask-user**,
**curated trace**, **persistence** — is built **once** (owner-flexible per L21) and presented two
ways.

This is the sixth intelligence-layer build in the Pro Suite initiative. It **inherits and does
not rebuild** the Ep1–Ep5 substrate (see Reuse Map).

---

## The Reframe (map to our object model, never reference nomenclature)

The reference PRD's "harness / run / phase / output_schema / gatekeeper" machinery is real and
useful, but it must be built to the **already-designed Domain Agents object model**. Lineage:
`Agent → Workflow → Task → Artifact`, tracked end to end (this lineage is also the Ep7
provenance backbone). **Skills and Templates are internal** — founders see only **Workflows**
and **Artifacts**.

| Reference (Ep6 PRD) | ArchitectOS Domain Agents |
|---|---|
| domain harness (definition) | **Workflow** — ordered chain of typed steps, targets a Template |
| harness run | **Task** — one run of a Workflow (`Workflow 1→N Tasks`) |
| phase | a **typed step** — LLM steps bind a **Skill**; others are programmatic |
| output_schema + post_execute DOCX | **Template** — internal output contract; invisible to founders |
| gatekeeper LLM | prereq check — agent reads OS Engine first, prompts for uploads if missing |
| human-in-the-loop / ask_user | clarifying question → **Blocked / "waiting on you"** |
| post-harness response | completion narration → **Review** state → Download / Add to Second Brain |
| plan panel + phase SSE events | **Kanban state** + Workspace progress indicator + narration |
| workspace virtual filesystem | task resources + right-pane **artifact render panel** → Artifacts library |
| batched parallel sub-agents | internal step execution (invisible to founder except via progress) |

---

## Reuse-Before-Create Map (verified in `python-backend/`, 2026-07-03)

**Reuse — do not rebuild:**

| Capability | Existing asset |
|---|---|
| Sub-agent delegation | `sub_agent_orchestrator.py`; `agent_capabilities` / `agent_delegation_runs` / `agent_delegation_steps` (migration 009) |
| Tool registry (Ep5) | `tool_registry.py` — `ToolRegistry`, `ToolDefinition`, `ToolSourceRef` (citation-ready), scope sources `AgentCapabilityScopeSource` + `RegistryNativeScopeSource`, `tool_search`, `delegate_to_sub_agent`, `to_anthropic`/`to_openai` |
| Persistent artifacts | `artifacts` table (011) + `artifact_service.py` (`ArtifactService`) |
| Shared sandbox | `sandbox_service.py` (GKE), `sandbox_bridge.py`, `sandbox_execution_service.py` |
| Streaming loop + curated trace | `vcso_chat_service.py` — SSE, `source_refs`, compaction, context signal |
| Metering usage stream | `usage_events.py` + migrations 013/014 (tagged `user`/`thread`/`surface`/`model`/`role`) |
| Structured data / P&L parsing | `structured_data.py`, `structured_query.py`, Docling ingestion (Ep1) |
| OS Engine read/write feeders | `agent_context.py`, `wiki_writeback.py`, `doc_wiki_*` adapters |

**Net-new for Ep6:** `domain_agents`, `workflows`, `workflow_steps`, `templates`, `tasks`,
`workspace_files`, `agent_todos` (Deep-Mode only), `freeform_requests` (request-capture).

⚠️ **Naming collision (avoided):** M8 `agent_capabilities` is the *sub-agent capability
registry* — a different concept from the five Domain **"Agents"** (disciplines). The new
discipline table is **`domain_agents`**. Never overload `agent_capabilities`.

---

## Governing Principles for Everything in This Build

1. **Build the substrate once (L21).** Workspace, ask-user, sub-agent delegation, and curated
   trace are keyed owner-flexible (`task_id` **or** `thread_id`) so Deep Mode reuses them rather
   than forking a thread-scoped copy.
2. **Plan surface + backend together.** No capability is planned backend-only; every one names
   its surface manifestation and interaction contract. (Visual/UX polish is the post-Ep7 audit,
   episode-map §8 — this build does *functional* wiring only.)
3. **Reuse before creating.** Verify the existing substrate before any new table/service.
4. **Verify before building.** Each phase's first move is a live-codebase / live-schema check.
5. **One writer (architecture §5).** No Domain Agent or Deep Mode tool writes to the knowledge
   base. Promotion *triggers* an OS Engine ingestion workflow; OS Engine synthesizes (L17).
6. **Everything is traceable.** Step outputs + the Task→Artifact lineage carry `source_refs` so
   Ep7 grounds without re-plumbing.
7. **Not a second CSO (L14).** Domain Agents interaction is artifact-bound and scoped; open-ended
   strategy chat stays in Virtual CSO.

---

## Decisions Execution Agents Must Not Override

1. **Two control models, one substrate, different surfaces (L14).** Open-ended Deep Mode = VCSO
   only. Domain Agents = hard-harness workflow/task engine + bounded task-scoped workspace + the
   logged free-form ask.
2. **Anchor = Monthly P&L Assessment, built generic as a POC (L15/L19).** Do **not** port the
   reference Contract Review harness; do **not** source canonical financial IP now.
3. **Free-form latitude is broad but bounded (L16).** Agents improvise beyond predefined
   workflows within their **registered capability surface** (recombine own skills/tools, **consult
   peer agents**), **artifact-bound**, logged to request-capture. No new-skill authoring mid-task;
   no out-of-registry reach; no open-ended strategy chat.
4. **Promotion is a trigger, not synthesis (L17).** Add-to-Second-Brain triggers an OS Engine
   ingestion workflow (→ Tier 2 vector + Tier 1/2 wiki page); OS Engine is sole writer. Ep6 builds
   only the trigger/hand-off. Promotion is **deliberate/opt-in**, never auto-ingest.
5. **Review gate always on.** Every workflow stops at Review before Done; no Running→Done skip in
   beta.
6. **Artifacts use the Ep4 sandbox export path (L20).** CLAUDE.md Rule #4 (N8N + Google-Docs)
   governs the fixed platform reports (MRA, AE Ladder, Sprint Launch Doc) only. Codified in
   CLAUDE.md.
7. **Claude-locked orchestration (L12).** Orchestration/narration/step-decision = Claude; cheaper
   models only inside utility/sub-agent steps via the model registry. Drop the reference's OpenAI
   `response_format` / OpenRouter framing (C1).
8. **Tasks are first-class, not thread-coupled (C2).** Many tasks per founder across agents; a
   Task ≠ a VCSO thread. Do not inherit the reference's "one active run per thread."
9. **Editable todo/plan panel is Deep-Mode-only (C4).** Domain Agents shows fixed workflow steps
   via the progress indicator + Kanban + narration. `agent_todos` is built in the Deep Mode phase.
10. **Curated trace only (L11).** Never raw chain-of-thought — steps, tool/source usage, sub-agent
    progress, evidence.
11. **One tagged usage-event stream (L13).** Domain Agents + Deep Mode calls emit `usage_events`
    tagged `surface` + `role` (`main`/`sub_agent`/`utility`); degradation vs. metering are two
    reads of one stream.

---

## Resolved Design Forks (carried in from planning)

- **D1 — registry reconciliation: RESOLVED = two distinct layers bridged by scope sources.**
  Already how `tool_registry.py` is built (`AgentCapabilityScopeSource` + `RegistryNativeScopeSource`).
  A workflow step references both a curated tool subset (`tools: [registry_ids]`) and, for
  agent/batch steps, a `capability_key` (from `agent_capabilities`, carrying model routing).
- **D2 — harness engine ↔ OS Engine synthesis: RESOLVED via L17.** The engine does **not** do
  wiki synthesis; promotion *triggers* OS Engine, which synthesizes. Build the engine generic
  regardless, so it stays reusable.
- **D4 — workspace ↔ artifact library: RESOLVED = three-tier graduation.** task `workspace_files`
  → `artifacts` (Library, at draft/Review, with provenance) → OS Engine second brain (opt-in).

---

## Conflict Register (flag new conflicts here; never resolve silently)

| # | Conflict | Resolution |
|---|---|---|
| C1 | Reference uses OpenAI `response_format` + "OpenRouter/Ollama compatible" | Dropped (L12). Claude orchestration; structured output via Claude schema; cheap models only inside utility/sub-agent steps. |
| C2 | Reference couples "one active harness run per thread" | Not inherited. `tasks` first-class, many-per-founder; Task ≠ VCSO thread. |
| C3 | CLAUDE.md Rule #4 (N8N/Google-Docs) vs Ep4 sandbox artifact export | Scoped by L20: Rule #4 = fixed platform reports only; Domain Agent artifacts = sandbox path. Codified in CLAUDE.md. |
| C4 | Editable todo/plan panel | Deep-Mode-only. Domain Agents uses fixed-step progress + Kanban + narration; `agent_todos` built in the Deep Mode phase. |

Any execution agent that hits a **new** conflict with L1–L21 or the Domain Agents docs **stops
and adds a row here**, rather than resolving it silently.

---

## Deferred / Out of Scope for Ep6

- **OS Engine wiki-page generation + vectorization internals** — OS Engine's own build; Ep6 emits
  only the promotion trigger (L17).
- **Live MCP connectors** — scaffold only at beta (L7); no live external data into workflows.
- **Ep5 live verification debt** (egress deny-all NetworkPolicy, live sandbox smokes,
  Python-stream flag flip) — **does not gate Ep6 (L18)**; folds into the consolidated
  smoke/credentials phase (episode-map §8). Flagged, monitored, not blocking.
- **Visual/UX design polish** — the post-Ep7 front-end audit (§8). Ep6 does functional wiring.
- **Additional workflows for the other four agents; real financial IP for the P&L recipe** —
  post-Ep6 roadmap.
- **Account-level metering ledger / quotas / admin panel** — deferred from Ep5; unchanged here.
