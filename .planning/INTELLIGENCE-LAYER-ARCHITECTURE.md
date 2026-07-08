# ArchitectOS Intelligence Layer — Canonical Architecture

> Authored: 2026-07-02
> Status: **Canonical — source of truth for what the intelligence layer is and how its parts relate.**
> Supersedes: `INTELLIGENCE-VISION.md` as the scope reference for the three platform areas
> and the knowledge layer. The vision doc remains useful for the *rationale* behind the
> retrieval architecture, but where the two conflict, **this document wins.**
>
> Read this before scoping any episode, phase, or feature that touches the intelligence layer.

---

## 1. Purpose & How to Use This Document

This document codifies, in plain English, what the ArchitectOS intelligence layer is
designed to be — the knowledge layer that sits beneath everything, and the three platform
areas (OS Engine, Virtual CSO, Domain Agents) that consume it.

It exists so that future contributors and agents stop treating `INTELLIGENCE-VISION.md`
as the source of truth and stop guessing at boundaries. It answers three questions:

1. **What does the system know, and in what forms?** (The knowledge layer — Tiers 0–3.)
2. **What are the three platform areas, and what is each one *for*?** (The surfaces.)
3. **Who is allowed to write to the knowledge base, and how does everything else feed it?**
   (The write-ownership and feeder model — the single most load-bearing rule here.)

**Scope boundary — read this.** This document describes *intended design*, not current
build state. It does not claim any component is or isn't built. Where it says the system
"does" something, read that as "is designed to do." Reconciling this design against what
is actually stood up today is a separate, later exercise. Do not infer build status from
this document.

---

## 2. The Mental Model in One Page

The intelligence layer is **one shared knowledge substrate with three surfaces on top of it.**

- The **substrate** is the knowledge layer: four tiers (Tier 0–3) that hold what the
  platform knows about a founder's business, ranging from exact structured records up
  through synthesized understanding, semantic search, and raw source documents.

- The **three surfaces** each act on that substrate with a different primary verb:
  - **OS Engine — the owner.** Ingests, synthesizes, organizes, and *writes* the knowledge
    base. The only surface that creates or evolves wiki pages and memory.
  - **Virtual CSO — the interaction layer.** Where the founder *converses with* everything
    the platform knows. Reads across the tiers, reasons, brainstorms, and responds.
  - **Domain Agents — the production layer.** Where the founder *produces artifacts* —
    analyses, memos, briefs, retrospectives — through domain-specific, iterative work.

- **Skills and plugins** are a cross-cutting capability layer available inside all three.

The single rule that holds the whole thing together: **OS Engine owns all writes to the
knowledge base. Virtual CSO and Domain Agents never write to it directly — they feed it.**
Every other surface and every other platform area contributes *inputs*; OS Engine decides
how those inputs become knowledge.

---

## 3. The Knowledge Layer (Tiers 0–3)

The four tiers are not four parallel silos you pick between. They are a **progressive
escalation of depth** — an interaction climbs only as far as the moment requires:

> **Tier 0 → Tier 1 → Tier 2 → Tier 3**
> platform records → synthesized understanding → semantic search → raw source
>
> A question starts with the exact records, rises to the reasoned synthesis, drops into
> semantic search when it needs more connective tissue or evidence, and reaches the raw
> documents only when it needs to verify or deep-read the actual source.

### Tier 0 — Structured Platform Data

The Supabase tables and stored platform records: MRA checkpoint results and stage
assessments, AE Ladder scores, sprint goals/initiatives/milestones and status, Quarter
Map priorities, Clarity Compass answers, Reflection Review data.

- **Nature:** Exact, deterministic, ground-truth records written by the platform itself.
- **Answers:** "What is my current ladder position?" "What initiatives are in flight?"
- **Cannot answer:** Anything requiring synthesis or reasoning across records or time.

### Tier 1 — The Compiled Wiki (Synthesized Business Knowledge)

The platform's *reasoned understanding* of the founder's business — not raw data and not
raw documents, but compiled, synthesized knowledge. This is the platform's growing memory
of the founder. **The wiki has two layers that do genuinely different jobs.**

**Layer 1 — the fixed scaffold.** A set of predetermined directional business-orientation
pages that *every* founder gets, with the same structure. This is the semantic skeleton —
a known frame the platform always holds. Representative pages:
`business-context`, `diagnostic-synthesis`, `current-quarter`, `financial-picture`,
`positioning-and-offer`, `client-landscape`.

**Layer 2 — the emergent, compounding layer.** Founder-specific pages that grow out of
everything the founder feeds the platform: uploaded P&Ls, client documents, meeting
transcripts, SOPs — plus chat history, sprints, capability areas, and retrospectives.
These pages are created *incrementally* and *interlinked*, so the platform's understanding
broadens and connects over time. **This is the actual memory-and-growth mechanism** — how
the platform's knowledge of a specific business deepens the longer the founder uses it.

