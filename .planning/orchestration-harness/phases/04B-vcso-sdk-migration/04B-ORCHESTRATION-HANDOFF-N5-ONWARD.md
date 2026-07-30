# 04B — Orchestration Handoff: N=5 Onward (cold pickup)

**Date:** 2026-07-29 · **You are:** the next **Orchestration Agent** for the VCSO SDK migration.
**Self-contained** — you do not need the prior conversation.

**Your job:** work the remaining scope phase by phase, produce plan and kickoff material for **execution
agents** who do the live code and verification, run STOP-and-review checkpoints with London, and handle the
tangents that surface. **You orchestrate and plan; execution agents build.** London gates every flip,
every canary, and every deletion.

**The hard problem is solved.** What remains is largely mechanical. Do not re-open settled questions —
§5 lists what is settled and why re-deriving it is expensive.

---

## 1. Read first, in this order

1. **`04B-TARGET-ARCHITECTURE-AND-ROADMAP.md`** — the canonical decision record. D1–D13, the glossary, the
   target architecture, the tool inventory, the three-endings contract, the knowledge-hierarchy authority
   rule, the roadmap with gates, and §8A the pattern vocabulary. **This wins over anything else.**
2. `04B-NATIVE-SURFACE-PLAN.md` — the current phase's plan, including §5A (the void ruling and the Step 1.5
   amendment) and the acceptance criteria.
3. `04B-VISION-AND-INTENT.md` — **§4 is the rubric. Grade everything you ship against it.**
4. `ROADMAP.md` (this folder) — Process Rules, the phase table, the progress tracker, and the
   **"OPEN FOR FOUNDER ALIGNMENT — agentic pattern evaluation"** section.
5. `CONTEXT.md` (this folder) — locks, data lifecycle, decisions execution agents must not override.
6. `04B-DELEGATION-RETURN-TROUBLESHOOTING.md` — the diagnostic record. Read §3 before forming any
   hypothesis about delegation behaviour; five things are already disproved.

---

## 2. Current state — verified 2026-07-29

- **Deployed head `c75ea99d`.** Railway and Vercel green, cache-busted health confirmed.
- **All flags dark.** `vcso_sdk_loop` disabled, `vcso_planner` disabled, `native_model_driven_enabled`
  false, both allowlists empty, `diagnostic_sdk_stream_capture_enabled` off.
- **Nothing is live to any founder.** Production Virtual CSO still runs the pre-migration loop in
  `vcso_chat_service.py`. That untouched loop is the real safety net.
- **N=5 is at 0/5.** No counted run has been completed.
- Path A, the external worker transport, `TURN_REGISTRY`, and the DB completion bridge are all present and
  unreachable. **Do not delete any of them before Step 3.**
- **Total live model spend across this entire probe is roughly $1.** Credits are not the constraint.
  **Cycles and wall-clock are.**

---

## 3. What was just proven — bank it, do not re-litigate

The native granular surface ran end to end successfully on 2026-07-29 (activation smoke, parent
`f0d57def-ac61-4c93-8b3d-43aae03355f5`):

- **Subagents delegate, run multi-turn, and return findings in-band.** `SubagentStop` fires. Agent results
  carry content. Zero give-ups.
- **The wiki worker** completed with 10 tool calls and 33 cited sources.
- **The structured worker** completed as `partial` / `degraded` with 5 cited sources after safely refusing
  a SQL query — the new partial-result semantics working as designed.
- **The access hook and compute gate enforce correctly and observably**, naming their grants in every
  decision. Zero lead-direct attempts on worker tools across every run to date.
- **Evidence persists** — child runs, steps, source refs, nested surface rendering, per-child attribution.
- **The founder-visible answer disclosed the partial result**, used the aggregate data it actually had,
  attributed claims to their sources, named the missing coverage as a gap, and did not present a partial
  worker as successful cited computation.

**The architecture works.** N=5 is now a reliability measurement, not a question of whether it functions.

---

## 4. Your opening task — N=5

Fully specified. Do not redesign it.

**Preflight, every session, no exceptions:**

- Cache-busted `/api/health` matches the intended SHA. A plain read can be served stale.
- **Use `python-backend/scripts/arm_native_capture_canary.py`.** It requires a dark starting state, SHA
  confirmation, membership in **both** allowlists, one atomic update, and readback. Do not arm by hand.
- **Then `python-backend/scripts/verify_native_activation_compile.py --founder-id <id>`** — a
  **deterministic, zero-spend** compile assertion (landed Step 0, v0.6.147/149). It reads the live flag row
  and runs `native_subagent_requirements` and `compile_founder_sdk_options` in-process against the real
  store, asserting the base-loop gate, eligibility, capture, the exact Mode B lead surface, the Task
  provision/runtime split, the granular agent grants and in-process server, the parent and per-agent turn
  floors, parent pre-approval, and the budget. **Validate before spending, not after.** Three canaries were
  lost to arming failures before these existed.
  **Its limitation, stated so a green is not over-read:** it compiles with `hooks={}`, so it proves the
  *surface* and not that the access hook, compute gate, or lifecycle writers are registered. A green
  preflight is not evidence the governance gates are armed.
  The former `verify_native_activation_smoke.py` is **superseded** — it cost a full two-worker delegation
  (~$0.15, ~65 s) and verified activation only after that spend. It remains in the tree as a post-hoc
  evaluator and is no longer part of the preflight sequence.
