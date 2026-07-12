# State of the Intelligence Layer → Roadmap to MVP

> Orchestration-owned alignment artifact — the whole path to MVP at a glance. Recreated 2026-07-08 from
> the strategy-thread record after the file was lost in the commit/session-boundary incident, and brought
> current (MA-03 closed). Companion to `INTELLIGENCE-LAYER-ARCHITECTURE.md` + `INTELLIGENCE-LAYER-EPISODE-MAP.md`
> (honors L1–L26). Ground-truth status: `Pro-Suite-Progress.md`.

---

## Readiness vocabulary (locked)
Every status statement uses one rung. A green Episode row means **backend-complete only** — never "usable."

**backend-complete → live-verified → usable (front-end wired) → polished**

## Where we are (updated 2026-07-10)
- **Repo integrity restored (2026-07-09).** A branch-divergence incident had left `main` missing the entire
  Ep5–Ep7 backend service layer (VCSO chat, harness/Domain Agents, sandbox, MCP scaffold, Ep7 citations) — the
  code was safe on `codex/release-v0.4-skills-sandbox` (`b6ca8881`). Surgically recovered + reconciled onto
  `main`: kept MA-03B's newer `wiki_compilation.py`, union-merged `requirements.txt`/`config.py`, took b6's
  fuller `vector_store`/`sub_agent_orchestrator`/`kb_explorer`. Committed as **v0.5.8 (`2062773d`)** and
  **deployed clean to Railway production (Online)**, which deploys from `main`. `main` is now the single
  canonical branch (retire `codex/release`). Note: for the ~4h prior window (v0.5.7), production was missing
  the Ep5–Ep7 surfaces — now restored (boots clean; functional verification of those surfaces folds into MA-01/MA-02).
- **Ep1 Gate 1 PASSED** — the pipeline ran end-to-end with real LLM calls, no mocks (upload → ingestion →
  chunks → embeddings → `document_chunks` → doc-wiki synthesis → `ose_knowledge_pages` → hybrid/RRF).
- **Two-writer model (correction):** `ose_knowledge_pages` has two writers — document-sourced pages written
  directly by `DocWikiSynthesisService._upsert_page`, and the fixed Tier-1 scaffold pages via
  `WikiCompilationService.compile_page/compile_event → _project_to_ose` (`page_kind='wiki_layer1'`). No
  compile step for document pages.
- **Tier-1 synthesis is now LIVE (MA-03 closed 2026-07-08).** The 7 fixed pages were upgraded from mechanical
  templating to real Sonnet synthesis (claims-with-evidence + narrative + sourced-from), embedded, with
  auto-triggering (`pg_net` on 12 source tables) and an anti-clobber guard. Verified for test user
  `cd490873-…`: all 7 pages `claude-sonnet-4-6`, embeddings present, `stale=false`. This makes the
  "knows-your-business" differentiator real for an account for the first time.
- **Observability spine rebuilt — MA-01 CLOSED (2026-07-10, v0.5.13).** The lost LangSmith instrumentation
  was recovered with the service layer and completed: all live Anthropic/OpenAI client sites route through a
  fail-open `core/langsmith_tracing.py` helper, `load_dotenv()` is in `main.py`, and tracing was
  outcome-verified. `CLAUDE.md` + `Pro-Suite-Progress.md` corrected. **Standing bar now in effect:** any
  Python-backend LLM call on an episode's critical path emits a LangSmith trace as evidence (necessary, not
  sufficient — paired with DB/output checks). Provider keys rotated 2026-07-08.
  **Standing rule:** commit after every milestone; `main` is canonical.
- **Ep2 (KB Explorer + wiki-read) SOFT-CLOSED — backend-live-verified (2026-07-10).** Live-verified on
  `cd490873-…`: KB Explorer tools (ls/tree/grep/glob/read) + sub-agent, Tier-1 population (incl. the narrowed
  canonical-key index), the doc-wiki trigger (fires + logs a "not page-worthy" decision — not broken),
  wiki-read (citation-shaped `wiki_page` results), and the canonical Python CSO path (persists a turn with
  citations). **LangSmith production tracing confirmed** (traces show production uploads; `LANGSMITH_*` set in
  Railway). Fix-it batch shipped v0.5.14–v0.5.18 (model-alias repoint, doc-wiki error visibility, HTML/MD
  DB+storage support, ingestion wiring fixes). *Soft-closed* = backend wired + directionally correct;
  **fully-closed** (all features operational) waits on the deferred items. **Deferred:** (§8) CSO
  realtime/streaming UI rendering + Sources-panel citation UX; (connection-phase, post-episodes) **CSO Tier-0
  platform-record retrieval** — the CSO reaches Tier-1 + docs but not base Tier-0 records directly
  (Agency Snapshot / GV / financial KPI / sprint / quarter).
