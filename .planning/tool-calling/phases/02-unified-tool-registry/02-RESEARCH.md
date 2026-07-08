# Phase 2 Research — Unified Tool Registry & `tool_search`

**Verified:** 2026-07-03, against the live repo and Supabase project `pwacpjqkntnovndhspxt`.
**Discipline:** every claim checked against actual code / live query. Phase 1's routing + tagged-usage substrate is live and is inherited, not rebuilt (see `phases/01-.../COMPLETION.md`).

---

## What exists today (the real starting point)

### There is no tool registry
`grep` across `python-backend/` for `ToolRegistry` / `tool_registry` / `tool_catalog` / `register_tool` / `tool_search` / `build_rag_tools`: **zero matches.** The reference PRD's premise ("replace the static registry") does not describe us — we have *no* registry to replace. We have hardcoded per-sub-agent tool lists.

### Tools are hardcoded lists, in Anthropic format, per sub-agent
- `services/kb_explorer_service.py` → `KB_EXPLORER_TOOLS` (8 tools: `kb_ls/kb_tree/kb_grep/kb_glob/kb_read` + `wiki_search/wiki_get_page/wiki_list`).
- `services/sandbox_execution_service.py` → `SANDBOX_EXECUTION_TOOLS` (2 tools: `execute_code`, `read_skill_file`).
- Each is a Python `list[dict]` in **Anthropic tool shape** — `{"name", "description", "input_schema": {...JSON Schema...}}` — passed straight to `self.anthropic_client.messages.create(tools=..., ...)`. **Not** OpenAI `{"type":"function","function":{...,"parameters":{...}}}` shape.
- Dispatch is a hardcoded `if tool_name == "...":` chain inside each service's `_execute_tool`.

### Capability → handler dispatch is a second hardcoded chain
`services/sub_agent_orchestrator.py` `start_run()` routes `capability_key` through an `if/elif` chain (lines ~87–100) to `_handle_document_analysis` / `_handle_kb_explorer` / `_handle_sandbox_execution` / etc. Each handler constructs its service and runs that service's own tool loop.

### The authorization list already exists — it's just declarative
- `agent_capabilities.allowed_tools` names the tools each capability may use (verified live: e.g. `kb_explorer_agent` → `[kb_ls, kb_tree, kb_grep, kb_glob, kb_read]`; `sandbox_execution_agent` → `[execute_code, read_skill_file]`).
- `agent_capabilities.allowed_surfaces` names the surfaces each capability serves.
- The orchestrator even writes an `allowed_tools_snapshot` into the run record (line ~190).
- **But nothing enforces `allowed_tools` against an actual tool catalog** — the service just uses its own hardcoded list, which happens to match. So the authorization boundary is *named* but not *resolved*.

### Skills are load-by-body, not call-by-function
`skill_packs` live columns (verified): `id, slug, name, description, skill_kind, domain, trigger_tags[], body, status, version, required_platform_context[], output_contract, writeback_rules, user_id, scope, requires_sandbox`. A skill is "invoked" by injecting its `body` into the prompt (Ep4 progressive disclosure), **not** by executing a function. `name`/`description`/`trigger_tags` are already enough to build a catalog entry.

---

## What this means for the Phase 2 design

1. **This is mostly a Python module, not a migration.** Native tools are code; skills are `skill_packs` rows; MCP is future/empty. Reuse-before-creating → **no new user-data table is required** to hold the catalog; an in-process registry populated from these sources is the right shape. (A tiny metadata addition is possible but should be justified, not assumed.) Contrast Phase 1, which was migration-led.

2. **"Neutral OpenAI-compatible schema" is a thin wrapper concern.** Anthropic `input_schema` and OpenAI `parameters` are both JSON Schema — the payload is identical; only the envelope differs (`{name, description, input_schema}` vs `{type:'function', function:{name, description, parameters}}`). Store the neutral core (`name`, `description`, `json_schema`) once and provide **two adapters**: Anthropic (what the live Claude loops consume — the primary path) and OpenAI (utility-model interop). Do not overbuild this.

