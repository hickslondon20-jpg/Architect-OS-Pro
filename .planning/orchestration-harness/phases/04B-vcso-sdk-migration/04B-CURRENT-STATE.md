# 04B — Current State

**Last updated:** 2026-07-30 · **This is the single entry point.** A new orchestration agent reads this
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

**Roadmap Step 2 is closed.** The engine works: the lead delegates on its own, refuses to cheat, and the
safety boundaries hold under observed test. **The answers are not yet right** — the system fetches correct
data and then composes using stale or mistyped figures. Engine proven, judgment not.

---

## 3. Status by roadmap step

| Step | What it is | Status |
|---|---|---|
| 1 | Author the in-process worker surface | **Done** |
| 1.5 | Remove the Deep Mode and keyword-eligibility tripwires | **Done** |
| **2** | **Prove the lead delegates reliably; two mandatory isolation tests** | **CLOSED on mechanism evidence.** See §4 and §5 |
| **3** | **Compute-data binding fix, `LEAKED` relabel, delete the old plumbing, pin the CLI version** | **NEXT.** Founder-approved to proceed (§9) |
| 4 | Phase E — `ask_user` and sessions on the single path | Not started |
| 5 | Phase F — QuickBooks connector, real financial series, freshness/authority inside the retrieval tools | Not started. **This fixes more of the wrong-answer problem than any reasoning change** |
| 6 | Phase G — reflect-and-steer, authority enforced at composition, varied-question rubric, then cutover | Not started |

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

**Two rubric lines were downgraded, not upgraded, in the Step 2 close-out:** *composes founder-grade cited
judgment* and *honest about gaps* both moved from proven to failing. That is the correct and honest state
to enter Phases F and G with.

**Also unproven:** whether the nested plan panel and SOURCES rail render correctly *on the granular
surface*. The founder confirms both panels do render and populate in general, but no run-specific
observation was captured, and **both panels still need UI and organisation work regardless.** Schedule the
observation into Step 3's smoke; treat the UI work as its own item, not as part of this proof.

---

## 6. Known defects and where each is scheduled

| # | Defect | Scheduled |
|---|---|---|
| 1 | **Compute gate is hollow** — `execute_code` requires a prior retrieval but is not bound to *use* it, so the sandbox can compute on model-typed numbers | **Step 3** |
| 2 | **`decision="LEAKED"` recorded for the owned positive control** — false-positive language in the permanent evidence for a binding lock | **Step 3** |
| 3 | **Authority rule not enforced at composition** — it is prose in tool descriptions only; the model invented a carve-out to justify using stale wiki figures | Phase G |
| 4 | **Record-vs-wiki discrepancies never surfaced** despite the model holding both figures | Phase G |
| 5 | **Composer-integrity gate never arms** — it classifies the *question*, and the anchor is phrased as advice. It has never fired on any run | Phase G |
| 6 | **No STEER ending exists.** A turn can only answer or fail, so a model with insufficient evidence answers anyway | Phase G |
| 7 | **Dataset-grain provenance invisible to the model** — neither structured tool selects it, so a dataset citation cannot carry it | Phase F |
| 8 | **Narration bleeds into the persisted answer** (missing separator, narration text at the top of the message) | C2 surface work |
| 9 | **`execute_code` step's `input_summary`/`output_summary` are empty** — the code and stdout are auditable, but in `source_refs[].verbatim`, not where a reader looks | Low priority; record only |

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

---

## 9. Open items needing founder input

1. **Deletion scope — one item to confirm.** Deletion of Path A, the external worker transport,
   `TURN_REGISTRY` and the token machinery, the `MCP_TOOL_TIMEOUT` dependency, the single-process
   constraint, the out-of-band completion bridge, `vcso_planner`, and the old token-based cross-worker
   probe is **approved**. The founder noted one item should stay that a pivot changed. **Reading it as:
   Phase E's landed session store, thread→session pointer and `ask_user` code stay in place and dormant
   per D10a — present and unreachable, not deleted.** Confirm before Step 3 executes.
2. **UI/organisation work on the plan panel and SOURCES rail** is a real, separate workstream, not part of
   any proof. Needs scoping and its own slot.

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
- **Landmines:** keep `MCP_TOOL_TIMEOUT=240000` until Step 3 removes its cause; single process only while
  `TURN_REGISTRY` exists (Railway replicas = 1, held by configuration not code); never re-add the
  per-agent `timeout` config key; `max_rounds` and SDK `maxTurns` are different concepts and must never be
  re-collapsed.
- **Do not edit the harness-root `ROADMAP.md`** — that is the separately founder-gated Phase G cutover.