- **Working from live now (2026-07-10/11).** Retired local hosting: all config repointed to the live URLs
  (`architectospro.com` frontend / `api.architectospro.com` backend), workflow is `main` → auto-deploy
  (Railway + Vercel) → test on the live URL, gated on green deploys. **Forgot-password / reset-password feature
  shipped** — the seeded `hicks.london25@gmail.com` (`cd490873-…`) account is now usable directly, ending the
  split-account testing. **OS Engine UI upload → auto-ingestion verified end-to-end (v0.5.32)** via a secure
  Vercel serverless proxy (session-validated, server-held ingest secret; Supabase → proxy → Railway Processing →
  Complete → metadata → LangSmith), plus an OS Engine refresh-hiccup fix. *Confirmed for HTML/MD; should hold for
  all formats — flag to confirm (PDF/DOCX/CSV/XLSX).* **Current baseline: v0.5.32.**
- **Front-end status:** some surfaces are now live-wired and dogfoggable (auth, OS Engine upload, Virtual CSO),
  but most of the front-end still needs the §8 real-wiring + polish pass.

**Connection-phase decision:** routed cross-tier reasoning (C) is the MVP target — beta should feel like a
strategic OS, not a RAG bot. Build **A-first**; the router's final timing (first beta vs. fast-follow) is an
evidence-based call once the pipeline + A are live. With Tier-1 synthesis now real, the differentiator is
materially closer.

## Triage — MVP-required vs. post-MVP/v1
**MVP-required:** MRA repoint + resolver guard + Rule #3 fix (Ep7); consolidated testing/verification-debt
pass (episode-by-episode); pipeline liveness (✅ Gate 1); **Tier-1 LLM synthesis (✅ MA-03)**; MA-01 LangSmith
rebuild; connection-A (CSO uses wiki ✅ via MA-03 for Tier-1; Domain Agents consult wiki = Ep6); §8 front-end
real-wiring + UI polish; router (C) — evidence-based in-beta-vs-fast-follow.

**Post-MVP / v1:** insight-accretion loop on Tier-1 pages; MCP live financial feed into `financial_context`;
native Tier-1 claim tools + tool-name-collision fix; metering ledger / usage % / pricing / admin panel; real
MCP connections (L7 scaffold-only at beta); dark-by-design citations (`web`, `reflection_reviews`,
`sprint_retrospective`); Reflection Review V-11 (core-platform); Ep1 return-pass queue; Ep7B PDF geometry.

## The sequenced path to MVP
1. **Fix** — MRA quick win (Ep7).
2. **Test** — consolidated verification-debt pass, **episode-by-episode** (Ep1→2→4→5→6→7), two-rung scoring,
   LangSmith-traced, fix-in-place vs. discover-and-report. (Prereq: OpenAI cleared ✅, LangSmith added ✅.)
3. **Polish** — narrow legibility cleanup of already-wired surfaces (not a design pass).
4. **§8** — front-end audit + real-wiring pass (the "usable" rung).
5. **Router (C)** — built in parallel with §8 when in-MVP (backend; independent of §8's front-end); keep the
   answer/citation/trace contract stable as the one coordination point.
6. **Consolidated cross-episode smoke → flip go-live.**

## Current position + next initiatives
MA-03 (Tier-1) **closed**; recovery incident **resolved**; MA-01 (observability) **closed**;
**Ep2 SOFT-CLOSED**; **env consolidation (work-from-live) + forgot-password + OS Engine auto-ingestion DONE**
(v0.5.32). Next:
1. **MA-04 — Ep4 verification (Agent Skills & Code Sandbox / artifact-production engine).** Resume the
   episode-by-episode march, live-first: skills system (CRUD/import-export/guided creator/global-private/
   building-block files), the GKE code sandbox, persistent tool memory, and artifacts (sub-agent → sandbox →
   artifact → chat-message link → reader/library). Scoped with objectives + stage gates like Ep2.
2. Then **Ep5 → Ep6 → Ep7**, same fashion.
3. **Deferred (later passes, after the episodes):** the §8 front-end/UX refinement + real-wiring pass (incl. CSO
   realtime rendering + Sources-panel UX), and **CSO Tier-0 retrieval**.

## Standing operational rules
- **Work from live.** `main` → auto-deploy (Railway + Vercel) → test on `architectospro.com`; gate each milestone
  on the deploy going green (keep pre-push compile/build checks). No local PowerShell/backend smokes.
- **Commit after every milestone**, version-tagged per `CLAUDE.md` (`vMAJOR.MINOR.PATCH <desc>`, PATCH++ per
  commit; find current from the latest commit). **Current baseline: v0.5.44** (Ep4 Obj-0 + Obj-1 done). Instruct every feature agent to follow this.
- Verify by outcome: live UI + Supabase MCP + LangSmith traces (`ArchitectOS-pro`). Don't read/echo secrets.
- Don't fully trust bash reads on this repo (stale/truncated); prefer Read/Grep/Glob; the founder's machine + live deploy are authoritative.
