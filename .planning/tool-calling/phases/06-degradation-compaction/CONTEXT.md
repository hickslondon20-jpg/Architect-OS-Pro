# Phase 6 Context — Degradation Signal & Compaction

**Phase:** 06 of the Advanced Tool Calling build.
**Read first:** the build-level `CONTEXT.md` and `ROADMAP.md`; this phase's `06-RESEARCH.md`; the Phase 1 & 3 `COMPLETION.md` files (the tagged usage stream + the VCSO loop this phase reads); canonical `INTELLIGENCE-LAYER-EPISODE-MAP.md` §3.4 (metering/degradation/compaction) and L13. Canonical docs win over the reference PRD.

---

## Why this phase, and what it is

The near-term, per-thread half of the §3.4 usage story: show the founder how full *this thread* is before quality degrades, and let a long thread be compacted so it can keep going. It reads the substrate already built — the Phase 1 `role='main'` tagged usage and the Phase 3 loop's main window — and adds a signal + a compaction operation.

- **Per-thread "% remaining before degradation" (DEGRADE-01):** peak `role='main'` `input_tokens` for the turn ÷ the model's context window (from the registry), rendered as a slim **% bar** (percentage, never raw tokens).
- **Context compaction (DEGRADE-02):** condense a long thread's assembled context (prior tool results + older content) so the freshly-assembled prompt stays under the window — reclaiming context, not refunding cost.

## What this phase is NOT

- **Not account-level metering.** Per-thread % only. Account-level "% of weekly/rolling-window allotment," the usage ledger, quotas, and tier economics are all deferred (Phase 1 events are already ledger-ready). Do not build them here.
- **Not a raw token/cost display.** Internal math is tokens; the founder sees a percentage (§3.4).
- **Not sub-agent/utility accounting.** Degradation reads `role='main'` only; sub-agent internal usage is invisible to it (that's metering — L13).
- **Not writeback.** `/api/vcso/writeback` (thread → OS Engine institutional memory) is a different job; compaction is in-thread context reduction to keep the *current* thread going. Do not merge them.
- **Not a change to the usage stream or the loop's core.** Read Phases 1/3; don't re-touch them.

## Decisions that shape this phase (do not override)

1. **Degradation is per-thread and `role='main'` only.** Compute from the current thread's peak main-turn `input_tokens` vs. the model window. Exclude sub-agent/utility usage (L13).
2. **The founder sees a percentage, not tokens or cost.** % remaining, color-coded; per-thread; resets on thread switch.
3. **The window comes from the model registry.** Add `context_window` to `ai_models` (lean) and read it via the registry, with a config default fallback — consistent with Phase 1's registry-as-source-of-truth and admin-panel-forward-compat.
4. **Compaction reclaims context, not cost (L13).** The compaction summarization is itself a model call — run it on the Python direct-Anthropic lane via the model-settings registry and **tag its usage `role='utility'`** (Phase 1). It does not reduce prior turns' metered spend.
5. **Compaction targets the assembled context**, not a growing append-list — summarize prior tool results + older thread content so `_build_context` produces a leaner prompt. (See RESEARCH: the VCSO re-assembles bounded context per turn, so this is the shape that actually helps.)
6. **Reuse before creating.** Store the compacted summary minimally (a `vcso_chat_threads` column/JSONB, lean) and have `_build_context` consume it. No new subsystem.
7. **Inherit Phases 1–5.** The tagged event stream, the registry, and the loop are the substrate; this phase reads and lightly extends them.

## Success criteria (from ROADMAP.md Phase 6)

1. A per-thread "% remaining before degradation" signal is computed from the main orchestration window only (`role='main'` peak `input_tokens` vs. the registry window).
2. Sub-agent internal usage is excluded from the signal (visible to metering, invisible to degradation) — the L13 split holds by construction.
3. Users see a percentage, not raw tokens or cost.
4. Context compaction condenses a long thread so it can continue before degradation; compaction reclaims context and does not refund cost (its summarization call is tagged `role='utility'`).
5. Account-level % is confirmed deferred (not built here); Phase 1 events remain ledger-ready for it.

## Open items to resolve at this phase's build-planning (flag, don't silently pick)

- **Window source** — `context_window` column on `ai_models` (lean) + config fallback vs. config/env only.
- **Compaction trigger** — founder-initiated ("compact this thread"), auto at a threshold, or both. Lean: signal + founder-initiated first; auto as a follow-on.
- **Compacted-summary storage** — thread column/JSONB (lean) vs. companion row.
- **What/how aggressively compaction summarizes** — prior tool results + older message contents; confirm target + threshold.
- **SSE shape** — a dedicated `usage`/`context` event (lean) vs. extending `done`.
