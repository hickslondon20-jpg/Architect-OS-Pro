# Phase G Plan — Generalize, Verify, Cut Over

> Read `04B-VISION-AND-INTENT.md` (grade against §4), `../../CONTEXT.md` + `../../ROADMAP.md`, and this
> folder's `CONTEXT.md` + `ROADMAP.md` first. Covers **SDK-G1..G4**. The terminal phase.
> **Refreshed 2026-07-23 against post-D2 state.**

## Phase G has two halves
1. **Front half — the generalization proof (the G-gate).** Split out into its own self-contained
   execution artifact: **`04B-G-GATE-PLAN.md`** (question set A1–A5, appropriateness rubric,
   breadth-first-then-depth bar, effort-scaling relaxation). It closes VISION rubric **#8** and is **the
   gate before ANY wider founder exposure.** **This must clear first.**
2. **Back half — verify + cut over (this document, SDK-G2..G4).** Broaden the SDK path beyond the gate,
   prove the co-equal gates on live, retire the hand-rolled loop **only** on parallel-run parity, then
   thread 04B into the harness-root `ROADMAP.md` (**separately founder-gated**).

## Sequencing (updated 2026-07-23, London — see `04B-G-GATE-FINDINGS.md`)
**E → F → G-gate (front half) → this back half.** Changed after A1 pressure-testing: the G-gate is **held
until Phase F** supplies the financial series its sandbox tests need. The back half is terminal — it
assumes the G-gate has cleared and Phases E + F are done, and it does not start until then.

## Current state (verified 2026-07-23)
- **D2 done** (`v0.6.114`); `vcso_sdk_loop` + `vcso_planner` **dark**; Path A retained dark as the
  flag-off fallback — **keep it until parity is signed off.** `/api/health ok=true`, SHA `feb3fe04`.
- Rubric status (VISION §4): the only open line is **#8 (generalizes)** — owned by the G-gate front half.
  #9 (substrate serves Domain Agents) is ◐ and matures as generalization + Deep Mode + domain agents come
  onto the SDK path in Step A below.

## Deliverable
The SDK path generalized across question types, then Deep Mode, then domain agents; the co-equal gates
(cost / quality / UX / safety) proven on live with traces paired to DB/output checks; the hand-rolled
loop retired after parallel-run parity; and the harness-root `ROADMAP.md` updated to reflect 04B —
founder-gated.

## Steps

### A. Generalize (SDK-G1)
1. **Precondition: the G-gate (`04B-G-GATE-PLAN.md`) has cleared** — the lead delegates appropriately
   across A1–A5 at the N-consecutive bar. Only then broaden.
2. Extend the SDK path across question types (lookup / strategic synthesis / brainstorm / produce /
   ambient), then Deep Mode, then domain agents — surface by surface, each canary-proven before the next.
3. Enable disabled strategic workers selectively as decompose breadth grows (retrieval-evidence +
   strategy-synthesis first), per the harness Phase 6 posture.

### B. Verify the co-equal gates on live (SDK-G2)
1. **Cost:** smaller synthesis context vs. baseline. **Quality:** cited CFO/CSO answers, no regression
   on a mixed set. **UX:** native legible plan/steps + real streaming + partner-like reflect-and-steer.
   **Safety:** founder isolation, budget/depth caps, runtime-enforced tool policy under adversarial
   prompts. Every claim paired: trace + `ai_usage_log`/output (observe, don't infer).

### C. Cut over + thread into the roadmap (SDK-G3/G4)
1. Retire the hand-rolled loop **only** on parallel-run parity evidence; keep it as the flag-off fallback
   until parity is signed off.
2. On founder approval, update the harness-root `ROADMAP.md` (and `STATE.md`, `Pro-Suite-Progress.md`)
   to reflect 04B as the realized re-approach to Phases 4–7; retire/roll superseded P4 planner rows.
   **Do not touch the harness-root `ROADMAP.md` before this founder gate.**

## Acceptance criteria
1. **G-gate cleared** (`04B-G-GATE-COMPLETION.md`), then SDK path generalized across question types +
   Deep Mode + domain agents, each canary-proven.
2. Co-equal gates proven on live with paired evidence; no quality regression.
3. Hand-rolled loop retired on parity; flag-off fallback path documented until sign-off; Path A intact
   until then.
4. Harness-root `ROADMAP.md`/`STATE.md`/`Pro-Suite-Progress.md` updated (founder-gated); superseded P4
   rows resolved.
5. `compileall` clean; frontend green; `04B-G-COMPLETION.md` written. Final read-back to London.

## Locks to preserve
Founder isolation; one-writer (feed OS Engine, never write the wiki); bounded non-recursive workers;
Claude-lock (Sonnet compose / Haiku workers via MA-06); no founder-facing model selector; curated
transparency. **INFRA:** keep `MCP_TOOL_TIMEOUT=240000`; single-process only; do not re-add the per-agent
`timeout` key. Version-tags forward (PATCH default; MINOR/MAJOR London's call). Process Rule 10 —
reliability = N consecutive, not one green.

## Out of scope
The MCP-snapshot-into-wiki general ingestion path + additional connectors (later workstreams); any
non-VCSO surface not named above; the generalization proof itself (front half — `04B-G-GATE-PLAN.md`).
