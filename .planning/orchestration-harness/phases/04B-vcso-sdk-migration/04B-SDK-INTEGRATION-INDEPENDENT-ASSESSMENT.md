# 04B — SDK Integration: Independent Architecture Assessment

**Written:** 2026-07-28
**Author:** Independent architecture assessor (second, independent read; formed without access to the
other analysis — none of the excluded plan/kickoff documents was opened).
**Read:** the attached `Understanding Agent SDK Integration.md`; `04B-VISION-AND-INTENT.md`;
`COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` + `INTELLIGENCE-LAYER-ARCHITECTURE.md`; the 28
`Agent-SDK-Setup/` documents; 04B `CONTEXT.md`, harness `CONTEXT.md` + `REQUIREMENTS.md`;
`04B-D2-FINDINGS.md`, the M2/M3/M4 finish/completion logs, `04B-D-REMEDIATION.md` (headings + §§10–22),
`04B-G-GATE-FINDINGS.md`, `04B-D2-TIER2-CLOSE-HANDOFF.md`, both `.planning/debug/` records, `ROADMAP.md`;
and the eleven named source files in `python-backend/`.
**Not acted on:** no code written, no canary run, no flag touched, no roadmap edited. STOP for London.

---

## 0. Headline findings

1. **The integration is broadly right at the macro level and wrong at exactly one seam.** The control
plane, the context-selection IP, the SSE normalization, sessions, per-capability model routing, the
persistence layer, and every one of the seven locks are sound and used the way the SDK intends. The
workaround pile — external transport, per-turn tokens, the env-var timeout landmine, the single-process
constraint, the completion bridge, the keepalive, Defects 6 and 7 — traces overwhelmingly to a single
decision: executing the bounded workers **behind an external loopback MCP server** so their tools are
invisible to the lead.

2. **That decision was driven by a requirement that is only half real.** "Workers are bounded and
founder-scoped" is a real constraint (locks 1 and 7). "The lead must be *physically unable to see* the
worker tools" is a proof artifact: it hardened "prove the model reasons rather than the app routing"
into a transport-level isolation requirement the SDK was never designed to provide. The correct form of
the requirement — "the lead must never *execute* founder-data work outside a bounded worker" — is
enforceable in-process with a hook the codebase has already written (`pre_worker_handler_gate`).

3. **The SDK's own subagent mechanism is underused.** `AgentDefinition` subagents exist precisely to run
scoped tools on their own model in an isolated context — which is what the workers *are*. The current
model-driven path instead nests four layers: SDK lead → `Task` → a Haiku subagent whose entire job is to
call one wrapper tool → an HTTP hop → the Python handler, which then makes its **own** Anthropic calls.
Two model layers and a network hop where the SDK's design intends one model layer and no hop.

4. **The evidence does not support a rebuild.** It supports **one deletion** (the external worker
transport + token registry, ~700 lines plus the infra landmines), licensed by **one cheap probe**, plus
**one addition** (a small direct-retrieval lane so the lead can answer retrieval-assisted questions
without a full delegation). Everything else survives: the seven handlers' contents, the registry
compiler, the C2 surface, the session store, the source router, the run/step persistence, the discipline.

5. **The defect classes that are *not* integration-created are the ones that matter most.** Composer
fabrication and under-delegation (G-gate) are engine-independent honesty and reliability problems. They
are fixed by data (the Phase F financial series), the output-integrity gate (already landed), a freshness
policy, and prompt/tool-description work — not by any engine change. Changing the engine does not touch
them; keeping the current engine does not fix them.

