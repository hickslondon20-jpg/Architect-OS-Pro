# Phase E Plan — Sessions + Deep Mode Reconciliation

> Read `04B-VISION-AND-INTENT.md` (grade against §4), `../../CONTEXT.md` + `../../ROADMAP.md`, and this
> folder's `CONTEXT.md` + `ROADMAP.md` first. Covers **SDK-E1..E4**.
> **Refreshed 2026-07-23 against post-D2 state.** Reconcile the hand-rolled Deep Mode resume-state with
> SDK sessions — a single source of truth, no double bookkeeping — **on the model-driven path**.

## Sequencing (updated 2026-07-23, London — see `04B-G-GATE-FINDINGS.md`)
**E now runs FIRST.** After A1 pressure-testing showed the G-gate can't be proven until the sandbox has
real financial data, the order was changed to **E → F → G-gate** (the G-gate is held until Phase F).
E reconciles session/resume mechanics on the **model-driven** loop D2 shipped — **not** Path A. Nothing
here widens the founder canary; E is bounded engineering + a resume gate, dark until observed-reliable.

## Current state (recon-corrected 2026-07-23 — see recon in `04B-E-EXECUTION-KICKOFF` thread)
**The premise changed on recon: there are NOT two functioning resume authorities.** There is one, plus an
orphaned half-build:
- **One functioning authority — the legacy hand-rolled path.** `vcso_chat_threads.deep_resume_state`
  (JSONB) stores run_id, tool-use id, full message history, trace steps, sources, citations, and the
  question (`vcso_chat_service.py:2494`); the hand-rolled loop reloads them and injects the founder's
  answer as a synthetic tool result (`vcso_chat_service.py:888`). `ask_user` is handled **only** in this
  legacy branch (`vcso_chat_service.py:985`).
- **SDK sessions are created but never resumed.** Session id is captured from `ResultMessage`
  (`vcso_sdk_loop.py:2250`) and written into the completed delegation run (`vcso_chat_service.py:794`),
  but `ClaudeAgentOptions` gets no `resume` / `fork_session` / `session_store` (`vcso_sdk_config.py:247`)
  and there is no thread→session pointer. **Deep Mode is explicitly EXCLUDED from the SDK path**
  (`... and not deep_mode`, `vcso_chat_service.py:623`).
- **So Phase E is a BUILD, not a de-dupe:** stand up SDK-native Deep Mode resume (which does not exist
  today) and demarcate the legacy `deep_resume_state` as the dark fallback. `agent_todos` /
  `workspace_files` are already the correct canonical mutable surfaces (`tool_registry.py:1426` / `:1485`).
- **Clean slate — no migration.** Live counts all zero: `agent_todos=0`, thread `workspace_files=0`,
  waiting threads=0, non-null `deep_resume_state=0`. Flags dark; deployed head `da59d904` (cache-busted);
  Path A present (`vcso_sdk_loop.py:1961`) — **do not prune.**

## Deliverable
SDK **sessions** (resume/fork) mapped onto Deep Mode: the `ask_user` pause/resume, the `agent_todos`
editable plan, and workspace files all resume with full context via the SDK session, with the
hand-rolled deep-resume-state either subsumed or cleanly demarcated so there is **one** resume authority.

## Approved implementation boundary (London, 2026-07-23 — build against this)
The recon reconciliation proposal is **approved with two guardrails.** Build this boundary:

1. **SDK sessions authoritative for model-driven Deep Mode context.** Founder-scoped Supabase SessionStore
   adapter on the SDK 0.2.118 transcript-store contract; explicit **thread→session pointer**. New turn →
   create session; founder response → `resume=<session_id>`; fork → `resume=<session_id>` +
   `fork_session=true`, new id on the forked thread.
2. **`ask_user` lifecycle moves into the SDK branch.** Recognize the existing marker; emit the unchanged
   `ask_user` / `done_waiting` SSE events; complete/flush the SDK session before marking the thread
   waiting; suppress post-question model prose from the founder surface; resume with the founder answer as
   the next SDK prompt. **(Most likely to spawn its own sub-thread — observe this seam hardest.)**
3. **Separate canonical domains, no blurring.** SDK transcript = conversation context/lifecycle;
   `agent_todos` = editable plan; `workspace_files` = workspace; `agent_delegation_runs/steps` +
   `ai_usage_log` = evidence. The transcript is **not** authoritative for the current mutable plan/workspace.
