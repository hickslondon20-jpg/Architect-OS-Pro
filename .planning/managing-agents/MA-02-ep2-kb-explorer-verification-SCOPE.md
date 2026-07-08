# Managing-Agent Scope — MA-02: Episode 2 (KB Explorer + Wiki-Read) Live-Verification

> Draft for founder review. **Not yet spun up.** Authored 2026-07-08. Successor to MA-01 (Ep1
> Gate 1 passed). Same operating model: brains/engine split, serial, stop-at-checkpoint. Honors
> locks L1–L26. Governing method: `MA-01-testing-verification-debt-SCOPE.md`.

---

## Mission

Ep2 (KB Explorer, Phases 1–9) is **already built** — so this is a **verification episode, not a
reference-repo adaptation** (that delta was spent at build time). Prove the KB Explorer tool
suite and the wiki-read surface run live, and **close the connection-A "CSO uses the wiki" half**
on the canonical path. Move Ep2 from backend-complete → **backend-live-verified**. Discovery, not
confirmation; fix-in-place contained bugs, discover-and-report anything structural.

**Built on the corrected architecture (from Gate 1):** `ose_knowledge_pages` has **two writers** —
document-sourced pages via `DocWikiSynthesisService._upsert_page` (**live-verified in Gate 1**),
and the fixed Tier-1 scaffold pages via `WikiCompilationService.compile_page/compile_event →
_project_to_ose` (`page_kind='wiki_layer1'`, **unproven live**). No compile step for document
pages. `DL-L1-EMBED` (embeddings for projected Layer-1 pages) was deferred.

## Prerequisites / environment

- Env + LangSmith already wired (Ep1 Task 0). **GKE not needed for Ep2.**
- **Brains/engine split (unchanged):** the agent never boots the backend in its sandbox (no
  egress). Founder runs the backend + live actions on their machine; the agent writes scripts,
  reads the DB via **Supabase MCP**, and interprets logs.
- **LangSmith trace is now a standing evidence bar** for any Python-backend LLM call on the
  critical path (necessary, not sufficient — pair with DB/output checks).
- **Data dependency to flag first:** proving the **Tier-1 scaffold compile path** (Obj. 2b)
  needs a user with populated platform tables (`ae_*`, `gm_*`, `sp_*`, `cc_*` — diagnostics,
  sprints, clarity compass). With no beta users yet, the founder may need to seed or use their
  own account with real diagnostic/sprint data. The agent surfaces exactly what's needed.

## Method (same as MA-01)

Derive each check from the Ep2 docs first (`.planning/knowledge-base-explorer/` ROADMAP +
phase plans). Score every enablement on two rungs — **backend-live-verified** vs. **usable** —
and log front-end gaps (Phase 3 ingestion UI, Phase 9 chat UI) as **§8 items, not Ep2 failures.**
Test the **canonical Python path**, never legacy Vercel. Timebox to earmarked enablements; no §8
work, no new features.

## Objectives (ordered)

**0. Fix-it batch (contained bugs carried from Gate 1 — fix-in-place).**
- **#4 stale model alias:** `services/citations/verify.py` `UTILITY_FALLBACK_MODEL =
  claude-3-5-haiku-latest` 404s live — repoint to a valid current utility model.
- **#3 silent error swallow:** `/api/doc-wiki/synthesize-document` → `_run_doc_wiki_synthesis`
  bare `except: pass` — add logging (mirror the auto-path `_write_log`).
- **#1 HTML/MD ingestion (now in beta scope, founder-confirmed):** the
  `ose_raw_document_registry_file_type_check` constraint rejects `html`/`md` — write + apply
  (Supabase MCP) a migration adding them, then verify an HTML and a Markdown doc ingest cleanly.

**1. KB Explorer tool suite — live-verified over real folders + documents.** Phase 1 folder
CRUD + RLS; Phase 2 doc-folder integration + `full_markdown` stored; Phases 4–6 tools
(`ls`/`tree`/`grep`/`glob`/`read`) return correct results over real ingested docs; Phase 7
Explorer sub-agent orchestrates them and returns synthesized findings (not raw output). Score
each on the two rungs (Phase 3 ingestion UI → §8).

**2. Two-writer wiki population.**
- 2a. Document writer — **confirm still green** (Gate 1 proved it; re-confirm after the fix-it batch).
- 2b. **Tier-1 scaffold path (unproven) — prove it live:** `compile_page`/`compile_event` →
  `_project_to_ose` writes `wiki_layer1` pages to `ose_knowledge_pages` for a user with real
  platform data. Report whether it works or what breaks (structural findings → report, don't
  silently redesign).
- 2c. **`DL-L1-EMBED`:** are projected Layer-1 pages embedded / semantically searchable, or
  key-lookup only? Report the gap; decide if it's MVP or defer.

**3. Wiki-read surface.** `wiki_search`/`wiki_get_page`/`wiki_list` return **both** document
pages **and** Tier-1 scaffold pages, via the KB Explorer and the canonical VCSO. Confirm
citation-shaped outputs (`source_kind: wiki_page`) so Ep7 wiki-page citations can light up (L24).

**4. Connection-A — "CSO uses the wiki" (canonical path).** Confirm the **canonical Python
`VcsoChatService`** retrieves + cites the wiki in a normal turn. **Resolve the router divergence:**
Phase 9's keyword retrieval router lives in the legacy Vercel `api/vcso/chat.ts` (rollback-only),
while the canonical Python path reaches the wiki via in-loop tools + pre-injected pages + a
skill/IP classifier. Report which is canonical, whether the Phase 9 router logic needs porting to
the Python lane, and whether that's MVP or v1 (structural → **discover-and-report**, feeds the
router evidence point). The "Domain Agents consult the wiki" half of connection-A stays in Ep6.

## Deliverables (then STOP)
Ep2 Enablement Matrix (two-rung) · fix-it batch merged (+ HTML/MD migration applied & verified) ·
Tier-1 scaffold-path finding (works / breaks / data needed) · `DL-L1-EMBED` decision input ·
canonical-path + Phase 9 router recommendation · connection-A "CSO uses wiki" status ·
`Pro-Suite-Progress.md` updated. **Checkpoint back to founder. Do not start Episode 4.**

## Checkpoints
Structural findings — especially the router divergence and any Tier-1 compile-path break —
surface **immediately**, not batched. Otherwise report at the Ep2 checkpoint.

## Out of scope
§8 front-end (Phase 3 ingestion UI, Phase 9 chat UI, wiring anything into the real UI), the
router **build** (C), "Domain Agents consult the wiki" (Ep6), and all post-MVP/v1 items. The
fix-it batch is the only code change beyond verification.

## Locks
Honor L1–L26; especially L24 (Ep7 consumes what this surfaces), L22/L11 (citation currency +
curated trace). Flag conflicts; never override without founder sign-off.

## Open items for founder before spin-up
1. Can you provide/seed a user account with real platform data (`ae_*`/`gm_*`/`sp_*`/`cc_*`) so
   Obj. 2b (Tier-1 scaffold compile) can actually run? If not, 2b becomes report-only.
2. Confirm the fix-it batch (0) rides the front of Ep2 vs. a separate micro-pass first.
