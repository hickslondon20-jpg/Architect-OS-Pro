# References: Orchestration Harness — VCSO Planner — ArchitectOS Pro

The reference-pattern → phase → **extract / adapt / skip** map. External references (OpenClaw) are
mined for design lessons; they are **not** a blueprint. Build to the North Star
(`../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md`) and our object model. Where any reference and the
North Star conflict, the North Star wins.

## Canonical sources (win over any reference)

- `../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` — the North Star: turn lifecycle, three terminal
  modes, delegation targets, source selection + freshness, working-state memory, cost/quality
  mechanics, bounds kept/relaxed, staging.
- `../INTELLIGENCE-LAYER-ARCHITECTURE.md` — three surfaces (OS Engine / Virtual CSO / Domain Agents),
  four-tier knowledge layer (Tiers 0–3), one-writer/feeder rule, build-time-over-query-time.
- `../RECONCILIATION-COGNITIVE-ORCHESTRATION.md` — the live wired/partial/missing map this build
  starts from (router missing; workers wired; wiki partial; harness location clarified; MCP scaffolded).
- Prior scopes it inherits: `MA-05-CSO-TRANSPARENCY-SCOPE.md`, `MA-06-TOOL-REGISTRY-ROUTING-SCOPE.md`,
  and the `../agent-harness/` workstream (Ep6 Deep Mode + sub-agent substrate).

## Reference material (source material — mined for patterns only)

- `../OPENCLAW-ANALYSIS-ORCHESTRATION-REPURPOSE.md` — our analysis of OpenClaw's context engine,
  agent loop + hooks, multi-agent routing, delegate architecture, specialist lanes, active memory,
  and inferred commitments. **Patterns and interface shapes only — not product framing or code.**
- OpenClaw docs (external): `docs.openclaw.ai/concepts/{context-engine, agent-loop, multi-agent,
  delegate-architecture, parallel-specialist-lanes, active-memory, commitments}`.
- **Context Hub** (external): `github.com/andrewyng/context-hub` — annotations (durable, re-injected,
  untrusted-by-default), feedback→author loop, incremental/selective fetch. Mine the *mechanisms*;
  the `chub` CLI / public docs registry / community-PR product is skipped.
