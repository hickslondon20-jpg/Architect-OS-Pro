# Execution Agent Brief — Phase 0: Reconciliation Cleanups

You are the Execution Agent for **Phase 0** of the Orchestration Harness workstream in ArchitectOS
Pro. You execute this phase's cleanups and investigation. You do not re-plan it, and you do not start
any later phase (no router, no planner, no working-state memory, no schema migrations).

This is a **de-risking phase**, not feature work: close the three drift/ambiguity items the
reconciliation surfaced so the spine (Phases 1–7) is built on one clear surface. Two of the five
tasks are a behavior-preserving code/docs cleanup; two are an investigation that ends in a
**founder decision** (wiki authority) — you recommend and stop, you do not pick.

## Read these before touching anything (in order)
1. `.planning/orchestration-harness/CONTEXT.md` — the workstream rationale, reuse map, governing
   principles, and the Conflict Register (O1–O3) this phase closes.
2. `.planning/orchestration-harness/ROADMAP.md` — Phase 0 goal + success criteria (CLEAN-1..5).
3. `.planning/RECONCILIATION-COGNITIVE-ORCHESTRATION.md` — the evidence base (live paths, usage data,
   table names). **Trust it, but re-verify anything you're about to change** (live Supabase project
   `pwacpjqkntnovndhspxt`; live `api.architectospro.com`).
4. `phases/00-reconciliation-cleanups/00-CONTEXT.md` — why/what, what-it-is-NOT, locked decisions.
5. `phases/00-reconciliation-cleanups/00-01-PLAN.md` (CLEAN-1/2/5, housekeeping) and
   `00-02-PLAN.md` (CLEAN-3/4, investigation + decision) — the two plans you execute.
6. Canonical (win over anything else): `.planning/COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` and
   `.planning/INTELLIGENCE-LAYER-ARCHITECTURE.md`.

## What you are doing

**Plan 00-01 (proceed straight through — behavior-preserving):**
- Confirm the frontend VCSO call targets the **Python** `/api/vcso/chat` (not the Vercel function);
  record the config/env var that sets the backend base URL. (CLEAN-5)
- Retire or quarantine the dead Vercel `api/vcso/chat.ts` (and `api/vcso/writeback.ts` if also dead),
  **only after** a clean reference check (frontend, `vercel.json`/rewrites, other `api/` files, docs).
  Delete if unreferenced; quarantine with a `DEPRECATED` banner + disabled route if there is any
  ambiguity. (CLEAN-1)
- Correct **CLAUDE.md Rule #1** so the Virtual CSO interactive-chat lane reads as Python-served
  (`/api/vcso/chat` streaming from `VcsoChatService`), retiring the stale "Vercel serverless streaming
  exception" wording — keep every other lane accurate (repoint precisely; don't blanket-delete). (CLEAN-2)

**Plan 00-02 (investigate + recommend; STOP for founder on the authority choice):**
- Map `ose_knowledge_pages` (what the live VCSO reads) vs. the `wiki_*` claim/evidence/digest system
  (via `per_user_wiki`): contents, which the VCSO reads, who writes each, and their relationship.
  Recommend the authoritative query-time wiki + read path, with rationale. (CLEAN-3)
- Verify whether the conversation→OS-Engine→wiki feeder runs (thread-sourced pages vs. upload-sourced);
  conclude **running (with evidence)** or **deferred dependency (with rationale)**. (CLEAN-4)

## Hard constraints (do not violate)
- **Behavior-preserving.** Do not change the live Python VCSO loop's behavior. Phase 0 removes dead
  code and corrects docs only. If you're editing `vcso_chat_service.py` logic or building routing/
  planner code, you've left Phase 0.
- **Verify references before removing anything.** No deletion under uncertainty — quarantine instead.
- **Wiki authority is a founder decision.** Investigate and recommend; **do not unilaterally pick** the
  authoritative wiki. Present the map + recommendation and stop for London's confirmation.
- **No page authoring, no OS Engine changes, no schema migration.** O3 is a *verification*, not a build.
- **Founder isolation, one-writer, curated transparency, Claude-lock** remain untouched.
- **Work from live; commit version-tagged** (PATCH++ from the current version) per CLAUDE.md; verify on
  live after each change.

## Checkpoint — return to London before closing the phase
- **CLEAN-3 (wiki authority):** bring the map + recommended authoritative source + read path back for
  **founder confirmation** before marking O2 resolved. Do not proceed to encode the choice unprompted.
- Everything else in 00-01 (VCSO retire, CLAUDE.md, endpoint confirm) and the CLEAN-4 verification
  proceeds straight through; only pause elsewhere if you hit a genuine new conflict — in which case add
  a row to the workstream `CONTEXT.md` Conflict Register and stop.

## Done when
1. **CLEAN-5/-1:** Frontend endpoint confirmed = Python `/api/vcso/chat` (config source recorded); the
   dead Vercel `chat.ts` (+ `writeback.ts` if dead) removed or quarantined with reference-check
   evidence; nothing live references the retired code.
2. **CLEAN-2:** CLAUDE.md Rule #1 corrected and accurate for all remaining lanes.
3. Post-change, a live VCSO turn still works and still logs `surface='virtual_cso'`; `ws5-chat` stays 0
   (verified against live, not just reported).
4. **CLEAN-3:** Wiki map + authoritative-source recommendation delivered to London; O2 marked resolved
   only after confirmation.
5. **CLEAN-4:** Feeder status concluded (running-with-evidence or deferred-with-rationale) and recorded.
6. Frontend build green (if `src`/`api` changed); `python -m compileall python-backend` clean; live-smoke
   gaps (missing env/creds) flagged honestly.
7. `Pro-Suite-Progress.md`, `.planning/orchestration-harness/ROADMAP.md` + `STATE.md`, and the
   `.planning/RECONCILIATION-COGNITIVE-ORCHESTRATION.md` notes updated; the workstream `CONTEXT.md`
   Conflict Register O1 (and O2/O3 once confirmed/scoped) marked resolved; `00-COMPLETION.md` written
   with the evidence summary. Deliver a read-back to London.

## Explicitly out of scope for you
Working-state memory + assembly (Phase 1), intent read (Phase 2), the router (Phase 3), the planner
(Phase 4), reflect-and-steer/freshness/MCP (Phase 5), generalization (Phase 6), verification (Phase 7);
authoring any wiki page; building or modifying the wiki feeder or any OS Engine writer; changing which
wiki the live VCSO reads. Do not resolve anything `00-CONTEXT.md` marks as a later phase.
