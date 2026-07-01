# ArchitectOS Intelligence Layer — Vision & Architecture

> Authored: 2026-06-28
> Status: Active — north star reference for all intelligence layer build work
> Scope: Covers the full intended architecture from current state through beta launch target
>
> This document is the canonical reference for what the ArchitectOS intelligence layer is
> designed to become. It should be read before scoping any new episode or phase in this layer.

---

## Why This Document Exists

Phases 1–7 of the KB Explorer build established the raw document navigation and search
infrastructure. That foundation matters — but on its own it describes a system that can
look through documents. The goal is a system that knows a business.

The distinction is the difference between a capable tool and a trusted advisor.

This document captures the strategic vision for what the intelligence layer becomes by
the end of the beta launch window, and the architecture required to get there.

---

## The Actual Questions Founders Will Ask

The Virtual CSO and Domain Agents are not dashboard replacements. Founders won't use
them to ask what their MRA score was — that's visible on a screen. The conversations
this platform is designed to support are the ones that don't have obvious answers:

**Strategic synthesis questions:**
- "How does my current positioning need to evolve over the next two to three quarters
  given where the market is moving and where I am today?"
- "Based on everything you know about my business, what's the most likely constraint
  holding us back from the next revenue tier?"

**Cross-context reasoning questions:**
- "My P&L shows margin compression over three months. How does that connect to our
  staffing approach and what does it mean for hitting our $6M revenue goal in 24 months?"
- "Given our current capacity and client mix, what does the path from $3M to $6M
  actually look like — and where does the model break?"

**Planning and execution guidance:**
- "What does a strong milestone look like for this capability area given where we sit
  on the ladder right now?"
- "We're six weeks into this sprint and the initiative is behind. What are the right
  adjustments given everything else we have in flight?"

**Longitudinal pattern recognition:**
- "What are the patterns in how we've won and lost clients over the last 18 months,
  and what does that tell us about where our offer is positioned?"

These questions require the system to hold multiple layers of context simultaneously:
the structured platform data (diagnostics, sprint state, ladder position), the founder's
uploaded business documents (financials, proposals, client records), and synthesized
knowledge that bridges between them. No single retrieval method reaches all three.

---

## The Four-Tier Architecture

The intelligence layer is built across four tiers. Each tier serves a different question
type. The retrieval router (described below) determines which tier or combination of
tiers to invoke for any given conversation.

### Tier 0 — Structured Platform Data (Direct Query)

**What it is:** The Supabase tables that the ArchitectOS platform writes directly.
MRA checkpoint results and stage assessments. AE Ladder scores by dimension. Sprint
goals, initiatives, milestones, and status. Quarterly Map priorities. Clarity Compass
answers. Reflection Review rollover data.

**Query method:** Direct structured query via `structured_data_agent`. Deterministic.

**When to use:** Questions tied to specific platform records. "What is my current
ladder position in the Client Experience dimension?" "What initiatives are in flight
this sprint?" "What did my last Reflection Review surface?"

**Fidelity:** Highest. This is ground truth data written by the platform itself.

**What it cannot answer:** Anything that requires synthesis, interpretation, or
reasoning across multiple records or time periods.

---

### Tier 1 — Compiled Wiki (Synthesized Business Knowledge)

**What it is:** The layer that does not yet exist. Per-founder markdown pages
synthesized from Tier 0 structured data and uploaded documents. The wiki represents
the platform's accumulated understanding of the founder's business — not raw data,
not raw documents, but compiled, reasoned knowledge.

**Example wiki pages:**
- `business-context.md` — who this business is, what they do, who they serve,
  what stage they're in
- `diagnostic-synthesis.md` — the integrated picture across MRA dimensions and
  AE Ladder stages, what the pattern of results means, where the leverage points are
- `current-quarter.md` — sprint goals, active initiatives, key blockers, recent wins
- `financial-picture.md` — synthesized from uploaded P&L, proposals, financial docs
- `positioning-and-offer.md` — synthesized from brand docs, clarity compass, client data
- `client-landscape.md` — synthesized from uploaded client records and data

**Query method:** Hybrid search over wiki pages. Fast. Pre-reasoned.

**When to use:** Synthesis questions that require understanding context across
the business. "Give me the full picture on where we are right now." "What does our
positioning say about our growth ceiling?" The wiki provides a pre-assembled answer
rather than requiring the agent to discover and piece together context at query time.

