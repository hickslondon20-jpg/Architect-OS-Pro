# 04B — Step 3, Unit 5 Dispatch: Deletion Smoke

**Date drafted:** 2026-08-09 · **Drafted by:** the Orchestration Agent · **For:** a fresh execution agent
**Status:** Authorised by London. Units 0–4 are banked, verified, and deployed.

**Self-contained cold pickup.** This is the last unit of Step 3. It is short because everything upstream
is done. Read it fully before acting.

---

## 1. Where things stand

Virtual CSO is being migrated from a hand-written loop with a keyword router onto the Claude Agent SDK.
**Nothing is live. Every flag is dark. Production Virtual CSO still runs the pre-migration loop**, and that
untouched loop is the real safety net.

Step 3 Units 0–4 are complete, committed, pushed, deployed, and independently verified by the orchestrator
against the code and the database:

| Unit | What landed | Commit |
|---|---|---|
| 0 | Planning state committed | `bc3b0ca4` v0.6.161 |
| 1 | `execute_code` bound to same-turn cited retrieval data | `f2ac3502` v0.6.162 |
| 2 | Owned isolation control relabelled; persisted row not rewritten | `0beaf48d` v0.6.163 |
| 3 | Retired worker transport / planner / token bridge deleted (6,590 lines) | `b216a0c4` v0.6.164 |
| 4 | Bundled Claude Code CLI pinned to `2.1.209 (Claude Code)` | `421560d1` v0.6.165 |

**Your version tag is `v0.6.166`.** Do not bump MINOR or MAJOR — that is London's call.

**Verified at drafting, 2026-08-09 — re-confirm, do not inherit:**

- `HEAD` = `origin/main` = `421560d1ba07083fed96f57bb7e8be888fbe3764`
- Deployed head **confirmed live**: `GET https://api.architectospro.com/api/health` returns
  `commit_sha: 421560d1ba07083fed96f57bb7e8be888fbe3764`. Railway shows v0.6.165 ACTIVE, deployment
  successful, 1 replica.
- `vcso_sdk_loop` fully dark: `is_enabled=false`, both allowlists empty, `native_model_driven_enabled=false`,
  stream capture / granular probe / isolation probe all false, caps 12 turns / $0.50.
- Zero `agent_delegation_runs` since the isolation proof run `8a51ce24` on 2026-08-01.

---

## 2. The one thing most likely to be misread

**This smoke is expected to produce a mediocre or refused answer, and that is not a failure.**

Step 2 closed on *mechanism* evidence. The lead delegates correctly and the safety boundaries hold. What is
**not** proven is composition quality — the system fetches correct data and then composes from stale or
mistyped figures. That is diagnosed, scheduled for Phases F and G, and **explicitly not your problem.**

More specifically: Unit 1 tightened the compute gate so `execute_code` can no longer run on numbers the
model typed from context. The anchor run that previously produced a wrong figure did exactly that. **So the
most likely outcome of this smoke is that the compute gate now refuses that computation.** That is the fix
working. Record it as a pass for Unit 1.

