# Wiki System — Reference Extraction Map

**Purpose:** ties each spec adoption (A1–A7 from theafh, B1–B8 + action-boundary from OpenClaw)
to its exact repo artifact, the sub-phase that consumes it, and a crisp **extract / skip** note.
This is the bridge between the spec's reference decisions and the execution agents. It **points**;
it does not copy code (extraction stays the execution agent's job, per spec §7).

**Verification status:** Both sources fetched and verified **2026-06-29**. The spec's §7
summaries are **accurate**. Deltas found are logged in §3 below. Read this file when opening any
sub-phase that lists a "Reference extraction" pointer.

---

## 1. Sources (verified live)

| Source | URL | What to read |
|---|---|---|
| theafh `knowledge_management` plugin | https://github.com/theafh/ai-modules — path `plugins/knowledge_management/` | `skills/wiki/SKILL.md` (verified), `agents/` (the `auto_shaper_wiki` agent), `skills/spr/SKILL.md`, `skills/executive_summary/SKILL.md`, `references/lint_checks.md`, `references/template_schema.md` |
| OpenClaw `memory-wiki` plugin | https://docs.openclaw.ai/plugins/memory-wiki (verified, `.md` variant is cleanest) · repo https://github.com/openclaw/openclaw | memory-wiki plugin page (verified), `https://docs.openclaw.ai/concepts/memory` (verified), `https://docs.openclaw.ai/concepts/dreaming`, `https://docs.openclaw.ai/concepts/active-memory` |

> Tip for execution agents: append `.md` to any OpenClaw docs URL for clean LLM-readable markdown
> (e.g. `https://docs.openclaw.ai/concepts/dreaming.md`).

---

## 2. Adoption → artifact → sub-phase → extract / skip

### theafh adoptions

| # | Adopt | Exact artifact | Sub-phase | EXTRACT | SKIP |
|---|---|---|---|---|---|
| A1 | Wiki Schema object | `skills/wiki/SKILL.md` `<orient_first_top>` + `references/template_schema.md` | **03-02** | The *concept* of a single `SCHEMA.md` declaring domain, type enum, tag taxonomy, frontmatter contract, read first by all ops | Their generic page-type enum (entity/concept/comparison/summary/query/procedure) — we keep our fixed 7-page domain set |
| A2 | Claim-level inline provenance | `SKILL.md` `<write_or_update_pages>` "Provenance" | **02**, **03-01** | Claim-level attribution; **no footnotes, no bottom-of-page Sources list**; sources are a validated inventory | Their markdown form (inline `[link](raw/..)` + `sources:` frontmatter). We normalize to `wiki_evidence` rows instead of markdown |
| A3 | Confidence + contradiction flags | `SKILL.md` `<write_or_update_pages>` "Confidence" + "Update Policy" | **03-01**, **06** | `confidence high\|medium\|low` (high = multi-source only); `contradictions:[]` + `contested:true`; record both positions, leave resolution to human | — |
| A4 | Index + action-log | `SKILL.md` `<architecture>` (index.md / log.md) | **03-01**, **02** | One-line page summaries (→ our `wiki_pages.one_line` / digest) + append-only action log (→ `wiki_action_log`) | The markdown files + log-rotation/`tail` mechanics |
| A5 | Consolidation loop | the **`auto_shaper_wiki` agent** under `agents/` + `<lint_and_audit>` | **07** | assess → fix → verify loop in isolated context: lint, audit prose, fix, split/relocate, re-lint, log, per-file change report | Update-in-place on compiled pages. **Our guardrail overrides theirs:** write insight + Open Questions only, never compiled base, never auto-promote |
| A6 | SPR + executive_summary | `skills/spr/SKILL.md`, `skills/executive_summary/SKILL.md` | **04** (exec-summary), post-beta (SPR) | `executive_summary` as a compiled-prose generation primitive w/ self-rating; SPR for dense context packing w/ reconstructability gate | Standalone CLI/skill packaging; SPR is post-beta-leaning — log, don't block beta on it |
| A7 | Validation/health checks | `references/lint_checks.md` + `<lint_and_audit>` buckets | **06** | The **check matrix** (broken provenance, malformed frontmatter, off-taxonomy tags, source drift, contested, orphans, low-confidence) as Supabase-side validation | `lint.py` itself, `discover_wiki.sh`, `init_wiki.sh`, `.no_wiki`, walk-up — filesystem machinery, do not port |

### OpenClaw adoptions

| # | Adopt | Exact artifact | Sub-phase | EXTRACT | SKIP |
|---|---|---|---|---|---|
| B1 | Claim as unit | memory-wiki "Structured claims and evidence" | **02**, **03-01** | `claim{id,text,status,confidence,evidence[],updatedAt}`; `evidence{sourceId,path,lines,weight,note,updatedAt}` — **exact match to our schema** | Markdown frontmatter substrate; we store as `wiki_claims`/`wiki_evidence` tables |
| B2 | Compiled digest | memory-wiki "Compile pipeline" + "Prompt and context behavior" | **02**, **04** | Digest = top pages, top claims, contradiction count, question count, confidence/freshness qualifiers — **exact match to our §4.2**; `claims.jsonl` claim-id→page lookup | JSON-file substrate (`agent-digest.json`/`claims.jsonl`). We use the `wiki_digest` JSONB row |
| B3 | Promotion gates | `concepts/dreaming.md` + memory overview "Dreaming" | **03-01**, **05**, **07** | Promotions pass **score + recall frequency + query diversity** gates; thresholded; reviewable | OpenClaw's `DREAMS.md`/CLI surfaces |
| B4 | Staging + reversibility | memory overview "Grounded backfill and live promotion" | **05**, **03-01** | Nothing writes trusted directly; staging→promotion only path; promotions auditable + **reversible** (rollback) | `rem-backfill` CLI specifics |
| B5 | Write-back = session-end flush | memory overview "Automatic memory flush" | **05** | Silent pre-compaction turn proposes write-backs so insight isn't lost on compaction | The compaction/model-override config |
| B6 | Narrow structured mutations | memory-wiki "Agent tools" → **`wiki_apply`** | **05**, **02** | `wiki_apply` = "narrow synthesis/metadata mutations without freeform page surgery" — models our add-claim/set-confidence/flag-contradiction surface | Freeform page rewrite; the CLI `wiki apply` command shape |
| B7 | Managed vs human blocks | memory-wiki "Vault layout" + `render.preserveHumanBlocks` | **04**, **03-01** | "Managed content stays inside generated blocks. Human note blocks are preserved." → our compiled (managed) vs override (human) `class` | Markdown block-comment substrate |
| B8 | Health dashboards | memory-wiki "Dashboards and health reports" | **06** | The **exact five**: `open-questions`, `contradictions`, `low-confidence`, `claim-health`, `stale-pages` | `reports/*.md` file substrate; Obsidian render |
| — | Action-boundary metadata | concepts/memory "Action-sensitive memories" | **03-01** | safe-to-act timing, expiry, authority/owner, what-to-avoid → our `wiki_insight_records` action-boundary fields | — |

**Architectural validation (not an adoption, but confirms our design):** OpenClaw physically
separates the *engine* (active memory plugin — recall, promotion, dreaming) from the *compiled
store* (`memory-wiki` — claims/evidence vault). That mirrors our orchestrator-tools (engine) vs.
wiki-tables (store) split. Do **not** adopt OpenClaw's swappable-backend abstraction (core/qmd/
lancedb/honcho) — over-engineering against our locked single backend (Supabase + pgvector).

