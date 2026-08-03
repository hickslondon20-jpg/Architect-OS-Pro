# 04B — VCSO SDK Migration: Vision, Intent & Sense-Check Rubric

**Purpose.** The single consolidated statement of *why* this migration exists and *what "fit for
purpose" means* — the spine to grade every phase (D2 done on M1–M5; E/F/G ahead) and the MVP state
against, so we build **to intent**, not off minimal summaries. **Read this first.** The scattered
pieces (`CONTEXT.md` §"Why this phase exists", `REFERENCES.md`'s gbrain map, `ROADMAP.md`'s phases) are
consolidated here. Where this and the North Star (`../../../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` /
`../../../INTELLIGENCE-LAYER-ARCHITECTURE.md`) differ, **the North Star wins** — this changes the
*engine*, not the target shape.

---

## 1. The core intent (one line)
Turn Virtual CSO from a chatbot / retrieval thread into a **thought partner** — a system that *reasons*
about what a founder's strategic question actually needs, *plans a visible approach*, *delegates* the
token-heavy gathering to cheap bounded specialists, and *composes founder-grade, cited judgment* — on an
engine reliable enough that **the same substrate powers the Domain Agents.**

## 2. What we were building vs. why the SDK
The pre-migration Virtual CSO was a ~3,155-line **hand-rolled agentic loop**: a blocking model call per
round, a *faked* stream (the finished answer chopped into 160-char pieces), a deterministic
keyword-based source router, and a hand-rolled planner that failed twice by dropping the mandatory
sandbox child (the P4 rollbacks). The deeper problem was philosophical: a deterministic router and a
fixed pipeline can *retrieve*, but they cannot *reason* about what a novel strategic question needs — and
that reasoning is the entire difference between a RAG bot and a thought partner.

