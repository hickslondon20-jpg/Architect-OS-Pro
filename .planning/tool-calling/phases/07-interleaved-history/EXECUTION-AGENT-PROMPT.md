# Execution Agent Brief — Phase 7: Interleaved History Rendering

You are the Execution Agent for **Phase 7** of the Advanced Tool Calling build in ArchitectOS Pro — the closing phase. You implement this phase's code. You do not re-plan it and you do not start other phases.

## Read these before writing any code (in order)

1. `.planning/tool-calling/CONTEXT.md` — the build's rationale and the 11 decisions you must not override.
2. `.planning/tool-calling/ROADMAP.md` — Phase 7 goal, dependencies, success criteria.
3. `phases/03-.../COMPLETION.md` and `phases/04-.../COMPLETION.md` — the persisted trace + Code Mode this phase reconstructs. Do not re-touch the loop core.
4. `phases/07-interleaved-history/07-RESEARCH.md` — the live-verified state (what Phase 3 already reconstructs; the schema's rich fields the renderer drops). **Trust it, but re-verify anything you're about to change.**
5. This phase's `CONTEXT.md`, then `07-01-PLAN.md` (persistence + data-carry) and `07-02-PLAN.md` (rendering).
6. Canonical: `INTELLIGENCE-LAYER-EPISODE-MAP.md` §3.2 + L11. Wins over the reference PRD.

## Scope boundary (read this first)

This is **Ep5's interleaved history rendering** — NOT the broader series' Episode 7 (full Citations & Source Grounding). You make the persisted trace **citation-ready** (populate + carry `source_refs`); you do **not** build the citation UI (chips, source sidecar, jump-to-evidence, check-citations). That is a later, separate episode. Stop at "the data is there and carried."

## What you are building

Upgrade reload reconstruction from a **flat** "N steps" list into **typed, ordered, reload-durable panels**, and complete the citation-ready persistence:

- **07-01** — verify/wire `agent_delegation_steps.source_refs` population from the Phase 2 citation envelope; set `step_type` meaningfully; carry `step_type`/`title`/`summary`/`source_refs` through `toAgentStep`/`getMessagesForChat` and the live SSE path. **No migration** (columns exist).
- **07-02** — render typed, ordered panels (tool step / sub-agent / code-execution) through one path fed by both live and reload; curated only; ArchitectOS design tokens.

## Hard constraints (do not violate)

- **Curated only, never raw (L11).** No raw tool payloads, code, stdout, or model chain-of-thought — live or reload. Use the curated `input`/`output`/`summary`/`title`.
- **Citation-ready ≠ citation UI.** Populate `source_refs` and carry it to the client, forward-compatible with four-tier citations (Tier 0 records, Tier 1 wiki, Tier 2/3 docs, web). Do **not** render citations.
- **No per-round message rows.** Our loop defers the answer to a single final block, so there's no mid-answer text↔tool interleaving. Ordered typed panels + the single final answer is faithful. Do not restructure `vcso_chat_messages`.
- **One rendering path for live and reload.** The live SSE trace and the reloaded steps must produce identical typed panels — not two renderers.
- **No migration, no new tables/subsystem.** The schema already has `step_type`/`source_refs`/`title`/`summary`/`metadata`. Enrich the existing `toAgentStep` + `AgentStepsPanel` path; add a light typed sub-component only if clearly cleaner.
- **Don't re-touch the loop or usage stream.** Read Phases 3/4; enrich reconstruction + rendering only.
- **Design system.** ArchitectOS tokens (Obsidian/Brass/Parchment, Geist/Geist Mono, `aos-mono` for trace labels; no Inter/default grays). No regression for simple single-tool turns.

## Confirm with London at checkpoint (do not silently decide)

- **Panel differentiation depth** — enhance `AgentStepsPanel` styled by `step_type` (lean) vs. distinct SubAgent/CodeExecution components.
- **`source_refs` population** — confirm Phase 3 writes it; wire from the Phase 2 citation envelope if not (lean: wire it now).
- **Code-execution rendering** — light typed grouping (run steps + artifact) vs. steps + artifact card as today.
- **How much `title`/`summary`/`metadata` to surface** — lean: `title`/`summary` for headers; `metadata` server-side.

## Done when

1. All Phase 7 success criteria in `ROADMAP.md` are met and independently verified.
2. `agent_delegation_steps.source_refs` is populated from the Phase 2 citation envelope (verified/wired); `step_type` set meaningfully; no migration.
3. `toAgentStep`/`getMessagesForChat` + the live SSE path carry `step_type`/`title`/`summary`/`source_refs`.
4. Reloaded traces render as typed, ordered panels (tool / sub-agent / code-execution), ordered by `step_index`, above the single final answer, artifact cards intact; live and reload render identically through one path.
5. Curated only (no raw payloads/code/reasoning); `source_refs` carried but not rendered as citations; ArchitectOS tokens; no regression for simple turns.
6. `python -m compileall python-backend` + `npm run build` clean; live + reload verified or gaps flagged honestly.
7. `Pro-Suite-Progress.md`, `.planning/tool-calling/ROADMAP.md`, `.planning/tool-calling/STATE.md` updated and a `phases/07-interleaved-history/COMPLETION.md` written. **This closes the Advanced Tool Calling build (7 of 7).**

## Explicitly out of scope for you

The full Citations & Source Grounding UI (later episode — you only make the trace citation-ready), the metering ledger / account-level % (deferred), MCP live connectors (v2). Resolving D1 is out of scope. No per-round message-row restructuring. No new tables or migrations.
