# 04B — Step 4 Execution Handoff: Phase E, `ask_user` and Sessions on the Single Path

**Date drafted:** 2026-08-09 · **Drafted by:** the Orchestration Agent · **For:** a fresh execution agent
**Status:** Authorised by London. Step 3 is closed.

**Self-contained cold pickup.** Read this fully before acting. Where it cites a file and line, open the
file — it was written against `4f24b13b` and lines move.

---

## 1. Where things stand

Virtual CSO is being migrated from a hand-written loop with a keyword router onto the Claude Agent SDK.
**Nothing is live. Every flag is dark. Production Virtual CSO still runs the pre-migration loop**, and that
untouched loop is the real safety net. Keep it that way.

Steps 1, 1.5, 2 and 3 are closed. The engine is proven: the lead delegates unprompted, isolation holds,
and 6,590 lines of retired transport, planner and token machinery are gone with a clean smoke.
See `04B-STEP-3-COMPLETION.md`.

**Step 4 is a build, not a proof.** It is the first substantial new capability since the migration began.

### Founder decisions recorded 2026-08-09 — do not re-derive

- **Versioning stays on `v0.6.x` for the remainder of the SDK migration.** Your first tag is
  **`v0.6.167`**. Do **not** propose or apply `v0.7.0`; the MINOR bump is reserved for the completion of
  the whole migration and is London's call alone.
- **The `LEAKED` row on run `8a51ce24` stays unmodified.** The correction lives in
  `04B-CURRENT-STATE.md` §8 and `04B-STEP-3-COMPLETION.md`, both in git. **We annotate the record; we do
  not rewrite persisted evidence** — particularly for a binding lock. Treat this as the standing precedent
  for evidence handling, including for Domain Agents later. **Closed.**
- **Railway replicas stay at 1.** Unit 3 removed the code reason for the constraint, so it is now safe to
  change — and it is deliberately not being changed. Multiple replicas add nondeterminism to single-run
  canary proofs for zero benefit while everything is dark and founder-only. Revisit at beta launch, not
  here. **Do not change replica configuration in this step.**
- **`MCP_TOOL_TIMEOUT` gets removed from the Railway environment — see §4.1.** Its cause is deleted and
  zero code references remain.

---

## 2. Verified ground truth at drafting

Verified 2026-08-09 by the orchestrator against source and the database. **Re-confirm; do not inherit.**

| Fact | Value |
|---|---|
| `HEAD` = `origin/main` | `4f24b13b8728fe260dc8371b4fdc553ae5fa3521` (v0.6.166) |
| Deployed head | `421560d1…` (v0.6.165) — **v0.6.166 was planning-only and deliberately not pushed to deploy** |
| `vcso_sdk_loop` flag | fully dark: `is_enabled=false`, both allowlists empty, `native_model_driven_enabled=false`, all diagnostics false, caps 12 turns / $0.50 |
| Bundled CLI pin | `2.1.209 (Claude Code)`, fails closed on mismatch **and** on `unavailable` |

**There are uncommitted planning documents.** `04B-STEP-3-COMPLETION.md`,
`04B-STEP-4-EXECUTION-HANDOFF.md` (this file), and edits to `04B-CURRENT-STATE.md`, `04B-G-PLAN.md` and
`04B-F-PLAN.md`. Committing them is your first unit.

---

## 3. The most important thing in this document

**`04B-E-PLAN.md` is written against Deep Mode, and Deep Mode no longer exists. If you follow it literally
you will build against a flag that is permanently `False`.**

D10 re-scoped Phase E to "`ask_user` and sessions on the single path; no founder-facing Deep Mode toggle,"
and D10a pulled the toggle's removal forward into Step 1.5. Roadmap Step 4 reads: "no mode toggle, no
second composer branch, no workspace files until a consumer exists."

**In the live code today:** `deep_mode = False` is hardcoded at `services/vcso_chat_service.py:205`. Every
downstream branch derives from it — `sdk_deep_mode = bool(deep_mode and …)` at `:209`, the session
adapter, `fork_session`, `resume_state` selection. **All of it is unreachable.**

So your first design decision, before any code: **what gates the session adapter and `ask_user` now that
`deepMode` is gone?** The answer must be the native model-driven path itself plus the founder allowlists —
not a reinstated toggle, not a new mode flag, not a keyword. Reinstating a mode toggle would undo D10a and
re-introduce the exact tripwire that voided a canary.

`04B-E-PLAN.md` remains useful for its recon, its Guardrail-2 storage design, and its authority
boundaries. **Read it for those. Do not inherit its `deepMode=true` gating.** On any conflict,
`04B-TARGET-ARCHITECTURE-AND-ROADMAP.md` wins.

