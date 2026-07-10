# Skills & Sandbox Build — Phase 5 (Sandbox Infrastructure) Execution Agent Prompt

> Copy everything below this line into a new Claude Code / Cowork session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **execution agent** for Phase 5 (Sandbox Infrastructure) of the ArchitectOS Agent Skills &
Document Generation Engine build. Three plans, in order: **05-01 (GCP bootstrap & cluster)** →
**05-02 (custom sandbox image)** → **05-03 (Python backend integration)**. You make implementation
choices, never design choices. If something needs a design decision beyond the inputs below, **stop and
flag it** — the same discipline every prior phase in this build has followed.

**This phase is different from Phases 1–4 in one important way: it provisions real, billed cloud
infrastructure that didn't exist before this build, not just code against an already-live Supabase
project.** Read everything below carefully — there is more operational risk here (cost, credentials,
irreversible cluster/IAM state) than in any prior phase.

## Orient first (read these, in order)

1. `.planning/skills-sandbox/phases/05-sandbox-infrastructure/05-RESEARCH.md` — live-codebase
   verification: no `llm-sandbox`/Kubernetes/GCP code exists anywhere yet, no `Dockerfile` exists, what
   London needs to do vs. what you can script.
2. `.planning/skills-sandbox/phases/05-sandbox-infrastructure/CONTEXT.md` — every decision this phase
   implements, including four things confirmed or discovered *this session* that go beyond the original
   research: (§2a) the credential-handoff pattern London confirmed (bootstrap-key handoff — **not**
   step-by-step Cloud Shell copy-paste), (§2b) image builds go through Cloud Build, not local Docker,
   (§2c) `llm_sandbox.InteractiveSandboxSession` — a named, specific class, fetched live from the
   library's own docs — is what satisfies session persistence, not a hand-rolled pattern, (§2d) the new
   `sandbox_sessions` table design and the 20-minute idle TTL (confirmed by London this session).
3. `05-01-PLAN.md`, `05-02-PLAN.md`, `05-03-PLAN.md` (same folder) — the three build specs, in order.
   **05-01 requires London to run a Cloud Shell command block before your part of that plan can start —
   check whether she's already done this before beginning; if not, that's the first thing to coordinate,
   not something to work around.**
4. `.planning/skills-sandbox/CONTEXT.md` §1, §2, §12 — the project-wide decisions this phase implements
   (GKE Autopilot only, one cluster, real-time-calc use case, "reuse before creating").
5. `.planning/skills-sandbox/PYTHON-BACKEND-DEPLOYMENT.md` — **read this in full.** It documents the
   deployment saga that just concluded on the Railway side, and every lesson in it applies here too (see
   "Hard constraints" below for the specific carry-forward items).
6. `python-backend/services/skill_draft_synthesis.py` — the structural precedent for the new sandbox
   service (class + `from_env()` classmethod + domain-specific error type).
7. The `llm-sandbox` documentation directly, at the URLs cited in `CONTEXT.md` §3 and §2c —
   `vndee.github.io/llm-sandbox/configuration/` and `.../interactive-sessions/`. **Fetch these yourself
   and check them against the actual installed package version** — `CONTEXT.md` flags that exact method
   names for the interactive-session lifecycle (opening/closing outside a single `with` block, which this
   phase needs since a session must survive across separate HTTP requests) were not independently
   confirmed against installed source, only against the hosted docs.

## What you build

### 05-01 — GCP Bootstrap & Cluster Provisioning (do first)
Coordinate with London on the Cloud Shell bootstrap block (Part A of the plan file) if he hasn't run it
yet. Once you have the bootstrap service account key, activate it in your own shell and provision: the
GKE Autopilot cluster, a second narrower-scoped `sandbox-runtime` service account, verify reachability
using the *runtime* account specifically (not the bootstrap one), then delete the bootstrap
account/key. Report the runtime key back to London to add to Railway — you do not have Railway access.

### 05-02 — Custom Sandbox Image
Author `python-backend/sandbox-image/Dockerfile` (pandas, numpy, python-docx, python-pptx, openpyxl,
matplotlib, **plus ipython/ipykernel** — required for `InteractiveSandboxSession`'s runner, not in the
original SANDBOX-04 library list but load-bearing per `CONTEXT.md` §2c). Build and push via
`gcloud builds submit` — never local `docker build`. Verify every library actually imports inside a real
running pod built from the pushed image, not just that the build succeeded.

