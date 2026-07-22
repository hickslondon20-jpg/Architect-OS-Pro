# 04B D2 · SDK-M3 — Reliability Canary Runbook (N = 5)

**Founder-confirmed N = 5** (2026-07-22). The exit is **5 consecutive passing anchor runs**, plus one
simple control that answers directly. Not one green run — Process Rule 10.

---

## The pinned anchor — paste this EXACTLY, all five times

> Our client concentration is rising and our margin is compressing. What should I do in the next 90 days?

**Do not reword it. Do not shorten it. Do not hyphenate "90 days".** The trigger regex needs a financial
term + `concentration` + `90 days` **with a space**; `\b90\s+days?\b` means a hyphenated "90-day"
silently no-ops and the turn runs as an ordinary VCSO answer that proves nothing. The text is pinned in
`python-backend/services/vcso_canary_anchor.py` and a unit test fails if it stops matching.

This is Canary 8 / Canary 9-retry's verbatim wording — the only text that has ever produced a full
three-worker model-driven delegation. It supplies **no figures** and asks only "what should I do", so the
lead cannot answer from context and has to go and get the numbers. Canary 9's replacement anchor stated
the finding and the lead did not delegate.

## The simple control — send ONCE (run 3 or later)

> What is my current quarter's sprint theme?

This must be answered **directly**: no Task, no workers, **zero child rows**, and a turn cost an order of
magnitude below the anchor's. That is effort-scaling in the down direction.

---

## Per-run loop

Sign in as the **seeded** account `hicks.london25@gmail.com` (UUID `cd490873-99aa-4533-9240-f0aa04deb54f`)
— *not* the everyday `4ef8…` account, or the founder allowlist will not match and the flag will not arm.

1. **Pre-flight (agent).** `curl https://api.architectospro.com/api/health` — `ok=true` **and**
   `commit_sha_short` == the intended SHA. Never run a canary against an unverified head.
2. **Arm (agent).** `platform_ai_settings`, project `pwacpjqkntnovndhspxt`, `setting_key='vcso_sdk_loop'`,
   **merge — do not replace**: `is_enabled=true`, `test_user_ids` and `diagnostic_user_ids` set to the
   seeded UUID **only**, `native_model_driven_enabled=true`, `diagnostic_single_worker_enabled=false`,
   `diagnostic_fault_injection_enabled=false`.
3. **Send (founder).** One turn, the pinned anchor verbatim. Expect ~3–4 minutes.
4. **Re-darken immediately (agent).** `is_enabled=false`, both allowlists `[]`,
   `native_model_driven_enabled=false`, `diagnostic_single_worker_enabled=false`; read **both**
   `vcso_sdk_loop` and `vcso_planner` back dark before pulling any evidence.
5. **Read the evidence (agent).** `agent_delegation_runs` (parent + child rows,
   `metadata->sdk_native_lifecycle`), `ai_usage_log` (costs + tiers), `vcso_chat_messages` (the answer).

## What counts as a PASS (all seven, per run)

1. The **lead reasons and delegates** — `task_pre_tool_use` `decision=allow`, not an app-owned dispatch.
2. **All three required workers** spawn via `Task`: `structured_data_agent`, `sandbox_execution_agent`,
   `per_user_wiki` — one completed child row each.
3. **Correct tiers** — Haiku on the workers, Sonnet on compose (MA-06 tier map).
4. **Cited compose** — a founder-visible answer carrying citations.
5. **Nested UI** — `sub_agent_step` events emitted through the progress bridge.
6. **Child traces paired** to `ai_usage_log` rows.
7. **Defect 7 holds** — no `pre_tool_probe` shows a worker calling a sibling's tool, and no worker returns
   without its own child row. A cross-worker call must now surface as a scope refusal, not a success.

Anything short of all seven is a FAIL and **resets the count to zero**. Five consecutive, or the bar is
not met — that is the whole point of the rule.

## Hard rules for every run

- `vcso_sdk_loop` dark and founder-only; **re-darken after each turn**, read both flags back off.
- Railway `MCP_TOOL_TIMEOUT=240000` must remain set (the slow worker's timeout lives only there, not in
  code). Do **not** re-add the per-agent `timeout` config key — the deployed CLI rejects it.
- Single-process only: no `WEB_CONCURRENCY`, no `--workers` (`TURN_REGISTRY` is process-global).
- Path A stays the dark fallback; native scaffolding is not pruned; `vcso_planner` stays retired.
- Version-tagged commits, always forward — **a retry increments too** (see the `v0.6.89` note in
  `04B-D2-M2-FINISH-LOG.md`).

