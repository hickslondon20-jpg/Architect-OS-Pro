# MA-03 Checkpoint 1 — Founder Response (historical record)

> The directive sign-off + tightenings given at MA-03 checkpoint 1. Recreated 2026-07-08. Both tightenings
> were implemented (tightening #1 was enforced mechanically, not just by prompt).

---

Directives reviewed and **approved** — strong work. Two findings especially: the `user_id` two-hop bug
(child assessment tables that silently returned zero rows on real accounts) and the `_project_to_ose`
silent-failure root cause (bad `page_type`/`category` + string-into-numeric `confidence`, both swallowed by
`except: pass`) are exactly what this pass exists to catch. Claim-level grounding is right: evidence must
resolve to a source actually fetched this compile, and an unsourced claim is dropped, not kept. Growth
Constraints correctly treats `variance_pct` as the good-vs-current delta merged with leverage + the
selected-horizon GVS scenario; Diagnostic Synthesis leads with the vertical AI outputs and treats
agreement/divergence correctly. Proceed.

**Two tightenings before wiring all 7:**
1. **Ground the narrative, not just the claims (do now, before the smoke).** The narrative lands in
   `ose_knowledge_pages.content` (what the CSO reads), but is taken from the model as-is. Add a hard rule to
   `_tier1_system_prompt`: **the narrative may only assert what its own emitted claims support — no
   statement not backed by a grounded claim.** (Architecture principle #4 + Ep7 traceability.)
2. **Make the mechanical fallback observable (can land with the all-7 wiring).** When a page falls back to
   templated claims, flag it (`synthesis_model = 'mechanical_fallback'`) so a page can't silently look
   synthesized while templated.

**Verify-later (for MA-02; not blockers):** the narrowed unique index vs. the onboarding scaffold row;
`open_questions` compiles after the other 6 and reads current state; `current_quarter_sprint` /
`growth_constraints` share an `ose_page_type` — confirm reads by `page_type` don't pick the wrong page.

**Checkpoint 2 — green light.** Apply tightening #1 first so the smoke reflects the final prompt, then run
`python scripts/ma03_tier1_synthesis_smoke.py` on `diagnostic_synthesis` for the test user and paste the
console output. Verify the narrative traces to grounded claims before running all 7. Don't wire the
remaining pages or the auto-trigger until we've looked at the first page together.
