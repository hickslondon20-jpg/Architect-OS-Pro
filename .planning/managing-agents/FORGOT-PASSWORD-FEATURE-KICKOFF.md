# Thread-Initiating Prompt — Forgot Password / Reset Password Feature (build, live-first)

> A targeted front-end auth feature on Supabase Auth. Real beta-needed capability that also unifies the test
> account (lets us log in as the seeded `hicks.london25@gmail.com` / `cd490873-…`). **We work from live now**
> (`architectospro.com`, HashRouter, backend `api.architectospro.com`; `main` → auto-deploy → test the live URL).
> Brains/engine split, commit-after-milestone, honor the design system.

---

You are a build agent adding a **Forgot Password / Reset Password** flow to ArchitectOS Pro. Supabase Auth
provides the primitives — this is front-end wiring + Supabase Auth config, no new backend synthesis.

**Read first:** `CLAUDE.md` (design-system non-negotiables — AOS tokens, no Inter, no forbidden patterns; and the
"work from live" ways-of-working), `.planning/codebase/ARCHITECTURE.md` (auth wiring: **HashRouter**,
`context/AuthContext.tsx`, `lib/supabaseClient.ts`, public routes `/`, `/sign-in`, `/sign-up`, `App.tsx`), and
the existing `/sign-in` + `/sign-up` components (match their structure/styling).

**How you work:** we're off local — you write the code, push to `main`, it auto-deploys to `architectospro.com`,
and the **founder tests on the live URL**. Gate the milestone on the deploy going green (keep pre-push
compile/build checks). Brains/engine split; **never read/echo secrets**; **commit after each milestone**.

**Build:**
1. **`/sign-in`:** add a "Forgot password?" link.
2. **`/forgot-password` page:** email input → `supabase.auth.resetPasswordForEmail(email, { redirectTo:
   "https://architectospro.com/#/reset-password" })` → "check your email" confirmation. Handle errors gracefully.
3. **`/reset-password` page — handle the HashRouter + recovery-token collision (this is the blank-page cause).**
   Supabase returns the recovery session in the URL hash (`#access_token=…&type=recovery`), which conflicts with
   HashRouter's own `#/route`. Ensure the Supabase client processes the recovery token (`detectSessionInUrl`, or
   read the hash params before HashRouter consumes them / listen for the `PASSWORD_RECOVERY` auth event), so the
   page renders instead of going blank. Then show new-password + confirm inputs (validation: min length, match)
   → `supabase.auth.updateUser({ password })` → route to `/sign-in` on success. Handle expired/invalid-token and
   error states with a visible message (never a blank screen).
4. **Wire routes** in `App.tsx` (HashRouter, public). Optionally add `requestPasswordReset` / `updatePassword`
   helpers to `AuthContext.tsx`.
5. **Founder-run Supabase config (give exact steps):** Supabase Auth → URL Configuration → add
   `https://architectospro.com/#/reset-password` (and the base `https://architectospro.com`) to **Redirect URLs**;
   confirm Site URL is the live domain; confirm the default "Reset Password" email template is enabled (custom
   AOS-branded template is an optional follow-up).

**Verify (founder-run, on the live app):** request a reset for **`hicks.london25@gmail.com`** (the founder
controls this inbox) → receive the email → click the link → land on a working `/reset-password` on
`architectospro.com` (NOT blank) → set a new password → confirm login as that account (`cd490873-…`). From then
on, all UI tests run on the seeded account (7 Tier-1 pages + full seeded tables) — no more `4ef8…` split.

**Out of scope:** the §8 front-end/UX polish pass, custom branded email templates (optional follow-up), MFA, and
any non-auth work. Honor locks L1–L26 and the design system.
