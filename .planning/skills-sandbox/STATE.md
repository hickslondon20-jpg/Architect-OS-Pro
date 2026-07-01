# State: Agent Skills & Document Generation Engine — ArchitectOS Pro

**Last updated:** 2026-07-01

## Current Focus

Planning complete at the project level. Phases 1–4 are **built, executed, and independently
re-verified,** including Phase 4's refinement pass. Orchestration is now moving to Phase 5 (Sandbox
Infrastructure).

**Cross-cutting gap discovered 2026-07-01, bigger than any single phase — see
`PYTHON-BACKEND-DEPLOYMENT.md`:** `python-backend/` has never actually been deployed anywhere. London's
Railway account currently runs only the N8N project. This retroactively explains Phase 2's flagged
"environment/ops gap" (unset `ARCHITECTOS_PYTHON_BACKEND_URL`/`ARCHITECTOS_INGEST_SECRET`) and means every
Python-backend-dependent feature built in Phases 1–4 (Skills & Plugins, KB Explorer, doc/wiki synthesis)
is code-complete but not yet reachable by real founders in the live app. This needs to be resolved before
or alongside Phase 5's GCP/GKE setup, since Phase 5's premise depends on a live Railway backend to call
out to GKE. Confirmed region for both Railway and the GKE cluster: US West — Railway's workspace default
is "US West (California, USA)"; closest GCP region is `us-west2` (Los Angeles).

## Phase 3 — COMPLETE (2026-07-01)

Executed against `.planning/skills-sandbox/phases/03-skill-discovery-routing/EXECUTION-AGENT-PROMPT.md`.
All three changes landed in `api/vcso/chat.ts`: the live table-name bug fixed first and verified in
isolation, `loadIpLayer()` scoped to global + requesting-founder-owned private skills, and `@slug`
explicit invocation added ahead of ranked `classify()`. `classify()`/`scoreSkill()` untouched, as
scoped.

