# Citations (Episode 7) — Sub-phase A1 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`. This session runs sub-phase **A1 only** (turn collection +
> answer-span binding). Do **not** start A2.

---

You are the **execution agent** for Sub-phase A1 (Turn Collection + Answer-Span Binding) of the ArchitectOS
Episode 7 (Citations & Source Grounding) build. You build against **decided design** — implementation choices
only, never design choices. **O3 (the binding scheme) is already resolved** — do not re-open it. If something
needs a design decision beyond the inputs, **stop and flag it**.

You are in the `ArchitectOS Pro_beta` repo, canonical path `C:\Users\Hicks\ArchitectOS Pro_beta`. All paths
below are relative to that root.

**What A1 is, in one line:** make the A0 currency flow through a real Virtual CSO turn — collect the turn's
sources from **both** live pools into one deduped `CitationRef[]`, number them, bind `[n]` markers in the
streamed answer, replace the divergent `{kind,label,pageId}` stream refs with unified `CitationRef` events,
and persist the citations on the assistant message. **No parallel citations store** (L22). Do not build
resolvers, UI polish, verification, or geometry.

---

## Orient first — read these in order, then build

1. `.planning/citations/phases/a1-turn-collection-binding/RESEARCH.md` — **primary build source.** The live
   VCSO loop: two source pools (§1), the tool-less final-answer pass where you inject the numbered list +
   cite-`[n]` instruction (§2), stream events (§3), persistence/reload (§4), deep-mode resume (§5), the A0
   adapters to use (§6), the decided binding scheme (§7). **Re-verify every `vcso_chat_service.py` line anchor
   before editing — they drift.**
2. `.planning/citations/phases/a1-turn-collection-binding/A1-01-PLAN.md` — task + decided O3 scheme + criteria.
3. `.planning/citations/phases/a1-turn-collection-binding/CONTEXT.md` — scope, decided decisions, file list, criteria.
4. `.planning/citations/CONTEXT.md` — locked ledger (**wins on conflict**): §3.1 DP2, §4 O3 (resolved), §5 F4,
   §8 amendments (A0 completion + the O3 / two-source-pool entry).
5. `python-backend/services/citations/models.py` + `normalize.py` — the A0 `CitationRef` + adapters you consume.
6. `python-backend/services/vcso_chat_service.py` — the loop you modify.

Read 1–4 fully before writing a line.

---

## The decided binding scheme (O3 — do not re-open)

- **Per-message deterministic ordinal `[n]`** over the turn's **deduped** `CitationRef[]`.
- **Dedup / identity key `(source_kind_family, source_id)`**, content-hash of `verbatim`/`source_label`
  fallback when `source_id` is null.
- **Verbatim escape hatch:** the Tier 2 `[[Source:]]` marker binds a quote to an offset via
  `parse_inline_source_marker`, coexisting with `[n]`.
- **Invalid / out-of-range `[n]` are dropped** on parse (strip-invalid).
- **Cross-turn thread-stable numbering is deferred** — do not build it.

---

## What you build

### 1 — `python-backend/services/citations/binding.py` (new)
- Dedup the turn `CitationRef[]` by the O3 key; assign stable 1-based ordinals.
- `[n]` parser over answer text → bind index→`CitationRef`; drop out-of-range/invalid indices.
- Lift `[[Source:]]` verbatim markers via `parse_inline_source_marker` and bind to the quoted span.
- Keep pure where possible (parsing/numbering take data in, return data out).

### 2 — `python-backend/services/vcso_chat_service.py` (modify)
- **Collect both pools → one `CitationRef[]`:** normalize Pool 1 (`_build_context` refs, `from_vcso_stream_ref`)
  and Pool 2 (`all_sources`, `from_tool_source_ref` / `from_agent_source_ref` / `from_provenance_ref`); dedup + number.
- **Feed the final-answer pass (RESEARCH §2):** add a **numbered source list** + a **cite-with-`[n]`**
  instruction to the final-answer prompt (`VCSO_TOOL_LOOP_SYSTEM_PROMPT` and/or the "Now write the final
  answer" message). Grounding is source-ref-first (DP2) — no in-context reference-style markers.
- **Parse + bind** `[n]` from `stream.text_stream` as the answer streams; settle the authoritative set at end.
- **Emit unified events (F4):** change the `sourceRefs` on `step`/`tool_result` events and `sources` on the
  `done` event to `CitationRef` shape; keep the event names + streaming lifecycle (appear → upgrade → settle).
- **Persist** the turn `CitationRef[]` on the assistant message (see 3).
- **Preserve deep-resume (RESEARCH §5):** citation/collection state must ride the `_persist_deep_resume` /
  restore path so a resumed `ask_user` turn keeps its numbering.

### 3 — messages persistence (migration, confirm-first)
- Confirm the assistant-message table schema. If there is no `citations`/`source_refs` column, add a
  `citations jsonb` column (additive migration) as the reload-safe home for the turn `CitationRef[]`.

### 4 — `python-backend/tests/test_citations_binding_a1.py` (new)
- Both-pool collection + dedup; ordinal numbering; `[n]` parse (valid + out-of-range dropped); verbatim-marker
  bind; reload shape.

---

## Hard constraints

- **Do not re-open O3.** The binding scheme is decided above.
- **A1 binds index→ref; it does not fetch/resolve source content** (that is A2).
- **No producer rewrites** — use the A0 adapters. No new tools.
- **No client-side UI work** beyond emitting the `CitationRef` events — the chip/sidecar + `[n]` render is A3/§8.
- **No parallel citations store** — persist on the assistant message only (L22).
- **Additive migration only** if you add the `citations` column; do not alter existing message columns.
- **Preserve deep-mode resume** — do not break the `ask_user` pause/resume path.
- **CONTEXT wins** on conflict. If underspecified, stop and flag.

---

## Done when (A1 success criteria — CONTEXT §"Success criteria")

1. A turn reading a chunk + wiki page + Tier 0 record collects a **single deduped** `CitationRef[]` across both pools.
2. Answer `[n]` markers bind to the correct `CitationRef`; a verbatim quote binds via `[[Source:]]`.
3. Out-of-range/invalid `[n]` dropped, not rendered.
4. Ordinals + citations reload-safe (persisted on the assistant message) and survive deep-mode resume.
5. `done` + per-step refs are `CitationRef`-shaped; no `{kind,label,pageId}` remains; no parallel store.
6. `python -m compileall python-backend` exits 0; new tests green.

**Report back:**
- One paragraph on what was built.
- The final-answer prompt change (how the numbered list + cite-`[n]` instruction is phrased) and the `[n]`
  parser behavior (incl. invalid-index handling).
- Where the turn `CitationRef[]` persists (column/table) and how deep-resume preserves it.
- Any implementation choice that deviates from or extends the design (for CONTEXT §8 reconciliation).
- Any flag needing London (e.g. if per-message numbering feels wrong once wired) or a judgment call.

Then stop. Sub-phase A2 is opened from the strategy thread (it begins by resolving O1 + O2).
