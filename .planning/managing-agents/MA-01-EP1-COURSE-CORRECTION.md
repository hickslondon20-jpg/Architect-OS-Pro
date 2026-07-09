# Course-Correction / Alignment — MA-01 Ep1 agent (historical record)

> Given to the running Ep1 agent after we discovered the sandbox has no egress. Recreated 2026-07-08
> from the strategy-thread record.

---

Quick alignment update before you continue — a few things changed on our side.

**1. Why your live calls to OpenAI/Supabase/Anthropic failed — the environment, not the keys.** Your
Cowork sandbox has **no outbound internet**: it can't resolve `api.openai.com`, the Supabase host, or
`api.smith.langchain.com`. The `Unauthorized` from Anthropic was the sandbox's own gateway, not a bad
key. **Do not try to boot the FastAPI backend or fire live API calls from your sandbox** — it will
always fail on network. The credentials are correct.

**2. What we fixed/completed (ready for you now):**
- Backend `.env` corrected and complete: correctly-named `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`,
  plus `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and all `LANGSMITH_*` — in **both** `python-backend/.env`
  and root `.env.local`.
- `.gitignore` protects the env files + the annotated template; the template was scrubbed to placeholders.
- OpenAI billing cleared.

**3. The handoff doc changed — re-read it.** `MA-01-EP1-HANDOFF.md` has a new "How this runs —
brains/engine split" section and a rewritten Task 0.

**4. How we work going forward (brains/engine split):** you write code/scripts, make fix-in-place changes,
read the DB via **Supabase MCP**, and interpret the logs I paste back; **I** run the backend, upload docs,
run your smoke script on my machine. Gate 1 is a loop.

**5. Immediate next step — Task 0 code changes (no internet needed):** add `load_dotenv()` to `main.py`
(or `uvicorn --env-file`), instrument the Anthropic + OpenAI clients for LangSmith (propose the approach
first, then apply), then write me a minimal verification script confirming both traces land in
`ArchitectOS-pro` with no secrets/PII.

**6. After Task 0:** write me the exact commands to start the backend + run the Gate 1 upload smoke; wait
for my logs; verify DB rows via Supabase MCP. Keep updating `Pro-Suite-Progress.md`; **stop at the Gate 1
checkpoint** — don't start Episode 2.
