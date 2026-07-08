# State of the Intelligence Layer → Roadmap to MVP

> Authored 2026-07-06 by the orchestration agent, with the founder. Plain-English alignment
> artifact — the whole path to MVP at a glance. Not an execution plan; the last alignment
> doc before we scope the first managing agent.
> Companion to `INTELLIGENCE-LAYER-ARCHITECTURE.md` + `INTELLIGENCE-LAYER-EPISODE-MAP.md`
> (honors locks L1–L26). Ground-truth status lives in `Pro-Suite-Progress.md`.

---

## Readiness vocabulary (locked)

Every status statement uses one rung of this ladder. A green Episode row in the tracker means
**backend-complete only** — never "usable."

**backend-complete → live-verified → usable (front-end wired) → polished**

---

## Where we are

The whole of Ep1–7 is **backend-complete**. Almost none of it is **live-verified** end-to-end
(the L18 verification debt pooled into one untested pass — first time real credentials get
wired), and the front-end is still largely mock data / mock design, so nothing is yet
**usable**. Verified this session against code + live DB, not the tracker:

- **Gate 1 PASSED (2026-07-08) — the brain turns on.** MA-01 ran one real document end-to-end
  with zero mocks: upload → ingestion → chunks → embeddings → `document_chunks` → **document-wiki
  synthesis wrote 2 pages to `ose_knowledge_pages`** → hybrid/RRF retrieval, all LangSmith-traced.
  **Architecture correction:** `ose_knowledge_pages` has **two writers** — (a) document-sourced
  pages written *directly* by `DocWikiSynthesisService._upsert_page` (**now live-verified**), and
  (b) the fixed Tier-1 scaffold pages (`business_context`, `diagnostic_synthesis`, etc.) written
  via `WikiCompilationService.compile_page → _project_to_ose` (`page_kind='wiki_layer1'`). There
  is **no compile step for document pages** — the old "ingestion→compile→project" framing
  conflated the two paths. The Tier-1 scaffold path is **still unproven live** and is an Ep2
  objective. (`DL-L1-EMBED` — embeddings for projected Layer-1 pages — was deferred, so those
  pages may not be semantically searchable until wired.)
- **VCSO already retrieves the wiki in a normal turn** — the wiki read tools are offered
  by surface tag and outputs are citation-shaped. This is verification, not new build.
- **Domain Agents do not consult the wiki yet** — their tool access is capability-gated and
  no workflow step lists the wiki tools. Small build.
- **There is no cross-tier retrieval router.** Cross-tier answers today are whatever the model
  stumbles into via in-loop tool calls, not a routed Tier 0→1→2→3 escalation.
- **MRA citations are broken:** the resolver names `mra_checkpoints`, which does not exist
  live; the real substrate is `gm_checkpoints`. Contained bug.

**Connection-phase decision:** the routed cross-tier experience (C) is the MVP target — beta
should feel like a strategic OS, not a RAG bot. We build **A-first** (verify the surfaces use
the wiki), and make the **router's final timing (first beta vs. fast-follow) an evidence-based
call** once the pipeline + A are live and we can judge how good the un-routed answers are. The
router is built last, on a proven foundation.

---

## Triage — MVP-required vs. post-MVP/v1 (stable)

**MVP-required**
- MRA repoint + resolver-integrity guard + CLAUDE.md Rule #3 fix (contained live-correctness bug).
- OpenAI billing/quota cleared — **prerequisite** for the testing pass (embeddings + Ep7 verifier).
- Consolidated testing / verification-debt pass: Ep5/6/7 live smokes, sandbox egress policy,
  flip the VCSO Python-stream flag, end-to-end citations.
- **Pipeline liveness — the brain turns on:** ✅ **DONE (Gate 1, 2026-07-08)** for the document
  path. Remaining: the Tier-1 scaffold compile→project path (Ep2) + `DL-L1-EMBED`.
- Connection A: verify VCSO retrieves + cites the wiki; wire Domain Agents to consult it.
- §8 front-end real-wiring + UI polish — the "usable" rung; mock → real across every surface.
- Connection C router — target for MVP, built last; in-beta-vs-fast-follow decided with evidence.

**Post-MVP / v1**
- Native Tier-1 claim tools (`wiki_get_claim`, `wiki_search_insight`, `wiki_read_digest`) +
  resolving the `wiki_*` tool-name collision. MVP read path is page-level via the mirror.
