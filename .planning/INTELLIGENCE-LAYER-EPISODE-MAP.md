# ArchitectOS Intelligence Layer — Episode-to-Surface Map (Episodes 4–7)

> Authored: 2026-07-02
> Status: **Canonical companion to `INTELLIGENCE-LAYER-ARCHITECTURE.md`.**
> Purpose: Map the reference series' Episodes 4–7 onto ArchitectOS's three surfaces and
> four-tier knowledge layer, tracking how the core primitives evolve across episodes so
> each episode is built fit-for-purpose and future-proofed.
>
> This document is the input to later GSD episode-specific PRD and strategy work. Read
> `INTELLIGENCE-LAYER-ARCHITECTURE.md` first; this builds directly on it.

---

## 1. Purpose & How to Use This Document

This is the interpretation-and-extrapolation layer between the reference series and our
own build. For each of Episodes 4–7 it answers:

1. What is this episode **for us** (not for the reference build)?
2. Which of our surfaces — Virtual CSO, OS Engine, Domain Agents — does it serve, and how?
3. How do the **primitives** (tools, sub-agents, skills, artifacts, workflows) mature
   through it — both across surfaces and across episodes?
4. What must we build *now* so the later episodes layer on cleanly instead of forcing rework?

**Scope boundary.** This describes intended design and interpretation, not build state.
Episodes 1–2 (the RAG substrate and KB Explorer / knowledge layer) are covered by the
architecture doc. Episode 3 (PII redaction) was intentionally skipped. This map starts at
Episode 4, which is where the surface-level primitives begin.

**The through-line.** Every episode is read with the maturation of the primitives in view,
so an Episode 4 feature is built knowing what it becomes in Episodes 5–7 — the direct
countermeasure to build-then-rebuild churn.

---

## 2. The Five Primitives and Their Cross-Episode Arcs

We track five first-class primitives. Their evolution across the episodes is the spine of
this document.

**Tools** — callable capabilities.
`Ep4:` added ad hoc (hardcoded skill/sandbox tools). → `Ep5:` unified into a dynamic
**registry** with on-demand discovery (`tool_search`); skills and MCP tools become
registry sources. → `Ep6:` consumed as **per-phase curated subsets** by the harness. →
`Ep7:` tool outputs gain a **citation contract** — verbatim source text is evidence-marked,
non-citable outputs scrubbed.

**Sub-agents** — bounded specialists with isolated context.
`Ep4:` not advanced by the reference PRD, but **our** artifact flow already leverages them
(see Artifacts). → `Ep5:` become more capable via registry discovery + sandbox bridge. →
`Ep6:` industrialized — the general-purpose `task` tool + **batched parallel** sub-agents;
full realization of Ep1's M8 scaffold. → `Ep7:` their findings carry **provenance / source
refs** that propagate into artifacts.

**Skills** — reusable named behaviors (instructions + optional bundled files).
`Ep4:` born as a first-class primitive (progressive disclosure, private/global, creation
paths, building-block files, import/export). → `Ep5:` become **registry citizens**
(deferred-loaded, searchable, composable with native + MCP tools). → `Ep6:`
**workflow-bindable** (a harness phase can be built around a skill). → `Ep7:` outputs are
citable by construction (via the tools/sub-agents they invoke).
**Not domain-scoped** — skills naturally touch capabilities/domains but are never forced
into one of the five domains; domain association is a soft tag/discovery aid, not a boundary.

**Artifacts** — produced deliverables (analyses, memos, briefs, retrospectives, documents).
`Ep4:` generation is introduced — **skills orchestrate sub-agents that feed the shared
sandbox to render a file**. → `Ep6:` artifacts get a **persistent home** (workspace →
artifact library), become **resumable**, and a formatted report becomes a workflow's
guaranteed deliverable. → `Ep7:` become **auditable / source-grounded** — every claim
links to evidence.

**Workflows** — codified, first-class playbooks that compose the other four primitives.
`Ep6:` arrive as first-class (the hard-harness engine); they are the composite container of
tools + sub-agents + skills + artifacts, but tracked and surfaced as first-class playbooks
living in the Domain Agents space. → `Ep7:` produce **grounded deliverables end-to-end**
(evidence traces through every phase).

---

## 3. Cross-Cutting Layers

Three themes span multiple episodes and both interactive surfaces.

### 3.1 The Capability Layer (Registry + Plugins)

Introduced in Ep5. One registry is the shared home for callable capabilities; each surface
pulls its relevant subset. For us this unifies three plugin sources into one layer: native
tools, importable **skill packs** (the Ep4 open standard), and **MCP servers** (external
services). This is the concrete shape of the "skills and plugins area" as a first-class
part of the platform hierarchy.

- **Directional (deferred):** whether the Ep1/M8 `agent_capabilities` registry (sub-agent
  capabilities, with `allowed_surfaces`) and the Ep5 tool registry are **one unified
  registry or two distinct layers**. Current lean: two distinct layers. Definitive call
  deferred to that episode's build-planning.
