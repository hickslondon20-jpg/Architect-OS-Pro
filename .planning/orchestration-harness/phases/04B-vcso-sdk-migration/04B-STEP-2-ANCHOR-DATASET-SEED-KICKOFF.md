# 04B — Step 2 Execution Kickoff: Seed the Anchor-Supporting Dataset

**Date:** 2026-07-30 · **You are:** the **execution agent** for Step 2 of the VCSO SDK migration's N=5
probe. **Cold pickup — this document is self-contained.**

**This document has two phases and a hard stop between them.**

- **Phase 2A — design and propose. NO WRITES OF ANY KIND.** You produce a dataset design and stop.
- **Phase 2B — insert and verify.** **Only after London approves the design in this thread.**

**This is the first step in this workstream that writes founder data.** Everything before it was
read-only, or flag-only through a guarded arming script. Treat the write accordingly: designed first,
approved explicitly, reversible by construction, and labelled so it can never be mistaken for real
founder-supplied records.

---

## 1. Why this step exists

The N=5 reliability bar runs a **pinned anchor** — byte-for-byte, in version control at
`services/vcso_canary_anchor.py`:

> *"Our client concentration is rising and our margin is compressing. What should I do in the next 90 days?"*

Canary Run 1 (2026-07-30, parent `c2f7afc2-cba5-4338-bec3-e650c64afdf6`) **failed** — and the failure was
not the mechanism. Delegation was unprompted and correctly ordered, there were zero hook refusals, zero
direct handler executions, correct model tiers, 46 citations, and the `stop_hook` never had to block. What
failed was the answer: the lead asserted concentration ratios, margin percentages, and a directional
"keeps rising" claim **with no computation**, because the data cannot support one.

**Verified directly against the database:** the canary founder owns **exactly one dataset containing
exactly one row** — a single-period summary P&L for 2026-06-01 → 2026-06-30, with **no client-level rows.**

So the anchor's `PASS — delegated and computed` outcome was **structurally unreachable**, and the only
other pass requires STEER, a behaviour not built until Phase G. **The anchor is not the problem and is not
being changed. The evidence base under it is being repaired.**

Full record: `04B-NATIVE-SURFACE-PLAN.md` §5B.6. Read it before you design anything.

---

## 2. What the dataset must make possible

The anchor must become answerable **only by retrieving and computing**, never by a direct read. Concretely,
after this step a correct turn must require:

1. **A multi-period series** — enough consecutive periods that "rising," "compressing," and "the next 90
   days" are grounded claims rather than assertions. A single quarter is not a trend.
2. **Client-level revenue granularity** — concentration means top-N client share of revenue. Run 1's
   structured worker failed on exactly this: *"no client-level rows."*
3. **Margin derivable per period** — revenue and cost such that margin is computed, not stored as a
   ready-made percentage. If margin can be read off directly, `execute_code` is unnecessary and the anchor
   degrades back into a Mode B question.

**Design goal, stated plainly: after this step, no direct read should be able to answer the anchor, and
any correct answer should require a computation over multiple periods with cited provenance.**

---

## 3. Phase 2A — design and propose. No writes.

### 3.1 Hard technical constraints — verify each yourself, do not take them on trust

- **The 20-row default is a fabrication vector.** `_execute_get_dataset_periods`
  (`tool_registry.py:1319–1378`) defaults `limit=20` with a **maximum of 100**, fetches `limit + 1`, and
  reports truncation. A model calling with the default against a 48-row series gets a **silently partial
  series unless it notices the truncation flag** — and a partial series is exactly how a confident wrong
  number gets produced. **Design so that a default-limit call returns a complete, self-consistent unit of
  evidence.** State explicitly in your proposal what a default-limit call returns.
- **`founder_dataset_rows` requires `table_id` NOT NULL**, so a `founder_dataset_tables` row must exist
  first. `values`, `normalized_values`, and `provenance` are all NOT NULL jsonb.
- **The schema already supports entity-level rows** — `entity_name`, `period_grain`, `period_start`,
  `period_end`, `source_row_index`, `row_label`. Use the schema's own shape; do not smuggle client
  breakdowns into a nested blob without saying why.
- **Row ordering is `source_row_index`** — set it deliberately, because it determines what survives
  truncation.
- **Founder scope is doubly bound.** Rows carry their own `user_id` in addition to `dataset_id`. Every
  seeded row must carry the canary founder's `user_id`. Getting this wrong creates a cross-tenant row,
  which would violate the founder-isolation lock.

### 3.2 Provenance and honesty — non-negotiable

**Cited provenance is a binding lock.** This data is seeded, not founder-supplied, and it will be **cited
in founder-visible answers.** Therefore:

- `dataset_name` must make the seeded nature unmistakable at a glance, in the same spirit as the existing
  `SEED — Q2 2026 P&L Dataset`.
- `provenance` on the dataset **and on every row** must record that this is probe seed data, the date, and
  the step that created it. Never fabricate a source document, and leave `source_document_id` null unless
  a real document exists.
- The figures must be **plausible and internally consistent** — a concentration and margin story an agency
  would actually have — but they must never be presented anywhere as real business results.

### 3.3 Reversibility

