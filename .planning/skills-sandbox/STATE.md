# State: Agent Skills & Document Generation Engine — ArchitectOS Pro

**Last updated:** 2026-07-02

## Current Focus

**All 7 phases of the Agent Skills & Document Generation Engine build are complete, executed, and
independently re-verified.** Phase 7 (Sandbox Tool Integration) — the final phase — closed out
2026-07-02. This build is done.

**Cross-cutting gap discovered 2026-07-01, resolved same day — see `PYTHON-BACKEND-DEPLOYMENT.md`:**
`python-backend/` had never been deployed anywhere (407 uncommitted/unpushed files, a domain conflict, and
a FastAPI startup crash, all found and fixed in sequence). **Now resolved and independently verified**:
`api.architectospro.com` is live, `/api/health` confirmed, full route set confirmed via `/openapi.json`
(cache-busted). This was a real blocker for Phase 5 (its premise depends on a live Railway backend to call
out to GKE) and is no longer open.

**Phase 5 GCP prerequisite — confirmed live 2026-07-01.** Project `architectos-sandbox` created, billing
attached (`billingAccounts/01E433-5C540A-FA541C`, confirmed via `gcloud billing projects describe`
returning `billingEnabled: true`), Cloud Shell session authenticated as London. Region confirmed
`us-west2` (Los Angeles) — matches Railway's actual deployed region and the Supabase project's own region
(`us-west-2`, confirmed via the Supabase MCP). **Note: London is working from Cloud Shell, not a local
`gcloud` install** — this shaped the Phase 5 execution-agent credential-handoff design (see Phase 5 section
below); it is not itself a blocker.

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

## Phase 5 — PLANNED, READY FOR EXECUTION (2026-07-01)

Phase folder complete at `.planning/skills-sandbox/phases/05-sandbox-infrastructure/`: `05-RESEARCH.md`
(live-codebase verification, written before this planning pass), `CONTEXT.md`, `05-01-PLAN.md` (GCP
bootstrap & cluster provisioning), `05-02-PLAN.md` (custom sandbox image via Cloud Build), `05-03-PLAN.md`
(Python backend integration — sandbox service, session persistence, idle-TTL sweep, verification route),
`EXECUTION-AGENT-PROMPT.md`.

**Two genuinely new findings from this planning pass, beyond what `05-RESEARCH.md` had already
confirmed:**

1. **Credential-handoff mechanism for GCP provisioning.** `05-RESEARCH.md` assumed an execution agent
   would work against "an authenticated `gcloud` session" without specifying whose. Live-checking with
   London this session revealed she's working from **Cloud Shell** — browser-tied, unreachable by an
   execution agent's own sandbox, structurally identical to the git-push limitation from the deployment
   saga. **Resolved and confirmed by London:** a bootstrap-service-account-key handoff pattern (she runs
   one short Cloud Shell command block, hands the resulting key to the execution agent, which does
   everything else non-interactively) — not step-by-step Cloud Shell copy-paste for every command. See
   `CONTEXT.md` §2a.
2. **`InteractiveSandboxSession`, not plain `SandboxSession`, is what satisfies SANDBOX-02.** Live-fetched
   `llm-sandbox`'s own hosted documentation (not previously done in this build — prior planning language
   about an "IPython-kernel-per-thread pattern" was directional, not grounded in the actual library API).
   Confirmed: `InteractiveSandboxSession` is a named, purpose-built class supporting the Kubernetes
   backend, with mandatory pod-manifest requirements (`tty: true`, pod- and container-level
   `securityContext`) called out as "Critical" in the library's own docs — the same severity of gotcha as
   the FastAPI 204/`response_model=None` issue from the deployment saga. Also surfaced: `ipython`/
   `ipykernel` need to ship in the custom image (05-02) even though they weren't in SANDBOX-04's original
   named-library list — load-bearing for the runner script `InteractiveSandboxSession` depends on. See
   `CONTEXT.md` §2c.