- **Relationship to Tier 0:** Deliberate, not redundant. The same MRA result exists as a
  row in Tier 0 *and* as reasoned prose in a Tier 1 page. Tier 0 is the record; Tier 1 is
  the synthesized reading of the record. When they conflict, **Tier 0 (the source) wins.**
- **Nature:** Intentionally lossy relative to ground truth — a synthesis, available
  instantly and without query-time reasoning cost. Every page carries source provenance.

### Tier 2 — Semantic / Vector Search

The pgvector layer. **Vectorized versions of both the uploaded documents and the wiki
pages**, searchable via hybrid search (BM25 + vector similarity) with optional reranking.

- **Answers:** "Find everything we have about retainer structures." Locating relevant
  passages when the exact location isn't known.
- **Key point:** Because both raw-document chunks *and* wiki pages are vectorized, a surface
  can retrieve either a synthesized page or a raw passage depending on what the question
  needs — the escalation between Tier 1 and Tier 2 is fluid, not a hard boundary.

### Tier 3 — Raw Document Explorer (Ground Truth)

The full raw documents themselves, navigable and readable (the ls / tree / grep / glob /
read tool family). Highest fidelity, highest cost.

- **When used:** Deep-reading a specific document, or verifying a claim that surfaced from
  Tier 1 or Tier 2 against the original source. This is the citation-resolution path.
- **Relationship to the wiki:** Tier 3 is the wiki's source material. Any Tier 1 claim can
  be traced back and verified here.

---

## 4. The Three Platform Areas

All three consume the *same* knowledge layer. Their difference is what they primarily do
with it.

### OS Engine — The Owner (Build & Write Surface)

OS Engine is the **ingestion layer and the wiki system's home.** It is where the knowledge
base is built, maintained, and made visible. It is the only surface that writes to it.

**What it does:**
- **Bulk ingestion.** Where founders upload files at scale — P&Ls, financial documents,
  client meeting transcripts, SOPs, anything they want the platform to understand.
- **Customizable folder structure.** Founders create and maintain their own organization
  for the raw documents they've uploaded.
- **The ingestion pipeline.** On upload, OS Engine: keeps a manifest/log of everything in
  the knowledge base; stores raw files in Supabase storage keyed by user ID; vectorizes
  them into the retrievable RAG system (Tier 2/3); and generates/updates wiki pages
  (Tier 1) from both the documents and platform interactions.
- **The wiki visualization & interaction layer.** Where founders *see and interact with*
  what the platform knows about them — the window into the knowledge base.

**Relationship to the tiers:** OS Engine is the write path for Tiers 1, 2, and 3.
Everything it builds is consumable by Virtual CSO and Domain Agents.

### Virtual CSO — The Interaction Layer (Read Surface)

Virtual CSO is the **conversational surface over everything the platform knows** — the
founder's business, goals, current capabilities, active sprints, and accumulated knowledge.

**What it does:**
- Chat with the platform's knowledge base and content; make requests; brainstorm.
- Reason across the tiers via the retrieval router (which lives in the Virtual CSO
  streaming endpoint), pulling the right tier(s) for a given question.
- Support one-off, in-chat file uploads for convenience (bulk upload lives in OS Engine).
- Spin up sub-agents and invoke tools and skills mid-thread as the conversation requires.

**What it does NOT do:** Write to the knowledge base directly. (See Section 5.)

### Domain Agents — The Production Layer (Produce Surface)

