# Skills & Sandbox Build — Orchestration Handoff (Phase 5 onward)

> Copy everything below this line into a new Claude Code / Cowork session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **Orchestration Agent** for the "Agent Skills & Document Generation Engine" build (Episode 4
of ArchitectOS Pro's intelligence layer initiative), continuing work from a prior orchestration thread
that completed Phases 1–4 and started Phase 5. Your job: break `.planning/skills-sandbox/ROADMAP.md`'s
remaining phases (5, 6, 7) into buildable phase folders (RESEARCH.md, CONTEXT.md, PLAN.md,
EXECUTION-AGENT-PROMPT.md), one phase at a time, with an alignment checkpoint with London before each
execution agent thread opens. You do **not** write production code, deploy infrastructure, or spin up
execution agents yourself — separate threads (run by London) execute your prompts and report back, and
you independently re-verify their claims against the live Supabase project, GitHub, Railway, Vercel, and
codebase before marking anything done. This verification discipline caught real, load-bearing bugs in
every prior phase — do not relax it.

## Orient yourself first (read in this exact order)

1. `.planning/skills-sandbox/ORCHESTRATION-AGENT-PROMPT.md` — the original thread-initiating brief;
   explains the full mandate and working style this build has followed since the start.
2. `.planning/skills-sandbox/REQUIREMENTS.md`, `CONTEXT.md`, `ROADMAP.md`, `STATE.md` — canonical
   project docs. `CONTEXT.md` has the governing decisions and rationale (read in full, not skimmed — it
   explains *why*, which matters for judgment calls). `STATE.md` is the live status log; `ROADMAP.md` has
   phase-by-phase success criteria, several amended post-completion.
3. `.planning/skills-sandbox/PYTHON-BACKEND-DEPLOYMENT.md` — **read this in full before anything else.**
   It documents a significant, hard-won deployment saga that just concluded: the Python backend had never
   actually been deployed anywhere, then had a wrong-port config, a domain conflict with the main app
   domain, and a FastAPI startup crash, all found and fixed in sequence. The lessons in there (below) are
   not optional background — they will recur.
4. `CLAUDE.md` (repo root) — Critical Architecture Rule #1 was revised 2026-07-01: N8N is no longer the
   default for all synthesis; direct-Anthropic calls colocated in a Python backend service are the
   sanctioned default now (proven pattern: `doc_wiki_synthesis.py`, `kb_explorer_service.py`,
   `skill_draft_synthesis.py`).
5. `.planning/skills-sandbox/phases/05-sandbox-infrastructure/05-RESEARCH.md` — Phase 5's research file,
   including confirmed decisions and open items (below).
6. `.planning/skills-sandbox/phases/04-skill-creation-library-ui/` — read this folder as a reference for
   how a full phase (RESEARCH → CONTEXT → PLAN → EXECUTION-AGENT-PROMPT → refinement) has been run in this
   build; Phase 5 should follow the same shape.

## What's done (Phases 1–4, all independently re-verified, not just reported)

Skills schema and storage foundation, persistent tool memory (shared with KB Explorer), skill
discovery/routing (`@slug` explicit invocation + ranked `classify()`), and the full Skill Creation &
Skills Library UI — including a refinement pass that migrated the AI-guided skill-drafting flow off an
N8N-webhook dependency onto a direct Python-backend Anthropic call, and added search + a "use skill"
insert-into-composer action to Virtual CSO's ChatRail. All of this is confirmed **actually live** as of
2026-07-01 — see the next section for why that confirmation was non-trivial.

## The deployment saga — critical operational lessons, do not rediscover these the hard way

1. **The repo was not being pushed.** For an unknown stretch of time, 407 changed/untracked files
   (essentially all of Phases 1–4's backend code, migrations, and planning docs) existed only in the
   local working directory and were never committed or pushed to GitHub. `origin/main` was frozen at an
   early "pre-launch" snapshot. This is why the deployed Railway backend only exposed 3 routes long after
   Phase 4 was supposedly "done." **Standing rule going forward: never consider any execution agent's work
   confirmed until you've verified it reached `origin/main`** (`git ls-remote origin main` compared
   against local `HEAD`, or equivalent) — local file correctness is necessary but not sufficient.
2. **This agent's sandbox cannot delete or rename files in this connected repo folder.** Confirmed
   repeatedly (a stale `.git/index.lock`, and even a brand-new empty scratch file, both failed to `rm`
   with "Operation not permitted"). This means you **cannot run `git commit`, `git push`, or `git rm`
   yourself** — London must run these from her own machine (PowerShell or GitHub Desktop; she has both
   available and used both during the last saga). You *can* create and edit files normally (Write/Edit
   tools work fine) — only deletion is blocked. Plan your asks of London accordingly: batch up file edits,
   then hand her a clean, short git command sequence to run herself.
3. **Environment variable names must match exactly what `python-backend/core/config.py` expects**, not
   the frontend's `VITE_`-prefixed names. Two real mismatches were found and fixed: `SUPABASE_URL` (not
   `VITE_SUPABASE_URL`) and `ARCHITECTOS_INGEST_SECRET` (not `ARCHITECTOS_WEBHOOK_SECRET`). The second one
   is worth internalizing — `main.py`'s `require_ingest_secret` dependency *silently no-ops* when the
   correctly-named variable is absent (`if settings.ingest_secret and ...`), meaning a misnamed secret
   doesn't fail loudly, it just leaves ~30 endpoints wide open with no authentication at all. Always check
   variable names against `core/config.py`'s `validation_alias` values directly, never assume.
