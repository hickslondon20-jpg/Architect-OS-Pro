# 04B — Orchestration Handoff: Step 3 Onward

**Date:** 2026-07-30 · **You are:** the next **Orchestration Agent** for the VCSO SDK migration.
**Supersedes `04B-ORCHESTRATION-HANDOFF-N5-ONWARD.md`**, which is now archive — its N=5 framing was
retired and its caps figures were wrong.

**Self-contained.** You do not need the prior conversation.

---

## 1. Read first, in this order

1. **`04B-CURRENT-STATE.md`** — the single entry point. Where we are, what's proven, what isn't, the
   defect register, the drift log, the standing rules. **Read it fully before anything else.**
2. `04B-TARGET-ARCHITECTURE-AND-ROADMAP.md` — decisions D1–D13, the target architecture, roadmap Steps
   1–6, the three-endings contract, the knowledge-authority rule. **Wins over everything on conflicts.**
3. `04B-NATIVE-SURFACE-COMPLETION.md` — what Step 2 actually produced, including the honest rubric
   re-grade where two lines were downgraded.
4. `04B-VISION-AND-INTENT.md` §4 — the rubric. Grade everything against it.

Everything else in the folder is archive or execution briefs. **Do not add new amendment sections to
`04B-NATIVE-SURFACE-PLAN.md`** — that sprawl is what made the state unreadable. Findings go in
`04B-CURRENT-STATE.md` §8.

---

## 2. Your role, precisely

**You orchestrate and you write handoff material. You do not spawn or run execution agents.** You have the
capability; do not use it. The separation is deliberate:

- You draft a **paste-ready, self-contained cold-pickup handoff** for each step.
- London opens a fresh thread and gives it to an execution agent.
- The agent builds, verifies, and reports back to London.
- London brings you the report. **You verify it** — against database rows, code, and deployed state where
  you can reach them.
- You propose next actions and sign off, or send it back.
- London authorises the next step.

**Verify rather than relay. This is the whole value of the seat.** Reports in this project have contained
real errors, and the ones that mattered were caught by opening the rows and the code rather than reading
the summary. Concrete catches from the last stretch: an agent reported "$0.1486 spent on the lead alone"
that was actually the whole-query total including subagents; a proposed dataset design had an April column
that summed to 41,000 while claiming 43,000; an agent reported a compute step as producing a cited result
when the sandbox had computed on hand-typed constants, one of which was wrong.

**You have Supabase MCP access to project `pwacpjqkntnovndhspxt`.** Use it. Run rows, steps, lifecycle
entries, usage rows and flag state are all directly readable, and that is how most verification gets done.
Local `git log` and file reads work. The health endpoint and Railway console are **not** reachable from
your environment — those checks belong to execution agents.

---

## 3. What is next: Step 3

**Founder-approved to proceed**, pending one confirmation in §5. Order matters — the compute fix and the
relabel land *before* the deletion, and the isolation proofs already ran before it for the same reason.

1. **Compute-data binding fix.** `execute_code` currently requires a prior successful retrieval but is not
   bound to *use* it, so the sandbox can compute over numbers the model typed from context. That is how a
   wrong figure reached a founder-visible answer in the last anchor run. This is a flaw in shipping code,
   not a deferred capability.
2. **`LEAKED` relabel.** The founder-isolation probe's owned positive control records
   `decision="LEAKED"`. That is false-positive language sitting in the permanent evidence for a binding
   lock. Reserve `LEAKED` strictly for a foreign or random id returning rows.
3. **The deletion.** External worker MCP server (`vcso_worker_mcp_server.py`, `vcso_worker_mcp.py` and the
   `main.py` mount), `TURN_REGISTRY` and the token machinery, the `MCP_TOOL_TIMEOUT` dependency, the
   single-process constraint, the out-of-band completion bridge (`model_driven_completed_children`),
   **Path A**, **`vcso_planner`**, and the old token-based `diagnostic_cross_worker_probe`. **Rename Path
   A's remnants at the same time** — the cheapest possible moment.
4. **CLI version pin** — an expected version asserted at startup and in CI, failing native activation
   closed on mismatch. The bundled CLI has already changed agent semantics under this project once,
   between a passing gate and a failure.
5. **Nested-surface render observation**, riding the deletion smoke. The founder confirms both panels
   render and populate in general but did not observe the last run specifically.

**Keep:** semantic status normalisation, app-owned data flow, the diagnostics trail, degraded and partial
worker handling, the probe scripts, the turn harness, and Phase E's dormant session code (§5).

*Gate:* this is dead-code removal against a proven path — **a smoke test, not a second five-run cycle.**
Re-run the zero-canary reload proof for the nested plan surface.

**After Step 3:** Step 4 (Phase E — `ask_user` and sessions on the single path), Step 5 (Phase F — the
QuickBooks connector and a real financial series, which will fix more of the wrong-answer problem than any
reasoning change), Step 6 (Phase G — reflect-and-steer, authority enforced at composition, the
varied-question rubric, then the founder-gated cutover).

---

## 4. What is settled — do not re-derive

Each cost real cycles.

- **The mechanism is proven.** The lead delegates unprompted, never direct-calls, and both isolation
  boundaries were watched refusing with controls. Do not re-run the anchor to "confirm" it.
- **N=5 is retired as constructed** and Step 2 closed on mechanism evidence. This changed founder gate D13
  deliberately; the reasoning is in `04B-CURRENT-STATE.md` §7. Do not reinstate it or treat it as an
  oversight.
