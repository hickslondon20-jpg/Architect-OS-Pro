# Phase 7 Context — Interleaved History Rendering

**Phase:** 07 of the Advanced Tool Calling build — the closing phase.
**Read first:** the build-level `CONTEXT.md` and `ROADMAP.md`; this phase's `07-RESEARCH.md`; the Phase 3 & 4 `COMPLETION.md` files (the persisted trace + Code Mode this phase reconstructs); canonical `INTELLIGENCE-LAYER-EPISODE-MAP.md` §3.2 (traceability) + L11. Canonical docs win over the reference PRD.

> **Boundary:** this is Ep5's **interleaved history rendering** feature — NOT the broader series' Episode 7 (full Citations & Source Grounding). This phase makes the persisted trace **citation-ready**; it does **not** build the citation UI (chips/sidecar/jump-to-evidence). That is a later, separate episode.

---

## Why this phase, and what it is

The traceability layer (§3.2) made reload-durable. Phase 3 already persists the VCSO loop's trace (`agent_delegation_runs`/`steps`) and `getMessagesForChat` reconstructs a flat panel; Phase 4 adds Code Mode runs + artifact cards. This phase upgrades reconstruction from a **flat** "N steps" list into **typed, ordered, reload-durable panels** and ensures the persisted trace carries citation source refs for the future citations episode.

- **HIST-01 — typed, ordered reload-durable panels:** carry `step_type` (+ `title`/`summary`) through reconstruction; render ordered panels differentiated by type (tool step / sub-agent nested / code-execution), identically for live and reloaded traces.
- **HIST-02 — curated only (L11):** no raw payloads/code/reasoning, on live or reload.
- **HIST-03 — citation-ready persistence:** ensure Phase 2 citation envelopes land in `agent_delegation_steps.source_refs` and are carried to the client, so the future citations episode grounds without a retrofit.

It is **mostly frontend** (mapping + rendering) + a backend persistence-completeness check. **No new tables** (the schema already has `step_type`/`source_refs`/`title`/`summary`/`metadata`), no new subsystem.

## What this phase is NOT

- **Not the citations UI.** No inline citation chips, source-preview sidecar, jump-to-evidence, or "check citations" — that is the later Citations & Source Grounding episode. Populate + carry the data only.
- **Not per-round message rows.** Our loop defers the answer to a single final block, so there is no mid-answer text↔tool interleaving to reconstruct. Ordered typed panels + the single final answer is faithful; do **not** restructure `vcso_chat_messages` into per-round rows (documented divergence from the reference).
- **Not a change to the loop or the usage stream.** Read Phases 3/4; don't re-touch them.
- **Not a new reconstruction path.** Enrich the existing `toAgentStep` / `AgentStepsPanel` path; don't replace it. No migration.
- **Not raw trace.** Curated summaries only (L11 + the "show the thinking, not the guts" vision).

## Decisions that shape this phase (do not override)

1. **One rendering path, fed by both live and reload.** The live SSE `step`/`tool_call`/`tool_result` events and the reloaded `agent_delegation_steps` must produce the **same** typed panels — not two divergent renderers.
2. **Typed, ordered panels.** Carry `step_type` through reconstruction; render tool step / sub-agent / code-execution differently, ordered by `step_index`. Enhance the existing panel (lean) rather than build parallel components, unless a distinct component is clearly cleaner.
3. **Curated only, never raw (L11).** No raw tool payloads, code, stdout, or model reasoning — live or reload.
4. **Citation-ready, not citation UI (HIST-03).** Populate `source_refs` from the Phase 2 citation envelope and carry it to the client; keep it forward-compatible with four-tier citations (Tier 0 records, Tier 1 wiki, Tier 2/3 docs, web). Do not render citations.
5. **No per-round message rows.** Our loop shape doesn't need them; one assistant message + ordered typed steps is the model.
6. **Reuse, don't create.** No new tables (columns exist); enrich the existing mapping + panel. Design-token styling.
7. **Inherit Phases 3–6.** The persisted trace, artifacts, and loop are the substrate; this phase reads and enriches the reconstruction.

## Success criteria (from ROADMAP.md Phase 7)

1. On reload, tool calls, sub-agent panels, and code-execution panels reconstruct in correct order (typed, ordered — not one flat undifferentiated list).
2. Rendered trace is curated summary only (steps, tool/source usage, sub-agent progress) — no raw chain-of-thought or raw payloads (L11).
3. Persisted records carry source refs (`agent_delegation_steps.source_refs`, populated from the Phase 2 citation envelope) and are carried to the client, so the citations episode grounds without a retrofit.
4. Live streaming behavior is unchanged; the improvement is on reload / thread re-entry; live and reloaded traces render identically.

## Open items to resolve at this phase's build-planning (flag, don't silently pick)

- **Panel differentiation depth** — distinct SubAgent/CodeExecution components vs. one `AgentStepsPanel` styled by `step_type`. Lean: enhance the existing panel + a light code-execution treatment.
- **`source_refs` population** — confirm Phase 3 writes it; if not, wire from the Phase 2 citation envelope. Lean: wire it now.
- **Code-execution rendering** — typed grouping (run steps + artifact) vs. steps + artifact card as today. Lean: light typed grouping, curated.
- **How much `title`/`summary`/`metadata` to surface** — lean: `title`/`summary` for panel headers; `metadata` stays server-side.