- **MCP timing (locked):** backend **scaffolding in place for MVP/beta**, surfaced as
  "coming soon." Foundation laid; **no public external MCP connections shipped at beta
  launch** (connecting real services like GHL/Notion/CRM is its own lift and a beta
  blocker if attempted now).

**MCP & credentials — functional model.** A connected MCP server exposes *tools* (actions)
and *resources* (data) for a platform, callable through the same registry as native tools.
Connecting one lets the agent take **permissioned read/write actions** in the source system:

- A Notion MCP can read and write/update pages and databases.
- A QuickBooks MCP can pull financial data directly from the source, so founders don't
  manually upload exports.
- **Permissioning is two-layered:** what the server exposes (its tool set) *and* what the
  connected credential's scopes allow. A write tool can exist but a read-only token blocks it.
- **Live vs ingested is a per-connector data-model choice.** MCP data can be pulled **live
  at query time** (fresh, nothing stored — e.g. "current cash position") or **ingested/
  synced into the knowledge base** (chunked, embedded, wiki'd — becomes part of what the
  platform permanently knows). This maps onto the tier model: a live MCP call vs. ingestion
  into Tiers 2/3. Decide per connector.

**Credential storage.** Third-party connections require stored per-user credentials — either
a static **API key / access token** or an **OAuth 2.0** flow (access + refresh token, with
rotation; QuickBooks and most large SaaS use this). Storage requirements:

- **Supabase Vault** is the native path — a Postgres extension that stores encrypted secrets
  (API keys, tokens) with authenticated encryption at rest, decrypted only through a
  server-side view. Alternatives: app-level encryption with a KMS-managed key, or an external
  secrets manager. Vault is lowest-friction for our stack.
- **Secrets never reach the browser** — server-side only, used when the backend makes the
  call. Same principle as the Ep5 sandbox bridge (credentials host-side, agent sees only
  results), so this reinforces an existing decision rather than adding a new pattern.
- **Per-user, RLS-scoped, service-role access only** — never exposed via the public API,
  even encrypted.
- **OAuth token lifecycle** (refresh, revocation) is real work and is part of why MCP is
  backend-scaffold-only at beta, not a shipped public feature.

### 3.2 The Traceability & Reliability Layer

The goal that outputs *feel* valid and traceable. Mechanically this is Ep5 (interleaved
rich history that survives reload) + Ep6 (nested tool-call trace, sub-agent progress, the
scratchpad/plan panel with marked-off steps, workspace) + Ep7 (citations resolving to exact
evidence). It lives across **both Virtual CSO and Domain Agents** — showing the nested
progression, the sub-agent thought process, and how an answer was reached, alongside
clickable citations.

- **Constraint (from M8):** **no raw chain-of-thought.** "Showing the thinking" means
  curated trace summaries — steps, tool/source usage, sub-agent progress, evidence,
  confidence — not raw hidden reasoning. The "show your work" goal must be delivered within
  this stance.

### 3.3 The Persistence / Artifact Arc

A single arc runs Ep4 → Ep7: an artifact goes from an ephemeral sandbox file (Ep4) → a
durable, resumable, workspace-stored deliverable that graduates to the artifact library
(Ep6) → an auditable, source-grounded document (Ep7). **Build the artifact store early** —
Ep6 and Ep7 both depend on persistence, so Ep4 outputs must not be built as throwaway.

### 3.4 AI Usage Metering, Visibility & Compaction

A cross-cutting concern with an economic motive: the intelligence layers are the cost-heavy
surfaces, so we meter them to stay within margin and not lose money on an account.

**Metering scope.** Meter the intelligence layers — Virtual CSO, OS Engine, Domain Agents —
where the high-volume, high-cost AI usage lives. The foundational tools and smart-planning
exercises are low-volume and change little day to day; their cost is absorbed and they are
**not** closely metered.

**Near-term platform features (Virtual CSO):**
- **Percentage-based usage visibility at two scopes.** Per-thread/session: how much is left
  in *this* thread across all its tools **before degradation** (the Ep5 context indicator,
  reframed from raw token counts into a "% remaining" signal). Account-level: what % of the
  user's weekly/rolling-window allotment remains. Users see **percentages, not raw token or
  cost numbers.**
- **Context compaction for long threads.** Summarize/condense a long thread so it can keep
  going before hitting degradation. Pulls forward the Ep6 post-MVP compaction item, paired
  with the usage indicator.
- **Limit model à la Claude.** A rolling window (daily / ~5-hour) plus a weekly allotment.
  The user-facing signal is percentage-of-allotment; the token/cost numbers behind each
  window stay internal.

**Deferred / back-end (flagged, not scoped now):**
- **Metering & accounting backend.** A per-user usage ledger aggregating token/cost across
  the intelligence surfaces (fed by Ep5 usage events, code executions, etc.), enforcing the
  rolling-window + weekly caps with graceful degradation at the limit.
- **Tier economics (business modeling).** Three subscription tiers, **pricing not locked**
  (candidate ladders floated: $97/$197/$297 and $27/$97/$197). Model the usage each tier can
  profitably include against cost.
- **Admin panel (separate later pass).** Platform-wide usage visibility, platform-wide
  settings adjustment, and bulk operations (e.g. bulk-adding skills). Flagged for the
  roadmap; explicitly a separate admin pass, not scoped here.

