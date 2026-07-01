# Sub-phase 02 — Reference Extraction (build-ready)

**Purpose:** turns the `REFERENCES.md` pointers for sub-phase 02 into decided, build-ready design.
The execution agent implements the contract from this file + `02-01-PLAN.md` and does **not** need
to re-interpret the repos. Adopt the *shapes, semantics, and conventions* below; reject all
substrate (markdown-on-disk, JSON-file caches, CLIs, vault modes).

**Sources (fetched & verified 2026-06-29):**
- OpenClaw `memory-wiki` — https://docs.openclaw.ai/plugins/memory-wiki (`.md` variant)
- OpenClaw memory overview — https://docs.openclaw.ai/concepts/memory
- theafh `knowledge_management` `wiki` skill — `plugins/knowledge_management/skills/wiki/SKILL.md`

**What sub-phase 02 freezes:** the wiki interface contract (read API / digest / write surface),
the two capability registry rows, handler stubs, and the named §B orchestrator seams. No storage,
no real handler logic, no compilation.

---

## 1. B1 — Claim as the unit of knowledge

**Extracted (OpenClaw memory-wiki, "Structured claims and evidence"):**
```
claim    { id, text, status, confidence, evidence[], updatedAt }
evidence { sourceId, path, lines, weight, note, updatedAt }
```
"This is what makes the wiki act more like a belief layer than a passive note dump. Claims can be
tracked, scored, contested, and resolved back to sources."

**Our contract decision (freeze exactly this — single-sourced; compiler writes it, agent reads it):**
```
claim    { id, page_key, text, class, status, confidence, recall_score,
           evidence[], contradictions[], updated_at }
evidence { source_id, source_kind, path, lines, weight, note }   // updated_at optional (delta §A note)
```
- **Our additions over OpenClaw** (do not drop): `page_key`, `class` (compiled|insight|override —
  CONTEXT L2/D5), `recall_score` (hidden machine score, L3/B3), `contradictions[]` (A3).
- `confidence` is the **display enum** `high|medium|low` (high = multi-source only — A2/A3); the
  numeric promotion signal is the separate `recall_score`. **Two fields, never collapsed** (L3).
- `source_kind` enum: `raw_document | document_chunk | tier0_record | global_checkpoint` (delta §A).
- **Substrate:** Supabase `wiki_claims` / `wiki_evidence` rows (03-01) — **not** markdown frontmatter.

---

## 2. B2 — Compiled digest (the cheap-context object)

**Extracted (OpenClaw memory-wiki, "Compile pipeline" + "Prompt and context behavior"):** the
compile step emits `agent-digest.json` + `claims.jsonl` so "agents and runtime code do not have to
scrape Markdown pages." The injected snapshot is "intentionally small and high-signal: top pages
only, top claims only, contradiction count, question count, confidence/freshness qualifiers."
`claims.jsonl` powers claim-id → owning-page lookup.

**Our contract decision (freeze this shape; substrate = one `wiki_digest` JSONB row per user):**
```
digest  { user_id, wiki_version, generated_at,
          pages:  [{ page_key, title, one_line, claim_count, top_claim_ids[],
                     confidence_rollup, last_compiled_at, stale }],
          top_claims: [{ claim_id, page_key, text, confidence }],
          counts: { contradictions, open_questions, low_confidence, quarantined },
          qualifiers: { overall_confidence, oldest_page_age } }
```
- The orchestrator reads `wiki_read_digest()` for relevance instead of scraping pages (§5 "prime thin").
- Per-page `one_line` **is** the A4 index entry (one artifact, two uses).
- Claim-id → page lookup (OpenClaw `claims.jsonl`) is satisfied by `wiki_get_claim(claim_id)` + the
  `page_key` on every claim — no separate file.

---

## 3. B6 — Narrow structured mutations (`wiki_apply`)

**Extracted (OpenClaw memory-wiki, "Agent tools"):** tool set is `wiki_status`, `wiki_search`,
`wiki_get`, `wiki_apply`, `wiki_lint`. **`wiki_apply` = "narrow synthesis/metadata mutations
without freeform page surgery."** CLI shape: `wiki apply synthesis "Title" --body "..." --source-id ...`.

**Our contract decision (freeze these five mutations; actor-scoped; never freeform rewrite):**
```
propose_insight_claim(user_id, page_key, text, evidence[], confidence)  // domain agent only; quarantines
set_claim_confidence(user_id, claim_id, confidence)
flag_contradiction(user_id, claim_id, against_claim_id|page_ref, note)
add_override(user_id, page_key, claim_id?, text)                        // founder only
promote_insight(user_id, insight_id)                                    // founder confirmation only
demote_insight(user_id, insight_id)                                     // reverses promotion (B4)
```
- **Skip:** OpenClaw's CLI command shape and the single-`wiki_apply`-verb model — we expose explicit
  named mutations instead, which makes actor-scope and audit-logging enforceable per operation.
- **Invariant:** there is **no** `write_compiled_claim` mutation. Compiled base is written only by the
  04 compilation service (CONTEXT L2). The contract must state this as a hard exclusion.

