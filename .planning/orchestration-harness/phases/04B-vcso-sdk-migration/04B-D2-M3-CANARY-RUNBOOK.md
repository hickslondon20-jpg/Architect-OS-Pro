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
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |
| Control | | | | (expect **none**) | | |

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
