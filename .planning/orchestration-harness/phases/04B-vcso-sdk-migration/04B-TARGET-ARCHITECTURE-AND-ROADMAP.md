# 04B — Target Architecture & Roadmap (Step 0 output)

**Date:** 2026-07-28 · **Status:** Founder-aligned decision record. Nothing built, nothing flipped.
**Purpose.** The single artifact every downstream agent builds against. It records the Step 0 decisions,
corrects the current-state picture with grounded evidence, defines the target tool inventory and agent
map, writes the reflect-and-steer and `ask_user` requirements together, states the knowledge-hierarchy
authority rule in the form it will take in code, and sequences the work with its gates.

**Inputs.** `Understanding Agent SDK Integration.md` (founder-supplied outside view);
`04B-VISION-AND-INTENT.md` (§4 rubric); `04B-SDK-INTEGRATION-INDEPENDENT-ASSESSMENT.md`; a parallel
reconciliation review held outside this folder; the D2/G-gate evidence record; the live code.

**Supersedes nothing.** Phase plans E/F/G remain the plan of record for their own scope; this document
changes what they are built *onto* and, for E, what it is scoped *to*.

---

## 1. Decision record

| # | Decision | Rationale |
|---|---|---|
| D1 | **Adopt the "2b" shape: capabilities become granular tools; the subagent is the worker.** No shim subagent whose only job is to call one wrapper tool. | Domain Agents are the next major workstream. Whatever engine exists then is built on five times. A shim layer we already know is redundant must not be the thing five domains inherit. |
| D2 | **2b lands *before* Phase F.** | F authors new capabilities (connector reads, the financial series). Built into the handler shape and re-authored later, they get built twice. |
| D3 | **Tools are the durable asset; subagent definitions are configuration.** Author tools at the grain Domain Agents will need. Keep subagents capability-shaped through the probe. | Switching to domain-shaped subagents at the same moment as the transport change alters two variables and voids the pinned-anchor comparison. Domain agents can then be defined as prompt + tool subset + model + filters, with no new plumbing. |
| D4 | **No calculation services in 04B.** The only calculations that must be deterministic are those where ArchitectOS IP defines the single correct answer (MRA aggregation, AE Ladder stage calibration, 3P classification) — and those live outside this workstream. | Client concentration, margin, and runway have no canonical definition; they depend on the question and the data. Encoding one interpretation produces a service that accretes parameters until it is a small programming language. That is the rigidity this migration exists to escape. |
| D5 | **Phase F's job is data, retrieval, and freshness — not calculations.** | The G-gate failure was not a missing concentration service. It was an empty series with a composer filling the vacuum. Real data plus a cited derivation contract dissolves most of the calculation question. |
| D6 | **The sandbox is a tool, not a subagent** — `execute_code` on the lead's surface, gated by a hook requiring a prior successful data retrieval in the same turn. | It is a bounded execution service, not a judgment role. Wrapping it in a model layer adds cost and a decision point. The hook makes "never compute on nothing" structural rather than a prompt instruction. |
| D7 | **Mode B ships as part of the probe surface, not after it.** | The lead's delegation decision changes when it has retrieval tools. Probing without them tests a configuration we are not shipping. |
| D8 | **Minimal worker inventory first, probe early, complete after.** "Minimal" applies to the worker side only — the Mode B tools are not optional in the subset. | Get the architectural answer before authoring an inventory for a path we may not take. Accepts a lighter re-verification later in exchange for not overbuilding. Stage gates, not rebuilds. |
| D9 | **Reflect-and-steer is a required, standard behaviour.** Requirement written now, built in Phase G, **designed jointly with `ask_user`.** | It is the third legitimate ending of a turn and the structural answer to fabrication pressure. Designed separately from `ask_user`, the two mechanisms will overlap and the firing rule will be ambiguous. |
| D10 | **Phase E is re-scoped**: `ask_user` and sessions on the single path; no founder-facing Deep Mode toggle. | Deep Mode today disables model-driven delegation outright (`vcso_chat_service.py:445`) and buffers the answer stream, and has never been used — zero deep messages across 215 messages / 91 threads. Proving it would prove a mode that switches off the capability the probe validates. |
| **D10a** | **AMENDED 2026-07-29 (London). The Deep Mode toggle and its routing gate are removed NOW, before the probe retry — not in Step 4.** The larger Phase E rework (`ask_user` + sessions on the single path, with its own gates) stays at Step 4; the landed session work (v0.6.118–125) becomes dormant, present and unreachable. | Original sequencing deferred this on "one variable at a time" reasoning. That reasoning was wrong: **Deep Mode is not a variable in the experiment, it is a tripwire that voids it.** Canary Run 1 (`d8fdad87`) was submitted with the toggle on, persisted `sdk_phase=04B-E` / `deep_mode=true`, and never compiled the native surface. Detecting this condition with a guard is weaker engineering than deleting its cause. |
| **D12a** | **AMENDED 2026-07-29 (London). Keyword *eligibility* is removed NOW** — `P4_THIN_SLICE_SIGNALS` comes off the native path and eligibility becomes flag-on **plus** founder-allowlisted. The **required-worker set** is held through Step 2 and retired in G. | The regex was doing eligibility work an allowlist should do, and it is the exact keyword route this migration exists to retire — rubric #1 cannot be claimed while the flagship capability is admitted by phrase match. Eligibility becomes deterministic and app-owned; execution stays model-driven. The required set is held only because **Mode B means delegation is no longer structurally forced**, so without a control a reasonable Mode B answer and a genuine mechanism failure are indistinguishable in the evidence. |
| D11 | **The knowledge hierarchy becomes tool semantics**, not only a router: each tool states its authority tier and what it is *not* authoritative for. | Directly addresses the G-gate stale-wiki failure (composer used a $45k wiki figure over the live $480k record). |
| D12 | **Keyword eligibility gate untouched until G. Path A retained dark until the G cutover, then explicitly retired.** | One variable at a time. Path A diverges further each phase and must not become permanent maintenance by default. |

