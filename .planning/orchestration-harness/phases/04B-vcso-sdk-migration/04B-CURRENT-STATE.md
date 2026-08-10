# 04B — Current State

**Last updated:** 2026-08-09 · **This is the single entry point.** A new orchestration agent reads this
file first and nothing else until it has. Everything else in this folder is either a decision record, a
completed phase artifact, or archive.

---

## 1. Read order and what wins

| File | What it is | Authority |
|---|---|---|
| **This file** | Where we are, what's proven, what's next | Start here. Current state only |
| `04B-TARGET-ARCHITECTURE-AND-ROADMAP.md` | Decisions D1–D13, target architecture, roadmap Steps 1–6, the three-endings contract, the knowledge-authority rule | **Wins over everything on conflicts** |
| `04B-VISION-AND-INTENT.md` §4 | The nine-line fit-for-purpose rubric | Grade every phase against it |
| `04B-NATIVE-SURFACE-COMPLETION.md` | Step 2 close-out: full evidence, the honest re-grade, defects handed forward | The record of what Step 2 actually produced |
| `04B-NATIVE-SURFACE-PLAN.md` | Step 1–2 plan, plus §5B.1–§5B.12 — a running findings log | Historical detail. **Do not add new amendments here; log findings in §8 of this file** |
| Everything else (`*-KICKOFF.md`, `*-FINDINGS.md`, `*-RUNBOOK.md`, D2-era files) | Execution briefs and archive | Reference only |

**Naming caution:** kickoff files are numbered by dispatch order, not roadmap step. Step 0, Step 1 and
Step 2 kickoffs all sit *inside* roadmap Step 2. See `04B-NATIVE-SURFACE-PLAN.md` §5B.9.

---

## 2. Where we are, in plain terms

Virtual CSO is being moved from a hand-written loop with a keyword router onto the Claude Agent SDK, so
the model reasons about which specialist worker to call instead of matching phrases. Same platform,
different engine.

**Nothing is live. Every flag is dark. Production Virtual CSO still runs the pre-migration loop**, and
that untouched loop is the real safety net. This has been true for the entire migration.

**Roadmap Steps 2 and 3 are closed.** The engine works: the lead delegates on its own, refuses to cheat,
and the safety boundaries hold under observed test. The old plumbing is gone — 6,590 lines of external
worker transport, planner, and token machinery deleted against a proven path, with a clean smoke.

**The answers are still not right, and Step 3 sharpened our understanding of why.** The system fetches
correct data and then composes from figures that never passed through an auditable computation. Step 3's
compute gate closed the *sandbox* path to that; the model responded by doing the arithmetic in prose and
publishing it uncited. **Engine proven. Judgment not. And the gate on judgment is bypassable.** See §5
and defects 10–11.

---

## 3. Status by roadmap step

| Step | What it is | Status |
|---|---|---|
| 1 | Author the in-process worker surface | **Done** |
| 1.5 | Remove the Deep Mode and keyword-eligibility tripwires | **Done** |
| **2** | **Prove the lead delegates reliably; two mandatory isolation tests** | **CLOSED on mechanism evidence.** See §4 and §5 |
| **3** | **Compute-data binding fix, `LEAKED` relabel, delete the old plumbing, pin the CLI version** | **CLOSED 2026-08-09.** Deletion clean, smoke passed. See `04B-STEP-3-COMPLETION.md` |
| **4** | **Phase E — `ask_user` and sessions on the single path** | **NEXT.** Not started |
| 5 | Phase F — **structured-query aggregate shapes first**, then QuickBooks connector, real financial series, freshness/authority inside the retrieval tools | Not started. **This fixes more of the wrong-answer problem than any reasoning change**, and Step 3 produced live evidence for the reordering (defect 11) |
| 6 | Phase G — reflect-and-steer, **authority enforced at terminal validation on the published answer**, varied-question rubric, then cutover | Not started. Scope tightened by Step 3 — see defect 10 |

---

## 4. What is proven

All of the following was observed live on the deployed backend and paired to persisted rows. Full evidence
and run ids in `04B-NATIVE-SURFACE-COMPLETION.md`.

- **The lead delegates unprompted**, in the correct order, on every native run.
- **Zero direct handler executions. Zero hook refusals.** The lead never attempted to bypass delegation.
- **The forcing safety net never had to fire.** The required-worker `stop_hook` never blocked — delegation
  was the model's own choice, not scaffolding.
