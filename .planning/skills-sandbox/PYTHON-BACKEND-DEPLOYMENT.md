# Python Backend Deployment — Prerequisite (discovered 2026-07-01)

**Status: not yet deployed anywhere.** London confirmed her Railway account only runs the N8N project
today. `python-backend/` exists as complete, tested code in this repo, but there is no live, publicly
reachable URL for it — it has never been deployed to Railway (or anywhere else).

## Why this matters, honestly stated

Every phase of this build so far (1–4) verified backend code by reading it, compiling it
(`python -m compileall`), and running direct Supabase queries — never by hitting a live, deployed
endpoint, because no such endpoint exists. This was flagged once already, in Phase 2's `STATE.md` entry,
as an "environment/ops gap" (`ARCHITECTOS_PYTHON_BACKEND_URL`/`ARCHITECTOS_INGEST_SECRET` unset). That gap
is now fully explained: there's nothing at the other end of those env vars yet. Phase 4's execution agent
report mentioning "Local app is responding at http://127.0.0.1:5180" was a local dev server running inside
that agent's own sandbox during its work session — not a persistent Railway deployment.

**Practical consequence:** the Skills & Plugins feature, KB Explorer, doc/wiki synthesis, and everything
else living in `python-backend/` is code-complete but not actually reachable by real founders in the
deployed app today. This is expected pre-beta state per `CLAUDE.md`'s own framing ("Substantially built...
pre-beta work is verify / wire / test / design") — this is exactly the "wire" work still outstanding, not
a surprise defect. It just needs to happen before Phase 5 makes sense, since Phase 5's entire premise
("the Railway Python backend calls out to the GKE cluster") requires Railway to be running that backend
first.

## What's needed to deploy it (confirmed from the live repo, 2026-07-01)

No `railway.json` or `Procfile` exists — nothing currently tells Railway how to build or run this service.
FastAPI app object confirmed at `python-backend/main.py:475` (`app = FastAPI(...)`), no existing
`uvicorn.run(...)` entrypoint block, so Railway needs an explicit start command.

**New Railway service, configured as:**
- **Root directory:** `python-backend`
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Required environment variables** (from `python-backend/core/config.py` and `.env.example`):
| Variable | Purpose | Notes |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Same project already in use |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key | Same project already in use |
| `ANTHROPIC_API_KEY` | Claude synthesis (KB Explorer, doc/wiki, skill guided-draft) | New for this service |
| `OPENAI_API_KEY` | Embeddings (`text-embedding-3-small`) + metadata extraction (`gpt-4o-mini`) — a distinct, still-active use of OpenAI for embeddings/metadata, separate from the `openai` npm package (frontend, dead code) and separate from AI synthesis (Claude-only per `CLAUDE.md` Rule #1) | Still required |
| `ARCHITECTOS_INGEST_SECRET` | Shared secret checked against `x-ingest-secret` header from `api/vcso/chat.ts` / `writeback.ts` | Must match what's set in Vercel's env for the frontend/API routes |
| `ARCHITECTOS_CORS_ORIGINS` | Comma-separated allowed origins | **Defaults to `localhost` only — must be updated to the real production Vercel domain(s), or the live frontend cannot call this service at all** |
| `COHERE_API_KEY` | Reranking (optional — disabled by default via `ARCHITECTOS_RERANK_ENABLED=false`) | Can be left blank for now |

**On the frontend/Vercel side, once the Railway URL exists:**
- `VITE_INGESTION_API_URL` (used by `lib/skillsApi.ts`, `lib/osEngineApi.ts`) — set to the new Railway
  service's public URL.
- `ARCHITECTOS_PYTHON_BACKEND_URL` (used by `api/vcso/chat.ts`, `api/vcso/writeback.ts`) — same URL.
- `ARCHITECTOS_INGEST_SECRET` — same value as set on the Railway side.

## Region

Confirmed from London's Railway workspace settings (General → Preferred Deployment Region): **US West
(California, USA).** For the GKE cluster Phase 5 provisions, the closest matching GCP region is
**`us-west2` (Los Angeles)** — geographically nearest to Railway's California region. `us-west1` (The
Dalles, Oregon) is the alternative if `us-west2` has capacity/pricing quirks for Autopilot; either is a
reasonable choice, `us-west2` is the default recommendation.

## Deployment in progress (2026-07-01) — issues found and corrected during setup

London stood up the Railway service and shared screenshots for review. Source/build/start commands were
all correct on the first pass (root directory `/python-backend`, build command
`pip install -r requirements.txt`, start command `uvicorn main:app --host 0.0.0.0 --port $PORT`). Two
variable-naming issues were caught before going live:

1. **`SUPABASE_URL` was missing** — only `VITE_SUPABASE_URL` (the frontend-prefixed name) was set.
   `core/config.py:15` reads `SUPABASE_URL` specifically; `vector_store.py`/`kb_folders.py` construct
   their Supabase client from it. Without it, every Supabase-dependent call fails. **Fix: add
   `SUPABASE_URL` as its own variable**, same value as `VITE_SUPABASE_URL`.
