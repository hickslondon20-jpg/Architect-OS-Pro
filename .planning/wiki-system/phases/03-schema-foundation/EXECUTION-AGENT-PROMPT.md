# Wiki System — Sub-phase 03 (Schema Foundation) Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **execution agent** for Sub-phase 03 (Schema Foundation) of the ArchitectOS Wiki System
build. You build two plans in order — **03-01 (Supabase schema)** then **03-02 (schema/config
object)** — against **decided design**. You make implementation choices (migration naming, column
ordering, index types, where the config module lives), never design choices. If something needs a
design decision beyond the inputs, **stop and flag it**.

## Orient first (read these, in order)

1. `.planning/wiki-system/phases/03-schema-foundation/03-RESEARCH.md` — build-ready extraction.
   **Key rule: shapes are frozen by the contract — match it field-for-field; do not re-derive.**
2. `.planning/wiki-system/phases/03-schema-foundation/03-01-PLAN.md` and `03-02-PLAN.md` — the two specs.
3. `.planning/wiki-system/phases/03-schema-foundation/CONTEXT.md` — scope + success criteria.
4. `.planning/wiki-system/phases/02-interface-contract/02-01-CONTRACT.md` — **authoritative shapes**
   for `claim`/`evidence`/`digest`; build tables to match exactly.
5. `.planning/wiki-system/CONTEXT.md` §8 — amendments (GM tables, `global_checkpoint`, 5-stage model,
   OSE scaffold, `GlobalIpReadService`).
6. `.planning/wiki-system/phases/01-verify-delta/01-01-DELTA.md` §A (GM tables + the join), §C/§E (OSE).
7. `docs/migrations/` + the `kb_folders` migration — mirror its migration + RLS style exactly.

## What you build

### Plan 03-01 — migration `docs/migrations/YYYYMMDD_wiki_schema.sql`
Per-user tables (RLS by `user_id`, mirroring `kb_folders`): `wiki_pages`, `wiki_claims`,
`wiki_evidence`, `wiki_contradictions`, `wiki_insight_records`, `wiki_action_log`, `wiki_digest`.
Global table (NO founder-facing RLS — service-role only): `global_ip_pages`.
- **Match the contract shapes** (03-RESEARCH §1): `wiki_claims` carries `class`, `status`,
  `confidence` (enum), `recall_score`, `superseded_by`, `embedding VECTOR(1536)`; `wiki_evidence`
  carries `source_id`, `source_kind∈{raw_document,document_chunk,tier0_record,global_checkpoint}`,
  `path`, `lines INT4RANGE`, `weight`, `note`.
- **Action-boundary fields** on `wiki_insight_records` (nullable): `safe_to_act_after`, `expires_at`,
  `authority_owner`, `avoid_note`, plus `trust_state`, `recall_count`, `query_diversity`, the D11
  gate flags (03-RESEARCH §3/§5).
- **Compiled-base write-lock:** a `BEFORE INSERT/UPDATE` trigger on `wiki_claims` rejects
  `class='compiled'` unless the session carries the compilation-service marker (service-role + guarded
  path). Document the exact mechanism in the migration.
- `global_ip_pages.ladder_stage` is 1..5 (model all 5; content currently 1–4 — comment it). Do **not**
  recreate the GM checkpoint family — it is referenced at read time via the §A join.
- pgvector columns on `wiki_pages`, `wiki_claims`, `global_ip_pages`; indexes per 03-01-PLAN.
- Re-run `generate_typescript_types` after applying.

### Plan 03-02 — the versioned schema/config object
One canonical home (a typed config module **plus** a `wiki_schema` Supabase row) read by both Python
and TS. Declares: `wiki_schema_version: "wiki-1.0"`; the 7 pages with `kind`; the confidence/status/
class enums; the frontmatter contract; contradiction fields; the tag taxonomy (domains; stages 1..5
named Rising/Striving/Thriving/Driving/Arriving with the 1–4-content note; tiers — confirm tier labels
from 01-DELTA); and the helper functions (`is_compiled_base_only`, `is_insight_accreting`, `valid_tag`,
`valid_page_key`, `valid_confidence`, `event_rebuild_targets`). Keep our 7 `page_key`s canonical;
record (do not collapse) the mapping to the 5 `seed_core_knowledge_pages()` OSE types.

## Hard constraints

- **Match the frozen contract.** If a column would diverge from `02-01-CONTRACT.md`, stop and flag.
- **Do not migrate or rebuild `ose_*` tables.** They are the render-adapter target, not a conflict.
- **Do not recreate the GM checkpoint family.** Reference it; `source_kind='global_checkpoint'`.
- **No substrate** — no `SCHEMA.md`-on-disk, no markdown vault layout, no page-type enum from the repos.
- **No compilation, handlers, embeddings population, write-surface logic, or UI.** Tables + RLS +
  trigger + the schema object only.
- Global IP must be **unreachable by a founder JWT** (service-role only).

## Done when

All seven success criteria in `CONTEXT.md` are met: migration applies; RLS isolates per-user and
hides `global_ip_pages` from founders; the write-lock trigger rejects a non-service `class='compiled'`
insert; pgvector columns exist; shapes match the contract; the versioned schema object exists and is
read by both runtimes; types regenerated. Verify with a test insert/select (and an out-of-band
`class='compiled'` insert that must be **rejected**). Report back: a one-paragraph summary, the
migration filename, and confirmation that shapes match `wiki-1.0`. Then stop — sub-phase 04 is opened
from the strategy thread.
