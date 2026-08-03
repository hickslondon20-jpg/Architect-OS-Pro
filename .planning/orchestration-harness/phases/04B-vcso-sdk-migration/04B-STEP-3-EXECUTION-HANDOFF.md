# 04B — Step 3 Execution Handoff

**Date drafted:** 2026-08-03 · **Drafted by:** the Orchestration Agent · **For:** a fresh execution agent
**Status:** DRAFT — not dispatched. London authorises dispatch.

**Self-contained cold pickup.** You do not need any prior conversation. Read this file top to bottom
before touching anything. Where it cites a file and line, open the file — do not take the citation on
trust; it was written against `a1cf696d` and the line may have moved.

---

## 1. What you are walking into

Virtual CSO is being moved from a hand-written loop with a keyword router onto the Claude Agent SDK, so the
model reasons about which specialist worker to call instead of matching phrases.

**Nothing is live. Every flag is dark. Production Virtual CSO still runs the pre-migration loop**, and that
untouched loop is the real safety net. This has been true for the entire migration and must remain true
when you finish.

Roadmap Step 2 closed on **mechanism** evidence: the lead delegates on its own, never attempts to bypass
delegation, and both isolation boundaries were watched refusing with controls. **The answers are not yet
right** — the system fetches correct data and then composes from stale or mistyped figures. Engine proven,
judgment not. That is deliberate and is Phase F/G work, not yours.

**Step 3 is dead-code removal and two defect fixes against an already-proven path.** It is a smoke test,
not a second five-run cycle. Do not re-run the anchor to "confirm" the mechanism — that is settled and
re-running it produces no new information.

---

## 2. Ground truth verified at drafting time

Verified 2026-08-03 by the orchestrator, directly against source. **Re-confirm the head and the flags
yourself before you act — do not inherit these.**

| Fact | Value | How it was verified |
|---|---|---|
| Local `main` head | `a1cf696d` — *v0.6.160 Fix 04B probe callee signature* | `git rev-parse HEAD` |
| `origin/main` head | `a1cf696d` — 0 ahead, 0 behind | `git rev-list --left-right --count` |
| Last commit touching `/python-backend` | `a1cf696d` (same commit) | `git log -- python-backend` |
| Your first version tag | **`v0.6.161`** | PATCH from v0.6.160 |
| `vcso_sdk_loop` flag | `is_enabled=false`, `test_user_ids=[]`, `diagnostic_user_ids=[]`, `native_model_driven_enabled=false`, all nine `diagnostic_*` toggles false, all three probe dataset ids `""` | `platform_ai_settings` row |
| `vcso_sdk_loop` caps | `max_turns=12`, `max_budget_usd=0.5` | same row |
| `vcso_planner` flag | `is_enabled=false`, both allowlists empty | same row |
| Isolation proof run | `8a51ce24-f417-4709-b060-2803a743422d`, 2026-08-01 09:34:46Z, `status=completed`, 40 lifecycle events | `agent_delegation_runs` |

**Railway is not reachable from the orchestrator's environment. Confirming that `a1cf696d` — and later your
own commits — actually deployed green is your job, not an inherited fact.** Use a cache-busted head
confirmation as a bounded poll to a 10-minute deadline. A timeout means read the Railway deploy list before
concluding anything; a timeout is not evidence of a deployment fault. Railway builds only on changes under
`/python-backend`.

---

## 3. Hard limits — read before you plan

- **You do not arm any flag on your own initiative.** Arming is founder-authorised, explicit, per-occasion,
  and only via `python-backend/scripts/arm_native_capture_canary.py`. Ask, wait for London's go in-thread,
  arm, run, **re-darken immediately and read every flag back off** — even if the run fails, and *before*
  you write your report.
- **Two allowlists.** `test_user_ids` gates the base loop; `diagnostic_user_ids` gates the native
  sub-flags. The founder must be in **both**. Neither is a substitute for the other.
- **Do not flip flag defaults.** Do not widen past the dark founder canary.
- **Do not edit `.planning/orchestration-harness/ROADMAP.md`** (the harness-root file). That is the
  separately founder-gated Phase G cutover. The phase-local
  `.planning/orchestration-harness/phases/04B-vcso-sdk-migration/ROADMAP.md` is a different file and is in
  scope for Unit 0 only.