---

## 4. A2 — Claim-level provenance convention

**Extracted (theafh `wiki/SKILL.md` `<write_or_update_pages>` "Provenance"):** "attribution stays
*next to* the claim it attributes… **No footnote markers** and **no bottom-of-page 'Sources'
collection**… The page-level `sources:` frontmatter is the canonical inventory; inline links pin
specific claims to specific sources… the lint validates both against disk."

**Our contract decision:** provenance is **claim-level** — every claim carries its `evidence[]`
inline (the `wiki_evidence` rows), never a page-bottom source list. Reads return evidence *with* each
claim (`wiki_get_claim` → full `evidence[]`). Validation (06) checks every claim resolves to real
sources (the "validated against disk" rule → "validated against source records"). **Skip** the
markdown `sources:` frontmatter form — our inventory is the normalized `wiki_evidence` table.

---

## 5. Read API + global_ip (ours by D6/§4; map to OpenClaw where parallel)

The read tools are ArchitectOS's, registered on the existing orchestrator (D6). Where OpenClaw has a
parallel, it confirms the shape:

| Our tool | OpenClaw parallel | Decision |
|---|---|---|
| `wiki_get_page(page_key)` | `wiki_get` | Returns the effective page: claims tagged by `class`/`trust`, precedence pre-applied (override > compiled > insight), class/trust visible (D9). |
| `wiki_get_claim(claim_id)` | claim-id lookup | One claim + full `evidence[]`. |
| `wiki_search(query, page_key?)` | `wiki_search` (provenance-aware) | Vector over compiled + insight (L4); contested/stale influences ranking (OpenClaw "Search and retrieval"). |
| `wiki_search_insight(query, page_key?)` | — | Insight-layer-scoped semantic search. |
| `wiki_read_digest()` | compiled-digest prompt | Returns the §2 digest. |
| `global_ip_get(domain\|stage\|tier\|topic)` | — | **Service-role only**, founder-invisible (L6). Targets `global_ip_pages` + the GM checkpoint family via the §A join. |

All return `agent_result_v1`-shaped results with first-class citations (matches the existing
`document_analysis_agent` / `kb_explorer_agent` handlers).

---

## 6. §B orchestrator seams the contract must NAME (from 01-01-DELTA §B)

Registering capability rows alone will **not** run the tools. The contract (`02-01-CONTRACT.md`)
must name these in-place seams so 03/04/05 build against a known surface (no parallel orchestrator):

1. `start_run()` dispatch — add `_handle_per_user_wiki()` / `_handle_global_ip()` branches, **or**
   replace the if/elif with a handler registry (keep the existing service + the 3 current handlers).
2. `AgentContextBuilder` — extend safe-scope keys + loaders beyond `document_ids` / `chunk_ids` /
   `dataset_ids` / `structured_query` to cover: `page_keys`, `claim_ids`, global-IP selectors
   (domain/stage/tier/topic), checkpoint selectors (capability_id, stage_id).
3. `StructuredQueryService.APPROVED_SURFACES` — currently `founder_dataset_rows`,
   `founder_dataset_rows_v`. Either expand it for GM-checkpoint/global-IP reads, **or** stand up a
   separate deterministic GM-checkpoint/global-IP read service. Contract states which.
4. New `allowed_source_kinds`: `wiki_page`, `wiki_claim`, `wiki_evidence`, `wiki_digest`,
   `global_ip_page`, `global_checkpoint`.

The contract freezes the *names and signatures* of these seams; 03–05 implement them. 02 itself only
adds the capability rows + `not_implemented` stub handlers.

---

## 7. Hard guarantees the contract must transcribe (CONTEXT §4.4 — verbatim conformance clauses)

- Compiled base is **write-locked to the compilation service** (L2). No `write_compiled_claim` exists
  in the agent-facing surface; only the internal `compile_page` (04) emits `class='compiled'`.
- Insight layer is **append-only + quarantined**; **reasoning-only until promoted** (D9) — reads
  expose `trust: quarantined` but the surface marks it non-assertable.
- Override layer is **founder-only**, highest precedence.
- Promotion is the **only** quarantined→trusted path; **founder-confirmation** in beta; every
  promotion is **auditable + reversible** via the action-log (A4/B4).
- Read precedence: **override > compiled > insight**.

---

## 8. Extract / skip summary

| Adopt (shape/semantics) | Reject (substrate) |
|---|---|
| claim/evidence field sets (B1); digest shape (B2); five narrow mutations (B6); claim-level provenance (A2); provenance-aware ranking (B2) | markdown frontmatter; `agent-digest.json`/`claims.jsonl` files; `wiki_apply` CLI verb; `sources:` page-bottom inventory; vault modes; Obsidian render |

**The contract must NOT contain:** any file path, vault layout, CLI command, or markdown substrate.
If the execution agent finds itself specifying one, it has crossed from model into substrate — stop
and re-read §8.

---

*Extraction complete for sub-phase 02. The execution agent builds `02-01-CONTRACT.md` from §§1–7 and
the capability rows/stubs from §5–6, then verifies against §7 and the SKIP column in §8.*