- **Cross-worker isolation holds.** One worker attempting a sibling's tool was refused, with a reason
  naming the owning worker.
- **Founder isolation holds.** A read against another tenant's dataset was refused, with the fixture proven
  foreign by direct query, a positive control proving the tool was not simply refusing everything, and a
  negative control documenting that the refusal message carries no information by itself.
- **Model tiers are correct** — Sonnet lead, Haiku workers.
- **Evidence persists** — child runs, steps, source refs, per-child token attribution.
- **Per-run spend is measurable** on the same figure the SDK enforces its budget against.

**Consequence: the external worker transport has no remaining reason to exist.** It was built solely to
hide worker tools from the lead. A hook does that job, and the hook is proven.

---

## 5. What is NOT proven

**Composition and derivation quality. Both real test runs failed on it.**

- Run 1 fetched correctly, then answered from wiki narrative because the account held one row of data and
  the question needed a trend.
- Run 2, on repaired data, fetched correctly, ran the sandbox — then computed on numbers typed from
  context rather than the numbers retrieved, got one wrong, and published an incorrect figure alongside
  stale wiki retainers.

- Run 3 (Step 3 smoke, `5f03966b-25ee-4ad5-9804-da7604b849c0`) fetched correctly, was **blocked from the
  sandbox three times by the new compute gate — correctly** — and then computed nine percentages in prose
  and published them to the founder with no compute result and no citation.

**Two rubric lines were downgraded, not upgraded, in the Step 2 close-out:** *composes founder-grade cited
judgment* and *honest about gaps* both moved from proven to failing.

**Step 3 re-graded a third line down.** *Cited provenance* was previously assumed to be holding because
every retrieval carried its source. Run 3 shows it does not hold for **derived** figures: the model can
assert computed values in prose without any compute result. Partial credit on *honest about gaps* — the
answer did disclose the refusal at the top before proceeding to publish uncited derivations anyway.

**Still unproven:** whether the nested plan panel and SOURCES rail render correctly *on the granular
surface*. The founder confirms both panels render and populate in general, but **no run-specific
observation has been captured, including on the Step 3 smoke** — the operator harness produced the run,
not a human watching the UI. **Carry the observation to the first armed run of Step 4.** Do not spend a
paid run on it alone. Both panels also still need UI and organisation work, which is its own item and not
part of any proof.

---

## 6. Known defects and where each is scheduled

| # | Defect | Scheduled |
|---|---|---|
| 1 | ~~**Compute gate is hollow**~~ — `execute_code` was not bound to *use* the retrieval | **FIXED Step 3** (`f2ac3502`). Verified firing live, 3 denials, run `5f03966b`. **But see defect 10 — the fix is bypassable** |
| 2 | ~~**`decision="LEAKED"` for the owned positive control**~~ | **FIXED Step 3** (`0beaf48d`). Now `owned_positive_control_returned_rows`; genuine leak paths still record `LEAKED`. Historical row `8a51ce24` left unmodified by decision |
| 3 | **Authority rule not enforced at composition** — it is prose in tool descriptions only; the model invented a carve-out to justify using stale wiki figures | Phase G |
| 4 | **Record-vs-wiki discrepancies never surfaced** despite the model holding both figures | Phase G |
| 5 | **Composer-integrity gate never arms** — it classifies the *question*, and the anchor is phrased as advice. It has never fired on any run | Phase G |
| 6 | **No STEER ending exists.** A turn can only answer or fail, so a model with insufficient evidence answers anyway | Phase G |
| 7 | **Dataset-grain provenance invisible to the model** — neither structured tool selects it, so a dataset citation cannot carry it | Phase F |
| 8 | **Narration bleeds into the persisted answer** (missing separator, narration text at the top of the message) | C2 surface work |
| 9 | **`execute_code` step's `input_summary`/`output_summary` are empty** — the code and stdout are auditable, but in `source_refs[].verbatim`, not where a reader looks | Low priority; record only |
| **10** | **The compute gate is bypassable — gating the tool does not gate the computation.** Refused at `execute_code`, the model performed the arithmetic in prose and published nine uncited computed percentages to the founder (run `5f03966b`, message `60c3ba85`). The figures were arithmetically correct; nothing in the system established that. **Enforcement must move to terminal validation on the published answer, not only the tool boundary** | **Phase G — scope-defining.** Supersedes the tool-only reading of defect 3 | 
| **11** | **`run_structured_query` rejects aggregate query shapes** — `"Query shape is not approved for structured dataset reads."` (run `b5cf1351`, steps 4 and 5). Because totals cannot be *retrieved*, the model must derive them by hand, which is what forces the pattern defect 10 describes. **This is the root cause; defect 10 is the symptom** | **Phase F — first unit, ahead of the connector** |