4. **Rehydrate from persisted records.** Reload `agent_todos` + workspace metadata before resumed
   execution; emit initial `todos_updated` / `workspace_updated` snapshots, then retain today's tool-driven
   events. **Minimal functional frontend loading is in-scope** (`VirtualCSOWorkspace.tsx:136` load the
   rows; `virtualCsoApi.ts:712` send `deepMode`) — no redesign; it's real logic, so it carries the test bar.
5. **Demarcate the fallback.** SDK Deep Mode must **never** read/write `deep_resume_state`; it is retained
   exclusively for the dark hand-rolled fallback / Path A. Authority selection is explicit (SDK session
   pointer when the SDK/model-driven gate applies; legacy resume only on the fallback path).

**Guardrail 1 — spike the resume mechanic on the DEPLOYED CLI first.** Before building the full adapter,
prove `SessionStore` + `resume=` + `fork_session=true` actually round-trip **on the deployed runtime**, not
just per the docs. (The per-agent `timeout` key was doc-valid but rejected by the deployed CLI and broke
delegation — same class of risk.) Report the spike result before the full build.

**Guardrail 2 — RESOLVED 2026-07-23** (`04B-E-GUARDRAIL-2-DESIGN.md`, v0.6.118). Single authority per
path, not a third overlapping store: `vcso_chat_messages` = curated founder-visible reload/recovery ledger;
new backend-only **`vcso_sdk_session_entries`** = machine continuation authority for model-driven Deep Mode
(raw transcript), linked to the initiating founder message via `turn_message_id`; `deep_resume_state` =
Path A/legacy fallback only, never read/written by SDK Deep Mode. **Resumed SDK turns do NOT re-inject
`vcso_chat_messages`** — the SDK session supplies prior context (the anti-double-bookkeeping property).
Adapter exists only when `deepMode=true` and the founder-only model-driven gate selects SDK. Raw
transcripts: RLS + service-role-only, not exposed to the Data API.
**Two build-time notes (not blockers):** (a) give `vcso_sdk_session_entries` a retention/TTL or explicitly
defer it — don't let raw transcript grow unbounded; (b) the migration must actually enable RLS + omit
anon/authenticated grants + keep the table out of the exposed schema — verify, don't assume the new default.

## Steps

### A. Map sessions to Deep Mode (SDK-E1/E2)
1. Adopt SDK sessions for Deep Mode threads (resume/fork). Route the `ask_user` pause/resume through the
   session layer: a paused thread resumes with full context on the next founder message.
2. Reconcile against the existing `_persist_deep_resume` / `_deep_resume_state` path — subsume it into
   sessions where the SDK covers it; keep only what the SDK does not. Demarcate explicitly; no silent overlap.

### B. Plan + workspace persistence (SDK-E3/E4)
1. Keep `agent_todos` (the visible plan) and `workspace_files` as the persisted surfaces; ensure they
   rehydrate on session resume. Emit `todos_updated` / `workspace_updated` SSE events as today.
2. Verify **no double bookkeeping** — resume state lives in one place, not in both SDK sessions and the
   hand-rolled deep-resume rows.

## Watch-out (hard-won this migration)
This is the **same live-vs-persisted class of bug that bit the M4 nested surface (reload)** — the state
that renders in-flight is not the state that survives a reload. **Prefer zero-canary verification:** prove
resume by **reloading persisted data** (pause a thread, reload, confirm plan + workspace + context
rehydrate) before any live-turn canary. Code-verified ≠ observed. Reconcile at the persistence boundary,
not just the in-flight path.