- **Do not open new amendment sections in `04B-NATIVE-SURFACE-PLAN.md`.** That sprawl is what made the
  state unreadable. Findings go in `04B-CURRENT-STATE.md` §8, one dated line each.
- **Never commit secrets.** `.env` and any credential file stay out of every commit.
- **Never re-add the per-agent `timeout` config key.** The deployed CLI rejects it and it broke delegation
  outright.
- **`max_rounds` ≠ SDK `maxTurns`.** Different concepts, one shared source, six lost cycles. Never
  re-collapse them. Never "fix" anything by editing `default_config.max_rounds`.
- **Commit each logical unit as you finish it.** Uncommitted work does not survive a session boundary.
  PATCH bump per unit. **MINOR and MAJOR bumps are London's call — do not bump them.**

**Locks, binding, and no change may weaken one silently:** founder isolation; one writer (feed the OS
Engine, never write the wiki); cited provenance; cost-tier routing at the capability grain with no
founder-facing model selector; the context-selection IP; curated transparency (no raw payloads, no raw
chain-of-thought); bounded, non-recursive, depth-capped workers.

**Discipline that has cost cycles when broken:**

- **Observe, don't infer.** Pair every claim to a row, a log line, or a file. **Code-verified is not
  observed** — there have been four near-false-greens in this migration, and the last one passed unit tests
  and `compileall` while the live path was broken by a keyword mismatch.
- **Stop on the first failure.** Surface it with evidence. Do not retry blind.
- **If this document asks you to verify something the specified path cannot prove, stop and say so.** Do
  not find a way to make the check pass. That has already caught two bad instructions from this seat, and
  the agent who stopped was right to.
- Never infer flag state from `platform_ai_settings.updated_at` — it is **not maintained on write**. Read
  the values.

---

## 4. The work

Six units. **Order matters** — the fixes and the relabel land before the deletion, for the same reason the
isolation proofs ran before it.

### Unit 0 — Commit the planning state · `v0.6.161`

The entire authority chain for this phase is **untracked**. `04B-CURRENT-STATE.md`,
`04B-TARGET-ARCHITECTURE-AND-ROADMAP.md`, `04B-NATIVE-SURFACE-COMPLETION.md`, `04B-VISION-AND-INTENT.md`
and the Step-3 orchestration handoff exist only on the founder's disk. This is the first thing you fix.

**There is a trap here.** `git status` shows roughly fifteen additional modified files in the 04B folder.
Under `--ignore-cr-at-eol --ignore-all-space` almost all of that disappears: the raw diff is 12,591
insertions against 12,315 deletions, overwhelmingly CRLF churn in immutable JSON evidence files that must
not be rewritten. **A blind `git add .planning` buries the real change in noise and rewrites evidence.**

Stage explicitly:

- **All untracked `04B-*` documents** in the phase folder, plus this file, plus
  `.planning/orchestration-harness/Agent-SDK-Setup/`.
- **Real content edits only:** `04B-E-PLAN.md`, `04B-F-PLAN.md`, `04B-G-PLAN.md`,
  `04B-NATIVE-SURFACE-PLAN.md`, and the phase-local `ROADMAP.md` (+48 lines, pure addition).
- **Leave the CRLF-only JSON and markdown churn unstaged.** Do not normalise line endings in this commit;
  if you think the repo needs a `.gitattributes`, raise it as a finding — do not bundle it here.

Verify before committing: `git diff --cached --ignore-cr-at-eol --stat` should show only the files above.

### Unit 1 — Compute-data binding fix · `v0.6.162`

**The defect, confirmed in shipping code.** `compute_gate_decision`
(`python-backend/services/vcso_sdk_loop.py:747–761`) returns `True` the moment
`successful_retrieval_tool_use_ids` is non-empty. It never inspects what the sandbox is computing *on*. A
retrieval merely having happened licenses computation over numbers the model typed from context. That is
how a wrong figure reached a founder-visible answer in the last anchor run.

This is a flaw in shipping code, not a deferred capability. The gate must bind the computation to the
retrieved values, not merely to the fact of a retrieval.