- **Confirming the deployed head is a bounded poll, not a single read.** Railway builds in roughly two and
  a half minutes (observed 2026-07-29: scheduled 23:27:29, image pushed 23:29:57). Poll the cache-busted
  health URL every 20 s to a 5-minute deadline. Only a timeout is a finding — and the first question then
  is whether the head commit touched anything under `/python-backend` at all, since that is the Railway
  root directory and a `.planning/`-only commit may legitimately never build.
- Re-darken immediately after each session and read every flag back off.

**The bar: five consecutive passes on the pinned anchor**, plus two negative tests after.

**Three outcome classes:**

- **PASS — delegated and computed.** Delegation via `Task`, required workers complete, cited compute
  result present, correct model tiers, citations intact, zero direct handler calls executed.
- **PASS — delegated and honestly declined.** The lead delegates, workers retrieve, and the lead declines
  to assert a computed figure because one period cannot support a trend. **Capture its exact wording** —
  it is direct input to the Phase G reflect-and-steer requirement.
- **FAIL.** No delegation; a required worker produces nothing usable; a direct handler call **executes**;
  wrong tiers; missing citations; **or the lead asserts a computed or directional figure from a single
  period.**

**Not failures:** a hook-refused lead attempt (count it, report the rate and whether the lead recovered by
delegating). A worker completing as `partial` after a safely-refused optional tool — that is now correct
behaviour. Turn or budget exhaustion with correct delegation is a **capacity finding**, scored separately.
Do not change `max_turns` or `max_budget_usd`.

**CORRECTED 2026-07-29 (Step 0, v0.6.146).** An earlier draft of this section stated the caps were
`max_turns=12` / `max_budget_usd=0.5`. **They were not** — the live values were `6` / `$0.25`; the `12` and
`1.0` in `vcso_chat_service.py:696–699` are **ceilings**, and `12` / `0.5` appeared together only in a unit
test fixture. Step 0 raised the *arming script's* armed payload and its readback assertion to
**`max_turns: 12` / `max_budget_usd: 0.50`**, so those are the values written to the flag row **at arm
time**. The dark row still reads `6` / `0.25` between sessions — that is correct and not a regression.
**`12` is the hardcoded turn ceiling**; raising past it is a code change and London's call. **`$0.50` is
deliberately below the `$1.00` ceiling** so budget exhaustion stays informative. Full evidence:
`04B-NATIVE-SURFACE-PLAN.md` §5B.1.

**Report per run:** outcome class, delegation shape and order, **whether the `stop_hook` ever had to
block**, hook-refusal count and recovery, turn and budget consumption, child run outcomes including partial
status, whether the nested surface rendered, and the integrity-gate decision code.

That `stop_hook` line matters most. If it never blocks across five runs, the lead chose delegation
unprompted and the required-worker scaffolding was inert — the closest thing to a rubric #1 read this probe
can honestly produce.

**Then two mandatory negative tests, watched executing, not inferred:** a worker subagent cannot reach a
sibling's tools; a cross-founder read is refused **at the tool layer**. Founder isolation moved from an
explicit token check to an implicit code boundary — stronger in mechanism, weaker in evidence. These tests
are how that evidence gets rebuilt. **Do not skip them.**

**A caveat you must carry into the completion doc:** the composer-integrity gate keys off *question*
phrasing (`COMPUTE_REQUEST_SIGNALS`), and the anchor is phrased as advice. It has recorded `not_required`
on **three** consecutive live runs. **N=5 will not exercise the integrity gate.** The
"asserts a computed figure" hard-fail is enforced by manual scoring only. Nobody may later read a 5/5 as
proof that the gate holds.

**Also state plainly:** the anchor's success accounting changed shape when the sandbox stopped being a
subagent — two worker children plus a cited compute result, not three children. Same question under test,
different evidence criteria. **Do not claim a byte-identical comparison to the D2 baseline.**

---

## 5. Settled — do not re-derive

Each of these cost real cycles. Re-opening them is the most expensive mistake available to you.

| Settled | Detail |
|---|---|
| **`max_rounds` ≠ `maxTurns`** | `max_rounds` counts `SubAgentOrchestrator` passes (correctly `1`, for Path A). SDK `maxTurns` counts model turns. Conflating them starved subagents of the turn needed to compose a return and cost six cycles. `GRANULAR_NATIVE_AGENT_MAX_TURNS = 6` is the code-side floor. **Never re-collapse them, and do not "fix" this by editing `default_config.max_rounds` — that would silently alter Path A.** |
| **Delegation return** | Not asynchronous, not environmental, not the SDK. Five hypotheses disproved and recorded in `04B-DELEGATION-RETURN-TROUBLESHOOTING.md` §3. |
| **Two allowlists** | `test_user_ids` gates the base loop; `diagnostic_user_ids` gates the native sub-flags. The founder must be in **both**. Use the arming script. |
| **Lead tool visibility** | The lead sees every tool on the top-level in-process server. This cannot be avoided — `disallowed_tools` is global and would hide tools from subagents too. **One server, hook-enforced.** Do not re-litigate. |
| **`dontAsk` pre-approval** | Every tool any subagent may call must appear on the parent's `allowed_tools`. Pre-approval is **not** authorization; the access hook is. They are deliberately different. |
| **Path A** | Frozen per D13. Not the planner — see the glossary. Delete at Step 3. |

