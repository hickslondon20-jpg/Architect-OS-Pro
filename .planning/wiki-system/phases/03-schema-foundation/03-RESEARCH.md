# Sub-phase 03 — Reference Extraction (build-ready)

**Purpose:** turns the `REFERENCES.md` pointers for sub-phase 03 into decided, build-ready design for
the two plans in this folder: **03-01 (Supabase schema)** and **03-02 (wiki schema/config object)**.
The execution agent builds from this + the frozen contract and does **not** re-interpret the repos.

**Authoritative shape source = the frozen contract.** `../02-interface-contract/02-01-CONTRACT.md`
(`wiki-1.0`) already froze `claim{}`, `evidence{}`, and `digest{}`. **The schema MUST match the
contract field-for-field — do not re-derive shapes here.** This file adds only the design the
contract did *not* pin: the schema-object structure (A1), action-boundary metadata, B7 block model,
and the B3/B4 fields.

**Sources (fetched & verified 2026-06-29):**
- theafh `wiki/SKILL.md` — `<orient_first_top>`, `<architecture>` (SCHEMA.md role)
- OpenClaw memory overview — https://docs.openclaw.ai/concepts/memory ("Action-sensitive memories")
- OpenClaw `memory-wiki` — "Vault layout" (managed vs human blocks), "Dashboards" (B3/B8)
- 01-01-DELTA §A (GM tables), §C/§E (OSE scaffold)

---

## 1. Shapes are frozen — match the contract, don't re-extract

`wiki_claims`, `wiki_evidence`, and the `wiki_digest` JSONB must mirror the contract exactly:
- `claim{ id, page_key, text, class, status, confidence, recall_score, evidence[], contradictions[], updated_at }`
- `evidence{ source_id, source_kind∈{raw_document,document_chunk,tier0_record,global_checkpoint}, path, lines, weight, note }`
- `digest{ ... }` per contract "Digest Object" (pages[]/top_claims[]/counts/qualifiers).

If a column would diverge from the contract, **stop** — the contract is frozen for 03–05/07.

---

## 2. A1 — Wiki schema/config object (drives 03-02)

**Extracted (theafh `wiki/SKILL.md`):** "Read `$WIKI/SCHEMA.md` once at the start of any session…
The schema declares the domain, the page-type enum, the tag taxonomy, and the conventions every
subsequent action must honor." The linter reads the schema's frontmatter to learn the page-type enum
"so wikis can declare additional types … without modifying the linter."

**Our build decision (03-02):** one versioned schema object — typed config module **plus** a
`wiki_schema` Supabase row so Python compilation (04) and the TS frontend read one source. It declares:
- `wiki_schema_version: "wiki-1.0"` (must equal the contract version);
- the **7 fixed pages** with `kind` (compiled_base_only: diagnostic_synthesis, current_quarter_sprint;
  insight_accreting: the other five);
- `confidence_enum [high,medium,low]`, `claim_status_enum`, `claim_class_enum [compiled,insight,override]`;
- `frontmatter_contract` (page_key, wiki_version, last_compiled_at, tags);
- `contradiction_fields` (contradictions[], contested);
- `tag_taxonomy` — domains, **stages [1..5] modeled (Rising/Striving/Thriving/Driving/Arriving), content currently 1–4** (delta §A), tiers;
- helpers: `is_compiled_base_only()`, `is_insight_accreting()`, `valid_tag()`, `valid_page_key()`,
  `valid_confidence()`, `event_rebuild_targets()` (map declared here, filled in 04).

**Skip:** theafh's generic page-type enum (entity/concept/comparison/summary/query/procedure), the
`SCHEMA.md`-on-disk file, the linter-reads-frontmatter mechanism. We keep our fixed domain page set
and a Supabase/config home.

---

## 3. Action-boundary metadata (drives `wiki_insight_records`)

