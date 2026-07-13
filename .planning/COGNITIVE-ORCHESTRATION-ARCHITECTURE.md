# ArchitectOS — Cognitive Orchestration Architecture

> Authored: 2026-07-13
> Status: **North-star design — the target shape for how the platform *thinks* over its knowledge.**
> Nests under: `INTELLIGENCE-LAYER-ARCHITECTURE.md` (canonical). That document defines *what the
> system knows* (Tiers 0–3) and *the three surfaces* (OS Engine, Virtual CSO, Domain Agents) and the
> one-writer rule. **This document inherits all of that unchanged** and adds one thing: *how the
> thinking works over that substrate* — the orchestration/harness layer that turns retrieval into a
> genuine strategic thought partner.
>
> **Scope boundary.** This describes *intended design*, not current build state. Where it says the
> system "does" something, read "is designed to do." Reconciling this against what is actually stood
> up today is the next, separate exercise (the reconciliation pass), which measures the live build
> against this document. Do not infer build status from this doc.
>
> **Relationship to prior scopes.** Ep1 M8 (sub-agent orchestration), Ep4 (skills + code sandbox),
> Ep5 (advanced tool calling), MA-05 (VCSO agentic transparency), and MA-06 (tool registry + governed
> model routing) each built a piece of the foundation this document assembles into a whole. Those
> episode docs were deliberately conservative, sequential stepping stones; their bounds protected
> *sequencing*, not the end state. This document consciously grows beyond several of those bounds
> (Section 8), within the original intent, now that the pieces exist and are being pressure-tested
> against the ultimate vision.

---

## 1. Premise — A Thought Partner, Not a Chatbot

The Virtual CSO is not a document-answering bot. It is a strategic thought partner that a founder
consults the way they would a real CFO or CSO. The questions that matter are not "what does this
document say" — they are "my top-three client concentration is climbing while margin compresses,
what do I do," "how do these two metrics connect," "here's an idea, help me think it through." Many
turns are not even questions; they are the founder posing something to reason about together.

That premise sets the whole architecture, because it means the system's primary work is **synthesis
with judgment across domains and time**, not retrieval. Three constraints govern every design choice,
and they are co-equal — none may be sacrificed for another:

- **Cost.** Model spend is a first-order constraint. The expensive judgment model must operate on
  compact, pre-chewed inputs, never on raw document dumps re-processed turn after turn.
- **Quality.** The reasoning layer is the crown jewel and cannot be cheapened. Every surfaced insight
  must be traceable to a source (Tier 0 record, document, or cited wiki page). Hallucinated strategy
  is unacceptable in a tool founders use for financial and strategic decisions.
- **User experience.** It must *feel* like a partner: it understands the depth of what's being asked,
  shows its thinking legibly, knows when it doesn't have enough to answer well, and moves the
  conversation forward rather than just returning text.

The core cost identity to keep in mind throughout: **cost ≈ (price of the model) × (size of the
context it holds) × (number of passes it makes).** Native tool execution touches none of these. All
cost control in this architecture comes from keeping the *inputs* to strong reasoning small and
pre-synthesized — never from degrading the reasoning itself.

---

## 2. The Turn Lifecycle — Deterministic Phases, Model-Driven Contents

A turn moves through a fixed sequence of phases. The **phase structure is deterministic**; what
happens *inside* each phase is model-driven. This gives us predictability and guardrails without
making the system rigid.

```
   INTENT ───▶ PLAN ───▶ GATHER ───▶ COMPOSE ─or─ REFLECT-&-STEER
   (read)     (decompose) (delegate)  (judge)      (surface gap, ask)
     │            │           │           │              │
     └──────── working-state memory threads through all phases ───────┘
```