4. **Domain routing:** `architectospro.com` and `www.architectospro.com` → Vercel (the main app). Only
   `api.architectospro.com` → this Railway backend service. If a custom domain ever needs reconfiguring,
   never point the bare apex at Railway — that's the main app's domain.
5. **Cloudflare edge-caches GET responses on `api.architectospro.com`.** When checking the live backend
   externally (e.g. `/openapi.json`), a stale cached copy can persist well after a real deploy — always
   append a cache-busting query param (`?nocache=<anything>`) when verifying post-deploy state, or you'll
   draw the wrong conclusion. A Cloudflare cache-bypass rule for this subdomain is a queued, non-blocking
   cleanup item.
6. **FastAPI gotcha, already fixed once, could recur in new code:** a route decorated
   `status_code=status.HTTP_204_NO_CONTENT` with a bare `-> None` return-type annotation and no explicit
   `response_model=None` will crash the **entire app** at startup in this FastAPI version (`0.116.1`) —
   not just that one route. Route registration happens once at import time, so one bad route takes down
   every route, including ones that worked fine before. If Phase 5+ work adds any `204`-status routes,
   check for this pattern before it ships.
7. Two harmless, still-unresolved cleanup items from the same commit: a `temp_superpowers` directory
   tracked as a dangling git submodule reference (mode `160000`, no `.gitmodules` entry), and a stray
   0-byte `scratch_delete_test.tmp` file. Neither blocks anything; fold into a future cleanup commit
   whenever convenient.

## Where Phase 5 (Sandbox Infrastructure) actually stands right now

`.planning/skills-sandbox/phases/05-sandbox-infrastructure/05-RESEARCH.md` is written. Confirmed decisions
(London signed off 2026-07-01):

- **GKE Autopilot**, reached via `llm-sandbox`'s Kubernetes backend — not Docker-in-Docker (unavailable on
  the current hosting stack). One cluster is sufficient; a second (staging) cluster is explicitly deferred.
- **Brand-new GCP project** — no existing GCP usage anywhere in this stack before now.
- **Service-account JSON key as a Railway secret env var** — matches the existing credential pattern for
  every other secret in this stack. Workload Identity Federation was considered and explicitly deferred as
  unjustified at founder-only beta scale.
- **Region: `us-west2` (Los Angeles).** This was originally a recommendation based on Railway's workspace
  default ("US West, California"), and has since been **directly confirmed** — the actual deployed Railway
  service's region is `us-west2`, visible in its deployment details. Use this region with confidence, not
  as a guess.
- **Sequencing: parallel track.** London creates the GCP project, attaches billing, and authenticates
  `gcloud` locally; the Orchestration Agent writes `CONTEXT.md`/`PLAN.md` in parallel; an execution agent
  does the scripted GCP bootstrapping (API enablement, cluster creation, service account, image
  build/push) as the *first task inside Phase 5's execution*, not a separate pre-phase.

**Not yet done, and the first thing to check with London:** whether she has actually created the GCP
project, attached billing, and run `gcloud auth login` locally yet — this got set aside while the Python
backend deployment saga took over the thread. Check in on this status before writing `CONTEXT.md`/`PLAN.md`
in earnest; if it's still pending, that's fine (parallel track means you can keep drafting), but don't
assume it's done.

## Your immediate next steps

1. Confirm you've read everything in "Orient yourself first" above.
2. Ask London for a quick status check on the GCP account/billing/`gcloud auth` prerequisite (see above).
3. Write `.planning/skills-sandbox/phases/05-sandbox-infrastructure/CONTEXT.md` and the `PLAN.md` file(s)
   for Phase 5 — the decisions are already locked (see above), so this should be a more direct write than
   Phase 4's was, not another round of open questions unless something genuinely new comes up.
4. Produce `EXECUTION-AGENT-PROMPT.md` for Phase 5 once the plan is checkpointed with London, following the
   same pattern as prior phases (see Phase 4's for reference) — and explicitly fold in the "deployment
   saga" lessons above as constraints/warnings for whoever executes it (especially: verify pushes actually
   land on `origin/main`, and check env var names against `core/config.py` directly rather than assuming).
5. After Phase 5 is executed and independently re-verified, Phases 6 (Artifacts & Delivery Experience) and
   7 (Sandbox Tool Integration) follow the same process, per `ROADMAP.md`.

## Process rules (unchanged from the start of this build)

- One phase at a time; each completes fully before the next begins.
- Alignment checkpoint between phases — discuss specs and cross-cutting concerns before an execution agent
  spins up.
- Reuse before creating — check existing infrastructure (skills, sandbox, KB Explorer, wiki layers) before
  adding anything new.
- Execution agents are separate threads, each pointed at its phase's plan files.
- Independent re-verification of every completion report against live systems, not just the report's own
  word — this is the single most validated habit from this entire build so far.
- Use `AskUserQuestion` for genuine open decisions only London can make; don't gate on it for things you
  can verify or reasonably default.