6. **The attached five-layer document is directionally correct — and on the one structural point where
the current build deviates from it, the attached document is right** ("your existing agents should
become tools, not stay silos"). But it is naive about the two things that actually burned this
migration: compiled-CLI opacity (behavior the Python source cannot verify, which produced the false
greens) and delegation reliability (it assumes a well-tooled agent routes well; the G-gate record shows
that assumption is not free). Its migration phases 1–3 describe work this team has, in substance,
already done.

---

## 1. What the Agent SDK actually gives you out of the box

In plain English: the SDK is **Claude Code packaged as a library**. When your Python code calls
`query()`, the SDK spawns a bundled `claude` CLI binary as a subprocess and talks to it over stdio; that
subprocess owns the agent loop, the context window, the session transcript, and the conversation with
the Anthropic API (`Agent-SDK-Setup/25`, "The subprocess model"). Your application configures the
environment; the subprocess runs the agent inside it.

What it provides, substantially for free:

- **The agent loop.** Model reasons → picks a tool → gets the result → reasons again, until done.
  Turn caps (`max_turns`) and spend caps (`max_budget_usd`) are native options (`27-…-Python:784, 1659`).
- **Custom tools without a server.** `create_sdk_mcp_server` registers your Python functions as tools
  running *in-process* — "inside your application, not as a separate process" (`11-…-custom-tools:39`).
- **External MCP** over stdio/HTTP/SSE for tools that genuinely live elsewhere (`12-…-MCP`).
- **Subagents.** `agents={...}` with per-agent prompt, tool list, `model` override, and turn caps —
  bounded specialists with isolated context, exactly the orchestrator-worker pattern
  (`14-Subagents:164–182`). The parent sees only the subagent's *return*, not its context.
- **Sessions.** Continue/resume/fork, plus a pluggable `session_store` for external persistence
  (`05-Sessions`, `06-Persist-sessions`).
- **Real streaming.** `include_partial_messages=True` yields raw token-level `StreamEvent`s
  (`09-Stream-responses:9–25`).
- **Permissions.** `allowed_tools` (pre-approval), `disallowed_tools` (removal from context),
  permission modes, and a `can_use_tool` callback (`19-Configure-permissions`).
- **Hooks.** `PreToolUse` / `PostToolUse` / `Stop` / `SubagentStop` etc. — the sanctioned place to
  enforce application rules in code rather than prose (`20-Hooks:151–161`).
- **Structured output, cost/usage events, OTel observability, skills, compaction.**

**The intended division of labour** is stated almost verbatim in the hosting and security docs and
matches the attached document's thesis: *the application decides what exists and what is permitted
(tools, prompts, permissions, hooks, budget); the model decides how to sequence the permitted work.*

Two honest caveats a buyer should hold, because both cost this project real money:

- **The behavior lives in a compiled binary.** The Python package is a thin client; whether the CLI
  honors a given config construction is not verifiable from source. `04B-D2-FINDINGS.md` §4 names this
  exactly, and the record's three "false greens" and the rejected per-agent `timeout` key (§10) are its
  price. The mainstream, well-trodden configurations are reliable; edge constructions must be probed
  live, not reasoned about.
- **Delegation is an option, not an obligation.** The SDK gives the lead a `Task` tool and subagents to
  call. It offers no first-class way to make delegation the lead's *only* possible move. Anything of
  the form "the lead must delegate rather than answer itself" is application policy, enforceable by
  hooks and prompt — the SDK will not enforce it structurally. This gap is the origin of the entire
  worker-visibility saga (§2 below).

---

## 2. Used as designed vs. worked around — feature by feature

### 2.1 Used as designed (and correctly)

| Feature | Where | Verdict |
|---|---|---|
| Loop + turn/budget caps | `vcso_sdk_config.py:264–265` (`max_turns`, `max_budget_usd`) | Native. |
| Real token streaming | `include_partial_messages=True` (`vcso_sdk_config.py:266`), normalized into the existing SSE schema (`vcso_sdk_loop.py` `_NarrationStreamNormalizer`, `stream_vcso_sdk_turn`) | Native, and "normalize, don't couple" is the right pattern — the frontend never learned the SDK. |
| Coding-agent defaults stripped | `setting_sources=[]`, custom `system_prompt`, `thinking disabled`, `DISALLOWED_SDK_BUILTINS` (`vcso_sdk_config.py:39–50, 262–271`) | Exactly what the attached doc's "do not use these defaults blindly" list prescribes. |
| Per-agent model via tier map | `AgentDefinition(model=route["model_name"])` from `resolve_capability_model` (`vcso_sdk_config.py:186–200, 288–307`) | Native; tier authority stays at the capability grain (lock 4). Claude-only guard enforced in code. |
| Hooks for observability + policy | `PreToolUse`/`PostToolUse`/`Stop`/`PreCompact` matchers (`vcso_sdk_loop.py:1999–2008`), LangSmith + usage in `post_tool_use` | Native. Hooks as the enforcement point is the SDK's own recommendation. |
| Sessions + external store | `SupabaseVcsoSessionStore` implementing the SDK `SessionStore` protocol with founder-bound RPCs (`vcso_session_store.py`) | Native, and a genuinely good multi-tenant adaptation (service-role RPCs verifying thread ownership). |
| In-process MCP for registry tools | `create_sdk_mcp_server` per server (`vcso_sdk_config.py:232–235`) | Native (the Path B/C surface). |
| Registry as SDK-config compiler | `compile_founder_sdk_options` joining `tool_registry` × `agent_capabilities` × `mcp_connections` | This *is* Layer 1 of the attached doc — the runtime envelope, generated by the backend, never by the model. |
| Async→sync bridge | thread + `queue.Queue` (`vcso_sdk_loop.py:570–711`) | Unremarkable and fine given the existing sync SSE generator contract. |

### 2.2 The workarounds, each traced to its driving requirement

**W1 — The external loopback worker MCP server (`vcso_worker_mcp_server.py`), referenced inline
per-agent, kept out of top-level `mcp_servers`.**
*Why it exists:* D2's goal was that the lead *reasons* the decomposition and delegates via `Task`
instead of direct-calling the worker handlers (the §16 failure of Fix C, `04B-D2-FINDINGS.md` §2B). The
SDK source proves an in-process server's tools cannot be hidden from the lead (§2A–B), so the only
construction that removes them from the lead's schema is an external server config inlined per-agent
(§2C–§3).
*Is the requirement real?* **Half.** Decompose it: (a) *workers are bounded, founder-scoped, and only
run under an approved delegation* — real, locks 1/7; (b) *the lead cannot even see the handler tools* —
self-imposed. Requirement (b) exists because Fix C's lead, seeing `run_structured_data_agent` in its
schema, called it directly instead of spawning `Task`. But at the time of that observation
(2026-07-16), none of the things that later made delegation reliable existed: no delegation-contract
schema in the prompt (v0.6.76), no per-worker contracts (M3), no `pre_worker_handler_gate` deny hook
(which now denies any handler call where `agent_id` is absent or mismatched —
`vcso_sdk_loop.py:1341–1389`). The hard requirement — the lead must not *execute* the work — is
enforced by that hook regardless of visibility. The soft requirement — the lead shouldn't be *tempted* —
is a prompt/description problem, and possibly a non-problem once the deny hook returns a teaching
refusal. **This was never re-tested after the contract + hook work landed.** The transport was chosen
when it was the only provable mechanism; it was never revisited once the cheaper mechanism's missing
pieces existed.

**W2 — Per-turn (now per-capability) signed tokens + process-global `TURN_REGISTRY`
(`vcso_worker_mcp.py:140–204`).**
*Why it exists:* the loopback endpoint is a fresh request context with no reference to the live turn's
state, so founder scope, prior findings, progress bridge, and dedupe state must be re-materialized by
token (`04B-D2-FINDINGS.md` §8 Discovery 1).
*Is the requirement real?* Founder isolation is absolutely real — but the token machinery is
**second-order complexity: a workaround required by another workaround.** In-process tools carry founder
scope in their closure (`_make_sdk_tool` already does this for the Path B surface); no registry, no
token, no eviction timer, no single-process constraint. Every property this module defends is a
property the in-process path gets for free.

**W3 — `MCP_TOOL_TIMEOUT=240000` living only in Railway env, and the rejected per-agent `timeout`
key that silently killed delegation (Canary 7).**
*Why it exists:* the ~113s sandbox worker exceeds the CLI's ~60s default MCP tool-call timeout
(`04B-D2-FINDINGS.md` §10; `TIER2-CLOSE-HANDOFF` §3 marks it CRITICAL INFRA).
*Is the requirement real?* Only downstream of W1. An in-process tool call is not an MCP client call
from the CLI's perspective in the same way — and the existing per-tool heartbeat in `_make_sdk_tool`
already covers long in-process executions. This is a pure product of the transport.

**W4 — The DB completion bridge + graceful-compose (`model_driven_completed_children`,
`stop_hook` consultation, `vcso_sdk_loop.py:714–750, 1518–1533`).**
*Why it exists:* an out-of-process worker whose in-band return is lost (timeout, re-sent `tools/call`)
still wrote its child row, so the app consults the DB to avoid discarding finished work.
*Is the requirement real?* Downstream of W1/W3. In-process, the tool's return *is* the in-band result;
the entire out-of-band reconciliation class dissolves. (The semantic-vs-transport status fix from
`g-gate-result-integrity.md` is the part worth keeping in any architecture.)

**W5 — Stream keepalive on the drain loop (`vcso_sdk_loop.py:654–697`).**
*Why it exists:* nothing touched the SSE queue while the out-of-process worker ran; Railway's edge
kills ~2-minute-silent streams (killed Canary 9).
*Is the requirement real?* The general concern (long agentic turns over SSE through an edge) is real in
any architecture, but the *silence* was created by W1 — in-process tools already emit per-tool
heartbeats. Keep the keepalive as cheap belt-and-braces; note its cause honestly.

**W6 — Hooks compensating for hooks: `pre_task_use` contract validation + once-per-turn +
dependency-order enforcement; `stop_hook` blocking on missing required workers; cheap give-up counters
(`vcso_sdk_loop.py:1267–1339, 1513–1602, 181–190`).**
*Split verdict.* Contract validation and depth/budget gates are **legitimate application policy at the
SDK's sanctioned enforcement point** — this is what hooks are for, keep them. The *required-worker
blocking* is different in kind: it is the app re-imposing a fixed worker set over a loop that is
supposed to be model-driven — a hybrid that is neither Path A nor the thesis. It exists as canary
scaffolding (pinning the anchor shape), which the roadmap admits ("app-gated, so system-level not
model-level restraint" — Progress tracker, M3 entry). Fine as scaffolding; it must not survive Phase G,
and the give-up counters exist only because the blocking does.

**W7 — App-gated effort-scaling: `P4_THIN_SLICE_SIGNALS` regex + intent gates deciding whether a turn
is a delegation turn at all (`native_subagent_requirements`, `vcso_sdk_loop.py:326–365`; the
`\b90\s+days?\b` regex whose hyphenated variant silently no-ops, `TIER2-CLOSE-HANDOFF` §5.3).**
*Verdict:* deliberate, documented canary pinning — but name the irony: the migration that exists to
retire keyword routing currently admits its flagship capability *through a keyword route*. Rubric #1 is
therefore proven only inside a rule-routed gate. The roadmap knows this (Phase G is defined as relaxing
it); the assessment's job is to insist it actually gets relaxed rather than calcifying.

**W8 — The composer-integrity gate (`COMPUTE_REQUEST_SIGNALS` regex + refusal template + cited-compute
requirement, `vcso_sdk_loop.py:80–94, 751–826`).**
*Why it exists:* both G-gate runs fabricated numbers (`04B-G-GATE-FINDINGS.md` §2–§3).
*Is the requirement real?* **Yes, fully** — this is constraint 3 enforced in code, precisely the
attached doc's "if violating a rule would create a data-integrity problem, enforce it in code, not
prose." This is not a workaround; it is the system working. The regex *classifier* is the fragile part
(a compute question phrased outside the pattern bypasses the gate; a non-compute question matching it
gets a blunt refusal) — worth revisiting, but the enforcement point is right.

**W9 — Dual delegation-tool names (`Task` provision / `Agent` runtime), `tools=[]` disabling the
delegation built-in, disallow-list blocking the runtime name (`vcso_sdk_config.py:23–37`; M2 finish log
"post-canary local CLI experiment").**
*Verdict:* genuine SDK sharp edges, well-documented in the constants once found. Their discovery cost
was amplified by how unusual the construction is — a lead with an empty tool schema plus one delegation
tool is an edge path few SDK users exercise, so the team was off the beaten track where documentation
is thinnest. The knowledge is now banked; it survives any engine change.

---

## 3. Mapping onto the attached document's five layers

| Layer (attached doc) | Where it lives today | Placement verdict |
|---|---|---|
| **1. Product control plane** | `platform_ai_settings` flags + allowlists; `agent_capabilities` grants; `tool_registry` enabled/`is_code_registered` overlay; `mcp_connections` fail-closed check; `compile_founder_sdk_options` emitting the per-founder envelope; Claude-only guard | **Correct and healthy.** The compiled options object *is* the doc's "runtime envelope generated by the backend." |
| **2. Knowledge & retrieval plane** | `vcso_source_router.py` (deterministic cheapest-first tier ladder) as *pre-assembly*; `retrieval.py`, wiki read services, `structured_query` — reachable only *inside workers* | **Misplaced relative to the doc — in an interesting direction.** The doc wants purpose-built retrieval tools exposed *to the agent*. Today the native lead has **zero** retrieval tools: `vcso_sdk_config.py:111–114` empties `selected` in native mode, so the lead's surface is `Task` + pre-approved worker handlers only. Consequence: there is no "Mode B" (retrieval-assisted answer). Every question is either pre-assembled context (Mode A) or a full worker delegation (Mode C). A one-fact lookup that misses the pre-fetch must either be answered from stale context or pay for a delegation. |
| **3. Deterministic capability services** | `SubAgentOrchestrator`'s seven handlers; `sandbox_*` services; `structured_query` | **Right assets, wrong position.** The doc says these "should become tools or services the agent calls." Instead they sit *behind* the orchestration plane, wrapped by shim subagents across an HTTP hop. Consequences: the double model layer (§0.3), the entire W1–W5 chain, and thin tool descriptions at the point of the lead's decision (the lead reasons over agent descriptions, not rich tool schemas — relevant to the under-delegation finding, since Anthropic's own guidance says selection quality rides on tool description quality). |
| **4. Agent orchestration plane** | `vcso_sdk_loop.py` | **Present, but carrying layers 1 and 5 logic in hooks.** Contract validation and policy gates belong here; required-set choreography (W6) is L4 authority the app took back from the model — acknowledged scaffolding that must sunset in G. |
| **5. Output / persistence / governance** | `agent_delegation_runs/steps`, message persistence, `SupabaseVcsoSessionStore`, composer-integrity gate, curated `sub_agent_step` events, citations rail | **Correct and healthy.** One-writer holds — nothing in the loop or workers writes the wiki (grep-verified: no wiki-write path in `vcso_sdk_loop.py` / `vcso_worker_mcp.py`; boundaries strings forbid it and no tool exists for it). The G-gate integrity fix (semantic status + attribution persistence) strengthened this layer. |

The doc's knowledge hierarchy (its Tiers 0–6) maps cleanly onto the internal Tier 0–3 + proprietary IP
+ live-external model; no conflict worth arbitrating. Its Mode A/B/C execution split is the one piece
the current system genuinely lacks (Mode B), and its "do not use the agent for every message" is
already honored via flag gating, intent triage, and the planner path.

---

## 4. Diagnosing the complexity — defect class by defect class

Method: for each class in the evidence record, would it exist under a native setup — defined as
*workers as SDK subagents holding real founder-scoped in-process tools, hook-enforced policy, no
external transport*?

**4.1 Phase D native-worker denial → the visibility saga (D-REMEDIATION §§10–17).** The lead either
couldn't call handler tools or, once it could, direct-called them instead of delegating. Created by
wrapping workers as handler-tools that had to be simultaneously callable-by-subagent and
invisible-to-lead — a shape the SDK has no native support for. Under a native setup the *granular*
tools are scoped per-agent by `AgentDefinition.tools` and the lead is denied by hook; the "hide the
wrapper from the lead" problem does not arise because there is no wrapper. **Integration-created.**

**4.2 Stage H (`tools=[]` disables Task) + Task/Agent dual naming + disallow-list blocking the runtime
name (M2 finish log; `vcso_sdk_config.py:23–37`).** SDK sharp edges met on an edge path.
**Inherent-to-SDK friction, integration-amplified** — a mainstream construction would likely have met
one of these, not all three. Sunk learning, permanently banked in code comments.

**4.3 Defect 6 — silent `dontAsk` denial of subagent worker calls (`04B-D2-FINDINGS.md` §9).**
Subagent MCP tools must be pre-approved on the *parent's* `allowed_tools`; nothing surfaced the denial.
The silent-denial behavior is an SDK ergonomics flaw (a denial that produces zero observable events is
hostile to operators). But the situation — a worker tool that exists only on a per-agent external
server, absent from every top-level list — is the W1 construction. **Integration-created; SDK
ergonomics aggravated.** Under a native setup the same pre-approval rule applies but would have been
hit once, on a well-lit path, with the granular tools.

**4.4 Canary 7 (rejected `timeout` key) + the `MCP_TOOL_TIMEOUT` env landmine (§10).** Entirely
downstream of the HTTP hop. **Integration-created.** Also the single scariest operational artifact in
the record: a load-bearing behavior that exists only as an unversioned infra setting, whose loss
degrades delegation silently.

**4.5 Defect 7 — cross-worker tool calls (§11).** The hand-rolled token authorized per-turn, not
per-subagent; the sandbox subagent called the structured-data tool, the dedupe served it a cached
result, and a canary burned $0.22 producing nothing. The lesson generalizes: **a hand-rolled
authorization layer has hand-rolled scoping bugs.** Under a native setup, per-agent `tools=` lists are
the CLI's own availability scoping, and the founder-scope check lives in the tool closure; the
defense-in-depth *requirement* (isolation enforced in code we control) is real and stays, but the
bespoke token grain that carried the bug would not exist. **Integration-created.**

**4.6 Canary 9 stream death, keepalive, Defect 8 recovery (M2 finish log; M3 completion).** Long
silent SSE streams through an edge proxy are a real hosting problem in any architecture (the SDK
hosting doc discusses exactly this class). The *specific* silence — nothing on the queue while a worker
runs out-of-process — is W1's. **Mixed: ~half inherent, half integration-created.** The disconnect
*recovery* work (persist-then-recover, both disconnect shapes) is engine-independent and survives
anything.

**4.7 Composer fabrication (G-gate runs 1–2) and stale-wiki figures (`04B-G-GATE-FINDINGS.md` §2–3).**
The composer asserted scenario math it derived itself from a stale $45k wiki figure while the sandbox
returned `could_not_compute` on an empty series. **Inherent — engine-independent.** This is what a
strong LLM does when handed stale context, an impossible compute task, and an instruction to be
helpful. Any architecture — hand-rolled, SDK, or the attached doc's five layers — needs exactly the
three fixes now in motion: the output-integrity gate in code (landed), the financial series (Phase F),
and a freshness/authority policy (North Star §5, still absent). The fail-open at
`vcso_sdk_loop.py:1867` (failed Path A delegation falls through to the standard SDK path) made this
live rather than dark — an integration detail worth keeping closed, but not the cause.

**4.8 Under-delegation under model choice (G-gate run 2).** Left to choose, the lead skipped the
sandbox and did "defensible assumption" math. **Inherent to the thesis** — model-driven capability
selection is a prompt/description/contract engineering problem in every architecture (Anthropic's own
multi-agent writeup names it). London's native-reasoning-first decision is the right response. One
engine note: the current design gives the lead *less* to reason over than a native setup would — it
sees `Task` plus short agent descriptions, not rich tool schemas; richer, well-described tools are the
documented lever for better selection.

**4.9 Transport-vs-semantic status conflation (`g-gate-result-integrity.md`).** `status=completed` on
the child row meant "the plumbing ran," and the bridge read it as "the work succeeded." A classic
distributed-systems bug class; the *dual channel* (DB row vs in-band return) that invited it is W1/W4's.
**Mostly integration-created; the fix (semantic status normalization) is keep-forever.**

**4.10 Deep Mode toggle latch (`deep-mode-toggle-latch.md`).** Frontend prop-wiring bug on a render
branch. **Unrelated to the SDK.** Included for honesty: not every defect in this record is the
integration's.

**Summary table** (reasoning above governs):

| Defect class | Created by integration | Inherent to bounded workers over founder data |
|---|---|---|
| 4.1 visibility saga | ● | |
| 4.2 SDK sharp edges | ◐ (amplified) | ◐ |
| 4.3 Defect 6 | ● | |
| 4.4 timeout/env landmine | ● | |
| 4.5 Defect 7 | ● | (defense-in-depth need is inherent) |
| 4.6 stream death/keepalive | ◐ | ◐ |
| 4.7 fabrication/staleness | | ● |
| 4.8 under-delegation | | ● |
| 4.9 status conflation | ◐ | ◐ |
| 4.10 UI latch | | (neither — frontend) |

The pattern is stark: the isolation/transport cluster (4.1, 4.3, 4.4, 4.5, and half of 4.6/4.9) is one
architectural decision expressing itself repeatedly. The honesty cluster (4.7, 4.8) is the product's
real frontier and is engine-independent.

---

## 5. The fit-for-purpose target

What should be **deterministic and application-owned** (unchanged from today, named to be explicit):
identity and founder isolation (auth → per-founder store → RLS); the per-founder SDK-config compile
(`compile_founder_sdk_options` — capabilities × registry × connections × tier map); context *selection*
(working state, tiered pre-fetch, wiki components — the proven ~54% input cut); budget/turn/depth caps
in `ClaudeAgentOptions` and hooks; the one-writer rule (no wiki-write tool exists, ever, on any
surface); persistence and citations (`agent_delegation_runs/steps`, source refs, the SOURCES rail);
the composer output-integrity gate; the SSE contract and curated transparency; deterministic canonical
calculations when Phase F lands them (concentration, margin, runway as *services with tests*, per the
attached doc's Layer 3 — the sandbox remains for genuinely novel derivations those services don't
cover).

What the **agent decides**: whether a turn needs delegation at all (once G relaxes the gates); which
workers, in which order, with what objectives (the delegation contracts); when evidence is insufficient
and the turn should reflect-and-steer instead of compose (the North Star's third terminal mode — still
unbuilt, and it is the *product* answer to fabrication pressure: a composer that is allowed to say
"here's the gap" fabricates less than one whose only permitted terminal is an answer).

Where **custom work layers on** to make this ArchitectOS rather than a generic agent with a business
prompt — concretely, by name:

- **Worker subagents that own real tools.** `structured_data` subagent (Haiku) holding
  `structured_query` tools; `wiki` subagent holding `wiki_read`/component tools; `sandbox` subagent
  holding the sandbox-bridge tool; each with the delegation-contract prompt it already has, per-agent
  `model` from the tier map, `maxTurns` bound, tools registered on the **in-process** server with
  founder scope closed over at compile time (the `_make_sdk_tool` pattern). The
  `SubAgentOrchestrator` handlers' *contents* become these tools; its persistence (run/step rows,
  progress emission) moves to `SubagentStart`/`SubagentStop`/`PostToolUse` hooks — or, in the leaner
  variant (§6), the handlers stay whole as in-process tools and the orchestrator survives untouched.
- **A Mode-B lane for the lead:** two or three cheap, read-only, founder-scoped tools on the lead's own
  surface — `read_wiki_component`, `get_structured_record` — so a retrieval-assisted answer costs one
  tool call, not a delegation. (This is the attached doc's Layer 2 done properly, and the missing
  middle mode identified in §3.)
- **Enforcement points:** founder isolation at tool construction + RLS (not at a token check across an
  HTTP hop); "founder-data tools only inside an approved delegation" via the existing
  `pre_worker_handler_gate` deny (agent-identity-keyed); provenance via tool envelopes + the integrity
  gate; freshness policy inside the retrieval tools themselves (a tool that knows when to prefer a live
  pull over a wiki page — Phase F).

This is the attached document's own shape — with the correction that ArchitectOS's differentiators
(context selection, tier map, citations, one-writer, curated transparency) are already built and
already in the right layers. The distance to the target is one seam, not five layers.

---

## 6. The straightest line from here to there

Nothing below flips a flag, prunes Path A, or edits the harness roadmap. Every step is founder-gated.

**Step 0 — Decide nothing yet; run the probe.** *(cost: 1–2 dark canaries + a local CLI experiment;
risk: none — flags dark, Path A untouched)*
The probe question, precisely: **with the worker capabilities exposed as in-process tools granted
per-agent (`AgentDefinition.tools`), pre-approved on the lead per Defect-6 learning, and the
`pre_worker_handler_gate` deny hook refusing any non-delegated call with a teaching reason — does the
lead delegate via `Task` at the M3 reliability bar (5/5 on the pinned anchor)?** This re-tests Fix C
*with* the contract schema, per-worker contracts, and deny hook that did not exist when Fix C failed on
2026-07-16. A local CLI experiment (the technique that found the Task/Agent split for cents) should
precede any canary. Gate: 5/5 pinned-anchor passes with zero handler direct-calls executed.
- **If the probe fails** — the lead persistently direct-calls despite hook denial, or the CLI's
  permission surface breaks subagent in-process calls in some new way — then W1 stands as the least-bad
  proven mechanism. Write that down as a positive finding, stop paying architectural guilt on it, and
  harden what exists (move `MCP_TOOL_TIMEOUT` into code-managed env at minimum). The rest of this plan
  degrades gracefully to steps 3–6, which are engine-independent.

**Step 1 — Deletion: retire the external transport.** *(only on a passed probe; net-negative code)*
Delete `vcso_worker_mcp_server.py`, the `TurnRegistry`/token machinery in `vcso_worker_mcp.py`, the
`main.py` mount + lifespan shim, the `MCP_TOOL_TIMEOUT` dependency, and the single-process constraint
(harness `CONTEXT.md` decision 9 becomes obsolete — a real scaling ceiling removed). Port and keep:
semantic status normalization, findings-chaining as app-owned data flow, the diagnostics trail,
degraded-worker progress emission. Much of the rest (dispatch dedupe for re-sent `tools/call`,
completion bridge, out-of-band rescue) dissolves with the hop that necessitated it. Gate: the M3 bar
re-proven (5/5 pinned anchor, correct tiers, citations intact) + the Defect-7-equivalent negative test
(a worker cannot reach a sibling's tool — now enforced by per-agent `tools=` + closure scope).

**Step 2 — Rework: collapse the shim layer (choose the depth deliberately).**
Two honest options, in ascending ambition:
- **2a (lean):** handlers stay whole; each subagent's single tool is the in-process handler tool.
  Smallest change; keeps the double model layer (Haiku shim + handler's own Anthropic calls) but
  removes every transport artifact. Acceptable as the D2-successor resting state.
- **2b (full):** handlers dissolve into per-agent granular tools; the subagent *is* the worker;
  orchestrator persistence moves onto subagent hooks. One model layer, richer tool descriptions at the
  lead's decision point (the §4.8 lever), and the shape Domain Agents should inherit. Costs real
  rework of the C2 nested-UI wiring (native `parent_tool_use_id` already exists) and re-verification of
  run/step persistence. This can wait until after Phase F; it should not wait past Domain-Agent
  composition, because whatever engine exists then gets multiplied by five domains.

**Step 3 — Addition: the Mode-B lane.** Two read-only founder-scoped tools on the lead. Gate: a
retrieval-assisted question answers with one tool call, cited, no delegation, at a fraction of Mode-C
cost. *(engine-independent; can land regardless of probe outcome)*

**Steps 4–6 — The already-planned phases, unchanged in substance:** E (sessions — native SDK usage,
unaffected by any of this), F (financial series + QuickBooks MCP + freshness policy — the prerequisite
for honest numeric answers and the real fix for §4.7), G (generalization — relax W6/W7 scaffolding,
run the archetype rubric, then cutover on parity). The reflect-and-steer terminal mode belongs in G's
scope explicitly; it is currently nobody's deliverable and it is rubric line 5's other half.

**What survives untouched:** all seven handler implementations' contents, the registry + compiler, the
C2 surface and SSE contract, the session store, the source router, the persistence schema, Path A
(dark, per the standing rule), every lock, and the entire evidence discipline.
**What is genuinely sunk:** the six burned versions and the canary spend that mapped the CLI's edge
behaviors (~$1–2 of API spend by the logged figures, plus the real cost: engineering days). Sunk but
not wasted — the behavioral knowledge is banked in constants, comments, and findings docs, and it is
exactly what makes the probe cheap now.
**Cost of doing nothing:** every future phase inherits the transport's operational surface — an
unversioned env-var dependency, a single-process ceiling, out-of-band completion machinery, and a
defect family (6, 7, timeout, keepalive) that will re-express in variants as the worker set grows from
3 to 7 capabilities and then to five Domain Agents on "the same substrate" (rubric #9). The interest
compounds precisely because the substrate is meant to be shared.

---

## 7. What would change my mind

- **The probe (§6 step 0) is the load-bearing observation.** My central recommendation rests on one
  assumption the record does not prove: *that a lead whose direct handler calls are hook-denied with a
  teaching reason will delegate reliably instead of thrashing.* The record proves the pieces separately
  (deny-by-agent-identity works: `pre_worker_handler_gate` is live in the model-driven path; contracts
  + prompts made delegation 5/5 *with* transport isolation) but never together without the transport.
  If the probe fails at the M3 bar, W1 is vindicated and I would keep it.
- **Unverified CLI semantics, named as such:** whether a Task subagent's call to an *in-process* SDK
  server tool flows cleanly under `dontAsk` with parent pre-approval (Defect 6's rule) — the Fix C era
  proved the lead could call these tools; it never produced a clean subagent-calls-in-process-tool
  observation. The local CLI experiment answers this for cents before any canary.
- **Cost math:** I claim the shim layer double-pays models. Canary evidence shows near-zero worker LLM
  cost on the structured worker (M2 finish log, Canary 5 follow-up: "no separate worker cost"), which
  *weakens* the cost half of my 2b argument for cheap workers — the shim's overhead may be latency and
  complexity more than dollars. If Phase F's real compute workers show the same, 2b's justification is
  architecture and description-richness, not spend; I'd still do it, later.
- **Data reality bounds everything:** with one seed P&L row and zero `mcp_connections`, every
  reliability claim (mine included) is proven on nearly-empty data. If Phase F's series changes worker
  behavior materially (bigger payloads, longer runs), re-examine the timeout and streaming conclusions
  then — on either engine.
- **If London's other assessment converges on the same seam** (the worker transport) from different
  evidence, that is strong signal. If it locates the core problem elsewhere — e.g., in the SDK
  subprocess model itself being unfit for multi-tenant hosting — I would want that argued against the
  hosting doc's session-pattern guidance before accepting it, because the record here shows the
  subprocess model working (streaming, sessions, hooks all behaved; the defects clustered elsewhere).

---

## 8. Grading against the §4 rubric

Scoring **current trajectory** (the system as it stands, dark, heading into E→F→G-gate as re-sequenced)
and **proposed** (§6, probe-gated). Keys: ✓ proven · ◐ partial · ○ open. Honest regressions flagged.

| # | Intent | Current | Proposed | Notes |
|---|---|---|---|---|
| 1 | Reasons, doesn't rule-route | ✓ anchor / ○ general — **with the flag that the anchor is admitted through a regex gate (W7), so the proof lives inside a rule-route** | same ✓/○; cleaner path to relaxing gates (richer tool surface is the documented selection lever) | No regression; G owns generalization on either engine. |
| 2 | Plans visibly | ✓ (in-flight, completion, reload — M4) | ◐ **transiently regresses during step 1–2 rework** (nested-UI wiring must be re-verified on native `parent_tool_use_id`), then ✓ | Named regression; gate on the C2 reload proof re-passing. |
| 3 | Delegates to cheap bounded specialists | ✓ on anchor + control | ✓; 2b removes the shim model layer | Worker-cost evidence (§7) says the dollar delta may be small; the tier lock holds on both. |
| 4 | Composes founder-grade, cited judgment | ✓ mechanism (33-citation answers) / **◐ substance** — G-gate showed fabrication until the integrity gate; numeric substance waits on F | same | Engine-independent; the gate + F are the fix on both paths. |
| 5 | Honest about gaps | ◐ — the integrity refusal is a blunt regex-triggered template; reflect-and-steer (the real "honest about gaps" behavior) is unbuilt | ◐ — same, until steer lands in G | Neither engine moves this line; scope steer explicitly (§6). |
| 6 | Feels native | ✓ | ✓ | Keepalive kept as belt-and-braces either way. |
| 7 | Safe & bounded | ✓ (Defect 7 closed; enforced in code) | ✓ **with a named transitional risk:** the token registry is an *explicit* auth artifact; in-process closures are implicit. The probe gate must include the cross-worker negative test and the founder-isolation adversarial checks before this line is re-marked ✓ | The only line where the proposal temporarily *weakens* the evidence (not the mechanism). Do not skip the negative tests. |
| 8 | Generalizes across the real question space | ○ | ○ | Unchanged; the gate before exposure on either engine. |
| 9 | The substrate serves Domain Agents | ◐ — the substrate works but Domain Agents would inherit the token/transport/env machinery and the single-process ceiling | ◐→ stronger — they'd inherit subagent definitions + scoped tools, which is the composable shape | This line is where the two trajectories diverge most, because five domains multiply whatever engine exists. |

**Bottom line for London.** The current trajectory is disciplined, observation-backed, and *not* in
need of rescue — graded on the rubric it is passing where it claims to pass and honest where it is
open. But it is carrying one architectural loan taken out on 2026-07-16 under duress (the only
then-provable mechanism for lead-invisibility), and the record shows the interest payments: six burned
versions, five defect classes, two infra landmines, one scaling ceiling. The conditions that forced the
loan no longer hold. One cheap, dark, founder-gated probe determines whether it can be paid off. If it
can: delete the transport layer, keep everything else, and proceed to E/F/G on a smaller machine. If it
cannot: keep the transport with a clean conscience, harden its two landmines, and proceed anyway —
because the product's real frontier (fabrication, freshness, generalization, reflect-and-steer) was
never in that layer to begin with.

---

## Evidence index

| Claim | Source |
|---|---|
| SDK = CLI subprocess over stdio; one session = one subprocess | `Agent-SDK-Setup/25`:19–25 |
| In-process custom tools via `create_sdk_mcp_server` | `Agent-SDK-Setup/11`:7–39 |
| Subagents: per-agent prompt/tools/model, isolated context | `Agent-SDK-Setup/14`:164–182, 214–215 |
| Sessions continue/resume/fork; `session_store` | `Agent-SDK-Setup/05`, `06` |
| Token streaming via `include_partial_messages` | `Agent-SDK-Setup/09`:9–25 |
| Permission evaluation; `allowed`/`disallowed` semantics; `dontAsk` never calls `canUseTool` | `Agent-SDK-Setup/19`:25–114 |
| Hook events incl. PreToolUse/Stop/SubagentStop | `Agent-SDK-Setup/20`:151–161 |
| `env` merge; `extra_args`; `setting_sources` | `Agent-SDK-Setup/27`:846–872, 958–984 |
| Pre-migration loop: 3,155 lines, blocking call, 160-char fake stream | 04B `CONTEXT.md` "Verified current-state findings" |
| P4 rollback (dropped sandbox child, twice) as migration trigger | 04B `CONTEXT.md` "Why this proposal exists" |
| Keep/replace/rework ledger; context-selection ~54% input cut | 04B `CONTEXT.md` ledger + context-assembly split |
| In-process server tools cannot be hidden from the lead; external inline per-agent is the only construction | `04B-D2-FINDINGS.md` §2A–C |
| Fix C lead direct-called `run_structured_data_agent` (`agent_id_present=false`) | `04B-D2-FINDINGS.md` §2B; `04B-D-REMEDIATION.md` §16–17 |
| Loopback endpoint = fresh request context → token + `TURN_REGISTRY` | `04B-D2-FINDINGS.md` §8 Discovery 1; `vcso_worker_mcp.py`:1–31, 140–204 |
| Manifest invariants inverted twice (Discovery 2 → Defect 6 inversion) | `04B-D2-FINDINGS.md` §8, §9 |
| Defect 6: silent `dontAsk` denial; fix = parent pre-approval | `04B-D2-FINDINGS.md` §9; `vcso_sdk_config.py`:138–143, 245–249 |
| Per-agent `timeout` key rejected by deployed CLI; `MCP_TOOL_TIMEOUT=240000` env-only | `04B-D2-FINDINGS.md` §10; `TIER2-CLOSE-HANDOFF` §3 |
| Defect 7: cross-worker calls; per-(turn,capability) token fix | `04B-D2-FINDINGS.md` §11; `vcso_worker_mcp.py`:155–172 |
| Single-process constraint (`TURN_REGISTRY` process-global; no `--workers`/`WEB_CONCURRENCY`) | harness `CONTEXT.md` decision 9; `TIER2-CLOSE-HANDOFF` §3 |
| Task/Agent dual naming; `tools=[]` disables delegation; disallow-list blocked runtime name | `vcso_sdk_config.py`:23–50; M2 finish log "post-canary local CLI experiment", "Canary 2" |
| Canary 8: three-worker chain, 113s sandbox in-band, $0.1454 compose, 33 citations | M2 finish log "Canary 8"; `TIER2-CLOSE-HANDOFF` §1 |
| Canary 9 stream death; non-delegation thrash ~$0.107; keepalive motivation | M2 finish log "Canary 9"; `vcso_sdk_loop.py`:654–697 |
| M3: 5/5 pinned anchor, order varied while dependency held; Defect 7 guard watched firing | `04B-D2-M3-COMPLETION.md`; ROADMAP progress tracker D2 row |
| Lead has zero registry tools in native mode (no Mode B) | `vcso_sdk_config.py`:111–114, 242–249 |
| Deny-by-agent-identity hook exists and runs in model-driven path | `vcso_sdk_loop.py`:1341–1389 (`pre_worker_handler_gate`) |
| Required-set stop-hook blocking + cheap give-up counters | `vcso_sdk_loop.py`:1513–1578, 181–190 |
| DB completion bridge for out-of-band workers | `vcso_sdk_loop.py`:714–750, 1518–1533 |
| App-gated effort-scaling regex (`90\s+days?`); hyphen no-ops | `vcso_sdk_loop.py`:76–79, 326–365; `TIER2-CLOSE-HANDOFF` §5.3 |
| Composer fabrication on both G-gate runs; stale $45k vs live $480k; under-delegation on run 2 | `04B-G-GATE-FINDINGS.md` §2–3 |
| Fail-open of failed Path A delegation to standard SDK path | `04B-G-GATE-FINDINGS.md` §6 (cites `vcso_sdk_loop.py`:1867) |
| Composer-integrity gate (regex trigger + cited-compute requirement) | `vcso_sdk_loop.py`:80–94, 751–826 |
| Semantic vs transport status fix; attribution persistence | `.planning/debug/g-gate-result-integrity.md` Resolution |
| Handlers make their own Anthropic calls (double model layer) | `sub_agent_orchestrator.py`:10, 515–551, 676, 744 |
| Worker LLM cost ~zero on structured worker (weakens the cost half of 2b) | M2 finish log, Canary 5 "Open follow-up for tier 2" |
| Founder-bound session store via service-role RPCs | `vcso_session_store.py`:28–113 |
| Deterministic tier-ladder pre-fetch (keyword-signaled) | `vcso_source_router.py`:39–109 |
| One seed P&L row; `mcp_connections` = 0 | prompt-supplied facts; `04B-G-GATE-FINDINGS.md` §2 corroborates the empty series |
| Deep Mode toggle latch = frontend prop bug, not SDK | `.planning/debug/deep-mode-toggle-latch.md` |
| One-writer: no wiki-write tool on any loop/worker surface | absence verified by search of `vcso_sdk_loop.py` / `vcso_worker_mcp.py`; boundaries strings at `vcso_sdk_loop.py`:99–178 |

**Unverified items, stated as such:** CLI consumption semantics for subagent calls to in-process
server tools under `dontAsk` (the probe's question); whether `AgentDefinition.tools` availability
scoping alone would have prevented Defect 7's cross-call at the CLI layer (the record shows the call
reached the app; the CLI-side behavior was never isolated); the v0.6.104 in-flight recovery has not
been observed running (per M3 completion's own honest limit); the `wiki_*`→OSE Layer-1 projection
remains unverified (harness Conflict O2 caveat).