## Run record

| # | Date | Deployed SHA | Parent run | Children (status / duration) | Cost | Verdict |
|---|---|---|---|---|---|---|
| 1 | 2026-07-22 | `b3dab271` | `734b61fc` (completed, 3m22s) | structured `417523bb` 0.5s · wiki `57ff15dd` 2.1s · sandbox `0df539b6` 98.2s — all completed | $0.1427 compose | **PASS** |
| 2 | 2026-07-22 | `b3dab271` | `beba1825` (completed, 2m03s) | structured `4ab2ee8f` 0.5s · sandbox `61ecd789` 26.7s · wiki `f47705e2` 1.9s — all completed | $0.1369 compose | **PASS** |
| 3 | 2026-07-22 | `b3dab271` | `c38d37e6` (completed, 2m04s) | structured `e0bca1c6` 0.3s · wiki `110b8fdb` 1.8s · sandbox `97e320bf` 35.4s — all completed | $0.1332 compose | **PASS** |
| 4 | 2026-07-22 | `b3dab271` | `07f31da2` (completed, 2m29s) | structured `b39e81a1` 0.4s · sandbox `2b4e1c49` 51.0s · wiki `c2d0b82b` 1.3s — all completed | $0.1321 compose | **FAIL — stream lost; founder saw an error** |
| 5 | | | | | | |
| Control (paired w/ run 3) | 2026-07-22 | `b3dab271` | `7fc987e1` (completed, **5.6s**) | **zero children**, zero delegation lifecycle | $0.0306 | **PASS** |

---

## Run 1 — 2026-07-22, deployed `b3dab271`, `ok=true` · **PASS (1/5)**

Flag armed founder-only 16:54:07Z, **re-darkened and both flags read back off before any evidence was
pulled**. Anchor sent verbatim (user message is 103 chars — byte-identical to the pinned string).

**Runs.** Parent `734b61fc-c94d-4849-bdb2-3a0118a268c0` completed in **3m22s**. Three children, all
`completed`: `structured_data_agent` `417523bb` (0.5s) → `per_user_wiki` `57ff15dd` (2.1s) →
`sandbox_execution_agent` `0df539b6` (**98.2s**, in-band under the 240s `MCP_TOOL_TIMEOUT`). Ordering
correct; sandbox ran after structured, so the app-owned findings chain held (the `pre_task_use` ordering
clause requires a non-empty `prior_findings` and it was allowed first try).

**Lifecycle (14 entries).**
- `worker_token_scoping decision=per_capability reason_code=tokens=3` — **the Defect-7 fix live**.
- `runtime_manifest decision=model_driven reason_code=none` — including the new shared-token check.
- **3× `task_pre_tool_use` → `allow` on the FIRST attempt** (`approved_bounded_contract`), **zero denials**.
- **3× `pre_tool_probe`, `agent_id_present=true`, each worker calling its OWN tool** — structured→
  `run_structured_data_agent`, wiki→`run_per_user_wiki`, sandbox→`run_sandbox_execution_agent`.
- 3× `worker_hop received` + 3× `worker_hop completed`. **Three probes, three hops, three children** — a
  1:1:1 ratio with no duplicate dispatch anywhere.

**Tiers.** Workers `claude-haiku-4-5`, compose `claude-sonnet-4-6`. Claude-lock and the MA-06 tier map hold.

**Answer.** 5,403 chars, **33 citations**, compose $0.14274 (44,266 in / 2,604 out).

### Defect 7 — what run 1 does and does not prove

**Does:** the cross-worker call **did not happen**. Canary 9-retry and Canary 10a both showed the sandbox
subagent calling `run_structured_data_agent` (4 probes, one of them cross-worker). Run 1 shows exactly
three probes, each worker on its own tool, and three child rows including a real sandbox child — the row
Canary 10a never produced. The per-capability minting is live and confirmed by `tokens=3`.

**Does not:** no *refusal* was recorded, because nothing attempted a cross-worker call this run. The
refusal path itself is proven by unit test (`test_worker_cannot_invoke_a_sibling_workers_tool`), not by
this canary. That is the honest reading — live evidence is currently **negative** (the leak stopped),
which is what closing the gap should look like, but it is not the same as watching the guard fire.

### Carried forward, NOT a run-1 regression