3. **Two executor kinds must coexist in one registry.** A native tool has a **callable** executor (`execute_code` → sandbox, `kb_grep` → nav service). A skill entry's "execution" is **load its `body` into context**. MCP tools (future) execute via an MCP client. The `ToolDefinition` needs a `source` discriminator (`native`/`skill`/`mcp`) and an executor abstraction that covers "call a function" and "return instructions to load."

4. **D1-neutral is achievable cleanly because the pieces already separate.** `agent_capabilities` = the *authorization* list (`allowed_tools` + `allowed_surfaces`). The registry = *definitions + discovery*. A thin resolver maps `capability.allowed_tools` → registry `ToolDefinition`s and computes a surface subset. Keep the scoping source **injected**, not hardcoded: the registry must be able to derive a surface subset *from* `agent_capabilities` (the "two layers" outcome) **or** hold its own surface tags (a step toward "one registry"), without either being wired in as the only path. Do not fuse them; do not make the registry ignore `agent_capabilities`.

5. **Citation-readiness is a result-envelope contract, not UI.** KB tools already return source identity (kb_read returns `document_id` + `name` + content; the service tracks `referenced_doc_ids`/`referenced_doc_names`). Phase 2 defines a standard result envelope carrying source identity + verbatim text where applicable; tools that don't produce source-grounded data (`execute_code`) carry provenance = the code/computation. Full citation UI is Ep7 — this phase only makes results *carry* what Ep7 will render.

6. **Proving the registry without rewriting the loops.** The VCSO tool loop is Phase 3. To avoid a "registry nobody uses," Phase 2 should fold the existing native tools in and have the current sub-agent services **source their tool lists from the registry** (via the Anthropic adapter) — **behavior-preserving** (same tools, same schemas, same order, same dispatch results). That is the acceptance proof that the neutral schema round-trips to the live Anthropic format and that `allowed_tools` now resolves against a real catalog.

---

## Landmines / things to get right

- **Primary loop is Claude/Anthropic.** The registry's canonical output for the live loops is the **Anthropic** adapter. OpenAI format is for utility-model interop only. Don't invert this and make everything OpenAI-first and adapt to Anthropic as an afterthought — the hot path is Anthropic.
- **Do not rewrite the Phase 3 loop here.** Phase 2 builds the registry + `tool_search` + subsetting + result contract and folds existing tools in behavior-preservingly. The VCSO *discovering and calling* tools mid-thread is Phase 3. If you find yourself changing `chat.ts`'s generation flow, you've left Phase 2.
- **Skill entries are not callables.** Don't force skills into a function-executor mold; the registry must represent "load this body" as a first-class executor kind.
- **`tool_search` is a registry function + meta-tool definition, consumed later.** Build it and unit-test it in Phase 2; it becomes live when the Phase 3 loop calls it. Its own definition is a native registry tool.
- **Keep dispatch reconciled, not doubled.** There are already two `if/elif` chains (per-service tool dispatch + orchestrator capability dispatch). Adding a registry should *reduce* duplication (a tool's executor lives with its definition), not add a third parallel chain. But refactoring the orchestrator's capability dispatch is D1-adjacent — keep that change minimal and behavior-preserving so D1 stays open.
- **Inherit Phase 1, don't re-touch it.** Model routing + tagged usage events are live; any LLM-powered registry tool (e.g. `tool_search` if it ever uses a model — it should not need to) and any new sub-agent must emit tagged usage via the existing `usage_events.py` helper. `tool_search` should be pure retrieval (regex/keyword over the catalog), no model call.

---

## Verification method (for the record)

- Read: `services/kb_explorer_service.py`, `services/sandbox_execution_service.py` (full), `services/sub_agent_orchestrator.py` (dispatch), `services/agent_capabilities.py`.
- `grep` `python-backend/` for any existing registry/catalog/tool-search construct → none.
- Live Supabase: `skill_packs` column list; `agent_capabilities.allowed_tools`/`allowed_surfaces` (from Phase 1 pass).
