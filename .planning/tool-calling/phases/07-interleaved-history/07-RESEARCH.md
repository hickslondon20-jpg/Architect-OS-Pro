# Phase 7 Research — Interleaved History Rendering

**Verified:** 2026-07-03, against the live repo and Supabase project `pwacpjqkntnovndhspxt`.
**Inherits:** Phase 3 (the VCSO loop persisted its trace via `agent_delegation_runs`/`steps`; `getMessagesForChat` reconstructs it) and Phase 4 (Code Mode runs surface as curated trace steps + artifact cards). Independent of Phase 5 (MCP) and Phase 6 (degradation).

> Boundary: this is **Ep5's Feature 2 (interleaved history rendering)** — NOT the broader series' Episode 7 (full Citations & Source Grounding). This phase makes the persisted trace **citation-ready**; it does **not** build the citation UI. That's a later, separate episode.

---

## What Phase 3 already delivers (the starting point)

- **Reload path exists.** `lib/virtualCsoApi.ts` `getMessagesForChat` rebuilds, per assistant message: `agentSteps` (from `agent_delegation_runs` + `agent_delegation_steps`, ordered by `step_index`) and `artifactDeliveries` (from `structured_result.artifact_id`). So on reload the founder sees the trace panel + artifact cards + the final answer.
- **Renderer:** `components/pro-suite/virtual-cso/AgentStepsPanel.tsx` renders a single collapsed **flat** list — "CSO trace used N steps," each step showing `tool` + a truncated `input` + truncated `output`. `MessageBubble.tsx` composes the message + steps panel + artifact cards.
- **Curated already.** Persisted `output_summary`/`input_summary` are safe summaries (the sub-agents' `_safe_*_summary` shaping), so reload shows curated content, not raw payloads — L11 already holds.

## The gap: the schema is richer than the renderer uses

`agent_delegation_steps` live columns: `id, user_id, run_id, step_index, step_type, status, tool_name, title, summary, input_summary(jsonb), output_summary(jsonb), source_refs(jsonb), error_message, metadata(jsonb), created_at, updated_at`.

Two rich fields are **persisted but dropped before the UI:**
1. **`step_type`** — differentiates a plain tool call vs a sub-agent delegation vs a code-execution run vs `context_build`. The client `toAgentStep` mapping flattens every step to `{tool, input, output, status}`, discarding `step_type`, `title`, `summary`, `metadata`. So `AgentStepsPanel` can't render typed/nested panels — everything is one flat list.
2. **`source_refs`** (jsonb) — a dedicated column for citation source identity exists, but `toAgentStep` doesn't carry it, and it may not even be populated yet from the Phase 2 citation envelopes (verify — see below). This is the HIST-03 seam for the future citations episode.

## Verify-and-wire items

- **Is `source_refs` populated?** Phase 2 attached citation envelopes (`source_kind`/`source_id`/`verbatim`) to tool *results*. Phase 3 persists steps with `output_summary`. **Confirm whether the citation envelope is written into `agent_delegation_steps.source_refs`.** If not, Phase 7 wires it (the persistence-completeness half of HIST-03). The column already exists — no migration needed to hold it.
- **Do code-execution runs reconstruct richly?** Phase 4 surfaced bridge tool calls as curated steps and produced files as artifact cards (which reload). There is **no distinct code-execution panel** — it renders as steps + artifact card. Phase 7 decides whether a code-execution-*typed* panel (grouping the run's curated steps + its artifact) is worth rendering vs. keeping steps+card. Lean: a lightweight typed treatment, curated only (no raw code/stdout — L11 + London's "don't show the guts" vision).

## Loop shape means no per-round message rows are needed

The reference persists **one row per agentic round** to reconstruct `text → tool → text → panel → text` interleaving. **Our loop doesn't produce that shape:** `vcso_chat_service` runs the tool rounds emitting curated trace, then writes the answer as a **single final block** ("Now write the final answer"). So there is no mid-answer text↔tool interleaving to reconstruct — the faithful reconstruction is **ordered, typed panels above the single final answer**. Phase 7 should therefore render ordered typed panels + the final answer, and **deliberately not adopt per-round message rows** (documented divergence — our loop shape doesn't need them). One assistant message + ordered typed steps is the correct model for us.

## What Phase 7 actually is (scoped)

1. **HIST-01 — typed, ordered, reload-durable panels:** carry `step_type` (+ `title`/`summary`/`metadata`) through `toAgentStep`/reconstruction, and render ordered panels differentiated by type (plain tool step / sub-agent nested / code-execution) instead of one flat list — identically for live and reloaded traces.
2. **HIST-02 — curated only (L11):** already holds; keep it on reload (no raw payloads/code); no raw chain-of-thought.
3. **HIST-03 — citation-ready persistence:** ensure Phase 2 citation envelopes land in `agent_delegation_steps.source_refs` and are carried through reconstruction to the client, so the future citations episode grounds without a retrofit. **Do not build the citation UI here.**

Mostly frontend (mapping + rendering) + a backend persistence-completeness check. No new tables (the schema already supports it). No new subsystem.

## Landmines / things to get right

- **Live and reloaded trace must be identical.** The live SSE `step`/`tool_call`/`tool_result` events and the reloaded `agent_delegation_steps` must produce the same typed panels — one rendering path fed by both, not two.
- **Curated only, never raw.** No raw tool payloads, code, stdout dumps, or model reasoning — on live or reload (L11 + the product vision).
- **Citation-ready ≠ citation UI.** Populate + carry `source_refs`; do not build inline citation chips / source sidecar / jump-to-evidence — that is the later Citations episode. Keep the data forward-compatible with four-tier citations (Tier 0 records, Tier 1 wiki, Tier 2/3 docs, web).
- **No per-round message rows.** Don't restructure `vcso_chat_messages` into per-round rows; our loop shape doesn't need it.
- **Reuse, don't rebuild.** Enrich `toAgentStep` + `AgentStepsPanel` (or add lightweight typed sub-panels beside it); don't replace the reconstruction path. No migration (columns exist).
- **Design system.** Typed panels use ArchitectOS tokens (Obsidian/Brass/Parchment, Geist/Geist Mono, no Inter/default grays).

## Open items to resolve at this phase's build-planning (flag, don't silently pick)

1. **Panel differentiation depth** — distinct SubAgent / CodeExecution panel components vs. one enhanced `AgentStepsPanel` that styles by `step_type`. Lean: enhance the existing panel to render by `step_type` (fewer new components), add a light code-execution treatment.
2. **`source_refs` population** — confirm Phase 3 writes it; if not, wire from the Phase 2 citation envelope. Lean: wire it now (persistence-completeness), even though the UI is later.
3. **Code-execution rendering** — typed panel grouping run steps + artifact vs. steps + artifact card as today. Lean: light typed grouping, curated only.
4. **How much of `title`/`summary`/`metadata` to surface** vs. keep compact. Lean: use `title`/`summary` for readable panel headers; keep `metadata` server-side.

## Verification method (for the record)

- Read: `components/pro-suite/virtual-cso/AgentStepsPanel.tsx`, `lib/virtualCsoApi.ts` (`getMessagesForChat`/`toAgentStep`), `MessageBubble.tsx` references.
- Live Supabase: `agent_delegation_steps` columns (confirmed `step_type` + `source_refs` + `title`/`summary`/`metadata` exist).