### 05-03 — Python Backend Integration
New `services/sandbox_service.py` wrapping `InteractiveSandboxSession` against the Kubernetes backend,
authenticating from just the JSON service-account key (no `gcloud` CLI at Railway runtime — build a
`kubernetes.client.Configuration` from a GCP bearer token + the cluster's endpoint/CA cert, refreshing the
token since it expires hourly). New `sandbox_sessions` migration/table, keyed by `vcso_chat_threads.id`.
Idle-TTL sweep task (20 minutes, confirmed default). A verification route that proves two-call state
persistence against the real cluster — this is the actual proof of Phase 5's hardest success criterion,
not something to fake with a mock.

## Hard constraints

- **No `docker build`/`docker push` anywhere in this phase.** Railway has no Docker socket (the same
  constraint that rules out Docker-in-Docker for sandbox *execution* also applies to wherever *you* run
  build commands). Use `gcloud builds submit` for the image (05-02) — see `CONTEXT.md` §2b for why this
  isn't optional.
- **Service-account keys are credentials, not repo content.** Confirm `.gitignore` excludes
  `python-backend/.secrets/` as your literal first action in 05-01, before you ever request or handle a
  key. Never commit a key file, even transiently.
- **One GKE cluster, one region (`us-west2`).** Do not create a second cluster "just to test" — if you
  need to iterate, tear down and recreate the same cluster, or ask London before deviating.
- **Scoped IAM roles only — no Owner/Editor, on either service account.** If a specific `gcloud` command
  fails on a permissions error, add the specific missing role and note it; don't escalate broadly to make
  an error go away.
- **This agent's sandbox cannot delete or rename files in the connected repo folder** — confirmed
  repeatedly during the Python backend deployment saga (`PYTHON-BACKEND-DEPLOYMENT.md`). If you need a
  file deleted (e.g. the local bootstrap key JSON after 05-01 step 5), ask London to do it herself rather
  than assuming `rm` will work.
- **Never consider a claim confirmed until independently re-verified against the live system** — same
  standing discipline as every prior phase. "The `gcloud` command didn't error" is not the same as "the
  cluster is `RUNNING`" or "the pod actually executed code and was torn down." Check with a second,
  independent command (`describe`, `kubectl get`, an actual round-trip through the verification route),
  not just the first command's own exit status.
- **Cloudflare edge-caches `api.architectospro.com` GET responses** — if this phase's verification route
  is ever checked externally through that domain (unlikely for this phase, since verification runs
  locally against the cluster, but worth remembering going into Phase 7), append `?nocache=` when
  checking live state.
- **Check env var names against `core/config.py`'s `validation_alias` values directly** before assuming
  a Railway env var is correctly wired — the `SUPABASE_URL`/`ARCHITECTOS_INGEST_SECRET` naming mismatches
  from the deployment saga were silent failures, not loud ones. Apply the same care to
  `ARCHITECTOS_GKE_SERVICE_ACCOUNT_KEY` and the other new settings in 05-03 Part B.
- **A route with `status_code=204` and a bare `-> None` return annotation crashes the entire FastAPI app
  at startup** in this FastAPI version (0.116.1) unless `response_model=None` is also set. This phase's
  verification route is a `POST` returning a body, so it likely doesn't hit this — but check any route you
  add against this pattern before shipping, since one bad route takes down every route.

## Done when

All success criteria across all three plan files are met, independently re-verified (not just the
`gcloud`/`kubectl`/test-route output taken at face value once). Specifically: the cluster is reachable
using only the runtime service-account key (no CLI, no kubeconfig file); a real pod runs the real pushed
image and all required libraries import inside it; a variable set in one call is readable in a second,
later call against the same `thread_id`; idle sessions actually expire and their pods actually disappear;
a pod killed out-of-band is recovered from gracefully rather than hanging.

Report back: a one-paragraph summary; confirmation of each plan's success criteria; the exact final env
var names added to `core/config.py` (for London to set in Railway, alongside the runtime service-account
key from 05-01); confirmation the bootstrap service account and its local key file no longer exist (or,
if the file couldn't be deleted due to the sandbox restriction, an explicit note asking London to delete
it); and anything about the `InteractiveSandboxSession` lifecycle API (open/close outside a `with` block)
worth flagging for Phase 7, which will be the first phase to call this service from a real, multi-turn
Virtual CSO conversation. Then stop — Phase 6 (Artifacts & Delivery Experience) is opened from the
orchestration thread, not by you.
