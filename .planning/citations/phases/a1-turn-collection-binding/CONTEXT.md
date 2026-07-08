# Sub-phase A1 Context — Turn Collection + Answer-Span Binding

**Date:** 2026-07-06
**Outcome:** Ready to execute. **O3 is resolved** (`../../CONTEXT.md §8`, 2026-07-06) — no design spike
remains; the binding scheme is decided. The execution agent makes implementation choices only, not design
choices.

---

## What this sub-phase is

Makes the A0 currency *flow through a real turn*: collect the turn's sources from **both** live pools into one
deduped `CitationRef[]`, number them, bind `[n]` markers in the streamed answer to them, and replace the VCSO
stream's divergent `{kind,label,pageId}` refs with unified `CitationRef` events. Citations are the turn's
collected list persisted on the assistant message — **no parallel per-message citations store** (L22).

Single deliverable: **A1-01** (see `A1-01-PLAN.md`).

---

## Inputs the agent must read first (in order)

1. `RESEARCH.md` (this folder) — **primary build source.** The live VCSO loop: two source pools (§1), the
   final-answer injection point (§2), stream events (§3), persistence/reload (§4), deep-resume (§5), the
   adapters (§6), the decided binding scheme (§7).
2. `A1-01-PLAN.md` (this folder) — task + the decided O3 scheme + success criteria.
3. `../../CONTEXT.md` — locked ledger. §3.1 DP2 (source-ref-first), §4 O3 (resolved), §5 F4, §8 amendments
   (A0 completion + the O3/two-pool entry). **CONTEXT wins on any conflict.**
4. `python-backend/services/citations/models.py` + `normalize.py` — the A0 currency + adapters this phase consumes.
5. `python-backend/services/vcso_chat_service.py` — the loop being modified (re-verify anchors).

---

## Decisions already made (do not re-open)

- **Binding = per-message ordinal `[n]`** over the deduped turn `CitationRef[]`; dedup key
  `(source_kind_family, source_id)` + content-hash fallback; invalid `[n]` dropped; `[[Source:]]` verbatim
  marker coexists; **cross-turn thread-stable numbering deferred** (O3).
- **Unify both source pools** — Pool 1 (`_build_context` display refs) + Pool 2 (`all_sources` tool refs) →
  one turn list.
- **Source-ref-first grounding** (DP2) — the model is given a numbered source list, not in-context markers;
  A4 verification is the backstop. **No mandatory reference-style marking.**
- **No parallel citations store** — persist on the assistant message.

---

## What this sub-phase does NOT do

- No resolving a ref to a viewable source (A2); binding is index→ref only, no source fetch.
- No chip/sidecar UI or client-side `[n]` render polish (A3 + §8).
- No verification (A4). No artifact surface (A5). No geometry (Ep7B).
- No producer rewrites; adapters (A0) do the shaping. No new tools.
- No cross-turn thread-stable numbering.

---

## Files to create or modify

| File | Action | Notes |
|---|---|---|
| `python-backend/services/citations/binding.py` | Create | Dedup + ordinal numbering of the turn `CitationRef[]`; `[n]` parse + bind; invalid-index drop; `[[Source:]]` lift. Pure where possible. |
| `python-backend/services/vcso_chat_service.py` | Modify | Collect both pools via A0 adapters; inject numbered source list + cite-`[n]` instruction into the final-answer pass; parse `[n]` from `text_stream`; emit `CitationRef` step/`done` events; persist turn `CitationRef[]`; preserve deep-resume. |
| messages table (migration) | Create/confirm | Add a `citations jsonb` column on the assistant-message table if none exists (reload-safe home). Confirm live schema first. |
| `python-backend/tests/test_citations_binding_a1.py` | Create | Dedup, numbering, `[n]` parse (valid + out-of-range), verbatim-marker bind, both-pool collection. |

---

## Success criteria (A1-01)

1. A turn reading a chunk + wiki page + Tier 0 record collects a **single deduped** `CitationRef[]` across both pools.
2. Answer `[n]` markers bind to the correct `CitationRef`; a verbatim quote binds via `[[Source:]]`.
3. Out-of-range/invalid `[n]` dropped, not rendered.
4. Ordinals + citations reload-safe (persisted on the assistant message) and survive deep-mode resume.
5. `done` + per-step refs are `CitationRef`-shaped; no `{kind,label,pageId}` remains; no parallel store.
6. `python -m compileall python-backend` exits 0; new tests green.

---

## Handoff

When binding is wired, both pools unify, the stream emits `CitationRef`, and tests are green, the strategy
thread logs an A1 completion-reconciliation amendment in `../../CONTEXT.md §8`, then opens **sub-phase A2
(resolvers)** — which begins by resolving **O1** (derived kinds: chip vs. trace-only) and **O2** (web dark
vs. descoped).

*Context written: 2026-07-06 — Ep7 citations planning thread, at A1 sub-phase entry (O3 resolved).*
