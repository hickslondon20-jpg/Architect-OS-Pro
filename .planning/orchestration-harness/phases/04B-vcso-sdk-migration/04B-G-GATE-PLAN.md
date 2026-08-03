# 04B — G-Gate Plan: Generalization Proof (front half of Phase G)

> **Self-contained execution artifact.** An execution agent should be able to run this without the
> orchestration conversation. Read `04B-VISION-AND-INTENT.md` (grade against §4), `CONTEXT.md`,
> `ROADMAP.md` (Phase G block + Process Rule 10), and `04B-EFG-ORCHESTRATION-HANDOFF.md` first.
> This is the **front half of Phase G** — the generalization proof. It feeds, and runs ahead of, the
> cut-over content in `04B-G-PLAN.md`. **Nothing widens past the dark founder canary until this gate clears.**

**Status (updated 2026-07-23):** PAUSED and re-sequenced after two A1 pressure-test runs — see
`04B-G-GATE-FINDINGS.md`. New order is **E → F → G-gate** (this gate is held until Phase F builds the
financial series its sandbox tests need). Three changes carry into this gate when it resumes post-F:
(1) **A1 becomes a real numeric test** (F supplies the series), not just shape+honesty; (2) the
under-delegation finding is addressed **native-reasoning-first** — tune the lead prompt / delegation
contracts / tool descriptions, **no hard router**; (3) a **composer-integrity guardrail** (no asserting
computed figures without a compute-worker result + citation) is a prerequisite. Question set A1–A5 + the
rubric below remain locked. Flags dark, allowlists empty.

---

## 1. Why this gate exists (the one open rubric line)
D2 proved model-driven delegation is *reliable* — but only on **one pinned anchor shape**
(structured → wiki → sandbox) plus a **simple-direct control**. Vision rubric #8 —
*"generalizes across the founder's real question space"* — is the single line still **○ OPEN**. The
proof this gate produces: **does the lead delegate *appropriately* across genuinely different strategic
question shapes**, not just replay the anchor. This is the gate before ANY wider founder exposure.

The thesis to re-validate at breadth (from VISION §3): the tools are the routes; there is no classifier;
the intelligence is the model reasoning about *which specialist, when*. Appropriate variation across
shapes — including **correctly choosing to delegate less** — is the proof only genuine reasoning passes.

## 2. Current state (verified 2026-07-23)
- **Flags dark.** `vcso_sdk_loop` `is_enabled=false`, `test_user_ids=[]`, `native_model_driven_enabled=false`;
  `vcso_planner` `is_enabled=false`, `test_user_ids=[]`. Both allowlists empty.
- **Deployed head green.** `/api/health` → `ok=true`, SHA `feb3fe04`. **Execution agent must confirm
  deployed head == the intended D2 SHA (`v0.6.114` lineage) + `/api/health ok=true` before every canary**
  (a stale deploy once cost a full run).
- **D2 done** on M1–M5 (`v0.6.114`), operational, every claim observation-backed. **Path A retained dark
  as fallback — DO NOT prune.**
- Founder canary identity: `hicks.london25@gmail.com` / user `cd490873-99aa-4533-9240-f0aa04deb54f`.

## 3. The locked question set (grounded in the seeded founder — agency "AMMG_TEST", user `cd490873`)
Each question names its archetype, the **expected-acceptable delegation** (defined up front, per the
appropriateness method), and the grounding facts a sound answer should surface. **The expected
delegation is the hypothesis under test, not a script fed to the model** — the lead must *reason* to it.

| # | Archetype | Question | Expected-acceptable delegation | Grounding facts |
|---|---|---|---|---|
| **A1** | structured + sandbox | "If my top 2 clients churned this year, what would it do to my margin and runway?" | decompose → `structured_data_agent` (concentration + margin/runway) → `sandbox_execution_agent` **depends on** structured → cited compose. 2–3 children. | top-5 = 55% of MRR, 14 clients, avg client $3,800/mo, MRR $30.6k; margin 18%, cash $700k, runway 2.44 mo |
| **A2** | structured-only | "Break down my revenue mix — recurring vs. project, and my top-5 client concentration." | **one** `structured_data_agent`; **no** sandbox, **no** wiki; cited compose. | 68% recurring, MRR $30.6k, project $14.4k/mo, top-5 55% / top-10 78% / top-20 92%, concentration "moderate" |
| **A3** | wiki-only | "Remind me what the diagnostics flagged as my single biggest growth constraint, and why." | **one** wiki/retrieval worker (Growth Constraints page); **no** structured/sandbox; cited to compiled wiki. | binding constraint `gm_cap_1.1`, leverage 0.65; GM 35% "Scaling with Friction" |
| **A4** | simple-direct (control) | "What's the difference between AGI and gross revenue?" | Lead answers **directly**, zero children, minimal spend. | definitional; no founder data needed |
| **A5** | reflect-and-steer | "Should I raise my prices?" | Lead **clarifies/scopes** (goal? margin vs. capacity vs. positioning?) or does a light scoped pull + steer — **not** a full 3-worker chain. | genuinely ambiguous; tests restraint + partner behavior |

