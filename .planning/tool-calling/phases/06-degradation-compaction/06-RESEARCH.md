# Phase 6 Research — Degradation Signal & Compaction

**Verified:** 2026-07-03, against the live repo (`vcso_chat_service.py`) and Supabase project `pwacpjqkntnovndhspxt`.
**Inherits:** Phase 1 (the tagged `ai_usage_log` stream, `role='main'`) and Phase 3 (the VCSO loop that defines the main window). Both live. Independent of Phase 5 (MCP).

---

## How the main window actually fills (the load-bearing finding)

`vcso_chat_service.stream_chat` → `_build_context`:
- Assembles context **fresh each turn** into a single prompt: `messages = [{"role":"user","content": context["prompt"]}]`. The prompt is built from founder wiki pages, `_load_recent_messages` (a **bounded** recent-message window, ported from `chat.ts`'s last ~8), `_load_prior_tool_results`, skill bodies, IP pages, etc.
- The tool loop then **appends within the turn**: each round appends `{"role":"assistant", content}` + `{"role":"user", tool_results}` to `messages`, across up to `max_rounds` (5). A final `messages.stream(...)` call writes the answer.
- Usage is captured per round (`input_tokens`) and as `final_usage_input` from the final stream, logged `role='main'` (Phase 1).

**Consequences for the degradation signal:**
1. The VCSO does **not** append full conversation history turn-over-turn — it re-assembles a bounded context each turn. So "% remaining before degradation" is **not** primarily driven by conversation length.
2. What fills the main window: the assembled context (founder pages + prior tool results + skill bodies + IP pages) **plus** in-turn tool-result accumulation across loop rounds. A heavy tool-use turn (many KB reads, wiki pages, computation outputs) is what pushes fullness.
3. The right measure is the **peak `role='main'` `input_tokens` for the turn** (the final/largest prompt the model saw) ÷ the model's context window — exactly the reference's "track the last round's `prompt_tokens`," and it's already captured in `ai_usage_log`.

**Consequences for compaction:**
- Classic "summarize the oldest messages so a growing append-list still fits" is a weaker fit — we don't keep a growing append list across turns.
- Useful compaction here = keep the **freshly-assembled per-turn context lean**: summarize/condense `_load_prior_tool_results` and older thread content (recent-message contents) so the assembled prompt's `input_tokens` stays well under the window. It reclaims context; it does **not** refund cost (L13).

## The model context window value is not stored yet

`ai_models` columns (live): `id, provider, model_name, display_name, model_family, capabilities[], cost_tier, is_active, notes, created_at, updated_at`. **No `context_window`.** So Phase 6 must source the window:
- **Lean: add `context_window integer` to `ai_models`**, seed Claude Sonnet 4-6's window, and read it via the model registry (`resolve_platform_model`/`platform_ai_settings`). This matches Phase 1's "read the window from the registry as hygiene" and the admin-panel-forward-compat philosophy (a future admin dropdown can adjust it). A config/env default is the fallback if a row is missing.

## Degradation vs. metering is already cleanly separable (L13)

Phase 1 tags every event `role` (`main`/`sub_agent`/`utility`). **Degradation reads `role='main'` only** for the current thread — sub-agent internal usage is excluded by construction (it runs in isolated windows; only compact returns re-enter the main window). Metering (deferred ledger) sums all roles. Phase 6 touches only degradation.

## Account-level % is deferred (confirmed)

Per §3.4 and the build decisions: Phase 6 ships **per-thread %** only. Account-level "% of weekly/rolling-window allotment" waits on the metering ledger; Phase 1's tagged events are already ledger-ready, so it adds later without re-plumbing. Do not build the ledger, quotas, or tier economics here.

## What Phase 3 already streams (the wiring point)

Phase 3's SSE vocabulary is `ready` / `step` / `tool_call` / `tool_result` / `token` / `done` / `error`, and `done` carries usage. Phase 6 adds the per-thread % signal — compute peak main `input_tokens` ÷ window, emit it (a `usage`/`context` event, or extend `done`), and render a slim **% -remaining** bar. Users see **percentages, not raw tokens** (§3.4). Color thresholds (from the reference, expressed as remaining): green ≥ ~40% remaining, amber ~20–40%, red < ~20% (i.e. 0–59/60–79/80–100 consumed). Per-thread; resets on thread switch.

## Landmines / things to get right

- **% not raw tokens/cost** in the UI (§3.4). Internal math uses tokens; the founder sees a percentage.
- **Degradation is `role='main'` only** — do not fold sub-agent or utility usage into the thread fullness signal (that's metering).
- **Compaction reclaims context, not cost (L13)** — the compaction summarization is itself a model call (tag it `role='utility'` via Phase 1) and does not reduce the metered spend of prior turns.
- **Compaction summarization uses the Python direct-Anthropic lane** (a utility model via the model-settings registry), not N8N; tag usage.
- **Reuse before creating** — a thread-level compacted-summary store (a column on `vcso_chat_threads` or a small companion) rather than a new subsystem; `_build_context` consumes it. Confirm the minimal shape at build-planning.
- **Don't confuse compaction with writeback.** `/api/vcso/writeback` synthesizes a thread → feeds OS Engine (institutional memory). Compaction is in-thread context reduction to keep the *current* thread going. Different jobs; don't merge.
- **Inherit, don't re-touch** Phases 1–5. Read the tagged events + registry window; don't modify the usage stream or the loop's core.

## Open items to resolve at this phase's build-planning (flag, don't silently pick)

1. **Window source** — add `context_window` to `ai_models` (lean) vs. config/env default. Lean: registry column + config fallback.
2. **Compaction trigger** — auto at a threshold, founder-initiated ("compact this thread"), or both. Lean: surface the signal + a founder-initiated compaction affordance first; auto-trigger as a follow-on if needed.
3. **Compacted-summary storage** — a `vcso_chat_threads` column vs. a companion row. Lean: a column/JSONB on the thread.
4. **What compaction summarizes** — prior tool results + older message contents (lean), and how aggressively. Confirm the target and threshold.
5. **SSE shape for the signal** — a dedicated `usage`/`context` event vs. extending `done`. Lean: a small dedicated event so it can update independently of turn completion.

## Verification method (for the record)

- Read: `services/vcso_chat_service.py` (`stream_chat`, `_build_context`, `_load_recent_messages`, `_load_prior_tool_results`, per-round + final usage capture).
- Live Supabase: `ai_models` columns (no `context_window`); Phase 1 `ai_usage_log` `role` tagging confirmed in prior passes.
