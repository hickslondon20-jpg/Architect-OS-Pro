# Phase 4 Research — Sandbox HTTP Bridge / Code Mode

**Verified:** 2026-07-03, against the live repo (`sandbox_service.py`, `sandbox_execution_service.py`, `tool_registry.py`) and the Ep4 sandbox build notes.
**Status:** Research + open architectural fork surfaced. CONTEXT / plans / execution-prompt are **held pending London's call on the bridge mechanism** (see §"The fork").

---

## What exists today (the sandbox control plane)

- The sandbox is a **GKE Autopilot pod** created via `llm-sandbox`'s `InteractiveSandboxSession` (`SandboxBackend.KUBERNETES`), subclassed as `KubernetesInteractiveSandboxSession` in `sandbox_service.py`.
- **The Railway backend drives the pod entirely through the Kubernetes API exec channel** — it does not talk to the pod over a network socket the pod opens. Concretely, `_write_remote_command` writes a base64 command file into the pod via `execute_command` (kubectl-exec style), `session.run(code)` executes it, and `_read_remote_result` / `cat` reads the result back. Session state persists per `thread_id` (Ep4 Phase 5).
- **The pod holds no credentials.** Supabase service-role client and API keys live on the Railway host; the sandbox only ever receives code to run and returns stdout/stderr/files. Ep4 Phase 6 also proved file extraction works over the same exec/base64 channel (the library's `copy_from_runtime` was unreliable on this cluster).
- `sandbox_execution_service.py` runs a bounded Claude tool-use loop whose `execute_code` tool calls `SandboxService.execute_code(thread_id, code, timeout)`. Today the code it runs **cannot call platform tools** — it only computes against data handed in / read from skill files.
- Phase 2's `tool_registry` is the source of tool definitions + executors + the swappable scope resolver + citation envelopes. This is what Code Mode would expose to sandboxed code.

## The fork (the central Phase 4 decision)

The reference implements Code Mode as an **HTTP bridge**: sandboxed Python calls `tool_client.call("search_documents", …)` which makes an outbound HTTP request to a host bridge (`host.docker.internal:PORT`), which dispatches through the tool registry. That assumes the pod has network egress to a reachable bridge and a session-token auth layer.

On ArchitectOS's architecture there are two viable shapes:

**Option A — HTTP bridge (reference-faithful).** Expose a bridge endpoint (e.g. on the Railway backend, `POST /bridge/call`) that the pod calls over the internet with a per-session token. Requires: pod egress allowed to the bridge (GKE Autopilot pods have internet egress by default), a public token-authenticated bridge surface, session-token issuance/validation, and network policy to limit egress to just the bridge. This is the reference's "pod → host networking" problem, adapted from local Docker to GKE.

**Option B — exec-channel bridge (fits the existing control plane).** The runner script, when LLM-generated code calls a tool stub, **writes a tool-call request to a file in the pod and blocks**; the Railway host — which already drives the pod over the K8s exec channel — reads the request, executes the registry tool **host-side** (with real credentials), and writes the result back into the pod; the stub unblocks and returns it. This mirrors the existing `_write_remote_command`/`_read_remote_result` mechanism and Anthropic's native PTC "pause-and-return" shape. No inbound/outbound pod networking, no public bridge endpoint, no session tokens — the host↔pod trust is the existing authenticated K8s API channel.

**Why Option B looks better-fit for us (recommendation, pending London):**
- **Sidesteps the GKE networking problem entirely** — the reason this was flagged as a Phase 4 unknown. No `host.docker.internal` analogue needed; no in-cluster bridge service; no public bridge URL.
- **Strictly more secure** — the pod can run with **zero network egress** (deny-all NetworkPolicy), because it never needs to reach anything. Credentials still never enter the pod (same as Option A), but now the pod also can't exfiltrate over the network.
- **Consistent with the proven control plane** — Ep4 already showed the exec/base64 channel is the reliable path on this cluster (file-copy fallback). A bridge over that same channel reuses a known-good mechanism instead of introducing a new networked one.
- **No new auth surface** — Option A needs session-token issuance/validation; Option B inherits the host's existing K8s-API authentication to the pod.
- **Tradeoff:** Option B is a polling/blocking file protocol rather than a real socket, so per-call latency is bounded by the exec round-trip, and the runner must block cleanly on each tool call. For the founder-data use case (a handful of tool calls inside one script), this is acceptable; it is not a high-throughput RPC path. If a future use case needs high-frequency in-script tool calls, Option A (or native PTC) could be revisited.

This is the same category of adaptation the build keeps making (reference assumes local Docker → we run GKE): the reference's HTTP bridge is a Docker-host-networking artifact; our exec-channel control plane offers a cleaner equivalent.

## Scope boundary (already decided at the build level — reaffirmed)

Code Mode changes **how** an agent invokes tools it is already authorized for (a code loop instead of N inference round-trips), **not which** tools it can reach (build `CONTEXT.md` decision 4 / REQUIREMENTS BRIDGE-02). Whichever mechanism:
- The per-session tool catalog = `registry.get_tools(surface/capability=…)` for the invoking session — read/compute tools only. **`execute_code` is not exposed to itself** (no recursion); **no KB-write tool** is exposed (one-writer). Confirm the exact exposed set at build-planning.
- Credentials stay host-side; the sandbox sees only tool results (BRIDGE-03). Results returned into the sandbox carry the Phase 2 citation envelope (BRIDGE-05) so artifacts/answers built from them stay groundable.
- Shared by Virtual CSO and Domain Agents (BRIDGE-06) — built once on the sandbox path, wired to VCSO first.

## Dependency analysis (answers "do we wait for Phase 3?")

- **Phase 4's core — the bridge mechanism — is independent of Phase 3.** It depends only on Phase 2 (registry, done) and the Ep4 sandbox (exists). It can be built and tested with a standalone harness that opens a sandbox session, runs code that calls a tool via the bridge, and asserts the result — no VCSO loop required.
- **The only Phase-3 dependency is the final integration seam:** the VCSO loop (Phase 3) deciding to run a Code Mode execution. That wiring — and how a code-mode run's trace streams/persists — depends on Phase 3's landed loop + SSE/persistence shape.
- **Therefore:** Phase 4 can be *planned* now (this pass) and its sandbox-side core *executed* in parallel with Phase 3; only the loop-integration step should wait for Phase 3 to land, to avoid rework on the seam.

## Open items to resolve before/at Phase 4 build-planning

1. **Bridge mechanism: Option A (HTTP) vs Option B (exec-channel).** The central fork. Recommendation: **Option B (exec-channel)**. Needs London's call before CONTEXT/plans are written (they differ substantially by mechanism).
2. **Exposed tool set** — which registry tools are callable from Code Mode (read/compute only; not `execute_code`, not KB-write). Lean: the read/compute native tools (KB search/read, wiki reads, structured query) + eventually MCP; confirm the allowlist.
3. **Pod network posture** — with Option B, apply a deny-all egress NetworkPolicy (pod needs no network). With Option A, restrict egress to the bridge only. Decide with the mechanism.
4. **Typed stubs** — how tool stubs are presented to LLM-generated code (the reference injects typed Python stubs). Both options need stubs; generate them from the registry's neutral schema. Confirm generation approach at build-planning.
5. **Latency budget** — confirm the exec round-trip per tool call is acceptable for the founder-data use case (Option B); if not, revisit.

## Verification method (for the record)

- Read in full: `services/sandbox_service.py` (control plane), `services/sandbox_execution_service.py` (current code loop), `services/tool_registry.py` (Phase 2). Cross-referenced Ep4 Phase 5/6 notes (exec/base64 reliability, session persistence, restart-loses-state).
- No live cluster calls (no GCP creds in this planning session); claims about the exec channel are from direct code reading, consistent with Ep4's live-verified behavior.