---

## 7. Decisions that changed the plan — the drift log

Recorded so that changed goalposts stay visible instead of dissolving into the record.

| Date | Change | Why |
|---|---|---|
| 2026-07-29 | Deep Mode toggle and keyword eligibility removed **before** the probe rather than later | Both could silently route around the architecture under test; one had already voided a run |
| 2026-07-30 | Canary caps corrected to 12 turns / $0.50 | Documented caps were wrong; the real ones were 6/$0.25. Later vindicated — a real run cost $0.23 |
| 2026-07-30 | Model-turn activation smoke replaced with a free deterministic compile check | The "cheap" smoke was a full two-worker delegation costing ~$0.15 per pre-flight |
| 2026-07-30 | **Anchor dataset seeded** | The test account held one row; the test question needed a 90-day trend. The bar was unreachable for reasons unrelated to the system |
| 2026-07-30 | **N=5 retired as constructed. Step 2 closed on mechanism evidence instead** | Its pass criteria bundled the mechanism question with composition quality, which Phase G is scheduled to build. As written it could not pass until G shipped, inverting the roadmap. **This changed a founder-set gate (D13) and is the most likely thing to look like drift later** |
| 2026-07-30 | **Isolation tests moved BEFORE the deletion** | Step 3 deletes the token machinery, which is the mechanism currently carrying the isolation evidence. Deleting it first would destroy the old proof and the ability to rebuild it in one move |
| 2026-08-09 | **Step 3 closed on its own scope despite discovering a composition defect mid-close** | The discovery (defect 10) is a composition failure. Step 3 was scoped as a deletion, and it delivered one. **Expanding it would repeat the N=5 mistake** — bundling mechanism scope with composition quality, which made the Step 2 gate unpassable until Phase G shipped. Recorded, scheduled, moved on. Risk accepted knowingly: Step 4 begins with a founder-visible path that can publish uncited computed figures, mitigated by every flag being dark |
| 2026-08-09 | **Phase F resequenced — structured-query aggregate shapes become its first unit**, ahead of the QuickBooks connector | Previously F was ordered connector-first. Run `5f03966b` produced live evidence that the aggregate-shape rejection is what forces in-head derivation, so the cheapest fix to the wrong-answer problem sits at the front of F, not behind a connector build |
| 2026-08-09 | **Phase G's authority enforcement moved from the tool boundary to terminal validation on the published answer** | G was written to enforce the authority rule at composition, understood as tool descriptions plus a composition check. Run `5f03966b` proved a tool-level gate is insufficient — the model simply did not use the tool. The requirement is now about the *output*, not the call |

---

## 8. Findings log

New findings go here, dated, one line each. **Do not open new amendment sections in the plan document.**

- 2026-07-30 — `platform_ai_settings.updated_at` is **not maintained on write**. Never infer flag state
  from it; read the values.
- 2026-07-30 — Railway builds only on changes under `/python-backend`; deploy confirmation is a bounded
  poll to a **10-minute** deadline, and a timeout means read the Railway deploy list before concluding
  anything.
- 2026-07-30 — The founder's knowledge base contains internally inconsistent figures ($145K MRR in client
  pages vs $45K in the financial page and the records). **Left in place deliberately** — one-writer is a
  lock; we never write the wiki. Records win by authority rule.
- 2026-07-30 — Fourth near-false-green: probe wiring passed unit tests and `compileall` while the live path
  was broken by a keyword mismatch. A signature-reachability test now exists. **Code-verified is not
  observed.**
- 2026-08-03 — Step 3 relabels future owned positive-control probe returns as
  `owned_positive_control_returned_rows`; historical run `8a51ce24-f417-4709-b060-2803a743422d` remains
  unmodified pending London's decision on whether to annotate persisted evidence or leave the correction
  in this findings log only.
