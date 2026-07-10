# Citations & Source Grounding (Episode 7) — CONTEXT

**Cycle:** GSD Discuss → Plan, opened 2026-07-06
**Owner:** London Hicks (founder)
**Status:** Discuss **complete; working model locked.** The decisions below are locked pending
sub-phase execution. This file is the locked-decisions ledger — read first. It matures with an
append-only Amendments section as each sub-phase completes.

> Honors locked decisions **L8, L9, L11, L22–L25** (`../INTELLIGENCE-LAYER-EPISODE-MAP.md` §5) and
> the canonical architecture's "everything is traceable" constraint (`../INTELLIGENCE-LAYER-ARCHITECTURE.md` §7.4).
> The reference machinery lives at `docs/plans/ep7-citations/PRD-Citations.md` — reference, not blueprint
> (see `REFERENCES.md`). The superseded `../INTELLIGENCE-VISION.md` is **not** used.

---

## 1. What this workstream is

The **cross-cutting trust layer** over all three surfaces (Virtual CSO, Domain Agents, OS Engine) and
the whole four-tier knowledge layer. It makes "everything is traceable, no hallucination" operational:
every surfaced claim resolves to an exact source — a Tier 0 record, a Tier 1 wiki page/claim, a Tier 2/3
document location, or a web snapshot — and can be verified on demand.

**The reframe (why this is not a from-scratch build).** The reference builds citations from scratch.
We mostly don't. The platform has already converged on structured source-refs flowing from every tool,
wiki read, and sub-agent result, and the two wiki layers already emit citation-ready reads. So Ep7 is
three things:

1. **Unify** the divergent source-ref/evidence shapes into one citation currency.
2. **Render + verify** — build the citation UX (chips, sidecar, jump-to-evidence, Check Citations) on top.
3. **Add Tier 3 ingestion geometry** only where document-rectangle highlighting is actually needed.

Phased per L25: **Ep7A** = unify + render + verify + non-geometry resolvers. **Ep7B** = Tier 3 geometry.

---

## 2. Live substrate audit (verify finding, 2026-07-06)

Verified in `python-backend/services/`. The handoff's scoping picture holds, with one sharpening that
raises the stakes of the unification: **there is no single `AgentSourceRef` class realized consistently.**
L22's "unify on the existing `AgentSourceRef`/`agent_result_v1` shape" is real, but that shape is the
*most canonical of several divergent live shapes* — the normalization is more substantive than the phrase
implies. The producers found:

| # | Producer (file) | Fields | source-kind field | `verbatim`? | locator? |
|---|---|---|---|---|---|
| 1 | **`AgentSourceRef`** — `agent_context.py` (canonical target) | `source_kind, source_id, source_label, source_metadata, citation_payload` | `source_kind` | ❌ (but `citation_payload` hook exists) | ❌ (but `citation_payload` hook exists) |
| 2 | **`ToolSourceRef`** — `tool_registry.py` (Ep5) | `source_kind, source_id, verbatim, label, metadata` | `source_kind` | ✅ | ❌ |
| 3 | **docwiki citations** — `doc_wiki_read_service.py` (Tier 2 read) | `source_kind, canonical_key, title, page_kind, similarity` | `source_kind` | ❌ | ❌ |
| 4 | **`wiki_evidence`** — Tier 1 claim evidence (`wiki_read.py`) | `source_id, source_kind, path, lines, weight, note` | `source_kind` | ❌ | ✅ `path/lines` |
| 5 | **`RetrievedChunk`** — `retrieval.py` | `source_kind="raw_document_chunk"`, text | `source_kind` | (text) | ❌ |
| 6 | **Inline marker** — Tier 2 page prose | `[[Source: raw_document:{id}#chunk:{id}\|label]]` (string) | — | (prose) | implicit chunk |
| 7 | **VCSO stream refs** — `vcso_chat_service.py` | `{kind, label, pageId}` | **`kind`** ⚠ | ❌ | ❌ |
| 8 | **Ep6 provenance** — `artifact_service.py`, `harness_engine.py` | passes `result.citations` (AgentSourceRef dicts) into `tasks.step_results` → `artifacts.provenance.source_refs` (`domain_agent_artifact_provenance_v1`) | inherits | inherits | ❌ |

**Taxonomy drift (must be normalized, never silently renamed):** `raw_document_chunk` (retrieval) vs
`document_chunk` (agent_context, `wiki-1.0`); `tier0_record` (`wiki-1.0` evidence) vs
`founder_dataset`/`dataset_row` (agent_context, registry); VCSO `kind` axis (`wiki/platform/ip/context`)
vs `source_kind`; docwiki dicts omit `source_id`/`verbatim`.

**Ep7-readiness confirmed.** Ep6 already carries `source_refs` end-to-end
(`harness_engine.py:413 source_refs=result.citations` → `artifact_service.py:337–364` aggregates into
`artifacts.provenance`). Citations layer on with no re-plumbing.

**Connection-phase reality (what reaches an answer today, L24).** `document_chunk` is live
(`retrieval.hybrid_search` + `kb_read`/`retrieve` tools). `wiki_page`/`wiki_claim` are partial
(`wiki_read` + `docwiki_read` registered; `vcso_chat_service._build_context` pulls wiki pages into refs;
full cross-tier router is the frontier). `platform_record` is partial (structured dataset query exists;
pulled in as `platform` refs). `web` has **no in-platform producer tool** in the registry today (F3).

---

## 3. Locked decisions

### 3.1 The six decision points — resolutions

| DP | Decision |
|---|---|
| **DP1 — Currency normalization** *(settle first; everything depends on it)* | One currency, **`CitationRef` (`citation-1.0`)**, defined as an **additive extension of the canonical `AgentSourceRef`** (broadest taxonomy, most consumers) — add `verbatim` (from `ToolSourceRef`) and `locator` (generalizing `wiki_evidence.path/lines`, extensible to Ep7B bboxes). Producers keep native shapes; **adapters converge them at the boundary** (`services/citations/normalize.py`). |
| **DP2 — Marking vs. source-ref** *(core Ep7A reconciliation)* | **Source-ref-first.** The answer references sources by a lightweight **ordinal id** mapping into the turn's collected `CitationRef[]` (reuse the orchestrator's existing `all_sources`) — no parallel per-message citations store (L22). **Inline marking is reserved for one case:** binding a verbatim quote to an offset, via the already-machine-parseable Tier 2 `[[Source:]]` marker → `parse_inline_source_marker`. |
| **DP3 — Tier 0 record resolver** | A **deterministic typed-renderer registry**: `source_kind=platform_record` + `locator.record_path` (e.g. `mra_checkpoints/{row_id}/stage_assessment`) → a per-record-type renderer (MRA / AE Ladder / sprint / Quarter Map / Clarity Compass / Reflection Review) producing a read-only view (label + field table + deep-link). No geometry, no LLM. Reuses the structured dataset query service. |
| **DP4 — Check Citations verifier** | An **on-demand utility-model grader** (L12 — cheap model via registry, never the conversation model). Input: answer + `CitationRef[]`. Per-citation verdict ∈ `{supported, partial, unsupported, unresolvable}` + overall roll-up, reusing the DP2/DP3 resolvers to fetch source content. **Grades, never re-authors**; surfaces as a curated verdict, no raw CoT (L11). |
| **DP5 — Connection-phase readiness** | Ep7A builds all four tiered resolvers; each **lights up as the connection phase surfaces its sources (L24), never blocking on the router.** "Tier-complete by construction" — any source that reaches an answer is citable; un-surfaced tiers simply yield no refs yet. |
| **DP6 — Ep7B ingestion geometry** | **Forward-only layout capture** on `document_chunks`: per chunk, `page_number` + `bbox` + `verbatim` source face. No backfill (L10) — but **sequence Ep7B ingestion before OS Engine bulk-upload GA** so every at-scale doc is geometry-capable from day one. |

