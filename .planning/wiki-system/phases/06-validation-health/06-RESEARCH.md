# Sub-phase 06 — Reference Extraction (build-ready)

**Purpose:** turns the `REFERENCES.md` pointers for sub-phase 06 into decided design for `06-01-PLAN.md`:
the A7 validation checks and the B8 health dashboards, plus the per-page `tags` column the off-taxonomy
check now needs. Lighter extraction — REFERENCES already pinned the exact lists; this maps them to our
live schema.

**Sources (verified 2026-06-29):** theafh `wiki/SKILL.md` `<lint_and_audit>` buckets + `references/
lint_checks.md` (A7); OpenClaw memory-wiki "Dashboards and health reports" (B8). Port the *checks and the
report set*, never `lint.py` or `reports/*.md` files.

---

## 1. A7 — Validation checks → Supabase-side logic (run post-compile + in consolidation)

Each returns **structured findings** (`claim_id`/`page_key`/`reason`); **none auto-fix** (record-both-
positions, leave resolution to the human — A3 / "name the tension").

| Check | Our realization |
|---|---|
| **Broken provenance** | `wiki_claims` with zero `wiki_evidence` rows, or evidence whose `source_id` does not resolve to a real source record. |
| **Frontmatter / contract** | `wiki_pages` missing a required `frontmatter_contract` field (`page_key`, `wiki_version`, `last_compiled_at`, `tags`); claims with class/status/confidence outside the enums (enums already CHECK-enforced — this catches drift via the API path). |
| **Off-taxonomy tags** (now live) | any value in `wiki_pages.tags` not in the schema-object `tag_taxonomy`, via `valid_tag()`. |
| **Stale / drifted** | `wiki_pages.stale=true` or `last_compiled_at` older than the latest source change; evidence pointing at superseded source versions. |
| **Contested** | open `wiki_contradictions` (`resolved=false`) and/or claims with `status='contested'`. |
| **Orphans** | `wiki_pages` with zero claims; claims with zero evidence (overlaps broken provenance — report once). |

---

## 2. The `tags` column (the one new build element — CONTEXT §8 decision)

- Additive migration: `alter table public.wiki_pages add column tags text[] not null default '{}';`
  (non-breaking; contract stays `wiki-1.0`).
- Extend the schema-object `pages` map with per-page default tags drawn from `tag_taxonomy`
  (e.g. `financial_context → ['financial']`, `client_market_position → ['clients','positioning']`).
- **Backfill** the 7 fixed `wiki_pages` rows from the schema-object defaults so the off-taxonomy check has
  real data. `valid_tag()` (declared in 03-02) is the validator.

---

## 3. B8 — Health dashboards → `wiki_health(user_id)` (generated surfaces, per user)

Adopt the **exact five** (OpenClaw): `open-questions`, `contradictions`, `low-confidence`,
`claim-health`, `stale-pages`. Realize as a `wiki_health(user_id)` service returning all five; **persist
the rollup counts into `wiki_digest.counts`** so the digest stays the single cheap-context object.

| Dashboard | Our source |
|---|---|
| `open-questions` | unresolved question/tension claims on the `open_questions` page |
| `contradictions` | open `wiki_contradictions` clusters |
| `low-confidence` | claims with `confidence='low'` |
| `claim-health` | claims missing evidence / contested / stale freshness |
| `stale-pages` | `wiki_pages.stale=true` / old `last_compiled_at` |

**`open-questions` + `contradictions` feed the Open Questions & Unresolved Tensions page** — gaps and
tensions surface there as *questions*, never fabricated answers.

---

## 4. Hooks

- **Post-compile:** `compile_page` (04) calls the validation set on completion; failures are logged +
  surfaced on the dashboards, not silently swallowed. (Add the call at the end of `compile_page`.)
- **Consolidation (07):** the dreaming cycle consumes the same checks in its assess step (07 reads 06).

---

## 5. Extract / skip summary

| Adopt (checks + report set) | Reject (substrate) |
|---|---|
| the six A7 checks; the five B8 dashboards; counts→digest; no-auto-fix rule | `lint.py` / `discover_wiki.sh` / `init_wiki.sh`; `reports/*.md` files; Obsidian render; `wiki_lint` CLI |

*Extraction complete for sub-phase 06. The agent adds the `tags` column + backfill, implements the six
A7 checks + five B8 dashboards as Supabase-side logic, persists counts into the digest, and hooks
validation into `compile_page`. No auto-fix, no consolidation (07), no UI.*
