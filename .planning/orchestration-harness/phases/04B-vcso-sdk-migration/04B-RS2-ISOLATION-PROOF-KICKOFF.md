# 04B — Roadmap Step 2 (close-out): Isolation Proofs on the Granular Surface

**Date:** 2026-07-30 · **You are:** the **execution agent** closing roadmap Step 2 of the VCSO SDK
migration. **Cold pickup — this document is self-contained.**

**Two phases, hard stop between them.**

- **Phase A — build both isolation probes.** No arming, no live turn, no deletion.
- **Phase B — run them watched.** **Only after London gives an explicit in-thread go.**

**Why this exists and why it comes before the deletion:** founder isolation moved from an explicit token
check to an implicit code boundary. That is stronger in mechanism and **weaker in evidence** — a token
registry is auditable in a way a closure is not. The next step deletes `TURN_REGISTRY` and the token
machinery, **which is the mechanism currently carrying that evidence.** Deleting it before its replacement
has been *observed* refusing would destroy the old proof and the ability to rebuild it in one move. So the
proofs come first. `04B-TARGET-ARCHITECTURE-AND-ROADMAP.md` §10: *"Do not skip them."*

---

## 1. State — verify, do not assume

- **All flags dark.** `vcso_sdk_loop` disabled, both allowlists empty, `native_model_driven_enabled`
  false, capture off. The dark row carries `max_turns: 12` / `max_budget_usd: 0.5`; that is **correct**,
  not a regression — `build_dark_settings` deliberately does not reset the caps.
- **`platform_ai_settings.updated_at` is NOT maintained on write.** It sat frozen through an entire
  arm/disarm cycle while the settings changed underneath it. **Read the values themselves; never infer
  flag state from the timestamp.**
- Deployed head at the last run was `68a14478`. **Determine the current head by cache-busted bounded poll**
  — every 20 s to a 5-minute deadline — and pass what you observe to `--expected-sha`. Railway builds only
  on changes under `/python-backend`, so `.planning/`-only commits may never build.
- The mechanism is **proven**: two live runs with zero hook refusals, zero direct handler executions, and
  the `stop_hook` never blocking. See `04B-NATIVE-SURFACE-PLAN.md` §5B.6 and §5B.10. **Do not re-litigate
  it and do not re-run the anchor.**

---

## 2. Phase A — build both probes. No arming, no live turn.

### 2.1 The cross-worker probe must target the granular boundary, not the retired one

`diagnostic_cross_worker_probe` (`vcso_sdk_loop.py:3091–3130`) mints a `TURN_REGISTRY` capability-scoped
token, calls a sibling capability through `run_worker_capability`, and expects `WorkerScopeError`. **That
is the external-transport / token-registry boundary — the thing the next step deletes.** The granular
surface does not use it for worker tool calls; isolation there is enforced by the **generalized access
hook against the compiled grant map** (`compiled.agent_tool_grants`, `vcso_sdk_config.py`, hook at
`vcso_sdk_loop.py:1341`). Running the existing probe would produce a refusal that proves the **wrong**
boundary — the same class of error as this migration's three false greens.

**Build a new probe** that exercises the live boundary: a worker-attributed call to a **sibling's** granted
tool — for example `structured_data_agent` attempting `wiki_search`, which belongs to `per_user_wiki` —
denied by the access hook, with the denial written to the lifecycle so it can be read back from rows.

**Leave the existing token probe in place and untouched.** It goes with the transport in the next step.

**Gate it exactly as the existing diagnostics are gated:** an explicit enable flag **and** membership in
`diagnostic_user_ids`. Dark by default, founder-only, no new always-on behaviour.

### 2.2 The founder-isolation probe must be observable at the tool layer

The requirement is that a cross-founder read is refused **at the tool layer** — not merely absent from the
answer text. Founder scope is bound in the closure from `tool_context.user_id`, and the structured tools
additionally filter `user_id` on the row query. Design a probe that demonstrates the refusal **executing**,
with evidence in a row or lifecycle entry.

**Constraint you must respect:** the turn harness builds its Supabase client with the service-role key, so
`lookup_parent_run_id` bypasses RLS. **That client is not admissible as isolation evidence.** The proof
must come from the tool path under a founder-bound context, or from an observed hook or tool-layer
refusal — not from a privileged connection that ignores the boundary being tested.

State plainly in your proposal how the probe distinguishes *"the tool refused"* from *"the model chose not
to ask."* If it cannot distinguish those, it is not a proof.

### 2.3 Phase A gate

`compileall` clean; unit tests covering both probes' allow and deny paths; the gating flags dark by
default and unit-proven inert when disabled; version-tagged PATCH commit per logical unit, incrementing
from the latest commit message. **Commit the uncommitted plan-document amendments in
`.planning/orchestration-harness/phases/04B-vcso-sdk-migration/` as your first unit** —
`04B-NATIVE-SURFACE-PLAN.md` (§5B.8 through §5B.11) and this kickoff document.

