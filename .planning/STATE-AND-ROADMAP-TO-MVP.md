# State of the Intelligence Layer → Roadmap to MVP

> Orchestration-owned alignment artifact — the whole path to MVP at a glance. Recreated 2026-07-08 from
> the strategy-thread record after the file was lost in the commit/session-boundary incident, and brought
> current (MA-03 closed). Companion to `INTELLIGENCE-LAYER-ARCHITECTURE.md` + `INTELLIGENCE-LAYER-EPISODE-MAP.md`
> (honors L1–L26). Ground-truth status: `Pro-Suite-Progress.md`.

---

## Readiness vocabulary (locked)
Every status statement uses one rung. A green Episode row means **backend-complete only** — never "usable."

**backend-complete → live-verified → usable (front-end wired) → polished**

## Where we are (updated 2026-07-09)
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
- **Open debt from the incident:** MA-01 Gate 1's LangSmith instrumentation (wrapping the client sites +
  `load_dotenv`) was lost and needs rebuild — now **unblocked** against the complete, recovered tree; only
  `wiki_compilation.py` is wrapped today (from MA-03). `CLAUDE.md` + `Pro-Suite-Progress.md` still say
  Observability "TBD" and must be corrected during the rebuild. Provider keys rotated 2026-07-08.
  **Standing rule:** commit after every milestone; `main` is canonical.
- **Still not usable:** no front-end is wired to any of this (that's §8).

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
MA-03 (Tier-1 synthesis) **closed**. Next, per the founder's MA-03-then-MA-01 sequencing:
1. **MA-01 Gate 1 LangSmith rebuild** — re-wrap the lost client sites, confirm traces, correct the docs.
2. **Resume MA-02 (Ep2)** — now lighter (MA-03 proved the Tier-1 path); KB tool suite, doc-wiki path,
   connection-A canonical-path, the fix-it batch, and the MA-03 carry-forward verify items.
3. Then Ep4 → Ep5 → Ep6 → Ep7, per MA-01 scope.

## Standing operational rules (post-incident)
Commit to git after **every** milestone (uncommitted work has been lost across session boundaries).
Don't trust bash on this repo (stale/truncated); the founder's machine is authoritative.
