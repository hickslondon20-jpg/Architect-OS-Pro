# Phase 4 Context — Sandbox Bridge / Code Mode (exec-channel)

**Phase:** 04 of the Advanced Tool Calling build.
**Read first:** the build-level `CONTEXT.md` and `ROADMAP.md`; this phase's `04-RESEARCH.md`; the Phase 1–3 `COMPLETION.md` files (live substrate inherited); canonical `INTELLIGENCE-LAYER-EPISODE-MAP.md` §4 Ep5 + §3.1. Canonical docs win over the reference PRD.

---

## The decision that defines this phase (London sign-off, 2026-07-03)

Code Mode is implemented as an **exec-channel bridge (Option B)**, not the reference's HTTP bridge (Option A). Rationale (full detail in `04-RESEARCH.md`): the sandbox is already driven entirely through the Kubernetes exec channel (host writes a command into the pod, reads the result back; Ep4 proved this channel reliable). So instead of the pod making outbound HTTP calls to a host bridge, LLM-generated code calls a tool stub that **writes a tool-call request to a file and blocks; the host — already driving the pod — executes the registry tool host-side with real credentials and writes the result back into the pod; the stub returns it.** This mirrors Anthropic's native "pause-and-return" programmatic tool calling.

Why this shape:
- **Sidesteps GKE pod→host networking entirely** (the flagged Phase 4 unknown) — no `host.docker.internal` analogue, no in-cluster bridge service, no public bridge URL.
- **Strictly more secure** — the pod runs with **zero network egress** (deny-all NetworkPolicy); credentials never enter it *and* it cannot exfiltrate.
- **Reuses the proven control plane** — the exec/base64 channel Ep4 already relies on, not a new networked one.
- **No new auth surface** — inherits the host's existing authenticated K8s-API access to the pod; no session-token issuance/validation.
- **Tradeoff accepted:** a blocking file protocol, not a socket — per-call latency is an exec round-trip. Fine for the founder-data use case (a handful of tool calls per script); not a high-throughput RPC path. Revisit only if a future use case needs high-frequency in-script calls.

## What this phase is

Extend the GKE sandbox so LLM-generated Python running inside it can call **registry** tools programmatically — one sandbox execution orchestrating multiple tool calls instead of N inference round-trips (the "12 P&Ls in a for-loop" case). The bridge is the founder-data security boundary. Shared by Virtual CSO and Domain Agents; wired to the existing sandbox execution path (which the Phase 3 VCSO loop already reaches via `delegate_to_sub_agent`).

## What this phase is NOT

- **Not an HTTP bridge, not pod networking.** Option A is explicitly not built.
- **Not an expansion of *which* tools an agent can reach.** Code Mode changes *how* authorized tools are invoked (a code loop), not *which* — the per-session catalog = the tools the invoking surface/capability is already authorized for. `execute_code` is never exposed to itself (no recursion); no KB-write tool is exposed (one-writer).
- **Not MCP (Phase 5).** MCP tools become bridge-callable once they're registry citizens in Phase 5; this phase exposes the current native read/compute tools.
- **Not a new sandbox.** Extends the Ep4 GKE sandbox + `SandboxService` control plane; no second cluster, no Docker/Podman.
- **Not a resolution of D1.** The scoped catalog uses the Phase 2 swappable resolver (Phase 3 wired the registry-native option); keep it swappable.

## Decisions that shape this phase (do not override)

1. **Exec-channel bridge only.** The runner writes a tool-request file and blocks; the host fulfils it over the K8s exec channel and writes the response file. No inbound/outbound pod networking.
2. **Zero network egress on the sandbox pod.** Apply a deny-all egress NetworkPolicy (the pod needs no network under Option B). Verify GKE Autopilot NetworkPolicy behavior at build-planning.
3. **Credentials stay host-side.** The host-side fulfiller uses the service-role Supabase client + registry executors; the pod's stubs use stdlib file I/O only and never see credentials (BRIDGE-03).
4. **Scoped catalog = already-authorized tools.** Per session, the bridge exposes `registry.get_tools(surface/capability=…)` filtered to read/compute tools — never `execute_code` (recursion), never KB-write (one-writer, architecture §5). Authorization stays capability-derived via the Phase 2 swappable resolver (BRIDGE-02).
5. **Results carry the Phase 2 citation envelope** into the sandbox (source_kind/source_id/verbatim), so artifacts/answers built from bridge results stay groundable for Ep7 (BRIDGE-05).
6. **Typed stubs generated from the registry** — a per-session Python module (tool_client + typed function stubs) built from the scoped catalog's neutral schema, injected into the pod at execution start. Stdlib only.
7. **Shared infrastructure.** Built once on the sandbox path; used by Virtual CSO (via the Phase 3 loop's `delegate_to_sub_agent` → sandbox execution) and Domain Agents (when their live wiring lands). Do not build a VCSO-only bridge.
8. **Inherit Phases 1–3.** Model routing, tagged usage (`sub_agent` role for the sandbox agent), the registry + scoped catalog + citation envelopes, and the sandbox session/persistence are all inherited — don't rebuild.

## Risk posture

The bridge core is independent of Phase 3 and can be built/tested with a standalone harness (open a session, run code that calls a tool via the bridge, assert the result). Phase 3 has landed, so the integration seam (the VCSO loop reaching Code Mode via `delegate_to_sub_agent` → sandbox execution) is available. Keep the non-bridge sandbox path (plain `execute_code`) working unchanged; Code Mode is additive — a bridge that sits unused with zero overhead if the code calls no tools.

## Success criteria (from ROADMAP.md Phase 4, reconciled to Option B)

1. LLM-generated code in the sandbox can call a registry tool via the exec-channel bridge and receive its result, in one execution (no per-tool inference round-trip).
2. The per-session catalog contains only tools the invoking surface/session is already authorized for — no `execute_code`, no KB-write; no broader reach.
3. Credentials never enter the pod; the pod has zero network egress; sandbox code sees only tool results.
4. Bridge results carry the citation envelope (source identity + verbatim where applicable).
5. The bridge is exercised by both a Virtual CSO code-to-answer flow (via the Phase 3 loop) and is built shared for Domain Agents.
6. Plain `execute_code` with no tool calls behaves exactly as before (bridge is zero-overhead when unused).

## Open items to resolve at this phase's build-planning (flag, don't silently pick)

- **Exposed tool allowlist** — the exact read/compute subset callable from Code Mode. Lean: KB navigation/read + wiki reads + structured query; exclude `execute_code`, `read_skill_file` optional, all writes excluded.
- **Host fulfilment concurrency** — the host must interleave "is the cell done?" with "any pending tool requests?" over the exec channel (run the cell as a background process writing a completion sentinel; poll request dir + sentinel). Confirm the `KubernetesInteractiveSandboxSession` extension approach and poll interval at build-planning.
- **NetworkPolicy on Autopilot** — confirm deny-all egress applies cleanly to sandbox pods (namespace/pod-level) on GKE Autopilot; whether DNS needs allowing (should not, under Option B).
- **Latency budget** — measure the exec round-trip per tool call once live; confirm acceptable for the founder-data use case.
- **Stub generation fidelity** — how faithfully typed stubs mirror the registry schema (param names/types) for good LLM ergonomics.
