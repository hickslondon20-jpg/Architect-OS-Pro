# Intelligence-Layer Orchestration Handoff — MVP-Readiness Push

> Onboarding for the **new orchestration agent** that continues the role the strategy thread
> played across Ep1–Ep7. Authored 2026-07-06.
>
> Your job is to **hold the context, help the founder determine where we are / what's next /
> what's outstanding / what's on the roadmap to MVP, and orchestrate the work** — by spinning
> up **managing agents** for defined workstreams. Those managing agents spin up execution
> agents. **You do not run execution agents directly, and you do not do the build/test work
> yourself.** You are the middle context-holder and orchestrator, working *with* the founder.

---

## 1. Read these first (source of truth)

1. **`.planning/INTELLIGENCE-LAYER-ARCHITECTURE.md`** — the vision: three surfaces, the
   four-tier knowledge layer, the two-layer wiki, and the write-ownership/feeder model.
2. **`.planning/INTELLIGENCE-LAYER-EPISODE-MAP.md`** — the five primitives, the per-episode
   map (Ep4–7 + refinements), the **locked decisions L1–L26** (§5), deferred decisions (§6),
   and the **§8 post-Ep7 roadmap**. This is the design ledger; honor the locks.
3. **`Pro-Suite-Progress.md`** (repo root) — the **ground-truth status tracker**. Read it
   first each session; keep it current. (Header says exactly this.)
