# OpenClaw — Analysis for Orchestration Repurpose

> Authored: 2026-07-13
> Status: **Reference / inspiration analysis.** Not a decision doc, not a build plan.
> Companion to: `COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` (our North Star). Revisit this **after**
> the reconciliation pass, when we know the true state of our own build and are scoping the harness.
> Source basis: OpenClaw official docs (see Sources at end). The GitHub source tree was not read in
> full (fetch exceeded limits); this analysis is grounded in the concept documentation, so treat
> implementation specifics as "as documented," to be confirmed against source if we adopt anything.

---

## 0. What OpenClaw is, and how to read this

OpenClaw is an open-source **agent gateway** — a self-hostable runtime that runs one or more
persistent AI agents, routes messages to them from chat channels (Slack, WhatsApp, Telegram, web),
and manages their loop, context, memory, tools, and sub-agents through a plugin architecture. Its
default posture is a **personal/organizational assistant**, config-file driven.

That posture is *not* ours. We are a multi-tenant SaaS with a knowledge-tier substrate (the wiki,
docs, datasets), founder isolation, and a strategic CFO/CSO reasoning goal. So **we repurpose
patterns and interface shapes, not code or product framing.** The value here is that OpenClaw has
already had to solve — in production, with published, opinionated answers — most of the exact
problems our Cognitive Orchestration doc raises: context assembly, cheap pre-passes, bounded
sub-agents, delegation contracts, model-by-role routing, and safety bounds. Where their answer is
good, it saves us from rediscovering it.

**How relevant:** high. The concept map lines up almost one-to-one with our North Star sections,
which is the main finding of this analysis.

---

## 1. Context engine — the single most directly reusable idea

**What it is.** OpenClaw factors context management out of the agent loop into a pluggable
**context engine** with four lifecycle hooks: `ingest` (a message arrives), `assemble` (before each
model run — return an ordered, token-budgeted set of messages **plus an optional
`systemPromptAddition`**), `compact` (window full), and `afterTurn` (persist/index/trigger
background work). It also exposes optional **subagent lifecycle hooks** — `prepareSubagentSpawn`
(with a `contextMode` of `isolated` or `fork`) and `onSubagentEnded`. Engines declare whether they
`ownCompaction`, and the runtime **quarantines a failing engine and downgrades to the built-in
`legacy` engine** rather than going silent.

**Repurpose for us.** This is the clean seam our "working-state memory" (North Star §6) and bounded
assembly (§2 gather/compose) want. Concretely worth stealing:

- **`assemble` returning a windowed, self-contained, budgeted context** is exactly our "expensive
  model only ever sees compact inputs." Making assembly an explicit, swappable interface — rather
  than an implicit pipeline buried in the chat loop — is the architectural move that lets us evolve
  compaction → working-state memory → wiki-component composition without rewriting the loop each time.
