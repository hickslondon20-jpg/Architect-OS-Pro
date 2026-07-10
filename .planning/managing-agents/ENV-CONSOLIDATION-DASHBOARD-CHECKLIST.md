# Environment Consolidation Dashboard Checklist

> Founder-run checklist. Agents do not have dashboard access and must not inspect or echo secret values.

## Live URLs

- Frontend URL: `https://architectospro.com`.
- Backend URL: `https://api.architectospro.com`.

## Supabase Auth

- Authentication > URL Configuration > Site URL: `https://architectospro.com`.
- Authentication > URL Configuration > Redirect URLs: allow the live frontend URL and the future reset route:
  - `https://architectospro.com`
  - `https://architectospro.com/reset-password`
  - `https://architectospro.com/#/reset-password` if the deployed app remains hash-routed for auth flows.
- Outcome to confirm: password reset links no longer land on a blank localhost or stale preview URL.

## Vercel Frontend

- Confirm the project auto-deploys from `main`.
- `VITE_SUPABASE_URL`: present and points at the production Supabase project.
- `VITE_SUPABASE_ANON_KEY`: present. Do not paste it into chat.
- `VITE_INGESTION_API_URL`: `https://api.architectospro.com`.
- `VITE_N8N_WEBHOOK_URL`: the live n8n webhook base URL, with no localhost fallback.
- `VITE_N8N_CLARITY_COMPASS_WEBHOOK_URL`, `VITE_N8N_GVS_WEBHOOK_URL`, and `VITE_N8N_GVS_COMPARISON_WEBHOOK_URL`: confirm any configured values point at live n8n workflows.
- `VITE_BYPASS_FEATURE_GATES`: explicitly set for the intended beta behavior; do not rely on absence/defaults.

## Railway Backend

- Confirm the backend deploys from `main`.
- `ARCHITECTOS_CORS_ORIGINS`: include `https://architectospro.com`. Do not rely on localhost defaults.
- `ARCHITECTOS_PYTHON_BACKEND_URL`: `https://api.architectospro.com` where a serverless caller needs the backend base URL.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ARCHITECTOS_INGEST_SECRET`, and `LANGSMITH_*`: present. Confirm only by dashboard presence/status, never by pasting values into chat.
- Outcome to confirm: Railway deploy is green and `https://api.architectospro.com/api/health` returns healthy.

## Cloudflare

- Frontend domain resolves to Vercel.
- `api.architectospro.com` resolves to Railway.
- DNS proxy/TLS settings are compatible with Vercel and Railway.

## Live Outcome Check

- Load `https://architectospro.com`.
- Sign in.
- Confirm at least one real Supabase read works in the app.
- Confirm one backend-mediated action works: upload, CSO turn, or other Python backend read/write.
- Confirm no browser console/network request points to localhost, `127.0.0.1`, or a stale preview domain.
- Report the tested flow back to the agent for final Supabase/LangSmith outcome checks.
