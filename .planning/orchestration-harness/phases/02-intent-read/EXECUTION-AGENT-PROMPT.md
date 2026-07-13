# Execution Agent Brief — Phase 2: Intent & Depth Read + Adaptive Triage

You are the Execution Agent for **Phase 2** of the Orchestration Harness workstream in ArchitectOS
Pro. You build the harness's **front door**: a cheap worker-tier intent-and-depth pre-pass that sets
the turn's response contract and gates lean-vs-full assembly. You do not re-plan the phase, and you do
not start any later phase (no router, no planner, no delegation).

Phase 2 composes with Phase 1: the pre-pass reads `working_state` + the latest message and feeds the
Phase 1 `assemble()` seam via `systemPromptAddition`. It **classifies and steers**; it does not touch
tools, sources, tier-escalation (P3), or decomposition/delegation (P4). Behind its own default-off
flag; fail-open; the live VCSO keeps working throughout.

## Read these before writing any code (in order)
1. `.planning/orchestration-harness/CONTEXT.md` — workstream rationale, principles (#1 cheap compact
   inputs, #2 deterministic phases, #10 two-grain memory), Conflict Register (O2/O3 resolved/deferred).
2. `.planning/orchestration-harness/ROADMAP.md` — Phase 2 goal + success criteria (INT-1..3).
3. `phases/02-intent-read/02-CONTEXT.md` — phase rationale, the intent taxonomy, and the **Locked
   decisions** (founder-confirmed) you build to.
4. `phases/02-intent-read/02-01-PLAN.md` (INT-1/3, classifier + response contract) and
   `02-02-PLAN.md` (INT-2, adaptive triage) — the two plans you execute.
5. `phases/01-working-state-memory/01-CONTEXT.md` + `01-COMPLETION.md` — the `assemble()` seam,
   `working_state`, the `vcso_working_state_assembly` flag, and the worker-tier `afterTurn` pattern you
   mirror.
6. Canonical (win over anything else): `.planning/COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` §2–§3.
7. Live grounding you extend: `python-backend/services/vcso_chat_service.py` (the `assemble()` seam +
   `systemPromptAddition`, the tool loop), `vcso_chat_messages` (`citations` jsonb / `deep_mode`
   per-message precedent), MA-06 `tier_worker` routing. **Verify live before changing** (Supabase
   `pwacpjqkntnovndhspxt`; live `api.architectospro.com`).

## What you are building

**Plan 02-01 — classifier + response contract (INT-1, INT-3):**
- Flag `vcso_intent_read` (default **off**, mirroring the Phase 1 flag shape + `timeout_ms`,
  `circuit_breaker_max_timeouts`). Per-turn intent persistence (a small `intent jsonb` on
  `vcso_chat_messages` or a `current_intent` in `working_state` — your call, grounded).
- A bounded pre-pass on **Claude Haiku via `tier_worker`** (capability `vcso_intent_read`, role
  `utility`) that reads `working_state` + latest message and returns
  `{move_type ∈ {lookup, strategic_synthesis, brainstorm, produce, ambient}, depth ∈ {shallow, deep},
  confidence, response_posture}` or **`NONE`**. Bounded prompt/output/timeout + **circuit breaker**.
- A `move_type → systemPromptAddition` response contract injected through the Phase 1 seam (no new
  assembly path). Injection hygiene: surfaced context is untrusted, never instructions.

**Plan 02-02 — adaptive triage (INT-2):**
- High-confidence `lookup`/`ambient` → **lean** `assemble()` profile (tighter budget / reduced
  component set) + direct-answer posture; `strategic_synthesis`/`brainstorm` **and all low-confidence**
  → full Phase 1 assembly. Same seam, leaner profile — **no separate assembly code path**.
- The lean path only trims the *starting* assembly; it must not forbid mid-turn tool escalation.

## Hard constraints (do not violate)
- **Default-off flag; prove-then-flip; flip after Phase 1.** Flag off ⇒ assembly byte-for-byte
  unchanged. Do **not** flip the default — that is a separate founder call, and it lands after the
  `vcso_working_state_assembly` flip.
- **Fail-open + conservative bias.** Timeout / error / low-confidence / `NONE` ⇒ **full, safe
  assembly, no steering** — never a lean short-circuit on doubt. The pre-pass never breaks or
  materially delays the turn. **No strategic turn may take the lean path.**
- **Scope wall.** Classify + steer posture/budget + record only. **No** per-intent tool-gating, source
  selection, tier escalation (P3), decomposition, or delegation (P4). `produce` and multi-part strategic
  turns are recorded, not routed/acted on. If you're gating tools by intent or decomposing, you've left
  Phase 2.
- **Worker-tier + Claude-lock.** The pre-pass runs on Haiku via `tier_worker` (MA-06), role `utility`.
- **Curated transparency.** Surface the intent as a sanitized MA-05 step — no raw chain-of-thought.
- **Founder isolation** on any persisted intent; **one-writer** (intent is turn scaffolding, never a KB
  write); **work from live**, commit version-tagged.

## Checkpoint — proceed straight through; return only for the flag-flip
The three design decisions are **locked** (see `02-CONTEXT.md` Locked decisions) — implement on them,
no further checkpoint. **Bring the cost + quality proof back to London** for the default-flip decision;
do not flip it yourself. Only pause mid-phase for a genuine new conflict with the workstream CONTEXT —
add a Conflict Register row and stop.

## Done when
1. **INT-1:** the pre-pass classifies move-type + depth + confidence before retrieval on Haiku/
   `tier_worker` (`utility`), bounded + circuit-breakered, returns compact-or-`NONE`, recorded per turn;
   verified live.
2. **INT-3:** the `systemPromptAddition` response contract reaches the model via the Phase 1 seam;
   surfaced context is untrusted-framed; flag off ⇒ assembly unchanged; a failed pre-pass leaves the turn
   on the full/safe path (forced-timeout proof).
3. **INT-2:** high-confidence `lookup`/`ambient` take the lean profile + direct answer; strategic/
   brainstorm and all low-confidence take full; verified per-turn from persisted intent + tokens;
   **no strategic turn took the lean path** on a mixed set.
4. **Cost + quality proof (co-equal):** with `vcso_intent_read` on for the canary founder, simple turns
   are materially leaner than the Phase-1 baseline (net of the pre-pass's own Haiku cost) while strategic
   turns are unchanged and show **no quality regression** — paired LangSmith trace + `ai_usage_log`/output.
5. Intent step renders sanitized through MA-05.
6. `python -m compileall python-backend` clean; frontend build green if any `src` touched (none
   expected); `.planning/orchestration-harness/ROADMAP.md` + `STATE.md` updated; `02-COMPLETION.md`
   written with the mixed-intent evidence table; `Pro-Suite-Progress.md` updated. Deliver a read-back to
   London.

## Explicitly out of scope for you
The router / tier escalation / per-intent tool + source selection (Phase 3); the planner /
decompose→delegate→compose (Phase 4); reflect-and-steer / freshness / MCP (Phase 5); generalization
(Phase 6); verification (Phase 7); flipping the flag default; and the Phase 1 Stage 1/2 canary flip
(that is the separate staged-flip runbook). Do not resolve anything `02-CONTEXT.md` marks as a later
phase.