**Phase 1 — Intent & depth read.** The first act of every turn is *not* retrieval. It is reading
what kind of move the founder is making and how deep it goes: a factual lookup, a strategic
"what-do-I-do," a brainstorm where the job is to advance the thinking (no explicit answer expected),
a request to produce an artifact, or an ambient statement. This read sets the turn's **response
contract** and picks which terminal mode the turn is heading toward. It is deliberately cheap — it
runs on the compact working state and the latest message, not on assembled context — and it is what
separates a thought partner from a chatbot. It is also the adaptive triage that keeps simple turns
simple: a lookup does not get decomposed into a plan.

**Phase 2 — Plan / decompose.** For anything beyond a direct lookup, the orchestrator decomposes the
ask into sub-questions and decides which source or worker answers each. "Concentration up, margin
down, what do I do" becomes: get the concentration trend, get the margin trend, pull the
positioning/pricing context, then reason about what they jointly imply. The plan is explicit and
budget-bounded (see Section 7). It may be revised mid-turn once workers report what is actually
available.

**Phase 3 — Gather / delegate.** Each sub-question routes to the cheapest sufficient source or a
bounded worker (Section 4), escalating tiers only as far as the moment requires (Section 5). Workers
absorb the token-heavy material and return **compact, cited, structured** findings. Gathering can be
parallel where sub-questions are independent.

**Phase 4 — Compose *or* reflect-and-steer.** The orchestrator either composes the gathered findings
into a full-strength, cited answer (Section 3), or — when the inputs are insufficient — chooses the
reflect-and-steer terminal mode: it surfaces what it has, names the gap, and brings the human back
in. The composer reasons over the compact working state plus the small, cited findings, never over
raw dumps.

The **working-state memory** (Section 6) threads through all four phases and persists across turns,
so a multi-turn brainstorm builds rather than resets.

---

## 3. The Three Terminal Modes

A turn can legitimately end in one of three ways. The intent read points toward one; the gather phase
can change it. A thought partner needs all three — a chatbot only has the first.

1. **Synthesize & answer.** Compose a cited, judgment-bearing answer from gathered components. The
   default for questions that the knowledge on hand can actually support.

2. **Produce & act.** When the ask is to make something — a financial analysis, a strategy brief, a
   retrospective — the orchestrator routes to a Domain Agent (the production surface) or a
   skill/workflow, which may run its own iterative loop. The result is an artifact, not just prose.

3. **Reflect & steer (human-in-the-loop).** When the honest answer is "I don't have enough to answer
   this well," the best move is not to fabricate a synthesis — it is to say "here's what I know,
   here's the gap, here's what I'd need or where I'd steer us." A real CSO does this constantly. It is
   higher quality (no hallucinated strategy on thin inputs), cheaper (no large synthesis burned on
   insufficient context), and it is the behavior that makes the system a partner. This is a
   first-class outcome, not a failure state.

---

## 4. Delegation Targets — Bounded Specialists, Many Kinds

Once the orchestrator is a router that dispatches bounded work, its targets generalize well beyond
retrieval. All of them remain **bounded specialists** with scoped context, an approved tool
permission set, and a structured return contract — because composition depends on compact, predictable
worker outputs, and because open-ended roaming agents are where cost, latency, and blast radius
explode.

- **Retrieval / analysis workers** — read and reason over Tier 2 (semantic search) and Tier 3 (raw
  documents), returning cited findings. (e.g., document-analysis, KB-explorer.)
- **Sandbox compute workers** — write and run code (Ep4 sandbox) to compute over founder datasets and
  structured data (P&L math, concentration ratios, utilization). Instead of the expensive model
  reasoning over raw numbers, a cheap worker *computes* and returns the compact result. Core to
  quantitative CFO-grade answers.
- **Wiki components** — read pre-reasoned Tier 1 pages (Section 5). Not a worker call so much as a
  cheap read of build-time synthesis.
- **Live external sources (MCP)** — pull current data from connected systems (e.g., QuickBooks for a
  live P&L) when the internal knowledge is stale or absent (Section 5).
- **Domain-agent production** — for terminal mode 2, delegate to a Domain Agent that runs its own
  iterative artifact production, which may in turn use its own workers (one controlled level of
  sub-delegation, depth-bounded — not an open swarm).