### 3.2 The currency object (`citation-1.0`)

```
CitationRef {                       # additive over AgentSourceRef
  source_kind: SourceKind           # normalized discriminator (families below)
  source_id: str | null             # stable id within the kind's namespace
  source_label: str | null          # human display label
  verbatim: str | null              # exact quoted text; null for metadata-only refs
  locator: Locator | null           # where in the source; null when whole-source
  source_metadata: dict             # kind extras: raw_source_kind, canonical_key, page_kind,
                                    #   similarity, weight, note, trust, class, record_path…
}

Locator {
  kind: "lines"|"section"|"page_key"|"record_path"|"bbox"|"url_fragment"
  path: str | null                  # Ep7A
  lines: {start:int,end:int} | null # Ep7A (Tier 1 evidence, chunk lines)
  section_label: str | null         # Ep7A
  page_key: str | null              # Ep7A (wiki)
  record_path: str | null           # Ep7A (Tier 0: table/row/field)
  page_number: int | null           # Ep7B
  bbox: [x0,y0,x1,y1] | null        # Ep7B
}
```

**Resolver families (L23).** The discriminator collapses many fine-grained kinds into four tiered render
paths, preserving the raw value in `source_metadata.raw_source_kind`:

| Family (`source_kind`) | Tier | Absorbs | Geometry |
|---|---|---|---|
| `document_chunk` | Tier 2/3 | raw_document, document_chunk, raw_document_chunk, inline `[[Source:]]` | Ep7B |
| `wiki_page` | Tier 1 | wiki_page, wiki_claim, wiki_digest, global_ip_page | none |
| `platform_record` | Tier 0 | tier0_record, founder_dataset, dataset_row, global_checkpoint | none |
| `web` | web | web snapshot | none |
| `derived` *(non-tier)* | — | computation, skill_file, sub_agent_run, workspace_file, agent_todos, human_input, mcp, tool_registry, skill_pack | none |

**Adapters (Phase A0), one per producer shape:** `from_agent_source_ref`, `from_tool_source_ref`,
`from_docwiki_citation`, `from_wiki_evidence`, `from_retrieved_chunk`, `parse_inline_source_marker`,
`from_vcso_stream_ref`, `from_provenance_ref`.

### 3.3 Surface manifestations (functional now; visual polish → §8 front-end pass)

- **Virtual CSO (primary):** unified `CitationRef` stream events (replacing `{kind,label,pageId}`),
  inline chips, source-preview sidecar, jump-to-evidence, Check Citations action.
- **Domain Agents:** artifact-library rendered views read `artifacts.provenance.source_refs`
  (CitationRef-shaped post-A0/A1) and render citations, reusing the CSO resolver + chip/sidecar components.
- **OS Engine (Ep7B):** ingestion captures geometry + verbatim face; wiki provenance (claims → Tier 3/0)
  resolves through the same currency.

### 3.4 Locked-decision honor map (L22–L25, L8/L9/L11)

- **L22** — one currency (`CitationRef` over `AgentSourceRef`); reference marker/streaming/rendering UX
  layered on top; no parallel per-message store. ✔ (DP1, DP2)
- **L23** — four source-kind resolver families, tier-complete by construction; chunk geometry is the only
  net-new. ✔ (DP1, DP6)
- **L24** — consume the connection phase; don't build the router; don't block. ✔ (DP5)
- **L25** — Ep7A/Ep7B split. ✔ (`ROADMAP.md`)
- **L8** — citations resolve to all four tiers (caveat `web`, F3). ✔ (families)
- **L9** — one provenance mechanism for chat + wiki, preferred not forced. ✔ (one currency; the DP2
  inline-marker escape hatch is a narrow addition, not a second store — F5)
- **L11** — curated trace / no raw CoT (verifier verdicts, derived-kind trace). ✔ (DP4, O1)

---

## 4. Open decisions (resolve before/within the noted phase)

- **O1 (A2/A3): RESOLVED 2026-07-06 — trace-only** (London confirmed). `derived` operational kinds
  (computation, skill_file, mcp, sub_agent_run, workspace_file, agent_todos, human_input, tool_registry,
  skill_pack) render **only in the curated activity trace**, never as clickable citation chips. Only the four
  knowledge tiers get chips (L8/L11). See §8 amendment.
- **O2 (A2/A6): RESOLVED 2026-07-06 — build dark** (my call, low-stakes). The `web` resolver is built but
  ships dark: no citable web *tool* is registered in the tool registry today, though a `WebSearchService`
  (`services/web_search.py`) exists, so the producer is close. Keeps tier-completeness cheaply. See §8.
- **O3 (A1): RESOLVED 2026-07-06** (see §8 amendment) — **per-message deterministic ordinal numbering**
  (`[n]`) over the turn's deduped `CitationRef[]`, dedup key `(source_kind_family, source_id)` with a
  content-hash fallback; the Tier 2 `[[Source:]]` marker is the coexisting verbatim-quote escape hatch;
  cross-turn thread-stable *numbering* is deferred (not needed for per-message rendering). London may veto
  the per-message-vs-thread-stable choice in review.
- **O4 (A0/A5): RESOLVED 2026-07-06 — render surface = `DomainAgentArtifacts.tsx` Preview panel** (its copy
  already promises "trace provenance"). **But a plumbing gap was found:** `provenance.source_refs` is persisted
  on the artifact row yet **not surfaced** through the delivery path (`ArtifactDeliveryResult` →
  `/api/artifacts/{id}` → frontend `ArtifactDelivery`). A5 must plumb provenance through delivery first, then
  render. See §8 amendment.

---

## 5. Conflicts flagged (not silently resolved)

- **F1 — Extending a frozen contract surface.** Adding `verbatim` + `locator` to the currency touches
  shapes referenced by `wiki-1.0` (frozen 03–05, 07) and `doc-wiki-1.0` (frozen 03–06 + connection). The
  change is **additive / optional-field only** (backward-compatible), but it *does* touch frozen surfaces.
  **Recommend a formal `citation-1.0` additive amendment note appended to both contracts** rather than an
  in-place edit. Do not silently mutate the frozen shapes. (Phase A0.)
- **F2 — Taxonomy reconciliation.** `raw_document_chunk→document_chunk` and
  `tier0_record↔platform_record/founder_dataset` must be an explicit normalization map with the raw value
  preserved in `source_metadata.raw_source_kind`. Renaming producers in place would break the frozen
  contracts and registry `allowed_source_kinds`; adapters are the safe seam. (Phase A0.)
- **F3 — `web` tier has no producer** (L8 says citations resolve to all four tiers). The web *resolver* is
  buildable, but no tool returns web refs today. L8 four-tier completeness is aspirational for `web` until
  a web tool exists. (O2.)
- **F4 — VCSO stream event-shape change.** Replacing `{kind,label,pageId}` with `CitationRef` alters an
  event the frontend consumes. In-scope for Ep7A; must be coordinated with the §8 front-end pass. (Phase A1/A3.)
- **F5 — L9 "one mechanism, preferred not forced."** This model uses one currency for chat + wiki +
  artifacts. The only non-single-mechanism spot is DP2's inline-marker escape hatch for verbatim binding —
  a narrow addition on top of the one currency, not a second store. Called out so the latitude is conscious.

---

## 6. Scope — owns / does NOT own

