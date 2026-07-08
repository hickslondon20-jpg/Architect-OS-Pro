# Execution Agent Brief — Phase 6: Degradation Signal & Compaction

You are the Execution Agent for **Phase 6** of the Advanced Tool Calling build in ArchitectOS Pro. You implement this phase's code. You do not re-plan it and you do not start other phases.

## Read these before writing any code (in order)

1. `.planning/tool-calling/CONTEXT.md` — the build's rationale and the 11 decisions you must not override.
2. `.planning/tool-calling/ROADMAP.md` — Phase 6 goal, dependencies, success criteria.
3. `phases/01-.../COMPLETION.md` and `phases/03-.../COMPLETION.md` — the substrate you **read**: the `role`-tagged `ai_usage_log` (Phase 1) and the VCSO loop + SSE stream (Phase 3). Do not re-touch them.
4. `phases/06-degradation-compaction/06-RESEARCH.md` — the live-verified finding about how the main window fills. **Trust it, but re-verify anything you're about to change.**
5. This phase's `CONTEXT.md`, then `06-01-PLAN.md` (signal) and `06-02-PLAN.md` (compaction).
6. Canonical: `INTELLIGENCE-LAYER-EPISODE-MAP.md` §3.4 + L13. Wins over the reference PRD.

## What you are building

The per-thread half of the §3.4 usage story:

- **06-01** — a per-thread "% remaining before degradation" signal (peak `role='main'` `input_tokens` ÷ the model's context window from the registry), streamed as a dedicated SSE event and rendered as a slim % bar.
- **06-02** — context compaction that condenses a long thread's assembled context (prior tool results + older content) so the freshly-built prompt stays under the window — reclaiming context, not cost.

## Hard constraints (do not violate)

- **Per-thread only.** Account-level %, the usage ledger, quotas, and tier economics are **deferred** — do not build them. Phase 1 events are already ledger-ready for them.
- **Degradation reads `role='main'` only.** Exclude sub-agent and utility usage from the thread-fullness signal (L13). Sub-agent internal work is metering-visible, degradation-invisible.
- **The founder sees a percentage, never raw tokens or cost.** Internal math is tokens; the UI shows %.
- **The window comes from the registry.** Add `context_window` to `ai_models`, read it via the registry, config default as fallback. Claude-locked model — no per-thread model variation.
- **Compaction reclaims context, not cost (L13).** Its summarization is a model call on the Python direct-Anthropic lane via the model-settings registry, **tagged `role='utility'`** (Phase 1). It does not reduce prior turns' metered spend.
- **Compaction targets the assembled context, not a growing append-list** (the VCSO re-assembles bounded context per turn — RESEARCH). It is **not** writeback (`/api/vcso/writeback` → OS Engine is a different job); do not merge them, and compaction never writes to the knowledge base.
- **Reuse, don't create.** Store the compacted summary minimally (a `vcso_chat_threads` column/JSONB) and consume it in `_build_context`; no new subsystem. Extend the existing generic frontend `parseSseStream` for the new event.
- **Inherit Phases 1–5.** Read the tagged stream + registry + loop; don't modify the usage stream or the loop's core.
- **Design system.** The % bar uses ArchitectOS tokens (Obsidian/Brass/Parchment, Geist/Geist Mono, no Inter/default grays).

## Confirm with London at checkpoint (do not silently decide)

- **Window source** — `context_window` column on `ai_models` (lean) + config fallback vs. config/env only.
- **Compaction trigger** — founder-initiated (lean) vs. auto-threshold vs. both.
- **Compacted-summary storage** — thread column/JSONB (lean) vs. companion row.
- **What/how aggressively compaction summarizes**, and the threshold band.
- **SSE shape** — dedicated `usage`/`context` event (lean) vs. extending `done`.

## Done when

1. All Phase 6 success criteria in `ROADMAP.md` are met and independently verified.
2. `ai_models.context_window` exists (seeded for the active Claude model), read via the registry with a config fallback.
3. The per-thread % is computed from peak `role='main'` `input_tokens` ÷ window, `role='main'` only; streamed as a dedicated SSE event carrying a percentage (+ band), not raw tokens.
4. A slim % -remaining bar renders per-thread in the chat footer, color-banded, resets on thread switch, design-token styled.
5. Context compaction summarizes older assembled context on the Python lane (tagged `role='utility'`), stored minimally and consumed by `_build_context`; post-compaction the prompt is leaner and the % recovers; the thread continues coherently; cost is not refunded; it is not writeback.
6. Account-level % confirmed deferred (not built); Phase 1 events remain ledger-ready.
7. `python -m compileall python-backend` + `npm run build` clean; verified live or gaps flagged honestly.
8. `Pro-Suite-Progress.md`, `.planning/tool-calling/ROADMAP.md`, `.planning/tool-calling/STATE.md` updated and a `phases/06-degradation-compaction/COMPLETION.md` written.

## Explicitly out of scope for you

The metering ledger / account-level % / quotas / tier economics (deferred), interleaved-history rendering (Phase 7), MCP (Phase 5). Resolving D1 is out of scope. Do not modify the Phase 1 usage stream or the Phase 3 loop core beyond reading them and emitting the new signal.