**Extracted (OpenClaw "Action-sensitive memories"):** capture *when it is safe to act* on a note, not
just the fact. Capture the action boundary when a note involves: approval/permission requirements;
temporary constraints; handoffs to another session/thread/person; expiry conditions; safe-to-act
timing; source/owner authority; instructions to avoid a tempting action. A useful action-sensitive
memory makes clear: what changes future behavior, when/under what condition it applies, when it
expires or what unlocks action, what to avoid, who the source/owner is. *"This is not a required
schema for every memory."*

**Our build decision (03-01 `wiki_insight_records`):** action-boundary fields are **nullable**,
populated **only** for action-sensitive insights (not every insight):
- `safe_to_act_after TIMESTAMPTZ` — safe-to-act timing / what unlocks action
- `expires_at TIMESTAMPTZ` — expiry condition
- `authority_owner TEXT` — source/owner authority (affects trust)
- `avoid_note TEXT` — the tempting action to avoid

This is the schema realization of D9 reasoning-only: an untrusted/quarantined insight that *implies*
an action carries its boundary, so the agent never acts on it prematurely even while it shapes inquiry.

---

## 4. B7 — Managed vs human blocks (the `class` column)

**Extracted (OpenClaw "Vault layout"):** "Managed content stays inside generated blocks. Human note
blocks are preserved." (`render.preserveHumanBlocks: true`.)

**Our realization (03-01):** the `class` column on `wiki_claims` is the relational form of managed-vs-
human: `compiled` = managed (regenerated by 04, never edited), `override` = human (founder-authored,
preserved), `insight` = appended (quarantined). The compile rule (04) replaces **only** `class='compiled'`
rows — the schema's write-lock trigger enforces that no other actor writes `class='compiled'`.

---

## 5. B3 / B4 — promotion-gate + reversibility fields

**Extracted (OpenClaw dreaming/memory):** promotions pass **score + recall frequency + query
diversity** gates (B3); nothing writes trusted directly, staging→promotion is the only path, and
promotions are reversible (B4).

**Our build decision (03-01):**
- On `wiki_claims`: `recall_score REAL` (the hidden machine score; B3, L3).
- On `wiki_insight_records`: `recall_count INT`, `query_diversity REAL`, `trust_state`
  (quarantined|promotion_candidate|trusted|rejected).
- `wiki_action_log` carries before/after `payload JSONB` so promotion/demotion is reversible (B4) —
  the contract's `demote_insight` reads this.

---

## 6. Delta integration (01-01-DELTA §A / §C / §E)

- **Global checkpoint family is NOT recreated.** `global_ip_pages` is a new authored-IP store only;
  the GM family (`gm_checkpoints` + `gm_audit_questions`/`gm_checkpoint_stage_meaning`/`gm_checkpoint_scoring`,
  125×4) is reached at read time via the §A join. `evidence.source_kind='global_checkpoint'` cites it.
- **Stage model:** `global_ip_pages.ladder_stage` is 1..5 (model all 5); content currently 1–4; stage-5
  is a known gap, not a schema constraint.
- **OSE scaffold:** do **not** migrate or rebuild `ose_knowledge_pages` / `ose_page_corrections`. They
  are the render-adapter target (connection phase). `wiki_*` tables stand alongside them, clean. Our 7
  `page_key`s stay canonical; record (don't collapse) the mapping to the 5 OSE seed page types.

---

## 7. Extract / skip summary

| Adopt (shape/semantics) | Reject (substrate) |
|---|---|
| schema-object structure (A1); action-boundary fields; class=managed/human (B7); recall/gate fields (B3); reversible action-log (B4) | `SCHEMA.md`-on-disk; generic page-type enum; vault layout + `.openclaw-wiki/` cache; markdown frontmatter blocks; lint/discover/init scripts |

**The schema must NOT contain** any markdown-vault layout, file path, or page-type enum from the repos.
Shapes come from the frozen contract; structure additions come from §§2–5 above.

---

*Extraction complete for sub-phase 03. The execution agent builds 03-01 (migrations) + 03-02 (schema
object) to match `02-01-CONTRACT.md`, applying §§2–6 for the parts the contract did not pin.*
