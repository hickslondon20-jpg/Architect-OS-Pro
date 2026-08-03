# 04B Phase E — Execution-Agent Thread Prompt (paste-ready)

> Paste the block below to start the Phase E execution-agent thread. Self-contained; the agent does not
> need the orchestration conversation. Phase E is the first active build phase after the composer-integrity
> gate. Sequence is **E → F → G-gate** (the G-gate is held until Phase F). Arm nothing until London's go.

---

You are the **execution agent** for **04B Phase E — Sessions + Deep Mode reconciliation.** The
orchestration agent has scoped this with London; **you do the live code, verification, and commits.** This
migration has shipped **three false greens** caught only by live observation — hold the discipline below.

**Read first, in order:**
1. `.planning/orchestration-harness/phases/04B-vcso-sdk-migration/04B-E-PLAN.md` — **your plan**
   (deliverable, steps, the watch-out, key files, acceptance criteria).
2. `.../04B-VISION-AND-INTENT.md` — grade your result against §4 (esp. #6 feels-native / survives reload,
   #7 safe & bounded).
3. `.../04B-G-GATE-FINDINGS.md` (why the order is E → F → G-gate) + `CONTEXT.md` + `ROADMAP.md` (Phase E
   block + **Process Rule 10**) + `04B-D2-M4-FINISH-LOG.md` (the nested-surface **reload** bug — Phase E's
   central risk is the same live-vs-persisted class).

**Current state (re-confirm before touching anything):**
- Deployed head `da59d904` (v0.6.117 lineage — the composer-integrity gate is **live and dark**), Railway
  + Vercel green. **Confirm the head with a *cache-busted* check** — a plain `/api/health` read can be
  served a stale CDN value; do not trust it uncached.
- `vcso_sdk_loop` + `vcso_planner` **dark**, allowlists empty, `native_model_driven_enabled=false`,
  diagnostics off. Path A retained dark as the fallback — **do not prune.**

**Mission:** make one source of truth for Deep Mode resume. Today the hand-rolled `_persist_deep_resume` /
`_deep_resume_state` path runs **alongside** SDK sessions — reconcile so SDK **sessions** (resume/fork)
own it, with the hand-rolled path subsumed or cleanly demarcated. `ask_user` pause/resume, the
`agent_todos` plan, and `workspace_files` must all rehydrate on resume. On the **model-driven** path — not
Path A.

**First move — RECON before you build, and report back to London before changing code:**
1. Re-confirm state above (cache-busted head; flags dark).
2. **Map the two resume authorities precisely** — where SDK sessions persist/resume vs. where
   `_persist_deep_resume` / `_deep_resume_state` (in `vcso_chat_service.py`) does, and what each owns
   (`ask_user`, `agent_todos`, `workspace_files`, context). Most of this is already built — **verify the
   wiring before rewriting anything.**
3. Present the reconciliation approach (what SDK sessions subsume, what stays, how double-bookkeeping is
   removed) and **wait for London's go** before implementing. Phase E is **deeper than it looks** and may
   warrant its own sub-thread — scope it with London, don't iterate blind.

**The watch-out (hard-won):** this is the **same live-vs-persisted class of bug that bit the M4 nested
surface** — what renders in-flight is not what survives a reload. **Prefer zero-canary verification:**
prove resume by **reloading persisted data** (pause a thread → reload → confirm plan + workspace + context
rehydrate) *before* any live-turn canary. Code-verified ≠ observed.

**Gate (Process Rule 10 — N consecutive, not one green):** a Deep Mode thread pauses on `ask_user` and
resumes with full context via the SDK session, plan + workspace intact, **no double bookkeeping** —
proven by reload first, then held to N-consecutive passes. One resume authority, observation-backed.

**Non-negotiable discipline:**
- **Observe, don't infer.** Pair every claim to a DB/trace row. Prefer reload-verification and
  injection-to-observe over inference.
- **Cache-busted head confirmation + `/api/health ok=true` before every canary.**
- **Dark-canary hygiene:** arm founder-only (`hicks.london25@gmail.com` / `cd490873-99aa-4533-9240-f0aa04deb54f`)
  on London's go, re-darken immediately after, read back both flags off.
- **Preserve every lock:** founder isolation; one-writer (feed OS Engine, never write the wiki); bounded
  non-recursive workers; Claude-lock (Sonnet compose / Haiku workers via MA-06); no founder-facing model
  selector; curated transparency. **Do not disturb the composer-integrity gate** (v0.6.117) or capability
  selection (native-reasoning-first).
- **INFRA LANDMINES:** keep `MCP_TOOL_TIMEOUT=240000` (Railway env only); **single-process only**
  (`TURN_REGISTRY` is process-global — no `WEB_CONCURRENCY`/`--workers`); do **not** re-add the per-agent
  `timeout` config key.
- **Version-tags always forward** — commit after each logical unit with a `vX.Y.Z` **PATCH**-bumped
  message. **MINOR/MAJOR bumps are London's call.**
- **Do not** flip flag defaults, prune Path A, widen past the dark founder canary, or edit the
  harness-root `ROADMAP.md`.

**Close:** write `04B-E-COMPLETION.md` (reload-proof + N-consecutive evidence, row pointers, re-graded
VISION §4), confirm flags dark (read back off) and Path A intact, `compileall` clean + frontend green.
Then **STOP-and-review with London.** Phase F begins only after E clears.
