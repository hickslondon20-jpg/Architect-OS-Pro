# Thread-Initiating Prompt — MA-01 Gate 1 LangSmith Rebuild (resume)

> The blockers that paused this work are cleared: the Ep5–Ep7 service layer was recovered onto `main`
> (v0.5.8 / `2062773d`), deployed clean to Railway. Resume against the complete, committed tree.

---

Resume the **MA-01 Gate 1 LangSmith rebuild** — the blockers are cleared.

**What changed since your audit:** your earlier audit ran against an **incomplete checkout** (a branch-divergence
incident had left `main` missing the entire Ep5–Ep7 service layer). That's resolved: the full service layer was
surgically recovered from `b6ca8881`, reconciled onto `main`, committed as **v0.5.8 (`2062773d`)**, and
**deployed clean to Railway production** (which deploys from `main`). `main` is now the single canonical,
complete branch. Provider keys are rotated and working (production runs real Sonnet synthesis). So the files you
flagged as "ghosts" — `citations/verify.py`, `harness_engine.py`, `sandbox_execution_service.py`,
`vcso_chat_service.py` — now exist and are in scope.

**Re-audit first (your prior audit is stale):**
Re-check the current wrap state across all Anthropic/OpenAI client construction sites on the complete tree.
`wiki_compilation.py` is already wrapped (MA-03). Note `kb_explorer_service.py` and `vector_store.py` are now the
fuller `b6ca8881` versions (reconciled during recovery), so re-confirm their wrap state rather than assuming.
**→ Report the current wrap state + your proposed shared-wrapper-helper approach before wrapping.**

**Then instrument (small shared wrapper helper; wrap each live client site):**
- Anthropic: `doc_wiki_synthesis.py` (×2), `kb_explorer_service.py`, `skill_draft_synthesis.py`,
  `citations/verify.py`, `harness_engine.py`, `sandbox_execution_service.py`, `vcso_chat_service.py`, and the
  `main.py` diagnostic smoke endpoint (wrap for consistency).
- OpenAI: `vector_store.py` (covers `metadata_extractor`, which uses `VectorStore.openai_client`).
- Add `load_dotenv()` at the top of `main.py` — pydantic loads the env file into `Settings` but does NOT export
  `LANGSMITH_*` into `os.environ`, where the LangSmith SDK reads.

**Correct the docs (they still say TBD):**
`CLAUDE.md` (Observability row) and `Pro-Suite-Progress.md` — update both to "LangSmith adopted 2026-07-06;
instrumentation rebuilt + outcome-verified <date>," with the standing bar: any Python-backend LLM call on an
episode's critical path emits a LangSmith trace as evidence (necessary, not sufficient — pair with DB/output checks).

**Verify by outcome (never by inspecting key values):**
The founder exercises each surface on their machine — a VCSO chat turn, a doc-wiki synthesis, a KB-explorer run,
a sandbox execution, a wiki compile, a citation resolve — and you confirm a fresh trace lands in LangSmith project
`ArchitectOS-pro` for each, with no secrets/PII in payloads.

**Rules:** brains/engine split (no internet in your sandbox — never boot the backend; the founder runs it; you
write code, read the DB via Supabase MCP, interpret logs). **Never read or echo `.env`/API keys.** **Commit after
every milestone** on the now-committed `main` (the re-audit, the wrapper helper + first wraps, the remaining wraps
+ `load_dotenv`, the doc corrections). Honor locks L1–L26.

Start by re-auditing the complete tree and reporting the current wrap state + proposed wrapper approach before wrapping anything.