The **Claude Agent SDK** is the engine that closes that gap — the same agentic loop, native subagents,
sessions, hooks, and MCP that power Claude Code, running **in-process** in our Python backend
(consistent with CLAUDE.md Rule #1). So the migration is a **consolidation and upgrade, not a rewrite**:
the SDK owns the loop, delegation, streaming, and lifecycle; we **kept** our context-*selection* IP
(working-state memory, tiered retrieval, the compiled wiki) and our bounded workers, and repositioned
only the packing + loop-lifecycle onto the SDK.

## 3. The reframe to hold onto
We stopped trying to build a "router." There is **no hard classifier** deciding paths. There is one
capable model in a loop where **the tools are the routes**, and the intelligence lives in the model's
reasoning about which specialist to bring in, when. The proof that this actually works is **not** the
pass rate — it is that the delegation *order varied run to run while the dependency held* (structured →
wiki → sandbox vs. structured → sandbox → wiki, with sandbox always waiting for structured). A router
cannot do that. Only genuine reasoning can. That single observation is the thesis validated.

## 4. Fit-for-purpose sense-check rubric
Grade E/F/G and the MVP state against these. Status keys: **✓ proven** · **◐ partial** · **○ open**.
A phase can pass its own gate while a rubric line slips — that is a flag, not a pass.

| # | Intent | Evidence bar | Status (2026-07-22) |
|---|---|---|---|
| 1 | **Reasons, doesn't rule-route** | Delegation varies sensibly with the question, not a fixed sequence | **✓** on the anchor (order-variation); **○** across varied questions → Phase G |
| 2 | **Plans *visibly*** | Living plan panel + nested worker groups + drill-down chips; founder watches the thinking | **✓** (renders in-flight, at completion, through reload) |
| 3 | **Delegates to cheap bounded specialists** | Sonnet composes; Haiku workers gather; effort-scaled (simple → direct) | **✓** on the anchor + a control |
| 4 | **Composes founder-grade, *cited* judgment** | Real sourced findings, not a generic essay | **✓** (24-row SOURCES rail, live) |
| 5 | **Honest about gaps** | Says what it lacks instead of inventing | **✓** ("structured data returned only aggregated P&L — no client-level breakdown") |
| 6 | **Feels native** | Real token streaming, curated transparency (never raw payloads/CoT), survives reload | **✓** |
| 7 | **Safe & bounded** | Worker isolation, one-writer, tier authority at capability grain, dark until observed-reliable | **✓** (Defect 7 closed; flags dark) |
| 8 | **Generalizes across the founder's real question space** | Delegates *appropriately* across varied strategic shapes | **○ OPEN — the gate before wider exposure (Phase G)** |
| 9 | **The substrate serves Domain Agents** | Workers, registry, sandbox, retrieval, streaming reused by the output-oriented Domain Agent workflows | **◐** (substrate proven for VCSO; Domain-Agent composition is downstream) |

**The strategic "why" behind #9:** this migration is not only about Virtual CSO's chat. It hardens the
**shared intelligence layer** — reasoning-driven delegation, bounded workers, the tool registry, model
tiering, citations, the streaming surface — that *both* Virtual CSO and every Domain Agent run on.
Virtual CSO is the open-ended **agent**; Domain Agents are the output-oriented **workflows** built from
the same parts. Get this fit for purpose and the Domain Agents inherit a proven foundation.

## 5. The gbrain overlap (inspiration — two layers, not a blueprint)
**What gbrain is, and the key insight:** gbrain (garrytan/gbrain) is a *retrieval engine + content model
+ cost-routing discipline* — deliberately **not** a reasoning planner (its own guidance: cross-brain
federation is "YOUR JOB, not the DB's"). That validated our split: **gbrain inspires the
knowledge/retrieval substrate; the Agent SDK is the reasoning/delegation engine.** Two different layers;
gbrain never claimed to solve the planner problem D2 built.

**Patterns mined (see `../../../gbrain-inspiration/`):**
- **Compiled truth + timeline** — current synthesis over an append-only evidence trail. Our Tier-1
  compiled-wiki model, and the exact shape for the financial *series* (P&L snapshots as timeline — the
  trend spine, Phase F).
- **Hybrid + graph retrieval** (vector + BM25 + RRF + graph traversal + rerank + source-aware ranking) —
  validated "don't jump to vector"; sets the quality ceiling for the tiered source router.
- **Brain-first lookup** — check compiled internal context before any external call.
- **Brain vs. memory vs. session** — three-layer routing (world knowledge / operational state / session).
- **Sub-agent model routing** — cheapest model that can do the job; corroborates the MA-06 tier map and
  the Sonnet-lead / Haiku-worker economics.
- **Brains & sources** — the federation mental model (a brain = a DB; a source = a repo within it) that
  shapes multi-tier retrieval across wiki, structured records, and eventually MCP connectors.
- **"Honest about gaps"** — synthesized answers surface what's missing instead of hallucinating (rubric #5).

**How we deliberately differ:** gbrain is single-user, local, Git-as-storage, generic prose. We are
multi-tenant cloud, Supabase-stored, structured business context designed to flex across org types. We
mined the *patterns and disciplines*, never the product or storage packaging. gbrain still points ahead
of us where we've parked work: financial-series / compiled-truth-over-timeline for real trend compute,
MCP-as-an-ingestion-source, and the full hybrid+graph retrieval quality — all Phase F and beyond.

## 6. The bridge to Domain Agents
Virtual CSO (agent) and Domain Agents (workflows) share one substrate. Everything D2 hardened —
model-driven delegation, `SubAgentOrchestrator` bounded workers, the tool registry + tier→model map,
the sandbox, retrieval, the C2 streaming surface, citations — is the foundation the Domain Agent
output-oriented workflows compose. So "is the Virtual CSO experience fit for purpose" and "are the
Domain Agents built on something sound" are the *same* question about the *same* engine.

## 7. How to use this doc
At the close of every phase and at the MVP checkpoint, **grade against §4**. The question is never only
"did the phase pass its gate" — it is "is the system still fit for purpose against the top lines." If a
phase's gate is green but a rubric line regressed or stayed hollow, that is a flag to surface, not a
pass to bank. This is the guard against building correctly toward the wrong thing.