---

## 4. What is already landed — do not rebuild it

The session substrate is further along than `04B-E-PLAN.md` suggests. Verified directly:

- **`private.vcso_sdk_session_entries` exists** — in the unexposed `private` schema exactly as
  Guardrail 2 specified. **36 entries across 7 sessions**, most recent 2026-08-09 19:01:57Z.
- **All three service-role RPCs exist:** `vcso_sdk_session_append`, `vcso_sdk_session_load`,
  `vcso_sdk_session_list_subkeys`.
- **`SupabaseVcsoSessionStore`** (`services/vcso_session_store.py`) implements `append` / `load` /
  `list_subkeys` / `confirmed_persisted` against those RPCs, founder- and thread-bound at construction.
- **It round-trips.** The Step 3 zero-canary reload proof passed **3/3** via
  `scripts/verify_phase_e_reload.py` and wrote the entries above.
- `agent_todos` and `workspace_files` tables exist and are the correct canonical mutable surfaces.

**A caution, from a mistake made while drafting this:** I first queried `information_schema.tables` with
`table_schema='public'` and concluded the session table did not exist. It is in `private`. **Query across
schemas before reporting anything absent.**

**So the missing piece is not sessions. It is `ask_user` on the native path** — currently handled only in
the legacy branch (`vcso_chat_service.py:985` per the E plan recon; verify the line).

---

## 5. The work

### 5.1 — Commit the planning state, and clear one landmine · `v0.6.167`

Commit the uncommitted planning documents listed in §2. **Stage explicitly** — the 04B folder still
carries CRLF-only churn in immutable JSON evidence files that must not be rewritten. Verify with
`git diff --cached --ignore-cr-at-eol --stat` before committing.

Then, **with London**, remove `MCP_TOOL_TIMEOUT` from the Railway environment. Zero code references remain
(`b216a0c4` deleted its cause; verified 0 occurrences across `python-backend`). Do it now rather than
later so any effect surfaces during this step's own work instead of being conflated with a later change.
It is a founder-console action — ask, don't assume access. Report the redeploy and confirm health after.

### 5.2 — Design note before code: the three endings

`04B-TARGET-ARCHITECTURE-AND-ROADMAP.md` §5 is the contract. **Read it before designing anything.** Per
D9, `ask_user` must be designed against reflect-and-steer so the two do not overlap — **you build
`ask_user` only; STEER is Phase G.**

The firing rule, which is unambiguous by construction:

- Missing thing is **data the platform could obtain** — a connector to link, a document to upload, a
  period not in the series, a computation not yet run → **STEER.** Not built. Not yours.
- Missing thing is **a judgment or preference only the founder holds** — which of two defensible
  definitions, which of two priorities, an unobservable constraint → **PAUSE (`ask_user`).** Yours.
- Neither → **ANSWER.**

**The trap, and it is live right now.** Step 3's smoke ended with the model unable to compute and
publishing uncited figures instead (defects 10 and 11). It will be tempting to reach for `ask_user` to
"ask the founder for the numbers." **That is wrong.** The missing thing there is platform-obtainable data
— an aggregate query shape Phase F will approve. It is a STEER case, and using PAUSE for it would burn the
firing rule's clean boundary on the very first implementation and make G's design ambiguous forever.

**Write your firing-rule interpretation down in one paragraph and get it agreed before you build.**

### 5.3 — `ask_user` on the single native path

Build to the boundary approved in `04B-E-PLAN.md` §"Approved implementation boundary", **with the
`deepMode` gating replaced per §3 above**:

- Recognise the existing `ask_user` marker; emit the unchanged `ask_user` / `done_waiting` SSE events —
  the frontend contract has been stable and valuable, do not redesign it.
- Complete and flush the SDK session **before** marking the thread waiting.
- Suppress post-question model prose from the founder surface.
- Resume with the founder's answer as the next SDK prompt, `resume=<session_id>`; fork uses
  `resume=` + `fork_session=true` with a new id on the forked thread.
- **SDK Deep Mode must never read or write `deep_resume_state`** — that stays exclusively for the dark
  legacy fallback. One resume authority per path, explicitly selected.
- Rehydrate `agent_todos` and workspace metadata before resumed execution; emit initial `todos_updated` /
  `workspace_updated` snapshots.

**Guardrail 1 still stands and has not been discharged: spike the resume mechanic on the DEPLOYED CLI
first.** Prove `resume=` and `fork_session=true` round-trip on the deployed runtime before building the
full adapter. The per-agent `timeout` key was documentation-valid and rejected by the deployed CLI, and it
broke delegation outright — same class of risk. **Report the spike result before the full build.**