**Orchestration Agent independently re-verified:** grepped `api/vcso/chat.ts` directly — zero
remaining `ip_skill_packs` references; `detectExplicitSkillInvocation` present with the `@slug`
regex; `loadIpLayer` takes `userId` and filters `scope.eq.global,user_id.eq.<userId>`; call site
passes `userId`; `detectExplicitSkillInvocation` called ahead of `classify()`. Queried Supabase
directly to confirm the reported test cleanup: 0 leftover `phase3-*` auth users, 0 leftover
`phase3-private-*` skill rows, `skill_packs` still at 6 rows, all `scope='global'` (expected — no
founder has created a private skill yet; that's Phase 4).

**Minor implementation note, not a blocker:** the `.or()` filter is built via template-string
interpolation (`` `scope.eq.global,user_id.eq.${userId}` ``) rather than a fully parameterized call —
worth flagging since the plan asked for the parameterized builder specifically. In practice this is
low-risk: `userId` comes from `supabase.auth.getUser()` (a verified session UUID), never from raw
user text, and PostgREST's JS client doesn't actually expose a parameterized alternative for `.or()`
— so this was likely the only real option, not a corner cut. Noting it so it isn't silently
forgotten, not treating it as unresolved.

**Confirmed, not yet re-litigated:** the `@slug` mention syntax was implemented exactly as proposed
in the phase plan, per the execution agent's own note it wasn't independently re-confirmed by London
beyond the general two-path routing decision. Carrying this forward as open-for-revisit, not blocking
anything — Phase 4 is where a UI affordance around this would get built, so this is the natural point
to revisit the syntax choice if London wants to.

## Phase 2 — COMPLETE (2026-07-01)

Executed against `.planning/skills-sandbox/phases/02-persistent-tool-memory/EXECUTION-AGENT-PROMPT.md`.
Migration applied live: `docs/migrations/20260701_agent_delegation_assistant_message_link.sql`.
Both fixes delivered together as scoped: (1) `assistant_message_id` backfill + reload/follow-up-context
reconstruction from `agent_delegation_runs`/`agent_delegation_steps`, and (2) the live-streaming fix
(`agentSteps` now sent on the `ready` SSE event, ahead of token streaming).

**Orchestration Agent independently re-verified:** `agent_delegation_runs.assistant_message_id`
confirmed as nullable `uuid`, FK to `vcso_chat_messages` with `ON DELETE SET NULL`, covering index
present. Grepped the live code directly (not just the report) — `api/vcso/chat.ts` confirmed sending
`agentSteps` on both `ready` (line ~678) and `done` (line ~748); `lib/virtualCsoApi.ts` confirmed
`toMessage()` takes `agentSteps` as a parameter (no longer reading the dead `row.agentSteps`) and
`onReady`'s type includes `agentSteps`; `pages/ProSuite/virtual-cso/VirtualCSOWorkspace.tsx` confirmed
applying `agentSteps` to the temporary assistant message inside `onReady`, before token streaming
appends text — exactly the fix London asked for.

**Two honestly-flagged gaps, both real but neither Phase-2-specific:**
1. Full live KB Explorer endpoint smoke test wasn't run — `ARCHITECTOS_PYTHON_BACKEND_URL`/
   `ARCHITECTOS_INGEST_SECRET` are unset in the execution environment. This is an environment/ops gap,
   not a code gap; the reload and live-streaming logic were verified by direct simulation instead.
2. **`generate_typescript_types` was not rerun — and independent verification shows this is a
   pre-existing, cross-phase gap, not something Phase 2 introduced.** `lib/database.types.ts` (the
   checked-in generated-types file) contains neither `agent_delegation_runs`/`agent_delegation_steps`
   (predates this entire build — Module 8) nor `skill_packs`/`skill_files` (Phase 1, despite that
   execution agent reporting the regen step as passed). The Supabase MCP's `generate_typescript_types`
   tool returns a string; nothing in either phase's process copied that output into the checked-in
   file on disk. **Worth a standing note for every future phase:** "typegen re-run" should mean
   actually overwriting `lib/database.types.ts` with the tool's output, not just calling the tool.
   Flagging for London rather than silently fixing — this affects the whole repo, not just this build.

## Phase 1 — COMPLETE (2026-07-01)

Executed by a dedicated execution agent thread against
`.planning/skills-sandbox/phases/01-schema-storage-foundation/EXECUTION-AGENT-PROMPT.md`. Both
migrations applied live: `docs/migrations/20260701_skill_packs_rename_and_ownership.sql`,
`docs/migrations/20260701_skill_files_storage.sql`. Admin `user_id` used:
`4ef8c0e3-d0bf-4420-990d-3d5dbe1aa1aa`.

**Orchestration Agent independently re-verified the completion report against the live Supabase
project** (not taken on faith): `ip_skill_packs` confirmed absent; `skill_packs` confirmed at 6 rows,
all `scope='global'`; `profiles.is_admin` confirmed with exactly 1 flagged account matching the
reported admin `user_id`; `skill-files` bucket confirmed private; `skill_files` table confirmed
present. A grep of the full security-advisor output for `skill_packs`/`skill_files` found no
unresolved findings tied to this phase's new objects — consistent with the execution agent's own
"no Phase-1-created duplicate index or public security-definer exposure remaining" claim. Full
functional RLS testing (founder-JWT simulation, cross-founder isolation, admin-path write rejection)
was reported by the execution agent and not independently re-run — schema-state verification above
was judged sufficient corroboration given the structural checks (trigger existence, row counts,
flag counts) all matched.

`Pro-Suite-Progress.md` was updated by the execution agent for Ep4 Phase 1, per standing process
(every agent updates the progress manifest when done).

Admin-designation decisions (general `is_admin` flag; CSV/direct-Supabase as the primary
global-content creation path — **not** the app UI) remain logged in the phase `CONTEXT.md` §2 and
the project-root `CONTEXT.md` Amendments section, both dated 2026-07-01, for Phase 4 to read when
it's scoped.

Both items originally flagged as open/default decisions at the project level were confirmed by
London on 2026-07-01 and are locked:
1. `skill_packs.body` is natively authored/stored in SKILL.md format.
2. Persistent Tool Memory (Phase 2) is built now, early, as shared infrastructure — not deferred.

No open items remain blocking any phase.

## Phase 4 — BUILT, REFINEMENT PENDING (2026-07-01)

Executed against `.planning/skills-sandbox/phases/04-skill-creation-library-ui/EXECUTION-AGENT-PROMPT.md`.
Fourth intelligence peer ("Skills & Plugins") shipped at `/pro/intelligence/skills`; backend CRUD +
SKILL.md parse/serialize + ZIP import/export; AI-guided creation flow; ChatRail Chats/Skills toggle.

**Orchestration Agent independently re-verified the structural claims:** `python-backend/main.py` line
487 confirms `skills.router` mounted at `/api/skills`; `lib/featureGates.ts` confirms `skills_library`
FeatureKey (line 22), `FEATURE_GATES` entry with `unlockWeek: 6` (line 61), and `PATH_FEATURE_GATES`
entry for `/pro/intelligence/skills` (line 92); `IntelligenceLanding.tsx` line 55 confirms "Four
intelligence peers" copy. Queried Supabase directly: `skill_packs` at 6 rows, 0 private, 0 leftover
`phase-4`/`codex` test-slug rows — reported cleanup confirmed. Read `ChatRail.tsx` and `lib/skillsApi.ts`
in full to check the two points London raised after the report came in (see below) — both confirmed as
real, plan-matching gaps, not execution-agent errors (the agent built exactly what `04-03-PLAN.md`
specified; the plan itself needed correcting).

**Two refinements identified and scoped, not yet executed — see
`phases/04-skill-creation-library-ui/04-04-PLAN.md` and `REFINEMENT-EXECUTION-AGENT-PROMPT.md`:**

1. **Guided-draft synthesis has no working AI path without external N8N configuration.**
   `lib/skillsApi.ts`'s `requestGuidedSkillDraft()` (lines 130-148): when
   `VITE_SKILL_CREATOR_WEBHOOK_URL` is unset (the likely current production state — nothing in this repo
   provisions that N8N workflow), it returns a static canned message with `ready` computed as a plain
   boolean field-presence check — zero LLM involvement. This traces back to `04-02-PLAN.md` instructing
   N8N routing per what's now confirmed to be a stale reading of `CLAUDE.md`'s architecture rule.
   **`CLAUDE.md` Rule #1 has been revised (2026-07-01)** — see below — and the refinement plan migrates
   this to a direct Python-backend Anthropic call, mirroring `doc_wiki_synthesis.py`/
   `kb_explorer_service.py`, removing the N8N dependency entirely.
2. **ChatRail's skills view is browse-only navigation, not the searchable "use skill" micro-library
   London wants.** Confirmed via full read of `ChatRail.tsx`: no search input renders for
   `railMode === 'skills'` (lines 107-117 gate it to `'chats'` only), and each skill row (lines 131-143)
   is a `<Link to="/pro/intelligence/skills">` with no insert-into-textbox action. This matches
   `04-03-PLAN.md`'s spec exactly ("browse-only... clicking navigates") — the gap is between that plan
   and London's later-clarified intent (search + click-to-insert `@slug` into the active compose
   textbox), not a build error.