| **D13** | **ADDED 2026-07-29 (London). Path A is FROZEN, and scheduled for deletion at Step 3 alongside `vcso_planner`, contingent on N=5 passing.** No new work may be shaped around it. If a change improves the native path but disturbs or breaks Path A, **the native path wins** and Path A may be left broken. Do not delete it before Step 3. | Path A protects nothing a founder can reach — every SDK flag is dark and production still runs the pre-migration loop, which is the real safety net. Its only remaining value hedges a Phase G risk, not a Step 2 one. Meanwhile it charges rent: `P4_THIN_SLICE_SIGNALS` survives for it, `max_rounds: 1` is correct for it (which is why the `maxTurns` fix had to be code-side and conditional), and the compile forks on it in three places. Freezing removes the drag at zero risk; deleting it mid-probe would remove the fallback at the exact moment its replacement is under test. |

---

## 1A. Glossary — terms that have cost repeated explanation

**Path A** — *deterministic app-owned worker execution with a compose-only lead.* Built during Phase D
(v0.6.57–59) when the first model-driven attempt hit the tool-visibility trap.
`run_app_owned_workers()` (`vcso_sdk_loop.py`) runs the required workers in fixed dependency order
(structured → sandbox → wiki), collects their compact findings, injects them into the system prompt, and
gives the SDK lead **no tools and no `Task`** (`options.agents = {}`, `options.allowed_tools = []`). The
application decides and runs; the model only writes the answer. **Path A is not the planner.** Frozen per
D13; delete at Step 3 and rename at the same time — renaming earlier is churn during an active probe.

**`vcso_planner`** — the hand-rolled orchestrator-worker loop that decomposed questions and spawned
workers itself. Failed twice in P4 (dropped the mandatory sandbox child), triggered this migration,
**already retired** at D2, flag dark. Delete at Step 3.

**The native / granular surface** — the Step 1 architecture under test: SDK subagents holding granular
in-process tools, delegation-first enforced by hook, compute gated on prior retrieval.

**`max_rounds` vs `maxTurns`** — different concepts that shared one source and caused a multi-cycle
outage. `max_rounds` (`agent_capabilities.default_config`) counts `SubAgentOrchestrator` passes and is
correctly `1` for Path A. SDK `maxTurns` counts model turns in an agentic loop and must be ≥ the worker's
tool sequence plus a composing turn. Never re-collapse them.

---

## 2. Current-state corrections (grounded — these make the work smaller)

Both prior assessments understated how much of the target is already built. Verified against the live
registry:

- **The tool registry is already target-shaped.** Twenty-one code-registered tools carry rich
  descriptions, explicit `json_schema`, a `citation` contract (`source_kind` + `verbatim`/`metadata`),
  `capability_hints`, `keywords`, and `surface_tags` — and the surface tags **already include
  `domain_agent`** on eleven of them, plus as the default applied to discovered MCP tools
  (`tool_registry.py:326, 549–924`). The registry was built for this architecture before the architecture
  was named.