**Degradation vs. metering — two systems over one event stream.** These are related but
distinct and must not be conflated:

- **Degradation (context fullness)** — per-thread, real-time, measured on the **main
  orchestration window only** (the conversation model's context: user/assistant messages
  plus whatever tool results and sub-agent findings are fed *back into* it). Sub-agents run
  in **isolated** context windows; only their compact returned output counts toward the main
  window. Keep sub-agent returns synthesized/compact — that is what protects the main
  window. Drives the per-thread "% remaining before degradation" signal and compaction.
- **Metering (cost)** — per-user, cumulative across threads, windowed (5-hour / weekly).
  Sums cost across the **entire tree** of activity: the main orchestration model **plus**
  every sub-agent's full internal usage, every LLM-powered tool call, and utility jobs. A
  sub-agent's internal work is invisible to degradation but fully visible to metering.
- **One tagged usage-event stream feeds both.** Every model call emits a usage event tagged
  with `user`, `thread`, `surface`, `model`, and a `role` marker (`main` / `sub_agent` /
  `utility`). Degradation is computed by filtering to the main-thread context; metering by
  summing all events for the user in the window. Do not build two separate plumbing systems.
- Compaction reclaims main-window context (helps degradation) but does **not** refund cost
  (metering already counted those tokens).

**Account-level % (fork resolved):** deferred to the metering ledger. **Episode 5 ships
per-thread %** (self-contained) and **emits usage events in the ledger-ready tagged shape**
above, so account-level % and the ledger add later without re-plumbing.

### 3.5 Model Routing — Per-Job, Not Per-Thread

Model selection is **backend configuration keyed to the job/capability, never a user-facing
per-thread control.**

- **The conversation/orchestration model is Claude (locked)** in both Virtual CSO and Domain
  Agents — per `CLAUDE.md` ("Claude Sonnet, never swap for OpenAI-compatible"). No per-thread
  model switching, no model dropdown.
- **Per-job routing is legitimate and already exists.** Sub-agents and LLM-powered helpers
  may run on cheaper models per capability; utility jobs (embeddings, metadata extraction,
  title generation, the Ep7 verifier) run on cheaper/specialized models with **no bearing on
  the chat model.** The plumbing is the Ep4 `ai_models` / `platform_ai_settings` registry
  plus the M8 capability `model_setting_key`.
- **"Tool calling" is not a cheap-model job.** The decision to call a tool and the
  interpretation of its result are the orchestration model (Claude); the tool's execution is
  code (often no model at all). Cheap models live *inside* specific LLM-powered tools/
  sub-agents and utility functions — not in the tool-calling loop.
- **The retrieval-router pre-step** (intent classification before Claude is invoked) may use
  a cheap classifier or non-LLM heuristics — distinct from the in-loop tool calling.
- **"Model-agnostic / OpenRouter for the primary model" is not adopted** — it overstates the
  legitimate per-job routing and re-imports reference-series framing that conflicts with the
  locked Claude constraint. Consequence for the usage indicator: because chat is always
  Claude, its context window is known and stable — read it from the model registry as
  hygiene, but this does **not** justify a model-agnostic-chat architecture.

---

## 4. Per-Episode Maps

### Episode 4 — The Artifact-Production Engine

**Reframe.** Not "a skills manager + sandbox." For us it's the **artifact-production
engine**: skills + building-block files + code sandbox together are the machinery that lets
a domain agent turn inputs (e.g. three P&Ls) into a finished deliverable.

**Surfaces.**
- **Domain Agents (primary home).** This is where Episode 4 mostly lands. Skill authoring
  (skill-creator flow), the global vs private split (platform library vs founder-created),
  building-block files (a skill's bundled templates/scripts/brand rules), and the sandbox as
  the artifact renderer.
- **Virtual CSO (consumer + code execution).** Invokes skills in-chat; uses the **shared
  sandbox** to write code that answers an in-depth question or fetches/computes what it
  needs in one execution instead of many turns. Owns **persistent tool memory** (tool
  results survive across turns) — the first step of the persistence arc.
- **OS Engine (light touch).** Not involved in generation, but must provide the storage/
  ownership model for produced artifacts that the opt-in KB writeback will later use.

**Primitive movement.** Skills **born** here. Artifacts **born** here via the
**sub-agents → sandbox → artifact** flow (sub-agents do decomposed work — analyze each
P&L, draft each section — and the sandbox assembles/renders the file). Tools added ad hoc.

**Locked decisions.**
- Skills are **not domain-scoped** (soft tags only).
- The **sandbox is shared** by Domain Agents (code execution + artifact/document
  generation) **and** Virtual CSO (code execution to answer questions / fetch data).
- Artifact creation is **sub-agent-driven and sandbox-executed**, not a single LLM call.

**Build-it-right seams.**
1. Build skill discovery as a **registerable source** so Ep5's registry absorbs it (no
   parallel skills-only catalog to replace).
2. Build the sandbox anticipating the **Ep5 bridge** (code calling platform tools) and the
   **Ep6 persistent workspace** — do not build file output as ephemeral.
