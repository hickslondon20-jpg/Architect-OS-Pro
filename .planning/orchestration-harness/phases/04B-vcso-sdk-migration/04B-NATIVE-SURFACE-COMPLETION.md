# 04B — Native Surface Completion (Roadmap Step 2 close-out)

**Date:** 2026-07-30 · **Closes:** roadmap Step 2, *"Prove it once."*
**Status: CLOSED on mechanism evidence. The composition layer is openly unproven and two rubric lines are
downgraded in this document.**

**Read this before quoting anything from it.** Step 2 asked one question. It answered that question and
uncovered four defects in a different layer. A reader who takes "Step 2 closed" to mean "Virtual CSO
answers correctly" will be wrong, and §4 exists to make that impossible to do accidentally.

---

## 1. The question, and the answer

`04B-NATIVE-SURFACE-PLAN.md` §1 states it exactly:

> *"whether the lead delegates reliably when its direct calls are refused by a hook rather than hidden by
> a transport."*

**Answered: yes.** Proven across two independent live anchor runs plus a third armed session, on a
deployed production backend, with every claim below paired to a persisted row.

The external worker transport existed for exactly one reason — to keep worker tools invisible to the lead
so it could not direct-call them. **That reason is now gone.** The requirement was never "the lead cannot
see the tools"; it was "the lead cannot execute founder-data work outside an approved delegation," and the
in-process hook enforces the second directly.

---

## 2. What was proven

| Claim | Evidence |
|---|---|
| The lead delegates **unprompted** | Both anchor runs: `Task` → `structured_data_agent`, then `per_user_wiki`, both `allow` on first attempt |
| **Zero direct handler executions** | Both runs; no `native_handler_entry` in any lifecycle |
| **Zero hook refusals** | Both runs; `blocked_or_refused_count=0` |
| **The `stop_hook` never had to block** | Both runs. The required-worker scaffolding was **inert** — the lead chose delegation on its own. This is the closest thing to a rubric #1 reading this probe can honestly produce |
| Correct model tiers | Lead `claude-sonnet-4-6`, both workers `claude-haiku-4-5`, from the `model` column |
| Evidence trail persists | Child `agent_delegation_runs`, steps, source refs (46 and 52), per-child **token** attribution |
| `execute_code` runs in-process | Run 2, `exit_code=0`, pod `sandbox-python-1a408db1` |
| Dataset selection is genuinely model-driven | Run 2 listed both datasets and read the correct 20-row client-level one **twice**, untruncated, ignoring the stale single-row dataset |
| **Cross-worker isolation holds** | `granular_cross_worker_probe`: `structured_data_agent` → `wiki_search` **refused**, reason naming `per_user_wiki` as owner |
| **Founder isolation holds** | `founder_isolation_probe` foreign dataset **refused**, with the fixture proven by direct row query to belong to tenant `5aae2cc2…` |
| The tool is not simply refusing everything | Owned positive control returned rows, **147 source refs** |
| The refusal message carries no information | Random-UUID negative control returns the **identical** string — documented rather than hidden |
| Genuine allows through the same code path | **12 × `native_access_gate` `allow`** across both capabilities |

**On the isolation proofs specifically.** `04B-TARGET-ARCHITECTURE-AND-ROADMAP.md` §10 recorded that
moving founder isolation from a token check to a closure made the guarantee *"stronger in mechanism but
weaker in evidence,"* and required both negative tests before rubric line 7 could be re-marked. **Both ran
and were watched executing** (parent `8a51ce24-f417-4709-b060-2803a743422d`). Neither is inferred from
configuration. Both probes are deterministic server-side calls recorded **before** any model tool choice,
so neither can be satisfied by the model merely declining to misbehave.

---

## 3. What was NOT proven

**Derivation and composition quality. Both anchor runs failed on it, for different reasons, and the second
failure is the more informative.**

| Run | Parent | Result |
|---|---|---|
| Anchor Run 1 | `c2f7afc2-cba5-4338-bec3-e650c64afdf6` | **FAIL** — Mode B answer. The founder owned one dataset with one row, so a computed pass was structurally unreachable. §5B.6 |
| Anchor Run 2 | `585485e6-f402-49c4-9918-2c899bbc077d` | **FAIL** — on repaired data, with `execute_code` running. Four distinct derivation defects. §5B.10 |

The N=5 count was **retired as constructed** (§5B.11): its PASS criteria bundle the mechanism question
with composition quality, and composition quality is Phase G's scope by design. As written, N=5 could not
pass until Phase G shipped, which inverts the roadmap.