- 2026-08-09 — **The numbers the compute gate refused in run `5f03966b` were correct.** Orchestrator
  verification summed `founder_dataset_rows` directly: April revenue = 41,000 (7400+9000+8400+8200+8000),
  May = 44,000, April delivery cost = 10,660, May = 12,100. All four refused constants are exact
  aggregates of retrieved rows. **The gate cannot distinguish a correct derived subtotal from a fabricated
  one, and that is defensible** — a model summing five numbers in its head is the failure mode that
  produced the wrong figure in run 2. The problem is not the refusal; it is what the model did next.
- 2026-08-09 — **A report can be accurate in every particular and still carry the wrong conclusion.** The
  Unit 5 report asserted no fact that was false. It reported the denials as a clean pass without checking
  whether the refused numbers were correct, and without reading the published answer against the authority
  rule. Both checks were cheap. **Verify the interpretation, not only the facts.**
- 2026-08-09 — Fifth near-false-green, and a new species: not a broken code path, but a **gate that fires
  correctly and is then routed around.** A green lifecycle entry proved the gate worked; the founder-visible
  answer proved it did not hold. Lifecycle evidence alone is not sufficient to grade composition.
- 2026-08-09 — **An instrument that is always green measures nothing.** Step 4's first `ask_user`
  classification derived `retrieval_attempted` from turn-level `successful_retrievals`, which is true on
  essentially every native turn because the lead retrieves before it reasons. The
  `retrieval_not_attempted_before_pause` observation could therefore almost never fire. Tightened in
  `v0.6.169` to a preference-specific signal. **When adding an observation, ask what its false value looks
  like** — if you cannot describe a realistic run that trips it, it is decoration.
- 2026-08-09 — **A model's self-assertion about its own behaviour is not evidence.** The same
  classification accepted `tool_input["retrieval_attempted"]` from the model as an alternative to observed
  retrieval. Same trust pattern as defect 10. Model-supplied fields may be *recorded* for comparison
  against observed facts; they may never *satisfy* a check.
- 2026-08-09 — **Sixth near-false-green, and a new species again: instrumentation silently dropped at the
  persistence boundary.** `record_lifecycle` (`vcso_sdk_loop.py:1641–1667`) copies only a fixed key
  allowlist. Every field added by `v0.6.168`/`v0.6.169` — `retrieval_attempted`,
  `preference_retrieval_count`, `observed_retrieval_count`, `single_question`, `question_count`,
  `model_claimed_retrieval_attempted` — is **not in that allowlist and is discarded**. Only `decision` and
  `reason_code` survived, by coincidence of already being allowlisted. Nine unit tests passed because they
  assert on the in-memory classification dict, not on what is persisted. **When adding a field to a
  diagnostic record, verify it survives the sink, not just the function that builds it.**
- 2026-08-09 — The rich `sdk_ask_user_classification` payload is written **only on the successful pause
  path** (`vcso_chat_service.py:781`). A run that reaches PAUSE and then fails persists nothing, so the
  most diagnostically valuable runs are the least observable. Write it on the failure path too.
- 2026-08-09 — **The Step 1.5 countability guard voids Step 4's own gate runs on a literal reading.** That
  guard declares a run void unless it carries `sdk_phase=04B-D`. Session-mode turns correctly record
  `sdk_phase=04B-E` (confirmed on run `e97e9339`), while still carrying `native_subagent_mode=true` and a
  non-empty `available_subagents` — which is the substance the guard actually protects. **Restate the Step 4
  gate criteria to accept `04B-E` before the gate runs, not after.** Settling pass criteria after the
  evidence exists is what made the N=5 gate unpassable.
- 2026-08-10 — **Step 4 countability restatement:** a Step 4 Phase E pause/resume gate is countable only
  when the persisted parent run carries `sdk_phase=04B-E`, `sdk_session_mode=true`,
  `native_subagent_mode=true`, non-empty `available_subagents`, a reloadable SDK session transcript, and
  the expected thread session/pending-question state for the stage under test. `sdk_phase=04B-D` is the
  native-surface Step 3 marker and is not required for Step 4 session-mode gate runs.