3. Keep **skill assets and the knowledge base as two separate resource pools** (both
   accessible to artifact production).
4. Build the skill schema **plugin-packageable** from the start (seed of the plugins area).
5. **Lane decision:** does the skill-creator guided-authoring conversation run through
   Virtual CSO's Claude streaming or a python-backend direct-Anthropic synthesis service
   (per the three-lane rule)? Open.

### Episode 5 — The Capability Layer Becomes Dynamic

**Reframe.** Turns the primitives from a fixed hardcoded set into a **shared, discoverable
capability layer** — the substrate all three surfaces sit on, and the thing that makes the
skills-and-plugins area a real extensible layer.

**Surfaces.**
- **All three (shared substrate).** The unified registry is the capability layer beneath
  every surface; each pulls its relevant subset.
- **Virtual CSO (biggest immediate beneficiary).** Context-window indicator + interleaved
  rich history (continues Ep4 tool memory into reload-durable history); `tool_search`
  (on-demand tool discovery); the **sandbox bridge** (chat code can now call our retrieval/
  query tools — the Ep4 "write code to answer" becomes powerful).
- **Domain Agents.** Skills become searchable registry entries; the bridge lets artifact-
  generation code pull **live platform data** during production; MCP folds external
  services into artifact workflows.
- **OS Engine (lighter).** Its own operations (e.g. a wiki-synthesis tool) become
  registerable/reusable; MCP is where external ingestion sources could later connect.

**Primitive movement.** **Tools** mature to a dynamic registry (THE tools episode). **Skills**
become registry citizens (resolves the Ep4 seam). **Sub-agents** advance indirectly (registry
discovery + bridge). **Artifacts** get supercharged — the bridge lets a single sandbox
execution assemble an artifact from live platform data.

**MCP relevance.** The mechanism for connecting the founder's real business tools
(GHL/Notion/CRM) into the intelligence layer — plugins with real teeth.

**Locked decisions.**
- Registry reconciliation (M8 capability registry vs tool registry): **directional (lean:
  two layers), definitive call deferred** to build-planning.
- MCP: **backend scaffold for MVP/beta, "coming soon" surface, no public connections at
  beta.**

**Build-it-right seams.**
1. Registry must be **surface-aware and context-aware** from day one (Ep6 pulls curated
   per-phase subsets; each surface pulls its own subset) — not a flat global list.
2. The **bridge is the founder-data security boundary** (credentials host-side, sandbox
   sees only results, network limited to the bridge).
3. **Registry/tool results must be citation-ready** (carry source identity + verbatim text)
   so Ep7 doesn't have to retrofit.
4. Skills + skill packs + MCP servers should all be **first-class registry sources** — that
   union *is* the plugins layer.

### Episode 6 — Domain Agents Proper

**Reframe.** The episode that **builds Domain Agents** — and the general-purpose Deep Mode
that lives in **Virtual CSO**. The reference's two harness types are **two control models
over one shared substrate** (workspace, sub-agents, ask-user, plan/progress, trace,
persistence), and they land on **different surfaces**:
- **Soft harness (Deep Mode)** — the LLM drives the flow, open-ended. **Lives in Virtual CSO
  only.** It is **not** in Domain Agents, which is deliberately *not a second Virtual CSO*
  (per the Domain Agents product vision).
- **Hard harness (workflow/task engine)** — a backend state machine drives deterministic
  phases; the LLM executes within them. **This is Domain Agents' execution model.**
  (Directionally also an OS Engine synthesis engine — see below.)
- Domain Agents additionally exposes a **bounded, task-scoped workspace** and the **logged
  free-form ask** (constrained assemble-within-scope) — not open-ended Deep Mode.

**Surfaces.**
- **Domain Agents (home).** The hard-harness workflow/task engine, workspace-as-artifact-
  store, batched sub-agents producing artifact sections, the report as guaranteed
  deliverable. Ep6's gatekeeper + `ask_user` + human-in-the-loop phase **are** our "the agent
  tells you what it needs before it produces" requirement-gathering model.
- **Virtual CSO.** Gets **Deep Mode** — a chat thread can go autonomous/multi-step (plan,
  workspace, sub-agents, ask-user). Hard workflows stay in Domain Agents.
- **OS Engine (directional).** The generic hard-harness engine is a candidate to drive
  wiki-page synthesis and Layer 2 growth. Held as a directional thought to workshop.

**Domain Agents space model (locked).**
- **Discovery/general workspace** — where founders learn what the agents can do; showcases
  the agent library, workflows/playbooks, and producible artifacts (parallel to a skill
  library, but for agents/capabilities).
- **Agent workspace** — the actual working area where an agent runs and produces (fed by the
  per-thread Ep6 workspace).
- **Artifact library** — the persistent output store; completed artifacts live in a
  table/list, each clickable to a rendered view. The opt-in "add to knowledge base"
  writeback to OS Engine attaches at this level.

