# Sub-phase 03 Context — Schema Foundation

**Date:** 2026-06-30
**Outcome:** Ready to execute. The contract is frozen (`wiki-1.0`), the extraction is done
(`03-RESEARCH.md`), and the 01-delta corrections are folded in. This sub-phase has **two plans**,
built in order by one execution agent: **03-01 (Supabase schema)** then **03-02 (schema/config object)**.

---

## What this sub-phase is

The storage foundation. It creates the per-user and global Supabase tables, RLS, the compiled-base
write-lock, embeddings columns, the action-log, and the digest store (03-01), plus the single
versioned schema/config object that compilation (04) and validation (06) both read (03-02).

The schema **must match the frozen contract field-for-field** — `02-01-CONTRACT.md` is the
authoritative shape source. The extraction (`03-RESEARCH.md`) only adds what the contract did not
pin: the schema-object structure (A1), action-boundary fields, the `class` block model (B7), and the
B3/B4 gate + reversibility fields.

---

## Inputs the agent must read first

1. `03-RESEARCH.md` (this folder) — build-ready extraction + the "match the contract" rule.
2. `03-01-PLAN.md` and `03-02-PLAN.md` (this folder) — the two task specs + success criteria.
3. `../02-interface-contract/02-01-CONTRACT.md` — **authoritative shapes** for `claim`/`evidence`/`digest`
   and the named orchestrator seams the schema must be compatible with.
4. `../../CONTEXT.md` — locked decisions; §8 amendments (GM tables, `global_checkpoint`, 5-stage model,
   OSE scaffold, `GlobalIpReadService`).
5. `../01-verify-delta/01-01-DELTA.md` §A (real GM tables + join), §C/§E (OSE scaffold; no migration).
6. `docs/migrations/` + the `kb_folders` migration — match the existing migration + RLS style.

---

## Decisions already made (do not re-open)

- `claim` / `evidence` / `digest` shapes are **frozen by the contract**. Build tables to match.
- Source-kind set: `raw_document, document_chunk, tier0_record, global_checkpoint`; per-user wiki
  source kinds `wiki_page, wiki_claim, wiki_evidence, wiki_digest`.
- Confidence is dual: display enum on the claim + hidden `recall_score`.
- 7 canonical `page_key`s; compiled-base-only = diagnostic_synthesis + current_quarter_sprint.
- Global IP is service-role only; the GM checkpoint family is **referenced, not recreated**.
- Stage taxonomy models 5; content currently 1–4; stage-5 is a known gap, not a constraint.
- Action-boundary fields are nullable, populated only for action-sensitive insights.

---

## What this sub-phase does NOT do

- No compilation logic, no embeddings *population*, no handlers, no retrieval (04+).
- No write-surface implementation (05) beyond the tables it writes to.
- No consolidation/health logic (06/07).
- No UI; no migration of `ose_*` tables.
- No reference-repo substrate (no markdown vault, no `SCHEMA.md` file, no page-type enum).

---

## Files to be created or modified

| File | Action | Notes |
|---|---|---|
| `docs/migrations/YYYYMMDD_wiki_schema.sql` | **Create** | All `wiki_*` tables + `global_ip_pages`, indexes, RLS, compiled-base write-lock trigger, pgvector columns. |
| schema-object home (config module + `wiki_schema` Supabase row) | **Create** | The versioned declaration (03-02); one canonical source read by Python + TS. |
| generated TS types | **Modify** | Re-run `generate_typescript_types` so the frontend sees the new tables. |

---

## Success criteria (from 03-01 + 03-02 plans)

1. Migration applies cleanly; all `wiki_*` + `global_ip_pages` tables, indexes, RLS exist.
2. Founder JWT reads its own `wiki_*` rows and **cannot** read `global_ip_pages`.
3. Compiled-base write-lock trigger rejects a non-service `class='compiled'` insert.
4. `pgvector` columns present on pages, claims, and global IP pages.
5. Table shapes match `02-01-CONTRACT.md` `claim{}`/`evidence{}`/`digest{}` exactly.
6. One canonical versioned schema object exists; both Python and TS read it; all 7 pages declared
   with correct `kind`; enums + taxonomy + frontmatter contract present; version = `wiki-1.0`.
7. `generate_typescript_types` re-run.

---

## Handoff

When the migration applies and the schema object is in place, the storage foundation is done. The
strategy thread opens **sub-phase 04 (compilation)** with its extraction pass (B2 compile pipeline,
B7 managed blocks, A6 executive_summary) — building `compile_page` against this schema and the real
Tier 0 event map.

*Context written: 2026-06-30 — Discuss/Plan thread.*
