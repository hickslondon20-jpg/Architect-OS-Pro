# Episode 6 — Planning Agent Handoff (Agent Harness → Domain Agents + VCSO Deep Mode)

You are the **planning agent for Episode 6**. Your job is to help brainstorm and **finalize a
working model**, then produce **phased plans** that get handed to execution agents — the same
way Episode 5 was planned. You are **not** implementing, and you are **not** blindly turning
the reference PRD into plans. Episode 6 still needs real fleshing-out first, especially around
how the two harness models show up **across surfaces and on the front end** — not just backend
wiring and Supabase tables. Brainstorm and align **before** writing any plan.

---

## Required reading (source of truth — read before responding)

1. **`.planning/INTELLIGENCE-LAYER-ARCHITECTURE.md`** — the three surfaces, four-tier
   knowledge layer, two-layer wiki, and the write-ownership/feeder model (OS Engine is the
   sole writer).
2. **`.planning/INTELLIGENCE-LAYER-EPISODE-MAP.md`** — your primary reference. Read all of
   **Section 4 → Episode 6 including the "Episode 6 Refinement" block**, plus §2 (the five
   primitives), §3 (cross-cutting layers, incl. §3.4 usage metering), §5 (locked decisions
   L1–L15), §6 (deferred), and §8 (post-Ep7 front-end audit — so you know where UX polish
   lives).
3. **`docs/plans/ep6-agent-harness/PRD-Agent-Harness.md`** — the reference machinery (Deep
   Mode, harness engine, 5 phase types, contract-review example). **Reference, not blueprint.**
4. **`../ArchitectOS Beta Launch/DomainAgents_Product_Vision.md`** and
   **`../ArchitectOS Beta Launch/DomainAgents_Wireframe_Spec.md`** — **REQUIRED source-of-truth**
   for the Domain Agents object model and the front-end surfaces. Build to these. Where the
   reference PRD and these docs differ, **these win.**

The older `.planning/INTELLIGENCE-VISION.md` is **superseded** — do not use it.

---

## The reframe

Episode 6 builds two things on **one shared substrate** (workspace, sub-agents, ask-user,
plan/progress, trace, persistence):

- **Domain Agents** — the workflow/task execution surface. A backend state machine drives
  deterministic phases; the LLM executes within them. This is the episode's center of gravity.
- **Virtual CSO Deep Mode** — the open-ended, LLM-drives-the-flow soft harness.

**Critical placement (L14):** open-ended Deep Mode lives in **Virtual CSO only**. Domain
Agents is **not a second Virtual CSO** — it is scoped and task-bound. Domain Agents gets the
hard-harness workflow/task engine, a **bounded task-scoped workspace**, and the **logged
free-form ask** (assemble-within-scope) — *not* open-ended Deep Mode. Build the shared
substrate once; the two surfaces present it differently.

---

## Build to the Domain Agents object model — not reference nomenclature

Use the terminology Rosetta stone in the episode map's Episode 6 Refinement block. In short:
harness→**Workflow**, run→**Task**, phase→**Skill** (or a programmatic step), output schema +
DOCX→**Template**, plan panel/phase events→**Kanban + progress + narration**, workspace
files→task resources + **artifact render panel**. Skills and Templates are **internal** —
founders see only **Workflows** and **Artifacts**. Build the lineage **Agent → Workflow →
Task → Artifact** end to end (it is also the Ep7 provenance backbone).

---

## Surface intentionality (the explicit ask for this pass)

For **every** capability you plan, name the **backend wiring AND the surface it feeds AND its
interaction contract** — do not plan backend/Supabase in isolation. The surfaces are already
speced in the wireframe: **Agent Gallery, Agent Profile (Workflows shelf + free-form ask),
Agent Workspace (two-pane: task-bound thread reusing VCSO chat components + artifact render
panel), Tasks/Kanban (Ready→Running→Blocked→Review→Done), Artifacts Library.** Map each
capability to its surface and to the Kanban state machine (the wireframe §6 is the source of
truth for states/transitions).

**Draw the line:** this pass does **functional** surface mapping (which capability feeds which
surface, what the interaction is), **not** visual/UX design — that is the post-Ep7 front-end
audit (episode map §8). But nothing gets planned backend-only.