- **The composition failures are diagnosed, not mysterious.** Four named defects with code citations.
  Re-running the anchor produces no new information.
- **`max_rounds` ≠ SDK `maxTurns`.** Conflating them cost six cycles. Never re-collapse them; never "fix"
  anything by editing `default_config.max_rounds`.
- **Two allowlists.** `test_user_ids` gates the base loop, `diagnostic_user_ids` gates the native
  sub-flags, and the founder must be in **both**. Arm only via `arm_native_capture_canary.py`.
- **Lead tool visibility cannot be avoided.** `disallowed_tools` is global and would hide tools from
  subagents too. One server, hook-enforced. Do not re-litigate.
- **The wiki's internal contradictions stay.** One writer is a lock: we feed the OS Engine, we never write
  the wiki. Records win by authority rule.

---

## 5. Open items needing founder input before Step 3 executes

1. **One deletion-list exception to confirm.** The founder approved the deletion but noted one item should
   stay because of an earlier pivot. **Current reading: Phase E's landed session store, thread→session
   pointer and `ask_user` code stay in place and dormant per D10a — present and unreachable, not
   deleted.** Confirm before anything is removed. A wrong entry on a deletion list is the one error class
   here that is not cheap to undo.
2. **UI and organisation work on the plan panel and SOURCES rail** is a real, separate workstream. It is
   not part of any proof and needs its own scope and slot.

---

## 6. Mistakes this seat has already made

Listed so you do not repeat them, and because the loop only works if this seat is as auditable as the
execution agents.

- Miscounted the files in a commit range (said five, was six) — the execution agent caught it.
- Wrote a verification instruction requiring dataset-grain provenance to be proven through a tool path
  that does not select that column. **An agent stopped rather than improvising around it. That was the
  correct behaviour and should be praised, not smoothed over.**
- Cited `platform_ai_settings.updated_at` as evidence that no flag write had occurred. It is not
  maintained on write.
- Accepted a framing of "repeated deployment mismatch, not propagation delay" without evidence. It was
  propagation delay, twice, and it sent an investigation after a fault that did not exist.
- Proposed a runbook change built on a watch-path hypothesis that the recorded Railway config disproved.
- Recorded a spend figure as "the lead alone" when it was the whole-query total.
- Wrote a Phase gate requiring allow/deny unit coverage but not requiring proof that the new code was
  **reachable from the live path**. A keyword mismatch then passed tests and `compileall` and failed live.

**The pattern: every one of these was a claim made without opening the thing it was about.** Open it.

---

## 7. Discipline, locks, landmines

**Discipline.** Observe, don't infer — pair every claim to a row, a log line, or a file; code-verified is
not observed. Stop on the first failure and surface it with evidence rather than retrying blind. If an
instruction asks for verification the specified path cannot provide, say so rather than making the check
pass. Arm founder-only on explicit go, never in anticipation; re-darken immediately and read every flag
back off, even when a run fails and before writing the report. Cache-busted deployed-head confirmation
before every canary, as a bounded poll to a 10-minute deadline. Version tags always move forward; PATCH
per logical unit; MINOR and MAJOR are the founder's call; commit each unit as it is finished because
uncommitted work does not survive a session boundary.

**Locks — binding, and no recommendation may weaken one silently.** Founder isolation; one writer (feed
the OS Engine, never write the wiki); cited provenance; cost-tier routing at the capability grain with no
founder-facing model selector; the context-selection IP; curated transparency (no raw payloads, no raw
chain-of-thought); bounded, non-recursive, depth-capped workers.

**Landmines.** Keep `MCP_TOOL_TIMEOUT=240000` until Step 3 removes its cause. Single process only while
`TURN_REGISTRY` exists — Railway replicas are set to 1 and that configuration, not any code, is what holds
the constraint. Never re-add the per-agent `timeout` config key; the deployed CLI rejects it and it broke
delegation outright. Railway builds only on changes under `/python-backend`.

**Do not:** flip flag defaults, arm anything yourself, widen past the dark founder canary, edit the
harness-root `ROADMAP.md` (that is the separately founder-gated Phase G cutover), or commit secrets.

---

## 8. Parked and founder-gated

- **Agentic pattern evaluation** — evaluator-optimizer, plan-and-execute, hierarchical delegation. Flagged
  in `ROADMAP.md` under "OPEN FOR FOUNDER ALIGNMENT." Held until Phase F supplies real data. Founder
  position: most likely Domain Agents, not ruled out for Virtual CSO chat.
- **Capability-row drift** — `agent_capabilities.allowed_tools` reference tools absent from the code
  registry. The native path bypasses them. Reconcile before the Phase G cutover.
- **Recursive sub-agents** — forbidden by the locks, supported by the SDK. Needs an explicit founder
  decision if Domain Agents require it.
- **Domain Agents** — the next major workstream. Everything built here is the substrate they inherit,
  including the composition weaknesses if they are not fixed first.

---

## 9. First move on pickup

Read `04B-CURRENT-STATE.md`. Confirm the current flag state and deployed head from source rather than from
this document. Get the §5 deletion-exception confirmation from London. Then draft the Step 3 execution
handoff and bring it to him — **do not dispatch it yourself.**

**There are uncommitted planning documents in this folder.** Make committing them the first unit of
whatever execution work comes next.
