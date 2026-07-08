# Episode 5 — Reply: map approved, two corrections locked, forks resolved

Strong read-back. The five-capability map matches our model — **approved.** Greenlight
**Task 2 (sequencing)** with the items below locked in. Two of your flags I'm resolving
directly rather than sending back for discussion; the rest are confirmations.

Both corrections below are now codified in `.planning/INTELLIGENCE-LAYER-EPISODE-MAP.md`
(§3.5 model routing, §3.4 degradation-vs-metering, and locked decisions L12/L13) — treat the
doc as source of truth.

---

## 1. Model routing — resolved and locked (retire the "model-agnostic / OpenRouter" framing)

Don't carry "model-agnostic / OpenRouter + per-job routing" forward as first-class Ep5 scope.
It overstates the real decision and re-imports reference-series framing that conflicts with a
**locked** stack constraint (`CLAUDE.md`: "Claude Sonnet, never swap for OpenAI-compatible").
Here is the correct model (now §3.5 / L12):

- **The conversation/orchestration model is Claude, locked** — in both Virtual CSO and Domain
  Agents. No per-thread model switching, no dropdown. This is a stack constraint, not an Ep5
  decision.
- **Per-job routing is legitimate and already exists** — via the Ep4 `ai_models` /
  `platform_ai_settings` registry plus the M8 capability `model_setting_key`. Sub-agents and
  LLM-powered helpers may run on cheaper models per capability; utility jobs (embeddings,
  metadata extraction, title generation, the Ep7 verifier) run on cheaper/specialized models
  with **no bearing on the chat model.** Keep this; just name it "utility/per-capability model
  routing via the model settings registry," not "model-agnostic OpenRouter."
- **"Tool calling" is not a cheap-model job.** The decision to call a tool and the
  interpretation of its result are the orchestration model (Claude); the tool's execution is
  code (often no model). Cheap models live *inside* specific LLM-powered tools/sub-agents and
  utility functions — not in the tool-calling loop. Correct this wherever your Cap-1/Cap-4
  reasoning implied otherwise.
- **Retrieval-router pre-step** (intent classification before Claude) may use a cheap
  classifier or non-LLM heuristics — distinct from in-loop tool calling.
- **Consequence for Cap 4:** because chat is always Claude, its context window is **known and
  stable** — the reference's "static `LLM_CONTEXT_WINDOW` breaks when the model varies"
  concern is largely moot for the chat window. Read the window from the model registry as
  hygiene, but do **not** let it justify a model-agnostic-chat architecture. The neutral
  OpenAI-compatible tool schema (Cap 1) stays useful for utility-model interop, but it is not
  a mandate to make the primary model swappable.

Net: per-capability model *settings* stay first-class (they already exist); the primary
conversation model is Claude-locked; "OpenRouter / model-agnostic primary" is dropped.

---

## 2. Degradation vs. metering — two systems, one event stream (now §3.4 / L13)

Your Cap-4 work conflated two things that are related but separate. Lock this distinction:

- **Degradation (context fullness)** — per-thread, real-time, the **main orchestration
  window only** (messages + whatever tool/sub-agent results are fed *back into* it).
  Sub-agents run in isolated windows; only their compact returns count. Keeping sub-agent
  returns synthesized/compact is what protects the main window. Drives the per-thread "%
  remaining before degradation" signal + compaction.
- **Metering (cost)** — per-user, cumulative, windowed (5-hour / weekly). Sums cost across
  the **entire tree**: main model **plus** every sub-agent's full internal usage, every
  LLM-powered tool call, and utility jobs. A sub-agent's internal work is invisible to
  degradation but fully visible to metering.
- **One tagged usage-event stream feeds both.** Every model call emits an event tagged with
  `user`, `thread`, `surface`, `model`, and `role` (`main` / `sub_agent` / `utility`).
  Degradation filters to the main-thread context; metering sums all events in the window.
  Build one event stream with these tags — not two plumbing systems.
- Compaction reclaims context (helps degradation) but does not refund cost.

---

## 3. Fork resolved — account-level % metering: deferred

**Episode 5 ships per-thread %** (self-contained). **Account-level % is deferred to the
metering ledger** (the ledger, quotas, and tier economics are all flagged-for-later). The
requirement on Ep5: **emit usage events in the ledger-ready tagged shape above** so
account-level % and the ledger add later without re-plumbing.

## 4. Fork resolved — MCP scaffold depth: build the shape, stub the lifecycle

At beta: register MCP as a **first-class registry source type** and stand up the credential
**model** (Supabase Vault-backed, per-user RLS, service-role-only access) — but **stub the
OAuth lifecycle** (refresh/rotation/revocation) rather than fully implementing it, since no
live connectors ship. Lock the exact depth at build-planning; the guardrail you flagged is
correct — don't let lifecycle work balloon into a beta blocker.

## 5. Confirmations (parked correctly — no change)

- **D1 registry reconciliation** — good walk-back. Hold it open; design so either "one
  unified registry" or "two distinct layers" stays reachable. Decide at build-planning.
- **GKE bridge networking** (`host.docker.internal` → pod-to-in-cluster-service + network
  policy + session-token auth) — correctly deferred to build-planning. Infra detail, not a
  surfaces question.
- **Interleaved history sequences after the VCSO tool-loop shape settles** — good dependency
  catch; keep it in that order so we don't persist a structure that changes underneath us.

---

Proceed to **Task 2**: sequence the incremental rollout across the three surfaces. Land the
model-routing registry and the tagged usage-event stream as foundational steps, keep the
build-it-right seams (surface/context-aware registry, citation-ready results, shared-bridge
security boundary) intact so nothing forecloses Ep6/Ep7, and flag any conflict with the
locked decisions rather than resolving it silently.