- **`persistence_semantics` is built, not pending.** It is a first-class field defaulting to `read_only`
  (`:92`), set explicitly on the write-capable tools (`execute_code` → `privileged`, `annotate` /
  `write_todos` / `write_file` / `edit_file` → `persist_artifact`, `task` / `delegate_to_sub_agent` →
  `privileged`), and **enforced** at execution: a hard money-movement block, a founder-confirmation
  requirement for non-read-only tools, and a quarantine that trips after any external read before a later
  write may run (`:424–464`). Phase F's job here is applying it to new connector tools, not building the
  mechanism.
- **Most granular tools already exist.** KB (`kb_ls`, `kb_tree`, `kb_grep`, `kb_glob`, `kb_read`), wiki
  (`wiki_search`, `wiki_get_page`, `wiki_list`), sandbox (`execute_code`), plus `tool_search`, `annotate`,
  and the Deep-surface tools. **The lead is simply not given them:** `vcso_sdk_config.py:111–114` empties
  `selected` in native mode, so the lead's entire surface is `Task` plus pre-approved worker handlers.
- **Consequence:** 2b is substantially *attachment and authoring-the-gaps*, not dissolution of seven
  handlers. The genuine authoring gap is structured-data retrieval, a global-IP read tool, and possibly a
  document-chunk read.

---

## 3. Target architecture

Stated plainly, in the five-layer shape:

**Control plane (application, deterministic).** Authenticated founder → per-founder store → RLS. The
per-turn envelope compiled by `compile_founder_sdk_options` from `agent_capabilities` × `tool_registry` ×
`mcp_connections` × the tier map. Budget, turn, and depth caps. Feature gating. The model never generates
any of this.

**Retrieval plane (tools).** Purpose-built, founder-scoped, richly described read tools. Tenant identity
is bound at tool construction and never supplied by the model. Each tool declares its authority tier and
carries its citation contract. Available to the lead (Mode B subset) and to worker subagents (full subset
by capability).

**Execution plane (tools).** `execute_code` for genuinely novel derivation, gated on prior retrieval.
Canonical scoring services remain outside 04B and are called, not improvised, when they are in scope.

**Agent plane (SDK-native).** One lead reasoning over the permitted surface: answer directly, retrieve and
answer, or delegate to bounded worker subagents. Subagents are SDK `AgentDefinition`s with their own
prompt, tool subset, model tier, and turn cap. Later, the same mechanism carries Domain Agents as
configurations.

**Governance plane (hooks + persistence).** `PreToolUse` for scope, entitlement, and the
compute-requires-data rule. `PostToolUse` for usage, tracing, and provenance. Terminal validation for
output integrity and the three-endings contract. Run/step rows, citations, one-writer. Persistence
semantics enforced at execution.

---

## 4. Target tool inventory and agent map

### 4.1 Lead surface

| Tool | Status | Purpose |
|---|---|---|
| `Task` (provision name) / `Agent` (runtime name) | exists | Delegation. |
| `wiki_list` | **exists** | Enumerate available synthesized pages and their canonical keys. Cheap discovery. |
| `wiki_get_page` | **exists** | Read a synthesized page by canonical key. |
| `get_dataset_periods` | **author** | Read bounded structured rows for a founder dataset, with period bounds and provenance. |
| `execute_code` | **exists** | Novel derivation. Gated: requires a prior successful retrieval in the same turn. |

**Note on Mode B scope — a correction to the earlier "two tools" position.** `wiki_get_page` requires a
canonical key. Without a discovery tool the lead cannot find the page, so Mode B is inert. `wiki_list` is
cheap key enumeration, not semantic search, and closes the gap without opening full search. **Mode B is
three tools.** `wiki_search` is deliberately withheld until evidence shows the lead reaching for it.

### 4.2 Worker subagents (capability-shaped, per D3)

| Subagent | Tools | Status |
|---|---|---|
| `structured_data_agent` | `list_founder_datasets`, `get_dataset_periods`, `run_structured_query` | **author all three** (`structured_query.py` service and `validate_structured_sql` already exist; `founder_dataset_rows` already carries `period_start`/`period_end`/`normalized_values`/`provenance`) |
| `per_user_wiki` | `wiki_search`, `wiki_get_page`, `wiki_list` | exists |
| `kb_explorer_agent` | `kb_ls`, `kb_tree`, `kb_grep`, `kb_glob`, `kb_read` | exists |
| `global_ip` | `global_ip_read` tool | **author** (service exists, no registered tool) |
| `document_analysis` | document-chunk read | **verify before authoring** — `kb_read` may already cover it |