- 2026-08-09 — **The Guardrail 1 spike could not have caught the durable-flush refusal**, because it used
  an in-memory store where "durably flushed" has no meaning. This is precisely the gap that was recorded as
  still-open when the spike was accepted as local-only. The open item was real and it cost `$0.14` to
  close. **An adapter spiked against a fake backing store proves the protocol, never the persistence.**

---

## 9. Open items needing founder input

1. ~~**Deletion scope.**~~ **RESOLVED 2026-08-03.** Phase E's session store, thread→session pointer and
   `ask_user` code stay dormant per D10a; everything else on the list was deleted in `b216a0c4` and
   verified. `ask_user` remains at 42 references across 4 files, unchanged by the deletion.
2. **UI/organisation work on the plan panel and SOURCES rail** is a real, separate workstream, not part of
   any proof. Needs scoping and its own slot. **Still open.**
3. ~~**Persisted-evidence correction on run `8a51ce24`.**~~ **DECIDED 2026-08-09 — leave the row
   unmodified.** The correction lives in §8 and `04B-STEP-3-COMPLETION.md`, both in git. **We annotate the
   record; we never rewrite persisted evidence**, least of all for a binding lock. Standing precedent,
   inherited by Domain Agents. **Closed.**
4. ~~**Railway single-process constraint.**~~ **DECIDED 2026-08-09 — stays at replicas = 1.** Now safe to
   change; deliberately unchanged. Extra replicas add nondeterminism to single-run canary proofs for zero
   benefit while everything is dark and founder-only. Revisit at beta launch, not during the migration.
5. ~~**`MCP_TOOL_TIMEOUT` in the Railway environment.**~~ **DECIDED 2026-08-09 — remove it, early in
   Step 4** (§5.1 of the Step 4 handoff), so any effect surfaces inside that step rather than being
   conflated with a later change. Zero code references remain. Founder-console action.
6. **Versioning — DECIDED 2026-08-09 (London).** The project stays on `v0.6.x` for the **remainder of the
   SDK migration**. Next tag `v0.6.167`. **Do not propose `v0.7.0`**; the MINOR bump is reserved for
   completion of the whole migration and is the founder's call alone.

---

## 10. Standing rules that have cost cycles when broken

- **Observe, don't infer.** Pair every claim to a row, a log line, or a file. Four near-false-greens in
  this migration were caught only by live observation.
- **Stop on the first failure**, surface it with evidence, do not retry blind.
- **If an instruction asks you to verify something the specified path cannot prove, stop and say so** —
  do not find a way to make the check pass. This has caught two bad instructions already.
- **Arm founder-only, on explicit go, never in anticipation. Re-darken immediately and read every flag
  back off** — even when a run fails, and before writing the report.
- **Cache-busted deployed-head confirmation before every canary.**
- **Version tags always move forward.** PATCH per logical unit; MINOR and MAJOR are the founder's call.
  **Commit each unit as you finish it** — uncommitted work does not survive a session boundary.
- **Locks, binding:** founder isolation; one writer (feed the OS Engine, never write the wiki); cited
  provenance; cost-tier routing at the capability grain with no founder-facing model selector; the
  context-selection IP; curated transparency; bounded, non-recursive, depth-capped workers.
- **Landmines, updated after Step 3:** `TURN_REGISTRY` is **gone**, so the single-process constraint no
  longer has a code cause — Railway replicas = 1 is now a configuration choice, safe to change, and
  deliberately unchanged. `MCP_TOOL_TIMEOUT`'s cause is likewise **gone**; remove it from the Railway
  environment when convenient. **Still binding:** never re-add the per-agent `timeout` config key (the
  deployed CLI rejects it and it broke delegation outright); `max_rounds` and SDK `maxTurns` are different
  concepts and must never be re-collapsed; the bundled Claude Code CLI is pinned to `2.1.209 (Claude Code)`
  and native activation **fails closed** on mismatch, including when the version reads `unavailable`.
- **Do not edit the harness-root `ROADMAP.md`** — that is the separately founder-gated Phase G cutover.
- **Grade composition on the published answer, not on lifecycle events.** A gate can fire correctly and
  still be routed around. This cost a wrong close-out call in Step 3 and was caught only by reading the
  founder-visible message.

