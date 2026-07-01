# Wiki System — Sub-phase 06 (Validation & Health) Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **execution agent** for Sub-phase 06 (Validation & Health) of the ArchitectOS Wiki System
build. You build the validation checks and health dashboards against **decided design**. Implementation
choices only, never design choices. If something needs a design decision beyond the inputs, **stop and flag it**.

## Orient first (read these, in order)

1. `.planning/wiki-system/phases/06-validation-health/06-RESEARCH.md` — the six A7 checks, five B8
   dashboards, and the `tags` addition.
2. `.planning/wiki-system/phases/06-validation-health/06-01-PLAN.md` — task spec + success criteria.
3. `.planning/wiki-system/phases/06-validation-health/CONTEXT.md` — scope + file targets.
4. `.planning/wiki-system/phases/03-schema-foundation/` — the schema object (`valid_tag`, `tag_taxonomy`,
   `frontmatter_contract`) and the live tables.
5. `.planning/wiki-system/phases/04-compilation/` — where to hook post-compile validation; stale signals.
6. `.planning/wiki-system/CONTEXT.md` §8 — the tags decision; `wiki_digest.counts` already exists.

## What you build

### 1. `tags` column (additive migration)
`docs/migrations/YYYYMMDD_wiki_tags.sql`: `alter table public.wiki_pages add column tags text[] not null
default '{}'`. Extend the schema object's `pages` map with per-page default tags drawn from `tag_taxonomy`,
and **backfill** the 7 fixed `wiki_pages` rows from those defaults. Non-breaking; contract stays `wiki-1.0`.

### 2. The six A7 checks (Supabase-side; structured findings; **no auto-fix**)
Broken provenance; frontmatter/contract; off-taxonomy tags (via `valid_tag()` against `wiki_pages.tags`);
stale/drifted; contested; orphans. Each returns `{claim_id|page_key, reason}`. Record both positions for
contradictions; never delete or auto-resolve.

### 3. The five B8 dashboards: `wiki_health(user_id)`
Return `open-questions`, `contradictions`, `low-confidence`, `claim-health`, `stale-pages`. **Persist the
rollup counts into `wiki_digest.counts`** so the digest stays the single cheap-context object.
`open-questions` + `contradictions` feed the Open Questions & Unresolved Tensions page (as questions,
never fabricated answers).

### 4. Hook
Call the validation set at the end of `compile_page` (in `wiki_compilation.py`); log + surface failures,
never swallow them.

## Hard constraints

- **No auto-fix / auto-resolution.** Checks surface findings; the human resolves (A3).
- **No consolidation/dreaming (07), no compilation logic (04) beyond the post-compile hook, no write
  surface (05), no UI.**
- **No substrate:** no `lint.py` / `discover_wiki.sh` / `init_wiki.sh`, no `reports/*.md` files, no CLI.
- The `tags` migration is **additive only** — do not alter `claim`/`evidence`/`digest` shapes; contract stays `wiki-1.0`.

## Done when

All six success criteria in `CONTEXT.md` are met: the six checks run and return findings without
auto-fixing; the five dashboards generate per user; counts land in `wiki_digest.counts`; the post-compile
hook runs; open-questions + contradictions populate the Open Questions page; the `tags` column exists,
backfilled and validated. Verify `python -m compileall python-backend`, the migration applies, and a
seeded case with a broken-provenance claim + an off-taxonomy tag is **flagged, not dropped**. Report back:
a one-paragraph summary, the new module + migration names, and confirmation counts reach the digest. Then
stop — sub-phase 07 is opened from the strategy thread.
