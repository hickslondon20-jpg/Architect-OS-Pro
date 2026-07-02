# Phase 5 Context — Sandbox Infrastructure

**Written:** 2026-07-01, by the Orchestration Agent, after `05-RESEARCH.md` and a live web-documentation
verification pass on `llm-sandbox` itself (not just the project's own planning docs — this library was
never actually inspected in detail before now). GCP prerequisite (project `architectos-sandbox`, billing
attached, Cloud Shell session authenticated) confirmed live with London this same session.

---

## 1. Domain

Stand up a real, reachable GKE Autopilot cluster; author and push a custom sandbox container image
carrying the document-generation/calculation Python libraries; and wire the Railway Python backend to
create, reuse, and tear down sandbox sessions against that cluster, with state persisting across multiple
calls inside one conversation thread. Traces SANDBOX-01, SANDBOX-02, SANDBOX-04.

## 2. Decisions — locked vs. new-this-phase vs. open for checkpoint

**Locked (carried from project `CONTEXT.md` §1, §12 and `05-RESEARCH.md` — not reopened):**
- GKE Autopilot only. No Docker-in-Docker, no Podman — architecturally unavailable on Railway.
- One cluster. A second (staging) cluster is deferred (SANDBOX-05, v2).
- Reached via `llm-sandbox`'s Kubernetes backend, not a hand-rolled Kubernetes client integration.
- Service-account JSON key stored as a Railway secret env var — matches every other credential in this
  stack. Workload Identity Federation explicitly deferred (not justified at founder-only beta scale).
- Region: `us-west2` (Los Angeles) — confirmed against Railway's actual deployed region (`us-west2`, not
  just the earlier "closest to California" recommendation) and consistent with the Supabase project's own
  region (`us-west-2` AWS, confirmed live via the Supabase MCP `list_projects` call this session).
- GCP project: **`architectos-sandbox`**, brand new, no prior GCP usage in this stack.

**Confirmed live this session (2026-07-01), not previously nailed down:**
- Project `architectos-sandbox` exists, `gcloud config set project architectos-sandbox` succeeded (the
  "Regional Access Boundary... Account not found" lines in the Cloud Shell output are a harmless
  org-policy probe unrelated to this account/project — not a real error, confirmed by the immediately
  following "Updated property [core/project]" success line).
- Billing is attached and active: `gcloud billing projects describe architectos-sandbox` returned
  `billingEnabled: true`, linked to billing account `01E433-5C540A-FA541C`.
- **London is working from Cloud Shell, not a local `gcloud` install.** This matters structurally — see
  §2a below.

### 2a. New this session: the credential-handoff mechanism (recommended, needs checkpoint confirmation)

`05-RESEARCH.md` assumed an execution agent would work against "an authenticated `gcloud` session" without
specifying whose. We now know that session is **Cloud Shell** — a browser-tied session under London's own
login, structurally identical to the git-push situation from the deployment saga: an execution agent's own
sandbox cannot reach it, the same way it cannot run `git push` directly.

**Recommended pattern (mirrors the git-push precedent exactly — propose at checkpoint, don't treat as
locked):**
1. London runs a short, one-time **bootstrap** command block in Cloud Shell (enable APIs, create an
   Artifact Registry Docker repo, create a scoped `phase5-bootstrap` service account, generate its JSON
   key). This is the one irreducible manual step — same shape as "she runs the git commands herself."
2. She hands that key to the execution agent's own environment (e.g., saves it as a **gitignored** file
   inside the repo working directory, never committed — a service-account key is a credential, not
   something that belongs in git history even briefly).
3. From there, the execution agent activates that service account in its own shell
   (`gcloud auth activate-service-account --key-file=...`) and does the rest — cluster creation, image
   build/push via Cloud Build (not local `docker build`, see §2b), a second narrower-scoped runtime
   service account for Railway — non-interactively, scripted, verifiable. Only that narrower runtime key
   goes into Railway; the bootstrap key is deleted once Phase 5 closes (`gcloud iam service-accounts
   keys delete`), not left lying around.

