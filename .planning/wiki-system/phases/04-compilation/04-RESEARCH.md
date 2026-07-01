# Sub-phase 04 — Reference Extraction (build-ready)

**Purpose:** turns the `REFERENCES.md` pointers for sub-phase 04 into decided design for `04-01-PLAN.md`:
the single compilation service (`compile_page`), digest rebuild, embedding refresh, the event→rebuild
wiring, and the **read handlers** that fill the 02 stubs. Builds against the frozen contract
(`wiki-1.0`) and the live schema (`20260630_wiki_schema.sql`).

**Sources (verified 2026-06-29):** OpenClaw `memory-wiki` ("Compile pipeline", "Vault layout",
"Search and retrieval"), theafh `executive_summary` skill (A6). Shapes are frozen by the contract —
do not re-derive.

---

## 0. Runtime architecture — D15 RESOLVED (CONTEXT §3/§8)

**FastAPI executes, n8n triggers.**
- `compile_page`, `rebuild_digest`, and the read handlers are **FastAPI services**. They hold the
  service-role Supabase/PG connection.
- **Write-lock mechanism (critical):** to write `class='compiled'`, the compile transaction must set
  the transaction-local marker **in the same transaction** as the inserts:
  ```sql
  select set_config('app.wiki_compilation_service', 'on', true);  -- true = transaction-scoped
  ```
  under the `service_role`. The 03 trigger `enforce_wiki_compiled_claim_writer()` rejects compiled
  writes that lack both the service-role claim and this marker. `compile_page` is the **only** path
  that sets it (single-writer, L2). Do all compiled deletes+inserts for a page inside that one
  transaction so the marker covers them, then let the transaction close.
- **n8n owns "when":** watches the §F source tables / receives platform events, runs the eager
  event→rebuild map, cron (dreaming, later), retries, and the existing writeback bridge; it calls the
  FastAPI `compile_page` endpoint. n8n never writes wiki tables directly.

---

## 1. B2 — Compile pipeline → `compile_page` + `rebuild_digest`

**Extracted (OpenClaw memory-wiki "Compile pipeline"):** compile "reads wiki pages, normalizes
summaries, and emits stable machine-facing artifacts" (`agent-digest.json`, `claims.jsonl`); these
power "first-pass wiki indexing for search/get flows, claim-id lookup back to owning pages, compact
prompt supplements, report/dashboard generation."

**Our build (`compile_page(user_id, page_key)`):**
1. Resolve sources per the §F event map (real Tier 0 tables) + `event_rebuild_targets` (fill it in the
   schema object, currently `{}`).
2. Synthesize the compiled base as **structured claims** (not prose): each `wiki_claims` row gets
   `class='compiled'`, `text`, display `confidence` (high only when multi-source — A2/A3), and
   `wiki_evidence` rows with `source_id, source_kind, path, lines, weight`.
3. **Replace only `class='compiled'` rows** for the page (B7 below). Insight + override untouched.
4. Refresh `wiki_pages.embedding` and each compiled `wiki_claims.embedding` (L4, vector(1536),
   OpenAI text-embedding-3-small per the existing stack).
5. Update `wiki_pages.last_compiled_at`, `stale=false`, `one_line`.
6. Append a `wiki_action_log` row (`action='compile'`, `actor='compilation_service'`).
7. Call `rebuild_digest(user_id)`.

**`rebuild_digest(user_id)`** writes the single `wiki_digest` JSONB row to the contract's `digest{}`
shape (pages[]/top_claims[]/counts/qualifiers). Claim-id→page lookup is `wiki_get_claim` (no
`claims.jsonl`). **Skip** the JSON-file substrate.

---

## 2. B7 — Managed vs human blocks → compiled-only regeneration

**Extracted:** "Managed content stays inside generated blocks. Human note blocks are preserved."