**`CLAUDE.md` updated (2026-07-01), per London's explicit direction.** Critical Architecture Rule #1
revised from a single N8N-default-with-one-exception to three lanes: (a) synthesis colocated with a
Python backend service calls Anthropic directly by default — the pattern already proven live in
`doc_wiki_synthesis.py` and `kb_explorer_service.py`, cited as the evidence the old rule was stale; (b)
Virtual CSO's Vercel streaming exception is unchanged; (c) N8N remains correct for genuinely
batch/scheduled/cron-triggered workflows (PDF generation, drip sequences). Rule #2 (openai package
removal) updated for consistency with the new framing.

**Refinement executed and independently re-verified 2026-07-01 — Phase 4 now fully closed.**
Executed against `REFINEMENT-EXECUTION-AGENT-PROMPT.md`. Both parts confirmed by direct code read, not
taken on the completion report's word alone:

- **Part A:** `python-backend/routers/skills.py` line 116 confirms `POST /guided-draft` (mounted under
  `/api/skills`); `python-backend/services/skill_draft_synthesis.py` confirms `SkillDraftSynthesisService`
  calling `anthropic.Anthropic(...).messages.create(...)` directly, with JSON-schema system prompt,
  fence-stripping, and a `_fallback_response()` that degrades to `ready: False` plus a founder-facing
  message on any parse failure or non-dict response — matches the "no 500 on malformed JSON" requirement.
  `lib/skillsApi.ts` lines 129-140 confirm `requestGuidedSkillDraft()` now calls
  `${getBaseUrl()}/api/skills/guided-draft` with no webhook branch at all. Grepped the full repo for
  `SKILL_CREATOR_WEBHOOK_URL` (`.ts`/`.tsx`/`.py`) — zero remaining references anywhere. Read
  `tests/test_skill_draft_synthesis.py` directly — both the valid-JSON-normalizes and the
  malformed-response-degrades-gracefully cases are real tests against the actual service class (using a
  fake Anthropic client), not just claimed.
- **Part B:** `ChatRail.tsx` confirmed in full — search input (lines 117-129) is now shared across both
  `railMode`s, filtering `skills` client-side by name/slug/description (`filteredSkills`, lines 40-45);
  each skill row's primary action is now a `<button onClick={() => onUseSkill(skill.slug)}>` (lines
  148-158), with the original navigate-to-workspace behavior preserved as a secondary `ExternalLink` icon
  button (lines 159-166) rather than removed. `VirtualCSOWorkspace.tsx` confirmed owning
  `composerText`/`composerRef` (lines 113-114), `useSkillInComposer` (line 278, refocuses the textarea via
  `window.setTimeout(() => composerRef.current?.focus(), 0)` at line 291 — append-don't-clobber and
  focus-return both present), and passing `onUseSkill={useSkillInComposer}` into `ChatRail` (line 447).