**No live spend. Then STOP and report** — including how each probe proves its boundary, and any way you
think it could produce a false pass. **Do not proceed to Phase B.**

---

## 3. Phase B — run them watched. Only on London's explicit go.

1. Cache-busted head confirmation, bounded poll.
2. Arm via `arm_native_capture_canary.py` — founder in **both** allowlists, atomic, readback. Never by
   hand.
3. `verify_native_activation_compile.py --founder-id <id>` must exit **0**. If it does not, stop.
4. Run both probes. **Watch the refusals execute; do not infer them from configuration.** Pair each to a
   lifecycle row or a step row.
5. **London will be watching the browser during this session** for the nested-surface render proof —
   the living plan panel, nested worker groups, and the SOURCES rail. Tell him when to look before you
   submit, and capture what he confirms.
6. Re-darken via `disarm`, then `read`, and paste the sanitized state — **even if a probe fails, and
   before writing your report.**

**A leak is a stop-everything event.** If either probe shows the boundary *not* holding, stop immediately,
re-darken, and report with row evidence. Do not attempt a fix.

---

## 4. Do not

- **Do not re-run the pinned anchor.** The anchor count is retired as constructed — see
  `04B-NATIVE-SURFACE-PLAN.md` §5B.11. Re-running it proves nothing this step needs.
- **Do not delete anything.** Not the transport, not `TURN_REGISTRY`, not the token machinery, not Path A,
  not `vcso_planner`, not the completion bridge. Deletion is the next step and is separately authorized.
- **Do not repoint or delete the existing `diagnostic_cross_worker_probe`.** Add alongside it.
- **Do not touch** the eligibility gate, the required-worker set, the compute gate, the access hook's
  existing rules, the composer-integrity gate, or the lead prompt. The compute-data binding fix belongs to
  the next step, not this one.
- **Do not change `max_turns` or `max_budget_usd`.**
- **Do not edit the harness-root `ROADMAP.md`.**
- **Do not commit secrets.** Founder credentials stay in the untracked `.env`.

## 5. Locks

Founder isolation · one writer (feed the OS Engine, never write the wiki) · cited provenance · cost-tier
routing at the capability grain with no founder-facing model selector · the context-selection IP · curated
transparency · bounded, non-recursive, depth-capped workers.

**This step exists to produce the evidence for the first of those.** Treat a leak as ship-blocking.

## 6. Infra landmines

Keep `MCP_TOOL_TIMEOUT=240000` (Railway env only). **Single process only** — `TURN_REGISTRY` is
process-global and Railway replicas are set to **1**; that configuration, not any code, is what holds the
constraint. Do **not** re-add the per-agent `timeout` config key; the deployed CLI rejects it and it broke
delegation outright. `max_rounds` and SDK `maxTurns` are different concepts — never re-collapse them.

## 7. Discipline

**Observe, don't infer.** Pair every claim to a row, a log line, or a file. Three false greens in this
migration were caught only by live observation; code-verified is not observed. **If an instruction asks
you to verify something that cannot be verified through the path specified, stop and say so** rather than
finding a way to make the check pass — that has already caught two bad instructions in this workstream.
Report negative and surprising results as results. Version tags forward, PATCH per logical unit, commit
each unit as you finish it. **Stop on the first failure with evidence rather than retrying blind.**

## 8. Key files

```
python-backend/services/
  vcso_sdk_loop.py        :1341 pre_worker_handler_gate — the granular access hook (the boundary under test)
                          :3091–3130 diagnostic_cross_worker_probe — the RETIRED token boundary; leave alone
                          :500–515 cross_worker_probe_enabled — the gating pattern to copy
  vcso_sdk_config.py      :24–35 NATIVE_GRANULAR_AGENT_TOOL_GRANTS — the grant map the hook enforces
  tool_registry.py        :1319–1378 _execute_get_dataset_periods — closure-bound founder scoping
python-backend/scripts/
  arm_native_capture_canary.py         arm / disarm / read
  verify_native_activation_compile.py  zero-spend preflight; must exit 0
.planning/orchestration-harness/phases/04B-vcso-sdk-migration/
  04B-NATIVE-SURFACE-PLAN.md §5B.11    the ruling that closed Step 2 and set this sequencing
  04B-TARGET-ARCHITECTURE-AND-ROADMAP.md §10   why these tests are mandatory
```

## 9. Out of scope

The deletion and the CLI version pin. The compute-data binding fix. `04B-NATIVE-SURFACE-COMPLETION.md`.
Phases E, F, G. Domain Agents. **None of these are yours in this step.**