**Four defects, all traced to persisted evidence, none speculative:**

1. **The compute gate is hollow.** §4.7 requires *a prior successful retrieval* before `execute_code`;
   nothing requires the computation to **consume** it. Run 2's sandbox ran on hand-transcribed constants —
   `total_q2 = 117_000` where the retrieved rows sum to **130,000** — publishing 49.1% where the true
   top-two share is 44.2%. **The sandbox degrades into a calculator over model-typed numbers, which is the
   fabrication surface this architecture exists to remove.** Invisible until data existed worth computing
   over. → **Step 3.**
2. **The authority rule is not enforced at composition.** It is prose in tool descriptions (D11). Run 2's
   code comments invented a carve-out — *"wiki figure, authoritative for retainer-level data"* — then
   blended a Tier-3 retainer with a Tier-1 margin (`32_000 × 0.711`) into the answer's central risk claim.
   → **Phase G.**
3. **The record-versus-wiki discrepancy is never surfaced.** Run 2 stated "$145K MRR" and record-derived
   figures in adjacent sentences without noting they are incompatible. Authority rule #2 explicitly asks
   for this. → **Phase G.**
4. **Unverified Tier-3 figures asserted as fact** (e.g. "3.6 months of cash runway"). → **Phase G.**

**The composer-integrity gate did not arm on either run** (`decision=not_required`). It keys off *question*
phrasing; the anchor is phrased as advice. **Nobody may read these runs as evidence that the gate holds.**

---

## 4. Re-grade against `04B-VISION-AND-INTENT.md` §4

Two lines are **downgraded**. The earlier ✓ marks were awarded on runs where the composer happened to
behave; two controlled runs against real data show it does not.

| # | Intent | Was (2026-07-22) | Now | Basis |
|---|---|---|---|---|
| 1 | Reasons, doesn't rule-route | ✓ / ○ | **✓ strengthened** | Keyword eligibility removed entirely; delegation unprompted with the `stop_hook` never blocking. Still ○ across varied questions → Phase G |
| 2 | Plans visibly | ✓ | **◐** | Proven on the pre-granular surface; **not re-confirmed on the granular surface** — the render proof is still outstanding |
| 3 | Delegates to cheap bounded specialists | ✓ | **✓** | Tiers verified from the `model` column. Note per-child **cost** is null by design (§5B.5); the economics claim rests on tokens |
| 4 | Composes founder-grade, *cited* judgment | ✓ | **✗ DOWNGRADED** | Both runs asserted stale or wrongly-derived figures. Citations are present and abundant; the *judgment* they support is wrong |
| 5 | Honest about gaps | ✓ | **✗ DOWNGRADED** | Run 1 diagnosed the gap in its own words and answered anyway; Run 2 held contradictory figures and never surfaced the conflict |
| 6 | Feels native | ✓ | **◐** | Streaming and reload hold; narration bleed found in Run 2's persisted message (§5B.10) |
| 7 | Safe & bounded | ✓ | **✓ re-proven on the new boundary** | Both mandatory negative tests watched executing, with positive and negative controls |
| 8 | Generalizes across the question space | ○ | **○** | Unchanged. Phase G |
| 9 | Substrate serves Domain Agents | ◐ | **◐** | Mechanism proven and inheritable; composition is not, and Domain Agents would inherit that too |

**The honest summary: the engine works and the answer does not yet.** Lines 4 and 5 are the whole
migration's purpose, and they are now openly red rather than quietly assumed. That is the correct state to
enter Phase F and G with.

---

## 5. Cost, capacity, and evidence limits

- **Per-run spend is recoverable; per-agent spend is not.** `ai_usage_log.cost_usd` on the `vcso_sdk_loop`
  row **is** `ResultMessage.total_cost_usd` — the whole-query total including subagents. Child rows carry
  tokens with cost `None` **deliberately**, so subagent spend is not double-counted. **Never price worker
  tokens and add them to the parent figure.** (§5B.5)
- **The caps raise was load-bearing, not precautionary.** Run 2 cost **$0.2304** — 46% of the $0.50 cap and
  **over the retired $0.25**. It would have been budget-killed mid-flight.
- **Turn budget was never the constraint.** No run approached the 12-turn cap.
- **Acceptance criterion 5 overclaims and is restated here:** what holds is per-child **token and model**
  attribution. Per-child cost is null by design.
