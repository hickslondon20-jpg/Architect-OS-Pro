# Execution Agent Brief — Phase 1: Foundations (Model Routing & Tagged Usage Events)

You are the Execution Agent for **Phase 1** of the Advanced Tool Calling build in ArchitectOS Pro. You implement this phase's code. You do not re-plan it and you do not start other phases. Work only within the scope below.

## Read these before writing any code (in order)

1. `.planning/tool-calling/CONTEXT.md` — the build's rationale and the 11 decisions you must not override.
2. `.planning/tool-calling/ROADMAP.md` — Phase 1 goal, dependencies, success criteria.
3. `.planning/tool-calling/phases/01-foundations-model-routing-usage-events/01-RESEARCH.md` — the live-verified state of the code and schema. **Trust it, but re-verify anything you're about to change** — this repo's discipline is "never consider a report confirmed until independently re-verified."
4. This phase's `CONTEXT.md`, then `01-01-PLAN.md` and `01-02-PLAN.md`.
5. Canonical: `.planning/INTELLIGENCE-LAYER-EPISODE-MAP.md` §3.4 (metering) and §3.5 / L12 (model routing). These win over the reference PRD.

## What you are building

Two tightly-related substrates every later phase depends on:

- **01-01 — Model routing:** wire the *already-existing* capability→model seam (`platform_ai_settings` + `resolve_platform_model` + `agent_capabilities.model_setting_key`) so sub-agents and utility jobs resolve their model through the registry, with the **primary Claude chat untouched** and **current behavior preserved** (rows point at today's default; the resolver fails open).
- **01-02 — Tagged usage events:** extend `ai_usage_log` in place with a `role` tag (`main`/`sub_agent`/`utility`) + provider (+ ledger-ready fields), tag the existing `chat.ts` `main` insert, and emit tagged events for every sub-agent and utility model call across the Python backend — one stream, not two systems.

## Hard constraints (do not violate)

- **Primary conversation/orchestration model stays Claude, locked.** No per-thread model switching, no user-facing model dropdown. Cheap/specialized models appear only inside sub-agents and utility jobs — never in the tool-calling loop's call/interpret decision.
- **Additive and backward-compatible only.** `ai_usage_log` is extended in place (`role` defaults `'main'`); the existing `chat.ts` insert must keep working. Do not create a parallel usage table.
- **Default runtime behavior must not change on deploy.** Seed capability model rows pointing at the current default model; rely on `resolve_platform_model`'s fail-open behavior so nothing changes until a row is deliberately edited.
- **No ledger, no pricing engine, no quotas, no account-level %.** This phase produces correctly-tagged raw events only. Degradation % is Phase 6.
- **Usage logging is best-effort** — a logging failure must never break the underlying model call.
- **Reuse before creating.** The tables, resolver, and column all exist — extend and wire them; don't rebuild.

## Resolved by London (2026-07-02) — do not re-ask

- **Claude version: standardize on `claude-sonnet-4-6`.** Add an `anthropic/claude-sonnet-4-6` `ai_models` row (only `4-5` exists today), point capability settings + `config.py` default + `chat.ts` at it, and wire `chat.ts` to resolve its model from the `vcso_chat` setting row (Claude-locked, no user UI, non-anthropic falls back to Claude). This is an interim hardcode of the standard; a future, separately-scoped **admin settings** area (admin login, global config, per-feature model dropdowns, usage/leader viewing) will turn it into an admin-chosen value writing to `platform_ai_settings` — so keep every model choice table-resolved now, additive later.

## Still to confirm with London before finalizing

- **Seed breadth:** all 7 active experimental capabilities, or only the invoked-today ones? Lean: all active, pointed at `claude-sonnet-4-6`.
- **Cost columns now vs. with the ledger:** lean is `role` + `provider` now, nullable `cost_usd`, population deferred.

## Done when

1. All Phase 1 success criteria in `ROADMAP.md` are met and each is independently verified (not just reported).
2. Migration(s) applied to the live Supabase project `pwacpjqkntnovndhspxt` and verified by direct query: capability `platform_ai_settings` rows present; `ai_usage_log` has `role` (defaulted/checked) + new tags; existing rows and RLS intact.
3. Sub-agent services resolve their model via `model_setting_key` (verified by reading the code and by confirming a row edit changes the resolved model with no code change); default behavior unchanged.
4. `chat.ts` main insert tagged `role='main'`; Python sub-agent and utility calls emit tagged events via one shared helper.
5. Both reconstruction queries pass: degradation filter (`role='main'` + thread) and ledger sum (all roles by user/window).
6. `python -m compileall python-backend` clean; `npm run build` (or the focused TypeScript check) clean for `chat.ts`. Any live-smoke gaps (missing env/creds in your checkout) are flagged honestly, not glossed.
7. `Pro-Suite-Progress.md` updated with a Phase 1 completion entry, and this phase's `STATE`/notes updated per standing process.

## Explicitly out of scope for you

The unified tool registry (Phase 2), the VCSO tool loop (Phase 3), the sandbox bridge (Phase 4), MCP (Phase 5), the degradation UI/compaction (Phase 6), and interleaved history (Phase 7). If you find yourself designing any of those, stop — you've left Phase 1.