**Primitive movement.** **Workflows** arrive as first-class (composite but tracked/surfaced
as playbooks). **Sub-agents** industrialized (`task` tool + batched parallel). **Tools**
consumed as curated per-phase subsets. **Artifacts** get a persistent home + become
resumable, guaranteed deliverables. Deep Mode adds orchestration tools (todos, workspace
files, `task`, `ask_user`) distinct from capability tools.

**Build-it-right seams.**
1. Build the harness engine **generic**, not contract-review-specific — one engine for
   Domain Agent artifact workflows and (directionally) OS Engine synthesis. Don't let
   contract specifics leak into the engine.
2. Reconcile the **per-thread workspace with a persistent artifact library** (thread work
   → library graduation → KB writeback).
3. Treat gatekeeper/`ask_user`/human-input as the **general requirement-gathering model**,
   not contract-specific prereq checks.
4. Build phase outputs + sub-agent results **carrying source refs** so Ep7 can ground them.
5. The **registry reconciliation** bites again here (batched sub-agents draw curated tool
   sets) — don't leave it deferred indefinitely.

**Resolved** (see Refinement 2 / L17). The harness does **not** do wiki synthesis — artifact
promotion triggers an OS Engine ingestion workflow (→ vector asset + wiki page); OS Engine
synthesizes as sole writer. Ep6 builds the trigger/hand-off.

#### Episode 6 Refinement — Domain Agents vision reconciliation (2026-07-02)

Grounded in `../ArchitectOS Beta Launch/DomainAgents_Product_Vision.md` and
`DomainAgents_Wireframe_Spec.md`. The reference "harness" machinery must be built to the
already-designed Domain Agents object model and surfaces — not in reference nomenclature.

**Terminology Rosetta stone (build to the right column):**

| Reference (Ep6 PRD) | ArchitectOS Domain Agents |
|---|---|
| domain harness (definition) | **Workflow** (ordered chain of Skills, targets a Template) |
| harness run | **Task** (one run of a Workflow; `Workflow 1→N Tasks`) |
| phase | **Skill** (atomic operation) or a programmatic step within the chain |
| output_schema + `post_execute` DOCX | **Template** (internal output contract; founders never see it) |
| gatekeeper LLM | prereq check — agent reads OS Engine first, prompts for uploads if missing |
| human-in-the-loop / `ask_user` | clarifying questions → **Blocked / "waiting on you"** |
| post-harness response | completion narration → **Review** state → Download / Add to Second Brain |
| plan panel + phase SSE events | **Kanban state** + Workspace progress indicator + thread narration |
| workspace virtual filesystem | task resources + the right-pane **artifact render panel** → Artifacts library |
| batched parallel sub-agents | internal skill execution (invisible to founder except via progress) |

**Object model & lineage:** Agent → Workflow → Task → Artifact, tracked end to end (this
lineage is also the Ep7 provenance backbone). Skills and Templates are **internal** — never
shown to founders; founders see only Workflows and Artifacts.

**Surface mapping (Ep6 backend must feed these already-speced surfaces):**
- **Agent Gallery** (5 fixed agents + recent-tasks strip) — section landing.
- **Agent Profile** — Capabilities (Analyze/Create/Plan), thought-starters, **Workflows
  shelf** (launch → creates a Task, opens the Workspace), free-form ask. No execution here.
- **Agent Workspace** — two-pane: task-bound conversation thread (reuses VCSO chat
  components) + live **artifact render panel**; task meta bar; progress indicator; completion
  actions. Entry points: workflow launch, Kanban card, or VCSO `@Agent` invocation — all
  resolve to the same task.
- **Tasks (Kanban)** — Ready → Running → Blocked → Review → Done; transitions driven by task
  events (the harness state machine). "Blocked" is the same event as an ask-user/resource
  prompt.
- **Artifacts Library** — vault with preview/download/delete, second-brain promotion, and a
  provenance link back to task→workflow→agent.
- **AI Usage** is a **global Settings page** (covers OS Engine + VCSO + Domain Agents), not a
  Domain Agents tab — Domain Agents links out to it. (Consistent with §3.4.)

**Cross-surface:** OS Engine read (agent checks context first) + write (second-brain
promotion, deliberate/opt-in); VCSO can invoke an agent (`@FinancialAgent …`) which spawns a
Task in the *same* plumbing and appears in the same Kanban + Artifacts library.

**First anchor workflow (LOCKED):** **Monthly P&L Assessment (Financial)** — the vision's own
happy-path example. Build the engine **generic** and prove it with this workflow; **do not
port the reference's Contract Review harness.**

**Deep Mode surface note:** the reference's editable todo/plan panel is a **Virtual CSO Deep
Mode** construct. In Domain Agents the "plan" is the Workflow's fixed phases shown via the
progress indicator + Kanban + narration — no editable todo panel.

#### Episode 6 Refinement 2 — Planning-pass alignments (2026-07-02)

Adjustments from the Ep6 planning agent's first pass (backend audit + working model):

- **Free-form ask latitude (L16).** Predefined workflows are starting points / playbooks, not
  a cage. For a request outside a defined recipe, the agent reasons in context, uses the
  skills/tools it has access to, incorporates founder feedback, and assembles a scoped
  artifact — **including consulting other domain agents.** Bounded by *mode* (artifact-bound,
  not open-ended strategy chat — L14) and by *capability surface* (its registered skills/tools
  + peer agents; no arbitrary new-skill authoring mid-task, no out-of-registry reach). Every
  ask logs to request-capture.