Design so the entire seed can be removed by deleting a small, enumerable set of ids. Record every id you
intend to create. **Include a written rollback procedure in your proposal.** Do not implement a rollback
script unless the proposal is approved.

### 3.4 What to hand back

A written proposal containing: the dataset shape and why; period count, grain, and range; client count and
the concentration profile the numbers encode; the exact row count and what a **default-limit (20)** call
returns; the precise `values` / `normalized_values` / `provenance` JSON shape for one representative row;
the full id inventory; the rollback procedure; and **the reasoning for why a direct read cannot answer the
anchor under this design.**

Include one worked example: **the arithmetic a correct answer would have to perform**, showing which rows
it reads and what it computes. If you cannot write that arithmetic, the design does not yet support the
anchor.

**Then STOP. Do not insert anything. Do not create the table row. Do not "prepare" data in the database.**

---

## 4. Phase 2B — insert and verify. Only after London approves the design.

1. Insert exactly what was approved — no additions, no "while I'm here" improvements.
2. **Verify by reading back through the tool path, not the table.** Call `list_founder_datasets` and
   `get_dataset_periods` as the founder and confirm the rows come back correctly scoped, with provenance
   intact and **truncation reported accurately at the default limit.** A table read proves storage; a tool
   read proves the model will actually see it.
3. Confirm the id inventory matches the proposal exactly.
4. Confirm no row carries any `user_id` other than the canary founder's.
5. Report the inventory, the tool-path readback, and any deviation from the approved design.

**Do not arm any flag. Do not submit a turn. Do not run the anchor.** Run 2 of N=5 is a separate,
separately authorized step.

---

## 5. Gate

`compileall` clean if any code is touched (this step may need none); a version-tagged PATCH commit per
logical unit, incrementing forward from the latest commit message; the id inventory and rollback procedure
recorded in the repository, not only in chat. **Commit the two uncommitted plan-document edits in
`.planning/orchestration-harness/phases/04B-vcso-sdk-migration/` as your first unit** —
`04B-NATIVE-SURFACE-PLAN.md` (§5B.6) and this kickoff document.

---

## 6. Do not

- **Do not modify `PINNED_ANCHOR_PROMPT` or `PINNED_CONTROL_PROMPT`.** The anchor is not being re-pinned.
  A substituted anchor has already cost this project a canary.
- **Do not write anything in Phase 2A.**
- **Do not touch the existing `SEED — Q2 2026 P&L Dataset` row or the other tenant's dataset.** Add; do not
  edit or delete existing founder data.
- **Do not change `_execute_get_dataset_periods`, its default limit, or its truncation reporting.** If the
  20-row default is inconvenient for your design, **change the design, not the tool** — the limit and its
  truncation accounting are deliberate safety machinery.
- **Do not arm any flag, submit any turn, or run any canary.**
- **Do not touch Path A**, the external worker transport, `TURN_REGISTRY`, or the completion bridge.
- **Do not edit the harness-root `ROADMAP.md`.**
- **Do not commit secrets.**

## 7. Locks

Founder isolation · one writer (feed the OS Engine, never write the wiki) · cited provenance · cost-tier
routing at the capability grain with no founder-facing model selector · the context-selection IP · curated
transparency · bounded, non-recursive, depth-capped workers.

**Two bear directly on this step:** *founder isolation* — every seeded row carries the canary founder's
`user_id` and no other; and *cited provenance* — seeded data must be self-evidently seeded everywhere it
can be cited.

## 8. Discipline

**Observe, don't infer.** Pair every claim to a row, a line, or a command output. This migration has
shipped three false greens, each caught only by live observation. Verify the schema constraints in §3.1
yourself rather than trusting this document. Report negative and surprising results as results. Version
tags forward, PATCH per logical unit, commit each unit as you finish it. **Stop on the first failure with
evidence rather than retrying blind.**

## 9. Key files

```
python-backend/services/
  vcso_canary_anchor.py     PINNED_ANCHOR_PROMPT — read it, never modify it
  tool_registry.py          :694–757 list_founder_datasets / get_dataset_periods definitions
                            :1319–1378 _execute_get_dataset_periods — limit default 20, max 100,
                            truncation accounting, double founder scoping
Supabase project pwacpjqkntnovndhspxt:
  founder_datasets          id, user_id, source_document_id, dataset_name, dataset_type, status,
                            source_period_grain, normalized_period_grain, currency_code, summary,
                            provenance (NOT NULL), metadata (NOT NULL)
  founder_dataset_tables    required parent of every row — table_id is NOT NULL on rows
  founder_dataset_rows      user_id, dataset_id, table_id, source_row_index, row_label, period_start,
                            period_end, period_grain, entity_name, values, normalized_values,
                            provenance, confidence, requires_review
.planning/orchestration-harness/phases/04B-vcso-sdk-migration/
  04B-NATIVE-SURFACE-PLAN.md §5B.6   Run 1's full result and the data-floor finding — read first
```

## 10. Out of scope

Run 2 and the remainder of N=5. The two mandatory negative tests. The watched UI turn for render proof.
Step 3 deletion. Phases E, F, G. Domain Agents. **None of these are yours in this step.**
