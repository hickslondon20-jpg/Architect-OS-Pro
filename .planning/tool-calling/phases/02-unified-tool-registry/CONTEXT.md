# Phase 2 Context — Unified Tool Registry & `tool_search`

**Phase:** 02 of the Advanced Tool Calling build.
**Read first:** the build-level `CONTEXT.md` and `ROADMAP.md`; this phase's `02-RESEARCH.md`; the Phase 1 `COMPLETION.md` (the live routing + tagged-usage substrate you inherit); and canonical `INTELLIGENCE-LAYER-EPISODE-MAP.md` §4 Ep5 + §3.1 (capability layer) + §6/D1. Canonical docs win over the reference PRD.

---

## Why this phase, and what it is

Ep5's whole point is that **tools become a shared, discoverable capability layer beneath all three surfaces** instead of hardcoded per-sub-agent lists. This phase builds that layer:

- A **registry** holding tool definitions in a neutral schema with a `source` discriminator (`native` / `skill` / `mcp`), populated from code (native), `skill_packs` (skills, deferred-loaded), and — as a placeholder wired in Phase 5 — MCP.
- **`tool_search`**: a compact catalog (name + one-liner) plus a meta-tool that returns full definitions for matches on demand.
- **Surface- and context-aware subsetting** so every consumer pulls its own scoped subset — never one flat global list.
- A **citation-ready result contract** so tool outputs carry source identity + verbatim text (Ep7 grounds on this).
- Built **D1-neutral** — the registry can wrap or sit beside `agent_capabilities`; neither "one registry" nor "two layers" is foreclosed.

It is **mostly a Python module**, not a migration (native tools are code, skills are `skill_packs`, MCP is future). Reuse-before-creating: do not add a new catalog table unless a genuine metadata need is proven at build-planning.

## What this phase is NOT

- **Not the Virtual CSO tool loop.** VCSO *discovering and calling* tools mid-thread is Phase 3. This phase builds the registry and proves it by folding existing tools in **behavior-preservingly** — it does not change `chat.ts`'s generation flow.
- **Not a resolution of D1.** Keep both "one unified registry" and "two distinct layers" reachable. This is an acceptance criterion, not a nicety.
- **Not the sandbox bridge or MCP client.** The registry gains a `mcp` source *type* (empty), but MCP discovery/credentials are Phase 5 and the bridge is Phase 4.
- **Not the citation UI.** Results *carry* source identity + verbatim text; rendering/clickable citations are Ep7.
- **Not a rewrite of the sub-agent loops' behavior.** They may source their tool lists from the registry, but the tools, schemas, dispatch results, and order stay identical.

## Decisions that shape this phase (do not override)

1. **The primary loop is Claude/Anthropic.** The registry's canonical adapter for the live loops is **Anthropic** (`{name, description, input_schema}`). The neutral core is JSON Schema; an OpenAI adapter (`{type:'function', function:{…, parameters}}`) exists for utility-model interop only. Anthropic is the hot path, not an afterthought.
2. **Two executor kinds are first-class.** A `native` tool has a callable executor; a `skill` entry's "execution" is *load its `body` into context*; an `mcp` tool (future) routes through an MCP client. The `ToolDefinition`/executor abstraction must represent all three without forcing skills into a function mold.
3. **`agent_capabilities` stays the authorization list.** `allowed_tools` + `allowed_surfaces` remain where authorization lives. The registry provides definitions + discovery; a thin, injected resolver maps `capability.allowed_tools` → registry definitions and computes surface subsets. Do not fuse the registry into `agent_capabilities`; do not make it ignore them. (This is how D1 stays open.)
4. **`tool_search` is pure retrieval.** Regex/keyword match over the catalog — no model call. It emits no usage event because it invokes no model. Its own definition is a `native` registry tool that the Phase 3 loop will call.
5. **Behavior-preserving fold-in is the proof, not a rewrite.** Existing sub-agent services sourcing their tool lists from the registry must produce identical tools/schemas/dispatch — verified, not assumed.
6. **Inherit Phase 1; don't re-touch it.** Any LLM-powered work uses the live `usage_events.py` tagging and model-settings routing. `tool_search` needs neither (no model).
7. **Reduce dispatch duplication, don't add to it.** A tool's executor should live with its definition. Any touch to the orchestrator's capability dispatch stays minimal and behavior-preserving so D1 is not accidentally closed.

## The D1-neutral design, concretely (the load-bearing part)

`agent_capabilities.allowed_tools` already names each capability's tools; `allowed_surfaces` names its surfaces; the orchestrator already snapshots `allowed_tools`. So the seam is natural:

- **Registry** owns `ToolDefinition`s keyed by name (source, description, json_schema, executor, citation shape).
- **A resolver** answers "what tools does surface X / capability Y get?" Its *source of truth* is injectable: it can read `agent_capabilities` (→ the **two-layers** outcome, authorization stays in capabilities) **or** consult registry-native surface tags (→ a step toward **one registry**). Build the resolver interface so swapping the source is a one-line change, and ship it reading `agent_capabilities` (the conservative default that keeps today's authorization intact).
- **Never** hardcode "registry == capabilities" or "registry ignores capabilities." That single discipline is what keeps D1 decidable later at build-planning.

## Success criteria (from ROADMAP.md Phase 2)

1. Tool definitions stored in a neutral schema with a `source` discriminator (`native`/`skill`/`mcp`) and an executor abstraction.
2. Ep4 skill packs register as a deferred-loaded source (no parallel skills-only catalog).
3. `tool_search` returns matching tool definitions on demand; non-discovered deferred tools stay out of context.
4. A consumer can request a subset scoped by surface (and, in shape, by phase — for the Ep6 harness); never one flat global list.
5. Tool results carry source identity + verbatim text where applicable (citation-ready), never opaque strings.
6. Demonstrably D1-neutral — can wrap or sit beside `agent_capabilities`; neither outcome foreclosed (documented, not just asserted).

## Open items to resolve at this phase's build-planning (flag, don't silently pick)

- **New table or pure in-process registry?** Lean: in-process, populated from code + `skill_packs`, no new table. Confirm no per-tool metadata need forces a small table.
- **Does the behavior-preserving fold-in touch both sub-agent services now, or just one as proof?** Lean: fold both existing native toolsets (`kb_explorer`, `sandbox_execution`) in, behavior-preserving, since both are small and it proves the neutral-schema round-trip on the real hot path.
- **Citation envelope shape** — align it now with what Ep7 will need (source kind + id + verbatim span), even though Ep7 renders it. Lean: reuse the polymorphic `source_kind`/`source_id` precedent already used by `agent_context_sources`/`artifacts`.
- **Where `tool_search` matching lives** (regex vs. keyword vs. simple ranked) — lean: start with the same trigger-tag/keyword approach `classify()`/`scoreSkill()` already use, so skills and native tools rank consistently.
