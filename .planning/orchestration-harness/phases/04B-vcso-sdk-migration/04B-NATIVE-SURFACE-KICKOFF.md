# 04B Native Surface — Execution-Agent Thread Prompt (paste-ready)

> Paste the block below to start the execution-agent thread for Roadmap Steps 1–2. Self-contained; the
> agent does not need the orchestration conversation. **Arm nothing until London's explicit go.**

---

You are the **execution agent** for **04B Roadmap Steps 1–2 — the native worker surface.** The
orchestration work has been scoped with London; **you do the live code, verification, and commits.** This
migration has shipped **three false greens** caught only by live observation. Hold the discipline below.

**Read first, in order:**

1. `.planning/orchestration-harness/phases/04B-vcso-sdk-migration/04B-NATIVE-SURFACE-PLAN.md` — **your
   plan.** Deliverable, work items, gates, acceptance criteria, key files.
2. `.../04B-TARGET-ARCHITECTURE-AND-ROADMAP.md` — the Step 0 decision record (D1–D12), the tool inventory,
   the three-endings contract, and the knowledge-hierarchy authority rule. Your work must conform to it.
3. `.../04B-VISION-AND-INTENT.md` — grade your result against §4.
4. `.../04B-D2-FINDINGS.md` §§2, 9, 10, 11 — the mechanisms that produced the current external transport.
   **You are undoing their cause. Understand them before you change anything**, particularly §2 (why an
   in-process server cannot be hidden from the lead) and §9 (why subagent tool calls are silently denied
   without parent pre-approval).
5. `.../CONTEXT.md` — locks, data lifecycle, decisions execution agents must not override.

**What you are building, in one paragraph.** Today every worker call leaves the process — SDK lead →
`Task` → a shim subagent → an HTTP hop to a loopback MCP server → a token lookup → the Python handler.
That exists to hide worker tools from the lead. You are building the in-process alternative: worker
subagents holding **granular tools** registered on the in-process server, a small **Mode B** read surface
on the lead, delegation-first enforced by a **hook** instead of by transport invisibility, and a
**compute gate** so `execute_code` cannot run without prior retrieval. Then you prove — or disprove —
that the lead delegates reliably on that surface.

**The requirement you are enforcing is not "the lead cannot see the worker tools." It is "the lead cannot
execute founder-data work outside an approved delegation."** The first is unachievable in-process and
chasing it produced Defects 6 and 7, the `MCP_TOOL_TIMEOUT` landmine, and the single-process ceiling. The
second is enforceable by a hook that already exists in the codebase and is currently unused in the
model-driven path.

**Current state — re-confirm before touching anything:**

- **Cache-busted** `/api/health` returns `ok=true` and the deployed SHA matches `main`. A plain read can be
  served a stale CDN value; do not trust it uncached.
- `vcso_sdk_loop` + `vcso_planner` **dark**, allowlists empty, `native_model_driven_enabled=false`.
- **Path A retained dark — do not prune.**
- Nothing in this migration is live to any founder.

**First move — RECON before you build, and report to London before changing code:**

1. Re-confirm the state above.
2. Verify the schema the new tools will read: `founder_datasets` and `founder_dataset_rows` columns, and
   what `sub_agent_orchestrator._handle_structured_data` (`:588–660`) actually returns today. The new tools
   must reproduce that substance, not approximate it.
3. Confirm whether `kb_read` already covers the document-chunk read that `document_analysis` performs, or
   whether a separate tool is needed later. **Verify, do not assume** — this is a carried open item.
4. Report your reading of §4.5 of the plan (the permission surface) back to London in your own words before
   you write any config. Getting that wrong reproduces Defect 6, and it is the single most likely place to
   lose a day.

**Then build Step 1** per the plan: three structured-data tools, authority-tiered descriptions, the Mode B
lead surface, granular worker `AgentDefinition`s pointing at the in-process server, the generalized access
hook, and the compute gate. **The external transport stays in place and unwired — do not delete it.**
Deletion is Step 3 and is London's call after Step 2 reports.

**Step 1 gate:** `compileall` clean, frontend green, unit tests covering both the allow and deny paths of
the access hook and the compute gate. **No live spend in Step 1.** Then **STOP and report** before arming.

**Step 2 — prove it once.** A **local CLI experiment first**, under an ephemeral `CLAUDE_CONFIG_DIR` so
nothing rides a cache: does a `Task`-spawned subagent call an in-process SDK MCP tool cleanly under
`dontAsk` with parent pre-approval? That has never been observed cleanly. Report before spending a canary.

Then, on London's go: **N=5 consecutive passes on the pinned anchor** — delegation allowed first attempt,
required workers completed, a cited compute result present, correct tiers, citations intact, **zero direct
handler calls executed.** A hook-refused lead attempt is not a failure; count it and report the rate. A
Mode B answer to the anchor **is** a failure — the anchor requires computation and direct reads cannot
produce it.

**Two negative tests are mandatory** before the safety rubric line is re-marked proven: a worker subagent
cannot reach a sibling's tools, and a cross-founder read attempt is refused **at the tool layer**. Watch
both execute; do not infer them from configuration. Founder isolation is moving from an explicit token
check to an implicit code boundary — stronger in mechanism, weaker in evidence. These tests are how the
evidence gets rebuilt.

**If the probe fails** — the lead persistently direct-calls despite hook refusal, or the CLI breaks
subagent in-process calls unexpectedly — **that is a finding, not a failure.** Record it plainly,
re-darken, leave the transport authoritative, and stop. Do not iterate on the architecture without an
explicit founder go.

**Non-negotiable discipline:**

- **Observe, don't infer.** Pair every claim to a DB row, trace, or log line. Code-verified ≠ observed.
- **Cache-busted head confirmation + `/api/health ok=true` before every canary.**
- **Dark-canary hygiene:** arm founder-only on London's go — **not in anticipation** — re-darken
  immediately after, read both flags back off.
- **Preserve every lock:** founder isolation; one writer (feed the OS Engine, never write the wiki); cited
  provenance; cost-tier routing at the capability grain; no founder-facing model selector; curated
  transparency; bounded, non-recursive, depth-capped workers. **Do not disturb the composer-integrity
  gate** or the keyword eligibility gate — relaxing that gate is Phase G.
- **INFRA LANDMINES:** keep `MCP_TOOL_TIMEOUT=240000` (Railway env only) until Step 3 removes its cause.
  **Single-process only** while `TURN_REGISTRY` exists — no `WEB_CONCURRENCY`, no `--workers`. Do **not**
  re-add the per-agent `timeout` config key — the deployed CLI rejects it and it broke delegation outright.
- **Version tags always forward** — commit after each logical unit with a `vX.Y.Z` **PATCH**-bumped
  message. MINOR/MAJOR are London's call. Uncommitted work does not survive a session boundary.
- **Stop on the first failure.** Do not retry blind. Surface it with evidence and wait.
- **Do not** flip flag defaults, prune Path A, delete the transport, widen past the dark founder canary, or
  edit the harness-root `ROADMAP.md`.

**Close:** write `04B-NATIVE-SURFACE-COMPLETION.md` — the local CLI experiment result, the N=5 evidence with
row pointers, the hook-refusal rate, the anchor accounting change (§4.8 of the plan: what counts as a pass
has changed shape, so do not claim a byte-identical comparison to the D2 baseline), both negative-test
observations, and a re-grade against `04B-VISION-AND-INTENT.md` §4. Confirm flags dark (read back off),
Path A intact, transport present and unreachable. Then **STOP-and-review with London.** Step 3 is London's
decision, not yours.