- 2026-08-03 - Step 3 Unit 3 removed the retired external worker MCP transport, vcso_planner, token/worker-hop probes, handler-backed compile surface, and out-of-band completion bridge from the backend code/tests. The native granular path remains via Task + in-process architectos registry tools; no production flags were armed during this deletion unit.
- 2026-08-03 - Step 3 Unit 4 pins native activation to bundled Claude Code CLI `2.1.209 (Claude Code)`. The guard is checked by the compile preflight and fails closed only when native model-driven activation is attempted; dark/standard SDK traffic is unaffected.
- 2026-08-09 - Deploy of `421560d1` was reported as a head mismatch during Unit 4 and was propagation timing, not a fault. Railway shows the deploy succeeded; health now returns `421560d1`. Third occurrence. A head mismatch immediately after a push is not evidence of a broken deploy; read the Railway deploy list before concluding anything.
- 2026-08-09 - Compute-gate binding inspects material numeric constants >= 1000 only (`_material_numeric_tokens`, `vcso_sdk_loop.py:803`). Typed figures below that threshold are unchecked. Deliberate - small integers are usually legitimate literals - but it is a real coverage limit.
- 2026-08-09 - The CLI pin treats `unavailable` as a mismatch and fails closed. If the container's subprocess call to the bundled CLI fails for an environmental reason, native activation blocks. Check `sdk_runtime_pin_status()` before diagnosing any confusing native failure.
- 2026-08-09 - Step 4 Guardrail 1 spike was local, not a deployed-backend run: direct SDK `0.2.118` plus bundled Claude Code CLI `2.1.209`, ephemeral config dir, and an in-memory session store. It proves the pinned CLI accepts `resume=` and `fork_session=true`; it does **not** prove `SupabaseVcsoSessionStore` through the real RPC path or behavior inside the Railway container. That composition remains open for the Step 4 pause/reload/resume gate.
- 2026-08-09 - Step 4 `v0.6.170` Unit 1 fixes the pause observability fault found by the first armed run. Lifecycle persistence now carries the bounded ask_user classification fields (`retrieval_attempted`, preference-specific counts, model-claim comparison, single-question check, and sanitized retrieval tool names/tool-use ids), and failed pause attempts preserve `sdk_ask_user_classification` on the final run metadata.
- 2026-08-09 - Step 4 `v0.6.170` Unit 2 applies the durable-flush fix using the narrowest public SDK primitive available. The pinned SDK exposes `session_store_flush` (`batched`/`eager`) but no public force-flush method at the defer boundary, so only `enable_ask_user_pause` turns compile with `session_store_flush="eager"`; non-pause native turns remain `batched`.
- 2026-08-10 - Step 4 real-store spike proved the durable-flush failure is not a flush-mode race. Local SDK runs against `SupabaseVcsoSessionStore` and the real Supabase RPCs attempted appends for production-shaped `deep_mode=false` pause turns, but the live `vcso_sdk_session_append` RPC rejected them with `SDK session turn ownership or Deep Mode check failed`, so fresh load returned zero rows. The same spike with legacy `deep_mode=true` fixtures persisted deferred turns under both `eager` and `batched`, and a completed -> resume -> fork run loaded the sentinel successfully. The remaining fix is the RPC predicate, not another arm.
- 2026-08-10 - Step 4 `v0.6.171` prepared and applied the RPC fix after explicit approval: `docs/migrations/20260810_phase_e_sdk_session_append_native_turns.sql` keeps the service-role RPC and founder/thread/message ownership checks, but removes the deleted Deep Mode predicate from append authorization. Live `pg_get_functiondef` readback confirmed `m.deep_mode is true` and `SDK session turn ownership or Deep Mode check failed` are gone. Post-apply local real-store production-shaped spike (`deep_mode=false`, `session_store_flush=eager`) deferred `mcp__architectos__ask_user`, returned `confirmed_persisted=true`, and fresh-loaded 14 entries for session `13164f6e-c2ff-425d-af55-4fd02a7244cb`. Flags remained fully dark after the spike.
- 2026-08-10 - Step 4 pause gate canary 1 is countable after the verifier project-key fix. Run `0b499237-2e66-4fd9-8f41-82c286a61293`, thread `e9644426-965d-4a1a-ae73-a4d82d5cf9d3`, message `b34aef07-b239-40d7-a981-4e640627420e`, SDK session `bb618668-4a27-4555-beb5-a49e089e93a6`, and tool use `toolu_016oEQzCoQRPBTJxwUJqfpp1`. The endpoint emitted `ask_user` then `done_waiting`, the parent run remains `running`, the thread is `waiting_for_user`, pending tool/question/run pointers match, the private SDK transcript has 54 rows, and the corrected `verify_phase_e_canary.py --stage pause` passes all checks.
- 2026-08-10 - Pause canary 1 classification persisted with bounded support: `reason_code=founder_priority`, `question_count=1`, `single_question=true`, `preference_retrieval_attempted=true`, `preference_retrieval_count=8`, `observed_retrieval_count=11`, and `model_claimed_retrieval_attempted=true`. Preference-specific retrievals included `wiki_list`, three `wiki_search`, and four `wiki_get_page` calls with tool-use ids preserved. Cost rows for the canary window: 15 `ai_usage_log` rows, `cost_usd=0.15175645000000001`.
- 2026-08-10 - Pause canary 1 UI observation: after a reload, the browser selected the API-created waiting thread and rendered the founder question in the composer placeholder with Send disabled until an answer is typed. The right SOURCES rail rendered, but it still showed placeholder copy ("Sources populate here...") rather than populated source cards. No nested plan panel was visible in the captured viewport despite `todos_updated` SSE events; record this as UI carryover input, not as a backend pause failure.

