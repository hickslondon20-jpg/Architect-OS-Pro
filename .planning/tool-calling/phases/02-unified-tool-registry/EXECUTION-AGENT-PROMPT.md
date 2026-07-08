# Execution Agent Brief — Phase 2: Unified Tool Registry & `tool_search`

You are the Execution Agent for **Phase 2** of the Advanced Tool Calling build in ArchitectOS Pro. You implement this phase's code. You do not re-plan it and you do not start other phases.

## Read these before writing any code (in order)

1. `.planning/tool-calling/CONTEXT.md` — the build's rationale and the 11 decisions you must not override.
2. `.planning/tool-calling/ROADMAP.md` — Phase 2 goal, dependencies, success criteria.
3. `.planning/tool-calling/phases/01-.../COMPLETION.md` — the live substrate you **inherit** (model routing + tagged usage events). Do not rebuild or re-touch it.
4. `phases/02-unified-tool-registry/02-RESEARCH.md` — the live-verified state. **Trust it, but re-verify anything you're about to change.**
5. This phase's `CONTEXT.md` (especially "The D1-neutral design, concretely"), then `02-01-PLAN.md` and `02-02-PLAN.md`.
6. Canonical: `INTELLIGENCE-LAYER-EPISODE-MAP.md` §4 Ep5, §3.1, §6/D1. These win over the reference PRD.

## What you are building

An in-process tool registry that becomes the shared capability layer beneath all three surfaces:

- **02-01** — registry core (`ToolDefinition` + neutral JSON-Schema + `source` discriminator + executor abstraction), Anthropic/OpenAI adapters, native tools folded in, a `skill_packs`-backed skill source, and `tool_search` (pure retrieval + meta-tool).
- **02-02** — a **D1-neutral** surface/capability scoping resolver, a **citation-ready** result envelope, and a **behavior-preserving fold-in** of the existing sub-agent services so they source tools from the registry with identical behavior.

## Hard constraints (do not violate)

- **This is not the Phase 3 loop.** Do NOT change `chat.ts`'s generation flow or make the Virtual CSO discover/call tools mid-thread. If you're editing the VCSO streaming generation, you've left Phase 2.
- **D1 stays open.** The scoping resolver's source-of-truth must be swappable in one line; ship it reading `agent_capabilities` (authorization stays there). Never hardcode "registry == capabilities" or "registry ignores capabilities." A test must prove both scoping sources work. This is a success criterion (REG-06), not a nicety.
- **Anthropic is the hot path.** The registry's canonical adapter for the live loops is Anthropic (`input_schema`). OpenAI format is utility-interop only.
- **Behavior-preserving fold-in.** After rewiring `kb_explorer_service` and `sandbox_execution_service` to source tools from the registry, they must present the exact same schemas, run the same dispatch, and return the same results as today — verified by comparison/test, not assumed.
- **Reuse, don't create.** No parallel skills catalog (read `skill_packs`). Prefer an in-process registry with no new user-data table; if you believe a table is needed, stop and confirm at checkpoint. Do not add a third dispatch chain — move each tool's executor to live with its definition.
- **`tool_search` makes no model call** and emits no usage event. Skill visibility follows the existing global-or-owner rule.
- **Inherit Phase 1.** Any LLM-powered work (there should be none new here) uses `usage_events.py` tagging and the model-settings routing. Don't re-touch Phase 1 code.
- **Citation envelope, not UI.** Populate `sources` (source_kind/source_id/verbatim) on results; Ep7 renders. Keep it forward-compatible with Ep7's four-tier taxonomy.

## Confirm with London at checkpoint (do not silently decide)

- **In-process registry vs. a small catalog table** — lean in-process/no-table; confirm no per-tool metadata forces one.
- **Fold in both sub-agent toolsets now** (`kb_explorer` + `sandbox_execution`) or just one as proof — lean both (small, proves the round-trip on the real hot path).
- **Citation envelope shape** — align with Ep7's four-tier taxonomy now; lean on the `source_kind`/`source_id` polymorphic precedent (`agent_context_sources`/`artifacts`).

## Done when

1. All Phase 2 success criteria in `ROADMAP.md` are met and each is independently verified (not just reported).
2. Registry module exists with neutral schema + source discriminator + executor abstraction (native-callable, skill-load-by-body, mcp placeholder); `to_anthropic` reproduces the current `KB_EXPLORER_TOOLS`/`SANDBOX_EXECUTION_TOOLS` shapes exactly.
3. Skills register as deferred entries from `skill_packs` (no parallel table, correct visibility); `tool_search` is a pure-retrieval native meta-tool with a capped compact catalog.
4. `get_tools(surface/capability)` returns scoped subsets via a swappable resolver; a test proves both `agent_capabilities`-backed and registry-native scoping — D1 not foreclosed, with the design note written.
5. Tool results carry the citation envelope (`kb_read`/`wiki_*` populate `sources`; `execute_code` carries computation provenance; no opaque strings).
6. `kb_explorer_service` and `sandbox_execution_service` source tools from the registry with identical behavior; the orchestrator capability dispatch is unchanged in behavior.
7. Unit tests pass; `python -m compileall python-backend` clean; `npm run build`/focused TS check clean if any TS touched (it should be minimal to none). Live-smoke gaps (missing env/creds) flagged honestly.
8. `Pro-Suite-Progress.md`, `.planning/tool-calling/ROADMAP.md`, `.planning/tool-calling/STATE.md` updated, and a `phases/02-unified-tool-registry/COMPLETION.md` evidence summary written, per standing process.

## Explicitly out of scope for you

The VCSO tool loop (Phase 3), the sandbox bridge (Phase 4), MCP discovery/credentials (Phase 5 — you add only the empty `mcp` source *type*), the degradation UI (Phase 6), and interleaved history (Phase 7). Resolving D1 in either direction is also out of scope — you keep it open.