2. **`ARCHITECTOS_INGEST_SECRET` was missing** — only `ARCHITECTOS_WEBHOOK_SECRET` was set.
   `main.py:470-471`'s `require_ingest_secret` check is `if settings.ingest_secret and x_ingest_secret !=
   settings.ingest_secret` — when the correctly-named variable is absent, `settings.ingest_secret` is
   `None` and **the check no-ops entirely**, leaving ~30 endpoints (`/api/ingest`, `/api/retrieve`, every
   `/api/tools/*` and `/api/doc-wiki/*` route, `/api/agent-runs`, etc.) open with no authentication at
   all, rather than failing closed. **Fix: add `ARCHITECTOS_INGEST_SECRET`** with the same value used in
   `ARCHITECTOS_WEBHOOK_SECRET`, and use that identical value for Vercel's `ARCHITECTOS_INGEST_SECRET` env
   var later.

`VITE_SUPABASE_ANON_KEY` and `VITE_N8N_WEBHOOK_URL` are present but unused by this service — harmless,
no action needed.

**Domain — apex-domain conflict caught and confirmed with London.** She had connected `architectospro.com`
(the bare apex domain) directly to this Railway service via Cloudflare's one-click DNS authorization.
Confirmed with her: `architectospro.com` is the main app/marketing domain and must point to Vercel, not
this backend. **Corrective steps:**
1. Remove `architectospro.com` from this Railway service (Settings → Networking → delete the domain
   entry).
2. In Vercel → project Settings → Domains, re-verify/re-add `architectospro.com` — Vercel will show
   whatever DNS records it now expects (Railway's Cloudflare authorization step likely replaced the
   original ones), and those need to be recreated in Cloudflare's DNS dashboard.
3. Back in Railway, add a **subdomain** instead — e.g. `api.architectospro.com` — via the same
   "+ Custom Domain" flow in Networking. This only touches that subdomain's DNS records, not the apex, so
   it won't conflict with Vercel again.

**Resolved and independently verified, 2026-07-01.** All corrections completed and confirmed:
`architectospro.com`/`www` resolve to Vercel (fetched directly, real app content returned);
`api.architectospro.com` resolves to this Railway service.

**Two further issues surfaced during this process, both found and fixed:**
1. **Repo was never pushed.** Git investigation found 407 changed/untracked files that had never been
   committed — the entire skills sandbox build (Phases 1–4), KB Explorer, doc-wiki, and wiki-system work
   existed only locally. `origin/main` on GitHub was frozen at an early "pre-launch" snapshot, which is
   why the deployed backend only exposed 3 routes (`/api/health`, `/api/ingest`, `/api/retrieve`).
   Resolved: `.gitignore` updated to exclude `__pycache__`/`.pytest_cache`, London committed and pushed
   everything from her own machine (commit `a186ee4`, confirmed matching on `origin/main` via
   `git ls-remote`).
2. **Startup crash on the new deploy.** `routers/skills.py`'s `delete_skill` and
   `routers/kb_folders.py`'s `delete_folder` were both declared `status_code=204` with a `-> None` return
   annotation and no explicit `response_model=None` — this FastAPI version infers a response model from
   the return annotation that conflicts with "204 must have no body," crashing the entire app at startup
   (every route fails, not just these two, since route registration happens once at import time). Fixed
   by adding `response_model=None` to both decorators; searched the rest of `python-backend/` for the
   same 204/304 pattern and found no other instances.

**Final independent verification:** `/api/health` confirmed live in-browser
(`{"ok":true,"service":"architectos-ingestion"}`); `/openapi.json` (cache-busted, since Cloudflare is
edge-caching this route — see note below) confirmed the full route set is live: `/api/skills`,
`/api/skills/guided-draft`, `/api/skills/import`, `/api/skills/{skill_id}/export`, all `/api/tools/*`,
all `/api/doc-wiki/*`.

**Non-blocking follow-ups noted, not yet actioned:**
- Cloudflare is edge-caching GET responses on `api.architectospro.com` (confirmed — the plain
  `/openapi.json` URL served a stale cached copy well after the real deploy went live; a cache-busting
  query param showed the real, current response). An API backend generally shouldn't be cached at the
  edge — worth adding a Cloudflare cache-bypass rule for `api.architectospro.com/*`.
- A stray `temp_superpowers` directory was committed as a git submodule reference (mode `160000`,
  pointing at a dangling commit hash with no `.gitmodules` entry), and a 0-byte `scratch_delete_test.tmp`
  file (debris from this session's own troubleshooting) was swept into the same commit. Neither is
  harmful, both are worth a small cleanup commit.
- **A hard environment limitation surfaced during this process:** the Orchestration Agent's sandbox
  cannot delete or rename any file in this connected folder (confirmed via multiple failed `rm` attempts,
  including on a freshly-created scratch file) — all git/file delete operations in this repo must be run
  by London directly on her own machine going forward, not delegated to this agent.

## Sequencing relative to Phase 5

This deployment should happen **before or alongside** the GCP/GKE account setup already in motion — not
after Phase 5 is built, since Phase 5's cluster needs a live Railway backend to call out to and be called
back from. Recommend treating this as its own short, immediate task, separate from Phase 5's plan files
(it's infrastructure the whole build depends on, not sandbox-specific work).
