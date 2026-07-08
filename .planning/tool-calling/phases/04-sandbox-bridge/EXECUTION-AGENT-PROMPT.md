# Execution Agent Brief — Phase 4: Sandbox Bridge / Code Mode (exec-channel)

You are the Execution Agent for **Phase 4** of the Advanced Tool Calling build in ArchitectOS Pro. You implement this phase's code. You do not re-plan it and you do not start other phases.

## Read these before writing any code (in order)

1. `.planning/tool-calling/CONTEXT.md` — the build's rationale and the 11 decisions you must not override.
2. `.planning/tool-calling/ROADMAP.md` — Phase 4 goal, dependencies, success criteria.
3. `phases/01-.../COMPLETION.md`, `phases/02-.../COMPLETION.md`, `phases/03-.../COMPLETION.md` — the live substrate you **inherit** (routing + tagged usage; registry + `tool_search` + scoped catalog + citation envelopes; the VCSO loop that reaches the sandbox via `delegate_to_sub_agent`). Do not rebuild these.
4. `phases/04-sandbox-bridge/04-RESEARCH.md` — the live-verified sandbox control plane and the exec-channel-vs-HTTP fork. **Trust it, but re-verify anything you're about to change.**
5. This phase's `CONTEXT.md`, then `04-01-PLAN.md` (bridge core) and `04-02-PLAN.md` (integration).
6. Canonical: `INTELLIGENCE-LAYER-EPISODE-MAP.md` §4 Ep5 + §3.1. Wins over the reference PRD.

## What you are building

Extend the GKE sandbox so LLM-generated Python can call **registry** tools in one execution — via an **exec-channel bridge (Option B, decided)**, not the reference's HTTP bridge:

- **04-01** — the bridge core: an in-pod `tool_client` + typed stubs (stdlib, file protocol), a host-side fulfiller that executes registry tools with real credentials and returns results into the pod, concurrency via a `run_with_bridge` poll loop over the K8s exec channel, and a deny-all-egress NetworkPolicy.
- **04-02** — integration into the existing `sandbox_execution_service` path: a session-scoped read/compute-only catalog, routing through `run_with_bridge`, shared across Virtual CSO (via the Phase 3 loop) and Domain Agents, with curated trace persistence.

## Hard constraints (do not violate)

- **Exec-channel bridge only (Option B).** The pod writes a tool-request file and blocks; the host fulfils it over the K8s exec channel and writes the response file. **No inbound/outbound pod networking, no HTTP bridge, no session tokens, no `host.docker.internal`.**
- **Zero network egress on the sandbox pod.** Apply a deny-all egress NetworkPolicy; the pod needs no network. Verify Autopilot honors it.
- **Credentials stay host-side.** The fulfiller uses the service-role Supabase client + registry executors; the in-pod stubs are stdlib file I/O only and never see credentials.
- **How, not which.** The per-session catalog = `registry.get_tools(surface/capability)` filtered to **read/compute tools only**. **Never expose `execute_code` to itself** (recursion) or any **KB-write** tool (one-writer, architecture §5). Enforce host-side.
- **Results carry the Phase 2 citation envelope** into the pod (source_kind/source_id/verbatim).
- **Additive + zero-overhead.** Plain `execute_code` with no tool calls behaves exactly as before. Do not regress the Ep4 sandbox, session persistence, or artifact production.
- **Shared, not VCSO-only.** The scoped catalog derives from the invoking surface/capability so Domain Agents inherit the bridge later — no VCSO-specific or Domain-Agent-specific bridge code.
- **D1 stays open.** Use the Phase 2 swappable scope resolver (Phase 3 wired the registry-native option); don't fuse or hardcode.
- **Curated trace only (L11).** Code Mode tool calls surface as curated steps via `agent_delegation_runs`/`steps`; never raw payloads/code.

## Confirm with London at checkpoint (do not silently decide)

- **Exposed tool allowlist** — the exact read/compute subset callable from Code Mode. Lean: KB navigation/read + wiki reads + structured query; exclude `execute_code`, exclude all writes.
- **Always-bridge vs. gated** — route all `execute_code` through `run_with_bridge` (fine if truly zero-overhead) vs. gate Code Mode per run.
- **NetworkPolicy on Autopilot** — confirm deny-all egress applies cleanly; whether DNS must be allowed (should not).
- **Poll interval / max tool calls / timeout** for the host fulfilment loop.

## Done when

1. All Phase 4 success criteria in `ROADMAP.md` (reconciled to Option B) are met and independently verified.
2. In-pod `tool_client` + typed stubs call registry tools over the file protocol; the host fulfiller executes them host-side with credentials and returns results — one execution, multiple tool calls, no per-tool inference round-trip.
3. Scoped catalog enforced host-side (out-of-catalog / `execute_code` / KB-write rejected); pod holds no credentials and has zero egress; results carry the citation envelope.
4. `sandbox_execution_service` computes the scoped catalog and routes through `run_with_bridge`; the no-tool path is unchanged; a VCSO turn triggers a working Code Mode run.
5. Bridge is shared (catalog derives from invoking surface/capability); Code Mode tool calls persist as curated trace steps.
6. Standalone harness + `python -m compileall python-backend` clean; live GKE end-to-end smoke run or the gap flagged honestly (missing GCP/Anthropic creds).
7. `Pro-Suite-Progress.md`, `.planning/tool-calling/ROADMAP.md`, `.planning/tool-calling/STATE.md` updated and a `phases/04-sandbox-bridge/COMPLETION.md` evidence summary written.

## Explicitly out of scope for you

MCP (Phase 5 — MCP tools become bridge-callable once they're registry citizens; you expose only current native read/compute tools), the degradation UI (Phase 6), interleaved-history rendering (Phase 7). The HTTP-bridge option (A) is out of scope — Option B only. Resolving D1 is out of scope — keep it open.