---

## Locked decisions to honor

From the episode map (§5) and the Domain Agents vision:

- **L14** — open-ended Deep Mode = VCSO only; Domain Agents = workflow/task + bounded
  workspace + free-form ask.
- **L15** — **first anchor workflow = Monthly P&L Assessment (Financial).** Build the engine
  **generic** and prove it with this. **Do NOT port the reference's Contract Review harness.**
- **L2** skills are not domain-scoped · **L3** the code sandbox is shared (VCSO + Domain
  Agents) · **L11** show curated trace summaries, never raw chain-of-thought · **L12** model
  routing is per-job (Claude-locked conversation; cheaper models for sub-agents/utility) ·
  **L13** degradation vs metering over one tagged usage-event stream.
- Domain Agents object model: **Skills/Templates internal**, second-brain promotion is
  **deliberate/opt-in** (not auto-ingest), five fixed agents (Financial, Client, Operational,
  Team, Stewardship), AI Usage is a **global Settings page** (not a Domain Agents tab).

---

## Decision points to work through (brainstorm these before plans)

1. **Phase vs Skill** — model a Workflow as an ordered chain of Skills; map the five reference
   phase types (programmatic, llm_single, llm_agent, llm_batch_agents, llm_human_input) onto
   skill/step execution rather than introducing "phases" as a competing concept.
2. **Templates as a first-class internal object** — build them (mapping to output schema +
   artifact generation); keep them backstage.
3. **VCSO → Domain Agent invocation boundary** — the vision has VCSO invoke an agent
   (`@FinancialAgent …`) which spawns a Task in the *same* plumbing (same Kanban + library).
   Define that hand-off contract.
4. **D1 registry reconciliation** — **resolve it here** (Ep6 is where the harness pulls
   curated per-phase tool subsets and sub-agents draw on `agent_capabilities` — the two
   registries meet). Keep **D2** (harness engine also powering OS Engine synthesis) reachable
   by building the engine **generic**, not Domain-Agents-specific.
5. **Workspace ↔ Artifacts library graduation (D4)** — how the per-task workspace relates to
   the persistent artifacts library and the opt-in OS Engine promotion.
6. **Carry the wireframe's open decisions (§12):** out-of-scope free-form guardrails,
   auto-ingest vs deliberate promotion (recommended: **deliberate**), review-gate skips
   (whether any workflow may go Running→Done with no Review gate).

---

## Dependencies & gates

- **Ep5 verification debt is a gate.** Domain Agents runs in the GKE sandbox and on the VCSO
  Python tool loop. Before Ep6 leans on them, the Ep5 batch must clear: apply the deny-all-
  egress NetworkPolicy, run the live end-to-end smokes, and flip the Python-stream flag. Treat
  the sandbox/loop as a dependency to verify, not assume.
- **Ep7 readiness** — carry source refs through Skill/phase outputs and the Task→Artifact
  lineage so Ep7 citations/provenance layer on without re-plumbing.
- **Reuse before create.** Verify what already exists before proposing new tables/services —
  e.g. the M8 `agent_capabilities` / `agent_delegation_runs` scaffold, `sandbox_service.py` +
  `sandbox_bridge.py`, and the Ep5 tool registry. Do not rebuild these.

---

## Your task & output

1. **Brainstorm and finalize the working model** for Episode 6 across the surfaces — resolve
   or explicitly frame the decision points above, honoring the locked decisions.
2. Then produce **phased plans (GSD flow)** for handoff to execution agents, each phase naming
   its backend wiring **and** its surface manifestation and the build-it-right seams so
   nothing forecloses Ep7 or the post-Ep7 front-end audit.
3. Surface **what still needs brainstorming vs. what's decided**, and **flag any conflict**
   with the locked decisions or the Domain Agents vision rather than resolving it silently.

## How to work

- Map to **our use case and the Domain Agents vision** — do not reverse-engineer or port the
  reference (especially Contract Review).
- Plan **surface + backend together**; never backend-only.
- **Respect the locked decisions**; resolve D1 here and keep D2 reachable.
- Go **one surface / capability at a time** and confirm alignment before moving on.