`ai_usage_log` has **2 `sub_agent` rows, both attributed to the sandbox child** — the structured and wiki
children have no usage row. This is the **pre-existing** shape, identical at the Tier-2 close: Canary 8
produced 2 rows both on `e48905fd`, Canary 9-retry 2 rows both on `9a97d559`. So child-trace pairing is
met to exactly the standard the Tier-2 close was accepted on, and no worse. **Log it as an M4 item**
(child usage attribution collapses onto one child) rather than a reliability failure — but do not let the
completion doc claim per-child pairing it does not have.

---

## Run 2 — 2026-07-22, deployed `b3dab271`, `ok=true` · **PASS (2/5)**

Armed 17:05:10Z, re-darkened and both flags read back off before evidence. Anchor verbatim (103 chars).

**Runs.** Parent `beba1825-bf8d-4a37-a301-705a8fcaee75` completed in **2m03s** — a minute faster than run
1. `structured_data_agent` `4ab2ee8f` (0.5s) → `sandbox_execution_agent` `61ecd789` (**26.7s**) →
`per_user_wiki` `f47705e2` (1.9s). All completed.

**Lifecycle (14 entries), same clean shape as run 1.** `worker_token_scoping tokens=3`;
`runtime_manifest reason_code=none`; **3× `task_pre_tool_use` → allow first attempt, zero denials**;
**3× `pre_tool_probe`, each worker on its OWN tool**; 3 received + 3 completed hops. No duplicate
dispatch, no cross-worker call.

**Tiers.** Haiku workers / Sonnet compose. **Answer.** 5,908 chars, **33 citations**, compose $0.13693.