- **Skills / MCP capabilities** — discovered through the MA-06 tool registry and pulled in on demand
  via `tool_search`, so only the tools a turn actually needs enter context, rather than loading the
  full catalog every turn.

Worker model selection runs through the MA-06 tier map: worker-tier (Haiku) for bounded gathering and
computation, synthesis-tier (Sonnet) reserved for the orchestrator's judgment.

---

## 5. Source Selection — Internal Tiers + Live External, Cheapest-First

The router selects among three classes of source, not one, and escalates only as far as the question
requires:

- **Internal — synthesized (Tier 1 wiki components).** Pre-reasoned, cited, instantly readable.
- **Internal — raw / structured (Tier 0 records, Tier 2 vectors, Tier 3 documents, founder datasets).**
  Higher fidelity, higher query-time cost.
- **Live external (MCP connectors).** Current data straight from the source system.

**The wiki is a library of pre-reasoned components, not a cache of answers.** A novel strategic
question is not a page anyone pre-wrote — you cannot pre-synthesize every "what should I do about X."
What *can* be pre-built are the reasoned, cited building blocks: `financial-picture`,
`client-landscape`, `positioning-and-offer`, plus the emergent Layer 2 pages that accrete from
uploads, threads, and connector pulls. Build-time synthesis produces the **ingredients**; the
orchestrator **composes** a fresh answer from a handful of compact components at query time. This is
the concrete expression of the canonical principle "shift work from query time to build time" — and
it is what lets the expensive model reason over a page of distilled inputs instead of reconstructing
them from raw source every turn.

**Freshness vs. authority (a new, required policy).** Because live sources exist, source selection is
no longer just "which tier" — it is also "is the pre-synthesized component fresh and authoritative
enough to trust, or do I go to the source." Financials go stale; a live P&L pull may beat a two-week-
old wiki page, at the cost of a slower external round-trip. The architecture needs an explicit
freshness/authority policy per data class (e.g., financials favor live pulls when a connector exists;
positioning changes slowly and the wiki suffices). This policy does not exist in the current system
and is central to the CFO-grade use case.

**Feeder loop, unchanged.** Anything learned at query time — a live pull, a synthesized finding —
feeds OS Engine to become or refresh a wiki component. The orchestrator **reads and composes and
feeds**; it never writes the wiki directly. The one-writer rule from the canonical doc holds.

---

## 6. Working-State Memory — The Structural Answer to Context Bloat

Compaction and degradation are query-time band-aids on a context that should not have been assembled
in the first place. The structural fix is a **working-state memory**: a compact, purpose-built record
of the conversation's state — decisions reached, open questions, findings already gathered, and
explicitly what we've established we *don't* know. The composer reasons over this working state plus
the current move, not the raw transcript.

This does two things at once. It keeps long strategic conversations **coherent** (a brainstorm builds
instead of resetting), and it keeps them **cheap** (the expensive model never re-reads the full
history). Working-state memory is what compaction was a crude proxy for. Compaction remains only as a
fallback for pathological length, not the primary mechanism.

Working-state memory is per-thread and never a knowledge-base write — it is conversational scaffolding,
distinct from the Tier 1 wiki, and it feeds OS Engine through the normal synthesis path when a thread
produces something worth remembering institutionally.

---

## 7. Cost & Quality Mechanics

The whole design resolves to one move: **cheap, compact inputs into strong, uncheapened judgment.**

- **Workers absorb; the orchestrator judges.** Token-heavy reading and computation happen on
  worker-tier models (Haiku, via MA-06 routing) and return compact cited findings. The synthesis-tier
  model (Sonnet) only ever holds working state + distilled findings + wiki components.
- **Build-time over query-time.** The more the wiki holds pre-reasoned components, the less the
  orchestrator crawls live. Coverage of the wiki is therefore a direct cost lever (and an OS Engine
  responsibility).