- Metering ledger, account-level usage %, tier economics / pricing, admin panel.
- Real MCP connections (beta ships scaffold + "coming soon" only — L7).
- Dark-by-design, dependency-gated: `web` citations; `reflection_reviews` citations +
  `sprint_evolution` page; `sprint_retrospective` page.
- **Reflection Review core rollover (V-11)** — core-platform gap gating two dark items above;
  surface to the core-platform owner. Blocks nothing in the intelligence layer now.
- Ep1 return-pass queue: normalization taxonomy, period policy, capability governance,
  sub-agent trace UX, Cohere rerank, isolated-user boundary.
- Full PDF pixel-highlight geometry (Ep7B) — needs Docling installed + a real live PDF.

---

## The sequenced path to MVP

**1. Fix — MRA quick win.** Repoint `platform_record_resolver.py` to `gm_checkpoints`/
`gm_checkpoint_*`; add the guard asserting every `platform_record` source-kind resolves to a
real live table; update CLAUDE.md Rule #3 to name the real substrate. Rides the front of the
testing pass.

**2. Test — consolidated verification-debt pass, run episode-by-episode.** Walk Ep1→2→4→5→6→7
in dependency order, checking each earmarked enablement against its own episode docs + plan
files, traced live via LangSmith. Score every check on two rungs — *backend-live-verified* vs.
*usable* — and log front-end gaps as §8 items, not episode failures. Fix-in-place contained
wiring bugs; discover-and-report anything structural. (Full scope: `managing-agents/MA-01`.)
  - *Prerequisite:* OpenAI billing **cleared (2026-07-06)**; LangSmith **added** as the trace spine.
  - *Gate 1 — prove the brain turns on (highest discovery risk):* ingestion→compile→project
    runs with real credentials; wiki pages exist for the first time. This has never run live —
    treat it as **discovery, not verification.** Scope the pass with room to **fix what Gate 1
    uncovers**, not just confirm it. Everything downstream depends on it.
  - Ep5/6/7 live smokes: sandbox egress NetworkPolicy, Anthropic/GKE/sandbox, flip the VCSO
    Python-stream flag (Vercel stays rollback), end-to-end citations across surfaces.
  - *Connection A, step 2 — confirm the CSO uses the wiki:* upload → page created → ask →
    CSO retrieves + cites. Mostly verification. (Also checks the `experimental` capability
    status surfaces to the gated path.)
  - *Connection A, step 3 — teach the agents to consult the wiki:* add wiki-read tools to the
    P&L workflow's context/prereq step. Small build.
  - **→ Evidence point:** with the pipeline + A live, judge how good the un-routed cross-tier
    answers actually are → decide **router in first beta vs. fast-follow.**

**3. Polish — narrow legibility/usability cleanup of the already-wired surfaces only**
(citation chips/sidecar, Domain Agents, Deep Mode — the Ep6/Ep7 surfaces that exercise real
backend reads). Just enough to test, demo, and iterate. **This is not a design treatment** —
you can only polish what's wired to real data, and drifting into design overlaps §8 and gets
redone. §8 owns real-wiring the still-mock surfaces + the full design pass. Before the design
audit, per the steer.

**4. §8 — front-end audit + real-wiring pass.** Replace mock data/design with real wiring to
every Ep1–7 backend capability; honor the design system. This is the rung that makes the
platform **usable**. No backend capability ships stranded.

**5. Router (C) — the smart routing, built in parallel with §8 when in-MVP.** The lightweight
tier-selection pre-step that makes cross-tier questions feel routed rather than stumbled
through. Its real foundation is **A + the pipeline being live** (lands in step 2), not §8 —
the router is backend, §8 is front-end, so they're independent workstreams. If the step-2
evidence point puts the router in MVP, **run it alongside §8**, not after. They stay additive
because the CSO answer/citation/trace contract is locked (L11, L22). *One coordination point:*
keep that contract stable so the router's backend changes and §8's front-end work don't step
on each other (e.g. a "tiers consulted" trace element is a small, coordinated additive display
item — not a blocker). Serial is acceptable if we later prefer single-workstream focus; there
is no technical reason to force the router *after* §8. In-beta-vs-fast-follow stays the step-2
call.

**6. Consolidated cross-episode smoke → flip usability / go-live** (§8 sequencing gate).

---

## First managing-agent workstream (on the founder's go — not yet)

Lead-off: the **MRA quick win**, then the **consolidated testing / verification-debt pass**
(which carries Gate 1, pipeline liveness). Nothing is scoped or spun up until we've reacted to
this roadmap together.
