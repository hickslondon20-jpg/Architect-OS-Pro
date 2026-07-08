# Phase 1 Context — Foundations: Model Routing & Tagged Usage Events

**Phase:** 01 (foundations) of the Advanced Tool Calling build.
**Read first:** the build-level `CONTEXT.md` and `ROADMAP.md` in `.planning/tool-calling/`, this phase's `01-RESEARCH.md`, and the canonical `INTELLIGENCE-LAYER-EPISODE-MAP.md` §3.4 (metering) + §3.5/L12 (model routing). Where the reference PRD conflicts with those, the canonical docs win.

---

## Why this phase is first

Everything downstream assumes two substrates exist and are trustworthy: (1) a way to choose *which model* runs a given capability/utility job without touching the Claude-locked primary chat, and (2) a single tagged usage-event stream that both the per-thread degradation signal (Phase 6) and the future metering ledger read from. Both substrates already exist in embryo — the model-settings registry and `ai_usage_log` — so this phase is **extend-and-wire, not greenfield.** Getting it right first means Phases 2–7 emit correctly-tagged events and route models the moment they add new sub-agents and tools, instead of being retrofitted later.

## What this phase is

- **Wire the existing routing seam for sub-agents.** Seed `platform_ai_settings` rows for the active `agent_capabilities`, and make the sub-agent services resolve their model through their capability's `model_setting_key` (via the already-live `resolve_platform_model`), fallback-preserving current behavior.
- **Extend `ai_usage_log` into one tagged stream.** Add `role` (`main`/`sub_agent`/`utility`) + provider + ledger-ready fields, additively; emit events from the Python backend for sub-agent and utility model calls; tag the existing `chat.ts` insert as `role='main'`.

## What this phase is NOT

- **Not a model-agnostic primary chat.** The conversation/orchestration model stays **Claude, locked** (L12). No per-thread switching, no dropdown. Per-capability/utility routing is the *only* place non-Claude models appear, and never in the tool-calling loop.
- **Not the metering ledger.** No account-level %, no quotas, no rolling-window enforcement, no tier economics. This phase only produces the correctly-tagged raw events those will later consume. (Degradation % itself is Phase 6.)
- **Not a pricing/cost engine.** `cost_usd` may exist as a nullable column for ledger-readiness, but no per-model price map is built here — tokens + model + provider are the ledger's raw material.
- **Not a schema replacement.** `ai_usage_log` is extended in place (additive, backward-compatible), not superseded by a new events table. Reuse-before-creating (build `CONTEXT.md` governing principle 2).

## Decisions that shape this phase (do not override)

1. **Default behavior must not change on deploy.** Seeding a `platform_ai_settings` row is what *activates* a capability's routing; `resolve_platform_model` already fails open to `claude_synthesis_model`. Seed the active capabilities pointing at the current model so behavior is identical until someone deliberately changes a row.
2. **`role` defaults to `'main'`.** The existing `chat.ts` insert keeps working unchanged; it's updated to set `role='main'` explicitly, but the default guarantees no regression if any writer is missed.
3. **One event stream, two languages.** The `main` call is logged in TypeScript; `sub_agent`/`utility` calls are logged in Python. Add a small Python usage-logging helper that writes the same extended `ai_usage_log` shape — not a parallel table, not a second pipeline.
4. **The tool-calling loop is Claude.** When Phase 3 builds the loop, the call/interpret decisions are the Claude orchestration model. Cheap models this phase enables are for sub-agents' *internal* work and utility jobs only. Nothing here should make it possible to route the loop itself onto a cheap model.
5. **Ledger-ready shape is the acceptance bar for events**, not a working ledger. Every model call, everywhere, must be reconstructable later into per-user/per-window cost by `role` — that is the test, even though the ledger isn't built.

## Forward-compatibility: the future admin settings area

Model selection is table-driven (`platform_ai_settings`) by design. A separately-scoped, **deferred admin settings area** (admin login, global settings/config, per-feature model-version dropdowns, leader/usage viewing) will write to that table. This phase's job is to make every model choice *resolve from the table* so the admin panel later is additive UI — not a schema or wiring change. This mirrors how Ep4 designed global skill scope so its admin panel could arrive additively. Concretely: standardize on `claude-sonnet-4-6` now as an interim hardcode of the "current standard," but resolve it through `platform_ai_settings` (including wiring `chat.ts` to read `vcso_chat`) so the admin dropdown replaces the seed value later without touching code.

## Open items to resolve at this phase's build-planning (flag, don't silently pick)

- **Claude version — RESOLVED (London, 2026-07-02): `claude-sonnet-4-6`.** Add an `anthropic/claude-sonnet-4-6` `ai_models` row, standardize `config.py` + capability settings + `chat.ts` on it. Interim hardcode of the standard; the future admin settings area makes it an admin-chosen value in `platform_ai_settings`.
- **Wire `chat.ts` to read `vcso_chat` from the registry — RESOLVED: do it**, as the forward-compat seam for the future admin model dropdown. Claude-locked, no user UI, non-anthropic values fall back to the Claude default.
- **Which capabilities get seeded rows now** — all seven active experimental capabilities, or only the ones actually invoked today (`kb_explorer_agent`, `sandbox_execution_agent`)? Lean: seed all active ones pointing at `claude-sonnet-4-6` so the seam is uniformly live; confirm at build-planning.
- **Cost fields now vs. later** — add nullable `cost_usd`/`provider` now for ledger-readiness, or add only `role` and let the ledger pass add cost columns. Lean: add `role` + `provider` now (cheap, high-value tags) and a nullable `cost_usd`; leave population to the ledger.

## Success criteria (from ROADMAP.md Phase 1)

1. Per-capability/utility model selection resolves through the model-settings registry; primary conversation model stays Claude with no per-thread switching path.
2. A sub-agent, an LLM-powered tool, and a utility job can each be pointed at a different model via config, without touching the chat model.
3. Every model call emits one usage event tagged `user`, `thread`, `surface`, `model`, `role` — one stream extending `ai_usage_log`, not a parallel table.
4. The event shape is ledger-ready: account-level metering and quotas computable later with no re-plumbing.
5. The tool-calling loop is confirmed to run on Claude (cheap models never make the call/interpret decision).