**Fidelity:** Intentionally lossy relative to ground truth — this is a synthesis,
not a record. The tradeoff is that synthesis is available instantly and without
token cost at query time. For ArchitectOS specifically, this tradeoff is
favorable because the platform framework (the AE Ladder, the MRA, the sprint
system) provides the semantic skeleton that the wiki is organized around.
The wiki is synthesizing within a known structure, not making arbitrary claims.

**Maintenance:** Wiki pages are rebuilt when their source data changes. A new
diagnostic run triggers a `diagnostic-synthesis.md` rebuild. A sprint reset
triggers `current-quarter.md`. A new document upload may trigger `financial-picture.md`
or `client-landscape.md` depending on what was uploaded.

**Provenance:** Every wiki page carries source citations — what Supabase records
and what uploaded documents contributed to each synthesized claim. When a founder
asks where an insight came from, the system can trace it.

---

### Tier 2 — Semantic / Vector Search (Chunk-Level)

**What it is:** The existing pgvector infrastructure. Document chunks stored in
`document_chunks` with embeddings. Hybrid search (BM25 + vector similarity) +
optional reranking.

**Query method:** Hybrid semantic search via `document_analysis_agent` and
`retrieve_document_chunks`.

**When to use:** Questions that require finding relevant passages across uploaded
documents when the exact location is not known. "Find everything we have about
retainer structures." "What do our proposals say about onboarding timelines?"

**Fidelity:** Medium. Returns relevant passages, not necessarily the exact
answer. The agent reasons over the returned chunks.

**Relationship to the wiki:** When the wiki page exists and covers the question,
prefer Tier 1. Semantic search is the fallback for questions the wiki does not
pre-cover, or for finding specific evidence to support a wiki-level synthesis.

---

### Tier 3 — Raw Document Explorer (Ground Truth)

**What it is:** The KB Explorer built in Phases 1–7. Five tools: ls, tree, grep,
glob, read. Navigates the folder structure and reads full document content.

**Query method:** KB Explorer sub-agent. Highest cost, highest fidelity.

**When to use:** Deep-reading a specific document. Navigating to find the exact
location of information. Verifying a claim that emerged from Tier 1 or 2.
Questions that require reading the actual text of a contract, proposal, or report.

**Fidelity:** Highest possible — this is the ground truth document content
itself, not a synthesis or a chunk.

**Relationship to the wiki:** The KB Explorer is the wiki's source material.
When a wiki page makes a claim, the KB Explorer can verify it against the
original document. This is the citation resolution path.

---

## The Retrieval Router

The retrieval router is the architectural component that decides which tier or
combination of tiers to invoke for any given question. It lives in the Virtual CSO
streaming endpoint — a lightweight pre-step before Claude is called that classifies
the intent and assembles the right tool set.

**The routing logic (simplified):**

| Question type | Primary tier | Fallback |
|---|---|---|
| Platform record question | Tier 0 direct query | — |
| Business context / synthesis | Tier 1 wiki | Tier 2 semantic |
| Document content question | Tier 2 semantic | Tier 3 explorer |
| Specific document / deep read | Tier 3 explorer | — |
| Cross-tier reasoning | All tiers combined | — |

**What makes ArchitectOS routing tractable:** The question space is constrained.
Unlike a generic enterprise agent that might be asked anything about any document,
ArchitectOS founders are asking questions that orbit around a known framework.
The routing can be trained on the platform's own taxonomy: diagnostic questions,
planning questions, execution questions, financial questions, positioning questions.
Each maps to a known retrieval strategy.

**Cross-tier questions** — the ones that matter most — require the router to
assemble context from multiple tiers before calling Claude. "How does my P&L trend
connect to my sprint goals and what does it mean for my 24-month revenue target"
requires Tier 0 (sprint data), Tier 1 (business context wiki + financial picture),
and possibly Tier 2 (document chunks from uploaded P&L).

The router does not make this a sequential round-trip. It identifies all required
context in one pass and assembles it in parallel before the reasoning call.

---

## Where We Are Now and What's Still Missing

### What Phases 1–7 Built