**Two caveats locked in (do not false-green past them):**
- **A1's sandbox is a working smoke.** The founder P&L dataset has **one** row today (`pnl_monthly`,
  June 2026) — no series. Real concentration/margin *compute* is **Phase F**. A1 scores the **delegation
  shape** (structured → sandbox with the dependency held), **not** numeric depth. Do not claim "real
  financial compute proven" from A1.
- **A2–A5 require the app-gated effort-scaling to be relaxed** so the *model* chooses breadth (today
  restraint is system-enforced — the M3 finding: "app-gated, so system-level not model-level restraint").
  **That relaxation is itself the thing under test.** See §5 for the mechanism + the verify-first flag.

## 4. Appropriateness rubric (score every run)
Each run scored **✓ / ◐ / ✗** on four dimensions + an overall verdict. Capture the score against the
`agent_delegation_runs` / `agent_delegation_steps` rows for that run (observe, don't infer).

1. **Right worker set** — brought exactly the workers the shape needs, no more, no fewer.
2. **No over/under-decomposition** — didn't inflate a simple ask (A2/A4) or starve a complex one (A1).
3. **Correct dependencies** — where order matters (A1: sandbox waits for structured), it held every time.
4. **Sound cited answer** — real sourced findings, honest about gaps (rubric #5), no invented data.

A run **passes** only on ✓ (or a defensible ◐ London signs off) across all four. A wrong worker set or an
over/under-decomposition is a **✗ for the run** even if the prose answer reads well.

## 5. Mechanism — relaxing effort-scaling (verify-first)
**Do not assume the config seam.** The M3 finding established effort-scaling is app-gated; the exact key
that flips it from system-enforced to model-chosen must be **verified in code before arming** — candidates
to check: `vcso_sdk_loop.settings` in `platform_ai_settings`, and the effort-scaling / delegation-contract
logic in `vcso_sdk_config.py` / `vcso_sdk_loop.py`. Confirm by reading the live path, not by inference
(this migration shipped three false greens caught only by live observation — one was a mocked path hiding
the real behavior). Set the relaxation **dark, per run/session**, and **re-darken after**. Record exactly
which flag/value was set in the run log so the scored result is attributable to a known configuration.

To arm a canary run: `vcso_sdk_loop.is_enabled=true`, `test_user_ids=['cd490873-99aa-4533-9240-f0aa04deb54f']`,
`native_model_driven_enabled=true`, effort-scaling relaxed per above — **on London's explicit go, not in
anticipation.** Read back both flags **off** after each run/session.

## 6. Reliability bar — breadth-first, then depth (London's ruling; Process Rule 10)
Rule 10: a single live run is **"proven once," not closed**; exit on **N consecutive passes**, not one green.

1. **Breadth pass (round 1):** run **one clean pass on each of A1–A5** to expose any mis-delegation fast.
   A1 and A4 re-confirm known shapes; A2, A3, A5 are the genuinely unproven ones.
2. **Depth pass (round 2):** on any archetype that **passes-but-looks-fragile** or **fails**, run
   **N-consecutive (3–5) clean passes** to close it (or surface a real delegation-logic defect to fix
   before re-running). Archetypes that pass cleanly and unambiguously in round 1 do **not** need the full
   depth run — that's the point of breadth-first.
3. **Gate exit:** all five archetypes at a passing verdict, with the previously-open shapes (A2/A3/A5) each
   held to the N-consecutive bar. Every pass observation-backed against the delegation rows.

If breadth surfaces a mis-delegation, **that is the valuable result** — it's a delegation-logic finding
far cheaper to fix now than after E or F build on top. Surface it to London; do not paper over it.

## 7. Non-negotiables to preserve (do not relearn live)
- **Observe, don't infer.** Code-verified ≠ observed. Prefer injection-to-observe and zero-canary
  (reload persisted data) verification where possible. Pair every claim to a DB/trace row.
- **Confirm deployed head == intended SHA + `/api/health ok=true` before every canary.**
- **Dark-canary hygiene:** arm founder-only on London's go; re-darken immediately after; read back off.
- **Preserve every lock:** founder isolation; one-writer (feed OS Engine, never write the wiki); bounded
  non-recursive workers; Claude-lock (Sonnet compose / Haiku workers via MA-06 tier map); **no
  founder-facing model selector**; tier authority at capability grain; curated transparency (no raw
  payloads / no raw CoT).
- **INFRA LANDMINES:** never remove `MCP_TOOL_TIMEOUT=240000` (Railway env var only; the ~113s sandbox
  worker times out at the ~60s CLI default without it). Do **not** re-add the per-agent `timeout` config
  key (rejected by the deployed CLI, broke delegation). **Single-process only** — no `WEB_CONCURRENCY` /
  `--workers` (`TURN_REGISTRY` is process-global).
- **Version-tags always forward** — even a failed/retry commit increments.
- **Do not** flip flag defaults, prune Path A, or widen past the dark founder canary before this gate clears.

## 8. Acceptance criteria (gate exit)
1. A1–A5 each at a passing appropriateness verdict; A2/A3/A5 held to the N-consecutive depth bar.
2. Every pass observation-backed against `agent_delegation_runs` / `_steps`; scores recorded per run with
   the exact armed configuration (incl. the effort-scaling value).
3. Delegation-order **variation** re-observed where the shape allows it (the anti-router evidence),
   dependencies held where they matter.
4. Rubric #8 moved ✓; VISION §4 re-graded — no other rubric line regressed (esp. #5 honest-about-gaps,
   #7 safe/bounded). Any slipped line surfaced as a flag, not banked.
5. Flags re-darkened, both read back off; Path A intact. `04B-G-GATE-COMPLETION.md` written with the
   per-run evidence table. STOP-and-review with London before anything widens.

## 9. Out of scope (explicit)
- **Real sandbox financial compute** (needs the financial series) → **Phase F**.
- **Sessions / Deep Mode reconciliation** → **Phase E**.
- **Cut-over** — retiring the hand-rolled loop, parallel-run parity, threading 04B into the harness-root
  `ROADMAP.md` → back half of Phase G (`04B-G-PLAN.md`), **separately founder-gated**. Do **not** edit the
  harness-root `ROADMAP.md` in this gate.
- Widening the canary beyond the single founder user; flipping any flag default.

---

## 10. Execution-agent kickoff (paste-ready)
> You are the **execution agent** for the 04B G-Gate (generalization proof). Work live on the deployed
> stack; the orchestration agent has scoped this — you build/observe/commit. **All work dark, on London's
> explicit go per canary, re-darkened after.**
>
> 1. **Confirm state:** read `platform_ai_settings` for `vcso_sdk_loop` + `vcso_planner` (expect both
>    dark, allowlists empty). Confirm `/api/health ok=true` and deployed head == the intended D2 SHA
>    (`v0.6.114` lineage) — do not proceed on a stale deploy.
> 2. **Verify the effort-scaling seam in code** (§5) before arming — read the live `vcso_sdk_config.py` /
>    `vcso_sdk_loop.py` path; do not infer the key. Report back the exact flag/value you will set.
> 3. **Round 1 (breadth):** arm founder-only (§5), run **A1–A5 once each** (locked set, §3). Score each
>    on the §4 rubric, paired to the `agent_delegation_runs`/`_steps` rows. Re-darken; read back off.
> 4. **Round 2 (depth):** for any archetype that failed or passed-but-fragile, run **3–5 consecutive**
>    clean passes (§6). A clean unambiguous round-1 pass needs no depth run.
> 5. **On any mis-delegation:** stop, capture the evidence, surface to London — it's a delegation-logic
>    finding, not something to paper over.
> 6. **Preserve every lock + landmine in §7.** Version-tags forward. Commit after each logical unit with a
>    `vX.Y.Z` PATCH-bumped message (do not bump MINOR/MAJOR without London).
> 7. **Close:** write `04B-G-GATE-COMPLETION.md` (per-run evidence table + rubric scores + re-graded
>    VISION §4). Flags dark, both read back off, Path A intact. STOP-and-review with London.
