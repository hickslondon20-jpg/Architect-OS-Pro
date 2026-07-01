# Sub-phase 01 Context — Verify & Delta (OS Engine Knowledge-Pages)

**Date:** 2026-06-30
**Outcome:** Ready to execute. A **read-only investigation** pass — no design decisions, no code. It
grounds the Layer 2 (document-wiki) build by establishing exactly what the OS Engine already provides
for an emergent document wiki, and whether to build the synthesis engine on it (the locked prior A2).

---

## What this sub-phase is

The verify-before-build gate for Layer 2 — the same discipline as Layer 1's `01-verify-delta`. It exists
because the OS Engine appears to pre-scaffold most of the emergent document wiki (schema, taxonomy, UI,
a partial CSO read-hook) with the **synthesis/ingest engine missing**. Before scoping the engine, confirm
what's real, what's mock, what's legacy (Pinecone), and where it stalled.

Output: `01-01-DELTA.md` — a gap analysis + an explicit build-on-existing-vs-fresh recommendation.

---

## Decisions relevant to this sub-phase

None to make — findings to confirm/correct against `../../CONTEXT.md`:
- A2 prior: build the synthesis engine on the existing `ose_knowledge_pages` scaffold (validate or challenge).
- The open design decisions (page model, ingest model, taxonomy, source scope, vector, Layer-1 boundary)
  are **informed** by this delta but **decided in the design discuss after it**, not here.

---

## What this sub-phase does NOT do

- No schema, migrations, engine, or UI changes. **Read-only.**
- No design decisions — it surfaces evidence for them.
- No reference-repo extraction (that follows the design discuss).

---

## Tools the execution agent may use

- **Read** the OS Engine code (`lib/osEngineApi.ts`, `lib/osEngineMockData.ts`,
  `components/pro-suite/os-engine/**`, `api/vcso/chat.ts`) and the KB Explorer / Python ingestion code.
- **Read-only Supabase** (service role) — `information_schema` introspection, column/constraint dumps,
  row counts, function definitions. No writes, no DDL.

---

## Files to be created or modified

| File | Action | Notes |
|---|---|---|
| `01-01-DELTA.md` (this folder) | **Create** | Sections A–I + gap table + build-on-existing recommendation. |

---

## Success criteria (from `01-01-PLAN.md`)

1. `ose_knowledge_pages` schema + vector situation + RLS documented.
2. Taxonomy + UI wired-vs-mock documented.
3. CSO read-hook behavior documented.
4. Ingest gap confirmed; abandoned page-generation code (if any) surfaced.
5. KB Explorer source + Layer-1 boundary documented.
6. Explicit build-on-existing-vs-fresh recommendation; no production code.

---

## Handoff

The delta returns to the strategy thread, which runs the **Layer 2 design discuss** (page model, ingest
engine, taxonomy, source scope) grounded in the findings, then plans the build sub-phases.

*Context written: 2026-06-30 — Discuss/Plan thread.*