`sandbox_execution_agent` is **retired as a subagent** per D6; `execute_code` moves to the lead surface.

### 4.3 First-build subset (the probe surface)

Everything needed to run the pinned anchor end to end, and nothing more:

- Lead: `Task`, `wiki_list`, `wiki_get_page`, `get_dataset_periods`, `execute_code`
- `structured_data_agent`: `list_founder_datasets`, `get_dataset_periods`, `run_structured_query`
- `per_user_wiki`: existing three wiki tools

Deferred to after the probe: KB attachment, `global_ip_read`, document-chunk read.

**Why the anchor stays valid under this surface:** the anchor requires computation over a multi-period
series. Mode B tools are direct reads and cannot produce it, and the compute gate plus the output-integrity
gate catch any attempt to assert a figure without a cited compute result. A Mode B answer to the anchor is
therefore a **failure**, not a pass, and should be recorded as one.

---

## 5. The three endings — reflect-and-steer and `ask_user`, designed together

### 5.1 The contract

A turn has **three** legitimate terminal states. Today it has two, and the missing one is why the composer
fabricates.

**1. ANSWER.** Evidence is sufficient. Deliver the cited judgment.

**2. STEER.** Evidence is insufficient and the gap is *not* something only the founder can supply. Deliver
what is genuinely known, name precisely what is missing, name what would close it, and propose the next
move. **Does not block. Completes successfully.**

**3. PAUSE (`ask_user`).** Progress depends on information or a judgment only the founder holds. Ask one
clear question, persist the state, wait.

### 5.2 The firing rule (unambiguous by construction)

- The missing thing is **data the platform could obtain** — a connector to link, a document to upload, a
  period not yet in the series, a computation not yet run → **STEER.**
- The missing thing is **a judgment or preference only the founder holds** — which of two defensible
  definitions to use, which of two priorities matters more, a constraint we cannot observe → **PAUSE.**
- Neither, and the answer is derivable from what is held → **ANSWER.**

### 5.3 The consultative standard

STEER is not a refusal and not an apology. Its shape:

> Here is what I have and what it supports. Here is what I cannot conclude and why. Here is specifically
> what would close that gap. Here is what I would do next.

It moves the engagement forward. A turn that declines to answer while naming the gap and the path is a
*successful* turn.

### 5.4 What this touches (it is not a prompt change)

- **Terminal handling in the loop.** A turn ending with no answer is currently treated as failure. STEER
  must complete cleanly through the same path as ANSWER.
- **The output-integrity gate.** Its current refusal template is a crude first version of STEER and should
  be **replaced by** it, not left alongside.
- **Evidence and scoring criteria.** Canary records must distinguish "declined with a named gap" from
  "failed," or G's generalization scoring will be distorted.
- **The SSE contract.** Determine whether STEER needs its own event or rides the existing answer channel
  with a status. Prefer the latter if it holds — the frontend contract has been stable and valuable.

**Build:** Phase G. **Requirement:** this section, now. **`ask_user` mechanism:** Phase E, built against
this contract so the two do not overlap.

---

## 6. Knowledge-hierarchy authority rule

To be encoded in three places: each tool's description, the lead system prompt, and eventually a terminal
validation check.

**Authority order for factual claims about the founder's business:**

| Tier | Source | Authoritative for | Explicitly not authoritative for |
|---|---|---|---|
| 0 | Runtime truth — identity, entitlements, dates, configuration | Everything in its scope; never overridden | — |
| 1 | Structured records — datasets, assessment results, initiatives, milestones | **Figures and current state** | Interpretation |
| 2 | Source evidence — uploaded P&Ls, transcripts, contracts | **What was actually stated or reported, as of its date** | Current state, if newer records exist |
| 3 | Synthesized wiki / OS Engine pages | **Locating and connecting information; narrative context** | **Figures.** May be stale by construction |
| 4 | ArchitectOS proprietary IP — AE Ladder, MRA logic, stage expectations, frameworks | **Interpretation and what "good" looks like at a stage** | Any founder-specific fact |
| 5 | External connected sources (Phase F) | Their own system's current state, at pull time | Anything outside their system |
| 6 | General model knowledge | Background and definitions only | **Never** a founder-specific factual claim |

**Operating rules:**

1. Use Tier 1 and 2 for factual claims. Use Tier 3 to find and connect. Use Tier 4 to interpret. Tier 6
   never overrides company-specific evidence.
