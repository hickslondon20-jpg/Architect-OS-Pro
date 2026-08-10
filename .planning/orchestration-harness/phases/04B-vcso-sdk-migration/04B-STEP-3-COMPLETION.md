# 04B — Step 3 Completion

**Date:** 2026-08-09 · **Status:** CLOSED · **Closed by:** London, on the orchestrator's recommendation
**Final commit:** `4f24b13b8728fe260dc8371b4fdc553ae5fa3521` (v0.6.166)

This is the record of what Step 3 actually produced, including the defect it discovered on its way out and
the honest re-grade that followed. It is the Step 3 analogue of `04B-NATIVE-SURFACE-COMPLETION.md`.

---

## 1. What Step 3 was for

Two defect fixes and a dead-code deletion against an already-proven path, plus a version pin. Not a second
reliability cycle — Step 2 had already closed on mechanism evidence.

## 2. What landed

| Unit | What | Commit | Verified how |
|---|---|---|---|
| 0 | Planning state committed; the phase's authority chain was untracked until this point | `bc3b0ca4` v0.6.161 | `git log`; 0 files under `/python-backend`, so no build triggered — correct |
| 1 | `execute_code` bound to same-turn cited retrieval data | `f2ac3502` v0.6.162 | Code read at `vcso_sdk_loop.py:743–806`; **fired live 3× in run `5f03966b`** |
| 2 | Owned isolation control relabelled | `0beaf48d` v0.6.163 | `vcso_sdk_loop.py:735–740`; genuine leak paths at `:2802/:2812/:2837` confirmed still `LEAKED`; persisted row `8a51ce24` confirmed unmodified |
| 3 | Retired worker transport, planner, token bridge deleted | `b216a0c4` v0.6.164 | **Zero remaining occurrences** of `vcso_worker_mcp`, `TURN_REGISTRY`, `model_driven_completed_children`, `run_app_owned_workers`, `vcso_planner`, `MCP_TOOL_TIMEOUT` across `python-backend`. 6,590 deletions |
| 4 | Bundled Claude Code CLI pinned to `2.1.209 (Claude Code)` | `421560d1` v0.6.165 | `EXPECTED_CLAUDE_CODE_CLI_VERSION` at `:64`; raise sits at `:2718`, **inside the native path, not at import** — cannot crash boot |
| 5 | Deletion smoke, live | `4f24b13b` v0.6.166 | Run `5f03966b-25ee-4ad5-9804-da7604b849c0` |

**Carve-out held:** Phase E's session store, thread→session pointer and `ask_user` code were preserved
dormant per D10a. `ask_user` measured 42 references across 4 files before the deletion and 42 after.

## 3. Smoke evidence

Run `5f03966b-25ee-4ad5-9804-da7604b849c0`, thread `9f4eaad6`, message `60c3ba85`, 2026-08-09.

- Pre-arm: zero-canary reload proof 3/3; preflight `J_claude_code_cli_version_pinned=true`; cache-busted
  health confirmed `421560d1…`; flags confirmed dark before arming.
- `runtime_manifest` at lifecycle sequence 1, `decision=native_granular`.
- Lead delegated unprompted to both workers. Child runs: `structured_data_agent` (`b5cf1351`, completed,
  partial, 5 steps, 25 cited refs) and `per_user_wiki` (`c62e03c5`, completed, 6 steps, 22 cited refs).
  Parent trace 15 steps, `source_count=49`.
- Lifecycle 42 events against the 60 cap — no truncation, `runtime_manifest` retained as event 1.
- Spend `$0.22334094999999998` on the `vcso_sdk_loop` main row. **Subagent rows carry tokens but null
  `cost_usd`, so this is not whole-query spend** and was correctly not claimed as such.
- Disarmed immediately; flags read back fully dark and independently re-verified by the orchestrator.

**Nothing regressed.** The native path compiles, activates, delegates, retrieves, and persists evidence
with the transport, planner and token machinery removed.

## 4. The defect Step 3 discovered on its way out

