# 04B — Composer Output-Integrity Gate (standalone hardening, lands before Phase E)

> **Self-contained execution artifact.** Read `04B-VISION-AND-INTENT.md` (grade against §4, esp. #4 cited
> judgment + #5 honest-about-gaps), `04B-G-GATE-FINDINGS.md` (the two A1 runs that surfaced this), and
> `CONTEXT.md` first. **This is a live-path honesty defect, not a dark-only one** — it lands now, ahead of
> Phase E, then sequencing resumes **E → F → G-gate**.

**Status:** Scoped by London 2026-07-23. Ready for an execution agent, dark work, on London's go.

## 1. Why (the defect, observation-backed)
Across both A1 pressure-test runs the Sonnet composer **asserted computed quantitative results it derived
itself** — scenario margins, runway projections — with no successful compute worker behind them, drawn
from stale wiki figures (`04B-G-GATE-FINDINGS.md` §2). The v0.6.116 fix hardened worker-result
*propagation* (degraded ≠ success) but **not** the composer's willingness to freelance the math. For a
CFO/CSO thought partner, asserting unsound numbers is a ship-blocker on rubric #4 (sound cited answer) and
#5 (honest about gaps).

**It is a shared/live risk, not dark-only:**
- `vcso_chat_service.py:111` — `VCSO_TOOL_LOOP_SYSTEM_PROMPT` is the **common** system prompt for both
  Path A and the SDK path. Its existing line *"Ground claims… If evidence is missing, say so"* is **soft
  guidance, not an enforced gate** — the composer ignored it.
- `vcso_sdk_loop.py:1867` — a failed Path A (app-owned) delegation **fails open to the standard SDK path**
  (`native_mode = False`), where the composer can freelance from whatever it holds. So the defect reaches
  the live Path-A experience, not just the dark model-driven canary.

## 2. What (the fix — an output-integrity GATE, not prompt tuning alone)
London's four requirements:
1. **No asserted quantitative result without a successful compute result and citation.**
2. **A degraded/missing compute result yields an explicit "cannot compute from current data" answer.**
3. **No composer-authored substitute arithmetic.**
4. **Capability selection stays native-reasoning-first — this guard governs *answer integrity, not
   routing*.** It never forces a worker or alters delegation; it only governs what the composed answer may
   assert.

**Scope of "quantitative result" (draw the line precisely):** the gate targets **derived/computed** claims
— scenario math, projections, ratios, aggregations *not present verbatim in a cited source*. It does **not**
block **direct cited retrievals** of stored figures (e.g. "your revenue is $480k [economic_foundation]") —
those remain fine and encouraged. The failure mode is *deriving* new numbers without a compute worker, not
*quoting* sourced ones.

## 3. Where (the seam)
- **Enforcement point:** the compose/emission seam in `vcso_sdk_loop.py` where `answer_text` is assembled
  (~L2298, `answer_text = "".join(answer_parts).strip()`, before the terminal emit at ~L2312). **Both**
  Path A (compose-only from injected findings, ~L2036/L2515) and model-driven (composes from lead-held
  findings) converge here — a single gate at this seam covers both, which is the point. Verify this is the
  common emission path before building; if Path A emits elsewhere, gate both.
- **Signal it reads:** the turn's collected worker findings + their status — specifically whether a
  **`sandbox_execution_agent` (compute) worker completed with a successful, non-degraded result** (the
  v0.6.116 degraded-detection already distinguishes `could_not_compute` / `needs_review=true`). Reuse that
  classification; do not reinvent it.
- **Shared prompt (`vcso_chat_service.py:111`):** tighten the wording to match the gate (state plainly that
  computed figures require a compute-worker result, and to answer "cannot compute from current data"
  otherwise) — but the **prompt is the ask; the gate is the enforcement.** Do not rely on the prompt alone.

## 4. Behaviour (make the gate deterministic and legible)
- **No successful compute finding in the turn → the answer may not present derived quantitative
  conclusions.** If the composed answer contains them, the gate replaces that content with the explicit
  **"cannot compute from current data"** statement (name what's missing — e.g. "no client-level series on
  record"), preserving any legitimately cited retrievals and the qualitative guidance.
- **Successful compute finding present → derived figures must cite it.** Uncited derived figures are a gate
  violation (rewrite or attribute).
- **Never move money / never fabricate** — consistent with the standing locks and rubric #5.
- **Curated transparency:** the "cannot compute" answer is founder-facing and plain; no raw payloads, no
  raw CoT, no exposure of the gate's internals.

**Detector granularity (execution agent's design call — recommendation):** start **strict-but-simple** —
gate on the deterministic signal already available (successful compute finding: yes/no) rather than a
fragile NLP parse of the prose. That exactly covers the observed failure (no compute finding → no derived
numbers) with no false-positives on cited retrievals. A finer prose-level detector can follow if needed;
do not over-build first.

## 5. Verify (observe, don't infer — this migration shipped three false greens)
- **Reproduce the defect first**, then prove the fix against the same shape: re-run the A1 shape (or a
  faithful harness of it) and confirm the composer now returns "cannot compute from current data" instead
  of fabricated margins/runway. Injection-to-observe over inference.
- **Both paths:** prove the gate on the **model-driven** path *and* on **Path A** (including the
  fail-open-from-Path-A case at `vcso_sdk_loop.py:1867`).
- **No regression on the honest case:** a question answerable from a cited retrieval (no computation) still
  answers normally — the gate must not block cited stored figures or qualitative advice.
- **Reliability = N consecutive** (Process Rule 10), not one green run. Pair every claim to a DB/trace row.
- Unit + integration coverage for: no-compute→refuse, compute-present→cite, cited-retrieval→pass,
  degraded-compute→refuse.

## 6. Acceptance criteria
1. Gate live at the compose seam, governing **both** Path A and model-driven emission.
2. Observed: the A1 shape now yields "cannot compute from current data," **no** composer substitute
   arithmetic — reproduced-then-fixed, held to N-consecutive.
3. Honest case unregressed (cited retrievals + qualitative answers pass untouched).
4. Shared prompt (`vcso_chat_service.py:111`) tightened to match; enforcement is the gate, not the prompt.
5. Capability selection **unchanged** (native-reasoning-first intact; the gate touches no routing).
6. Tests green (unit + integration for the four cases above); `compileall` clean; flags remain **dark**,
   allowlists empty, read back off. Path A intact.
7. `04B-COMPOSER-INTEGRITY-COMPLETION.md` written with reproduced-then-fixed evidence + row pointers.
   Version-tagged commits (PATCH; MINOR/MAJOR London's call). STOP-and-review read-back to London.

## 7. Locks + landmines to preserve
Claude-lock (Sonnet compose / Haiku workers via MA-06); one-writer (never write the wiki); founder
isolation; bounded non-recursive workers; no founder-facing model selector; curated transparency; **never
move money.** Keep `MCP_TOOL_TIMEOUT=240000` (Railway env only); single-process only; do not re-add the
per-agent `timeout` key. Do not flip flag defaults, prune Path A, or touch the harness-root `ROADMAP.md`.

## 8. Out of scope
Capability-selection / under-delegation tuning (native-reasoning-first, addressed **in the post-F
G-gate** — this gate does **not** touch routing); the financial-series build (Phase F); sessions/Deep
Mode (Phase E). This is answer-integrity enforcement only.

---

## 9. Execution-agent kickoff (paste-ready)
> You are the **execution agent** for the **04B Composer Output-Integrity Gate** — a standalone live-path
> hardening that lands **before Phase E**. The orchestration agent scoped it with London; you build,
> observe, and commit on the live stack. Flags stay **dark** throughout (this fix must hold on Path A,
> which is live behind the dark SDK flags).
>
> **Read first:** `04B-COMPOSER-INTEGRITY-PLAN.md` (this doc), `04B-G-GATE-FINDINGS.md` (§2 the evidence,
> §6 the decision), `04B-VISION-AND-INTENT.md` §4 (#4/#5).
>
> **State (re-confirm before touching anything):** `/api/health ok=true`, SHA `911e61fa` (v0.6.116); git
> `main`/`origin/main`/Railway agree; `vcso_sdk_loop` + `vcso_planner` dark, allowlists empty.
>
> **Build:** the output-integrity gate at the `answer_text` compose seam (`vcso_sdk_loop.py` ~L2298),
> covering **both** Path A and model-driven emission, per §2–§4. Reuse the v0.6.116 degraded-compute
> classification. Tighten the shared prompt (`vcso_chat_service.py:111`) to match — but enforcement is the
> gate. **Touch no routing / capability selection** (native-reasoning-first stays intact).
>
> **Prove (observe, don't infer):** reproduce the A1 fabrication first, then confirm the fix returns
> "cannot compute from current data" with no substitute arithmetic — on **both** paths, including the
> Path-A fail-open at `vcso_sdk_loop.py:1867`. Confirm the honest case (cited retrieval / qualitative
> answer) is unregressed. Hold to **N consecutive** (Rule 10). Unit + integration for all four cases.
>
> **Discipline:** confirm deployed head == intended SHA + `/api/health ok=true` before any canary;
> version-tags forward (PATCH; MINOR/MAJOR = London); preserve every lock + landmine in §7; keep flags
> dark and read them back off. **On anything unexpected, stop and surface to London** — do not iterate
> blind.
>
> **Close:** write `04B-COMPOSER-INTEGRITY-COMPLETION.md` (reproduced-then-fixed evidence + row pointers),
> flags dark/read-back-off, Path A intact, then STOP-and-review with London. Only after this clears does
> Phase E begin.