This keeps the "reproducible, auditable, not manual Console clicking" property `05-RESEARCH.md` already
wanted, without assuming false Cloud Shell reachability. Flag this explicitly at the checkpoint — it's an
operational/security-shaped decision, not purely technical.

### 2b. New this session: image build must use Cloud Build, not local Docker

The same reasoning that rules out Docker-in-Docker for the *sandbox execution* target (no Docker socket on
Railway) also rules out `docker build`/`docker push` as the mechanism for producing the custom sandbox
*image* — whichever environment runs the build (execution agent's own sandbox, or Cloud Shell) is not
guaranteed to have a Docker daemon either. **Decision: use `gcloud builds submit` (Cloud Build)** to build
directly from the Dockerfile and push straight to Artifact Registry — no local Docker daemon required
anywhere in the chain. This is the standard GCP-native path and was not previously considered in
`05-RESEARCH.md`, which only mentioned "build and push the custom image" without specifying the mechanism.

### 2c. New this session: `InteractiveSandboxSession`, not plain `SandboxSession`, satisfies SANDBOX-02

Live-fetched `llm-sandbox`'s own documentation (`configuration/`, `interactive-sessions/` —
`vndee.github.io/llm-sandbox`) rather than assuming from the project's prior planning language
("IPython-kernel-per-thread pattern," `CONTEXT.md` §2). Confirmed directly:

- `llm_sandbox.InteractiveSandboxSession` is a **named, purpose-built class** — "maintains a persistent
  IPython interpreter inside the sandbox... state persists across multiple `run()` calls," explicitly
  supports the Kubernetes backend (`backend=SandboxBackend.KUBERNETES, kube_namespace=...`). This is not
  something to hand-roll on top of the plain `SandboxSession` — it already exists.