**Scope discipline, from Roadmap Step 4:** no mode toggle, no second composer branch, no workspace files
until a consumer exists. Minimal functional frontend loading is in scope; **no redesign.**

### 5.4 — The gate

**Pause → reload → resume with plan and context intact, three times, plus one confirmation through the
normal chat surface.**

Arming is founder-authorised per occasion via `scripts/arm_native_capture_canary.py`, arm plain, no probe
flags. Re-darken immediately and read every flag back off — even on failure, before writing the report.

**Carry the outstanding observation into your first armed run:** London watches the nested plan panel and
the SOURCES rail render and populate, tied to a run id. This was never captured in Step 3 — the operator
harness produced the run, not a human watching the UI. **Do not spend a dedicated paid run on it.** The UI
and organisation work on those panels is a separate workstream and is not yours; record, do not fix.

---

## 6. Hard limits

- **Do not arm any flag on your own initiative.** Explicit founder go, per occasion, `arm_native_capture_canary.py` only.
- **Do not reinstate a Deep Mode toggle or any mode flag.** D10a removed it because it was a tripwire that
  voided a canary, not because it was untidy.
- **Do not build STEER.** Phase G, designed jointly with what you build here.
- **Do not touch Phase F's territory** — the aggregate query shapes, the connector, the financial series.
- **Do not change Railway replica configuration.**
- **Do not edit the harness-root `ROADMAP.md`.**
- **Do not open new amendment sections in `04B-NATIVE-SURFACE-PLAN.md`** — findings go in
  `04B-CURRENT-STATE.md` §8, one dated line each.
- Never re-add the per-agent `timeout` config key. Never re-collapse `max_rounds` and SDK `maxTurns`.
- Never commit secrets.
- **Commit each logical unit as you finish it.** PATCH per unit from `v0.6.167`. No MINOR, no MAJOR.

**Locks, binding:** founder isolation; one writer (feed the OS Engine, never write the wiki); cited
provenance; cost-tier routing at the capability grain with no founder-facing model selector; the
context-selection IP; curated transparency; bounded, non-recursive, depth-capped workers.

**Two build-time notes carried from Guardrail 2, not blockers:** give `vcso_sdk_session_entries` a
retention or TTL policy, or explicitly defer it — do not let raw transcript grow unbounded. And verify,
rather than assume, that RLS is enabled, anon/authenticated grants are absent, and the table stays out of
the exposed schema.

---

## 7. Discipline

- **Observe, don't infer.** Pair every claim to a row, a log line, or a file and line. **Code-verified is
  not observed** — there have been five near-false-greens in this migration.
- **Grade on the founder-visible output, not on lifecycle events.** Step 3's lifecycle trail was clean
  while the published answer was not. This cost a wrong close-out call.
- **Query across schemas before reporting anything absent.** See §4.
- **Stop on the first failure.** Surface it with evidence. Do not retry blind.
- **If an instruction here asks you to verify something the specified path cannot prove, stop and say so.**
  Do not find a way to make the check pass. This has already caught bad instructions from this seat twice,
  and the agents who stopped were right to.
- Never infer flag state from `platform_ai_settings.updated_at` — it is not maintained on write.
- Cache-busted deployed-head confirmation before every canary, bounded poll to a 10-minute deadline. A
  mismatch immediately after a push is **not** evidence of a fault — read the Railway deploy list first.
  That misdiagnosis has happened three times.

---

## 8. What to bring back

- Every commit sha and version tag, in order.
- **The Guardrail 1 spike result, reported before the full build.**
- **Your written firing-rule interpretation**, agreed before implementation.
- The gate evidence: three pause → reload → resume cycles with plan and context intact, plus the chat-surface
  confirmation, each tied to a thread and run id.
- Deployed-head confirmations, and the flag read-back after each disarm, quoted as values.
- Spend, **stating exactly what it covers**.
- London's render observation on the plan panel and SOURCES rail, tied to a run id.
- Confirmation that `MCP_TOOL_TIMEOUT` is gone and health is green after the redeploy.
- **Anything you did not do, and why.** A named gap is worth more than a smoothed-over one.

---

## 9. Authority

`04B-TARGET-ARCHITECTURE-AND-ROADMAP.md` **wins over everything, including this file** — especially D9,
D10, D10a and §5. Then `04B-CURRENT-STATE.md` for current state and the defect register,
`04B-VISION-AND-INTENT.md` §4 for the rubric, `04B-STEP-3-COMPLETION.md` for what you inherited.
`04B-E-PLAN.md` is **reference for recon and storage design only** — see §3.

**After Step 4:** Step 5 is Phase F, whose first unit is now the structured-query aggregate shapes
(defect 11), ahead of the QuickBooks connector.
