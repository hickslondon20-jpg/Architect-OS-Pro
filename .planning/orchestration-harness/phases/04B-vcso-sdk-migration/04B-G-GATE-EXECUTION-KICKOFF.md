# 04B G-Gate — Execution-Agent Thread Prompt (paste-ready)

> Paste the block below to start the execution-agent thread that runs the G-gate sub-phase. It is
> self-contained; the agent does not need the orchestration conversation. Arm nothing until London's
> explicit go.

---

You are the **execution agent** for the **04B G-Gate** — the generalization proof, the front half of
Phase G, the gate before any wider founder exposure of the VCSO SDK-migration path. The orchestration
agent has scoped and locked this sub-phase with London; **you do the live code, canary observation, and
commits.** Everything runs **dark, on London's explicit go per canary, re-darkened after.**

**Read first, in order (do not skip — this migration shipped three false greens caught only by live
observation):**
1. `.planning/orchestration-harness/phases/04B-vcso-sdk-migration/04B-VISION-AND-INTENT.md` — the why +
   the fit-for-purpose rubric §4. Grade your result against it; the open line you are closing is **#8,
   "generalizes across the founder's real question space."**
2. `.planning/orchestration-harness/phases/04B-vcso-sdk-migration/04B-G-GATE-PLAN.md` — **your plan.**
   The locked 5-question set (A1–A5), the appropriateness rubric, the breadth-first-then-depth bar, the
   effort-scaling relaxation, dark-canary hygiene, and a step list in §10.
3. `.planning/orchestration-harness/phases/04B-vcso-sdk-migration/04B-EFG-ORCHESTRATION-HANDOFF.md` +
   `ROADMAP.md` (Phase G block + **Process Rule 10**) + the D2 evidence logs (`04B-D2-*`).

**Current state (verified 2026-07-23 — re-confirm before you touch anything):**
- Flags dark: `vcso_sdk_loop` and `vcso_planner` both `is_enabled=false`, `test_user_ids=[]`,
  `native_model_driven_enabled=false`. Path A retained dark as the fallback — **do not prune.**
- `/api/health` → `ok=true`, SHA `feb3fe04`. D2 done at `v0.6.114`.
- Founder canary: `hicks.london25@gmail.com` / user `cd490873-99aa-4533-9240-f0aa04deb54f`.

**Your mission:** run the locked A1–A5 generalization proof and score each run on the four-dimension
appropriateness rubric (right worker set · no over/under-decomposition · correct dependencies · sound
cited answer), paired to the `agent_delegation_runs` / `agent_delegation_steps` rows. Move rubric #8 to ✓
without regressing any other line. **Breadth first** (one clean pass on each of A1–A5 to expose
mis-delegation fast), **then depth** (N-consecutive 3–5 clean passes only on shapes that fail or look
fragile — A2/A3/A5 are the genuinely unproven ones).

**First actions — report back to London BEFORE arming anything:**
1. Re-confirm the state above (both flags dark; `/api/health ok=true`; deployed head == the intended D2
   SHA / `v0.6.114` lineage — **do not proceed on a stale deploy**).
2. **Verify the effort-scaling seam in code** (plan §5) — read the live `vcso_sdk_config.py` /
   `vcso_sdk_loop.py` path; **do not infer the key.** Report the exact flag/value you will set to relax
   the app-gated effort-scaling so the *model* chooses breadth (that relaxation is itself the thing
   under test).
3. Present your arming plan (flags to set, on which user, per-run) and **wait for London's explicit go.**

**Non-negotiable discipline (do not relearn live):**
- **Observe, don't infer.** Code-verified ≠ observed. Prefer injection-to-observe and zero-canary
  (reload persisted data) verification. Pair every claim to a DB/trace row.
- **Confirm deployed head == intended SHA + `/api/health ok=true` before every canary.**
- **Dark-canary hygiene:** arm founder-only on London's go, re-darken immediately after each run/session,
  read back **both flags off.** Never arm in anticipation.
- **Reliability = N consecutive** (Process Rule 10), not one green run. A single pass is "proven once."
- **On any mis-delegation: stop, capture the evidence, surface to London** — it's a valuable
  delegation-logic finding, far cheaper to fix now than after E/F build on top. Do not paper over it.
- **Preserve every lock:** founder isolation; one-writer (feed OS Engine, never write the wiki); bounded
  non-recursive workers; Claude-lock (Sonnet compose / Haiku workers via the MA-06 tier map); **no
  founder-facing model selector**; tier authority at capability grain; curated transparency (no raw
  payloads / no raw CoT).
- **INFRA LANDMINES:** never remove `MCP_TOOL_TIMEOUT=240000` (Railway env var only — the ~113s sandbox
  worker times out at the ~60s CLI default without it). Do **not** re-add the per-agent `timeout` config
  key (rejected by the deployed CLI, broke delegation). **Single-process only** — no `WEB_CONCURRENCY` /
  `--workers` (`TURN_REGISTRY` is process-global).
- **Version-tags always forward** — commit after each logical unit with a `vX.Y.Z` **PATCH**-bumped
  message (increment from the latest commit; even a failed/retry commit increments). **MINOR/MAJOR bumps
  are London's call.**
- **Do not** flip flag defaults, prune Path A, widen past the dark founder canary, or edit the
  harness-root `ROADMAP.md` (that's the separately founder-gated cut-over).

**Honest caveats baked into the plan (do not false-green past them):**
- **A1's sandbox is a working smoke** — the founder P&L dataset has one row; real concentration/margin
  compute is **Phase F**. A1 scores the **delegation shape**, not numeric depth.
- Relaxing effort-scaling is the thing under test — attribute each scored run to the exact armed config.

**Close:** write `04B-G-GATE-COMPLETION.md` — a per-run evidence table (rubric scores paired to
delegation rows), the re-graded VISION §4 (esp. #8, and confirm #5 honest-about-gaps and #7 safe/bounded
did not regress), and confirmation that flags are re-darkened (both read back off) and Path A is intact.
Then **STOP-and-review with London** before anything widens. Commit the completion log with a version tag.