**Owns:** the unified citation currency + normalization adapters; the four tiered resolvers + Tier 0 typed
renderer registry; the turn-collection/binding path; the Check-Citations verifier; the functional citation
UX (chips, sidecar, jump-to-evidence) in VCSO + artifact library; Ep7B ingestion geometry + PDF highlight.

**Does NOT own:** the cross-tier **retrieval router / connection phase** (L24 — consumed, not built);
visual design polish of the citation UX (**§8 front-end pass**); the wiki synthesis engines themselves
(built — Tier 1 `wiki-system/`, Tier 2 `document-wiki/`); any new web-search producer tool (F3).

---

## 7. References

- `../INTELLIGENCE-LAYER-ARCHITECTURE.md` — four-tier model, write-ownership, "everything is traceable."
- `../INTELLIGENCE-LAYER-EPISODE-MAP.md` §4 Episode 7 + Refinement, §5 L8/L9/L11/L22–L25.
- `docs/plans/ep7-citations/PRD-Citations.md` + `README.md` — reference machinery (see `REFERENCES.md`).
- Tier 1 contract: `../wiki-system/phases/02-interface-contract/02-01-CONTRACT.md` (`wiki-1.0`, claim-evidence).
- Tier 2 contract: `../document-wiki/phases/02-page-contract-schema/02-01-CONTRACT.md` (`doc-wiki-1.0`, inline `[[Source:]]`, `agent_result_v1`).
- Live substrate: `python-backend/services/{agent_context,tool_registry,doc_wiki_read_service,wiki_read,retrieval,vcso_chat_service,harness_engine,artifact_service}.py`.

---

## 8. Amendments (append-only)

### 2026-07-06 — A0 sub-phase entry: `AgentSourceRef.citation_payload` discovered

Pinning the exact live shapes for the A0 RESEARCH pass surfaced a fifth field on the canonical
`AgentSourceRef` (`agent_context.py:24`): **`citation_payload: dict[str, Any] = field(default_factory=dict)`**
— a pre-existing, currently-unpopulated hook that appears purpose-built for citation enrichment. This
**strengthens DP1** (the currency really is an extension of `AgentSourceRef`, and the extension point
already exists). It raises one design choice for A0-01, now an explicit build task:

- **First-class vs. payload:** do `verbatim` and `locator` become **first-class `CitationRef` fields**
  (recommended for ergonomics + typing), with `citation_payload` used as the on-the-wire carrier through
  the existing `AgentSourceRef` plumbing — or do they live **inside `citation_payload`** to avoid touching
  the `AgentSourceRef` dataclass at all? **Lean: first-class on `CitationRef`, serialized into
  `citation_payload` when passing through `AgentSourceRef`-typed paths** (keeps the frozen dataclass
  untouched — reinforces F1's additive posture). Execution agent confirms at A0-01.

No change to the locked decisions; this is an implementation-surface refinement captured before the A0
execution prompt.

### 2026-07-06 — A0 completion reconciliation (currency + adapters built)

**Status: A0 complete, verified.** `citation-1.0` currency + the eight adapters + golden tests landed;
`11 passed`, `compileall` exits 0. Strategy-thread verification confirmed: `models.py` matches CONTEXT §3.2;
`RAW_TO_FAMILY` is exhaustive over RESEARCH §11 (unknown → `derived` + warning, never dropped); both frozen
contracts carry an **additive** `citation-1.0` amendment appended below the frozen content — no field table
edited (**F1 held**).

Files: `python-backend/services/citations/models.py`, `.../normalize.py`,
`python-backend/tests/test_citations_normalize_a0.py`.

**Implementation choices made within design latitude (noted for downstream phases):**
- **Serialization — `CitationRef.to_agent_source_ref_dict(citation_payload=None)`** is the through-path
  serializer (DP1 / §8 first-class-vs-payload). It preserves existing `citation_payload` keys, adds
  `citation_version: "citation-1.0"`, and stashes optional `verbatim` + `locator` inside `citation_payload`.
  `verbatim`/`locator` are **first-class on `CitationRef`**; the frozen `AgentSourceRef` dataclass is untouched.
- **Back-compat on the AgentSourceRef path:** `to_agent_source_ref_dict()` emits `source_kind =
  source_metadata.raw_source_kind or <family>` — i.e. existing `AgentSourceRef`-typed consumers keep seeing
  the *original* kind (e.g. `wiki_claim`, not the `wiki_page` family). **Downstream note for A1/A2:** the
  *family* discriminator lives on `CitationRef.source_kind`; the *raw* kind is what survives on the
  AgentSourceRef path. Resolvers key off the family; anything reading the through-path dict sees the raw kind.
- **Adapters accept both live dataclass instances and serialized dicts**, so they work at the Python-object
  seam and the persisted/wire boundary — useful for A1 (stream refs) and A5 (provenance dicts).

No London/design flag was raised. No producer rewrites, no resolver/UI/stream changes (correctly out of A0 scope).

**Next:** open **sub-phase A1 (turn collection + answer-span binding)** — see the O3 resolution below.

### 2026-07-06 — A1 sub-phase entry: O3 resolved (binding scheme) + two-source-pool finding

Pinning the live VCSO loop (`vcso_chat_service.py`) for the A1 RESEARCH pass resolved O3 and surfaced a
scoping detail that sharpens the A1 plan.

**O3 resolution — per-message deterministic ordinal numbering.** The final answer is written in a *separate
tool-less streaming pass* (`vcso_chat_service.py:491–504`) that currently receives **no** numbered source
list and **no** citation instruction; it just writes prose. Citations persist per assistant message. Given
that discrete-message structure, the reference's *thread-stable cross-turn numbering* (built for one
continuous answer stream) is the wrong fit; **per-message numbering** (each answer's chips start at `[1]`) is
the natural, conventional chat-citation UX. Decision:
- **Binding = numbered ordinal `[n]`** over the turn's **deduped** `CitationRef[]`. The final-answer pass is
  given a numbered source list + a cite-with-`[n]` instruction; a parser extracts `[n]` from the streamed
  tokens and binds; **out-of-range/invalid indices are dropped** (mirrors the reference's strip-invalid).
- **Dedup / identity key = `(source_kind_family, source_id)`**, content-hash of `verbatim`/`source_label`
  fallback when `source_id` is null. Reload-safe because the assistant message persists both the answer text
  (with `[n]`) and its ordered `CitationRef[]`. No separate thread-numbering registry.
- **Verbatim escape hatch (DP2)** coexists: the Tier 2 `[[Source:]]` marker binds a quote to an offset via
  `parse_inline_source_marker`.
- **Deferred:** cross-turn thread-stable numbering — revisit only on a product need. **London may veto the
  per-message-vs-thread-stable choice in review** (the only sub-choice with any UX flavor).

**Two-source-pool finding (sharpens A1 scope).** The turn has **two** live source concepts to unify, not one:
(1) `_build_context` display refs `{kind,label,pageId}` emitted in the `done` event as `sources`
(`vcso_chat_service.py:168–181, 570`), and (2) `all_sources` — the tool-execution `ToolSourceRef` dicts
accumulated across rounds (`:399–400`). A1 normalizes **both** into the one turn `CitationRef[]` (adapters
`from_vcso_stream_ref` + `from_tool_source_ref` / `from_agent_source_ref`), then numbers + binds.

**Surface note (F4).** The final-answer prompt change makes the assistant's output contain `[n]` markers — a
model-behavior + output-format change the frontend must render as chips; coordinate with the §8 pass.

No change to the locked decisions. This closes O3 and refines A1-01 before its execution prompt.

**Next:** author + open **sub-phase A1** with O3 decided.

### 2026-07-06 — A1 completion reconciliation (turn collection + binding built)

**Status: A1 complete, verified.** Both source pools now normalize into one ordered, deduped, numbered turn
`CitationRef[]`; the final-answer pass is given a `CITATION SOURCES FOR THIS ANSWER` numbered list + a
cite-with-`[n]` instruction; `[n]` is parsed from the streamed answer (valid kept, out-of-range stripped from
persisted text), `[[Source:]]` verbatim markers are lifted; per-step `sourceRefs` and the `done.sources` event
are `CitationRef`-shaped (F4); deep-resume stores/restores the citation list. `17 passed`, `compileall` 0.

Files: `python-backend/services/citations/binding.py` (new), `vcso_chat_service.py` (wired),
`docs/migrations/20260706_vcso_message_citations.sql` (adds `vcso_chat_messages.citations jsonb not null default '[]'`).

**Judgment call — verified non-breaking.** The agent persists the ordered `CitationRef[]` on the **assistant
message only** and does not duplicate it into a run-level citations store (L22). Strategy-thread check confirmed
this is safe: `_complete_main_run` (`vcso_chat_service.py:1132`) only ever wrote `structured_result.source_count`
(a **count**, never a list) to `agent_delegation_runs` — A1 passes the deduped list there for the count and
writes the full list only to `vcso_chat_messages.citations`. No reader of a run-level VCSO citation list existed,
so nothing regressed. **L22 honored, no parallel store.**

**Implementation notes for downstream phases:**
- **Dedup key uses the family** (`CitationRef.source_kind`, which is the family per A0) + `source_id`, sha256
  content-hash fallback (`verbatim|source_label|raw_source_kind`) — consistent with the O3 decision.
- **Ordinals ride on the serialized citation dict** (`binding._with_ordinal` adds an `"ordinal"` key); A3 chips
  render from that. `done.sources` is now `CitationRef`-shaped (**F4 — frontend must consume the new shape; §8**).
- **`_artifact_id_from_sources` still reads raw `all_sources`** (unchanged) — an artifact-id extraction, not a
  citation store; fine.

**Carried item (not a blocker).** The migration is written but **not applied to live Supabase** (agent did not
apply/query live) — same deferred-live pattern as the sibling workstreams. `vcso_chat_messages.citations` must be
applied before A1 is live-functional; folds into the A6 consolidated smoke.

**Next:** open **sub-phase A2 (resolvers)** — see the A2-entry amendment below.

### 2026-07-06 — A2 sub-phase entry: O1 + O2 resolved; resolver read-paths pinned

**O1 — RESOLVED trace-only (London confirmed).** `derived` operational kinds render only in the curated
activity trace, never as citation chips. Only the four knowledge-tier families (`document_chunk`, `wiki_page`,
`platform_record`, `web`) are chip-eligible. **Downstream:** A2 builds resolvers for the four tier families
only; the resolve endpoint rejects/normalizes a `derived` `source_kind` to a trace entry, not a source view;
A3 renders `derived` refs in the trace strip, not as chips.

**O2 — RESOLVED build-dark (low-stakes call).** No citable web *tool* is registered in `tool_registry.py`
(grep: no web/`retrieve_document_chunks` tool registration), so no web ref reaches an answer today. A
`WebSearchService` (`services/web_search.py:28`, `.search(...)`) exists as a service — the producer is close
but not wired. A2 builds the `web_resolver` (snapshot-shaped) but it returns a typed "no producer / dark"
result until a web tool + snapshot store land.

**Resolver read-paths pinned (for the A2 RESEARCH):**
- **chunk_resolver** → `document_chunks` table, direct owner-scoped select by id (pattern
  `agent_context.py:204–210`: `select("id,user_id,document_id,chunk_index,content,metadata").eq("user_id",…).in_("id",[…])`);
  `content` = verbatim, `metadata` holds title/section. Live producer that reaches answers: the `kb_read`/`retrieve`
  native tools + `retrieval.hybrid_search` (`retrieval.py`).
- **wiki_resolver** → Tier 1 `WikiReadService.get_page(user_id, page_key)` / `get_claim(user_id, claim_id)`
  (`wiki_read.py:31,50`, returns claim + `evidence`); Tier 2 `DocWikiReadService.get_page(user_id,
  canonical_key|page_id)` (`doc_wiki_read_service.py:100`).
- **platform_record_resolver** → **direct typed reads** per a table-keyed renderer registry (DP3, no LLM):
  owner-scoped `.table(<table>).select(...).eq("user_id",…).eq("id", row_id)` for MRA / AE Ladder / sprint /
  Quarter Map / Clarity Compass / Reflection Review. `StructuredQueryService` (`structured_query.py:86`) is the
  reference for the **safe-surface allow-list** (validated table/column read), but the resolver uses fixed
  typed reads, not agent-generated SQL.
- **web_resolver** → dark (O2).
- **Endpoint** `POST /api/citations/resolve` → mirror the existing FastAPI route + auth-dependency pattern in
  `main.py` (the doc-wiki read endpoints, `require_ingest_secret`).

**Secondary finding (note, not A2 scope):** the `document_analysis_agent` capability lists tools
`retrieve_document_chunks` / `read_raw_document_metadata` (`agent_capabilities.py:122`) that are **not registered
by those names** in `tool_registry.py` — the live chunk producers are the `kb_*` / `retrieve` native tools. A
capability-allowlist vs. registered-tool-name gap; irrelevant to A2 (the resolver reads `document_chunks`
directly) but worth a flag for the eventual §8 wiring audit.

No change to locked decisions. This closes O1 + O2 and refines A2-01 before its execution prompt.

**Next:** author + open **sub-phase A2** with O1 + O2 decided.

### 2026-07-06 — A2 completion reconciliation (resolvers + endpoint built)

**Status: A2 complete, verified.** Four family resolvers + dispatcher
(`services/citations/resolvers/__init__.py:15`) and `POST /api/citations/resolve` (`main.py:843`, behind
`require_ingest_secret`) landed. View shapes: `chunk` (verbatim + line/section locator, no geometry, + doc
metadata), `wiki` (page/claim prose + evidence + locator), `platform_record` (label + table + row id + field
table + raw record + deep-link), `web_dark` (snapshot-shaped dark), `derived` → `not_citable`/`trace_only`.
`24 passed`; `compileall` 0.

**Judgment call — correct, aligned with DP3.** The agent did **not** widen `StructuredQueryService`'s agent-SQL
allow-list. Founder dataset rows go through its approved surfaces; the other Tier 0 reads are bounded by the
deterministic resolver registry's fixed table/column lists. This is exactly DP3 (typed reads, no agent SQL) — no
concern.

**Platform registry covered (15 tables):** `mra_checkpoints`, `gm_assessment_checkpoint_scores`,
`ae_assessments`, `ae_dimension_scores`, `ae_assessment_insights`, `sp_sprint_goals`, `sp_sprint_initiatives`,
`sp_sprint_milestones`, `quarter_map_selections`, `cc_versions`, `cc_synthesis`, `clarity_compass_versions`,
`reflection_reviews`, `founder_dataset_rows`, `founder_dataset_rows_v`.

**Flag sharpened — `reflection_reviews` renderer is dormant-until-wired (not just a name to confirm).**
Strategy-thread check: `reflection_reviews` appears **only** in the two new A2 files (resolver + test) — no
migration, service, or frontend reference anywhere in the repo. This matches the known platform reality
(document-wiki CONTEXT, 2026-06-30 sprint-wiki note): **Reflection & Review is a "V-11 placeholder, not wired to
Supabase"** — its Submit doesn't persist yet. So `reflection_reviews` is almost certainly **not a live table**,
and Reflection Review is not yet a Tier 0 source that reaches an answer. Treat this renderer as **built but
dormant** (mirrors the wiki workstream's "build-complete, activate-as-ready" pattern for `sprint_retrospective`/
`sprint_evolution`). It resolves nothing until Reflection Review is wired; no user impact today (DP5 — it just
yields no refs).

**Carried item → A6 (live-schema pass).** A2 was built without live Supabase. Before A2 is live-functional,
confirm **live existence + exact column lists for all 15 registry tables** (esp. `reflection_reviews` likely
absent, and verify `cc_versions` vs `clarity_compass_versions` aren't duplicative). Folds into the A6
consolidated smoke, same deferred-live pattern as the A1 migration.

**Next:** open **sub-phase A3 (VCSO citation UX)** — the first frontend-facing phase: inline chips, source
sidecar (calls `/api/citations/resolve`), jump-to-evidence; `derived` refs render in the activity trace, not as
chips (O1). Functional only — visual polish deferred to §8 (F4).

### 2026-07-06 — A3 completion reconciliation (VCSO citation UX built) + auth correction

**Status: A3 complete, verified.** Frontend types migrated legacy `SourceRef` → `CitationRef`; ordinal-bound
inline `[n]` chips in answers (`MessageBubble.tsx:23`); sources rail on numbered `CitationRef[]`
(`SourcesPanel.tsx:28`); the shared `Reader` (`components/pro-suite/shared/Reader.tsx:13`) extended with a `body`
slot + a new `CitationReaderBody.tsx:30` that calls `/api/citations/resolve` and renders
chunk/wiki/platform/web-dark/error; jump-to-evidence scrolls+centers (chunk/wiki) / highlights the focused field
row (Tier 0); `derived` filtered to the trace only (`AgentStepsPanel.tsx:51`); `web_dark`/`not_citable`/failures
degrade to a quiet "source unavailable". `npm run build` passes; legacy sweep found no old `SourceRef`/`SourceKind`
shape. Visual polish deferred to §8.

**CORRECTION (my A2 guidance was wrong) — resolve endpoint auth.** A3 surfaced that `/api/citations/resolve`
(`main.py:843`) is behind **`require_ingest_secret`** — because A2's plan told the agent to mirror the doc-wiki
read endpoints. That was wrong: those endpoints are **server-to-server** (ingest secret = a service-role secret).
`/api/citations/resolve` is the **first browser-called** citation endpoint, so an ingest secret must never reach
the client. The right model already exists in the repo: the browser-called `/api/artifacts/*` endpoints use
**`get_current_user_id`** (`main.py:636,650`) — user-JWT/session — which the frontend already calls (artifactsApi).
A3 currently uses the frontend secret-header pattern "if configured" and otherwise degrades — a stopgap, not
production-safe.

**Required change (recommended fix, London to bless):** switch `/api/citations/resolve` from
`require_ingest_secret` → **`get_current_user_id`**, and scope every resolver read to that authenticated `user_id`
(which also satisfies A2's "owner-scoped, reject cross-user refs" more robustly than trusting a ref's `user_id`).
A3's browser call then uses the user session like artifactsApi, dropping the secret-header hack. Small change,
touches **A2** (endpoint dependency + resolver user-scoping) and **A3** (frontend call). This is a **security-class
corrective item, not deferred smoke.**

**Home for the fix:** do it at **A4 entry** — A4 also adds a browser-reachable action (`/api/citations/check`)
and must use the same user-auth path, so standardize both endpoints on `get_current_user_id` there. Flag to London.

**Next:** open **sub-phase A4 (Check Citations verifier)** — on-demand utility-model grader over the turn
`CitationRef[]`, reusing the A2 resolvers; **plus the resolve/check auth standardization above.**

### 2026-07-06 — A4 completion reconciliation (verifier + auth fix built)

**Status: A4 complete, verified.** The verifier (`services/citations/verify.py:36`) resolves source content via
the A2 resolver, skips `derived`, grades 4-way (`supported/partial/unsupported/unresolvable`), logs
`role="utility"`, and persists a `verdict` object onto each assistant-message citation entry. Model setting
`citation_verifier` → fallback `claude-3-5-haiku-latest` (utility-class, **not** the conversation model — L12) via
migration `docs/migrations/20260706_citation_verifier_model_setting.sql`. Surface: message-level "Check citations"
action + summary + recolored chips (`MessageBubble.tsx:77`). `11 passed`, `compileall` 0, `npm run build` passes.

**Auth fix verified (strategy-thread check).** Both `/api/citations/resolve` (`main.py:855`) and
`/api/citations/check` (`main.py:874`) now take `Depends(get_current_user_id)`; `require_ingest_secret` is gone
from the citation path; the browser sends the Supabase access token. The A3 stopgap secret-header is removed.
**The security-class corrective item from A3 is closed.**

**Implementation choices (within latitude):** verdict persisted **inline on each `citations` entry** (a `verdict`
object) rather than a separate `citation_verdicts` column — simpler, reloads with the message. Bearer-token user
validation follows Supabase `auth.getUser`.

**Carried — consolidated pending live-DB apply ledger (for A6 smoke).** A4's live apply was blocked by the
shared-project approval policy (correctly — the agent did not force it). The deferred-live items now accumulated,
all code-complete + locally verified, **none applied to live Supabase**:

| # | Item | Migration / source | From |
|---|---|---|---|
| 1 | `vcso_chat_messages.citations jsonb` column (+ inline `verdict` objects ride on it) | `20260706_vcso_message_citations.sql` | A1 / A4 |
| 2 | `citation_verifier` platform-model setting | `20260706_citation_verifier_model_setting.sql` | A4 |
| 3 | Confirm 15 platform-record tables exist + exact columns (esp. `reflection_reviews` likely absent; `cc_versions` vs `clarity_compass_versions`) | live schema check | A2 |
| 4 | *(later)* `document_chunks` geometry columns (`page_number`, `bbox`, `verbatim`) | Ep7B/B0 | B0 |

**Application posture:** these mutate the shared Supabase project, so they need **London's explicit approval** to
apply. Default plan: apply them together in the **A6 consolidated smoke** (matches the sibling-workstream
deferred-live pattern). London may approve an earlier apply if he wants any phase live sooner.

**Next:** open **sub-phase A5 (Domain Agents artifact citations)** — see the A5-entry amendment below.

### 2026-07-06 — A5 sub-phase entry: O4 resolved + a provenance-plumbing gap found

Locating the artifact render surface for the A5 RESEARCH pass resolved O4 and surfaced a gap that sharpens A5
from "just render" to "plumb, then render."

**O4 — RESOLVED. Render surface = `pages/ProSuite/domain-agents/DomainAgentArtifacts.tsx`** — its Preview panel
(~line 177–195) renders artifact content via `ReactMarkdown` (or raw HTML), fetched by `getArtifact(id)` →
`ArtifactDelivery` (`lib/artifactsApi.ts:6,62`). The page copy already advertises "Preview, download, **trace
provenance**, and deliberately promote…" — provenance display is an intended-but-unbuilt feature. The VCSO
`ArtifactDeliveryCard.tsx` is a secondary surface (delivery card in chat) but the library preview is the primary A5 home.

**Gap — provenance is persisted but not delivered.** `artifact_service.py` writes `provenance`
(`domain_agent_artifact_provenance_v1`, incl. `source_refs`) onto the artifact **row** (`:90,106,331–363`), but
**`ArtifactDeliveryResult` (`:31–43`) does not include it** — so it never reaches `/api/artifacts/{id}` or the
frontend `ArtifactDelivery` type. **A5 must, in order:**
1. **Backend plumb:** add `provenance` (or `provenance.source_refs`) to `ArtifactDeliveryResult` + `get_delivery`
   (read from the row) + the `/api/artifacts/{id}` response model. **Normalize** the stored `source_refs` to
   `CitationRef` via A0 `from_provenance_ref` (they originate from `harness_engine` `result.citations`, i.e.
   `AgentSourceRef`-derived dicts — CONTEXT §2 #8).
2. **Frontend render:** add `provenance`/citations to `ArtifactDelivery`; in the `DomainAgentArtifacts.tsx`
   Preview panel, render a citations rail + resolvable chips reusing the **A3 chip/sidecar components** and the
   **A2 resolve endpoint** (now `get_current_user_id`, A4).
3. **Inline markers:** if an artifact body contains `[[Source:]]`/`[n]` markers (from the sub-agent's writing),
   bind them like A3; otherwise the provenance `source_refs` rail is the citation surface. (Artifact citations
   are **static provenance**, not streamed — no A1 turn loop.)

**Reuse confirmed:** A2 resolvers, A3 chip/sidecar (`CitationReaderBody`), A0 `from_provenance_ref`, and the
existing `getArtifact` delivery path (user-auth already, `get_current_user_id`).

No change to locked decisions. This closes O4 and refines A5-01 before its execution prompt.

**Next:** author + open **sub-phase A5** with O4 decided (render surface + the plumbing task).

### 2026-07-06 — A5 completion reconciliation (artifact citations built) — Ep7A build complete

**Status: A5 complete, verified.** Artifact delivery now carries `provenance` through
`ArtifactDeliveryResult` (`artifact_service.py:46`) → `/api/artifacts/{id}` → `ArtifactDelivery`, via a
`_delivery_provenance` helper (`:140,246`) that normalizes stored `source_refs` with A0 `from_provenance_ref`,
dedups/numbers via the shared binding helper, and serializes CitationRef-shaped. The `DomainAgentArtifacts.tsx`
Preview renders a citations rail, filters `derived` out of chips, opens the shared `CitationReaderBody` sidecar
(→ A2 `/api/citations/resolve`), binds `[n]` to delivered ordinals, and turns `[[Source:]]` into document-chunk
chips. `30 passed` (A0–A5) + `3 passed` (A5 focused); `compileall` 0; `npm run build` passes.

**Implementation note (verified low-risk).** The delivered `provenance` preserves the provenance object but
**replaces `source_refs`** with the normalized/numbered CitationRef-shaped refs (the frontend delivery contract).
Strategy-thread check: the **stored** row provenance (`:109`, `domain_agent_artifact_provenance_v1`) is untouched,
and provenance was **not delivered at all before A5** — so there is **no pre-existing consumer** of the delivered
shape; the replacement is safe. No design deviation; no London flag.

**Ep7A build status: A0–A5 all built + reconciled.** Only **A6 (smoke + acceptance + the consolidated live-DB
apply)** remains for Ep7A. Ep7B (B0–B3) is the follow-on geometry track.

**Next:** open **sub-phase A6** — the end-to-end matrix (family × surface across VCSO + artifact library), the
folded-in L18 credential debt, and the **consolidated live-DB apply pass** (the §8 ledger: A1 citations column,
A4 `citation_verifier` setting, A2 platform-table confirmations). A6 applies these to live Supabase **with
London's explicit per-apply approval** (they mutate the shared project).

### 2026-07-06 — A6 Track 1 completion reconciliation — Ep7A build + acceptance complete (live pending)

**Status: A6 Track 1 complete, verified.** The acceptance matrix (`python-backend/tests/test_ep7a_acceptance.py`)
runs the lit families — `document_chunk`, `wiki_page`, `platform_record` — green locally across **VCSO + artifact
library** (chip-shaped ordinals → `POST /api/citations/resolve` → Check Citations). `web` = `pending-producer`;
`reflection_reviews` = dormant/unresolvable (not failing). L18 smoke: runnable local pieces passed; pending-live
set (GKE sandbox verify, live sandbox bridge/tool-loop credential smoke, real MCP connector creds, verifier
persistence after DB apply) staged in `phases/a6-smoke-acceptance/L18-SMOKE.md`. `37 passed` across A0–A6 +
MCP scaffold; `compileall` passes; `Pro-Suite-Progress.md` updated with the Ep7A A6 row + pending-live list.

**Boundary held (the critical check).** The live-DB runbook is staged in
`phases/a6-smoke-acceptance/LIVE-DB-RUNBOOK.md`; the two `20260706_*` migrations were validated for idempotency;
**nothing was applied to shared Supabase.** Track 2 remains a London working session.

**Implementation note (sound).** The harness treats "chip" as the **functional backend contract** (numbered
citation refs + `[n]` bindings), not a browser visual assertion — visual assertions belong to the §8 pass.
No design deviation; no London flag.

**Ep7A status: BUILD + ACCEPTANCE COMPLETE (A0–A6 Track 1).** Ep7A is **live-complete after Track 2** (the
gated Supabase apply session): apply `LIVE-DB-RUNBOOK.md` R1 (citations column) + R2 (`citation_verifier`
setting) + R3 (confirm 15 platform tables), then the live smoke of the lit matrix. Ep7B (B0–B3 geometry) is the
independent follow-on track, still at directional-plan stage.

---

## Ep7B (Tier 3 geometry) — decisions

### 2026-07-06 — B0 sub-phase entry: ingestion reality + the chunker decision (London-confirmed)

Pinning the live ingestion pipeline (`services/doc_processor.py`, `vector_store.py`) for the B0 RESEARCH pass
surfaced that geometry is **discarded today** and forced a design decision, now resolved with London.

**Ingestion reality.** Docling is the parser (`_read_with_docling:122`) but it **exports to markdown**
(`export_to_markdown`) and **discards the structured `DoclingDocument`** — so per-item `prov` (page_no + bbox)
is lost. Chunking then splits the flattened markdown with `RecursiveCharacterTextSplitter` (`_split_text:210`),
and `page_number` is a **crude regex** guess from "page N" text (`_chunk_context:233`). `document_chunks` rows
carry `content, embedding, metadata` — **no `page_number`/`bbox`/`verbatim` columns** (`replace_document_chunks:236`).
So there is no chunk→geometry path today.

**Decision (London-confirmed) — switch PDF ingest to Docling's layout-aware chunker.** For **PDF + image**
inputs, replace the markdown-split path with Docling's layout chunker (e.g. `HybridChunker`) so each chunk
natively carries `page_number`, `bbox` (union of the chunk's item boxes on its page), and a **verbatim source
face**. **Non-PDF formats** (docx/pptx/xlsx/csv/txt/md/html) keep the current path — `verbatim` = chunk source
text, `page_number`/`bbox` null (geometry is only well-defined for PDF/image). **Forward-only, no backfill (L10);
sequence before OS Engine bulk-upload GA (DP6).**

**Flag for London (accepted).** Switching the PDF chunker **changes chunk boundaries** for new PDF ingests vs.
the old splitter. Low risk given no users / no backfill, and Docling chunking is generally better for retrieval —
but **B0 must re-validate retrieval** (hybrid search still returns sensible chunks) as an acceptance gate, not
assume it. OCR preflight (C-3) for non-machine-readable PDFs is in scope (Docling OCR pipeline options).

**Schema (additive, forward-only):** `document_chunks` gains `page_number int`, `bbox jsonb`, `verbatim text`.
Promotes `page_number` from a metadata guess to a real layout-derived column. This migration joins the A6
live-DB apply set as a **B-series item** (applied in a later live session, not A6's).

**Next:** author + open **sub-phase B0** with the chunker decision locked.

### 2026-07-06 — B0 blocker resolved (Docling API pinned) + dual-face refinement

The first B0 execution attempt correctly **stopped** (per the prompt's rail) because `docling` wasn't installed
in the agent's local venvs to introspect — despite `requirements.txt` pinning `docling==2.44.0`. Strategy-thread
resolution: **the version is pinned, so the API is deterministic — I pinned it authoritatively from the official
Docling docs** (chunking concepts + hybrid-chunking example) into `phases/b0-ingestion-geometry/RESEARCH.md §3`.
The B0 prompt/plan are updated: **code against the pinned 2.44.0 API; Docling install is a run-env prerequisite
for tests, not a stop-block** — if the env lacks it, implement + defer the live ingestion test (deferred-test
pattern).

**Refinement surfaced by the API research — dual-face for free (C-4).** Docling's `HybridChunker` yields both
faces per chunk: **`chunk.text`** (raw → the `verbatim` column) and **`chunker.serialize(chunk)`**
(context-enriched → what we EMBED as retrieval `content`). So B0 stores `verbatim = chunk.text` and sets embedded
`content = chunker.serialize(chunk)` — matching the reference's dual-face model exactly. `page_number`/`bbox`
come from `chunk.meta.doc_items[].prov[]` (`page_no`, `bbox` l/t/r/b + coord_origin). Note: the docling-serve
unresolved-prov bug does **not** apply — ArchitectOS uses `DocumentConverter` in-process, so prov is populated.

**Env prerequisite flagged to London:** running B0's ingestion tests needs `docling==2.44.0` installed in the
backend env (a declared dependency; the agent's local venvs lacked it). Install it there, or accept B0 landing
code + staged migration with the live ingestion test deferred to a docling-enabled env / CI.

**Next:** re-run B0 execution with the pinned API (unblocked).

Sources (Docling API pinning): docling-project.github.io/docling chunking + hybrid_chunking docs.

### 2026-07-06 — B0 completion reconciliation (ingestion geometry built)

**Status: B0 complete, verified.** `DocumentChunk` (`doc_processor.py:48`) now carries optional `page_number`,
`bbox`, `verbatim`. PDF/image ingest uses the pinned Docling 2.44.0 layout path (`DocumentConverter().convert` →
`HybridChunker().chunk`), with **`verbatim = chunk.text`** and **embedded `content = chunker.serialize(chunk)`**
(dual-face). Non-PDF keeps `_split_text` (verbatim = chunk text; geometry null). `replace_document_chunks`
(`vector_store.py:265`) persists the new fields. OCR preflight enables `PdfPipelineOptions(do_ocr=True)` via
`PdfFormatOption` for text-layerless PDFs. **Retrieval re-validated** — `hybrid_search` still returns sensible
enriched content after the chunker switch (the acceptance gate). `5 passed`; `compileall` passes. No
B1/B2/UI/backfill; nothing applied to shared Supabase.

**`bbox` jsonb contract (B1/B2 must consume this exact shape):**
`{page_no, l, t, r, b, coord_origin, charspan, page_w, page_h}`, plus `multi_page` + `pages[]` when a chunk
spans pages. B1's geometry resolver and B2's canvas transform key off `l/t/r/b` + `coord_origin` + `page_w/page_h`.

**Migration staged (not applied):** `docs/migrations/20260706_document_chunks_geometry.sql` (additive
`page_number int`, `bbox jsonb`, `verbatim text`). **Joins the B-series live-DB apply session** (separate from
A6's), applied with London.

**Carried — deferred live ingestion smoke.** The real-PDF ingestion smoke is deferred because `docling==2.44.0`
isn't installed in the run env (the flagged prerequisite). Folds into the B-series live/enabled-env pass:
install docling in the backend env, then ingest a real PDF and confirm `page_number`/`bbox`/`verbatim` populate.

**Ep7B status:** B0 build-complete (live ingestion smoke + migration deferred to the B-series session). Next:
**B1 (geometry-aware chunk resolver)** — extend the A2 `chunk_resolver` with a geometry branch consuming the
`bbox` contract above; fall back to line-level for pre-B0 (geometry-less) chunks.

### 2026-07-06 — B1 completion reconciliation (geometry-aware resolver built)

**Status: B1 complete, verified.** `chunk_resolver.py:16` now selects `page_number, bbox, verbatim`; returns
`verbatim = chunk.verbatim or chunk.content` (raw face post-B0, content fallback for legacy); when **both**
`page_number` and `bbox` exist, sets `locator.kind = "bbox"` and passes the B0 `bbox` jsonb through unchanged;
otherwise falls back to A2's line/section locator (geometry null). **Payload additive — A3 keeps working**
(ignores `bbox` until B2). `12 passed` (B1 + A2 resolver, repo-local `.venv-kb-nav`); `compileall` passes.
Nothing applied to shared Supabase.

**Note (env, not a concern):** the initial run failed on a global interpreter lacking `fastapi`; the repo-local
venv is the correct env (same lesson as B0's docling — backend deps live in the repo env, not the global one).
No design deviation; no London flag.

**Ep7B status:** B0 + B1 build-complete. Next: **B2 (PDF highlight rendering)** — the frontend canvas highlight
consuming `locator.bbox` (`{page_no,l,t,r,b,coord_origin,charspan,page_w,page_h}` + multi-page) in the VCSO
sidecar + artifact view. The geometry track's payoff phase; then **B3 (Ep7B acceptance)**.

### 2026-07-06 — B2 sub-phase entry: render approach decided (London) + mount points pinned

**Decision (London-confirmed) — client-side pdf.js.** No PDF renderer is vendored (`package.json` has none) and
no source-PDF URL reaches the browser today. B2 adds **`pdfjs-dist`** to the frontend and an **owner-scoped
backend signed-URL endpoint** for the source document; the sidecar renders the cited page to a `<canvas>` and
overlays the `bbox` rectangle. Chosen over server-rendered images (static, backend rasterizer) and defer-pixel
(no rectangle) for interactivity + reference-parity.

**Mount points pinned.**
- **Frontend — `components/pro-suite/virtual-cso/CitationReaderBody.tsx`.** The `chunk` view (`:147–148`)
  renders `<EvidenceHighlight>{view.verbatim…}</EvidenceHighlight>`. B2 mounts the pdf.js canvas + bbox overlay
  here **when `view.locator.kind === "bbox"` and the document is a PDF**; falls back to the text
  `EvidenceHighlight` otherwise. **This component is shared by VCSO *and* the A5 artifact view — one change
  covers both surfaces.** `pdfjs-dist` needs its worker wired for Vite (`pdf.worker` via `import.meta.url`).
- **Backend — source PDF access.** `download_raw_document(storage_path)` (`vector_store.py:43`) pulls from
  `settings.raw_document_bucket`; docs carry a `storage_path` on `ose_raw_document_registry`. B2 adds an
  owner-scoped **`GET /api/documents/{document_id}/signed-url`** (dependency `get_current_user_id`, mirror the
  artifact signed-url pattern) → look up the doc's `storage_path` (user-scoped), `create_signed_url` on the
  raw-document bucket, return it. The sidecar fetches the PDF from that URL only when opening a geometry chunk.

**Coord transform (B2 handles).** Map page-space `bbox` (`l,t,r,b` in `page_w × page_h`, honoring `coord_origin`
— Docling PDF boxes are typically BOTTOM-LEFT, so flip Y for a top-left canvas) onto the pdf.js viewport scale;
overlay a positioned rectangle, centered. Multi-page chunk → highlight the `bbox.page_no` page.

**Deferred (B-series / enabled env).** Geometry columns are live only after the B0 migration applies, so B2's
**full pixel-render smoke needs a real geometry-bearing PDF** — deferred to the B-series live/enabled-env pass
(same posture as B0/B1). B2 builds + unit-tests the transform with fixtures now.

**Next:** author + open **sub-phase B2** with the client-pdf.js decision locked.

### 2026-07-06 — B2 completion reconciliation (PDF highlight built)

**Status: B2 complete, verified.** Geometry-capable PDF chunk citations fetch an owner-scoped raw-document
signed URL, render the cited page with `pdfjs-dist`, overlay the B1 `locator.bbox`, center + keep aligned on
zoom — all in the shared `CitationReaderBody.tsx:168`, so **VCSO + artifact view both light up**. Backend:
`GET /api/documents/{document_id}/signed-url` (`main.py:901`, `get_current_user_id`, 300s expiry) →
`create_raw_document_signed_url` on the raw-document bucket (`vector_store.py:52`). Frontend: `pdfjs-dist` +
Vite worker (`pdfjs-dist/build/pdf.worker.min.mjs`) + authed client call (`virtualCsoApi.ts:749`). Coord
transform isolated + unit-tested (`citationPdfGeometry.ts:31`): top-left direct, bottom-left flips against
`page_h`, reversed-ordering normalized. Fallback to text `EvidenceHighlight` for geometry-less / non-PDF /
signed-url/render failures. `npm run build` + the B2 pytest + vitest transform test pass; nothing applied to
shared Supabase; B0/B1 untouched.

**Security verified (the IDOR check).** `get_document(document_id, user_id)` (`vector_store.py:73`) filters
`.eq("id", …).eq("user_id", …)` — a caller **cannot sign another user's document** (returns nothing → 404). The
endpoint is authenticated (`get_current_user_id`) **and** the lookup is user-scoped, with a short 300s expiry.
No IDOR; sound. No design deviation; no London flag beyond the expected deferred smoke.

**Ep7B status:** B0 + B1 + B2 build-complete. Only **B3 (Ep7B acceptance)** remains — the end-to-end geometry
proof on a real forward-ingested PDF (the deferred pixel smoke), converging with the **B-series live-DB apply +
Docling install session** with London. Structure B3 like A6: an autonomous acceptance track + a gated live session.

### 2026-07-06 — GOVERNANCE CHANGE: live Supabase schema clearance granted (London)

**London granted execution agents clearance to work in the live Supabase schema via the Supabase MCP** — "they
can create whatever tables or fields needed to make the functional wiring complete." This **lifts the gating**
on the deferred live-DB work: the staged additive migrations and any needed table/field creation may now be
**applied by the execution agent** (B3), not held for a separate London session.

**Scope + guardrails (apply to B3 and any live-DB agent work):**
- **Cleared:** apply the staged **additive/idempotent** migrations (A1 `citations` column, A4 `citation_verifier`
  setting, B0 `document_chunks` geometry columns) via MCP `apply_migration`; verify each after; create/confirm
  any table/field genuinely needed to complete **citation functional wiring**.
- **NOT cleared (out of scope / require care):** destructive ops (drops, column removals, data deletion),
  restructuring existing tables, or backfill (L10 — forward-only stands). Clearance is to *complete wiring*, not
  restructure. If a change looks destructive or non-additive, stop and flag.
- **`reflection_reviews` stays dormant by design.** It is absent because the **Reflection Review feature isn't
  wired** (V-11 placeholder) — creating an empty table would not make it functional (no data flows in) and is
  out of Ep7 scope. Leave its resolver dormant; do **not** fabricate an empty source table.
- **`citation_verifier` (R2) dependency:** if `ai_models` / `platform_ai_settings` don't exist, they're needed
  for the setting — confirm via MCP and create only if genuinely required for the verifier wiring.

**This makes B3 a consolidated live-acceptance phase** (apply all staged Ep7A + Ep7B migrations live + run the
live smoke), not a doc-only staging pass. **Docling install remains a separate env matter** (not a schema
issue) — if the agent's env still lacks docling, the real-PDF ingestion smoke uses a **seeded geometry chunk**
(see B3 RESEARCH) to prove the resolve→highlight path live without Docling.

**Next:** author + open **sub-phase B3** as the consolidated live acceptance (greenlit).

### 2026-07-06 — B3 completion reconciliation — **EP7 LIVE-COMPLETE** (with residuals)

**Status: B3 complete; Ep7 (A + B) is functionally live.** Applied + verified live on Supabase project
`pwacpjqkntnovndhspxt`:
- **R1** `vcso_chat_messages.citations` → `jsonb not null default '[]'::jsonb`. ✔
- **R2** `citation_verifier` → enabled setting → active `claude-3-5-haiku-latest`, family `utility`. ✔
- **BG** `document_chunks.page_number/bbox/verbatim` → all three columns live. ✔
Ep7A acceptance `3 passed` (with the new B3 test); `test_ep7b_acceptance_b3.py` added; `compileall` passes;
`Pro-Suite-Progress.md` updated. **No destructive schema changes, no backfill, `reflection_reviews` not fabricated.**

**R3 findings (resolved + one new follow-up):**
- `ai_models` + `platform_ai_settings` exist (R2 dependency satisfied). ✔
- `reflection_reviews` absent → **left dormant** (correct). ✔
- `cc_versions` vs `clarity_compass_versions` — both exist, **different shapes, not duplicates** (earlier flag resolved). ✔
- **NEW FOLLOW-UP — `mra_checkpoints` is absent live.** The A2 `platform_record_resolver` registry names
  `mra_checkpoints`, but the live MRA substrate is **`gm_checkpoints` / `gm_checkpoint_*`**. Agent correctly did
  **not** create a duplicate. **Impact:** MRA-sourced `platform_record` citations resolve to nothing until the
  renderer is repointed. This is a small **post-Ep7 fix** (not a dormant feature — MRA data exists): update the
  A2 registry's MRA renderer to the real table + columns (verify exact shape via MCP). See "Open follow-ups" below.

**Residuals (env-gated, not design gaps):**
1. **Full PDF pixel smoke deferred** — Docling not installed locally **and** live raw-document storage has **no
   PDF object** to seed against (expected: beta, no uploads yet). Agent seeded one clearly-marked synthetic
   geometry chunk, verified the live DB shape the resolver consumes, and **cleaned it up (0 synthetic rows
   remain)**. The resolve→highlight *contract* is proven; a real rendered rectangle awaits a live PDF + Docling.
2. **Vitest transform run blocked** by sandbox/config + usage limits — the TS transform test file + the Python
   B3 transform fixture are in place; the JS test just wasn't executed this session.

**Ep7 status: BUILD-COMPLETE + LIVE-COMPLETE (A0–A6, B0–B3).** The citations & source-grounding episode is done:
one citation currency; turn binding; four-tier resolvers; VCSO chip/sidecar/jump + Check-Citations; auditable
artifacts; forward-only PDF geometry ingest → resolve → highlight. All migrations live.

## Open follow-ups (post-Ep7, small)
1. **A2 MRA renderer repoint** — `platform_record_resolver` registry `mra_checkpoints` → live `gm_checkpoints`/
   `gm_checkpoint_*` (verify exact table + columns via MCP). Makes MRA platform-record citations resolve.
2. **Full PDF pixel smoke** — once Docling is installed in the backend env and a real PDF is ingested: ingest →
   confirm geometry columns populate → resolve (B1) → rendered highlight (B2).
3. **Run the vitest transform test** (`citationPdfGeometry.test.ts`) in a JS-test-enabled env.
4. **§8 front-end visual-polish pass** — the downstream cross-cutting workstream for all Ep7 citation UI
   (chips, sidecar, PDF highlight). Separate from Ep7.