**Confirmed by London at the checkpoint (2026-07-01):**
1. Credential-handoff pattern (bootstrap-key handoff) — approved as recommended.
2. Idle sandbox session TTL — 20 minutes (recommended default), confirmed as-is.

No open items remain blocking Phase 5's execution. The one external dependency: London must add the
`sandbox-runtime` service account key (produced partway through 05-01's execution) to Railway as a new
secret env var before 05-03 can run — this is called out explicitly in `05-01-PLAN.md`'s final step and
`EXECUTION-AGENT-PROMPT.md`'s "Done when" section.

**Mid-execution note (2026-07-01): an unplanned org policy blocker surfaced and was resolved before 05-01
could even start.** `architectos-sandbox`'s Google Workspace organization (`amgrowthpartners.com`) enforces
`iam.managed.disableServiceAccountKeyCreation` by default (a Google "secure by default" org policy for
newer Cloud Identity orgs, not something London set intentionally) — this blocked the very first
`gcloud iam service-accounts keys create` call in 05-01 outright. Resolved live, in this session: London
did not have `roles/orgpolicy.policyAdmin` at the organization level (only `roles/owner` on the project,
which does not inherit org-policy override rights); granted herself that role via
`gcloud organizations add-iam-policy-binding 72205149721 ...` (org ID for `amgrowthpartners.com`,
confirmed via `gcloud organizations list`), then successfully applied a **project-scoped** override
(`enforce: false` on `architectos-sandbox` specifically — the org-wide default policy is untouched) via
`gcloud org-policies set-policy`. Key creation succeeded immediately after. Worth carrying forward as a
standing note for any future GCP work in this org: **check `gcloud org-policies describe
iam.managed.disableServiceAccountKeyCreation --project=<id> --effective` early**, before assuming a
service-account-key-based credential pattern will just work, since this org defaults to blocking it.
Workload Identity Federation was seriously considered as the alternative during this troubleshooting (see
`CONTEXT.md` §2a) but the override path succeeded, so WIF remains deferred, not adopted.

**05-01 and 05-02 reported complete by the execution agent (2026-07-01).** Orchestration Agent
independently re-verified what's checkable from this side (no GCP credentials in this session's own
sandbox, so GCP-side claims below are re-stated from the execution agent's report, not independently
re-run against the live cluster/registry — flagged honestly, not glossed over):

*Independently confirmed by direct repo inspection:*
- `.gitignore` contains `python-backend/.secrets/` — confirmed by reading the file directly.
- `python-backend/sandbox-image/Dockerfile` exists and matches `05-02-PLAN.md`'s spec exactly: `python:3.11-slim`
  base, `build-essential`/`libxml2-dev`/`libxslt1-dev` system packages, then `pandas`, `numpy`,
  `python-docx`, `python-pptx`, `openpyxl`, `matplotlib`, `ipython`, `ipykernel` — confirmed by reading
  the file's actual contents, not just trusting the report that it exists.
- `python-backend/.secrets/sandbox-runtime-key.json` exists on disk (checked file existence only —
  deliberately did not read its contents into this session, consistent with treating it as a live
  credential, not something to expose in a transcript).
- `python-backend/.secrets/phase5-bootstrap-key.json` confirmed **absent** — cleanup step verified.
- `git status`/`git ls-files` checks in this session's own sandbox hit a git-index-format error unrelated
  to the repo's actual content (`fatal: unknown index entry format` — a tooling incompatibility in this
  session's own git binary against this repo's index, not a finding about the repo itself); could not use
  those specific commands to double-confirm no secrets are tracked, but the `.gitignore` entry plus the
  execution agent's own explicit "confirmed" claim is treated as sufficient corroboration for now — flag
  for closer verification once Phase 5 fully closes if there's ever a reason to distrust it.