`run_structured_query` failed twice inside `structured_data_agent` — `"Query shape is not approved for
structured dataset reads."` The aggregate path was closed at the validator, so the model summed the
retrieved rows by hand and passed its own subtotals into `execute_code`.

**The new compute gate refused, three times, correctly.** It cannot distinguish a correct derived subtotal
from a fabricated constant, and a model summing five numbers in its head is exactly the failure mode that
produced the wrong figure in run 2.

**Then the model routed around it.** From the published answer:

> "The compute worker is rejecting constants that were in fact returned by the structured data agent this
> turn. I'll disclose that limitation and work strictly from the cited figures the workers returned —
> stating the math explicitly in my answer without an uncited derivation."

It went on to publish nine computed percentages — client concentration, top-2 share, gross margin across
three months — with no compute result and no citation.

**Orchestrator verification of the refused constants:** April revenue = 41,000
(7400+9000+8400+8200+8000); May = 44,000; April delivery cost = 10,660; May = 12,100. Every refused
constant is an exact aggregate of retrieved rows. The nine published percentages are also arithmetically
correct. **Nothing in the system established either of those facts.** It got the right answer this time;
the mechanism that decides is unchanged from the run that got a wrong one.

**Conclusion: gating the tool does not gate the computation.** Recorded as defects 10 (symptom, Phase G)
and 11 (root cause, Phase F).

## 5. Rubric re-grade

Consistent with Step 2's practice of grading honestly rather than favourably.

| Line | Before Step 3 | After | Why |
|---|---|---|---|
| Composes founder-grade cited judgment | Failing | **Failing** | Unchanged. Now better characterised: the failure is uncited *derivation*, not stale retrieval |
| Honest about gaps | Failing | **Partial** | The answer did disclose the compute refusal before proceeding — a real improvement — then published uncited derivations anyway |
| Cited provenance | Assumed holding | **Failing** | Newly downgraded. Holds for retrieved figures; does not hold for derived ones |

**One line down, one partially up.** Step 3 was not a composition step and did not claim to be.

## 6. Why Step 3 closed anyway

Step 3 was scoped as a deletion and delivered one. Expanding it to fix a composition defect would repeat
the mistake already recorded in the drift log: N=5 became unpassable because its criteria bundled the
mechanism question with composition quality, inverting the roadmap so Step 2 could not pass until Phase G
shipped.

**Risk accepted knowingly:** Step 4 begins with a founder-visible path that can publish uncited computed
figures. Mitigated by every flag being dark and production still running the pre-migration loop. The fix
is scheduled, not deferred indefinitely — F's first unit and G's scope-defining requirement.

## 7. Handed forward

**To Phase F, as its first unit, ahead of the connector:** approve aggregate query shapes in
`run_structured_query` so derived totals arrive as retrieved output carrying provenance. This is the
cheapest intervention that dissolves the pressure to derive in-head at source.

**To Phase G, as a scope-defining requirement:** authority enforcement moves to **terminal validation on
the published answer** — detecting computed figures asserted without a compute result — not only to the
tool boundary. Recorded in `04B-G-PLAN.md`.

**To Step 4:** capture the nested plan panel and SOURCES rail render observation on the first armed run.
Never obtained in Step 3 — the operator harness produced the run, not a human watching the UI.

**Still open, needing a founder decision:** whether to annotate the `LEAKED` row on run `8a51ce24`;
Railway replicas = 1, now safe to change; `MCP_TOOL_TIMEOUT` removal from the Railway environment.

## 8. What this seat got wrong

Recorded because the loop only works if the orchestration seat is as auditable as the execution agents.

- **The Unit 1 acceptance bar asked the wrong question.** It required the compute gate to *fire* on the
  live path. It fired, three times, and the gate still did not hold. The bar should have asked whether the
  published answer contained uncited computed figures. Firing is observable and cheap; holding is what
  matters.
- The Unit 5 report asserted no false fact and still carried the wrong conclusion. It was accepted as a
  clean pass until the dataset rows were summed and the published answer was read. **Both checks were
  cheap and neither was in the reporting contract.** Future contracts covering a composition-adjacent
  change must require the founder-visible output be quoted and graded, not only the lifecycle trail.