The KB Explorer established the infrastructure for Tier 3:
- Per-user folder hierarchy in Supabase (`kb_folders`)
- Full markdown storage per document (`full_markdown` in `ose_raw_document_registry`)
- Ingestion UI with folder-targeted uploads
- Five navigation and search tools: ls, tree, grep, glob, read
- KB Explorer sub-agent that orchestrates those tools with Claude

This is a meaningful foundation. Documents can now be navigated and read with
precision. The agent can find specific content without loading every document
into context.

### What's Missing for Beta Launch

**The compiled wiki (Tier 1)** — the highest-leverage missing piece. Without it,
every synthesis question requires the agent to assemble context at query time,
which is expensive, slow, and non-deterministic. With it, the most common and
important questions — the "so what, now what" conversations — have a pre-built
answer ready.

**The retrieval router** — without a routing layer, every question hits the same
retrieval path regardless of what it's actually asking. The router is what makes
the platform intelligent about how it retrieves, not just what it retrieves.

**Cross-tier reasoning assembly** — the ability for the Virtual CSO to pull context
from multiple tiers simultaneously and hold it coherently in a single reasoning pass.
This is the capability that enables the deep strategic conversations described above.

**Wiki maintenance** — the mechanisms that keep wiki pages current as the founder's
data changes. A diagnostic run should trigger a re-synthesis of the diagnostic wiki
page. A sprint reset should trigger a current-quarter update. Without maintenance,
the wiki becomes stale and loses its value as a reliable context source.

---

## The Beta Launch Target State

By the end of the beta launch intelligence layer build, the platform should be able
to do the following:

1. **Answer diagnostic "so what" questions without tool calls.** When a founder asks
   what their AE Ladder results mean for their next quarter, the system should have
   a pre-compiled synthesis available — not start from scratch.

2. **Connect structured data to uploaded documents in a single response.** A question
   about how a P&L trend connects to a sprint goal should pull from both Supabase
   tables and uploaded financial documents without the founder having to structure
   the question as a multi-part query.

3. **Route retrievals intelligently and transparently.** The system should show
   (or be able to show on request) which layer of context it used to reach a
   conclusion — Tier 0 record, Tier 1 wiki synthesis, Tier 2 document chunks,
   or Tier 3 full document read.

4. **Maintain context that compounds over time.** Each interaction, each new
   document upload, each completed sprint should incrementally improve what
   the system knows — not reset to zero. The wiki is the accumulation mechanism.

5. **Support the strategic conversations founders actually want.** Not "what is
   my MRA score" but "given my score, where is the leverage, and what does the
   path look like from here."

---

## Remaining Episodes and What They Unlock

Episodes 3–7 of the reference series (PII redaction, agent skills, advanced tool
calling, agent harness, citations) each add capabilities that compound on what
Phases 1–7 established. The wiki build (Phase 8) and retrieval router (Phase 9)
are the next major layers. Beyond those, the remaining episodes address:

- **Agent skills and reusable patterns** — packaging the retrieval strategies
  as skills that domain agents can invoke without re-specifying the logic
- **Advanced tool calling** — dynamic tool selection based on question type,
  not static tool lists
- **The agent harness** — the deep mode pattern for complex multi-step research
  questions that require autonomous planning across all four tiers
- **Citations and source grounding** — end-to-end traceability from every
  synthesized claim back to its source record or document

Each of these layers on top of the four-tier architecture described here.
The architecture is the frame. The episodes fill it in.

---

## Key Design Constraints to Honor

As this layer is built, several constraints must be maintained:

**The wiki is a synthesis, not a replacement.** Raw documents and structured
data remain the authoritative sources. The wiki is a derived view. When the
wiki and the source conflict, the source wins.

**Context must be traceable.** Every insight the platform surfaces should be
attributable to a specific source — a Supabase record, a document, a wiki page
that cites a document. Hallucination is not acceptable in a platform a founder
is using to make financial and strategic decisions.

**The platform framework is the organizing structure.** The AE Ladder, MRA,
sprint system, and quarter map are not just UI features — they are the semantic
skeleton that organizes everything the intelligence layer knows about a founder.
Wiki pages, router classifications, and agent capabilities should all align to
this framework, not work around it.

**Retrieval cost is a real constraint.** Every token in an agent loop is a cost.
The architecture above is designed to shift reasoning from query time to ingestion
time wherever possible. New features should be evaluated against this principle:
does this move work from query time to build time, or does it add more work at
query time?
