# Phase 0 Context — Reconciliation Cleanups

**Phase:** 00 of the Orchestration Harness workstream.
**Read first:** the workstream `../../CONTEXT.md`, `../../ROADMAP.md`, `../../REQUIREMENTS.md`
(CLEAN-1..5), and — the evidence base for this whole phase — `../../../RECONCILIATION-COGNITIVE-ORCHESTRATION.md`.
The North Star `../../../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` and
`../../../INTELLIGENCE-LAYER-ARCHITECTURE.md` win over any reference.

---

## Why this phase, and what it is

The reconciliation pass found the substrate more built than feared, but surfaced **three drift/
ambiguity items** that would quietly corrupt every later phase if left in place. Phase 0 closes
them **before** the spine is built, so Phases 1–7 design against one clear, unambiguous surface.

This is a **de-risking phase**, not feature work: a small code retirement, a docs correction, one
endpoint confirmation, and two investigations (one of which ends in a founder decision). No router,
no planner, no working-state memory, no schema migrations.

The three items (from the workstream Conflict Register):

- **O1 — two VCSO implementations.** Live = Python `main.py` `@app.post("/api/vcso/chat")` →
  `StreamingResponse(VcsoChatService)` (surface `virtual_cso`; usage last 10d = **76 rows**). Dead =
  Vercel `api/vcso/chat.ts` (single-shot, surface `ws5-chat`; usage last 10d = **0**). And
  **CLAUDE.md Rule #1 still calls the VCSO a "Vercel serverless streaming exception"** — stale.
- **O2 — two wiki representations.** `ose_knowledge_pages` (the flat pages the live VCSO prompt
  actually reads) vs. the richer `wiki_*` claim/evidence/digest system reached via the
  `per_user_wiki` sub-agent. Which is authoritative for query-time composition is undecided.
- **O3 — conversation→wiki feeder unconfirmed.** Wiki pages track document uploads, not chat threads;
  whether the compounding Layer-2-from-conversation feeder runs is unknown. It is the build-time cost
  lever, so its status must be known (running, or explicitly scoped as deferred).

Plus a one-line confirmation: **CLEAN-5** — verify the frontend's actual VCSO call URL against the
Python route (the reconciliation inferred it from usage because `src/` was not greppable in that
environment).

## What this phase is NOT

- **Not the router / planner / working-state build.** Phases 1–4. Phase 0 changes no live VCSO
  *behavior* — it only removes dead code and corrects docs.
- **Not authoring wiki pages.** The founder-operating page expansion is OS Engine's job (one-writer);
  Phase 0 only *decides which existing wiki representation is authoritative* and how the composer
  reads it.
- **Not a schema migration.** No table changes. (Wiki authority is a *decision + documentation*, not
  a data migration.)
- **Not an OS Engine change.** O3 is a *verification* — confirm whether the feeder runs; do not build
  or modify it.

## Decisions that shape this phase (from the workstream CONTEXT + reconciliation; do not override)

1. **Live VCSO is the Python `/api/vcso/chat` path.** Proven by usage (`virtual_cso`=76 / `ws5-chat`=0
   over 10 days). The harness will be built here in later phases. Do not build anything in the Vercel
   file.
2. **The Vercel `api/vcso/chat.ts` is legacy and must be retired or explicitly quarantined.** Prefer a
   clean removal **only after** confirming nothing (frontend, Vercel routing/`vercel.json`, other
   functions) still references it; otherwise quarantine with an unambiguous deprecation marker. Check
   its sibling `api/vcso/writeback.ts` too — determine live vs. dead the same way.
3. **CLAUDE.md Rule #1 must be corrected** to state the live VCSO is Python-served (retire the
   "Vercel serverless streaming exception" language, or repoint it precisely to whatever, if anything,
   still legitimately runs on Vercel).
4. **Wiki authority (O2) is a founder decision.** The execution agent **investigates and recommends**;
   it does not unilaterally pick. Surface: which representation the live VCSO reads today, what each
   contains, and a recommended authoritative query-time source + read path — for founder confirmation.
5. **Feeder (O3) is verify-or-scope.** Confirm the conversation→OS-Engine→wiki feeder runs; if it does
   not, record it as an explicit deferred dependency (it does not block Phase 1) with a one-paragraph
   rationale — do not build it here.

## Success criteria (from ROADMAP Phase 0 — CLEAN-1..5)

1. **CLEAN-1 / -5:** Frontend VCSO endpoint confirmed = Python `/api/vcso/chat`; the dead Vercel
   `api/vcso/chat.ts` (and `writeback.ts` if dead) retired or quarantined with references verified
   clear; live VCSO behavior unchanged (post-change usage still logs `virtual_cso`, still `ws5-chat`=0).
2. **CLEAN-2:** CLAUDE.md Rule #1 corrected; the stale Vercel-exception language no longer misleads.
3. **CLEAN-3:** A documented map of `ose_knowledge_pages` vs. `wiki_*` (what each holds, which the VCSO
   reads), a **recommended authoritative query-time wiki + read path**, flagged for founder confirmation.
4. **CLEAN-4:** Conversation→wiki feeder status **confirmed** (running, with evidence) **or scoped as a
   deferred dependency** (with rationale). Recorded in the workstream STATE + reconciliation notes.
5. Workstream `ROADMAP.md` + `STATE.md` updated; `00-COMPLETION.md` written; changes committed
   version-tagged. Founder read-back delivered.

## Open items to resolve in this phase (surface to founder; do not silently resolve)

- **O2 authority choice.** Recommendation goes to the founder; the confirmed choice updates the
  workstream CONTEXT (Conflict O2 → resolved) and informs Phase 1 (assembly) + Phase 3 (router).
- **O3 feeder disposition.** Running vs. deferred — either way, recorded so Phase 3's build-time cost
  assumption is explicit.
