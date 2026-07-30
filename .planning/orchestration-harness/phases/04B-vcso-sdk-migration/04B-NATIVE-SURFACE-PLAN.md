# 04B — Native Surface Plan (Roadmap Steps 1–2)

> Read `04B-TARGET-ARCHITECTURE-AND-ROADMAP.md` first — it carries the Step 0 decisions (D1–D12), the
> tool inventory, the three-endings contract, and the authority rule. Then `04B-VISION-AND-INTENT.md`
> (grade against §4), this folder's `CONTEXT.md` (locks + data lifecycle), and `04B-D2-FINDINGS.md`
> §§2, 9, 10, 11 (the mechanisms that produced the current transport — you are undoing their cause,
> so you must understand them).

**Covers:** Roadmap Step 1 (author the native tool surface) and Step 2 (prove it once).
**Does not cover:** Step 3 (deletion) — that is a separate, founder-gated decision made *after* Step 2
reports. Do not delete the external transport in this phase.

---

## 1. Why this phase exists

Every worker call currently leaves the process: SDK lead → `Task` → a Haiku subagent whose only job is to
call one wrapper tool → an HTTP hop to a loopback MCP server → a token lookup in a process-global registry
→ the Python handler. That architecture exists for exactly one reason: to keep the worker handler tools
**invisible to the lead**, so the lead is forced to reason a decomposition rather than direct-calling.

That requirement was hardened into the transport on 2026-07-16, when it was the only provable mechanism.
The pieces that make the cheaper in-process mechanism viable — the delegation-contract schema (v0.6.76),
per-worker contracts (M3), and the `pre_worker_handler_gate` deny hook — were all built **afterward**, and
the in-process route has never been re-tested with them in place.

This phase builds the in-process surface and answers, with evidence, whether the lead delegates reliably
when its direct calls are refused by a hook rather than hidden by a transport.

**The requirement is not "the lead cannot see the tools." It is "the lead cannot execute founder-data work
outside an approved delegation."** The second is enforceable in-process. The first is not, and chasing it
is what produced Defects 6 and 7, the `MCP_TOOL_TIMEOUT` landmine, and the single-process ceiling.

---

## 2. Current state — re-confirm before touching anything

- **Cache-busted** `/api/health` returns `ok=true` and the deployed SHA matches `main`. A plain read can be
  served a stale CDN value; do not trust it uncached.
- `vcso_sdk_loop` and `vcso_planner` flags **dark**, allowlists empty, `native_model_driven_enabled=false`,
  diagnostics off.
- **Path A retained dark — do not prune.**
- Nothing in this migration is live to any founder. The production Virtual CSO runs the pre-migration path.

---

## 3. Deliverable

A native in-process worker surface, dark, behind the existing flags:

1. The lead holds a small **Mode B** read surface plus `execute_code`.
2. Worker subagents hold **granular in-process tools**, not a single wrapper handler.
3. Delegation-first is enforced by a **generalized access hook**, not by transport invisibility.
4. Compute cannot run without prior retrieval — enforced by hook, not prompt.
5. The external transport remains present and **unwired**.
6. Evidence, from a local CLI experiment and then N=5 consecutive dark canaries, of whether the lead
   delegates reliably on this surface.

---

## 4. Step 1 — Author the surface

### 4.1 Author three structured-data tools

Grounded against the live schema — verify each before writing, do not assume these columns are complete.

| Tool | Reads | Returns | Class |
|---|---|---|---|
| `list_founder_datasets` | `founder_datasets` — `id, user_id, source_document_id, dataset_name, dataset_type, status, summary, confidence, metadata`, scoped `.eq("user_id", …)` | Available datasets with name, type, status, summary | worker-only |
| `get_dataset_periods` | `founder_dataset_rows` — `id, dataset_id, row_label, period_start, period_end, values, normalized_values, provenance`, ordered by `source_row_index`, bounded limit | Period-bounded rows with provenance; prefer `normalized_values`, fall back to `values` | **lead + worker** |
| `run_structured_query` | `StructuredQueryService` / `validate_structured_sql` (`structured_query.py`) | Validated, row-capped query result | worker-only |

Each `ToolDefinition` must carry: `json_schema`, a `citation` contract (`source_kind="founder_dataset"`),
`persistence_semantics="read_only"`, `capability_hints=["structured_data_agent"]`, and
`surface_tags` including `virtual_cso` and `domain_agent`.

