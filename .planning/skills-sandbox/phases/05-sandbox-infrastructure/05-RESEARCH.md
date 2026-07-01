# Phase 5 Research: Sandbox Infrastructure (GKE Autopilot)

**Verified 2026-07-01.** Live-codebase check before any plan file is written, per standing process.

## Current state — confirmed by direct search, not assumption

- No `llm-sandbox`, `kubernetes`, `google-cloud-*`, or GKE-related code exists anywhere in
  `python-backend/` (grepped for `llm_sandbox`, `llm-sandbox`, `kubernetes`, `GKE`, `google-cloud`,
  `google.cloud` — zero matches).
- No `Dockerfile` exists anywhere in the repo — the custom sandbox image (pandas, python-docx,
  python-pptx, openpyxl, matplotlib, numpy) has to be authored from scratch.
- `python-backend/requirements.txt` has no Kubernetes/GCP client libraries yet (`kubernetes`,
  `google-cloud-container`, `llm-sandbox` all need adding).
- `python-backend/.env.example` follows an `ARCHITECTOS_*` naming convention for feature-specific config
  (`ARCHITECTOS_RERANK_ENABLED`, `ARCHITECTOS_WEB_SEARCH_PROVIDER`, etc.) — new GKE-related env vars
  should follow this same convention for consistency.
- Aside, not blocking Phase 5: `requirements.txt` line 7 still lists `openai==1.59.7` as a Python
  dependency — the same "openai is dead code" rule (`CLAUDE.md` Rule #2) that already applies to the
  frontend npm package appears to apply here too. Flagging for a future cleanup pass; not this phase's job.
- Every architectural decision Phase 5 needs was already locked during the original planning session and
  lives in `.planning/skills-sandbox/CONTEXT.md` §1 and §12: GKE Autopilot (not Docker-in-Docker, which
  is unavailable on the current hosting stack), reached via `llm-sandbox`'s Kubernetes backend; one
  cluster is sufficient (a second, staging cluster is explicitly deferred — SANDBOX-05); session
  persistence is required (not optional) because of the real-time calculation use case; Railway keeps its
  current responsibilities and gains one new outbound call path to the GKE cluster.

Nothing here is in question. What Phase 5 actually needs before an execution agent can build **and
verify** it is live GCP infrastructure that doesn't exist yet — that's a different kind of prerequisite
than the previous four phases had (Supabase already existed and was reachable; GCP does not yet exist for
this project).

## What has to exist before Phase 5 can be built and verified

GKE Autopilot is real billed cloud infrastructure. Unlike Phases 1–4 (which all built against an
already-live Supabase project), there is currently no GCP project, no cluster, and no credentials for a
Python backend to call out to. Two things are true at once:

1. **Meaningful work can start right now without the account existing** — this research file, the
   `CONTEXT.md` decision record, and a good chunk of `PLAN.md` (the custom image's Dockerfile contents,
   the session-persistence schema, the service-wrapper code structure) don't need a live cluster to be
   written correctly.
2. **Phase 5's actual success criteria cannot be met or independently verified without it** — "a cluster
   is provisioned and reachable," "`llm-sandbox` creates/runs/tears down a real pod," "a session persists
   across two calls" all require a real cluster to test against. No amount of planning substitutes for
   this.

So this isn't strictly "set it up first" or "wire it later" — it's a parallel-track situation, and the
sequencing below is the fastest path that doesn't waste either side's time.

## The one part that genuinely requires London specifically

Creating a GCP project and attaching a billing account requires her Google identity and payment method —
no agent can do this on her behalf. Everything after that point (enabling APIs, creating the Autopilot
cluster, creating a scoped service account, generating its key, building and pushing the custom image) can
be done as scripted `gcloud`/`kubectl`/`docker` commands by an execution agent, once it has an authenticated
`gcloud` session to work with — which is both faster than manual Console clicking and keeps the setup
reproducible/auditable, consistent with how every other piece of infrastructure in this build has been
handled (migrations tracked as files, not manual Supabase dashboard edits).

### What London needs to do (the irreducible manual part — roughly 5–10 minutes)
1. Create a new GCP project (or designate an existing one, if ArchitectOS already has a GCP account for
   something else — worth double-checking before creating a new one).
2. Attach a billing account to that project.
3. Pick a region. Recommendation: whichever GCP region is closest to wherever the Railway Python backend
   is actually hosted (check Railway's project region setting) — this matters for the real-time
   calculation use case's latency budget (Phase 7, Success Criterion 4).
4. Authenticate `gcloud` locally on her machine (`gcloud auth login`, then `gcloud config set project
   <project-id>`) — a one-time interactive step only she can complete.

### What an execution agent can then do, scripted and verifiable
Once step 4 above is done and the agent has access to that authenticated `gcloud` session:
- Enable required APIs: Kubernetes Engine API, Compute Engine API, Artifact Registry API, IAM API.
- Create the GKE Autopilot cluster.
- Create a scoped service account (`roles/container.developer` at minimum, plus
  `roles/artifactregistry.reader` if the custom image lives in a private Artifact Registry repo) and
  generate its key.
- Create an Artifact Registry Docker repo, build the custom sandbox image, and push it.
- Verify the cluster is reachable and `llm-sandbox` can create/run/tear down a pod against it — the actual
  Phase 5 success criteria.

The resulting service-account key then needs to be added as a new Railway environment variable for the
Python backend — that step is on London (or whoever has Railway access), since I don't have it either.

## Decisions confirmed by London (2026-07-01)

1. **GCP project: brand new.** No existing GCP usage anywhere in the current stack (Vercel, Supabase,
   Railway, N8N) — Phase 5 starts from zero, not a reused account.
2. **Service-account key storage: a simple JSON key as a Railway secret env var.** Matches the existing
   credential pattern for every other secret in this stack (Supabase service role key, Anthropic API key).
   Workload Identity Federation was considered and explicitly deferred — not clearly justified at
   founder-only beta scale; revisit at GA if warranted.
3. **Sequencing: parallel track.** London authenticates `gcloud` locally and creates the GCP
   project/billing now; the Orchestration Agent (this thread) writes `CONTEXT.md`/`PLAN.md` in parallel;
   an execution agent does the scripted GCP bootstrapping (API enablement, cluster creation, service
   account, image build/push) as the *first task inside Phase 5's execution*, not a separate pre-phase.

**Still open, not blocking:** the exact GCP region. Needs London to confirm which region Railway currently
hosts the Python backend in, so the GKE cluster can be created nearby for the real-time-calculation
latency budget (Phase 7, Success Criterion 4). `PLAN.md`'s exact `gcloud` commands will use a placeholder
region until this is confirmed — low-risk to leave open since changing a region flag before the cluster is
actually created costs nothing.