---

## Step 3 Unit 5 deletion smoke report - 2026-08-09

Version checkpoint: `v0.6.166`, local commit `a865b7d3` before the live smoke.

Pre-arm proof:

- Zero-canary reload proof passed 3/3 via `python-backend/scripts/verify_phase_e_reload.py --user-id cd490873-99aa-4533-9240-f0aa04deb54f`.
  Proof threads: `26ed90ce-ece4-4d60-ac6c-c25450a2ff62`, `a90718f0-33b6-42ce-bc9a-2a0bb3600db4`, `99bffc47-f86b-4a9d-8730-e3b48b3da328`.
- Compile preflight check `J_claude_code_cli_version_pinned` passed. Observed bundled CLI: `2.1.209 (Claude Code)`. Overall activation verdict was false only because the flag was dark before arming (`A_loop_enabled_for_founder`, `B_non_anchor_requires_exact_native_agents`, and `C_stream_capture_enabled` were false).
- Cache-busted health confirmed deployed backend SHA `421560d1ba07083fed96f57bb7e8be888fbe3764`.
- Pre-arm flag readback was fully dark: `is_enabled=false`, `test_user_ids=[]`, `diagnostic_user_ids=[]`, `native_model_driven_enabled=false`, `diagnostic_sdk_stream_capture_enabled=false`, probe flags false/empty, caps 12 turns / $0.50.

Live run:

- Explicit arming authorization received in-thread from London: "Please proceed".
- Armed plain only with `python-backend/scripts/arm_native_capture_canary.py arm --founder-id cd490873-99aa-4533-9240-f0aa04deb54f --expected-sha 421560d1ba07083fed96f57bb7e8be888fbe3764 --confirm ARM-ONE-CAPTURE-CANARY`. No probe flags were passed.
- Submitted one pinned-anchor turn with `python-backend/scripts/submit_vcso_canary_turn.py --prompt-mode anchor`.
- Parent run id: `5f03966b-25ee-4ad5-9804-da7604b849c0`.
- Thread id: `9f4eaad6-acad-4628-97a7-b06445ae74a3`.
- User message id: `e403917c-366e-4fc4-a7bc-c9da017ac53a`.
- Assistant message id: `60c3ba85-7482-41da-9480-6de7eae50d14`.
- SSE result: `done_received=true`; answer bytes `5907`; answer tokens `4693`; wall clock `126.116` seconds.
- Parent run row status: `completed`; `error_message=null`; started `2026-08-09T19:18:19.764912+00:00`; completed `2026-08-09T19:20:14.38362+00:00`.
- Native activation recorded `runtime_manifest`: `{"event":"runtime_manifest","decision":"native_granular","sequence":1,"reason_code":"none"}`.
- SDK versions on persisted result: Claude Code CLI `2.1.209 (Claude Code)`, CLI source `bundled`, Claude Agent SDK `0.2.118`.
- Child runs persisted:
  - `b5cf1351-eace-4cfb-b30f-a733c2c5cd4a`, `structured_data_agent`, `status=completed`, `partial=true`, 5 persisted steps, summary: "Structured data worker completed partially with 25 cited source reference(s); one or more optional tool calls failed safely. PARTIAL_RESULT: true".
  - `c62e03c5-8239-4650-a093-4d15d9e7580f`, `per_user_wiki`, `status=completed`, `partial=false`, 6 persisted steps, summary: "Strategic context worker completed 6 granular tool call(s) with 22 cited source reference(s)."