- **Dataset-grain provenance is invisible to the model** — neither structured tool selects
  `founder_datasets.provenance`, so a dataset citation cannot carry it. Narrow softness in the
  cited-provenance lock; bites in Phase F. (§5B.8)

---

## 6. Defects in the evidence apparatus itself

1. **`decision="LEAKED"` is recorded for the owned positive control**, because the helper labels any
   returned rows that way; only `probe_label="owned_positive_control"` disambiguates it. This is persisted
   evidence for a binding lock, and a future scan or reviewer searching for "LEAKED" gets a false positive
   — worse, learning to dismiss LEAKED rows is how a real one gets explained away. **Reserve `LEAKED` for a
   foreign or random id returning rows; record the positive control distinctly.** → **Step 3**, riding the
   deletion smoke rather than earning a dedicated run.
2. **`execute_code`'s `input_summary` and `output_summary` are empty `{}`.** The full code and stdout are
   persisted in `source_refs[].verbatim`, so the compute *is* auditable — but not where a reader looks
   first. Nearly reported as an evidence gap before checking.
3. **A near-false-green, caught only live.** The probes' first armed run failed with
   `_run_sdk_turn() got an unexpected keyword argument 'native_granular_cross_worker_probe'` — the outer
   generator and the function body were updated, the inner signature was not. **Unit tests passed and
   `compileall` was clean**, because the tests exercised the decision helpers directly and `compileall`
   cannot see a keyword mismatch. The gate required allow/deny coverage and never required proving the
   probes were *reachable from the turn path*. A signature-reachability test now exists. This is the fourth
   instance in this migration of code-verified passing while the live path was broken.

---

## 7. What Step 3 inherits

**Deletion is no longer gated on N=5** (§5B.11) — it is gated on the mechanism, which is proven. Step 3
carries, in this order:

1. **The compute-data binding fix** — `execute_code` must be bound to values actually retrieved in the
   turn, not merely preceded by a retrieval. This is a flaw in shipping code, not a deferred capability.
2. **The `LEAKED` relabel** (§6.1).
3. **The deletion:** `vcso_worker_mcp_server.py`, `vcso_worker_mcp.py`, `TURN_REGISTRY` and the token
   machinery, the `MCP_TOOL_TIMEOUT` dependency, the single-process constraint, the out-of-band completion
   bridge, **Path A**, and **`vcso_planner`**. Rename Path A's remnants at the same time — the cheapest
   possible moment.
4. **The CLI version pin** — an expected version asserted at startup and in CI, failing native activation
   closed on mismatch. The bundled CLI has already changed agent semantics under this project once,
   between a passing gate and a failure.
5. **The nested-surface render proof**, still outstanding, riding the deletion smoke.

**Keep:** semantic status normalisation, app-owned data flow, the diagnostics trail, degraded and partial
worker handling, the probe scripts, the turn harness.

*Gate:* dead-code removal against a proven path — **a smoke test, not a second five-run cycle.** Re-run the
zero-canary reload proof for the nested plan surface.

**Phase G inherits** defects 2, 3 and 4 from §3, alongside reflect-and-steer and the composer-integrity
classifier gap. **Phase F inherits** the dataset-grain provenance softness.

---

## 8. Evidence index

| Artifact | Id |
|---|---|
| Anchor Run 1 (FAIL — Mode B) | `c2f7afc2-cba5-4338-bec3-e650c64afdf6` |
| Anchor Run 2 (FAIL — derivation) | `585485e6-f402-49c4-9918-2c899bbc077d` |
| Probe wiring failure (TypeError, ~zero spend) | `bcc73bbc-324e-47e6-82c4-b8edfe4aa22b` |
| Isolation proof session | `8a51ce24-f417-4709-b060-2803a743422d` |
| Turn-harness proof (flat path) | `5e21ac8b-211f-436f-8413-603b46af934b` |
| Seeded anchor dataset | `a15d37c1-cd1b-4fef-88a5-0147bf43db14` (20 rows, 4 periods, 5 clients) |
| Foreign-tenant fixture | `6049ee97-72c8-43f0-8a4f-5222b257af49`, owner `5aae2cc2-624e-40ba-b14d-909b66be5f74` |
| Deployed heads under test | `68a14478` (anchor runs), `a1cf696d` (isolation proof) |
| Commit range | v0.6.145 → v0.6.160 |

**Flags dark throughout, verified by value rather than by timestamp** — `platform_ai_settings.updated_at`
is not maintained on write and must never be used to infer flag state (§5B.4). Nothing in this migration
has ever been live to a founder; production Virtual CSO still runs the pre-migration loop.
