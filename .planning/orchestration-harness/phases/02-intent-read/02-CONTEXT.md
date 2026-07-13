# Phase 2 Context — Intent & Depth Read + Adaptive Triage

**Phase:** 02 of the Orchestration Harness workstream.
**Read first:** the workstream `../../CONTEXT.md` (Principle #2 deterministic phases, #1 cheap compact
inputs), `../../ROADMAP.md` (Phase 2), `../../REQUIREMENTS.md` (INT-1..3), and Phase 1's
`../01-working-state-memory/01-CONTEXT.md` + `01-COMPLETION.md` (the `assemble()` seam + `working_state`
this builds on). North Star `../../../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` §2 (turn lifecycle) and
§3 (three terminal modes) win over any reference. Pattern source: `../../../OPENCLAW-ANALYSIS-ORCHESTRATION-REPURPOSE.md`
§2 (active-memory pre-pass).

---

## Why this phase, and what it is

The North Star turn opens **not** with retrieval but with reading *what kind of move the founder is
making and how deep it goes* — the thing that makes the VCSO a thought partner instead of a reflexive
answerer. Phase 2 builds that **front door**: a cheap, worker-tier **intent-and-depth pre-pass** that
runs before assembly, sets the turn's **response contract**, and gates whether the turn does full work
or answers directly. It is the active-memory pattern (bounded, before-reply, compact-or-`NONE`).

It composes with Phase 1: the pre-pass reads `working_state` + the latest message (cheap), and its
output feeds the Phase 1 **`assemble()` seam** via `systemPromptAddition` (the clean injection point).
It does **not** build the router or the planner — those are Phases 3 and 4. Given they don't exist yet,
Phase 2 uses the intent read for exactly the things available now:

1. **Response contract** — a `systemPromptAddition` that steers the turn's posture (a lookup answers
   directly and briefly; a brainstorm advances the thinking without forcing a conclusion; a strategic
   ask reasons with judgment, cites, sequences). Low-risk, high-value, available today.
2. **Adaptive triage** — simple lookups / ambient statements take a **lean** assembly + lower budget
   and short-circuit toward a direct answer; strategic / brainstorm take the full Phase 1 working-state
   assembly. This is a cost lever *on top of* Phase 1 (simple turns get even cheaper).
3. **Record the intent per turn** — for observability and for the router/planner (P3/P4) to consume.

## What this phase is NOT

- **Not the router (P3).** No tier escalation, no per-intent tool-gating, no source selection. The
  pre-pass classifies and steers posture/budget; it does not choose sources or tools.
- **Not the planner (P4).** No decomposition into sub-questions, no delegation. "This is multi-part"
  is *recorded*; acting on it (decompose→delegate→compose) is Phase 4.
- **Not reflect-and-steer or produce (P5 / Domain Agents).** The pre-pass may *classify* a turn as
  brainstorm/ambiguous or as a produce request, but the reflect-and-steer terminal mode is Phase 5 and
  artifact production is Domain Agents. Phase 2 only sets posture + records the leaning.
- **Not a behavior-free change.** Steering + triage change turn behavior, so prove cost + quality
  neutral-or-better before default-on. Behind its own flag, fail-open.

## The intent taxonomy (confirm at checkpoint)

**Move type** (five, from North Star §2):
- `lookup` — factual / simple; answer directly.
- `strategic_synthesis` — multi-part "what do I do / how do these connect"; full assembly (+ later P4 decomposition).
- `brainstorm` — advance the thinking; no forced answer/conclusion.
- `produce` — make an artifact (→ Domain Agents later); classify + note, don't route here.
- `ambient` — a statement, not a question; acknowledge / gently steer.

**Depth:** `shallow` | `deep`. **Plus** a confidence and a chosen `response_posture`. Low confidence
or timeout → **`NONE`** → safe default posture (treat as `strategic_synthesis`/full; never a lean
short-circuit on uncertainty).

## Decisions that shape this phase (grounded; confirm the checkpoint items)

1. **Worker-tier pre-pass.** The intent read runs on Claude Haiku via `tier_worker` (MA-06), capability
   key `vcso_intent_read`, role `utility` — like the Phase 1 `afterTurn`. Cheap; bounded prompt/output/
   timeout; **circuit breaker** (skip after N consecutive timeouts).
2. **`systemPromptAddition` is the injection point** into the Phase 1 `assemble()` seam — no new
   assembly path; the response contract rides the existing seam. **Fail-open:** on `NONE`/error, no
   steering + full (safe) assembly; the turn never breaks.
3. **Per-turn intent is persisted** (type / depth / confidence / posture) for observability + P3/P4.
   Home TBD by the execution agent — a small `intent jsonb` on `vcso_chat_messages` (consistent with
   the existing `citations` jsonb / `deep_mode` per-message) or on `working_state`.
4. **Adaptive triage is conservative.** Only clear, high-confidence `lookup`/`ambient` turns take the
   lean path; everything else (and all low-confidence) takes full assembly. Never trade quality for a
   cheaper path on doubt.
5. **Injection hygiene (INT-3).** The pre-pass reads `working_state` + latest message; anything it
   surfaces/injects is framed untrusted (not instructions), consistent with the annotation rule.
6. **Own flag, prove-then-flip.** Behind `vcso_intent_read` (default off), proven on live before any
   default flip (a separate founder call), mirroring Phase 1. Its production flip lands **after** Phase 1's.

## Success criteria (from ROADMAP Phase 2 — INT-1..3)

1. **INT-1:** the worker-tier pre-pass classifies move-type + depth + confidence before retrieval,
   bounded + fail-open + circuit-breakered, returns compact-or-`NONE`; recorded per turn.
2. **INT-2:** high-confidence `lookup`/`ambient` turns take a lean assembly/budget and answer directly;
   strategic/brainstorm take full assembly; low-confidence defaults to full.
3. **INT-3:** injected/surfaced context is untrusted-framed; the pre-pass never treats founder text as
   instructions.
4. **Cost + quality proof:** on live (canary founder, flag on), simple turns are **leaner** than the
   Phase-1 baseline while strategic turns are unchanged, and **no quality regression** on a small fixed
   mixed-intent set (lookup answered directly and correctly; strategic still cited/sequenced). The
   pre-pass's own cost is netted in.
5. Workstream `ROADMAP.md` + `STATE.md` updated; `02-COMPLETION.md` written.

## Locked decisions (founder-confirmed 2026-07-13)

- **Intent taxonomy:** five move-types — `lookup` / `strategic_synthesis` / `brainstorm` / `produce` /
  `ambient` — plus depth `shallow` | `deep`, with confidence + chosen `response_posture`. Locked.
- **Phase-2 scope of action:** response-contract steering + **conservative** lean-triage + record-only.
  Tools/sources/tier-escalation (P3) and decomposition/delegation (P4) are **out of scope here** —
  `produce` and multi-part strategic turns are *classified and recorded*, not acted on.
- **Flag posture:** a **separate** `vcso_intent_read` flag (default off), prove-then-flip; its production
  flip lands **after** Phase 1's `vcso_working_state_assembly` flip (never stack two unproven assembly
  changes live).