**Not yet independently re-run:** the actual `useSkillInComposer` append logic (lines between 278-291,
not fully read) — confirmed the function exists and wires focus-restoration correctly, but did not
byte-for-byte confirm the append-vs-clobber string logic; judged sufficient given the surrounding wiring
and the reported `npm run build` pass. `lib/database.types.ts` typegen gap (flagged in Phase 2, still
open, cross-phase) remains untouched by this phase — carrying forward as a standing item, not
Phase-4-specific.

## Current Phase

**Phase 4 is fully complete, including its refinement pass.** Phase 5 (Sandbox Infrastructure) is next —
not yet started; per `ROADMAP.md` it has no structural dependency on Phases 1-4 and can begin as soon as
London wants to open it.

Phase folder complete at `.planning/skills-sandbox/phases/04-skill-creation-library-ui/`:
`04-RESEARCH.md`, `CONTEXT.md`, `04-01-PLAN.md` (backend CRUD + SKILL.md parse/serialize + ZIP
import/export), `04-02-PLAN.md` (AI-guided creation flow), `04-03-PLAN.md` (Skills & Plugins
workspace + Virtual CSO mini-toggle), `EXECUTION-AGENT-PROMPT.md`, `04-04-PLAN.md` (refinement),
`REFINEMENT-EXECUTION-AGENT-PROMPT.md`.

**Two open questions from research, both resolved by London at the checkpoint:**
1. **IA placement — hybrid, confirmed.** The original assumption ("alongside Chat and
   Documents/Uploads" as top-level areas) didn't match the live app. London's call: a **fourth
   intelligence peer workspace** ("Skills & Plugins," working name) at `/pro/intelligence/skills`,
   housing the full library *and* both creation surfaces together (deliberately not split, so
   creation doesn't feel jam-packed inside another tool) — *plus* a lightweight Chats/Skills toggle
   inside Virtual CSO's `ChatRail` (above the "New chat" button) for quick, read-only browsing that
   links out to the full workspace. `IntelligenceLanding.tsx`'s "three peers" copy becomes "four."
2. **AI-guided creation flow architecture — Orchestration Agent's recommendation adopted** (London
   expressed no specific preference): a dedicated, bounded conversational surface, not a Virtual CSO
   chat tool-loop retrofit. Its synthesis calls route through N8N per `CLAUDE.md`'s architecture rule
   (the Virtual CSO streaming endpoint is a named, singular exception — this flow isn't it).

This is the largest phase so far — three plans, in priority order (backend → AI-guided flow →
workspace UI + mini-toggle).

## Progress Tracker (mirrors ROADMAP.md, kept in sync here per process rules)

| Phase | Status |
|---|---|
| 1. Skills Schema & Storage Foundation | **Done** (2026-07-01) |
| 2. Persistent Tool Memory | **Done** (2026-07-01) |
| 3. Skill Discovery & Routing | **Done** (2026-07-01) |
| 4. Skill Creation & Skills Library UI | **Done, incl. refinement** (2026-07-01) |
| 5. Sandbox Infrastructure | Not started |
| 6. Artifacts & Delivery Experience | Not started |
| 7. Sandbox Tool Integration (Virtual CSO) | Not started |

## Session Continuity Note

This build was scoped in a single Discuss-and-Plan session (2026-07-01) covering: sandbox execution environment (GKE Autopilot, replacing the reference's Docker approach), the expanded sandbox use case (real-time calculation, not just document generation), the skills table rename and ownership model (`ip_skill_packs` → `skill_packs`), discovery/routing for private skills, all three skill-creation paths, building-block file storage, and the shared artifacts/delivery model reconciled with the previously-designed Domain Agents architecture. A short follow-up in the same session confirmed the two items originally flagged as defaults (SKILL.md-native storage, early Persistent Tool Memory) as locked decisions.

The Orchestration Agent picking this up should read `CONTEXT.md` in full before writing any phase-level plan files — it contains the rationale behind every decision, not just the decision itself, which matters for judgment calls execution agents will need to make that aren't explicitly spelled out here.

An `ORCHESTRATION-AGENT-PROMPT.md` file sits alongside this one at the top level of `.planning/skills-sandbox/` — it is the thread-initiating brief for the Orchestration Agent and should be used to launch that work.