- Parent trace persisted 15 steps. Parent step titles: Intent and depth read; Sources selected; Context prepared; Structured data worker; List Founder Datasets; Strategic context worker; Get Dataset Periods; Get Dataset Periods; Wiki Search; Wiki Search; Wiki Search; Wiki Get Page; Wiki Get Page; Wiki Get Page; Answer prepared.
- Overall persisted `source_count=49`.

Compute-gate acceptance evidence:

- Lifecycle event count: 42 against the 60-event cap. No truncation observed; `runtime_manifest` remains the first lifecycle event and the last lifecycle event is `{"count":3,"event":"stream_keepalive","stage":"total"}`.
- The live path evaluated and denied `execute_code` three times. Quoted lifecycle entries:
  - `{"event":"compute_gate","decision":"deny","sequence":35,"tool_name":"mcp__architectos__execute_code","reason_code":"execute_code includes material numeric constants not present in this turn's cited retrieval output (10660, 12100, 12683, 41000, 44000). Re-read or paste the cited retrieved values, then compute only f","tool_use_id":"toolu_01D46Kg3n4UhduTzJLJMv1Qg"}`
  - `{"event":"compute_gate","decision":"deny","sequence":37,"tool_name":"mcp__architectos__execute_code","reason_code":"execute_code includes material numeric constants not present in this turn's cited retrieval output (41000, 44000). Re-read or paste the cited retrieved values, then compute only from them.","tool_use_id":"toolu_01EMhkWHXkUmHFWhuVDBNHjY"}`
  - `{"event":"compute_gate","decision":"deny","sequence":39,"tool_name":"mcp__architectos__execute_code","reason_code":"execute_code includes material numeric constants not present in this turn's cited retrieval output (41000, 44000). Re-read or paste the cited retrieved values, then compute only from them.","tool_use_id":"toolu_01MH6sri4kALvMmBtFFX9pGN"}`

Answer behavior:

- The answer did not fail outright. It disclosed the refusal and continued from cited figures. Opening persisted text: "The compute worker is rejecting constants that were in fact returned by the structured data agent this turn. I'll disclose that limitation and work strictly from the cited figures the workers returned - stating the math explicitly in my answer without an uncited derivation."
- This is recorded as Phase F/G composition input, not a Unit 5 regression.

Spend:

- `ai_usage_log` rows for the thread: 14.
- Recorded cost with non-null `cost_usd`: `$0.22334094999999998`, from the main `vcso_sdk_loop` row only (`input_tokens=71287`, `output_tokens=4693`, model `claude-sonnet-4-6`).
- Subagent and utility rows persisted token counts but no `cost_usd`; therefore the non-null cost total is not the whole-query cost if those rows are priced elsewhere.

Post-run flag readback:

- Disarmed immediately with `python-backend/scripts/arm_native_capture_canary.py disarm --confirm RE-DARKEN-04B`, then ran `read`.
- Final readback: `is_enabled=false`, `test_user_ids=[]`, `diagnostic_user_ids=[]`, `native_model_driven_enabled=false`, `diagnostic_sdk_stream_capture_enabled=false`, `diagnostic_single_worker_enabled=false`, `diagnostic_fault_injection_enabled=false`, `diagnostic_stream_disconnect_enabled=false`, `diagnostic_stream_drop_done_enabled=false`, `diagnostic_granular_cross_worker_probe_enabled=false`, `diagnostic_founder_isolation_probe_enabled=false`, diagnostic dataset ids empty, `max_turns=12`, `max_budget_usd=0.5`.

Not done:

- I did not pass any probe flags or re-run isolation/cross-worker probes.
- I did not loosen the compute gate, build a STEER ending, change answer composition, raise caps, change Railway replica configuration, or remove `MCP_TOOL_TIMEOUT`.
- I did not obtain a separate human UI render observation for this run. The operator harness produced a named run and persisted trace evidence, but it is not itself a London visual confirmation of the nested plan panel and SOURCES rail.