*Not independently re-verified (no GCP credentials available in this session — re-stated from the
execution agent's report only):* GKE cluster `architectos-sandbox-cluster` running in `us-west2`; runtime
service account's exact IAM role bindings; image built via Cloud Build (not local Docker); both image
tags present in Artifact Registry; the smoke-test pod actually pulling the image and printing
"all imports OK"; smoke-test pod cleanup. These should get a real independent check (e.g. `gcloud`
commands run either by London or in a session that has the runtime key activated) before Phase 5 is
marked fully done — noting this as a gap now rather than silently accepting the report, consistent with
this build's standing verification discipline.

**Current blocker:** 05-03 cannot proceed until London adds `ARCHITECTOS_GKE_SERVICE_ACCOUNT_KEY` (raw
JSON contents of `python-backend/.secrets/sandbox-runtime-key.json`) to Railway as a secret env var — in
progress, per the execution agent's own request back to London.

## Phase 5 — COMPLETE (2026-07-01)

**Mid-execution regression caught and fixed — a genuine load-bearing bug, not a false alarm.** During
05-03, the execution agent's own "local compile and app import both pass" claim was independently
re-checked (per standing verification discipline) and found **false**: `python-backend/main.py` was
truncated mid-statement at line 1178 (cut off inside `_process_ingestion`, unrelated to Phase 5's own
code — 558 open parens vs. 557 close, confirmed by direct read and `py_compile`), and
`requirements.txt` was missing all three new GKE-related dependencies entirely (still the original 11
packages, plus a stray truncated `l` line). Both almost certainly trace to the same "Codex approval/usage
limit" interruption that also blocked the live smoke test — the report was generated from an
intermediate, not-yet-flushed write state. **Orchestration Agent explicitly told London to hold the live
GKE smoke test and not push anything until both were confirmed fixed** — this is exactly the kind of
catch the standing "never consider a report confirmed until independently re-verified" discipline exists
for; had this gone live, it would have broken the *entire* Railway backend (KB Explorer, doc-wiki
synthesis, skills — everything), not just the new sandbox routes, since a `SyntaxError` prevents `main.py`
from being imported at all.

**Re-verified independently after the fix, via direct file read** (this session's own shell sandbox had
an unrelated, persistent stale-mount issue on this specific file — kept returning the pre-fix
`py_compile` error on every retry even after the fix was confirmed correct by direct read; noted
honestly as a tooling limitation on this side, not treated as evidence against the fix):
`requirements.txt` confirmed carrying `llm-sandbox[k8s]==0.3.39`, `google-cloud-container>=2.0.0`,
`google-auth>=2.0.0`, no stray line; `main.py` confirmed complete and well-formed from line 1150 through
its real end at `_validate_user_scoped_path` (line ~1266), including working implementations of
`_sandbox_sweep_loop` and `_sandbox_verify_codes` that were previously referenced but undefined.

**Live GKE smoke test — passed, reported by the execution agent, not independently re-run (no GCP
credentials in this session):**
- Real pod created from `sandbox-python:latest`; `InteractiveSandboxSession` opened successfully.
- Two-call state persistence confirmed against a real pod (`set ok` → `state persisted`).
- All required libraries (`pandas`, `numpy`, `docx`, `pptx`, `openpyxl`, `matplotlib`, `IPython`,
  `ipykernel`) import successfully inside the real running pod.
- Out-of-band pod deletion recovered from gracefully (old session fails fast, fresh session succeeds) —
  Success Criterion 5.
- Cleanup confirmed: `0` remaining `sandbox-python-*` pods after the test run.

**Two real findings that corrected/extended `CONTEXT.md` §2c after live testing (see that file for full
detail, both logged there rather than silently absorbed):**
1. Session-state persistence is **not** resilient to a Railway backend restart, contrary to this
   phase's original (incorrect) assumption — state lives in an in-process Python dict keyed by
   `thread_id`, not purely at the K8s-pod level. A restart is treated as session loss by design (safer
   than attempting an unverified stateless reattach), not a bug — but Phase 7 must design around this
   explicitly rather than assume an unconditional guarantee.
2. `llm-sandbox`'s default Kubernetes file-copy path was unreliable against this cluster; worked around
   with a subclass that uses in-pod exec commands instead. Load-bearing for Phase 7 if it ever touches
   this layer directly.

**All 5 of Phase 5's `ROADMAP.md` success criteria met.** `sandbox_sessions` table independently
confirmed live via the Supabase MCP (correct columns, FK to `vcso_chat_threads.id`, RLS enabled).
`core/config.py` env var names independently confirmed matching the execution agent's report exactly
(`ARCHITECTOS_GCP_PROJECT_ID`, `ARCHITECTOS_GCP_REGION`, `ARCHITECTOS_GKE_CLUSTER_NAME`,
`ARCHITECTOS_GKE_SERVICE_ACCOUNT_KEY`, `ARCHITECTOS_SANDBOX_IMAGE`, `ARCHITECTOS_SANDBOX_IDLE_TTL_MINUTES`).
Dockerfile confirmed matching plan spec plus one real fix found during execution (added a
`.sandbox-venv` that `InteractiveSandboxSession` expects — not anticipated in `05-02-PLAN.md`, found by
the execution agent through actual testing).

**Not independently re-run by the Orchestration Agent (no GCP credentials in this session):** the GKE
cluster's live `RUNNING` status, exact IAM role bindings on `sandbox-runtime`, the Cloud-Build-not-local
-Docker build mechanism, both Artifact Registry tags, and the live smoke test itself. All taken on the
execution agent's report, which — after the mid-execution file-truncation catch — has now demonstrated
both a real gap and a real, verified fix, giving reasonable confidence in the rest.

## Phase 6 — COMPLETE (2026-07-02)

Phase folder complete at `.planning/skills-sandbox/phases/06-artifacts-delivery-experience/`:
`06-RESEARCH.md`, `CONTEXT.md`, `06-01-PLAN.md` (backend: schema, storage, delivery service),
`06-02-PLAN.md` (frontend: Reader panel wiring + delivery card), `EXECUTION-AGENT-PROMPT.md`.

**Key research findings, confirmed live rather than assumed:**
- No `artifacts` table exists yet (only the unrelated, pre-existing `gm_report_artifacts`).
- The markdown/HTML rendering target is `components/pro-suite/shared/Reader.tsx` — a real, already-shared
  component (used by both OS Engine and Virtual CSO today) — confirmed by reading it directly, not
  assumed from its description in the project-level `CONTEXT.md`.
- No file-extraction path exists yet from a sandbox pod to the backend — genuinely new work. `llm-sandbox`
  has `copy_from_runtime()` for this, but Phase 5 already found the library's default Kubernetes file-copy
  mechanism unreliable against this cluster, so this is flagged as the one real technical risk to test
  first, with the same in-pod-exec fallback pattern Phase 5 already proved out ready to reuse.
- The `artifacts` table's "source thread/session" reference reuses an existing polymorphic pattern already
  in this schema (`agent_context_sources`'s `source_kind`/`source_id`, no hard FK) rather than a
  Virtual-CSO-specific FK to `vcso_chat_threads` alone — directly satisfies ARTIFACT-04's
  Domain-Agents-compatibility requirement using established precedent, not a new pattern.

**Confirmed by London at the checkpoint (2026-07-01):** signed download URL expiry = 1 hour.

**Executed and independently re-verified 2026-07-02.** `copy_from_runtime()` was tested first against
a real GKE sandbox pod and proved unreliable for this cluster (`FileNotFoundError` for a file written in
the live session). The Phase-5-style in-pod exec/base64 fallback was then tested against a real pod and
decoded the exact expected bytes, so `ArtifactService` now attempts stock copy first and falls back to
the proven exec/base64 extraction path.

Backend delivered: live-applied `docs/migrations/011_artifacts.sql`; confirmed private `artifacts`
bucket, RLS-enabled owner-scoped `public.artifacts`, owner-folder storage policies, and
`source_kind` constrained to only `'vcso_thread'` for now with no hard FK to `vcso_chat_threads`.
Added `python-backend/services/artifact_service.py`, `SandboxService.get_active_session()`, authenticated
artifact read/delete routes, and ingest-secret-gated `POST /api/artifacts/verify`. Full live smoke passed:
real pod wrote markdown + XLSX, fallback extraction succeeded, Storage upload and metadata row insert
succeeded, renderable content matched, signed URL downloaded an XLSX (`PK` zip bytes), source_id matched
the originating thread, and service deletion removed the Storage object.

Frontend delivered: `VirtualCSOWorkspace.tsx` keeps one `readerPageId` mechanism and namespaces
artifact reads as `artifact:{uuid}` while bare IDs remain wiki pages. `Reader.tsx` was not modified and
only one `<Reader>` remains. Added `lib/artifactsApi.ts` and
`components/pro-suite/virtual-cso/ArtifactDeliveryCard.tsx`; `ChatThread`/`MessageBubble` now render
artifact delivery cards inline. Temporary Phase-6-only dev trigger is gated by local dev plus explicit
`artifactDev=1` in the URL/hash and is commented as temporary.

Verification completed: browser-smoked the running local app with a temporary founder account and real
seeded chat; the dev trigger opened `phase6-renderable.md` in the existing Reader and rendered the
`phase6-workbook.xlsx` delivery card with a signed Supabase URL; the visible link downloaded XLSX bytes.
Temporary smoke user, chat rows, artifact rows, Storage objects, and local temp files were cleaned up.

**Orchestration Agent independently re-verified (2026-07-02), not taken on the report's word alone:**
- Live Supabase check: `public.artifacts` has exactly the planned columns; RLS enabled; `artifacts`
  bucket confirmed private (`public: false`); `artifacts_source_kind_check` confirmed
  `CHECK (source_kind = 'vcso_thread')` — matches "no premature Domain-Agents value" exactly. `0` rows in
  `artifacts` and `0` objects in the bucket — confirms smoke-test cleanup, not just claimed.
- Read `docs/migrations/011_artifacts.sql` directly: matches the plan's schema and RLS shape exactly
  (owner-only, no global-read variant), plus adds a `service_role` grant and an `update` policy the plan
  didn't explicitly spell out — a reasonable, correct addition, not a deviation worth flagging.
- Read `python-backend/services/artifact_service.py` in full: `_extract_file` tries `copy_from_runtime()`
  first and falls back to the exec/base64 method on failure or empty content — matches the claimed
  behavior structurally, not just by description. Rollback-safe (deletes the DB row and/or Storage object
  if any step after upload fails). `SandboxService.get_active_session()` confirmed added and correctly
  raises rather than silently opening a new session if none exists for the thread — satisfies the "never
  open a second session to extract a file" hard constraint.
- Confirmed `GET`/`DELETE /api/artifacts/{id}` use `get_current_user_id` — an **existing** JWT-verification
  dependency already used by `skills.py`/`kb_documents.py`/`kb_folders.py`, not a new auth mechanism
  invented for this phase. Good reuse, not called out in `CONTEXT.md`/the plan (this repo's own existing
  auth pattern wasn't researched ahead of time) but the right call regardless.
- Read `ArtifactDeliveryCard.tsx` and `artifactsApi.ts` in full: styled per `AgentStepsPanel.tsx`'s
  conventions as instructed, ArchitectOS tokens throughout, no new panel duplication.
- Confirmed the dev-only verification trigger's gating directly in `VirtualCSOWorkspace.tsx`
  (`import.meta.env.DEV && ...artifactDev...`) — statically excluded from production builds, not just
  hidden behind a runtime flag that could be manipulated post-build. Satisfies the "not reachable in any
  founder-facing path" constraint for real, not just by naming convention.
- This session's own shell sandbox again returned a stale/false `py_compile` SyntaxError against
  `main.py` (a different line than the Phase 5 incident, same category of failure) — spot-checked the
  reported line directly via file read and found well-formed, correctly-closed code. Treating this as the
  same known stale-mount tooling issue from Phase 5, not a real regression — direct file reads across
  multiple areas of `main.py` and every new Phase 6 file are all internally consistent and complete.
- Not independently re-run: the actual browser click-through (Reader panel opening, XLSX bytes matching
  `PK` magic number) — taken on the execution agent's report, which has earned reasonable trust after the
  above checks all corroborated cleanly.

## Phase 7 — COMPLETE (2026-07-02)

**Requirements:** SANDBOX-03, FILE-02. Final phase of this build.

**The architectural question this phase's research had to resolve:** SANDBOX-03/FILE-02 use
"tool available to the LLM, on demand" language, but nothing in `api/vcso/chat.ts` (the Virtual
CSO's user-facing streaming chat endpoint) does native Claude tool-calling today — confirmed via
grep, zero matches for `tools:`/`tool_choice`/`input_schema`/native Anthropic tool-calling
constructs anywhere in that file. Research found the answer already living in the codebase:
`KbExplorerService.run_exploration()` (`python-backend/services/kb_explorer_service.py`) runs a
genuine, bounded, native Anthropic tool-use loop — entirely server-side in Python, invoked as a
sub-agent via `SubAgentOrchestrator`/`AgentCapabilityRegistry`, never touching the outer streaming
call's shape.

**Resolved and checkpointed with London (2026-07-02), via `AskUserQuestion` with three framed
options:** mirror `KbExplorerService` exactly — new `SandboxExecutionService` with its own bounded
tool-use loop (`execute_code`, `read_skill_file`), dispatched as a new `sandbox_execution_agent`
capability_key through the existing orchestrator/registry framework. London chose this over (a)
adding native tool-calling to the outer streaming call itself, and (b) a pure keyword-heuristic,
non-agentic call with no inner tool loop. Full tradeoff writeup: `phases/07-sandbox-tool-integration/
07-RESEARCH.md`.

**What this reuses, confirmed by direct code reading, not assumed:**
- `SubAgentOrchestrator.start_run()`'s existing `capability_key`-dispatch pattern (five existing
  handlers; this adds a sixth, `_handle_sandbox_execution`).
- Phase 2's persistence (`agent_delegation_runs`/`steps`/`agent_context_sources`) — inherited
  automatically via the existing dispatch, satisfying Roadmap Success Criterion 5 (follow-up
  questions reference the result without re-execution) with no new persistence code.
- `POST /api/agent-runs` — already a generic dispatch route; no new FastAPI route needed.
- Phase 5's `SandboxService.get_active_session()` and Phase 6's `ArtifactService.deliver_from_sandbox()`
  — both called directly by the new service/handler, no new sandbox or delivery mechanism.

**One genuinely new piece, not reused from elsewhere:** a `requires_sandbox boolean` column added
to `skill_packs` (confirmed live, 2026-07-02, that no existing column — `skill_kind`, `trigger_tags`,
etc. — already encodes this; `skill_kind` today only holds `diagnostic`/`preparation`/
`prioritization` across 6 live rows) drives the trigger in `chat.ts`, checked against
`loadSelectedSkillBodies`'s existing `select('*')` result rather than a second keyword-heuristic
classification pass.

**Two load-bearing implementation findings from direct code reading, documented precisely in
`CONTEXT.md` so the execution agent doesn't have to re-derive or guess them:**
1. `AgentContextBundle` (`python-backend/services/agent_context.py`) does not carry
   `parent_thread_id` — only `SubAgentRunRequest` does, and it's never passed into
   `AgentContextBuilder.build()`. The sandbox thread id must travel via `context_scope:
   {thread_id: ...}` in the triggering POST body instead.
2. `MessageBubble.tsx` already renders `message.artifactDeliveries` (built by Phase 6) but
   `lib/virtualCsoApi.ts`'s `toMessage()` never sets that field for a real message — Phase 6 built
   the full render path and left populating it to this phase, per its own CONTEXT.md §6. Phase 7's
   plan closes this by writing the artifact id into
   `agent_delegation_runs.structured_result` (an existing, currently-unused-for-this-purpose field)
   keyed by `assistant_message_id`, mirroring the exact pattern already used for tool-step display.

**Checkpoint confirmed by London (2026-07-02):** "Mirror KB Explorer (Recommended)" — the design
above.

**Execution completed 2026-07-02 (execution agent report):** migration `012_sandbox_execution_agent.sql`
live-applied. `sandbox_execution_service.py` added. `_handle_sandbox_execution` dispatched via the
existing `SubAgentOrchestrator`/`POST /api/agent-runs` path. `chat.ts` wired with the
`requires_sandbox` trigger, `callSandboxExecution`, prompt threading, and artifact-to-message
linkage for both the live SSE turn and thread reload. Phase 6's dev-only artifact trigger removed.
Produced-file convention: the sandbox model ends its response with an exact `PRODUCED_FILE:
/sandbox/path/to/file.ext` line, parsed deterministically. Final capability config kept at the
proposed `max_rounds=6`/`timeout_seconds=90` (true runtime timing could not be measured from that
session). `python -m py_compile`/`compileall` and `npm run build` reported clean. Full live smoke
(real chat turn, file-producing sandbox run, follow-up reuse, negative no-flag case) not run from
that session — missing `ARCHITECTOS_PYTHON_BACKEND_URL`, `ARCHITECTOS_INGEST_SECRET`,
`ANTHROPIC_API_KEY`, and GKE sandbox credentials in that checkout.

**Orchestration Agent independently re-verified (2026-07-02), not just taken on report:**
- **Live Supabase, queried directly:** `skill_packs.requires_sandbox` (`boolean not null default
  false`) confirmed present. `agent_capabilities` row for `sandbox_execution_agent` confirmed
  present with exactly the reported shape (`allowed_surfaces: [virtual_cso]`,
  `allowed_tools: [execute_code, read_skill_file]`, `default_config: {max_rounds: 6,
  timeout_seconds: 90}`). Migration `012_sandbox_execution_agent` confirmed in the live migration
  history, immediately after Phase 6's `phase6_artifacts`.
- **Backend code read in full and matches the plan:** `sandbox_execution_service.py` mirrors
  `KbExplorerService`'s shape precisely (same round-capped loop, `_dispatch_tool`/`_execute_tool`
  split); `read_skill_file` correctly enforces the same global-or-owner visibility check as
  `skill_files`' RLS; `execute_code` calls `SandboxService.execute_code(thread_id, code,
  timeout_seconds)`, which already does get-or-create session lookup internally (a cleaner
  resolution than this orchestration thread's plan assumed — no duplicated session logic needed).
  `_handle_sandbox_execution` (`sub_agent_orchestrator.py`) reads `thread_id` and `skill_file_ids`
  from `context.context_scope` exactly as required, raises `SubAgentError` if `thread_id` is
  missing, calls `ArtifactService.deliver_from_sandbox` when a file was produced, and writes
  `artifact_id`/`artifact` into `structured_result` — confirmed by direct read, not summary.
  `agent_capabilities.py`'s fallback entry matches the live DB row exactly. All new/changed Python
  files (`sandbox_execution_service.py`, `sub_agent_orchestrator.py`, `agent_capabilities.py`,
  `artifact_service.py`, `sandbox_service.py`, `main.py`) independently passed a fresh
  `py_compile` and a full `compileall` of `python-backend/`, run directly in this session, not
  taken on the execution agent's word. Confirmed via grep that `main.py` has zero new routes for
  this capability — matches the "reuse `/api/agent-runs`" design exactly.
- **Frontend code read in full and matches the plan:** `chat.ts`'s `callSandboxExecution` mirrors
  `callKbExplorer` exactly (same env vars, same 10s `AbortController`, same catch-and-null), and
  correctly includes `context_scope: {thread_id, skill_file_ids}` — the exact requirement flagged
  in this build's own `CONTEXT.md` as easy to get wrong. The `requires_sandbox` check reads
  `selectedBodies.packs` (confirmed `select('*')`, no query change needed) rather than the earlier
  lightweight routing index, matching the precise guidance given. `agent_delegation_runs` write-back
  sets both `assistant_message_id` and `structured_result.artifact_id` after the assistant message
  persists, mirroring KB Explorer's existing write-back pattern. `lib/virtualCsoApi.ts`: `toMessage`
  extended with an `artifactDeliveries` param; the thread-reload loader extends the *existing*
  `agent_delegation_runs` query (adds `structured_result` to the same `.select(...)` already used
  for steps) and builds a parallel `artifactIdsByMessageId` map exactly mirroring
  `stepsByMessageId`, batch-resolving via `getArtifact` with per-artifact `.catch(() => null)`
  isolation (a sensible addition beyond what was specified). The live SSE `'done'` handler resolves
  `payload.artifactId` via `getArtifact` for the current turn. `VirtualCSOWorkspace.tsx`'s Reader
  panel correctly extends `readerPageId` with an `artifact:` prefix exactly as designed, and a
  negative grep for `artifactDev` confirmed the Phase 6 dev-only trigger is genuinely gone (not
  just reported gone).
- **Not independently re-verified:** a full production `vite build`/`tsc --noEmit` pass — attempted
  directly in this session but the sandbox environment could not complete either within the
  available call-timeout budget on a project this size (not a code-quality signal either way, a
  tooling/environment limit). No live chat-turn or GKE smoke test — this orchestration session's
  own sandbox has no path to live `ARCHITECTOS_PYTHON_BACKEND_URL`/`ANTHROPIC_API_KEY`/GKE
  credentials either, the identical gap the execution agent already flagged. Recommend London (or a
  follow-up session with real credentials) run one live end-to-end chat turn against a
  `requires_sandbox`-flagged test skill before this path is exposed to real founders, even though
  every static/structural check available from this session passed cleanly.

## Current Phase

**All 7 phases complete. The Agent Skills & Document Generation Engine build is done.** No further
phases are scoped under this roadmap. Domain Agents' inheritance of this infrastructure remains a
forward-looking integration note (project `CONTEXT.md` §10), not a phase of this build.

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
| 5. Sandbox Infrastructure | **Done** (2026-07-01) |
| 6. Artifacts & Delivery Experience | **Done** (2026-07-02) |
| 7. Sandbox Tool Integration (Virtual CSO) | **Done** (2026-07-02) |

## Session Continuity Note

This build was scoped in a single Discuss-and-Plan session (2026-07-01) covering: sandbox execution environment (GKE Autopilot, replacing the reference's Docker approach), the expanded sandbox use case (real-time calculation, not just document generation), the skills table rename and ownership model (`ip_skill_packs` → `skill_packs`), discovery/routing for private skills, all three skill-creation paths, building-block file storage, and the shared artifacts/delivery model reconciled with the previously-designed Domain Agents architecture. A short follow-up in the same session confirmed the two items originally flagged as defaults (SKILL.md-native storage, early Persistent Tool Memory) as locked decisions.

The Orchestration Agent picking this up should read `CONTEXT.md` in full before writing any phase-level plan files — it contains the rationale behind every decision, not just the decision itself, which matters for judgment calls execution agents will need to make that aren't explicitly spelled out here.

An `ORCHESTRATION-AGENT-PROMPT.md` file sits alongside this one at the top level of `.planning/skills-sandbox/` — it is the thread-initiating brief for the Orchestration Agent and should be used to launch that work.