---

## 6. The sequence after N=5

**Step 3 — deletion. Un-provisional again** now that delegation return is solved and the async fork is off
the table.

Remove: the external worker MCP server, `TURN_REGISTRY` and the token machinery, the `MCP_TOOL_TIMEOUT`
dependency, the single-process constraint, the out-of-band completion bridge, **Path A**, and
**`vcso_planner`**. Rename Path A's remnants at the same time — that is the cheapest possible moment.
Keep: semantic status normalisation, app-owned data flow, the diagnostics trail, degraded and partial
worker handling, the probe scripts.

Also land here: the **CLI version pin** — an expected version asserted at startup and in CI, failing native
activation closed on mismatch. The bundled CLI changed agent semantics under this project once already,
between a passing gate and a failure. Versions are now recorded per run; the assertion is the hardening.

*Gate:* this is dead-code removal against a proven path — a smoke test, not a second five-run cycle. Re-run
the zero-canary reload proof for the nested plan surface.

**Step 4 — Phase E, re-scoped.** `ask_user` and sessions on the single path, built against the
three-endings contract in the target architecture doc §5. No mode toggle. The landed session work stays.

**Step 5 — Phase F.** QuickBooks connector, the financial series, and the freshness/authority policy
implemented **inside the retrieval tools**, not as prompt instruction. Apply the existing
`persistence_semantics` enforcement to new connector tools. Complete the deferred tool inventory: KB
attachment, `global_ip_read`, and a document-chunk read tool (`kb_read` does **not** cover it — confirmed).

**Step 6 — Phase G.** Relax the keyword eligibility gate and the required-worker blocking. Build
reflect-and-steer. Run the varied-question rubric. Retire Path A's remnants if any survive. Then the
founder-gated cutover.

---

## 7. Locks, landmines, discipline

**Locks — binding. No recommendation may weaken one silently:** founder isolation; one writer (feed the OS
Engine, never write the wiki); cited provenance; cost-tier routing at the capability grain with no
founder-facing model selector; the context-selection IP; curated transparency (no raw payloads, no raw
chain-of-thought); bounded, non-recursive, depth-capped workers.

**Landmines:** keep `MCP_TOOL_TIMEOUT=240000` (Railway env only) until Step 3 removes its cause.
Single-process only while `TURN_REGISTRY` exists. Do **not** re-add the per-agent `timeout` config key —
the deployed CLI rejects it and it broke delegation outright.

**Discipline:** observe, don't infer — this migration shipped three false greens caught only by live
observation. Confirm the deployed head cache-busted before every canary. Arm founder-only on London's go,
never in anticipation. Version tags always forward; PATCH per logical unit; MINOR and MAJOR are London's
call. Stop on the first failure and surface it with row evidence rather than retrying blind.

**Do not:** flip flag defaults, prune Path A before Step 3, widen past the dark founder canary, or edit the
harness-root `ROADMAP.md` — that is the separately founder-gated Phase G cutover.

---

## 8. Open, parked, and founder-gated

- **Agentic pattern evaluation** — flagged in `ROADMAP.md` under "OPEN FOR FOUNDER ALIGNMENT." Parked until
  the substrate is proven and Phase F supplies real data. Founder position: most likely Domain Agents,
  **not ruled out for Virtual CSO chat.** Vocabulary in the target architecture doc §8A.
- **Composer-integrity classifier gap** — three live instances. Keys off question phrasing; should key off
  answer content. Belongs with reflect-and-steer in Phase G.
- **Capability-row drift** — `agent_capabilities.allowed_tools` reference tools that do not exist in the
  code registry. The native path bypasses them. Reconcile before the Phase G cutover.
- **Phase F quarantine interaction** — an external MCP read trips quarantine, after which privileged
  `execute_code` needs explicit release. Will surface in F; name it rather than diagnose it from scratch.
- **`execute_code` has never succeeded live.** Its live exception remains unobserved. Error surfacing is now
  in place, so the next occurrence will be readable.
- **Recursive sub-agents** — forbidden by the locks, supported by the SDK. Needs an explicit founder
  decision if Domain Agents require it.
- **Domain Agents** — the next major workstream, near-term. Everything built here is the substrate they
  inherit.

---

## 9. First move on pickup

Confirm current state — cache-busted head, flags dark, N=5 at 0/5 — then bring London a short plan for the
N=5 sequence. Do not arm anything until London's explicit go.
