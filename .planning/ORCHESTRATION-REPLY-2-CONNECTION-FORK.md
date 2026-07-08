# Reply to Orchestration Agent — Round 2 (connection fork resolved → roadmap)

*(Paste to the orchestration thread in response to its connection-phase framing.)*

---

Excellent work — verifying the actual code and live DB instead of trusting the tracker is
exactly right, and it changed the calculus. Your reframe is the key finding: the connection
phase is mostly a **verification + small Domain-Agents-wiring** gap for the surfaces, and the
real risk is the **ingestion→compile pipeline liveness** (zero wiki pages today, OpenAI-gated) —
which is true regardless of A/B/C.

## The fork decision

**C is the MVP target — but we build A-first and decide C's final timing with evidence.**

The routed cross-tier reasoning is the differentiator; I want beta to feel like a strategic OS,
not a RAG bot, so C is the ambition. And your own finding makes C cheaper than it sounded: since
A is mostly verification plus one small build, the *marginal* cost of C over A is just the router
pre-step, while the big shared risk (the pipeline) is paid either way.

But A-vs-C isn't an either/or in *time* — C sits on top of A and the pipeline. So:

- **Commit to C as the MVP target.**
- **Build in an order that yields a usable, wiki-live beta at the A milestone.**
- **Make the final "router in the first beta vs. fast-follow" call once the pipeline + A are
  live** and we can judge how good the un-routed cross-tier answers actually are. The router
  goes last, on a proven foundation — decided with evidence, not in theory.

That honors the timeline caution you raised without giving up the ambition.

## The plain-English path (the shape to build the roadmap around)

1. **Prove the brain turns on.** Make the ingestion→compile→`_project_to_ose` pipeline run
   end-to-end with real credentials so wiki pages actually exist (0 today). Biggest unknown in
   the layer; lives inside the testing pass; gated on the OpenAI billing item already queued.
2. **Confirm the CSO uses the wiki.** Mostly verification — the wiki tools are already offered
   in a normal VCSO turn. Upload → page created → ask → CSO retrieves + cites the wiki page.
3. **Teach the domain agents to consult the wiki.** Small change — add the wiki-read tools to
   the P&L workflow's context/prereq step so agents ground in the founder's synthesized business
   before producing.
4. **Add the smart routing (the C piece) last,** on the proven foundation — the lightweight
   tier-selection pre-step that makes cross-tier questions feel routed rather than stumbled-
   through.

## The caveats fold in

- **`experimental` capability status** — check that `list_active()` surfaces them to the gated
  path; rides along in step 2.
- **Tool-name collision / native Tier-1 claim tools** (`wiki_get_claim`, `wiki_search_insight`,
  `wiki_read_digest` not in the unified registry) — **defer to v1.** Page-level wiki read +
  citations via the `ose_knowledge_pages` mirror is the MVP read path.

## Your next deliverable — the roadmap (still not orchestration)

With the vocabulary locked and the connection fork resolved, produce your first real artifact:
the **plain-English "State → Roadmap to MVP"** on one page —

- the MVP-required vs. post-MVP/v1 **triage** (now stable, given the fork is settled);
- the **sequenced path**, folding in: the connection-phase 4-step order above, the pipeline
  liveness as gate 1 *inside the testing pass*, the quick wins (MRA repoint + resolver guard +
  CLAUDE.md Rule #3 update), OpenAI billing as the testing-pass prerequisite, and the deferred
  items (router-in-MVP-vs-fast-follow flagged as an evidence-based decision point);
- kept in plain English and sequenced so we can see the whole path to MVP at a glance.

This is the last alignment artifact before we scope the first managing agent — so once we've
reacted to the roadmap together, we'll start with the MRA quick win and the consolidated
testing / verification-debt pass (which carries the pipeline-liveness gate).

Still aligning — no agents or execution yet. Bring back the roadmap.
