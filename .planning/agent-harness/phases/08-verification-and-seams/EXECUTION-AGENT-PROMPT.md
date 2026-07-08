# Execution Agent Brief — Phase 8: Verification & Seams (Ep6 Closeout)

You are the Execution Agent for **Phase 8** — the Ep6 closeout. You verify; you do **not** add
features. (This is a strong candidate to run as a dedicated verification subagent.)

## Read these before verifying (in order)
1. `.planning/agent-harness/CONTEXT.md` — the decisions you are asserting against.
2. `.planning/agent-harness/ROADMAP.md` — Phase 8 goal + success criteria.
3. All Phase 1–7 `0N-COMPLETION.md` — what was built + already verified.
4. `phases/08-verification-and-seams/08-CONTEXT.md` (the assertion matrix + §8 checklist), then
   `08-01-PLAN.md`.
5. Canonical: `../../INTELLIGENCE-LAYER-EPISODE-MAP.md` §5 (L1–L21) + §8.

## What you are doing
Running the §A end-to-end (code-level) + §B locked-decision assertions + §C Ep7-seam checks from
`08-CONTEXT.md`, then writing `08-COMPLETION.md` with per-check evidence and the consolidated §8
deferred-smoke checklist. No new features.

## Hard constraints (do not violate)
- **No features, no fixes-in-place.** If a check fails, **log it** (with the owning phase) — do not
  silently patch across scope. A genuine conflict with L1–L21 goes to the `CONTEXT.md` conflict
  register.
- **Do NOT run live-credential smokes here (L18).** Anthropic/GKE/browser/OS-Engine live runs are the
  **§8 consolidated pass** (after the front-end audit). Phase 8 verifies at **code level** (fakes
  where creds are needed) and **produces** the §8 checklist.
- **Assertions are concrete.** Each §B item is a real grep/test/query with cited evidence — not a
  restated claim.
- **Honor the sequencing gate (§8):** front-end/UX audit → consolidated cross-episode smoke → go-live
  all happen after Ep6; do not pull them forward.

## Done when
1. §A end-to-end passes (code-level) from all three entry points (Profile, Kanban, VCSO `@Agent`) →
   one task; state machine + resumability + review gate hold.
2. All §B locked-decision assertions pass or are logged with the §8 owner; §C Ep7 seams verified.
3. `python -m compileall python-backend` + the full focused suite + `npm.cmd run build` pass.
4. `phases/08-verification-and-seams/08-COMPLETION.md` written with per-check evidence + the complete
   §8 deferred-smoke checklist; `Pro-Suite-Progress.md`, `ROADMAP.md`, `STATE.md` updated to mark the
   **Ep6 build code-complete** and point to the §8 checklist as the next-gate input.

## Explicitly out of scope for you
Any live-credential smoke; the front-end/UX audit (§8.1); the consolidated cross-episode smoke
(§8.2); go-live; new features or refactors. You verify and hand off.
