# Phase 0 Reconciliation Cleanups - Evidence and Founder Checkpoint

**Status:** At founder checkpoint - CLEAN-1, CLEAN-2, CLEAN-4, and CLEAN-5 complete; CLEAN-3 recommendation awaiting founder confirmation.
**Executed:** 2026-07-13
**Scope:** Behavior-preserving cleanup and read-only investigation only. No Python VCSO logic, wiki writer, schema, router, planner, or working-state changes.

## Plan 00-01 - Single Live VCSO Path

### CLEAN-5 - frontend endpoint confirmed

- `lib/virtualCsoApi.ts` sends chat turns to `backendApiUrl('/api/vcso/chat')`.
- `PYTHON_BACKEND_URL` comes from `import.meta.env.VITE_INGESTION_API_URL`.
- `vite.config.ts` and `vite.local.mjs` set that value from `VITE_INGESTION_API_URL`, falling back to `ARCHITECTOS_PYTHON_BACKEND_URL`.
- The deployed production bundle contains `https://api.architectospro.com` and `/api/vcso/chat`; it does not contain `ws5-chat`.
- If the backend env is absent the helper deliberately falls back to same-origin. That fallback was the ambiguity that made quarantine safer than deletion.

### CLEAN-1 - legacy route quarantined; writeback retained

The legacy Vercel `api/vcso/chat.ts` implementation was replaced with a disabled route carrying a prominent `DEPRECATED` banner. It now returns HTTP 410 and directs callers to the Python `/api/vcso/chat` service. It was not deleted because the frontend helper retains a same-origin fallback when its backend-base env is absent.

Reference check covered frontend call sites, all `api/` files, repository documentation, and rewrite/config files. There is no `vercel.json`. No live code references the retired `ws5-chat` implementation, and live usage has no `ws5-chat` rows in the checked ten-day window.

`api/vcso/writeback.ts` was **not** retired. The frontend calls `/api/vcso/writeback` directly. That route marks thread synthesis pending, triggers the existing WF-PS-03 writeback workflow, and can call the Python candidate-flush endpoint. It is an active bridge, not dead VCSO chat code.

### CLEAN-2 - architecture wording corrected

CLAUDE.md Rule #1 now identifies the interactive Virtual CSO lane as Python-served `/api/vcso/chat`, streamed by `VcsoChatService`, with its provider key held in the Python service environment. The N8N synthesis lanes and non-AI Vercel functions remain documented separately and unchanged.

### Verification

- Commits: `0c262fa0` (`v0.6.11`, legacy Vercel route quarantine) and `cff71299` (`v0.6.12`, architecture documentation correction).
- Production Vercel deployment `dpl_EQY27nAko6rHdMntNtQAYWs7BZnY` reached `READY` and aliases `architectospro.com`.
- `POST https://architectospro.com/api/vcso/chat` returns **410**.
- Unauthenticated `POST https://api.architectospro.com/api/vcso/chat` returns **401**, confirming the Python route remains active and protected.
- An authenticated production turn returned exactly `VCSO route healthy.`
- After that turn, live `ai_usage_log` showed `virtual_cso` = **78** in the ten-day window, latest `2026-07-13 15:24:16.878017+00`; no `ws5-chat` group was returned, so `ws5-chat` = **0**.
- `npm.cmd run build` passed (2,760 modules; only the existing chunk-size warning).
- Python source compile passed with vendored environments excluded. The literal recursive `python -m compileall python-backend` traversed the checked-in `python-backend/venv` and exceeded 120 seconds after compiling repository source; no Python source was changed.

## Plan 00-02 - Wiki Map and Feeder Status

### CLEAN-3 - live wiki map

Counts for founder `cd490873...`:

| Surface | Live count | Contents | Current reader | Writer / relationship |
|---|---:|---|---|---|
| `ose_knowledge_pages` | 12 | Rendered page content, canonical/page kinds, source IDs, optional thread origin, freshness, embedding | The main `VcsoChatService` context loader; `per_user_document_wiki` through `DocWikiReadService` | `WikiCompilationService` projects the seven fixed Layer-1 pages here; `DocWikiSynthesisService` writes emergent document/thread/sprint/agent Layer-2 pages |
| `wiki_pages` | 7 | Fixed Layer-1 page scaffold, narrative, one-line summary, stale/model metadata | `per_user_wiki` through `WikiReadService` | `WikiCompilationService` |
| `wiki_claims` | 52 | Structured claims, class, status, confidence, embeddings | `per_user_wiki` | Compilation plus governed writeback |
| `wiki_evidence` | 84 | Claim-level source provenance and citations | `per_user_wiki` | Compilation/evidence pipeline |
| `wiki_digest` | 1 | Per-founder wiki digest | `per_user_wiki` | Wiki compilation/digest pipeline |
| `wiki_insight_records` | 0 | Quarantined/promotable insights and trust state | `per_user_wiki` search | `WikiWritebackService` candidate flow |
| `wiki_contradictions` | 0 | Claim contradiction records | `per_user_wiki` | Wiki governance flow |

The seven overlapping canonical keys are `business_context`, `client_market_position`, `current_quarter_sprint`, `diagnostic_synthesis`, `financial_context`, `growth_constraints`, and `open_questions`. All seven OSE copies are `page_kind=wiki_layer1`, were mirrored from `wiki_pages`, have embeddings, and have no source-file IDs.

The other five OSE pages are emergent document-derived Layer-2 pages (`founder_dependency_delivery_systematization`, `harborline_legal`, `northlight_digital`, `revenue_concentration_forecasting_risk`, and `vantage_cloud`). They do not have matching `wiki_pages` rows.

**Relationship:** these are not two fully independent wikis. For the seven fixed Layer-1 keys, `wiki_*` is the structured upstream claim/evidence system and `ose_knowledge_pages` is its rendered projection/compatibility read surface. OSE additionally owns emergent Layer-2 pages that are not represented by the fixed `wiki_pages` scaffold. The main VCSO currently preloads only OSE pages; the dedicated wiki sub-agent can read structured `wiki_*` claims and evidence.

### Recommendation for founder confirmation - not encoded

For overlapping fixed Layer-1 knowledge, make `wiki_*` through `WikiReadService` / `per_user_wiki` the authoritative query-time source because it preserves claim-level evidence, precedence, confidence, contradictions, freshness, and citations. Treat `ose_knowledge_pages` as the authoritative read store for emergent Layer-2 pages and as a materialized projection, not a second authority, for those seven Layer-1 keys. A future composer would therefore read fixed Layer-1 components through `per_user_wiki`, emergent Layer-2 pages through `per_user_document_wiki`, and deduplicate the seven overlaps in favor of `wiki_*`.

This recommendation has **not** changed what the live VCSO reads. Conflict O2 remains open until the founder confirms or rejects it.

### CLEAN-4 - conversation feeder is deferred

The implementation seam exists: `DocWikiCSOThreadAdapter`, `/api/doc-wiki/synthesize-thread`, and `/api/doc-wiki/synthesize-pending-threads` can convert VCSO threads into `page_kind=thread_synthesis` OSE pages with `origin_thread_id`. No live caller of those endpoints was found in the repository, and the checked code cannot establish that WF-PS-03 invokes them.

Live evidence shows the conversation feeder is **not running**:

- Across founders, 18 VCSO threads were present and all 18 had `synthesis_status=pending`.
- No `ose_knowledge_pages` row had an `origin_thread_id`.
- The test founder had 15 pending threads, zero thread-origin pages, and five upload-linked emergent pages.
- Upload-to-wiki is therefore running; conversation-to-OS-Engine-to-wiki is a deferred dependency.

No feeder, writer, or page was built or modified. This does not block Phase 1, but the Phase 3 build-time compounding assumption must remain explicitly deferred until the existing adapter is operationally connected and live evidence appears.

## Checkpoint

Phase 0 must not be marked complete and O2 must not be marked resolved until London confirms the CLEAN-3 authority/read-path recommendation. O1 is resolved and O3 is scoped as deferred. No later Orchestration Harness phase has started.