**Founder scope is bound in the closure**, from the running turn's `tool_context.user_id` — never from a
model-supplied argument. This is the isolation guarantee; it replaces the token check. **Recon-confirmed
addition:** `founder_dataset_rows` carries an explicit `user_id` of its own, so every query filters
**both** `user_id` and `dataset_id` in addition to the closure binding. Keep the double scoping; do not
rely on the closure alone.

**Preserve the current handler's output semantics, not an approximation of them** (recon-enumerated from
`_handle_structured_data`): one summary finding per dataset; row failures surfaced as explicit
`dataset_row_error` findings rather than swallowed; `normalized_values` preferred with fallback to
`values`; period bounds and provenance carried on every row; `StructuredQueryService` invoked only when
validated generated SQL is present; the `agent_result_v1` shape with compact findings, summary-only
reasoning visibility, and citations.

**Row limits must be explicit, and truncation must be visible.** The current handler caps at 20 rows per
dataset. Keep a bounded default, allow a caller-supplied limit up to a hard ceiling, and — critically —
**state truncation in the tool result itself**. A silently truncated series is a fabrication vector: the
sandbox computes a trend over partial data and returns a confident, wrong number, which is precisely the
failure class the compute gate and the integrity gate exist to prevent. Truncation is a fact about the
evidence and must travel with it.

**A scoping change to state plainly, because it looks like a widening and is not.** Today the app picks
which dataset ids a worker may read (`native_subagent_scopes` → `context_scope.dataset_ids`), and
`agent_context._load_datasets` refuses anything outside that set. Under the tool model,
`list_founder_datasets` returns the founder's own datasets and the model chooses which is relevant.
Founder isolation is unchanged — the closure and RLS bound the query to one founder. What moves is *which
of the founder's own datasets* is selected, from app choice to model reasoning. That is the intended
behaviour and it is the point of the migration.

### 4.2 Author the authority tier into every tool description

Per D11. Each description states what the tool **is** authoritative for and what it **is not**. Pattern:

> `get_dataset_periods` — Read period-bounded rows from a founder's structured dataset, with provenance.
> **Authoritative for figures and current state.** Prefer this over a wiki page when the two disagree; a
> wiki figure may be stale. Not authoritative for interpretation.

> `wiki_get_page` — Read a synthesized page by canonical key. **Authoritative for narrative context and
> for locating and connecting information. Not authoritative for figures** — verify any number against a
> structured record before asserting it.

Apply the same treatment to the existing wiki and KB descriptions.

### 4.3 Give the lead its Mode B surface

`vcso_sdk_config.py:111–114` currently sets `selected = []` in native mode, so the lead's entire surface is
`Task` plus pre-approved worker handlers. Replace the emptying with an explicit **Mode B allowlist**:

```
wiki_list · wiki_get_page · get_dataset_periods · execute_code
```

Not "all registry tools." The lead's window stays small on purpose.

### 4.4 Convert the worker AgentDefinitions to granular tools

For each capability in the first-build subset:

- `AgentDefinition.tools` becomes the granular `mcp__architectos__<tool>` names for that capability,
  replacing the single `mcp__vcso_workers__run_<capability>` entry.
- `AgentDefinition.mcpServers` becomes `[SDK_INTERNAL_SERVER]`, replacing the inline external HTTP config.
- `model` (tier map), `maxTurns`, `permissionMode`, and `disallowedTools` are unchanged.

First-build subset:

| Subagent | Tools |
|---|---|
| `structured_data_agent` | `list_founder_datasets`, `get_dataset_periods`, `run_structured_query` |
| `per_user_wiki` | `wiki_search`, `wiki_get_page`, `wiki_list` |

`sandbox_execution_agent` is **retired as a subagent** (D6). `execute_code` moves to the lead.
KB tools, `global_ip_read`, and the document-chunk read are **deferred until after the probe** (D8).

### 4.5 The permission surface — read this before writing any config

Three facts that interact, and getting them wrong reproduces Defect 6:

1. **The lead sees every tool on a top-level in-process MCP server.** This cannot be avoided.
   `disallowed_tools` is global — it would hide the tool from subagents too — and `AgentDefinition.tools`
   scopes only the *subagent's* view. Registering a second in-process server referenced solely inside an
   agent does not work: its instance is not serializable and is only routed from top level
   (`04B-D2-FINDINGS.md` §2B). **One server, hook-enforced. Do not re-litigate this.**
