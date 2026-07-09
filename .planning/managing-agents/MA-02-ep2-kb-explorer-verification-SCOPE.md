# Managing-Agent Scope — MA-02: Episode 2 (KB Explorer + Wiki-Read) Live-Verification

> Successor to MA-01 (Ep1 Gate 1 passed). Same operating model: brains/engine split, serial,
> stop-at-checkpoint. Honors locks L1–L26. Governing method: `MA-01-testing-verification-debt-SCOPE.md`.
> **Note (2026-07-08):** MA-03 subsequently proved the Tier-1 synthesis path live for the test user, so
> Objective 2b is largely satisfied — this scope can be run lighter when resumed.

---

## Mission
Ep2 (KB Explorer, Phases 1–9) is **already built** — so this is a **verification episode, not a
reference-repo adaptation**. Prove the KB Explorer tool suite and the wiki-read surface run live, and
**close the connection-A "CSO uses the wiki" half** on the canonical path. Move Ep2 from
backend-complete → **backend-live-verified**. Discovery, not confirmation; fix-in-place contained bugs,
discover-and-report anything structural.

**Corrected architecture (from Gate 1):** `ose_knowledge_pages` has **two writers** — document-sourced
pages via `DocWikiSynthesisService._upsert_page` (live-verified in Gate 1), and the fixed Tier-1 scaffold
pages via `WikiCompilationService.compile_page/compile_event → _project_to_ose` (`page_kind='wiki_layer1'`).
No compile step for document pages. `DL-L1-EMBED` (embeddings for projected Layer-1 pages) was deferred.

## Prerequisites / environment
- Env + LangSmith wired. **GKE not needed for Ep2.**
- **Brains/engine split** (agent never boots the backend; founder runs live; agent uses Supabase MCP).
- **LangSmith trace is a standing evidence bar** (necessary, not sufficient — pair with DB/output checks).
- **Data dependency:** Obj. 2b (Tier-1 scaffold compile) needs a user with populated `ae_*/gm_*/sp_*/cc_*`
  data — seeded test user `cd490873-99aa-4533-9240-f0aa04deb54f`. (Largely done via MA-03.)

## Method
Derive each check from the Ep2 docs first (`.planning/knowledge-base-explorer/` ROADMAP + phase plans).
Two-rung scoring (backend-live-verified vs. usable); front-end (Phase 3 ingestion UI, Phase 9 chat UI) →
§8. Test the **canonical Python path**, never legacy Vercel. Timebox to earmarked enablements.

## Objectives (ordered)
**0. Fix-it batch (contained bugs from Gate 1 — fix-in-place).**
- **#4** stale model alias `services/citations/verify.py` `claude-3-5-haiku-latest` → repoint to a valid model.
- **#3** silent `except: pass` on `/api/doc-wiki/synthesize-document` → add logging.
- **#1** HTML/MD ingestion (in beta scope) — migration adding `html`/`md` to
  `ose_raw_document_registry_file_type_check`, then verify an HTML + MD doc ingest cleanly.

**1. KB Explorer tool suite — live-verified.** Phase 1 folder CRUD + RLS; Phase 2 doc-folder + `full_markdown`;
Phases 4–6 `ls`/`tree`/`grep`/`glob`/`read`; Phase 7 Explorer sub-agent. (Phase 3 UI → §8.)

**2. Two-writer wiki population.** 2a document writer confirm green. 2b **Tier-1 scaffold path** — prove
`compile_page`/`compile_event` → `_project_to_ose` writes `wiki_layer1` pages for a user with real data
(**largely done in MA-03 — verify + close carry-forward items**). 2c `DL-L1-EMBED` — projected pages
embedded/searchable (closed in MA-03).

**3. Wiki-read surface.** `wiki_search`/`get_page`/`list` return both document + Tier-1 pages, via KB
Explorer and canonical VCSO; citation-shaped outputs (L24).

**4. Connection-A "CSO uses the wiki" (canonical path).** Confirm the canonical Python `VcsoChatService`
retrieves + cites the wiki. **Resolve the router divergence:** Phase 9's keyword router lives in legacy
Vercel `api/vcso/chat.ts`; the canonical Python path uses in-loop tools + pre-injected pages + a skill/IP
classifier. Report which is canonical + whether Phase 9 router logic needs porting (structural →
discover-and-report). "Domain Agents consult the wiki" stays Ep6.

## Carry-forward verify items (from MA-03 checkpoint 1)
- The narrowed unique index vs. the new-user onboarding scaffold row.
- `open_questions` compiles after the other 6 and reads current (not stale) state.
- `current_quarter_sprint` and `growth_constraints` share an `ose_page_type` — confirm reads by
  `page_type` don't pick the wrong page (reads by `canonical_key` are unique, so fine).
- The MA-03 anti-clobber guard behaves correctly under Ep2's exercises.

## Deliverables (then STOP)
Ep2 Enablement Matrix · fix-it batch merged · Tier-1 scaffold verify + carry-forwards · canonical-path +
Phase 9 router recommendation · connection-A status · `Pro-Suite-Progress.md` updated. **Do not start Ep4.**

## Out of scope
§8 front-end, the router build (C), "Domain Agents consult the wiki" (Ep6), post-MVP/v1. Locks L1–L26,
esp. L24, L22/L11.