---

## 3. Deltas found during verification (flag for execution agents)

1. **Agent name:** the consolidation agent is **`auto_shaper_wiki`** (the spec/CONTEXT wrote
   "wiki_auto_shaper"). Same thing; use the real name when locating it under `agents/`.
2. **Provenance substrate differs by design:** theafh keeps provenance as inline markdown links +
   a page-level `sources:` frontmatter inventory; **we normalize to `wiki_evidence` rows.** Adopt
   the *claim-pinned, no-footnotes, validated-against-source* principle — not the markdown form.
3. **Digest substrate differs by design:** OpenClaw emits `agent-digest.json` + `claims.jsonl`
   files; **we store a `wiki_digest` JSONB row.** Shape is identical; substrate is ours.
4. **Optional enrichment:** OpenClaw carries `updatedAt` on each evidence entry; our `wiki_evidence`
   omits it. Cheap to add in 03-01 if the execution agent wants per-evidence freshness.
5. **Confidence/contradiction conventions match exactly** — theafh `high\|medium\|low` (high =
   multi-source) and `contradictions[] + contested` map 1:1 onto CONTEXT L3 and 03-01.

---

## 4. Hard rule (unchanged from spec §7)

Adopt the **model and conventions, never the storage plumbing.** Our store is Supabase + pgvector
(hard constraint). Every artifact above contributes a *schema, convention, or loop structure* —
never a filesystem layout, CLI, or backend. When an execution agent is tempted to port a script,
a markdown-on-disk layout, or a vault mode, that is the signal it has crossed from model into
substrate — stop and re-read the SKIP column.