- **Personal Context Portfolio** (external): `github.com/nlwhittemore/personal-context-portfolio` —
  a modular ten-file founder-operating context package (identity, role, projects, team, tools,
  communication-style, goals/priorities, preferences/constraints, domain-knowledge, decision-log)
  with markdown-first / modular / living / portable principles. Mine the *taxonomy + principles*;
  the web-app interviewer / all ten pages / wiring guides are held (and page authoring is OS Engine's).

## Reference pattern → phase → extract / adapt / skip

| Reference pattern (OpenClaw / prior) | Phase | Disposition |
|---|---|---|
| **Context engine** — `assemble/compact/afterTurn` + subagent lifecycle (`isolated`/`fork`), `systemPromptAddition`, quarantine-and-downgrade | P1 | **Adapt** — the interface shape for working-state memory + bounded assembly over our *knowledge substrate* (not just chat transcript). Adopt `isolated`/`fork` vocabulary for worker context. |
| **Active-memory pre-pass** — cheap blocking recall sub-agent before reply, narrow tools, returns compact-or-`NONE`, circuit breaker, "untrusted context" framing | P2 | **Adapt** — template for the intent/depth read + relevant-context pull on the worker tier; keep the `NONE` sentinel, injection-hygiene framing, timeout/circuit-breaker. |
| **Tier-escalating retrieval** (our Tiers 0–3 + live MCP) | P3 | **Build** — cheapest-first source router. Composes existing `retrieval.py`/KB/`wiki_*` tools; net-new orchestration. |
| **Parallel specialist lanes** — lane contract (Owns / Does-not-own / chat budget / handoff summary / tool posture); "contracts before coordinator" staging; context-budget + ownership as bottlenecks | P4 | **Adapt** — lane-contract template becomes the bounded-worker/capability contract; the **compact handoff summary** is the worker→composer return contract; staging validates "workers + contracts before the planner." |
| **Delegate architecture** — capability tiers, **hard blocks loaded every session**, **runtime-enforced tool policy**, least-privilege escalation, audit trail | P5 | **Adapt** — the safety model for granting workers real power (sandbox/MCP). Enforce tool policy at the runtime, not the prompt; hard-block founder-isolation + one-writer + secrets. |
| **Agent loop + hooks** — deterministic run sequence; `before_prompt_build`, `before_agent_reply` (claim/short-circuit the turn), `before/after_tool_call`; 3 event streams; `NO_REPLY` sentinel; per-session serialization + queue modes | P4/P7 | **Adapt** — hooks as the extension model around a stable loop; `before_agent_reply`-style short-circuit implements reflect-and-steer; confirm MA-05 already sits on lifecycle/tool/assistant streams. |
| **Inferred commitments** — hidden post-turn extraction of follow-up obligations; memory taxonomy (durable facts / operational commitments / exact reminders) | P6 | **Adapt (light)** — informs working-state "open loops" + proactive follow-up; taxonomy maps to wiki (durable) / working-state (operational) / scheduled tasks (exact). |
| OpenClaw single-tenant, channel/messaging framing; per-persona multi-agent product; local FS/shell; provider-agnostic routing | — | **Skip** — our multi-tenant SaaS, in-app VCSO thread, governed sandbox, Claude-lock differ. Take interfaces/disciplines, not product framing. |
| Freshness/authority policy (wiki-fresh-enough vs. go-to-source) | P5 | **Build** — net-new; no analog exists. Lives in the router's source-selection. |
| **Context Hub — annotations** (durable notes on resources, persist + re-inject, untrusted-by-default) | P1 | **Adapt** — the durable/cross-thread memory grain alongside within-thread working state; re-injected as untrusted (with INT-3 hygiene). |
| **Context Hub — incremental/selective fetch** (`--file` vs `--full`; only what you need) | P1/P3 | **Adopt** — reinforces bounded assembly (CTX-2) + cheapest-first component fetch in the router (ROUT-2). |
| **Context Hub — feedback→author loop** | P6/dep | **Adapt** — agent feedback on a wiki component is a signal OS Engine re-synthesizes (one-writer). This build emits; OS Engine acts (ties to O3). |
| **Personal Context Portfolio — modular founder-operating taxonomy** (communication-style, decision-log, goals, role, constraints, …) | P3/dep | **Adapt** — router/assembly consume a *modular, extensible* founder-context set (not the fixed 7). Page authoring is an OS Engine dependency; consumption is in scope. |
| **Portfolio — modular / living / portable principles** | P1/P3 | **Adopt** — corroborates "wiki as composed components, grabbed as needed." |
| `chub` CLI / public docs registry / community PRs; Portfolio web-app interviewer / all ten pages / wiring guides | — | **Skip / hold** — mine patterns, not products; reference back when a phase needs specifics. |

## Prior-build assets this build inherits (do not rebuild — see `CONTEXT.md` reuse map)

- **MA-05** — curated transparency (Context/Tool/Delegation/Response steps), relational step
  persistence, SSE streams; the surface the planner + workers render through.
- **MA-06** — `tool_registry` catalog + drift sync, tier→model rows, `effective_model_setting_key`,
  cost-visible per-run model attribution.
- **Ep6 (`agent-harness/`)** — `sub_agent_orchestrator` + `agent_capabilities`/`agent_delegation_*`,
  Deep Mode todos/workspace, ask-user tool, structured worker output contracts.
- **Ep1–Ep5** — hybrid retrieval + reranking, KB Explorer tools, document/`wiki_*` engines, Ep4 GKE
  sandbox + skills, tool registry + scope sources.
