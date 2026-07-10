# Phase 1 Research — Foundations: Model Routing & Tagged Usage Events

**Verified:** 2026-07-02, against the live repo and the live Supabase project `pwacpjqkntnovndhspxt`.
**Discipline:** every claim below was checked against actual code or a live query — not inferred from the reference PRD or the canonical docs. This is the "verify before assuming" pass the build methodology requires.

---

## What already exists (do not rebuild)

### Model-settings registry — tables + resolver are live
- **`public.ai_models`** (migration `005_metadata_extraction.sql`): `provider`, `model_name`, `display_name`, `model_family`, `capabilities[]`, `cost_tier` (`low`/`standard`/…), `is_active`, `notes`. Unique on `(provider, model_name)`. Seeded rows: `openai/text-embedding-3-small`, `openai/gpt-4o-mini`, `anthropic/claude-sonnet-4-5` (the last noted "registry awareness only; Virtual CSO chat remains on the existing Claude/Vercel boundary").
- **`public.platform_ai_settings`**: `setting_key` (PK), `model_id` (FK → `ai_models`), `fallback_model_name`, `provider`, `is_enabled`, `settings` jsonb. **Live rows (5):** `ingestion_embeddings`, `ingestion_metadata_extraction`, `retrieval_reranker` (disabled), `vcso_chat` (`settings.boundary = vercel_vcso_chat`), `web_search_fallback` (disabled).
- **Resolver:** `VectorStore.resolve_platform_model(setting_key, fallback_model_name, fallback_provider)` and `resolve_platform_setting(...)` in `python-backend/services/vector_store.py` (lines ~288–349). They read `platform_ai_settings` joined to `ai_models`, and **fail open to the fallback** on any error or missing row. This is the runtime routing mechanism — it works today.
- **Consumer that actually uses it:** `MetadataExtractor.extract()` (`services/metadata_extractor.py`) calls `resolve_platform_model("ingestion_metadata_extraction", ...)`. This is the *only* place a capability-style key drives model selection at runtime today.

### Capability model-routing hook exists on every capability
- **`public.agent_capabilities.model_setting_key`** column is present and populated. Live capabilities and their `model_setting_key` (all set equal to the capability_key):
  - Experimental (active): `document_analysis_agent`, `structured_data_agent`, `kb_explorer_agent`, `sandbox_execution_agent`, `per_user_wiki`, `per_user_document_wiki`, `global_ip`.
  - Disabled: `metadata_review_agent`, `retrieval_evidence_agent`, `sprint_planning_helper`, `strategy_synthesis_agent`.
- `agent_capabilities.py`'s dataclass carries `model_setting_key`; the fallback list sets it per capability.

### Usage logging — exists, but only for the main chat call
- **`public.ai_usage_log`** live columns: `id`, `user_id` (not null), `surface`, `model`, `input_tokens`, `output_tokens`, `thread_id`, `created_at` (default now()), `skill_id`. **No `role`, no `provider`, no cost, no capability/run linkage.**
- **Only writer:** `api/vcso/chat.ts` inserts one row per Virtual CSO turn (`surface: 'ws5-chat'`, `model: MODEL`, token counts, `thread_id`, `skill_id`). This is the `main` orchestration call.

---

## The actual gaps this phase closes

1. **The routing seam is declared, not wired, for sub-agents and their utility calls.**
   - `kb_explorer_service.py` sets `self.model = settings.claude_synthesis_model` (hardcoded env default `claude-sonnet-4-5`). It does **not** resolve via its capability's `model_setting_key`.
   - The sandbox execution agent (`sandbox_execution_service.py`) follows the same pattern.
   - **No `platform_ai_settings` rows exist for any `agent_capabilities.model_setting_key`** (`kb_explorer_agent`, `sandbox_execution_agent`, etc.). So even though the column and resolver exist, the capability→model path resolves to nothing and every sub-agent silently uses the one hardcoded synthesis model.
   - → ROUTE-01/02: seed `platform_ai_settings` rows for the active capabilities and wire the sub-agent services to resolve their model through `resolve_platform_model(capability.model_setting_key, fallback=claude_synthesis_model)`. Fail-open behavior already built into the resolver means this changes *nothing* until a row is added — safe by construction.

2. **Sub-agent and utility model calls emit no usage events.**
   - `grep` across `python-backend/` for `ai_usage_log`/`usage_log`/`log_usage`: **zero hits.** Metadata extraction, embeddings, KB Explorer's internal loop, sandbox agent, doc-wiki synthesis — none write usage events.
   - `ai_usage_log` has no `role` column, so even the main call can't be distinguished from (future) sub-agent/utility rows.
   - → METER-01: add the `role` tag (+ provider, cost-ready fields) additively to `ai_usage_log`; emit events from the Python backend for `sub_agent` and `utility` calls; tag the existing `chat.ts` insert as `role='main'`.

---

## Landmines / things to get right

- **Claude version mismatch — RESOLVED (London, 2026-07-02): standardize on `claude-sonnet-4-6`.** `config.py` `claude_synthesis_model` defaults to `claude-sonnet-4-5`, the `ai_models`/`platform_ai_settings` seed says `claude-sonnet-4-5`, but `api/vcso/chat.ts` uses `MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'`. Resolution: add an `anthropic/claude-sonnet-4-6` `ai_models` row (only `4-5` exists today), and point `config.py` + capability settings + `chat.ts` at `4-6`. The future admin settings area (deferred, separately scoped) will make the version an admin-chosen value in `platform_ai_settings`.
- **`resolve_platform_model` fails open.** This is a feature: seeding a capability row is what activates routing; absence = current behavior. Preserve that — do not make a missing row throw.
- **Two languages, one event stream.** The `main` call is logged in TypeScript (`chat.ts`); `sub_agent`/`utility` calls happen in Python. Both must write the same extended `ai_usage_log` shape. Needs a small Python usage-logging helper mirroring what `chat.ts` already does — not a second table.
- **Additive only.** `ai_usage_log` changes must be backward-compatible: `role` defaults to `'main'` so the existing `chat.ts` insert keeps working unchanged until it's updated to set the tag explicitly.
- **Cost is not computable yet.** `ai_models.cost_tier` is a coarse label (`low`/`standard`), not $/token. Ledger-readiness means carrying `model`+`provider`+`tokens`+`role`+`created_at` now; a nullable `cost_usd` can exist but stays null until a real price map lands (deferred with the ledger). Do not build a pricing table this phase.
- **`vcso_chat` setting is "boundary awareness only" today.** `chat.ts` reads its own env, not `platform_ai_settings`. **Resolved (London, 2026-07-02): wire `chat.ts` to resolve from the `vcso_chat` setting** as the forward-compat seam for the future admin model dropdown — Claude-locked, no user UI, non-anthropic values fall back to the Claude default.

---

## Verification method (for the record)

- Read: `python-backend/core/config.py`, `services/vector_store.py` (resolver), `services/metadata_extractor.py`, `services/kb_explorer_service.py`, `docs/migrations/005_metadata_extraction.sql`, `api/vcso/chat.ts`.
- `grep` `python-backend/` for usage-logging and `model_setting_key`/`platform_ai_settings` consumers.
- Live Supabase queries (`pwacpjqkntnovndhspxt`): `ai_usage_log` column list; `platform_ai_settings` rows; `agent_capabilities.model_setting_key` values.