**And there is no STEER ending yet** — a turn can only answer or fail (defect #6, Phase G). So a
compute-gate refusal may strand the turn with nowhere to go, and the turn may fail outright. **If that
happens, it is a finding, not a regression.** Record precisely what the turn did when it could not compute.
That observation is genuinely valuable input to Phase G's design.

**Do not:** fix composition, build a STEER ending, loosen the compute gate to make the turn complete, or
re-run to get a better answer. If you find yourself improving answer quality, you have left your scope.

---

## 3. What you are actually proving

Three things, and only these:

1. **The deletion broke nothing.** The native path still compiles, activates, delegates, retrieves, and
   persists evidence with 6,590 lines of transport, planner and token machinery removed.
2. **Unit 1 is reachable on the live path.** The compute gate fires on the deployed server, not only in a
   test. **This is the acceptance bar for Unit 1 and it is currently unmet** — a Phase gate on this project
   once required unit coverage but not live reachability, and a keyword mismatch then passed both the tests
   and `compileall` and failed live. Code-verified is not observed.
3. **The nested plan surface still renders**, observed on a run we can name by id.

**This is a smoke test, not a second five-run cycle.** One clean pass. Do not re-run the anchor to
re-confirm the mechanism — that is settled and re-running produces no new information.

---

## 4. The work

### 4.1 — Findings log first (free, do it before anything live)

Add to `04B-CURRENT-STATE.md` §8, one dated line each. **Do not open amendment sections in
`04B-NATIVE-SURFACE-PLAN.md`.**

- 2026-08-09 — Deploy of `421560d1` was reported as a head mismatch during Unit 4 and was **propagation
  timing, not a fault.** Railway shows the deploy succeeded; health now returns `421560d1`. **Third
  occurrence.** A head mismatch immediately after a push is not evidence of a broken deploy; read the
  Railway deploy list before concluding anything.
- 2026-08-09 — Compute-gate binding inspects material numeric constants **≥ 1000 only**
  (`_material_numeric_tokens`, `vcso_sdk_loop.py:803`). Typed figures below that threshold are unchecked.
  Deliberate — small integers are usually legitimate literals — but it is a real coverage limit.
- 2026-08-09 — The CLI pin treats `"unavailable"` as a mismatch and fails closed. If the container's
  subprocess call to the bundled CLI fails for an environmental reason, native activation blocks. Check
  `sdk_runtime_pin_status()` before diagnosing any confusing native failure.

Also: `.claude/settings.local.json` is untracked. Add it to `.gitignore` rather than leaving it loose.

Commit this as `v0.6.166` before going live. It is your safe landing point if the smoke goes sideways.

### 4.2 — Zero-canary reload proof

Re-run the zero-canary reload proof for the nested plan surface. This costs nothing and does not require
arming. If it fails, **stop here and report** — do not proceed to a paid run.

### 4.3 — Preflight

Run the free deterministic compile check, `scripts/verify_native_activation_compile.py`. It now includes
check `J_claude_code_cli_version_pinned`. **If `J` fails, stop and report** — that is the CLI pin refusing
activation, and it must be understood before a live run, not worked around.

Confirm the deployed head again, cache-busted, immediately before arming.

### 4.4 — Arming

**Ask London for authorisation and wait for an explicit go in-thread. Do not arm in anticipation.**

`scripts/arm_native_capture_canary.py` survived Unit 3 intact and is self-guarding: `arm` refuses unless
the row is already fully dark **and** the cache-busted health SHA matches `--expected-sha`. Use it. Do not
write flags by any other route.

```
python scripts/arm_native_capture_canary.py arm \
  --founder-id cd490873-99aa-4533-9240-f0aa04deb54f \
  --expected-sha 421560d1ba07083fed96f57bb7e8be888fbe3764 \
  --confirm ARM-ONE-CAPTURE-CANARY
```

**Arm plain — no probe flags.** Do **not** pass `--granular-cross-worker-probe`, `--foreign-dataset-id`,
`--owned-dataset-id` or `--random-dataset-id`. The isolation evidence is already banked from run
`8a51ce24` and does not need re-running; the surviving cross-worker proof is the hook-based path, which
this deletion did not touch. Re-running the probes costs money and proves nothing new.

This arms both allowlists to the founder, `native_model_driven_enabled=true`, stream capture on, caps 12
turns / $0.50, everything else off. The script asserts the armed state back before returning.

### 4.5 — The run

One turn, the pinned anchor, submitted by London through the normal chat surface.

Historic cost is roughly $0.23 against the $0.50 cap. If you approach the cap, let it stop — do not raise
it. `max_turns` is 12 and is a hardcoded production ceiling; raising it is a founder decision.

**Ask London to watch this specific run** and confirm the nested plan panel and the SOURCES rail render and
populate. Tie his observation to the run id. Both panels also need UI and organisation work — **that is a
separate workstream and is not yours.** If something looks wrong, record it; do not fix it.

### 4.6 — Re-darken, immediately

```
python scripts/arm_native_capture_canary.py disarm --confirm RE-DARKEN-04B
python scripts/arm_native_capture_canary.py read
```

**Do this even if the run fails, and before you write your report.** Paste the `read` output into the
report as your flag read-back. `disarm` asserts the dark state itself, but quote the values anyway.

Never infer flag state from `platform_ai_settings.updated_at` — it is **not maintained on write.**

---

## 5. Landmines specific to this run

- **The lifecycle evidence can truncate itself.** `persist_sdk_lifecycle`
  (`services/vcso_chat_service.py:757`) executes `del sdk_lifecycle_events[:-60]` — **only the last 60
  events survive.** The isolation run carried 40. Report your event count. If you approach 60, say so
  explicitly, because the events that get dropped are the earliest ones — `runtime_manifest` and
  `native_access_gate` — which are exactly what proves the deletion is clean. **Do not raise the cap as a
  side quest.**
- **Single process is still held by configuration, not code.** Railway replicas = 1. Unit 3 removed the
  code reason for it, so it is now safe to change. **Do not change it.** There is no need, and it is
  London's call.
- **`MCP_TOOL_TIMEOUT`** — its cause is gone as of Unit 3. Report whether the environment variable is still
  set; do not remove it yourself.
- Never re-add the per-agent `timeout` config key. The deployed CLI rejects it and it broke delegation
  outright.
- `max_rounds` and SDK `maxTurns` are different concepts. Never re-collapse them. Never "fix" anything by
  editing `default_config.max_rounds`.

**Locks, binding:** founder isolation; one writer (feed the OS Engine, never write the wiki); cited
provenance; cost-tier routing at the capability grain with no founder-facing model selector; the
context-selection IP; curated transparency; bounded, non-recursive, depth-capped workers.

---

## 6. Pass, fail, and stop

**Pass** — all of:

- Native activation succeeded; `runtime_manifest` recorded; the CLI pin did not block.
- The lead delegated on its own. Zero direct handler executions.
- Retrieval succeeded and persisted with citations.
- **The compute gate was evaluated on the live path**, and you can point to the lifecycle entry showing it.
  Allowed or refused are both passes — what matters is that it fired and that its decision matches the
  input it saw.
- Child runs, steps and per-child token attribution persisted.
- Flags read back fully dark.

**Not a fail:** a weak answer, a stale figure in the prose, a compute-gate refusal, or a turn that ends
without an answer because no STEER ending exists. Record these precisely; they are Phase F/G inputs.

**Stop and report immediately, without retrying:** any import or activation error naming a deleted module;
`J_claude_code_cli_version_pinned` failing; a hook refusing something it should allow; any evidence of
cross-worker or founder-isolation boundary weakening; or the flags failing to read back dark.

**If any instruction here asks you to verify something the specified path cannot prove, stop and say so.**
Do not find a way to make the check pass. That has already caught two bad instructions written by this
seat, and the agent who stopped was right to.

---

## 7. What to bring back

Written so it can be checked against the database, the code, and the deployed state — it will be.

- The commit sha and version tag for §4.1.
- The zero-canary reload proof result, and the preflight verdict including check `J`.
- The cache-busted deployed-head confirmation, and how you obtained it.
- **The run id.**
- **The compute-gate lifecycle entry, quoted** — this is the Unit 1 acceptance evidence and the single most
  important thing in your report.
- The lifecycle event count, against the 60 cap.
- The spend figure, **stating exactly what it covers** — "the lead alone" and "the whole query including
  subagents" have been confused once in this project's record.
- The flag read-back after disarming, quoted as values.
- London's render observation, tied to the run id.
- **Anything you did not do, and why.** A named gap is worth more than a smoothed-over one.

---

## 8. Where the authority sits

`04B-TARGET-ARCHITECTURE-AND-ROADMAP.md` **wins over everything, including this file, on any conflict.**
Then `04B-CURRENT-STATE.md` for current state and the defect register, and `04B-VISION-AND-INTENT.md` §4
for the rubric. `04B-STEP-3-EXECUTION-HANDOFF.md` covers Units 0–4 and is context for what you inherited.

**After this unit:** Step 3 closes and Step 4 opens — Phase E, `ask_user` and sessions on the single path.
Phase E's session store and `ask_user` code are present and dormant by founder decision; **they were
deliberately preserved through the Unit 3 deletion. Do not touch them.**
