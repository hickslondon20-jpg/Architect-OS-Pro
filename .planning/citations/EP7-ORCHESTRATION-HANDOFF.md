# Episode 7 — Orchestration Handoff: Citations & Source Grounding

> For the intelligence-layer orchestration thread that has facilitated Ep1 → Ep7. This brings you up to speed on
> what Ep7 accomplished, what's now functionally wired + soft-locked, where the canonical state lives, and what's
> outstanding — so you can help scope the next push. Authored 2026-07-06.

---

## TL;DR

**Episode 7 (Citations & Source Grounding) is build-complete and live-wired.** It was run as a two-track,
sub-phase GSD build (Ep7A A0–A6, Ep7B B0–B3) using the same cadence as the wiki workstreams. Every phase is
built, verified, and reconciled; all schema migrations are **applied live** to Supabase `pwacpjqkntnovndhspxt`.
The whole citation stack is **functionally wired from a code standpoint and soft-locked**, pending (a) a small
number of tracked follow-ups and (b) the planned **§8 front-end/UX audit + design pass** (episode-map §8.1).

**Immediate go-forward (founder's steer):** scope a **testing + UI-polish** pass *before* any front-end design
work. Design comes after.

**Point yourself at:** `.planning/citations/` — `README.md` (orientation), **`CONTEXT.md` (the locked-decisions
ledger + a dated reconciliation for every phase — read this)**, `REFERENCES.md` (reference-PRD → phase map),
`ROADMAP.md` (phase tracker), `phases/*` (each sub-phase's plan/research/context/execution-prompt). Progres also
logged in `Pro-Suite-Progress.md`.

---

## 1. The Ep7 reframe (why it wasn't build-from-scratch)

Per the episode-map Ep7 Refinement + locked decisions **L22–L25**: the platform had already converged on a
source-ref shape and the wiki layers already emitted structured citations, so Ep7 = **(1) unify the existing
source-ref/evidence shapes into one currency, (2) build the rendering + verification UX, (3) add Tier-3 ingestion
geometry only where PDF-rectangle highlighting is needed.** We honored L22 (one currency, no parallel per-message
store), L23 (four source-kind families, tier-complete by construction), L24 (consume the connection phase, don't
build the router), L25 (Ep7A / Ep7B split), plus L8/L9/L11.

A live-substrate audit sharpened this: there was **no single `AgentSourceRef` in practice** — seven divergent
live source-ref shapes. The unification was the real work.

---

## 2. What was built (phase-by-phase)

Same ways-of-working per sub-phase: RESEARCH (live-code/API extraction) → plan → per-phase CONTEXT → execution
prompt → execute → strategy-thread reconciliation into `CONTEXT.md §8`.

**Ep7A — unify + render + verify (non-geometry):**
- **A0** — `CitationRef` (`citation-1.0`) currency, additive over `AgentSourceRef` (+`verbatim`, +`locator`); 8
  normalization adapters; additive amendment appended to both frozen wiki contracts.
- **A1** — turn collection (both source pools unified) + per-message ordinal `[n]` binding in the VCSO loop;
  citations persist on the assistant message.
- **A2** — four resolver families (chunk / wiki_page / platform_record / web) + `POST /api/citations/resolve`;
  Tier-0 typed-renderer registry.
- **A3** — VCSO citation UX: inline chips, source sidecar (extends the shared `Reader`), jump-to-evidence;
  `SourceRef → CitationRef` type migration.
- **A4** — Check-Citations verifier (utility model, `citation_verifier` → Haiku; grades, never rewrites) **+ the
  browser-auth correction** (moved `/api/citations/*` off the ingest secret onto `get_current_user_id`).
- **A5** — Domain-Agent artifacts made auditable (plumbed `provenance.source_refs` through delivery + rendered).
- **A6** — Ep7A acceptance matrix + staged live-DB runbook (Track 1).

**Ep7B — Tier-3 geometry (forward-only):**
- **B0** — Docling **layout-aware chunker** for PDF/image ingest → per-chunk `page_number`/`bbox`/`verbatim`
  (dual-face: `chunk.text` raw + `serialize()` enriched). Non-PDF unchanged. Retrieval re-validated.
- **B1** — geometry-aware chunk resolver (additive; falls back to line-level for pre-B0 chunks).
- **B2** — client **pdf.js** canvas highlight (page-space→canvas transform w/ coord-origin flip), shared across
  VCSO + artifact view; owner-scoped raw-document signed-URL endpoint (IDOR-checked).
- **B3** — consolidated live acceptance: applied all migrations live + smoke.

---

## 3. What's now functionally wired + soft-locked (code + live)

- **One citation currency** flows chat → wiki → tools → artifacts; every surfaced source is citable.
- **VCSO**: numbered chips → sidecar resolve → jump-to-evidence → Check-Citations verdicts (persisted).
- **Domain Agents**: artifact-library citations, resolvable to source.
- **Geometry**: forward-only PDF ingest captures boxes; resolver + pdf.js highlight render the exact rectangle.
- **Live schema (Supabase `pwacpjqkntnovndhspxt`)**: `vcso_chat_messages.citations`, the `citation_verifier`
  model setting, and `document_chunks.page_number/bbox/verbatim` are all **applied + verified live**.

All additive/idempotent; **no destructive changes, no backfill** (forward-only per L10).

---

## 4. Decisions locked during Ep7 (deltas for your ledger)

Beyond L22–L25 (already locked), Ep7 resolved:
- **Currency design (DP1–DP6):** one `CitationRef` over `AgentSourceRef`; source-ref-first marking (inline
  markers only for verbatim binding); Tier-0 typed-renderer registry; on-demand utility-model verifier;
  forward-only geometry.
- **O1 (founder):** derived/operational source-kinds render in the **curated trace only**, never as chips.
- **O2:** `web` resolver built but **dark** (no producer tool registered yet).
- **O3:** **per-message** ordinal citation numbering (not thread-stable) — fits the discrete-message chat model.
- **O4:** artifact render surface = `DomainAgentArtifacts.tsx`; provenance was plumbed through delivery.
- **B0 chunker (founder):** switch PDF ingest to Docling's layout chunker (forward-only; retrieval re-validated).
- **B2 renderer (founder):** client-side pdf.js (interactive) over server-rendered images.
- **Auth correction:** browser-called citation endpoints use `get_current_user_id`, not the ingest secret.
- **Governance:** **execution agents cleared to work in live Supabase schema via MCP** — additive/idempotent only,
  no destructive ops, no fabricating unwired source tables (`reflection_reviews` stays dormant).

---

## 5. Outstanding (tracked in `CONTEXT.md` "Open follow-ups")

1. **A2 MRA renderer repoint (real wiring gap, small).** The `platform_record_resolver` registry names
   `mra_checkpoints`, but the **live MRA substrate is `gm_checkpoints`/`gm_checkpoint_*`** (surfaced at live
   apply). MRA platform-record citations won't resolve until repointed. Not a dormant feature — MRA data exists.
2. **Full PDF pixel smoke (env-gated).** Blocked only by Docling not installed in the run env **and** no live PDF
   uploaded yet. The resolve→highlight *contract* is proven (seeded chunk, cleaned up); a real rendered rectangle
   awaits Docling + a real PDF.
3. **Run the vitest transform test** (`citationPdfGeometry.test.ts`) in a JS-test-enabled env.
4. **§8 front-end/UX audit + design pass** (episode-map §8.1) — the downstream cross-cutting workstream for all
   Ep7 citation UI (chips, sidecar, PDF highlight) plus the broader real-wiring audit.

**Also still dark by design (not Ep7 bugs):** `web` citations (no producer tool — O2/F3); `reflection_reviews`
platform citations (Reflection Review feature unwired, V-11).

---

## 6. How to help push forward (recommended sequencing)

The founder's steer is **testing + UI polish before design**. Suggested next moves, in the same GSD cadence:

1. **Quick win:** knock out follow-up #1 (A2 MRA repoint) — a contained fix that lights up MRA citations.
2. **Scope a consolidated testing pass** — fold in the env-gated smokes (PDF pixel #2, vitest #3), the L18
   live-credential debt that's been rolling forward, and end-to-end citation testing across surfaces. This is the
   "test everything now wired" pass before touching design.
3. **Scope the UI-polish pass** — functional-but-unpolished Ep7 surfaces (chips, sidecar, PDF highlight) get
   legibility/interaction cleanup, still short of full design.
4. **Then open §8** — the front-end/UX design audit + real-wiring pass across everything Ep1–Ep7 implemented.

Ep7's citation rendering was intentionally built **functional, with visual polish deferred to §8** — so the
testing/polish pass is the natural bridge, and the §8 design work inherits a fully-wired, tested substrate.

Everything is durably captured: the `CONTEXT.md` ledger holds the full decision history and every phase
reconciliation, so this can be picked up cold. Ep7 is closed; the arc's remaining work is testing → polish →
§8 design.
