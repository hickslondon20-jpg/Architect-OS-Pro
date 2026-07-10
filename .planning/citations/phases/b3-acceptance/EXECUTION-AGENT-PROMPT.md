# Citations (Episode 7) — Sub-phase B3 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`. This session runs sub-phase **B3 only** — the Ep7 closeout: apply the
> staged migrations live + run the live acceptance smoke. This is the final Ep7 phase.

---

You are the **execution agent** for Sub-phase B3 (Ep7B Acceptance + Consolidated Live-DB Apply) of the
ArchitectOS Episode 7 (Citations) build. You build against **decided design** — implementation choices only. If
something needs a design decision beyond the inputs, **stop and flag it**.

You are in the `ArchitectOS Pro_beta` repo, canonical path `C:\Users\Hicks\ArchitectOS Pro_beta`.

**What B3 is, in one line:** with London's clearance, **apply the staged Ep7A + Ep7B additive migrations to live
Supabase via the MCP**, then prove the whole citation stack end-to-end — including the Ep7B geometry path.

---

## LIVE SCHEMA CLEARANCE — read first

London has **cleared live Supabase schema work via the Supabase MCP** to complete the citation functional wiring.
You **may** apply the staged additive migrations and create genuinely-needed tables/fields. **Guardrails:**
- **Additive / idempotent only.** **No** drops, column removals, data deletion, table restructuring, or backfill
  (L10 — forward-only stands). If a change looks destructive or non-additive, **stop and flag** — clearance is to
  *complete wiring*, not restructure.
- **`reflection_reviews` stays dormant** — it's absent because the Reflection Review feature is unwired; an empty
  table wouldn't be functional and is out of Ep7 scope. **Do not fabricate it.**
- **Verify after every apply** (information_schema / select).
- **Docling install is an env matter, not schema** — if your env lacks docling, use the **seeded geometry chunk**
  path (below); don't block on it.

---

## Orient first — read these in order, then act

1. `.planning/citations/phases/b3-acceptance/RESEARCH.md` — **primary source.** Live-apply order + verifies (§1),
   the acceptance matrix (§2), the real-ingest-OR-seeded-chunk geometry smoke (§3), the guardrails (§4).
2. `.planning/citations/phases/b3-acceptance/B3-01-PLAN.md` — task + criteria.
3. `.planning/citations/phases/b3-acceptance/CONTEXT.md` — scope, decided decisions, actions, criteria.
4. `.planning/citations/CONTEXT.md` — locked ledger (**wins on conflict**): §8 (the clearance + guardrails, the
   A6 live-DB ledger, the B0/B1/B2 reconciliations).
5. The staged migrations (`docs/migrations/20260706_*.sql`), `test_ep7a_acceptance.py`, the B1 resolver + B2
   signed-URL/render path, and the Supabase MCP.

Read 1–4 fully before acting.

---

## What you do

### 1 — Apply the staged migrations live (MCP `apply_migration`), verify each
- **R1** `vcso_chat_messages.citations jsonb` (A1; A4 verdicts ride inside it).
- **R2** `citation_verifier` model setting (A4) — first confirm `ai_models` + `platform_ai_settings` exist;
  create only if genuinely required for the verifier route.
- **BG** `document_chunks` geometry columns `page_number int`, `bbox jsonb`, `verbatim text` (B0).
- **R3** confirm the 15 platform-record tables; act per the dormancy rule (reflection_reviews dormant;
  cc_versions vs clarity_compass_versions not duplicative). Verify queries in RESEARCH §1.

### 2 — Ep7A live smoke
Re-run `python-backend/tests/test_ep7a_acceptance.py` against **live** schema: lit families resolve; citations
persist on `vcso_chat_messages.citations`; the verifier grades on the utility model. `web` pending-producer;
`reflection_reviews` dormant.

### 3 — Ep7B geometry smoke (real ingest OR seeded chunk)
BG is now live. Prove resolve→highlight:
- **Docling available:** ingest a real PDF → confirm chunks carry `page_number`/`bbox`/`verbatim`; resolve one
  (B1) → `locator.kind="bbox"`; hit the B2 signed-URL + confirm the transform/render.
- **Docling absent (likely):** **seed a geometry-bearing chunk** into live `document_chunks` for a real PDF
  already in the raw-document bucket (real `page_number`, `bbox` per the B0 contract, `verbatim`, correct
  `document_id`). Then assert B1 resolve returns geometry + raw verbatim, and B2's `GET
  /api/documents/{document_id}/signed-url` + transform (`citationPdfGeometry.ts`) work. **Clean up seeded rows
  after** (synthetic, not user data).

### 4 — Close out
Run any now-runnable L18 pending-live items. Update `Pro-Suite-Progress.md` — Ep7 (A+B) live-complete + any
residual. Add `python-backend/tests/test_ep7b_acceptance_b3.py` for the geometry resolve/signed-url/transform assertions.

---

## Hard constraints

- **Additive/idempotent live changes only** — no drops/removals/deletion/restructuring/backfill. Destructive → stop + flag.
- **Do not fabricate `reflection_reviews`** — dormant by design.
- **Verify after every apply.** Clean up any seeded test rows.
- **No B0/B1/B2 code changes**, no new features, no §8 visual polish. **CONTEXT wins** on conflict.

---

## Done when (B3 success criteria — CONTEXT §"Success criteria")

1. R1 + R2 + BG applied live + verified; R3 confirmed (reflection_reviews dormant).
2. Ep7A live smoke green (citations persist, verifier grades, lit-family resolve).
3. Ep7B geometry path proven live — resolve returns geometry + B2 render works (real ingest or seeded chunk).
4. No destructive ops; no backfill; only additive/needed wiring created.
5. `Pro-Suite-Progress.md` updated.

**Report back:**
- Which migrations you applied live + the verify results; R3 table findings (esp. reflection_reviews, ai_models/platform_ai_settings).
- Ep7A live smoke result; Ep7B geometry smoke result (real ingest vs seeded chunk; seeded rows cleaned up).
- Any residual (e.g. Docling ingestion smoke still env-blocked).
- Any change you had to stop-and-flag as non-additive/destructive.
- Any implementation choice deviating from/extending the design (for CONTEXT §8 reconciliation).

Then stop. This is the final Ep7 phase — the strategy thread logs the Ep7-complete amendment.