- **Adaptive granularity.** Decompose→delegate→compose has *more* model calls than a single loop, so
  it only wins when workers are cheap and the composer's context stays small. Decompose too finely and
  coordination overhead eats the savings. The intent triage keeps simple turns to a single direct
  answer; only genuine multi-part synthesis pays for a plan.
- **Per-turn budget & guardrails.** Every turn carries a budget — a cap on rounds, delegation depth,
  and spend — and delegation depth is bounded (one controlled level of sub-delegation, never open
  recursion). These are the guardrails that make an autonomous planner safe.
- **Transparency as trust *and* latency-cover.** The harness is more powerful but slower and more
  variable than a single stream. Rendering the plan and the workers through the MA-05 transparency
  layer turns the wait into the CSO "showing its work" — which, for a financial-decision tool, is a
  trust feature, not clutter. The MA-05 layer is therefore load-bearing, not cosmetic.

---

## 8. Bounds — What We Keep Hard, What We Consciously Relax

The episode scopes drew tight bounds to ship safely in sequence. Several no longer serve the end
state and are consciously relaxed here; others are load-bearing and stay hard.

**Relaxed (deliberately, within the original intent):**

- **Sub-agents may use the sandbox.** M8 forbade it; quantitative strategy requires compute, so
  sandbox workers are now a first-class delegation target.
- **Depth-bounded sub-delegation is allowed.** M8 forbade recursion outright. We allow one controlled
  level (orchestrator → domain agent → its workers), depth-capped — not an open swarm.
- **`ask_user` / human-in-the-loop is legitimate.** M8 deferred it. Reflect-and-steer makes asking for
  what's needed a first-class terminal mode.
- **Planning / decomposition is central, now.** M8 pushed it to "Episode 6 later." It is the spine of
  this architecture.

**Kept hard (these are what make it trustworthy, not just cheaper):**

- **User isolation & scoped context bundles.** Every worker gets only its bounded scope; fail-closed
  on invalid or cross-user ids.
- **Everything traceable; no hallucinated strategy.** Every surfaced insight cites a source.
- **Curated transparency, no raw chain-of-thought.** Show task summaries, tools, sources, findings —
  never hidden reasoning.
- **Bounded specialists with structured contracts.** The thing that makes composition possible.
- **OS Engine is the sole writer.** The orchestrator reads, composes, and feeds; it never writes the
  wiki directly.

---

## 9. Staging — Prove One Hard Turn End-to-End First

This is a real architectural build, not a wiring tweak, so it is staged with the same thin-vertical-
slice discipline that worked for MA-06.

1. **Prove the full lifecycle on one hard strategic question, end-to-end.** A single question that
   genuinely requires intent read → decomposition → multiple workers (including a sandbox compute over
   a dataset) → composition, with the plan and workers visible through the MA-05 layer and every worker
   routed to the correct tier. This proves the harness spine before any breadth.
2. **Add reflect-and-steer** on a question the current knowledge cannot answer, proving the
   human-in-the-loop terminal mode and the freshness/authority decision (including one live MCP pull).
3. **Generalize** across question types and domains only after the spine and both non-answer terminal
   modes are proven.

Each stage names its acceptance criteria and proves them on live, pairing traces with DB/output
checks — never a trace alone.

---

## 10. Open Questions to Resolve in the Reconciliation & Plans

Carried forward deliberately; these get answered against the live build, not from this document:

- Is there a real tier-escalating **retrieval router**, or is the VCSO doing flat model-driven tool
  selection today? (This is the spine; its true state matters most.)
- Is the **Tier 1 wiki feeder loop** actually running and accreting Layer 2 components? (The build-time
  cost advantage depends on it.)
- What is the true state of the **worker roster** (which capabilities are live vs. placeholder/disabled)?
- Where should the **planner/harness** physically live relative to the current VCSO streaming endpoint,
  and how does it preserve the VCSO voice + MA-05 surface + streaming UX?
- What is the concrete **freshness/authority policy** per data class, and which MCP connectors are the
  first live sources?

These become the backbone of the reconciliation pass, and then the GSD plans for the wiring and
buildout.