- **Artifact promotion → OS Engine feeder (L17).** Promoting/flagging an artifact for
  ingestion **triggers an OS Engine workflow** that runs it down the pipeline to produce a
  **vectorized asset (Tier 2)** and a **wiki page (Tier 1/2 where sensible)**. OS Engine does
  the synthesis (sole writer, architecture §5); the domain agent only initiates. Ep6 builds
  the **trigger/hand-off**; full OS Engine wiki generation is OS Engine's concern.
- **Verification debt is not a gate (L18).** Ep6 scaffolds first; the Ep5 sandbox/loop
  verification (egress policy, live smokes, Python-stream flip) folds into the later
  consolidated smoke/credentials phase (§8), not a blocking P0. Kept flagged and monitored.
- **Anchor workflow = generic POC (L19).** Monthly P&L Assessment is built to prove the engine
  and wiring end to end; the analytical content is refined with real IP later — not the final
  live recipe.
- **Rule #4 scoping (L20).** Domain Agent artifacts use the Ep4 sandbox export path
  (markdown→HTML/file via `ArtifactService`). `CLAUDE.md` Rule #4 (N8N + Google-Docs merge)
  governs the **fixed platform reports** (MRA, AE Ladder, Sprint Launch Doc) only.
- **Owner-flexible substrate (L21).** The shared substrate (workspace, ask-user, sub-agent
  delegation, curated trace) is built keyed to `task_id` **or** `thread_id`, so VCSO Deep Mode
  reuses it rather than reimplementing a thread-scoped copy.

Audit confirmations: D1 is already implemented as two layers bridged by scope sources
(`AgentCapabilityScopeSource` + `RegistryNativeScopeSource` in `tool_registry.py`); the new
`domain_agents` table name avoids collision with the M8 `agent_capabilities` registry.

### Episode 7 — Traceability & Trust (the Capstone)

**Reframe.** The episode that makes the **whole intelligence layer trustworthy** —
operationalizing the codified "everything is traceable, no hallucination" constraint. Not a
surface; a cross-cutting trust layer over all three surfaces and the whole knowledge layer.
It's also the mechanism that makes the **wiki's per-claim provenance** real.

**Surfaces.**
- **Virtual CSO (primary user-facing home).** Inline citation chips, source-preview sidecar,
  jump-to-evidence, Check Citations. Every claim clickable to exact source.
- **OS Engine (producer + consumer).** Part 1 (layout extraction, bounding boxes, OCR
  preflight, verbatim citable text) is OS Engine's ingestion pipeline. And wiki provenance
  is realized here — synthesized wiki claims trace back to their Tier 3 docs / Tier 0
  records.
- **Domain Agents.** Artifacts become **auditable** — every figure/claim in an analysis
  traces to its source; the artifact library's rendered views display citations.

**Primitive movement.** **Tools** gain a citation contract. **Sub-agents** carry provenance
(the M8 citations field becomes real). **Skills** are citable by construction. **Artifacts**
reach their endpoint: auditable, source-grounded. **Workflows** produce grounded deliverables
end-to-end.

**Knowledge-layer connection.** Ep7 completes traceability across all four tiers. The
citation-resolution path (chip → sidecar → exact location) **is** the Tier 3 verification
path from the tier model — how a wiki claim gets checked against its source.

**Locked decisions.**
- Citations resolve to **all four tiers**: Tier 0 platform records, Tier 1 wiki pages,
  Tier 2/3 documents, and web results — not just documents + web.
- **One provenance mechanism** for chat and wiki (Ep7 evidence-marking behind the wiki's
  per-claim provenance) — **preferred if the architecture supports it cleanly; not forced**
  if it turns out to be a poor fit.
- **No backfill required** (no users / no existing KB data). **Sequencing dependency:**
  Ep7's ingestion-side work should be in place before founders upload at scale, so every
  document is citation-capable from day one and no backfill ever arises.

**Build-it-right seams.**
1. Extend the citation **source taxonomy to all four tiers** — the biggest ArchitectOS
   extension of the reference Ep7.
2. Build citation machinery so **wiki synthesis reuses it** for per-claim provenance (one
   system, if architecture allows).
3. **Artifacts carry citation metadata into the library** so rendered views show them.
4. Verbatim text + geometry are forward-only — honor the sequencing dependency above.

#### Episode 7 Refinement — Wiki reality + citation currency (2026-07-05)

Grounded in a scoping-level audit of the wiki layers (`.planning/wiki-system/` Tier 1,
`.planning/document-wiki/` Tier 2) and the source-ref shapes already flowing through the
platform.

**Wiki-layer reality.** Both layers are **built in isolation and citation-ready by design**,
so Ep7 is less "build citation from scratch" than "unify + render + verify + add geometry
where needed."
- Tier 1 (wiki-system): build-complete in isolation (2026-06-30, contract `wiki-1.0`); a
  **claims-with-evidence** model — every claim carries line-level evidence
  (`path/lines/weight/note`) + a trust class; insight layer with founder-confirmed promotion.
