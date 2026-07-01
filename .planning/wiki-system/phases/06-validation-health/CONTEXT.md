# Sub-phase 06 Context — Validation & Health

**Date:** 2026-06-30
**Outcome:** Ready to execute. Lighter extraction (REFERENCES pinned the lists); the one new build
element is the per-page `tags` column (CONTEXT §8 decision). Builds on the live schema + compile path.

---

## What this sub-phase is

The validation/health layer: the A7 checks that run after each compile and on demand, and the five B8
health dashboards. Output feeds the Open Questions page and the digest counts. **Findings only — nothing
auto-fixes** (record both positions, leave resolution to the human).

---

## Inputs the agent must read first

1. `06-RESEARCH.md` (this folder) — the six A7 checks, the five B8 dashboards, the `tags` addition.
2. `06-01-PLAN.md` (this folder) — task spec + success criteria.
3. `../03-schema-foundation/` — the schema object (`valid_tag`, `tag_taxonomy`, `frontmatter_contract`),
   `wiki_pages`/`wiki_claims`/`wiki_contradictions`/`wiki_evidence`.
4. `../04-compilation/` — hook validation into `compile_page`; reuse stale/freshness signals.
5. `../../CONTEXT.md` §8 — the tags decision; the digest `counts` field already exists in `wiki_digest`.

---

## Decisions already made (do not re-open)

- Six A7 checks (incl. off-taxonomy, now live via `tags`), five B8 dashboards — exact lists in 06-RESEARCH.
- **No auto-fix** — checks return structured findings; resolution is the human's (A3).
- `tags text[]` added to `wiki_pages` (additive); validated by `valid_tag()`; 7 pages backfilled from the schema object.
- Health counts persist into `wiki_digest.counts`; open-questions + contradictions feed the Open Questions page.
- Validation runs post-compile (hook into 04) and is reused by 07's consolidation assess step.

---

## What this sub-phase does NOT do

- No auto-resolution / auto-fix of findings.
- No consolidation/dreaming (07) — 06 only *provides* the checks 07 consumes.
- No compilation logic (04) beyond adding the post-compile validation call.
- No write surface (05), no UI, no reference-repo substrate (no `lint.py`, no `reports/*.md` files).

---

## Files to be created or modified

| File | Action | Notes |
|---|---|---|
| `docs/migrations/YYYYMMDD_wiki_tags.sql` | **Create** | `alter table wiki_pages add column tags text[] not null default '{}'` + backfill the 7 pages. |
| schema object (json/ts/py) + `wiki_schema` row | **Modify** | Per-page default tags in the `pages` map. |
| `python-backend/services/wiki_health.py` (or similar) | **Create** | The six A7 checks + `wiki_health(user_id)` returning the five dashboards; persist counts → digest. |
| `python-backend/services/wiki_compilation.py` | **Modify** | Call the validation set at the end of `compile_page`. |

---

## Success criteria (from `06-01-PLAN.md`)

1. All six A7 checks run against real data and return structured findings without auto-fixing.
2. All five B8 dashboards generate per user; counts land in `wiki_digest.counts`.
3. Post-compile hook runs validation automatically.
4. Open-questions + contradictions populate the Open Questions page.
5. A claim with broken provenance or an off-taxonomy tag is flagged, not dropped.
6. `tags` column exists, backfilled for the 7 pages, validated by `valid_tag()`.

---

## Handoff

When validation + dashboards run (post-compile + on demand) and counts reach the digest, the strategy
thread opens **sub-phase 07 (consolidation)** — the internal dreaming cycle that consumes these checks,
with its own extraction (A5 `auto_shaper_wiki` loop, B3 dreaming gates).

*Context written: 2026-06-30 — Discuss/Plan thread.*