4. **`CLAUDE.md`** — ways of working + hard rules (three-lane AI synthesis, Claude-locked
   primary, Rule #4 report scope, beta = founder-only, etc.).
5. **Per-workstream ledgers** as needed: `.planning/citations/CONTEXT.md` (Ep7 decisions),
   `.planning/agent-harness/` (Ep6), `.planning/tool-calling/` (Ep5),
   `.planning/wiki-system/` + `.planning/document-wiki/` (Tier 1/2), `.planning/skills-sandbox/` (Ep4).

The older `.planning/INTELLIGENCE-VISION.md` is **superseded** — do not use it.

---

## 2. The vision in one paragraph

The intelligence layer is **one shared knowledge substrate (four tiers: platform records →
compiled wiki → semantic search → raw documents) with three surfaces on top**: **OS Engine**
(the sole writer — ingests and synthesizes the knowledge base + wiki), **Virtual CSO** (the
conversational read/reasoning surface), and **Domain Agents** (the produce surface — workflows
that generate auditable artifacts). The goal is a system that *knows the founder's business*
and whose every answer is *traceable to source* — not a document search box. Full detail in the
architecture doc; the locked decisions in the episode map are non-negotiable without explicit
founder sign-off.

---

## 3. Where we are (Ep1–Ep7 state)

All of this is **code-complete and largely live-wired, but not yet live-verified end-to-end**
(the L18 verification debt has rolled forward — see §4).

- **Ep1 — RAG Foundation:** done; several M2–M8 live smokes still blocked (OpenAI quota, Docling runtime).
- **Ep2 — KB Explorer:** built and in use (`kb_explorer_service.py`; Phases 8–9 connection work done).
- **Ep3 — PII Redaction:** intentionally skipped (per the episode map — doesn't fit the use case; needs no local LLM anyway).
- **Ep4 — Skills & Sandbox:** done (7 phases). Skills, building-block files, GKE sandbox, artifacts.
- **Ep5 — Advanced Tool Calling:** done (7/7). Model routing + tagged usage stream, unified tool registry + `tool_search`, VCSO in-thread tool loop, exec-channel sandbox bridge, MCP scaffold, degradation %/compaction, interleaved history.
- **Ep6 — Agent Harness / Domain Agents:** code-complete. Object model + generic workflow/task engine, Monthly P&L POC, Domain Agents surfaces wired, promotion feeder, VCSO Deep Mode, `@Agent` invocation.
- **Ep7 — Citations & Source Grounding:** code-complete + live-wired. One `CitationRef` currency over 7 divergent shapes, four resolver families, VCSO chips/sidecar/jump-to-evidence, Check-Citations verifier, Domain-Agent artifact citations, Tier-3 PDF geometry (Ep7B).
- **Wiki layers:** Tier 1 (`wiki-system`) and Tier 2 (`document-wiki`) **built in isolation**; the cross-tier **connection phase** (retrieval router + wiring wiki into surfaces) is only partly built and is the frontier.

All schema migrations are applied live to Supabase `pwacpjqkntnovndhspxt`, additive/idempotent, forward-only (no backfill — L10).

---

## 4. What's outstanding (the roadmap you'll triage toward MVP)

Your first real job is to **triage these against MVP-readiness** (what's actually required for
MVP vs. post-MVP/v1) with the founder. Grouped:

**A. Consolidated testing / verification-debt payoff — the big near-term pass.** This is the
*first time real credentials get wired*, so it's the single consolidation point for all
deferred live verification that has rolled forward under L18 across Ep5/6/7:
- deny-all egress NetworkPolicy on sandbox pods; live Anthropic/GKE/sandbox smokes; flip the VCSO Python-stream flag (Vercel stays rollback).
- Ep7 env-gated smokes: full PDF pixel highlight (needs Docling installed + a real PDF), the `citationPdfGeometry` vitest.
- Ep1 return-pass smokes blocked on OpenAI billing/quota + Docling runtime; Cohere rerank; isolated-user boundary.
- end-to-end citation testing across surfaces.
Frame this as "code-complete → live-verified across the whole layer," not just "test Ep7."

**B. Contained wiring fixes.**
- **MRA citation repoint (priority quick win):** `platform_record_resolver.py` names `mra_checkpoints`, but the live MRA substrate is `gm_checkpoints`/`gm_checkpoint_*`. Tier-0 MRA citations won't resolve until repointed. **Pair it with a guard** — an acceptance check that every `platform_record` source-kind the resolver claims resolves against a real live table (this failure class recurred as the earlier `agent_capabilities` collision).

**C. The connection phase.** Cross-tier retrieval router + full wiring of the wiki into VCSO /
Domain Agents / OS Engine. Partly built (KB Explorer Phases 8–9). Affects wiki-page citations
(L24 — Ep7 consumes what this exposes) and cross-tier reasoning. Decide if/how much is MVP.

**D. Dark-by-design, dependency-gated (decide MVP scope).** `web` citations (need a web-search
producer — tied to the Ep1-M7 web-fallback / MCP); `reflection_reviews` citations + the
`sprint_evolution` wiki page (need V-11 Reflection Review wiring); the `sprint_retrospective`
wiki page (needs an `sp_sprint_retrospectives` table).

**E. §8 front-end/UX audit + real-wiring pass.** The large cross-cutting workstream: audit the
front-end against everything Ep1–7 built, replace mock data/design with real wiring, and polish
the functional-but-unpolished surfaces (citation chips/sidecar/highlight, Domain Agents,
Deep Mode). **Comes after testing + UI-polish** (episode map §8).

**F. Deferred product layers (likely post-MVP).** Metering ledger + account-level usage % +
tier economics; admin panel; the Ep1 return-pass queue (dataset normalization taxonomy, period
normalization, capability governance, sub-agent trace UX polish).

---

## 5. The founder's steer (immediate go-forward)

**Testing + UI polish before design.** Recommended sequencing: **MRA repoint (+guard) →
consolidated testing/verification-debt pass (A) → UI-polish pass → §8 design audit (E).** §8
should inherit a fully-wired, *tested* substrate.

---

## 6. How you operate

- **You orchestrate; you don't execute.** For each defined workstream you spin up a **managing
  agent** (e.g. a testing-pass manager, a connection-phase manager, a §8 UI manager) with a
  scoped brief; that manager spins up execution agents. You hold the cross-workstream context.
- **Work with the founder** to determine state, next, outstanding, and MVP scope. Don't
  unilaterally decide MVP boundaries — surface options and recommendations.
- **Ground-truth hygiene:** keep `Pro-Suite-Progress.md` and the canonical docs current; every
  managing/execution agent reads the tracker first and updates it when done.
- **Honor the locks (L1–L26)** and the deferred/directional decisions; never override without
  explicit founder instruction. Flag conflicts rather than resolving silently.
- **Verify before build, reuse before create** — most of the platform is already built; the
  remaining work is verify / wire / test / polish, not greenfield.
- **One workstream at a time, alignment checkpoint before spinning an agent** — the GSD cadence
  used throughout Ep1–7.

---

## 7. Your first task

Produce a **"State of the Intelligence Layer → Roadmap to MVP"** working document with the
founder: where we are (per §3), the outstanding work triaged into **MVP-required vs.
post-MVP/v1** (per §4), the critical path, and a recommended sequencing (starting from the
founder's steer in §5). Then, on the founder's go, scope and spin up the **first managing
agent** — most likely the **consolidated testing / verification-debt pass (A)**, with the
**MRA repoint (+guard)** as the contained quick win ahead of it.

Everything is durably captured in the canonical docs and per-workstream `CONTEXT.md` ledgers,
so this can be picked up cold. The arc's remaining work is: **fix → test → polish → §8 design →
MVP.**