**Nested UI — CONFIRMED VISUALLY (criterion 5, previously unverifiable from the DB).** Founder
screenshots show the progress panel at 8/8 with the worker steps rendered nested and paired: "Structured
data worker" → "Run Structured Data Agent", "Sandbox compute worker" → "Run Sandbox Execution Agent",
"Strategic context worker" → "Run Per User Wiki", then "Answer prepared". Curated narration streamed
between them ("Structured data confirmed the aggregate P&L snapshot; now running sandbox exposure
modeling…"). No raw payloads or chain-of-thought surfaced.

### The delegation ORDER changed between runs — and that is a good sign

Run 1 went structured → **wiki** → sandbox. Run 2 went structured → **sandbox** → wiki. Both satisfy the
only hard ordering constraint (sandbox must follow structured, and it did — the `pre_task_use` clause
requiring a non-empty inherited `prior_findings` was allowed first try in both). A fixed script would
produce the same order every time. Two different valid orders is evidence the **lead is genuinely
reasoning the decomposition** rather than replaying a sequence — which is the whole point of D2.

Sandbox also ran 26.7s here vs 98.2s in run 1, so the worker's cost is genuinely variable; the 240s
`MCP_TOOL_TIMEOUT` headroom matters and must not be lost.

**Carried forward:** `ai_usage_log` again shows 2 `sub_agent` rows both on the sandbox child
(`61ecd789`). Same pre-existing attribution collapse as runs 1 / Canary 8 / Canary 9-retry. M4 item.

---

## Run 3 — 2026-07-22, deployed `b3dab271`, `ok=true` · **PASS (3/5)** — plus the first paired control

Armed 17:18:11Z, re-darkened and both flags read back off before evidence.

**Anchor.** Parent `c38d37e6-7db3-48a1-b703-fd853104fd1a` completed in **2m04s**. `structured_data_agent`
`e0bca1c6` (0.3s) → `per_user_wiki` `110b8fdb` (1.8s) → `sandbox_execution_agent` `97e320bf` (35.4s). All
completed. Intent read `strategic_synthesis` / `deep`, as required for the thin-slice gate.

**Lifecycle (14 entries), third consecutive clean shape.** `worker_token_scoping tokens=3`;
`runtime_manifest reason_code=none`; **3× `task_pre_tool_use` → allow first attempt, zero denials**;
**3× `pre_tool_probe`, each worker on its OWN tool**; 3 received + 3 completed hops; no duplicates.

**Tiers.** Haiku workers / Sonnet compose. **Answer.** 5,005 chars, **33 citations**, compose $0.13321.

Delegation order this run: structured → wiki → sandbox (matching run 1; run 2 went structured → sandbox
→ wiki). Two distinct valid orders across three runs — the ordering constraint holds every time while
the sequence itself varies, which is what reasoning looks like and what a script does not do.

### The paired simple control — effort-scaling DOWN · **PASS**

> What is my current quarter's sprint theme?

Sent immediately after the anchor, **inside the same armed window**, so it ran through the identical dark
SDK path with model-driven enabled.

| | Anchor | Control | Ratio |
|---|---|---|---|
| Duration | 123.9s | **5.6s** | 22× faster |
| Child runs | 3 (all completed) | **0** | — |
| Delegation lifecycle | 14 entries | **none at all** | — |
| Input tokens (compose) | 33,363 | 6,676 | 5× smaller |
| Cost | $0.13321 | **$0.03063** | 4.4× cheaper |
| Answer | 5,005 chars / 33 citations | 396 chars / 2 citations | — |

The control was read as `lookup` / `shallow`, required no workers, spawned none, and answered directly
with a short cited response. **No over-decomposition.**

**Honest limit of this control (same caveat recorded in `services/vcso_canary_anchor.py`).** Routing is
**app-gated first**: `native_subagent_requirements` returns `()` for a lookup/shallow intent that lacks
the three trigger signals, so the turn never reaches the model-driven branch and the lead is never given
the chance to over-decompose. This is therefore strong evidence that the **system** scales effort down,
and it is **not** by itself evidence of model-level restraint. The model-level claim rests on the lead
prompt's EFFORT-SCALING clause and is only observable on turns that DO reach the model-driven branch.
Do not let the completion doc overstate this.

---

## Run 4 — 2026-07-22, deployed `b3dab271` · **FAIL (count resets)** — delegation perfect, delivery lost

**The founder saw:** `Virtual CSO stream ended before the turn was saved.` Progress panel stuck at
**4/4** (Intent and depth read · Sources selected · Context prepared · Prepare the strategic response)
with **no worker steps at all** — versus 8/8 in runs 1–3.

**The backend, meanwhile, succeeded completely.**

| Evidence | Value |
|---|---|
| Parent `07f31da2-35bd-4ee5-89f8-dee25e2bd7de` | **completed**, 148.8s |
| Children | structured `b39e81a1` 0.4s · sandbox `2b4e1c49` 51.0s · wiki `c2d0b82b` 1.3s — **all completed** |
| Lifecycle | 14 entries, **identical clean shape to runs 1–3**: `tokens=3`, manifest `none`, 3× Task allow first-try, **zero denials**, 3 probes each on its OWN tool, 3+3 hops |
| Compose | $0.13214, 44,747 in / 2,545 out, Sonnet |
| **Assistant message** | **SAVED** — 4,886 chars, **33 citations**, written 17:33:36.200 |

### Two findings, and they are different sizes

**1. The delegation engine did not fail. This is its 4th consecutive clean run.** Every delegation
criterion passed. Whatever went wrong is downstream of the loop.

**2. Defect 8 (NEW) — the UI reports a saved turn as unsaved.** The message
"stream ended before the turn was saved" is **factually wrong here**: the assistant message was persisted
with 33 citations **140ms before the parent run completed**. The founder was shown a failure for a turn
that had actually succeeded, and the composed answer they paid $0.13 for was sitting in the database the
whole time. On stream loss the UI must recover the persisted message, not assert it does not exist.

### Why this is NOT the failure the keepalive was built for — and what that means

The keepalive (step A2) addresses an **idle** disconnect: a long silent gap during the slow worker. That
is not this. The client received four steps and then nothing, i.e. the stream died **~12s in**, before
the first worker had even returned and long before any silent gap existed. Runs 1–3 each contained silent
worker stretches of 27–98s and survived them.

**What the keepalive is NOT disproven by:** this run never reached the condition it guards.
**What remains unproven:** the keepalive's *delivery* has not been directly observed — SSE frames are not
visible from the database, and Railway request logs were not pulled. Relay path is confirmed by code
inspection (`vcso_chat_service` does `yield from stream_vcso_sdk_turn`, so heartbeat events pass through
unfiltered), but code inspection is not observation. **Do not claim the keepalive is proven.**

**Cause of the early disconnect: UNDETERMINED.** Available evidence cannot distinguish a browser/tab-level
drop, an edge blip, or something in the early SSE path. Naming a cause here would be a guess.

### Bar ruling

Run 4 **fails** criteria 4 (founder-visible cited answer) and 5 (nested UI). Under the rule as written the
consecutive count **resets to zero**. Recorded as a fail; the founder was asked how to proceed rather than
the agent quietly redefining the bar mid-measurement — see the checkpoint note.