**Before you design the fix, resolve the open question the target architecture left open** (§11 item 3):
*name the compute-gate rule precisely.* Write the rule down in your plan, in one paragraph, before you
write code — what counts as a retrieval whose data the computation is actually bound to, and what the gate
does when the model computes on a mix of retrieved and asserted values.

**Constraints on the fix:**

- It must be enforced **in code at the hook**, not as prose in a tool description. Prose has already failed
  once here — see defect #3 in `04B-CURRENT-STATE.md` §6, where the model invented a carve-out.
- Refusal must carry a reason the model can act on, matching the tone of the existing refusals in
  `native_tool_access_decision` (`vcso_sdk_loop.py:690–704`) — name what is missing and what would fix it.
- **There is no STEER ending yet.** A turn can only answer or fail (defect #6, Phase G). Do not build one.
  If your gate refusal can strand a turn with no terminal state, say so as a finding rather than inventing
  the third ending here.

**Reachability is the acceptance bar, not unit coverage.** A Phase gate on this project once required
allow/deny unit tests but not proof that the new code was reachable from the live path; a keyword mismatch
then passed both the tests and `compileall` and failed live. Your evidence must include the gate firing on
the deployed path, not only in a test harness.

### Unit 2 — `LEAKED` relabel · `v0.6.163`

**The defect.** `founder_isolation_probe_decision` (`vcso_sdk_loop.py:744`) returns the literal string
`"LEAKED"` whenever `get_dataset_periods` returns rows. For the **owned positive control** — whose whole
purpose is to prove the tool is not simply refusing everything — returning rows is the *correct* outcome.
So the permanent evidence for a binding lock reads `decision="LEAKED"` on a passing control, disambiguated
only by `probe_label="owned_positive_control"`.

Reserve `LEAKED` strictly for a **foreign or random** id returning rows. The owned control returning rows
needs its own affirmative label.

**This is three surfaces, not one.** All were confirmed:

1. `services/vcso_sdk_loop.py:744` — the return value.
2. `tests/test_vcso_sdk_isolation_probes.py:210` — parametrised as `("owned-dataset", "LEAKED")`, so the
   test currently asserts the wrong word.
3. **The persisted row.** Run `8a51ce24-f417-4709-b060-2803a743422d` carries
   `decision="LEAKED"` / `probe_label="owned_positive_control"` inside
   `agent_delegation_runs.metadata->'sdk_native_lifecycle'`.

Also check, and treat separately — these are the *genuine* leak paths and their `LEAKED` is correct:
`vcso_sdk_loop.py:3225`, `:3403`, `:3413`, `:3437`. **Do not relabel those.** Changing a real leak signal
to something softer is the failure mode to avoid here.

**On the persisted row:** do not silently rewrite history. Propose your approach — annotate, or leave the
row and record the correction in `04B-CURRENT-STATE.md` §8 — and get London's decision before touching
`agent_delegation_runs`. The evidence trail for a lock is not something to edit on your own judgment.

### Unit 3 — The deletion, with Path A renamed in the same pass · `v0.6.164`

The external worker transport existed for exactly one reason: to hide worker tools from the lead. A hook
does that job now, and the hook is proven. Nothing on this list has a remaining reason to exist.

**Delete:**

- The external worker MCP server — `services/vcso_worker_mcp_server.py`, `services/vcso_worker_mcp.py`,
  and the mount in `main.py`
- `TURN_REGISTRY` and the token machinery
- The `MCP_TOOL_TIMEOUT` dependency **and the single-process constraint it forces**
- The out-of-band completion bridge (`model_driven_completed_children`)
- **Path A** — `run_app_owned_workers()` and its three compile forks. **Rename its remnants in this same
  commit**; this is the cheapest possible moment and renaming later is pure churn.
- **`vcso_planner`** — `services/vcso_planner.py`, already retired at D2, flag dark
- The **old token-based** `diagnostic_cross_worker_probe`

**Keep:** semantic status normalisation · app-owned data flow · the diagnostics trail · degraded and
partial worker handling · the probe scripts · the turn harness · **the new hook-based
`granular_cross_worker_probe`** · and **Phase E's dormant code** (see the carve-out below).

**Founder-confirmed carve-out (§5 of the orchestration handoff, confirmed by London 2026-08-03):**
Phase E's landed session store (`services/vcso_session_store.py`), the thread→session pointer, and the
`ask_user` code stay **in place and dormant** per D10a — present and unreachable, not deleted. `ask_user`
is live across `services/tool_registry.py`, `services/vcso_sdk_loop.py` and `services/vcso_chat_service.py`
(42 references across 4 files including tests). **Do not remove any of it.** If a deletion in this unit
forces a change to that code, stop and report rather than deciding.

**Scope, measured at `a1cf696d`** — use this to check your own completeness, not as a target to hit:

- Deletion-target symbols appear in **15 files, 64 occurrences**: `main.py`, `services/vcso_sdk_loop.py`
  (16), `services/vcso_planner.py` (6), `services/vcso_chat_service.py` (3),
  `services/vcso_worker_mcp_server.py` (3), `services/vcso_worker_mcp.py` (2),
  `services/vcso_sdk_config.py` (2), plus `unit_tests/`, `tests/` and `scripts/`.
- Probe/token symbols appear in **7 files, 37 occurrences**, including
  `scripts/arm_native_capture_canary.py` (6) and `tests/test_vcso_sdk_isolation_probes.py` (7).

Note that `scripts/arm_native_capture_canary.py` references the token surface. **The arming script must
still work when you are done** — it is the only sanctioned arming path and Unit 5 depends on it.

**One landmine drops in this unit, and only in this unit.** `MCP_TOOL_TIMEOUT=240000` must stay set until
its cause is actually removed, and single-process (Railway replicas = 1) is held by *configuration, not
code* while `TURN_REGISTRY` exists. Removing the code does not by itself relax the Railway setting — do not
change replica configuration; report that it is now safe to change and let London decide when.

**Reassurance on the deletion order, verified 2026-08-03:** the surviving cross-worker isolation evidence
does **not** depend on the code you are deleting. Run `8a51ce24` records `granular_cross_worker_probe` —
the hook-based path — refusing `structured_data_agent → wiki_search` with `per_user_wiki` named as owner.
The old token-based `cross_worker_probe` does not appear in that run at all. The proof outlives the
deletion.

### Unit 4 — CLI version pin · `v0.6.165`

The bundled CLI has already changed agent semantics under this project once, between a passing gate and a
failure. Pin it.

- An **expected version asserted at startup**, and again in CI, failing **native activation closed** on
  mismatch. Dark production must be unaffected — a mismatch must not take down the pre-migration loop.
- The read already exists: `sdk_runtime_versions()` (`vcso_sdk_loop.py:813–842`) returns
  `claude_agent_sdk_version`, `claude_code_cli_version`, `claude_code_cli_source`. Note it is
  `@lru_cache(maxsize=1)` and swallows `OSError`/`SubprocessError` into `"unavailable"` — decide
  deliberately whether `"unavailable"` fails open or closed, and state your choice.
- `scripts/verify_native_activation_compile.py` is the existing free deterministic compile check and is
  the natural CI hook. Record the pinned version somewhere a human will find it, not only in code.

### Unit 5 — Deletion smoke and nested-surface render observation · `v0.6.166`

**This is a smoke test, not a second five-run cycle.** One clean pass on the proven path.

Sequence, and do not compress it:

1. Land Units 0–4, each committed, and confirm the deploy green with a cache-busted head check.
2. Re-run the **zero-canary reload proof** for the nested plan surface.
3. **Ask London for arming authorisation. Wait for an explicit go.** Arm only via
   `arm_native_capture_canary.py`, into both allowlists.
4. Run the smoke.
5. **Re-darken immediately. Read every flag back off and record the read-back** — including on failure, and
   before you write your report.

**Ride the founder's render observation on this run.** London confirms both the nested plan panel and the
SOURCES rail render and populate in general, but no run-specific observation has ever been captured. Ask
him to watch this specific run and record what he sees, tied to the run id.

Note: **the UI and organisation work on those two panels is a separate workstream and is not yours.** Do
not fix it, do not scope it. If it looks wrong, record it as a finding.

**A trap in the smoke's own evidence, found while drafting this.** `persist_sdk_lifecycle` in
`services/vcso_chat_service.py:757` executes `del sdk_lifecycle_events[:-60]` — **only the last 60
lifecycle events survive.** The isolation run carried 40; a deletion smoke that produces more than 60 will
silently drop its earliest events, which are exactly the `runtime_manifest` and `native_access_gate`
entries you will want. Check the event count in your run and say so explicitly if you approach the cap.
Do not raise the cap as a side quest — report it.

---

## 5. What is settled — do not re-derive

Each of these cost real cycles. Re-opening any of them is a regression.

- **The mechanism is proven.** The lead delegates unprompted, never direct-calls, and both isolation
  boundaries were watched refusing with controls. Do not re-run the anchor to confirm it.
- **N=5 is retired as constructed**, and Step 2 closed on mechanism evidence. This changed founder gate
  D13 deliberately. It is not an oversight and must not be reinstated.
- **The composition failures are diagnosed, not mysterious** — four named defects with code citations in
  `04B-CURRENT-STATE.md` §6. Fixing them is Phase F and G work. **Not yours.** If you find yourself
  improving answer quality, you have left your scope.
- **Lead tool visibility cannot be avoided by configuration.** `disallowed_tools` is global and would hide
  tools from subagents too. One server, hook-enforced. Do not re-litigate.
- **The wiki's internal contradictions stay** ($145K MRR in client pages vs $45K in the financial page and
  the records). One writer is a lock: we feed the OS Engine, we never write the wiki. Records win by
  authority rule.