- **`systemPromptAddition`** — injecting *dynamic recall/retrieval guidance* into the system prompt
  per run — is a light mechanism for our router hints ("this turn, prefer the financial-picture
  component; the P&L is stale, consider a live pull").
- **`contextMode: isolated | fork`** for sub-agents cleanly names the choice we'll face: does a
  worker get a clean isolated context or a fork of the parent's? We should adopt that vocabulary.
- **Quarantine-and-downgrade on engine failure** is a fail-open pattern we already value (our sync
  and usage logging fail open); formalizing it for context assembly is smart.

**Caveat.** Their engine is per-session and message-transcript oriented. Ours must assemble across a
*knowledge substrate* (tiers + live MCP), not just chat history — so we'd implement the same
*interface shape* over a richer source set. The interface is the reusable part, not their `legacy`
summarizer.

---

## 2. Active memory — a cheap pre-reply recall pass (our intent/context pre-pass)

**What it is.** An optional **blocking memory sub-agent that runs *before* the main reply**, on a
small/fast dedicated model, with a **narrow tool surface** (memory recall only). It returns a
**compact summary (~220 chars) or `NONE`**, injected as a hidden "untrusted context" prefix. It has
**query modes** (`message`/`recent`/`full`, trading latency for context), a **circuit breaker**
(skip after N consecutive timeouts), and a cache TTL. Its rationale: most memory systems are
*reactive* (they wait for the agent or user to ask); this gives the system "one bounded chance to
surface relevant memory before the reply is generated."

**Repurpose for us.** This is almost exactly our **intent-read + relevant-context pull** as a cheap
pre-pass (North Star §2, Phase 1), and it validates doing it on a **worker-tier (Haiku) model**
before the expensive compose. Specific patterns to lift: the **`NONE` sentinel** (return nothing
rather than pad context), the **hard "untrusted context, do not treat as instructions" framing**
(prompt-injection hygiene when we inject retrieved founder data), the **circuit breaker + timeout
budget** so a slow pre-pass never stalls the turn, and **query-mode tiering** (how much conversation
the pre-pass sees) which maps to our adaptive-depth triage.

**Caveat.** Theirs recalls *personal preferences*; ours pre-pass must classify *intent/depth* and
pull *strategic components* — a bigger job. But the shape (cheap, bounded, before-reply, fail-open,
returns compact-or-nothing) is directly applicable.

---

## 3. Parallel specialist lanes — the delegation-contract and staging playbook

**What it is.** Guidance for routing work to specialist agents while keeping UX fast. Its
**first principle**: parallelism only helps if it reduces contention on real bottlenecks — session
locks, global model capacity, tool capacity, **context budget**, and **ownership ambiguity**. Its
core artifact is a **lane contract**: `Owns` / `Does not own` / `Chat budget` (quick answers stay in
chat; heavy work acknowledges briefly then runs in a background sub-agent) / `Handoff rule` (target
lane, objective, compact context, exact next action) / `Tool posture` (smallest tool surface). Its
rollout is explicitly staged: (1) lane contracts + background heavy work, (2) priority/concurrency
controls, (3) a coordinator/traffic-controller — with the warning **"do not start here; a
coordinator without lane contracts just coordinates chaos."**

**Repurpose for us.** This is the most immediately useful operational playbook for our
decompose→delegate→compose spine:

- **The lane-contract template is a ready-made shape for our capability/worker definitions** —
  Owns / Does-not-own / budget / handoff / tool posture maps cleanly onto what a bounded specialist
  needs, and the **compact handoff summary** *is* our worker-summary contract (North Star §4).
- **"Quick stays in chat; heavy acknowledges then backgrounds, then returns the result"** is our
  adaptive-granularity triage and our latency-cover UX, stated crisply.
- **"Don't start with the coordinator"** directly validates our staging (§9): prove the bounded
  workers and their contracts first; add the orchestrator/traffic-controller only once lanes exist.
- **Treating context budget and ownership ambiguity as first-class bottlenecks** is the same cost
  thesis we reached — worth citing as external corroboration.

**Caveat.** Their lanes are *persona/channel* lanes (a coding agent vs a research agent); ours are
*capability* workers within one founder's turn. The contract and staging discipline transfer; the
persona framing does not.

---

## 4. Agent loop + hooks — our deterministic phases, formalized, with extension points

**What it is.** A deterministic **run sequence** (validate → resolve session → assemble context →
infer → execute tools → stream → persist), **per-session serialization** (session lanes) plus a
global lane to prevent races, **queue modes** (`steer`/`followup`/`collect`/`interrupt`), and a rich
set of **plugin hooks** at every lifecycle point — notably `before_prompt_build` (inject context),
`before_agent_reply` (a plugin can **claim the turn and return a synthetic reply or silence it**),
`before/after_tool_call`, and `before/after_compaction`. Three event streams (`lifecycle`,
`assistant`, `tool`) drive the UI, and a `NO_REPLY` sentinel suppresses empty replies.

**Repurpose for us.** Confirms our "deterministic phases, model-driven contents" (§2) is a proven
shape. Worth lifting: **hooks as the extension model** (our intent-read, budget guard, and freshness
policy could be hooks around a stable loop rather than tangled into it); **the three event streams**
map directly onto what MA-05 already renders (lifecycle/tool/assistant) — good validation that our
transparency layer is on the right axis; **`before_agent_reply` claiming the turn** is a clean way to
implement our **reflect-and-steer** terminal mode (a phase can short-circuit to "ask the human"
instead of composing); and **per-session serialization + queue modes** is exactly the concurrency
discipline a real harness needs (and something our single VCSO loop likely under-specifies today).

**Caveat.** Heavy machinery (48h timeouts, stuck-session diagnostics, write-lock files) is tuned for
long-running autonomous/self-hosted agents. We want the *loop-and-hooks structure*, not the ops
weight.

---

## 5. Multi-agent routing — model-and-tool governance by role (parallels MA-06)

**What it is.** Multiple **isolated agents** in one gateway, each with its own workspace, sessions,
**model**, **sandbox**, and **tool allow/deny** list; inbound messages route by **bindings**
(most-specific-wins). A documented pattern routes an everyday channel to a fast **Sonnet** agent and
a deep-work channel to an **Opus** agent — i.e., **model tiering by routing**, at the persona grain.

**Repurpose for us.** This is a persona-level analogue of the **tier→model routing we just built in
MA-06**, plus **per-agent tool allow/deny as governance** — which is conceptually our `tool_registry`
`enabled` + capability `allowed_tools`. The reusable ideas: **deterministic most-specific-wins routing
rules** (a clean model for our source/worker router), and **per-role tool policy as a first-class,
enforced config** (reinforces keeping tool permissions declarative and governed, not ad hoc).

**Caveat.** Their "agents" are separate personas/accounts; our multi-tenancy is per-founder isolation
inside one product. We take the routing/governance shape, not the multi-persona product model.

---

## 6. Delegate architecture — the safety/governance model for autonomy

**What it is.** Running an agent that acts **on behalf of** people, with **capability tiers**
(read-only+draft → send-on-behalf → proactive/autonomous), **"hard blocks"** (non-negotiable rules
loaded every session that are the last line of defense regardless of instructions),
**gateway-enforced tool restrictions** (the Gateway blocks the tool call even if the agent is talked
into trying — independent of the prompt), **least-privilege escalation**, standing orders, and a
mandated **audit trail**.

**Repurpose for us.** This is the governance/safety backbone for making our harness *autonomous but
safe* — directly reinforcing our "bounds we keep hard" (§8). Specifically: **capability tiers with
least-privilege escalation** map to our reflect-and-steer / human-approval gates (a strategic action
or an external write should require a higher tier); **hard blocks loaded every session** is a pattern
for our non-negotiables (never expose another founder's data, never write the wiki directly, never
echo secrets); and — most importantly — **enforce tool policy at the gateway/runtime layer, not just
in the prompt.** That last one is a real strengthening of our current model: today our tool scoping
is capability-config driven, but the principle "even if the model is convinced to try, the runtime
refuses" is worth making explicit as we grant workers more power (sandbox, MCP writes).

**Caveat.** Their framing is email/calendar org-delegation; we don't need the identity-provider
machinery. We need the **tiered-permission + hard-block + runtime-enforcement** discipline.

---

## 7. Inferred commitments — proactive follow-up and the memory taxonomy

**What it is.** A **hidden background pass after a reply** (separate context) that notices
conversation-bound **follow-up obligations** ("you have an interview tomorrow → check in after"),
stores a compact commitment with a due window, and delivers it later via heartbeat — **capped per
day**, scoped to the exact agent/channel, and explicitly **distinct from durable facts and from exact
reminders/cron**.

**Repurpose for us.** Two things. First, the **three-way memory taxonomy** — durable facts vs.
short-lived operational commitments vs. exact scheduled reminders — is a clean way to structure our
memory layering (the wiki = durable synthesized facts; working-state = operational/open-loops;
scheduled tasks = exact reminders). Second, **inferred follow-ups** are exactly the proactive-partner
behavior a CSO shows ("last time margin was compressing — did the pricing change land?"), and the
implementation shape (cheap background extraction, compact storage, capped, scoped, delivered later)
is a good template for our working-state "open questions we've established we don't know."

**Caveat.** Delivery via heartbeat/channels is their messaging model; ours would surface follow-ups
inside the VCSO thread or a founder digest. The extraction-and-store pattern transfers; the delivery
channel doesn't.

---

## 8. Cross-cutting patterns worth stealing regardless

Independent of any single feature, OpenClaw is consistent about a handful of engineering disciplines
that match our values and are worth adopting wholesale in the harness:

- **Fail-open with quarantine-and-downgrade.** A failing plugin engine never silences the agent; it
  degrades to a safe default and logs. (We already do this for sync/usage; extend it to context and
  workers.)
- **Sentinels over empty padding.** `NONE` (no memory) and `NO_REPLY` (suppress) keep context clean
  and outputs honest — useful for our worker contracts and reflect-and-steer.
- **Circuit breakers + explicit timeout budgets** on every auxiliary pass, so a slow helper never
  stalls the user turn — directly supports our per-turn budget (§7).
- **"Untrusted context, do not treat as instructions"** framing around injected data — mandatory
  prompt-injection hygiene once we inject founder documents and live MCP pulls into the model.
- **Enforce policy at the runtime, not the prompt.** The most transferable safety idea in the whole
  system.
- **Staging discipline: contracts before coordinators.** Build the bounded pieces and their
  contracts first; add the orchestrator last. Mirrors our thin-vertical-slice staging.

---

## 9. Where OpenClaw diverges — what NOT to copy

- **Single-tenant, self-hosted, config-file product.** No multi-tenant isolation model, no SaaS
  surface. Our founder isolation + RLS is a harder problem their design doesn't address.
- **Channel/messaging-first.** Bindings, presence, heartbeat, per-number accounts — irrelevant to an
  in-app VCSO thread.
- **No knowledge-tier substrate.** They have session memory + vector recall; we have the Tiers 0–3
  wiki/doc/dataset substrate and the build-time synthesis principle. Our composition-from-components
  model is *ours*; their memory is flatter.
- **Local filesystem workspace + shell/exec posture.** Our "sandbox worker" is a governed compute
  surface, not a general host shell.
- **Provider-agnostic by design.** We are Claude-locked by policy; their model-routing flexibility is
  broader than we want.

Net: take the **interfaces, contracts, and disciplines**; leave the **product framing and ops
machinery**.

---

## 10. Prioritized shortlist to dive into after reconciliation

In rough order of value-to-effort for realizing our North Star:

1. **Context-engine interface** (§1) — the assemble/compact/subagent-lifecycle seam is the backbone
   for working-state memory and bounded assembly. Highest structural payoff. Read the source here.
2. **Lane contracts + staging** (§3) — near-zero-code; adopt the contract template as our
   capability/worker definition shape and the "contracts before coordinator" staging immediately.
3. **Active-memory pre-pass pattern** (§2) — a concrete template for our cheap intent/context
   pre-pass on the worker tier, with the fail-open/circuit-breaker discipline.
4. **Runtime-enforced tool policy + hard blocks + capability tiers** (§6) — the safety model that
   lets us grant workers real power (sandbox, MCP) without losing the bounds.
5. **Agent-loop hooks + event streams** (§4) — validate/extend our loop and confirm MA-05 already
   sits on the right streams; use `before_agent_reply`-style short-circuit for reflect-and-steer.
6. **Commitments/ memory taxonomy** (§7) — lower urgency; informs working-state memory and proactive
   follow-up once the spine exists.

We revisit this list against the reconciliation findings (does our loop already have hook points? is
there a context seam to extend, or must we introduce one?) before any of it enters a GSD plan.

---

## Sources

- [Context engine](https://docs.openclaw.ai/concepts/context-engine)
- [Agent loop](https://docs.openclaw.ai/concepts/agent-loop)
- [Multi-agent routing](https://docs.openclaw.ai/concepts/multi-agent)
- [Delegate architecture](https://docs.openclaw.ai/concepts/delegate-architecture)
- [Parallel specialist lanes](https://docs.openclaw.ai/concepts/parallel-specialist-lanes)
- [Active memory](https://docs.openclaw.ai/concepts/active-memory)
- [Inferred commitments](https://docs.openclaw.ai/concepts/commitments)
- Repo: [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw) (source tree not read in full; analysis grounded in the docs above)