## Key files (recon-confirmed pointers, 2026-07-23)
```
python-backend/services/
  vcso_sdk_config.py:247    ClaudeAgentOptions — add resume / fork_session / session_store here (none today)
  vcso_sdk_loop.py:2250     SDK session id captured from ResultMessage; :1961 Path A (do not prune)
  vcso_chat_service.py:623  Deep Mode EXCLUDED from SDK path today (`and not deep_mode`) — the gate to open
  vcso_chat_service.py:888  legacy resume: reloads history, injects founder answer as synthetic tool result
  vcso_chat_service.py:985  ask_user handled ONLY in legacy branch today (move into SDK branch)
  vcso_chat_service.py:2494 deep_resume_state write (legacy authority — becomes dark-fallback-only)
  vcso_chat_service.py:794  session id written into completed delegation run
  tool_registry.py:1426     agent_todos (canonical editable plan); :1485 workspace_files (canonical)
  main.py                   session manager; SSE (todos_updated / workspace_updated)
frontend: VirtualCSOWorkspace.tsx:136 (load todos/workspace rows); lib/virtualCsoApi.ts:712 (send deepMode)
Supabase (pwacpjqkntnovndhspxt): vcso_chat_threads.deep_resume_state, vcso_chat_messages (211 rows),
  agent_todos, workspace_files, agent_delegation_runs/steps, ai_usage_log
```

## Acceptance criteria (Process Rule 10 — N consecutive, not one green)
0. **Guardrail 1 — PASSED 2026-07-23.** Deployed-CLI resume spike round-tripped on SDK `0.2.118` / CLI
   `2.1.209` (head `da59d904`), under an ephemeral `CLAUDE_CONFIG_DIR` so resume/fork could not ride a
   local transcript cache: create (7 entries) → resume (same session id, all 7 loaded) → fork (14 entries,
   new session id). The CLI contract is proven; the **Supabase-backed adapter is still the build** (needs
   founder isolation + guardrail-2 resolution — the spike used a stand-in store, not the founder store).
1. A Deep Mode thread pauses on `ask_user` and resumes with full context via the SDK session; plan +
   workspace intact. **Gate method (London, 2026-07-23, decouple + one E2E confirm):**
   - **Reload-first N=3 — DONE** (zero-canary; 3 threads each rehydrated transcript/todos/workspace/session
     pointer/pending question with `deep_resume_state IS NULL`).
   - **Resume-seam N=3** — consecutive deterministic-deep canaries driven through the **real chat request
     endpoint with `deep_mode=true`** (the production request lifecycle, NOT a bounded harness window and
     NOT the UI toggle). A bounded harness window terminated the turn before `ask_user` (run
     `9bf568cc`, status `cancelled`, 2026-07-23) — the real endpoint runs long-lived and reaches the pause
     naturally. Each canary: endpoint call with `deep_mode=true` → turn reaches `ask_user` and persists the
     pause → follow-up founder message → resume with context/plan/workspace intact, `deep_resume_state`
     untouched. Each must pass the fail-closed guard (`verify_phase_e_canary.py`: `deep_mode=true`,
     `sdk_phase=04B-E`, SDK session pointer, pending-question state).
   - **≥1 full end-to-end UI confirm** — one Deep Mode pause/resume driven through the founder UI (the
     new-chat toggle latch was a real defect, fixed v0.6.124/`951e7d30`; both Composer branches now carry
     the Deep Mode contract, regression-locked), so the real founder path is proven, not just the seam.
   The live round-trip is where the M4-class bug hid, so it keeps its own explicit count — not "bounded
   evidence." A single failure resets the count and is surfaced, not retried blind.
2. One resume authority — the hand-rolled deep-resume path is subsumed or explicitly scoped; no
   conflicting state (observation-backed, not inferred).
3. `agent_todos` + `workspace_files` rehydrate on resume; SSE `todos_updated`/`workspace_updated`
   unchanged for the frontend.
4. Founder isolation intact; every claim paired to `ai_usage_log` / delegation rows. Path A intact.
5. `compileall` clean; frontend green; `ROADMAP.md`/`STATE.md` + `04B-E-COMPLETION.md` updated;
   flags re-darkened, read back off. STOP-and-review read-back to London.

## Locks to preserve
Founder isolation; one-writer (feed OS Engine, never write the wiki); bounded non-recursive workers;
Claude-lock (Sonnet compose / Haiku workers via MA-06 tier map); no founder-facing model selector; curated
transparency. **INFRA:** never lose `MCP_TOOL_TIMEOUT=240000`; single-process only (`TURN_REGISTRY` is
process-global — no `WEB_CONCURRENCY`/`--workers`); do not re-add the per-agent `timeout` key. Version-tags
forward (PATCH default; MINOR/MAJOR are London's call).

## Out of scope
Live MCP (F); generalization + cutover (G). This phase reconciles session/resume mechanics only.