Domain Agents are the **domain-specific, execution-oriented layer where artifacts get made
and where skills and workflows live.** Organized around the five framework domains
(e.g., financial, operations, and the rest of the framework's domain areas).

**What it does:**
- Produces artifacts — financial analyses, strategy briefs, memos, sprint retrospectives,
  and more — grounded in what the platform knows about the business.
- Works **iteratively, not one-click.** An agent tells the founder what it still needs —
  more context, clarification, or another document — before it can complete an artifact.
  (Example: upload three monthly P&Ls, and the financial agent produces a financial
  analysis, asking for whatever else it needs along the way.)
- Hosts the growing library of skills and workflows — both the global library and
  founder-created skills. This is the primary **authoring** home for skills.
- Stores produced artifacts in the domain workspace for later review.

**What it does NOT do:** Write to the knowledge base directly. Artifacts enter the
knowledge base only by founder opt-in. (See Section 5.)

---

## 5. Write Ownership & The Feeder Model

**This is the most load-bearing rule in the architecture. OS Engine owns and manages the
knowledge base and the wiki. It is the only surface that creates or evolves pages and
memory. Every other surface and platform area is a *feeder* — it contributes inputs, and
OS Engine decides how those inputs become knowledge.**

This centralization is deliberate. It means there is exactly one path that mutates the
wiki, no matter how many surfaces are added later.

### How each source feeds OS Engine

**Virtual CSO → feeds via synthesis.** Conversations (and anything created in a thread)
are turned into a synthesis record. That record is handed to OS Engine through a workflow.
OS Engine then creates or enhances the relevant wiki pages and evolves memory off the back
of the conversation. The chat *causes* a page to change; OS Engine *makes* the change.

**Domain Agents → feed via opt-in.** Artifacts do not auto-enter the knowledge base. Each
artifact in the domain workspace carries an "add to knowledge base" action, so the founder
chooses what's worth recording versus what's just brainstorming or a disposable one-off.
Whatever the founder promotes is acknowledged by OS Engine through a workflow, and OS
Engine updates or creates the wiki elements from it. **Founder agency over what becomes
institutional memory is a deliberate feature.**

**The rest of the platform → feeds via pings.** Foundations work, assessments, sprint
plans, retrospectives, and other platform interactions are flagged and pinged to OS Engine
to log, synthesize, and organize.

### The flow, in one picture

```
   Virtual CSO ─┐  (conversation → synthesis record → workflow)
                │
  Domain Agents ─┤  (artifact → founder opt-in "add to KB" → workflow)
                │                                                     ┌─────────────┐
  Platform areas ┤ (assessments, sprints, foundations → ping)  ─────▶ │  OS ENGINE  │
  (Foundations,  │                                                    │  (sole      │
   Diagnostics,  │                                                    │   writer)   │
   Pro Suite…)   │                                                    └──────┬──────┘
                │                                                            │ writes / evolves
  Raw uploads ──┘  (bulk upload → ingestion pipeline)                        ▼
                                                          ┌──────────────────────────────┐
                                                          │  KNOWLEDGE LAYER (Tiers 1–3)  │
                                                          │  wiki pages · vectors · raw   │
                                                          └──────────────┬────────────────┘
                                                                         │ read by
                                        ┌────────────────────────────────┼───────────────────┐
                                        ▼                                ▼                    ▼
                                   Virtual CSO                     Domain Agents          OS Engine
                                   (converse)                       (produce)          (visualize/interact)
```

Read → produce → feed back → OS Engine synthesizes → knowledge compounds. The loop is what
makes the platform's understanding of a business grow over time rather than reset.

---

## 6. Skills & Plugins — Cross-Cutting Capability Layer

Skills and plugins are a capability layer, not a place. They are available across all
three surfaces:

- **In Virtual CSO:** skills are invocable inside conversations; threads can spin up
  sub-agents and use tools as the conversation demands.
- **In Domain Agents:** the primary **authoring** home — founders create their own skills
  and use the global skill library to drive artifact production and workflows.
- **In OS Engine:** available to ingestion and synthesis work as needed.

All three surfaces can spin up sub-agents and access tools to execute what they need.
Domain Agents is where skills are primarily *created*; the other surfaces primarily
*consume* them.

---

## 7. Design Principles & Constraints to Honor

1. **One writer.** OS Engine owns all writes to the knowledge base. No other surface
   mutates the wiki directly. New surfaces feed OS Engine; they do not get write access.

2. **Shift work from query time to build time.** Wherever possible, reasoning happens at
   ingestion/synthesis time (producing wiki pages) rather than at query time. Evaluate
   every new feature against this: does it move work to build time, or pile more onto
   query time?

3. **The wiki is a synthesis, not a replacement.** Raw documents and structured records
   remain authoritative. When the wiki and its source conflict, the source wins.

4. **Everything is traceable.** Every surfaced insight should be attributable to a source —
   a Tier 0 record, a document, or a wiki page that cites a document. Hallucination is not
   acceptable in a platform founders use for financial and strategic decisions.

5. **The framework is the organizing skeleton.** The AE Ladder, MRA, sprint system, and
   Quarter Map are not just UI — they are the semantic structure the wiki, routing, and
   agents all organize around. Align to the framework; don't work around it.

6. **The founder controls institutional memory.** What becomes permanent knowledge —
   especially from Domain Agent artifacts — is the founder's opt-in decision, not automatic.

7. **Build for all three consumers.** Any episode or feature that builds a piece of the
   substrate (Tiers 1–3) must be built to serve all three surfaces, not just the one the
   episode happens to be about. This is the primary defense against the build-then-rebuild
   churn.

---

## 8. What This Document Deliberately Does Not Cover

- **Build state.** Whether any of the above is implemented, partially implemented, or not
  yet started. That reconciliation is a separate exercise.
- **Episode mapping.** How the reference series' episodes map onto building these tiers and
  surfaces. That is the roadmap work this document is the foundation for.
- **Implementation detail.** Table schemas, workflow node configs, endpoint contracts,
  and UI specs live in their own specs (e.g., the `ProSuite_WF-PS-*`, `OSEngine_Build_Spec`,
  and `DomainAgents_Product_Vision` documents). This document is the frame they fit into.