2. **Under `permission_mode="dontAsk"`, a subagent's tool call is denied unless the tool is pre-approved on
   the *parent's* `allowed_tools`.** So `allowed_tools` must list **every** tool any subagent may call —
   including the worker-only ones. This is Defect 6's lesson and it still applies.
3. **Therefore pre-approval and permitted-use are deliberately different**, and the hook is what separates
   them. The lead is pre-approved for tools it is not allowed to call directly.

Accepted cost: the lead can see worker-only tools and may waste a turn attempting one. Bounded by the
existing `task_denial_count` give-up, refused by the hook, and **observable** — every refusal writes a
lifecycle row. That observability is the reason this is an acceptable trade for invisibility.

### 4.6 Generalize the access hook

`pre_worker_handler_gate` (`vcso_sdk_loop.py:1341`) currently keys off a `run_` name prefix and matches
`agent_type` to a capability key. Under 2b the tool names carry no prefix and one tool may belong to
several agents. Generalize it:

- Drive it from the **compiled grant map** that `compile_founder_sdk_options` already produces
  (`agent_tool_grants`, plus the new lead allowlist). No new registry field is needed.
- Rule: a call to a tool **not** on the lead's Mode B allowlist is denied unless `agent_id` is present
  **and** the calling `agent_type` is granted that tool.
- The denial reason must teach: name the tool, say it runs inside a delegation, and name which agent owns
  it. A refusal the model can act on is worth more than a refusal it cannot.
- Register it in the model-driven path. Today only the observe-only `pre_tool_probe` is wired there
  (`:2013`, registered at `:2110`) — the real gate exists and is unused.

### 4.7 Add the compute gate

`execute_code` on the lead needs a structural guard, and it replaces a rule that is about to break.

- **The rule:** deny `execute_code` unless at least one **retrieval tool call has completed successfully
  in this turn** — defined as a completed, non-error call to a tool with a `citation` contract and
  `persistence_semantics="read_only"`. Track it in a turn-local set populated by `post_tool_use`.
- **Deny reason:** compute requires data with provenance; retrieve first.
- **Why it is necessary now, not optional:** `pre_task_use` currently enforces "run `structured_data_agent`
  before `sandbox_execution_agent`" and "the sandbox contract must inherit the compact structured
  finding." With the sandbox retired as a subagent, those checks reference an agent that no longer exists.
  The ordering constraint **migrates** to this gate, which expresses the same rule more directly and
  closer to the risk.
- This also converts the G-gate fabrication failure from a caught-at-exit problem into a
  cannot-happen-by-construction one.

### 4.8 Adjust the required-set and stop condition — and record what this does to the anchor

`P4_THIN_SLICE_REQUIRED_AGENTS` is `(structured_data_agent, sandbox_execution_agent, per_user_wiki)` and
drives `stop_hook` blocking. With the sandbox no longer an agent, the required set becomes
`(structured_data_agent, per_user_wiki)` and compute is evidenced by a successful `execute_code` call
rather than a child run row.

**State this honestly in the completion doc: the anchor's success accounting changes shape.** The question
under test is preserved — does the lead reason a correct decomposition that includes computation. What
changes is what counts as evidence: from "three worker children completed" to "two worker children
completed **plus** a cited compute result." The N=5 comparison against the D2 baseline is therefore a
comparison of the same *question*, not of byte-identical criteria. Do not claim a clean like-for-like.

### 4.9 Leave the transport in place

Do not delete `vcso_worker_mcp_server.py`, `vcso_worker_mcp.py`, the `main.py` mount, or the
`MCP_TOOL_TIMEOUT` dependency in this phase. They become unreachable, not absent. Deletion is Step 3 and
is founder-gated on Step 2's result.

### 4.10 Preserve the evidence trail — run and step persistence

**Added 2026-07-28 after recon. This is the one genuine gap in the original plan and it must be settled
before any tool is authored.**

Today `SubAgentOrchestrator.start_run` is the single writer of the evidence trail: it creates the child
`agent_delegation_runs` row, writes `agent_delegation_steps`, records source refs, and returns citations.
Under 2b the granular tools do the work directly and **nothing writes those rows unless we say what does.**