2. **If a figure appears in both a wiki page and a structured record, the record wins — and the
   discrepancy is itself worth surfacing to the founder.** This is the direct fix for the G-gate failure.
3. Never assert a computed figure without a compute result and its citation. If compute is missing or
   degraded, STEER.
4. Every factual business claim carries its source.

---

## 7. Roadmap

Each step names its gate. Nothing widens past the dark founder canary. Flags stay dark throughout.

**Step 1 — Author the probe surface.** In-process tools at the chosen grain, founder scope bound at
construction. Lead gets the Mode B three plus `execute_code`. Worker subagents get their subsets.
`pre_worker_handler_gate` re-registered so any non-delegated worker-tool call is refused with a reason the
model can learn from. The compute-requires-retrieval hook added. The external transport stays in the
codebase, unwired.
*Gate:* compile clean, unit tests, no live spend.

**Step 1.5 — Remove the tripwires (added 2026-07-29, after Run 1 was voided).** Two deletions we had
already committed to, pulled forward because both can invalidate a canary:

1. **Deep Mode toggle and routing gate removed.** The UI control goes; `deep_mode` is forced false at the
   request boundary. Phase E's landed session and `ask_user` code stays in place, dormant — the same
   treatment as the transport. The larger Phase E rework remains at Step 4.
2. **Keyword eligibility removed.** `P4_THIN_SLICE_SIGNALS` comes off the native path. Eligibility becomes
   flag-on plus founder-allowlisted. The required-worker set stays until G.
3. **A fail-closed countability guard**, demoted to a backstop rather than the primary fix: a run that does
   not carry `sdk_phase=04B-D`, `native_subagent_mode=true`, and a non-empty `available_subagents` is
   **void** and counts neither way.

*Gate:* compile clean, frontend green, unit tests on the eligibility change and the guard, deploy, and a
cache-busted head confirmation. No live spend.

**Step 2 — Prove it once.** Local CLI experiment first — the technique that found the `Task`/`Agent`
split for cents — to settle whether a subagent calls an in-process tool cleanly under `dontAsk`. Then the
reliability bar: **5 consecutive passes on the pinned anchor**, zero direct handler calls executed, correct
model tiers, citations intact. Plus two non-negotiable negative tests: a worker cannot reach a sibling's
tools, and founder isolation holds under adversarial probing.
*This is the one expensive gate in the plan.*

**Step 3 — Delete, or record and stop.**
*Pass:* remove `vcso_worker_mcp_server.py`, the token registry and `TURN_REGISTRY` machinery, the
`MCP_TOOL_TIMEOUT` dependency, the single-process constraint, and the out-of-band completion bridge. This
is dead-code removal against a proven path — smoke test, not a second five-run cycle. Keep semantic status
normalisation, app-owned data flow, the diagnostics trail, degraded-worker handling. Re-run the
zero-canary reload proof for the nested plan surface.
*Fail:* the current transport is vindicated. Record it as a positive finding, harden the two landmines
(get the timeout out of an unversioned environment variable), and proceed. Mode B ships either way; Steps
4–6 are unaffected.

**Step 4 — Phase E, re-scoped.** `ask_user` and sessions on the single path, built against §5's contract.
No mode toggle, no second composer branch, no workspace files until a consumer exists. Keep what landed:
the session store, the thread→session pointer, the ownership boundary, the reload proof.
*Gate:* pause → reload → resume with plan and context intact, three times, plus one confirmation through
the normal chat surface.

**Step 5 — Phase F.** The QuickBooks connector, the financial series, the freshness and authority policy
implemented **inside the retrieval tools** rather than as prompt instruction. Apply the existing
`persistence_semantics` enforcement to the new connector tools. Complete the deferred tool inventory
(KB attachment, `global_ip_read`, document-chunk read).
*Gate:* live read-only cited pull; write and privileged blocked at runtime; the anchor becomes a real
numeric test.

**Step 6 — Phase G.** Relax the keyword eligibility gate and the required-worker blocking so the model
genuinely chooses. Build reflect-and-steer to §5. Run the varied-question rubric across archetypes.
Retire Path A on parity. Then the founder-gated cutover.

---

## 8. Cost discipline

The expensive unit is the reliability bar, not the code. Two rules:

1. **Pay it once.** Author the shipping surface before Step 2, not after. The Step 3 deletion is removal
   against an already-proven path and does not earn a second five-run cycle.
2. **Probe before inventory.** Per D8, the architectural answer comes from a minimal worker subset. If it
   fails, we have not authored an inventory for a path we are not taking.

