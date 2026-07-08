# Course-Correction / Alignment — MA-01 Ep1 agent (already running)

> Paste the block below into the running Ep1 thread. It updates the agent on what changed, why
> its live calls failed, how we work going forward, and what to do next.

---

Quick alignment update before you continue — a few things changed on our side since you started.

**1. Why your live calls to OpenAI/Supabase/Anthropic failed — it was the environment, not the
keys.** Your Cowork sandbox has **no outbound internet**: it can't even resolve DNS for
`api.openai.com`, the Supabase host, or `api.smith.langchain.com` (I confirmed this independently).
The `Unauthorized` you saw from Anthropic was the sandbox's own gateway, not a bad key. So
**do not try to boot the FastAPI backend or fire live API calls from your sandbox** — it will
always fail on network. The credentials are correct.

**2. What we fixed/completed (ready for you now):**
- The backend `.env` is corrected and complete: correctly-named `SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY`, plus `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and all `LANGSMITH_*`
  vars — in **both** `python-backend/.env` and root `.env.local`.
- `.gitignore` now protects the env files and the annotated template; the template was scrubbed
  back to placeholders (no secrets in tracked files).
- OpenAI billing is cleared.

**3. The handoff doc changed — re-read it.** `.planning/managing-agents/MA-01-EP1-HANDOFF.md` has
a new **"How this runs — brains/engine split"** section and a **rewritten Task 0**. Re-read those;
your earlier copy is stale.

**4. How we work going forward (brains/engine split):**
- **You:** read code, derive the checklist, write the exact smoke script + run commands, make
  code/wiring changes (fix-in-place for contained bugs; discover-and-report anything structural),
  read the database directly via the **Supabase MCP** (that works from your sandbox), and
  interpret the logs/output I paste back.
- **Me (founder, on my machine — has internet + the `.env`):** run the backend, upload docs, run
  your smoke script, paste results/logs back to you.
- Gate 1 is a loop: you prepare → I run → you verify (Supabase MCP + my logs) → you fix → repeat.

**5. Your immediate next step — do the Task 0 backend code changes now (no internet needed):**
- Add `load_dotenv()` at the top of `main.py` (or document starting via
  `uvicorn main:app --env-file python-backend/.env`) so `LANGSMITH_*` actually reach the process
  environment — pydantic reads the env file into its Settings model only and does **not** export
  those vars to `os.environ`.
- Instrument the Anthropic + OpenAI clients for LangSmith (`wrap_anthropic` / `wrap_openai`, or
  `@traceable` the service entrypoints) so calls emit traces to project `ArchitectOS-pro`. This
  touches multiple client construction sites — **propose the approach to me first, then apply.**
- Then write me a minimal verification script (one Anthropic + one OpenAI call) that I run on my
  machine to confirm both traces land in `ArchitectOS-pro` with no secrets/PII in the payloads.

**6. After Task 0:** write the exact commands for me to (a) start the backend and (b) run the
Gate 1 upload smoke (upload → ingestion → chunks → wiki page). Hand them to me, wait for my logs,
then verify the DB rows via Supabase MCP. Keep updating `Pro-Suite-Progress.md`, and **stop at the
Gate 1 checkpoint** — don't start Episode 2.

Confirm you've re-read the updated handoff and, before writing any client-wrapping code, tell me
your proposed instrumentation approach.