- Regular `SandboxSession`'s own "Session Persistence" doc section (`keep_template=True,
  commit_container=True`) is a **different, unrelated feature** — it commits container state as a reusable
  *image* for future *separate* sessions, not the same live session persisting across calls. Do not confuse
  the two; `InteractiveSandboxSession` is the one Phase 5 needs.
- Architecture, per the library's own docs: a runner script starts an IPython interpreter inside the
  container; commands/results move through a file-based JSON queue
  (`/sandbox/.interactive/commands/`, `/sandbox/.interactive/results/`) that the host polls. State survives
  as long as the underlying pod (and its IPython process) stays alive.
- **Correction, post-execution (2026-07-01): the "resilient to Railway backend restart" claim above was
  wrong — struck through in spirit, corrected here rather than silently edited away.** The actual built
  `SandboxService` (05-03) keeps the live `InteractiveSandboxSession` client object in an in-process
  Python dict (`self._sessions: dict[str, InteractiveSandboxSession]`), keyed by `thread_id`. If the
  Railway process restarts, that dict is empty again — even though the underlying pod may still be
  `Running`, the service does **not** attempt a stateless reattach; `_get_or_create_session` finds no
  cached client, treats the `sandbox_sessions` row as stale (`stale_or_missing_process_session`), tears
  the old pod down, and starts a fresh one. This was a deliberate, correctness-preserving choice by the
  execution agent (attempting to reattach without the original client object was judged unsafe) —
  verified end-to-end live: two `session.run()` calls within one unbroken process lifetime *do* share
  state (`set ok` → `state persisted`, confirmed against a real pod), and an out-of-band-killed pod is
  detected and recovered from gracefully rather than hanging. **The real, load-bearing guarantee is:
  state persists across calls within the same conversation thread only as long as the Railway backend
  process itself doesn't restart in between.** Phase 7 needs to design around this explicitly — e.g.
  surfacing to the founder when a sandbox session was silently reset, rather than assuming SANDBOX-02's
  guarantee is unconditional. `sandbox_sessions` is still valuable as an audit/observability record and
  for reattach-when-possible, just not as a hard cross-restart persistence guarantee.
- **New finding, post-execution: `llm-sandbox`'s default Kubernetes file-copy path (used internally to
  upload the interactive runner script and exchange the command/result JSON queue) was not reliable
  against this cluster.** The built `SandboxService` works around this with a narrow subclass
  (`KubernetesInteractiveSandboxSession`, overriding `_upload_runner_script`) that writes/reads those
  small files via in-pod `python -c`/`cat`-style exec commands instead of the library's default copy
  mechanism. Confirmed working end-to-end in the live smoke test. Carry this forward as a known,
  load-bearing implementation detail for Phase 7 — don't assume the stock `InteractiveSandboxSession`
  file-copy path works unmodified against this cluster if any Phase 7 code touches that layer directly.
- **Kubernetes custom pod manifests have mandatory, easy-to-get-wrong requirements**, called out as
  "Critical" in the library's own docs, worth stating as a hard constraint the same way the FastAPI
  204/`response_model=None` gotcha was called out in the deployment saga: `tty: true` on the container
  (its absence is the #1 cause of "pod exits immediately"), and `securityContext` with `runAsUser`/
  `runAsGroup` set at **both** the pod level and the container level (its absence is the #1 cause of
  permission-denied errors). Both are required simultaneously, not either/or.
- `skip_environment_setup=True` should be passed once the custom image is built and referenced by full
  Artifact Registry path — this skips the library's default per-session `pip install`/venv bootstrap,
  which is the right call for a production image that already has every library baked in (pandas,
  python-docx, python-pptx, openpyxl, matplotlib, numpy — SANDBOX-04). Confirmed this is the documented
  "recommended for production deployments" path, not a corner cut.

### 2d. Session registry: reuse `vcso_chat_threads.id`, add one new table

Confirmed live via the Supabase MCP (`list_tables`) rather than assumed: `vcso_chat_threads` (2 rows) and
`vcso_chat_messages` (2 rows) already exist and are exactly the "conversation thread" concept SANDBOX-02's
success criteria refer to ("...within the same conversation thread"). No existing table tracks
sandbox/pod sessions — this is genuinely new structure, consistent with the "reuse before creating"
principle (an existing concept is reused as the *key*; a new table is justified because nothing existing
tracks pod lifecycle).

**Decision:** a new `sandbox_sessions` table — `id`, `thread_id` (FK → `vcso_chat_threads.id`), `pod_name`,
`kube_namespace`, `status` (`active`/`closed`/`expired`), `created_at`, `last_active_at`. The Python
backend's sandbox service looks up `sandbox_sessions` by `thread_id` on every `execute_code`-shaped call:
found + `active` → reattach to the existing pod; not found → create a new `InteractiveSandboxSession`
against the cluster and insert a row. This is metadata only — the actual state lives in the pod's IPython
process, per §2c.

**TTL cleanup (this is SANDBOX-01/02's own success criterion #5, "idle sessions cleaned up after a defined
TTL," not a deferred item):** an in-process `asyncio` background sweep task inside the FastAPI app (started
on `startup`, matching how the rest of `python-backend/` is already structured — no new infra, no N8N
cron). Default idle TTL: **20 minutes** since last activity — a reasonable gap for a chat conversation
pause without being wasteful of Autopilot compute billing. Sweep closes the `InteractiveSandboxSession`
(tears down the pod) and marks the row `expired`. This is a default, not a locked number — flag it as
adjustable at the checkpoint if London wants a different value.

## 3. Canonical Refs

- `.planning/skills-sandbox/CONTEXT.md` §1, §2, §12 — GKE Autopilot decision, real-time-calc use case,
  governing "reuse before creating" principle.
- `.planning/skills-sandbox/REQUIREMENTS.md` — SANDBOX-01, SANDBOX-02, SANDBOX-04.
- `.planning/skills-sandbox/ROADMAP.md` — Phase 5 section, all 5 success criteria.
- `05-RESEARCH.md` (this folder) — live-codebase verification, what London needs to do vs. what an
  execution agent can script.
- `PYTHON-BACKEND-DEPLOYMENT.md` — the deployment-saga lessons this phase must not rediscover the hard
  way: verify pushes actually land on `origin/main`; check env var names against `core/config.py`'s
  `validation_alias` directly; the 204/`response_model=None` FastAPI gotcha; Cloudflare edge-caching
  `api.architectospro.com` (append `?nocache=` when verifying live state); this agent's sandbox cannot
  delete/rename files in the connected repo folder — London runs any delete/rename herself.
- `llm-sandbox` documentation, fetched live this session: `vndee.github.io/llm-sandbox/configuration/`
  (Kubernetes backend, custom pod manifest requirements, `skip_environment_setup`, Cloud Build-style
  custom image pattern) and `vndee.github.io/llm-sandbox/interactive-sessions/`
  (`InteractiveSandboxSession`, architecture, backend support, resource/timeout config). Read these
  directly rather than re-deriving from memory — the execution agent should do the same before writing
  the sandbox service wrapper, since exact method names (`.open()`/`.close()` vs. context-manager-only
  lifecycle) were not fully confirmed and need a direct check against the installed package version.

## 4. Code Context

- `python-backend/core/config.py` — `Settings` (pydantic-settings, `ARCHITECTOS_*` validation-alias
  convention). New GKE-related settings belong here: cluster name, GCP project ID, GCP region, Artifact
  Registry image reference, service-account key (path or raw JSON via Railway env var), idle TTL minutes.
  Follow the exact `Field(default=..., validation_alias="ARCHITECTOS_...")` pattern already in use — do
  not invent a different config-loading mechanism.
- `python-backend/requirements.txt` — currently missing `kubernetes`, `google-cloud-container` (only
  needed if cluster *discovery* happens at runtime — likely not needed if the cluster's kubeconfig/
  endpoint is supplied directly via env var instead), and `llm-sandbox[k8s]` (per the library's own
  install instructions, not bare `llm-sandbox`). Also note (flagged, not this phase's job to fix):
  `openai==1.59.7` is still listed — `CLAUDE.md` Rule #2's "openai is dead code" applies to the frontend
  npm package; the Python backend's `openai` usage is for embeddings/metadata extraction (still active,
  per `PYTHON-BACKEND-DEPLOYMENT.md`'s own env-var table) — do not remove it as part of this phase, it's
  a different, still-live dependency.
- `python-backend/services/skill_draft_synthesis.py` — the closest existing precedent for "a service class
  wrapping an external client, constructed via `from_env()` reading `core/config.py`'s `Settings`." The new
  sandbox service should follow this exact shape: a class taking its dependencies (K8s/llm-sandbox client
  config) via constructor, a `from_env()` classmethod, methods that raise a domain-specific error type
  (mirroring `SkillDraftSynthesisError`) rather than leaking raw exceptions.
- `python-backend/main.py` line 487 (`app.include_router(skills.router, prefix="/api/skills", ...)`) —
  the mounting precedent for wherever this phase's verification/smoke-test route (if any) gets exposed.
  Note `require_ingest_secret` (line 470) is the existing auth dependency pattern for any new route.
- Supabase: `vcso_chat_threads` / `vcso_chat_messages` confirmed live (2 rows each) — the thread-id
  concept SANDBOX-02 keys off. No migration needed for these; only the new `sandbox_sessions` table needs
  one, following the existing `docs/migrations/NNNN_description.sql` naming convention (see
  `009_sub_agent_orchestration.sql` for a recent precedent of a small, focused new-table migration).
- No `Dockerfile` exists anywhere in the repo yet (confirmed in `05-RESEARCH.md`) — this phase authors the
  first one, for the sandbox image specifically. It should NOT live at repo root (that space is implicitly
  reserved for the frontend/Vercel build) — put it at `python-backend/sandbox-image/Dockerfile` or similar,
  clearly scoped, not confusable with a future backend-service Dockerfile if Railway's own build config
  ever needs one.

## 5. Specifics

This phase splits into three plans, in order:

**05-01 — GCP Bootstrap & Cluster Provisioning.** The credential-handoff bootstrap (§2a): London runs a
short Cloud Shell command block (enable Kubernetes Engine API, Compute Engine API, Artifact Registry API,
IAM API, Cloud Build API; create the Artifact Registry Docker repo; create the `phase5-bootstrap` service
account with scoped roles and generate its key); hands the key to the execution agent; the agent activates
it and provisions the GKE Autopilot cluster (`gcloud container clusters create-auto`) plus a second,
narrower-scoped runtime service account (`roles/container.developer` minimum) whose key is the one that
ultimately goes into Railway. Ends with the bootstrap key deleted.

**05-02 — Custom Sandbox Image.** Author `python-backend/sandbox-image/Dockerfile` (base `python:3.11-slim`
or similar, `tty`-compatible base — verify against the pod-manifest requirements in §2c since the base
image itself doesn't need to set `tty`, that's a pod-spec concern, but the image does need the actual
Python interpreter at a predictable path per the library's "Custom Image Requirements" for
`skip_environment_setup=True`); install pandas, python-docx, python-pptx, openpyxl, matplotlib, numpy
(SANDBOX-04); build and push via `gcloud builds submit` to the Artifact Registry repo from 05-01 (§2b) —
no local Docker build anywhere in this chain.

**05-03 — Python Backend Integration.** New `services/sandbox_service.py` (or similar; mirror
`skill_draft_synthesis.py`'s shape) wrapping `llm_sandbox.InteractiveSandboxSession` against the
Kubernetes backend, `skip_environment_setup=True`, the pushed custom image, and the mandatory pod-manifest
requirements from §2c. New `sandbox_sessions` migration + table (§2d). Session lookup/reattach-by-
`thread_id` logic. The idle-TTL background sweep task (§2d, default 20 minutes, wired into FastAPI's
`startup`/`shutdown` lifecycle). New `requirements.txt` entries (`llm-sandbox[k8s]`, `kubernetes` if
needed) and new `core/config.py` settings, all `ARCHITECTOS_*`-prefixed per convention. A verification
path — likely a narrow, ingest-secret-gated smoke-test route — that independently proves cluster
reachability, pod create/run/teardown, and two-call state persistence (Phase 5's actual success criteria
2 and 4), not just code that compiles.

## 6. Deferred (explicitly not this phase's job)

- Artifacts/delivery UX (Phase 6) — this phase proves the sandbox *runs*, not that its output reaches a
  founder anywhere.
- `execute_code`/`read_skill_file` tool wiring on the Virtual CSO (Phase 7) — this phase builds the sandbox
  service in isolation, verified via its own smoke-test path, not yet called from chat.
- A second (staging) GKE cluster (SANDBOX-05, v2, no beta demand).
- Container/session pooling for cold-start latency (SANDBOX-06, v2 — revisit only if real usage data shows
  it's actually a problem).
- Multi-language sandbox support (SKILL-11, v2 — Python only for beta; also, per §2c, only Python is
  currently supported by `InteractiveSandboxSession` at all, regardless of ArchitectOS's own scoping).
- Workload Identity Federation (explicitly deferred in `05-RESEARCH.md` — JSON key in Railway env var is
  the beta-scale answer).

---
*Context written: 2026-07-01 — Orchestration Agent, post-research (including live `llm-sandbox`
documentation verification and live GCP/Supabase state checks), pre-checkpoint.*