Accepted trade: a lighter re-verification when the remaining inventory lands in Step 5. Stage gates, not
rebuilds.

---

## 8A. Agentic pattern vocabulary (added 2026-07-29)

Recorded so the concept is inherited rather than rediscovered. **The full evaluation is parked and flagged
for founder alignment in `ROADMAP.md` → "OPEN FOR FOUNDER ALIGNMENT — agentic pattern evaluation."**

**One loop, many patterns.** The SDK ships a single execution loop — reason, call a tool, read the result,
reason again — plus the `Workflow` tool as a separate orchestration mechanism intended for very large agent
counts. Agentic *architectures* (ReAct, plan-and-execute, reflection, evaluator-optimizer,
orchestrator-worker, debate, tree-of-thoughts) are **not installed. They are composed** from the SDK's
primitives: subagents, hooks, sessions, permissions, structured output, skills, background execution.

**What this system already implements, named properly:**

| Pattern | Where it lives | Status |
|---|---|---|
| **Orchestrator-worker** | Lead + bounded capability subagents | Core shape; proven live 2026-07-29 |
| **Tool use / ReAct** | The base SDK loop | In use |
| **Output validators / guardrails** | Composer-integrity gate, native access hook, compute gate | In use, enforced in code not prose |
| **Reflection** | Reflect-and-steer — the three-endings contract (§5) | **Specified, not built** — Phase G |
| **Deterministic pre-fetch** | `vcso_source_router` tier ladder | Intentionally permanent; a cost optimisation, not a decision-maker |

**Candidates, not commitments:** evaluator-optimizer (critique → revise), plan-and-execute with an authored
editable plan, hierarchical delegation. Each must pass the test recorded in `ROADMAP.md`: *what specific
failure does it fix that a cheaper mechanism does not?*

---

## 9. Parked and out of scope — named so they are not discovered late

| Item | Where it belongs |
|---|---|
| Domain Agent composition (five domain configurations) | Next workstream, after 04B is live |
| Artifact lifecycle — `save_draft_artifact`, draft → validation → durable knowledge | With Domain Agents; the missing half of the governance plane |
| MRA / AE Ladder canonical scoring as deterministic services | Existing platform surface, outside 04B, currently unassigned |
| **Agentic pattern evaluation** — evaluator-optimizer, plan-and-execute, hierarchical delegation, `Workflow`-based orchestration, and the founder-supplied architectures catalogue | **Flagged for founder alignment in `ROADMAP.md`** (not only here — it must survive session boundaries). Held until N=5 passes and Phase F supplies real data. Founder position: most likely Domain Agents, **not ruled out for Virtual CSO chat.** See §8A for the vocabulary |
| Recursive sub-agents | Currently forbidden by the harness locks; the SDK supports nesting. Requires an explicit founder decision if Domain Agents need it |
| Conversation → wiki feeder | Deferred OS Engine dependency (harness carry-forward) |
| `wiki_search` on the lead surface | Add on evidence, not assumption |

---

## 10. Locks preserved

Unchanged and binding on every step: founder isolation; one writer (feed the OS Engine, never write the
wiki); cited provenance; cost-tier routing at the capability grain with no founder-facing model selector;
the context-selection IP; curated transparency (no raw payloads, no raw chain-of-thought); bounded,
non-recursive, depth-capped workers.

**One transitional risk to hold explicitly.** Moving founder isolation from an explicit token check to an
implicit code boundary makes the guarantee stronger in mechanism but weaker in *evidence* — a token
registry is auditable in a way a closure is not. The two negative tests in Step 2 are therefore mandatory
before rubric line 7 is re-marked as proven. Do not skip them.

---

## 11. Open items carried into Step 1

1. ~~Confirm whether `kb_read` covers the document-chunk read.~~ **RESOLVED 2026-07-28 by recon: it does
   not.** `kb_read` reads `ose_raw_document_registry.full_markdown` by document id and cites a
   `raw_document`. `document_analysis` reads bounded `document_chunks` rows and preserves chunk ids, chunk
   indexes, page numbers, metadata, and `document_chunk` citations. A distinct chunk-read tool is required.
   Remains deferred out of the probe surface; lands in Step 5.
2. Decide whether STEER rides the existing answer channel with a status or needs its own SSE event.
   Prefer the former.
3. Name the compute-gate rule precisely: what counts as "a prior successful retrieval in the same turn."
4. Confirm the model-tier distribution expectation after the shim layer is removed — the lead does more,
   workers do less. Measure rather than predict.
