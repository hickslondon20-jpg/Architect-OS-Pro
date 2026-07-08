# B3 RESEARCH — Consolidated live-apply + acceptance (extraction)

**Extraction target:** the exact staged migrations to apply live, how to verify them, the acceptance matrix,
and the seeded-geometry-chunk technique for the pixel smoke when Docling is absent. **Live schema clearance is
granted (CONTEXT §8).** Verified 2026-07-06.

---

## §1 Live-apply order + verifies (MCP `apply_migration`; additive/idempotent)

Apply in order; verify each before the next.

### R1 — `docs/migrations/20260706_vcso_message_citations.sql`
```sql
alter table public.vcso_chat_messages add column if not exists citations jsonb not null default '[]'::jsonb;
```
Verify: `select column_name from information_schema.columns where table_name='vcso_chat_messages' and column_name='citations';`
(A4 verdicts persist inside these entries — no separate column.)

### R2 — `docs/migrations/20260706_citation_verifier_model_setting.sql`
Upserts an `ai_models` row (`claude-3-5-haiku-latest`, family `utility`) + a `platform_ai_settings` row
(`citation_verifier`). **Dependency:** `public.ai_models` + `public.platform_ai_settings` must exist — confirm
via MCP first; if absent, they're required for the verifier route (create per the migration's assumed columns).
Verify: `select setting_key, fallback_model_name from public.platform_ai_settings where setting_key='citation_verifier';`

### BG — `docs/migrations/20260706_document_chunks_geometry.sql` (B0)
Additive `page_number int`, `bbox jsonb`, `verbatim text` on `document_chunks`.
Verify: `select column_name from information_schema.columns where table_name='document_chunks' and column_name = any(array['page_number','bbox','verbatim']);`

### R3 — platform-record tables (confirm; act per dormancy rule)
Confirm existence of the 15 A2 registry tables: `mra_checkpoints`, `gm_assessment_checkpoint_scores`,
`ae_assessments`, `ae_dimension_scores`, `ae_assessment_insights`, `sp_sprint_goals`, `sp_sprint_initiatives`,
`sp_sprint_milestones`, `quarter_map_selections`, `cc_versions`, `cc_synthesis`, `clarity_compass_versions`,
`reflection_reviews`, `founder_dataset_rows`, `founder_dataset_rows_v`.
- **`reflection_reviews`**: expected absent → **leave dormant** (do not fabricate; source feature unwired).
- **`cc_versions` vs `clarity_compass_versions`**: check they aren't duplicative; keep whichever the resolver
  registry actually reads.
Verify: `select table_name from information_schema.tables where table_schema='public' and table_name = any(array[...]);`

## §2 Acceptance matrix (now live)

- **Ep7A live smoke** — re-run `python-backend/tests/test_ep7a_acceptance.py` (A6 Track 1) against live schema:
  lit families (`document_chunk`, `wiki_page`, `platform_record`) resolve; citations persist on
  `vcso_chat_messages.citations`; the verifier grades on the utility model. `web` pending-producer;
  `reflection_reviews` dormant.
- **Ep7B geometry smoke** — see §3.
- **L18 pending-live** — run the items now runnable (sandbox verify, tool-loop credential checks) against live.

## §3 Ep7B geometry smoke — real ingest OR seeded chunk

The full chain is ingest (B0) → geometry columns (BG) → resolve (B1) → highlight (B2). BG is now live, so:

- **Path A (Docling available):** ingest a real PDF via the ingestion path; confirm its `document_chunks` rows
  carry `page_number`/`bbox`/`verbatim`. Then resolve one chunk (B1) → `locator.kind="bbox"`; hit the B2
  signed-URL endpoint + confirm the render/transform.
- **Path B (Docling absent — env-gated, the likely case):** **seed a geometry-bearing chunk row** directly into
  live `document_chunks` for a real PDF already in the raw-document bucket: set `page_number`, `bbox`
  (`{page_no,l,t,r,b,coord_origin,charspan,page_w,page_h}` — real values), `verbatim`, pointing at that PDF's
  `document_id`. Then:
  - **B1:** resolve that chunk → assert `locator.kind="bbox"` + geometry present + `verbatim` = raw face.
  - **B2:** `GET /api/documents/{document_id}/signed-url` returns an owner-scoped URL; the transform
    (`citationPdfGeometry.ts`) maps the seeded box correctly (unit-level or headless).
  This proves the **resolve→highlight** half live without Docling. The **ingest→geometry** half (Docling
  producing the box) stays covered by B0's unit tests + pinned API until Docling is installed.

Clean up any seeded test rows after (they're synthetic — not user data).

## §4 Guardrails (CONTEXT §8 clearance)

- **Additive/idempotent only.** No drops, no column removals, no data deletion, no restructuring, **no backfill**
  (L10). If a change looks destructive/non-additive → **stop and flag**.
- **`reflection_reviews` dormant** — do not fabricate an empty source table.
- **Verify after every apply.** Prefer MCP `apply_migration` for DDL; `execute_sql` for the read verifies.
- **Docling install is an env matter, not schema** — if absent, use Path B; do not block B3 on it.