- Tier 2 (document-wiki): complete in isolation (07 acceptance); pages carry `source_file_ids[]`
  provenance + machine-parseable inline citations `[[Source: raw_document:{id}#chunk:{id}|…]]`;
  read tools return `agent_result_v1` with first-class `AgentSourceRef[]`.
- **Gap:** the cross-tier **connection phase** (retrieval router + wiring the wiki into the
  surfaces) is a separate, partly-built workstream (KB Explorer Phases 8–9 did the Layer-1
  mirror + a basic VCSO router; full cross-tier assembly is the frontier).

**Fork resolutions (L22–L25):**
- **Fork A — one citation currency (L22).** Unify on the existing `AgentSourceRef` /
  `agent_result_v1` shape (already emitted by the wiki read tools, the Ep5 registry
  `ToolSourceRef`, and Ep6 `source_refs`). Normalize Tier 2 inline `[[Source:]]` and Tier 1
  claim-evidence into it. The reference's marker/streaming/rendering UX is adopted **on top**
  of this currency — not as a parallel per-message citations store.
- **Fork B — source-kind readiness (L23).** Tier 0 record: deterministic typed resolver
  (table/row/field → rendered record), no geometry, simplest. Wiki page: citation shape
  exists, resolves to a page, no geometry. Document chunk: source-ref exists; **bounding-box +
  verbatim-face geometry is net-new** (reference Part 1). Web: snapshot per reference. The
  citation layer is **tier-complete by construction** — any source that reaches an answer is
  citable.
- **Fork C — consume the connection phase, don't build it (L24).** Ep7 builds the citation
  currency + resolvers/renderers + verification and **consumes** whatever the connection phase
  / Phases 8–9 already expose; it does **not** build the cross-tier retrieval router and does
  **not** block on it. Wiki-page citations light up as the connection phase surfaces those
  sources.
- **Phasing (L25).** **Ep7A** — unify the currency + rendering + Check-Citations verification
  + non-geometry resolvers (chunk / wiki page / Tier 0 record / web snippet); high reuse,
  delivers auditable answers across tiers early. **Ep7B** — Tier 3 ingestion geometry (layout,
  bounding boxes, verbatim source face) for pixel-precise PDF highlighting; the heavier
  net-new build, a follow-on, not a blocker.

---

## 5. Locked Decisions (Consolidated)

| # | Decision |
|---|---|
| L1 | Five first-class primitives: tools, sub-agents, skills, artifacts, workflows. |
| L2 | Skills are not domain-scoped; domain association is a soft tag, not a boundary. |
| L3 | The code sandbox is shared by Domain Agents (execution + artifact generation) and Virtual CSO (execution to answer/fetch). |
| L4 | Artifact creation is sub-agent-driven and sandbox-executed (skills orchestrate sub-agents → sandbox → artifact). |
| L5 | Workflows are first-class playbooks living in the Domain Agents space; composite but tracked/surfaced as first-class. |
| L6 | Domain Agents has three spaces: discovery/general workspace, agent workspace, and artifact library (KB writeback attaches at the library). |
| L7 | MCP: backend scaffold for MVP/beta, "coming soon" surface, no public external connections at beta launch. |
| L8 | Citations resolve to all four tiers (Tier 0 records, Tier 1 wiki, Tier 2/3 docs, web). |
| L9 | One provenance mechanism for chat + wiki, preferred but not forced. |
| L10 | No citation backfill needed; instead a sequencing dependency (Ep7 ingestion before scale uploads). |
| L11 | "Show the thinking" = curated trace summaries (steps, tools, sub-agent progress, evidence), never raw chain-of-thought. |
| L12 | Model routing is per-job, not per-thread: the conversation/orchestration model is Claude (locked, no per-thread switching); sub-agents/utility jobs route to cheaper models via the model registry; "model-agnostic/OpenRouter for the primary model" is not adopted. |
| L13 | Degradation (main-window context fullness, per-thread) and metering (total cost across the whole activity tree, per-user/windowed) are two systems computed from one tagged usage-event stream. Ep5 ships per-thread %; account-level % is deferred to the metering ledger. |
| L14 | Open-ended Deep Mode (soft harness) lives in **Virtual CSO only**. Domain Agents is not a second CSO: it runs the hard-harness workflow/task engine plus a bounded, task-scoped workspace and the logged free-form ask. The two harness control models share one substrate but land on different surfaces. |
| L15 | The first anchor workflow (the proof for the workflow/task engine) is **Monthly P&L Assessment (Financial)**. The engine is built generic; the reference's Contract Review harness is not ported. |
| L16 | Free-form ask latitude: agents may improvise beyond predefined workflows within their registered capability surface (recombine own skills/tools, consult peer agents), artifact-bound, logged to request-capture. Bounded by mode (not open-ended chat — L14) and capability surface (no arbitrary new-skill authoring, no out-of-registry reach). |
| L17 | Artifact promotion triggers an OS Engine ingestion workflow producing a vectorized asset (Tier 2) + a wiki page (Tier 1/2 where sensible); OS Engine synthesizes (sole writer). Ep6 builds only the trigger/hand-off, not the wiki generation. |
| L18 | Ep5 verification debt does not gate Ep6. Scaffold first; sandbox/loop verification folds into the later consolidated smoke/credentials phase (§8). Kept flagged and monitored. |
| L19 | The Monthly P&L Assessment anchor is a generic proof-of-concept (prove engine + wiring end to end); analytical content is refined with real IP later, not the final recipe. |
| L20 | Domain Agent artifacts use the Ep4 sandbox export path. CLAUDE.md Rule #4 (N8N + Google-Docs merge) governs the fixed platform reports (MRA, AE Ladder, Sprint Launch Doc) only. |
| L21 | The shared Ep6 substrate (workspace, ask-user, sub-agent delegation, curated trace) is built owner-flexible (`task_id` or `thread_id`) so VCSO Deep Mode reuses it rather than reimplementing. |
| L22 | Ep7 unifies on the existing `AgentSourceRef`/`agent_result_v1` citation currency (normalizing Tier 2 inline `[[Source:]]`, Tier 1 claim-evidence, Ep5 `ToolSourceRef`, Ep6 `source_refs` into it). The reference's evidence-marker/streaming/rendering UX is layered on top — not a parallel per-message citations store. |
| L23 | Ep7 source-kind readiness: Tier 0 record (deterministic typed resolver, no geometry) · wiki page (existing citation shape, resolves to page, no geometry) · document chunk (source-ref exists; bounding-box + verbatim geometry is net-new) · web (snapshot). Citation layer is tier-complete by construction. |
| L24 | Ep7 does not build the cross-tier retrieval router (the "connection phase," a separate workstream) and does not block on it — it consumes what the connection phase / KB Explorer Phases 8–9 expose. Wiki-page citations surface as those sources become available. |
| L25 | Ep7 is phased: Ep7A (unify citation currency + rendering + Check-Citations + non-geometry resolvers for chunk/wiki/record/web — high reuse, auditable answers across tiers early); Ep7B (Tier 3 ingestion geometry — layout, bounding boxes, verbatim source face — for pixel-precise PDF highlighting, a follow-on not a blocker). |
| L26 | Citation chips are reserved for genuine evidence sources; derived/operational source-kinds render in the curated trace only, never as chips (Ep7 O1). Full Ep7 build-decision ledger lives in `.planning/citations/CONTEXT.md`. |

