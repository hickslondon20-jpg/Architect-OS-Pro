# Document Wiki (Layer 2) — Reference Map

Maps the **theafh "LLM Wiki" emergent pattern** — the half we deliberately *skipped* for Layer 1
(`../wiki-system/REFERENCES.md`) and now **adopt** for Layer 2 — to its consuming sub-phase, with
extract/skip notes. Adopt the **model and conventions, never the substrate** (Supabase + pgvector + the
existing OS Engine tables, not markdown-on-disk / Obsidian / CLIs).

**Sources (verified):** theafh `knowledge_management` `wiki` skill + the attached "LLM Wiki Overview"
(`plugins/knowledge_management/skills/{wiki,wiki_import,wiki_wrapup,wiki_fix,executive_summary,spr}`,
`agents/wiki_auto_shaper`). Mechanics already extracted in `../wiki-system/REFERENCES.md`.

---

## Adoption → sub-phase → extract / skip

| # | Adopt | Sub-phase | EXTRACT | SKIP |
|---|---|---|---|---|
| L2-1 | **Emergent page-type taxonomy** (entity/concept/comparison/summary/query/procedure) | 02 | The *concept* of emergent types → our `page_kind` vocabulary (client/competitor/vendor/offer/method/market-trend/comparison/query-answer/sprint-history/thread-synthesis) | the on-disk `SCHEMA.md` + frontmatter-enum mechanism; their exact type list |
| L2-2 | **Ingest operation** (read source → extract → write/update page → update index → update related pages → log; touches 10–15 pages) | 03, 04 | The synthesis flow as our automated engine + per-source adapters | "discuss takeaways with the user" human-in-loop step (we chose automated) |
| L2-3 | **Page thresholds** (create when central / 2+ sources; skip passing mentions; split >~200 lines) | 03 | Page-worthiness rules → the engine's "within reason" gate | — |
| L2-4 | **Provenance** (claim-pinned inline citations + a validated source inventory) | 02, 03 | `source_file_ids` manifest + inline citations to source docs/chunks | footnote markers; markdown `sources:` frontmatter |
| L2-5 | **Cross-references / the graph** (every page links ≥2 others; orphans are a lint finding) | 02, 06 | Page→page links (the `connected_pages`/links graph) | Obsidian graph view |
| L2-6 | **`wiki_wrapup`** (synthesize the current chat *session* into pages) | 04 | The model for the **CSO-thread adapter** (a thread → page) | the interactive triage report (automated for us) |
| L2-7 | **Index + Log** (`index.md` catalog + append-only `log.md`) | 02, 06 | `IndexView`/catalog semantics + `ose_activity_log` event log | markdown files; `grep`-parseable log prefix |
| L2-8 | **Lint** (contradictions, stale, orphans, missing-page-for-mentioned-concept, missing cross-refs, data gaps) | 06 | The check set → health/lint over `ose_knowledge_pages` | `lint.py`; the on-disk discover/init scripts |
| L2-9 | **`wiki_auto_shaper`** assess→fix→verify | 06 | Reuse Layer 1's consolidation pattern, write-scoped | in-place destructive edits; auto-resolve of contradictions |
| L2-10 | **`executive_summary` / `spr`** | 03 | `executive_summary` as the page-prose generation primitive (self-rating → `confidence`) | SPR (post-beta); CLI packaging |

**Reused from Layer 1 (`../wiki-system/`):** the FastAPI compilation/orchestrator-tools pattern, the
override-survives-rebuild discipline (B7 → corrections lifecycle), the action-log + health pattern, and
the boundary contract (`ose_page_type` bridge; Layer 2 never duplicates the claim store).

**Reused from KB Explorer (`../knowledge-base-explorer/`):** `kb_ls/tree/grep/glob/read` + `full_markdown`
+ `match_document_chunks` as the **evidence-collection substrate** the document adapter reads from.

## Hard rule

Every item above contributes a *model, convention, or loop* — never a filesystem layout, CLI, Obsidian
render, or markdown-on-disk store. Our substrate is Supabase + pgvector + the existing OS Engine tables.