---

## 6. What to bring back

A report London can carry to the orchestrator for verification. **It will be checked against the database
rows, the code, and the deployed state — write it so that check is easy.**

For each unit: the version tag and commit sha; the files touched; what you observed, paired to a row, a log
line, or a file path with a line number.

Specifically required:

- **Every commit sha and version tag**, in order, so the range can be counted. (A previous handoff from
  this seat miscounted a commit range and the execution agent caught it — please do catch it again.)
- **The deployed head confirmation** for each deploy, with how you obtained it.
- **The smoke run id**, and the flag read-back **after** re-darkening, quoted as values.
- **The lifecycle event count** for the smoke run, against the 60-event cap.
- **The reachability evidence for Unit 1** — the compute gate firing on the deployed path, not in a test.
- **Anything you did not do, and why.** A named gap is worth more than a smoothed-over one. If an
  instruction in this document could not be satisfied by the path it specifies, say that plainly — do not
  improvise around it. Stopping for that reason is correct behaviour here and is treated as such.

**Attribution precision:** if you report a spend figure, state exactly what it covers. "The lead alone" and
"the whole query including subagents" have already been confused once in this project's record.

---

## 7. Where the authority sits

| File | What it is | Authority |
|---|---|---|
| `04B-CURRENT-STATE.md` | Where things stand; defect register; drift log; standing rules | Read first |
| `04B-TARGET-ARCHITECTURE-AND-ROADMAP.md` | Decisions D1–D13, target architecture, Steps 1–6, three-endings contract, knowledge-authority rule | **Wins over everything, including this file, on any conflict** |
| `04B-VISION-AND-INTENT.md` §4 | The nine-line fit-for-purpose rubric | Grade against it |
| `04B-NATIVE-SURFACE-COMPLETION.md` | Step 2 close-out, full evidence, the honest re-grade | The record of what Step 2 produced |
| This file | Step 3 execution scope | Subordinate to the three above |

**Caution:** kickoff files are numbered by dispatch order, not roadmap step. Step 0, Step 1 and Step 2
kickoffs all sit *inside* roadmap Step 2. Everything else in the folder is archive or execution brief.

---

## 8. Documentation hygiene the orchestrator noted at drafting

Non-blocking. Fold into Unit 0 if cheap; otherwise record as findings in `04B-CURRENT-STATE.md` §8.

- `04B-CURRENT-STATE.md` is stamped **2026-07-30** but describes the isolation proof, which ran
  **2026-08-01**. `04B-NATIVE-SURFACE-COMPLETION.md` names run `8a51ce24` correctly, so the substance
  holds — only the header dates are stale.
- `stream_vcso_sdk_turn` carries signature defaults `max_turns=6, max_budget_usd=0.25` — the retired caps
  (`vcso_sdk_loop.py:866–867`). The live caller passes the DB-sourced 12 / $0.50
  (`vcso_chat_service.py:857–858`), so these are unreachable dead defaults, **not** a live cap defect.
  Worth aligning so no future reader mistakes them for the real figures.
