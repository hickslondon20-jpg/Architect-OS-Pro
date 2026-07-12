# Thread-Initiating Prompt — Environment Consolidation: Work From Live (main → prod)

> A focused infra/config workstream. Goal: make the **deployed live environment the single working/testing
> surface**, repoint every local-vs-prod config to the live URLs, verify the live end-to-end flow, and retire
> local hosting. Fixes the Supabase password-reset redirect as a side effect (unblocks the forgot-password
> feature that comes next). Simple **main → prod** model — no preview deploys. Do this BEFORE the forgot-password build.

---

You are an environment-consolidation agent for ArchitectOS Pro. There are **no users**, and Railway (backend),
Vercel (frontend), Cloudflare (DNS/email), and Supabase are all deployed and auto-deploy from `main`. We are
**moving fully off local hosting** and working from the live URLs going forward, to eliminate the recurring
local-env friction (Python 3.14 vs 3.13, `.env` malformation, frontend URL wiring, CORS, localhost redirects).

**Read first:** `CLAUDE.md` (ways of working + the three-lane/hosting rules), `.planning/codebase/ARCHITECTURE.md`,
`INTEGRATIONS.md`, `STACK.md`, `CONCERNS.md` (esp. the Local Dev Environment gotchas), and
`.planning/STATE-AND-ROADMAP-TO-MVP.md`.

**How you work:** brains/engine split — the dashboard configuration (Supabase Auth, Vercel env, Railway env,
Cloudflare) is **founder-run**; you can't access those dashboards. Your role: **audit the code + config for
local-vs-prod assumptions and fix those in code (commit)**, produce a **precise dashboard checklist** for the
founder to apply, and **verify by outcome** (founder loads the live URL + reports; you check Supabase MCP +
LangSmith). **Never read or echo secret values** — audit which variables point where, not their contents.
**Commit after every milestone.** Honor the design system for any UI touch.

**Step 0 — get the live URLs from the founder:** the live **frontend URL** (the Vercel/Cloudflare domain the app
is served from) and confirm the **backend URL** (`api.architectospro.com`). Everything below repoints to these.

**Tasks:**
1. **Code/config audit for local assumptions.** Grep the frontend + backend for `localhost`, `127.0.0.1`, and
   any hardcoded/dev-default URLs or ports. Fix in code where a live default belongs (e.g. remove localhost
   fallbacks that mask misconfig). List every env var that controls an endpoint: frontend `VITE_*` (Supabase URL/
   anon key — remote, fine; the **backend/ingestion API URL**; `VITE_N8N_WEBHOOK_URL`), backend
   `ARCHITECTOS_CORS_ORIGINS`, `ARCHITECTOS_PYTHON_BACKEND_URL`, etc.
2. **Dashboard checklist (founder applies):**
   - **Supabase Auth → URL Configuration:** Site URL → the live frontend domain; Redirect URLs allowlist →
     the live domain (incl. the future `/reset-password` route). **This fixes the password-reset blank-page
     redirect.**
   - **Vercel env:** frontend backend/ingestion API URL → `api.architectospro.com` (not localhost);
     `VITE_N8N_WEBHOOK_URL` → live N8N; confirm auto-deploy from `main` is on.
   - **Railway env:** `ARCHITECTOS_CORS_ORIGINS` → include the live frontend domain; confirm the app deploys
     from `main` and all vars (keys, `LANGSMITH_*`) are present.
   - **Cloudflare:** confirm the live frontend domain resolves to Vercel and the backend domain to Railway.
3. **Verify the live end-to-end flow (founder-run):** load the live frontend URL → sign in → confirm the app
   talks to the live backend + Supabase (a real data read, a CSO turn, or an upload works). Confirm no localhost
   reference breaks the live app.
4. **Document the workflow.** Update `CLAUDE.md` ways-of-working: **we work from live** — `main` → auto-deploy
   (Railway + Vercel) → test against the live URL; **gate each milestone on the deploy going green** (the only
   safety net in a main→prod model, so keep pre-push compile/import checks). Update `CONCERNS.md` to mark the
   local-env gotchas as **deprioritized (working from live)**.

**Out of scope:** the §8 front-end real-wiring/polish pass (this is only about making the *deployed* app the
working surface + fixing env/URL config, not wiring mock surfaces); the forgot-password feature (next workstream);
any backend feature work. Simple main→prod — do **not** set up Vercel preview deploys or branch environments
(we just healed a branch-divergence incident; keep one canonical branch).

**Deliverables:** code/config fixes committed; the founder-applied dashboard checklist confirmed done; the live
end-to-end flow verified; `CLAUDE.md` + `CONCERNS.md` updated; and confirmation the Supabase reset redirect now
points at the live domain (so forgot-password is unblocked). Honor locks L1–L26.