If that is left unspecified, three things break at once: the C2 nested plan surface has no child runs to
render (VISION rubric #2), the SOURCES rail loses its provenance chain (#4), and per-capability cost
attribution has nothing to attribute to (#3 and the tier lock's evidence).

**The assignment — use the SDK's own lifecycle, which is already stubbed in the loop:**

| Event | Writes | Current state |
|---|---|---|
| `SubagentStart` | Child `agent_delegation_runs` row — capability key, routing tier, parent run id, status `running` | `subagent_start_hook` exists at `vcso_sdk_loop.py:1387`, currently `record_lifecycle` only |
| `PostToolUse` (`^mcp__.*$`) | `agent_delegation_steps` + source refs per tool call, attributed to the owning child run | `post_tool_use` already registered and already handles sources |
| `SubagentStop` | Completes the child run — status, summary, citations | `subagent_stop_hook` exists at `:1402`, currently `record_lifecycle` only |
| `AssistantMessage.parent_tool_use_id` | Per-child token/cost attribution | Already working (`:2338`) — unchanged |

The wiring points exist; this is filling stubs, not new machinery.

**Scope discipline for the probe.** Do not attempt full parity of the run record in Step 1. The probe's
question is delegation reliability, not a byte-identical evidence schema. Required for the gate: **child
run rows exist, steps carry their sources, and the nested surface renders.** The finer semantics —
confidence scoring, `needs_review` propagation, degraded-status normalisation — carry forward from the
tool results and can be tightened after the architecture is settled. Note explicitly in the completion doc
which of them are carried and which are deferred.

**The out-of-band completion bridge is not needed here.** `model_driven_completed_children` exists because
an out-of-process worker could finish server-side and lose its in-band return. In-process tool returns are
in-band by construction. Leave the bridge in place and unused; it goes with the transport in Step 3.

### 4.11 Step 1 gate

`compileall` clean; frontend green; focused unit tests covering the new tools, the generalized access hook
(allow and deny paths), the compute gate (allow and deny paths), and the subagent lifecycle writers.
**No live spend in Step 1.** Commit per logical unit with a version-tagged `vX.Y.Z` PATCH message.
**Then STOP and report to London before arming anything.**

---

## 5. Step 2 — Prove it once

### 5.1 Local CLI experiment first

Before any canary. The technique that settled the `Task`/`Agent` naming split for cents, and the same
discipline as the Guardrail-1 resume spike: run under an ephemeral `CLAUDE_CONFIG_DIR` so nothing rides a
local cache.

**The question:** does a `Task`-spawned subagent call an **in-process** SDK MCP tool cleanly under
`permission_mode="dontAsk"` with parent pre-approval? The Fix C era proved the *lead* can call these tools.
A clean *subagent-calls-in-process-tool* observation has never been produced. Report the result before
spending a canary.

### 5.2 The reliability bar

On London's explicit go, armed founder-only, re-darkened immediately after, both flags read back off.

**N=5 consecutive passes on the pinned anchor.** Each pass requires:

- The lead delegates via `Task` — allowed first attempt, no denials.
- Every required worker produces a completed child run.
- A cited compute result exists (the compute gate was satisfied, not bypassed).
- Correct model tiers throughout (Sonnet composes, Haiku workers, per the MA-06 map).
- Citations intact in the founder-visible answer.
- **Zero direct handler calls executed.** A hook-refused lead attempt is not a failure — record it, count
  it, and report the rate. A refused attempt that the lead then recovers from by delegating is the system
  working.

A single failure resets the count and is surfaced, not retried blind.

**A Mode B answer to the anchor is a failure, not a pass.** The anchor requires computation over a
multi-period series; direct reads cannot produce it. If the lead answers from a wiki read, record it as a
failure and report it — it is important information about the Mode B surface, not a passing run.

### 5.3 The two negative tests — mandatory, not optional

Founder isolation moves from an explicit token check to an implicit code boundary. That is stronger in
mechanism and **weaker in evidence** — a registry is auditable in a way a closure is not. Both tests must
pass before rubric line 7 is re-marked as proven:

1. **Cross-worker isolation.** A worker subagent cannot reach a sibling's tools. Watch the refusal
   execute; do not infer it from configuration.
2. **Founder isolation under adversarial input.** A prompt attempting to induce a cross-founder read is
   refused, and the refusal is observed in the tool layer, not just in the answer text.

### 5.4 Step 2 gate

5/5 plus both negative tests, every claim paired to a `agent_delegation_runs` / `agent_delegation_steps` /
`ai_usage_log` row. Write `04B-NATIVE-SURFACE-COMPLETION.md` with the evidence, the hook-refusal rate, the
anchor accounting change from §4.8, and a re-grade against `04B-VISION-AND-INTENT.md` §4. Flags dark, read
back off. **STOP for London.** Step 3 is London's call, not yours.

### 5.5 If the probe fails

If the lead persistently direct-calls despite hook refusal, or the CLI breaks subagent in-process calls in
some way the experiment did not predict: **that is a finding, not a failure of the phase.** Record it
plainly, re-darken, leave the native surface dark and the transport authoritative, and stop. Mode B and the
compute gate are engine-independent and can proceed regardless. Do not iterate on the architecture without
an explicit founder go.

---

## 5A. AMENDMENT — Step 1.5 and the Run 1 void ruling (2026-07-29)

### 5A.1 Run 1 is VOID, not failed

Canary Run 1 (parent `d8fdad87-a704-4686-beae-5baa2185e9e5`) persisted `sdk_phase=04B-E` and
`deep_mode=true`. The turn was submitted with the Deep Mode toggle on, so `vcso_chat_service.py:445`
(`... and not deep_mode`) returned an empty required-agent tuple, `sdk_native_subagent_mode` was false, and
**the native surface was never compiled.** The observed behaviour — `wiki_search ×2 → wiki_get_page ×2 →
compose`, legacy allowed-tools snapshot, `vcso_sdk_standard_v1`, empty lifecycle — is the flat Deep Mode
path, not the architecture under test.

**Ruling (London, 2026-07-29): void.** The reliability bar tests the native surface; the native surface did
not run. Banking a failure against an architecture that was never exercised would corrupt the evidence in
the opposite direction from the three false greens. The count stays at 0/5 with no failure recorded against
the architecture.

**The anchor phrasing was not at fault.** The submitted prompt matched `P4_THIN_SLICE_SIGNALS` on all three
lookaheads (`concentration`, `margin`, `90 days` with a space). The hyphen trap did not fire.

### 5A.2 A real, engine-independent defect found by the void run — record, do not fix

The answer asserted concentration "is rising" and margin "is compressing" with specific figures over a
single June snapshot, and **the composer-integrity gate never armed.** `COMPUTE_REQUEST_SIGNALS` classifies
the *question*; the submitted question ("What should I do in the next 90 days?") is advisory and matches no
signal, so `compute_integrity_required` was false.

**The gate classifies the question. The fabrication is in the answer.** Citation 30 explicitly stated that
only one snapshot exists and no verified directional trend could be asserted — the retrieval was honest and
the composer overrode it. This would have happened identically on the native surface.

This is direct evidence that the gate must key off **answer content** — does this text assert a
quantitative or directional claim — rather than question phrasing. **It belongs with the reflect-and-steer
build in Phase G.** Do not fix it during the probe: it is engine-independent, and changing it mid-probe
moves two variables. Manual scoring is the backstop — "asserts a computed or directional figure from a
single period" is a hard fail in the criteria whether or not the gate fires.

### 5A.3 Step 1.5 — the three changes required before the retry

**1. Remove the Deep Mode toggle and its routing gate.** Remove the UI control from every Composer branch;
force `deep_mode=false` at the request boundary. Neutralise the `pending_sdk_resume` path that can also set
it (currently inert — zero threads in `waiting_for_user`). Phase E's landed session store, thread→session
pointer, and `ask_user` code **stay in place and become dormant**, exactly as the transport does. Do not
delete them; the larger Phase E rework remains at Step 4.

*Why now rather than Step 4:* the original sequencing deferred this on "one variable at a time" reasoning,
and that reasoning was wrong. Deep Mode is not a variable in the experiment — it is a branch that silently
routes around the entire architecture under test, and it just voided a run. Deleting the cause is stronger
than detecting the condition.

**2. Remove keyword eligibility.** Take `P4_THIN_SLICE_SIGNALS` off the native path. Eligibility becomes
**flag enabled plus founder allowlisted** — nothing else. The app decides eligibility deterministically;
the model decides how to execute. Leave the regex in place for Path A and the legacy paths if they still
depend on it; only the native path changes.

*Why:* the regex was doing eligibility work an allowlist should do, and rubric #1 cannot honestly be
claimed while the flagship capability is admitted by phrase match. This also removes phrase-dependence from
canary activation, which is a second tripwire class.

**3. Add the fail-closed countability guard — as a backstop, not the primary fix.** A run is **void** and
counts neither way unless it carries `sdk_phase=04B-D`, `native_subagent_mode=true`, and a non-empty
`available_subagents`. Follow the existing `verify_phase_e_canary.py` pattern.

### 5A.4 What is deliberately NOT changed

- **The required-worker set stays through Step 2**, retired in G. Now that the lead holds Mode B tools,
  delegation is no longer structurally forced — it can answer from a wiki read, which is what the flat path
  did in Run 1. Without a control, a reasonable Mode B answer and a genuine mechanism failure are
  indistinguishable in the evidence, and Step 2's question is whether the mechanism works.
- **New scoring instruction, so the scaffolding does not hide the thing that matters:** record whether the
  `stop_hook` ever *had* to block. If it never blocks across five runs, the lead chose delegation on its
  own and the required set was inert — that is selection evidence obtained for free, without conflating it
  with the mechanism test. Report it per run.
- The composer-integrity gate, the compute gate, the access hook, and the compiled surface are unchanged.

### 5A.5 Step 1.5 gate

`compileall` clean; frontend green; unit tests covering the eligibility change and the countability guard;
regression test asserting no Composer branch exposes a Deep Mode control. Deploy, then a **cache-busted**
head confirmation and a flag read-back. No live spend. **Then STOP and report before re-running Run 1.**

---

## 5B. AMENDMENT — Step 0 findings before the N=5 retry (2026-07-29, orchestration)

Three findings surfaced while confirming state for the N=5 pickup. All three are recorded here because a
finding that lives only in a thread is lost at the session boundary. Step 0 (caps + preflight) implements
findings 1 and 2; finding 3 is scheduled before the negative tests, not before the five runs.

### 5B.1 The caps in this document and in the N=5 handoff were wrong — ceilings read as values

§6 acceptance criterion 7 and `04B-ORCHESTRATION-HANDOFF-N5-ONWARD.md` §4 both state the caps are
`max_turns=12` / `max_budget_usd=0.5`. **They are not.** Verified against the live row and the code:

| Where | Value | What it actually is |
|---|---|---|
| `platform_ai_settings.vcso_sdk_loop.settings` (live row) | `max_turns: 6`, `max_budget_usd: 0.25` | **The applied values** |
| `arm_native_capture_canary.py:60–61`, asserted at `:125–128` | `6` / `0.25` | The armed payload and its readback assertion |
| `vcso_chat_service.py:696` | `min(..., 12)` | A **ceiling**, not a value |
| `vcso_chat_service.py:699` | `min(..., 1.0)` | A **ceiling**, not a value |
| `unit_tests/test_vcso_sdk_config.py:347–348` | `12` / `0.5` | A **test fixture** — the only place those numbers exist together |

**Why it matters, with evidence.** The one successful native granular run (parent
`f0d57def-ac61-4c93-8b3d-43aae03355f5`, 2026-07-29 18:11 UTC) spent **$0.1486 on the lead alone**
(`ai_usage_log`: 28,910 in / 1,449 out, `claude-sonnet-4-6`) against a **$0.25** cap — and that run
carried **no compute step**, because the structured worker returned `partial`/`degraded`. A true PASS adds
an `execute_code` turn and composes over more evidence, so **the first genuine pass is likely the most
expensive run yet.** A budget or turn stop mid-delegation produces a failure shape that is difficult to
separate from a real mechanism failure in the evidence — exactly the ambiguity the probe exists to remove.

**Ruling (London, 2026-07-29): raise to `max_turns: 12` / `max_budget_usd: 0.50` in Step 0, before Run 1.**
Hold **$0.50, not the $1.00 ceiling** — budget exhaustion must stay informative. If runs land at
$0.45–0.50 that is real data about the shape's cost and the cap is raised once, with evidence.
**12 is the hardcoded turn ceiling** (`vcso_chat_service.py:696`); if runs later exhaust turns at 12,
raising further is a code change and a founder decision, not an execution-agent one.

### 5B.2 A model-turn activation smoke is not cheap, and does not need to be a model turn

The N=5 preflight assumed a "cheap throwaway turn" verified by `verify_native_activation_smoke.py`. Under
the Step 1.5 eligibility change that assumption no longer holds. `native_subagent_requirements`
(`vcso_sdk_loop.py:384–389`) returns `NATIVE_SURFACE_REQUIRED_AGENTS` for **any** message once the flag is
on and the founder is allowlisted — no keyword, no intent gate. So the throwaway turn is a **full
two-worker delegation**: ~$0.15 and ~65 s wall-clock, every time, before the anchor is spent.

It also verifies the wrong thing at the wrong end. Every activation fact — eligibility, the compiled lead
surface, the agent definitions and their grants, the capture flag, the turn budgets — is a **pure function
of settings × registry × capabilities**. None of it requires a model.

**Replacement, landed in Step 0:** a deterministic compile assertion that reads the live
`platform_ai_settings` row and runs `native_subagent_requirements` and `compile_founder_sdk_options`
in-process against the real store, asserting the activation facts directly at **zero model spend and no
wait**. Its most valuable assertion is the per-agent `maxTurns` floor — **that assertion would have caught
the `maxTurns=1` bug that cost six cycles.** `verify_native_surface_canary.py` is unchanged and remains the
post-hoc countability check on a real run.

### 5B.3 The cross-worker negative test asset is aimed at the retired mechanism

§5.3 negative test 1 requires that a worker subagent cannot reach a sibling's tools, **watched executing**.
The existing asset does not test that on this surface. `diagnostic_cross_worker_probe`
(`vcso_sdk_loop.py:3091–3130`) mints a `TURN_REGISTRY` capability-scoped token, calls a sibling's
capability through `run_worker_capability`, and expects `WorkerScopeError` — the **external transport /
token-registry** boundary, which is precisely what Step 3 deletes and which the granular surface no longer
uses for worker tool calls. On the granular surface, isolation is enforced by the generalized access hook
against the compiled grant map (`compiled.agent_tool_grants`).

Running the existing probe during N=5 would produce a refusal that proves the **old** boundary and would
re-mark VISION rubric line 7 on evidence that does not apply to the shipping architecture. This is the same
class of error as the three false greens.

**Required before negative test 1 may count:** a granular-surface probe that exercises the access hook —
a worker-attributed call to a sibling's granted tool, denied by the hook, observed in the lifecycle rows.
The founder-isolation test (negative test 2) needs the same treatment: the refusal must be observed **at
the tool layer**, not inferred from answer text. **Not a blocker for the five runs**; scheduled between
5/5 and the negative tests. Do not delete or repoint the existing probe — it stays with the transport
until Step 3.

### 5B.4 Step 0 outcome, and two deployment facts found on the way (2026-07-29)

**Step 0 is complete.** Commits v0.6.145–v0.6.149, deployed head `c6740ec5` confirmed cache-busted
(`observed_sha=c6740ec59d4be8ea0826e7d6693ca8bd58b1206b`), all flags read back dark, zero live model spend,
zero new `agent_delegation_runs` and zero new `ai_usage_log` rows. Six unique files changed: two planning
documents, three scripts, one unit-test file. No service, route, or `src/` file was touched, so **no
founder-facing runtime behaviour differs between `c75ea99d` and `c6740ec5`.**

**Deploy confirmation is a bounded poll, not a single read.** Two head confirmations were reported as
failures before the cause was found; both had landed *inside the build window*. Railway build timing
observed on this deploy: scheduled 23:27:29, image produced 23:29:41, image push completed 23:29:57 —
roughly two and a half minutes. **Poll the cache-busted health URL every 20 s to a 5-minute deadline.**
Only a timeout is a finding. A single immediate read that returns the previous SHA is expected behaviour,
and treating it as a fault costs an investigation cycle — it cost one here.

If it *does* time out, the first question is whether the head commit touched anything under
`/python-backend`. That is the Railway root directory, and there are **no watch paths configured**, so any
push touching it builds — including `scripts/` and `unit_tests/`, which is what happened here. A
`.planning/`-only commit sits outside the root directory and may legitimately never trigger a build.
(An earlier orchestration hypothesis — that watch paths were skipping script-and-doc commits, and that the
head check should therefore compare against the last *runtime* commit — is **disproved** by the recorded
configuration. Do not reinstate it.)

**The deployment configuration is unversioned dashboard state — same landmine class as
`MCP_TOOL_TIMEOUT`.** There is no `railway.json`, `nixpacks.toml`, `Dockerfile`, or CI workflow in the
repository, so none of the following is under version control or reviewable in a diff. Recorded here
because it is load-bearing and was, until now, written down nowhere:

| Setting | Value |
|---|---|
| Repository / branch | `hickslondon20-jpg/Architect-OS-Pro` / `main` |
| Root directory | `/python-backend` |
| Watch paths | none configured |
| Builder | Railpack v0.35.0, Python 3.13.14 |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Region / replicas | `us-west2` / 1 |
| Restart policy | on failure, max 10 retries |

**Single replica is not incidental — it is the `TURN_REGISTRY` single-process constraint holding by
configuration rather than by code.** Anything that raises replicas before Step 3 breaks worker token
lookup. Treat this row as a lock until Step 3 removes its cause.

---

## 6. Acceptance criteria

0. Deployed head confirmed cache-busted; flags dark before and after; Path A intact.
1. The three structured-data tools exist, are founder-scoped in the closure, carry citation contracts and
   authority-tiered descriptions, and are unit-tested.
2. The lead holds exactly the Mode B surface plus `execute_code`; worker subagents hold granular in-process
   tools; no worker `AgentDefinition` references the external server.
3. The generalized access hook denies lead-direct calls to worker-only tools with a teaching reason, and
   allows delegated calls — both paths unit-proven and observed live.
4. The compute gate denies `execute_code` with no prior successful retrieval — unit-proven and observed.
   Row-limit truncation is stated in the tool result, never silent.
5. Child `agent_delegation_runs` rows are written by the subagent lifecycle, steps carry their sources, the
   nested plan surface renders, and per-child cost attribution holds. Deferred evidence semantics named
   explicitly rather than left implicit.
6. Local CLI experiment result reported before any canary.
7. N=5 consecutive anchor passes plus both negative tests, observation-backed. Turn consumption and spend
   per run reported — the caps are now `max_turns=12` / `max_budget_usd=0.5`, and the lead does more work
   per turn under this shape than it did under the shim.
7. The external transport is present and unreachable; `MCP_TOOL_TIMEOUT` untouched.
8. `compileall` clean; frontend green; completion doc written; STOP-and-review with London.

---

## 7. Locks and landmines

**Locks — binding, and no recommendation may weaken one silently:** founder isolation; one writer (feed
the OS Engine, never write the wiki); cited provenance; cost-tier routing at the capability grain with no
founder-facing model selector; the context-selection IP; curated transparency (no raw payloads, no raw
chain-of-thought); bounded, non-recursive, depth-capped workers.

**Infra landmines:** keep `MCP_TOOL_TIMEOUT=240000` (Railway env only) — it stays until Step 3 deletes its
cause. **Single-process only** while `TURN_REGISTRY` still exists — no `WEB_CONCURRENCY`, no `--workers`.
Do **not** re-add the per-agent `timeout` config key; the deployed CLI rejects it and it broke delegation
outright (Canary 7).

**Do not:** flip flag defaults, prune Path A, delete the transport, widen past the dark founder canary,
touch the composer-integrity gate, relax the keyword eligibility gate (that is Phase G), or edit the
harness-root `ROADMAP.md`.

---

## 8. Out of scope

Step 3 deletion. Phase E's `ask_user` and sessions. Phase F's connector, financial series, and freshness
policy. Phase G's gate relaxation, reflect-and-steer build, and generalization rubric. Domain Agent
composition. The deferred tool inventory (KB attachment, `global_ip_read`, document-chunk read) — those
land in Step 5 once the architecture is settled.

---

## 9. Key files

```
python-backend/services/
  tool_registry.py            :92 persistence_semantics default; :424–464 guardrail enforcement;
                              :528–1072 the 21 registered ToolDefinitions — author the new tools here
  vcso_sdk_config.py          :111–114 the lead-surface emptying to replace; :132–176 AgentDefinition
                              construction; :245–249 lead pre-approval (Defect 6 rule)
  vcso_sdk_loop.py            :1341 pre_worker_handler_gate (generalize); :2013/:2110 model-driven hook
                              registration; :60–79 P4 constants; :1267–1339 pre_task_use ordering checks;
                              :1513 stop_hook required-set blocking
  sub_agent_orchestrator.py   :588–660 _handle_structured_data — the logic the new tools reproduce
  agent_context.py            :215–229 founder_datasets binding (the scoping change in §4.1)
  structured_query.py         :190 validate_structured_sql — wrap, do not reimplement
  vcso_worker_mcp*.py         leave in place, unwired
Supabase: founder_datasets, founder_dataset_rows, agent_delegation_runs/steps, ai_usage_log,
          platform_ai_settings (flags)
```

---

## 10. Discipline

**Observe, don't infer.** Pair every claim to a row, a trace, or a log line. This migration has shipped
three false greens — a mocked `query_impl` hiding a permission bug, a silently-skipped suite, and an
incomplete recovery fix — each caught only by live observation. Code-verified is not observed.

**Confirm the deployed head, cache-busted, before every canary.** A stale deploy has already cost a full
run.

**Version tags always move forward.** PATCH by default; MINOR and MAJOR are London's call. Commit after
each logical unit — uncommitted work does not survive a session boundary.

**Stop on the first failure.** Do not retry blind. Surface it with its evidence and wait.