## 6. Directional / Deferred Decisions

| # | Item | Current lean | Resolve at |
|---|---|---|---|
| D1 | M8 capability registry vs Ep5 tool registry — one layer or two | Two distinct layers (confirmed in code: scope-source bridge) | Ep5 build-planning |
| D2 | Harness engine doubling as OS Engine synthesis engine | **Resolved → L17** (promotion feeder triggers OS Engine ingestion; OS Engine synthesizes) | — |
| D3 | Skill-creator authoring lane (Virtual CSO stream vs python-backend synthesis) | Open | Ep4 build-planning |
| D4 | Per-thread workspace ↔ persistent artifact library relationship | Both exist; graduation model TBD | Ep6 build-planning |

## 7. How This Feeds Forward

Each episode section is written to seed a dedicated GSD episode PRD/strategy pass. When we
open the GSD flow for an episode, we carry in: the reframe, the surface map, the primitive
movements, the build-it-right seams, and the relevant locked/deferred decisions — so the
PRD is built fit-for-purpose and future-proofed rather than reverse-engineered from the
reference series.

---

## 8. Post-Episode Roadmap — Cross-Cutting Workstreams

Flagged here so they aren't buried across the episode work. These come **after** the Ep1–7
backend build and **before** any usability go-live.

### 8.1 Front-End / UX Design Audit & Real-Wiring Pass (post-Ep7)

Episodes 1–7 have — correctly — been backend code, wiring, and scaffolding. The front-end is
still, for the most part, **hardcoded with mock data / mock design** and does not yet exercise
the real backend. That gap has to be closed before the platform is usable.

After Episode 7, run a **full audit of the front-end against everything implemented across
Ep1–7 on the backend.** For every feature and functional area:

- confirm it is actually **surfaced, leveraged, and usable** in the UI, with correct UX/UI;
- **replace mock data / mock design with real wiring** to the backend capability;
- ensure **no capability ships stranded on the backend** — every backend feature is
  intentionally pulled forward into the front-end.

Honor the design system (`DESIGN-GUIDE-QUICK.md` / the ArchitectOS Design System) and the
Phase 5B visual-alignment rules during this pass.

### 8.2 Sequencing Gate

Order of operations before go-live:

1. Ep1–7 backend build (in progress).
2. Per-episode **live verification debt** cleared (e.g. Ep5's egress NetworkPolicy + live
   end-to-end smokes with real credentials).
3. **Front-end / UX audit + real-wiring pass** (§8.1).
4. **Consolidated cross-episode smoke test** — every episode's features exercised together.
5. Flip usability / go-live.

Consolidated smoke testing across every episode and flipping the usability switch happen
**only after** the front-end audit and real wiring are complete — not before.
