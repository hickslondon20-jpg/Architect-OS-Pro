# MA-03 Checkpoint 1 — Founder Response (paste to the build agent)

---

Directives reviewed and **approved** — this is strong work. Two findings especially: the `user_id`
two-hop bug (child assessment tables that silently returned zero rows on real accounts) and the
`_project_to_ose` silent-failure root cause (bad `page_type`/`category` + string-into-numeric
`confidence`, both swallowed by `except: pass`) are exactly what this pass exists to catch. And the
claim-level grounding is right: evidence must resolve to a source actually fetched this compile, and
an unsourced claim is dropped, not kept. Growth Constraints correctly treats `variance_pct` as the
good-vs-current delta and merges it with leverage + the selected-horizon GVS scenario; Diagnostic
Synthesis leads with the vertical AI outputs and treats agreement/divergence correctly. Proceed.

**Two tightenings before you wire all 7:**

1. **Ground the narrative, not just the claims (do this now, before the smoke).** The claims get the
   mechanical source-filter, but the `narrative` is currently taken from the model as-is — and the
   narrative is what lands in `ose_knowledge_pages.content`, i.e. what the CSO actually reads and
   reasons from. Add a hard rule to `_tier1_system_prompt`: **the narrative may only assert what its
   own emitted claims support — no statement in the narrative that isn't backed by a grounded claim.**
   This keeps the CSO-facing prose inside the same no-hallucination guarantee as the claims
   (architecture principle #4 + the Ep7 traceability contract).

2. **Make the mechanical fallback observable (can land with the all-7 wiring).** When a page falls
   back to templated claims because the LLM call failed, flag it (e.g. `synthesis_model =
   'mechanical_fallback'` or a status field) so a page can't silently look synthesized while actually
   being templated — otherwise a quiet regression is invisible in verification.

**Verify-later (note these for MA-02; not blockers now):**
- Confirm the new-user empty onboarding scaffold row still behaves correctly after the unique index
  was narrowed (it shared that index).
- Open Questions must compile **after** the other 6 and read their **current** (not stale) state,
  especially once auto-trigger fires it via `wiki_validation_changed` — confirm the ordering.
- `current_quarter_sprint` and `growth_constraints` share an `ose_page_type`; reads by `canonical_key`
  are unique so that's fine, but confirm nothing reads by `page_type` and picks the wrong page.

**Checkpoint 2 — green light.** Apply tightening #1 first so the smoke reflects the final prompt, then
run `python scripts/ma03_tier1_synthesis_smoke.py` on `diagnostic_synthesis` for the seeded test user
and paste the full console output back. I'll read the `wiki_pages`/`ose_knowledge_pages` rows and the
LangSmith trace against it — and specifically verify the narrative traces to grounded claims — before
we run all 7. Hold there; don't wire the remaining pages or the auto-trigger (Objective 4) until we've
looked at that first page together.