**Our build:** `compile_page` regenerates **only** `class='compiled'`. Implementation: within the
marked transaction, delete the page's existing `class='compiled'` claims (+ their evidence via cascade)
and insert the new ones; never touch `class='insight'` or `class='override'`. This is what makes a page
"rebuildable AND editable" — the override/insight layers survive every rebuild (L2/D5).

---

## 3. A6 — `executive_summary` primitive (prose snapshots)

**Extracted (theafh `executive_summary` skill):** structured-prose summarization to ~10–15% length
with a **self-rating**.

**Our build:** use it as the generation primitive for any compiled prose a page needs (the `one_line`
index entry; the Diagnostic Synthesis / Current-Quarter snapshot prose). Its self-rating is a
lightweight signal feeding the claim's display `confidence`. **SPR (A6's other half) is post-beta** —
do not block beta on it; note it for the future context-packing work.

---

## 4. Read handlers — fill the 02 stubs (contract §"Read Operations")

Implement, returning `agent_result_v1` with first-class citations (mirror `document_analysis_agent`):
- `wiki_get_page` — effective page: claims by `class`/`trust`, **precedence override > compiled >
  insight pre-applied**, class/trust **visible** so quarantined insight stays reasoning-only (D9).
- `wiki_get_claim` — one claim + full `evidence[]` + contradiction metadata.
- `wiki_search` — vector over compiled + insight (L4); contested/stale influence ranking (B2 "Search
  and retrieval") without making quarantined insight assertable.
- `wiki_search_insight` — insight-layer-scoped.
- `wiki_read_digest` — the `wiki_digest` row.
- `global_ip_get` — via `GlobalIpReadService` (below); service-role only.

---

## 5. §6 read seams to implement (named in the contract)

- `SubAgentOrchestrator._handle_per_user_wiki(context)` / `_handle_global_ip(context)` — replace the
  02 `not_implemented` stubs with real dispatch.
- `AgentContextBuilder` — add scope keys `page_keys`, `claim_ids`, `global_ip_selector`,
  `checkpoint_selector`; add loaders `_load_wiki_pages`, `_load_wiki_claims`, `_load_global_ip`,
  `_load_global_checkpoints` (respecting `allowed_source_kinds`).
- `GlobalIpReadService.get(selector)` / `.get_checkpoints(selector)` — read-only, service-role,
  founder-invisible. `get_checkpoints` uses the **01-01-DELTA §A join** over `gm_audit_questions` +
  `gm_stages` + `gm_checkpoints` + `gm_checkpoint_stage_meaning` + `gm_checkpoint_scoring` (citing
  `source_kind='global_checkpoint'`).

(The **write** seams — `propose_insight_claim` etc. — are 05, not here.)

---

## 6. Event map + stage-primer + robustness

- **Event→rebuild map:** use the verified §F table map already in `04-01-PLAN.md`; populate the schema
  object's `event_rebuild_targets` from it.
- **Stage-primer:** model all 5 AE stages; prime available calibrated content (currently 1–4 via the §A
  join); surface stage-5 as a known gap, never an error (CONTEXT §8).
- **Empty-source robustness:** several §F sources (`sp_sprint_*`, `founder_dataset_*`, `document_chunks`)
  were empty at verification — `compile_page` emits zero claims + marks the page thin, never errors.

---

## 7. Extract / skip summary

| Adopt (semantics) | Reject (substrate) |
|---|---|
| compile pipeline → claims + digest (B2); compiled-only regeneration (B7); executive_summary primitive + self-rating (A6); provenance-aware ranking | `agent-digest.json` / `claims.jsonl` files; markdown vault; SPR (post-beta, not now); CLI `wiki compile` |

**Do not** write any file-based digest/cache or markdown page. The digest is the `wiki_digest` row; the
claim store is `wiki_claims`/`wiki_evidence`.

---

*Extraction complete for sub-phase 04. The agent builds `compile_page` + `rebuild_digest` + the read
handlers + read seams against the frozen contract and the live schema, with FastAPI-executes/n8n-triggers
(D15) and the write-lock marker as the runtime contract.*
