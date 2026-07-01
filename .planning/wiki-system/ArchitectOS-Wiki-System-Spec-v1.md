# ArchitectOS Wiki System Specification — v1

**Status:** Consolidated from the strategy/pressure-test session of 2026-06-29. This is the handoff artifact for the strategy thread that owns the Phase 8 build plan. It is precise enough to produce plan files without re-asking the decisions below.

**Scope note:** Section 3 (Maintenance Model) is intentionally extensible. The founder will provide additional material on per-user wiki maintenance and dreaming that expands it. Everything else is settled for beta unless listed in Section 6 (Open Decisions).

---

## 0. Decision Log (Locked)

| # | Decision | Choice |
|---|---|---|
| D1 | Global vs per-user wiki | Two physically separate stores, separate lifecycles. They share only a retrieval *interface*. |
| D2 | Dreaming in beta | Post-beta feature. Scaffolding may be laid in beta and used internally without being launched as a named feature. |
| D3 | Flags (confidence/contradiction) | Retrieval plumbing first; founder-facing trust surface is a later roadmap item. Not founder-visible in beta. |
| D4 | Per-user page editability | Founder-editable. Global IP is team-managed and founder-invisible. |
| D5 | Page content model | Three classes per page: **compiled base / insight layer / override layer.** |
| D6 | Orchestration units | **Tools** on the existing sub-agent orchestrator (structured query, per-user wiki retrieval, global IP retrieval). **KB Explorer is the one true agent** for deep document work. |
| D7 | Classifier role | Plans the tool set for a synthesis question. Not a trivial-question bypass. |
| D8 | Latency | Parked — solved at the UX layer via the visual reasoning layer + scratchpad. Design for synthesis quality, not instant response. |
| D9 | Insight influence before promotion | **Reasoning-only** (1c): may shape the agent's line of inquiry, never asserted as a finding until promoted. |
| D10 | Insight promotion | **Founder confirmation** (2a) for beta; **corroboration by next compiled rebuild** (2b) as a post-beta enhancement. Machine-side gates (score + recall frequency + query diversity) surface candidates — see §7.2 B3. |
| D11 | Write-back qualification | Insight must be (i) about the founder's business, (ii) novel, (iii) above a confidence bar. Domain agents *propose* into quarantine; never silent commit. |
| D12 | Global IP injection | **Prime thin, retrieve deep** (4c): always-on stage primer + full IP available as a retrieval tool. |
| D13 | Page set | Fixed, platform-defined set for beta (~6–7 pages). |
| D14 | Per-user retrieval method | Deterministic page-key lookup for fixed pages; semantic search over the insight layer. |
| D15 | Compilation location | Compiled-base + event-triggered rebuilds = N8N. Write-back proposals = in-session. Dreaming = N8N scheduled. |
| D16 | Rebuild timing | Eager rebuild on event. |
| D17 | Provenance granularity | **Claim-level.** Knowledge is modeled as structured *claims* (`id, text, status, confidence, evidence[]`), each resolved to weighted, line-level evidence — see §7.2 B1. (Upgraded from "block-level" after OpenClaw review.) |

---

## 1. Two-Layer Architecture Decision

### Chosen model
Two architecturally separate layers that do **not** co-mingle and have different lifecycles. They are reached through a common retrieval interface (tools on the orchestrator), but share no storage, no synthesis pipeline, and no trust model.

**Global layer — ArchitectOS IP (team-owned, founder-invisible).** Two sub-parts:

1. **Structured stage-calibrated definitions — already built.** A Supabase table of ~500 entries (125 capability checkpoints × 5 AE Ladder stages) describing "what good looks like" for each capability area across every major domain (financial stewardship, team, clients, etc.). Deterministic, queryable, tool-accessed. *Verify and index — do not recreate.*
2. **Authored narrative IP pages.** Team-authored, versioned reference content — frameworks, MRA dimension explanations, growth benchmarks by tier and agency type, stage-specific strategic guidance, case patterns. Never synthesized from user data. Never touched by dreaming. Founders never see it; it grounds the agent in ArchitectOS's consulting thinking in the background.

**Per-user layer — compiled business model (founder-owned, founder-visible, editable).** Synthesized from the founder's own Tier 0 data and uploaded documents. Changes as their situation changes. This is the layer that compiles, accretes, and is maintained.

### Why separate stores (not one table + `scope` flag)
The two layers behave almost nothing alike: global is authored/versioned and immutable to users; per-user is compiled/accreted and editable. They only share a retrieval interface. A `scope` flag would force two incompatible lifecycles into one table. **Separate tables, unified retrieval view.** The global indexing requirement (below) reinforces this.

### Relationship at retrieval time
A founder question enters the Virtual CSO streaming endpoint. The flow:

1. **Cheap classifier** infers intent and *plans the tool set* for the question (D7).
2. **Parallel fan-out** of retrieval tools on the existing sub-agent orchestrator:
   - `structured_data` tool — Tier 0 founder tables **and** the global checkpoint table.
   - `per_user_wiki` tool — deterministic page-key lookup for fixed pages; semantic search over the insight layer.
   - `global_ip` tool — retrieval over authored IP pages, indexed by domain/stage/tier/topic.
   - `KB Explorer` (true agent) — deep document grounding when precision matters.
3. **Cross-tier assembly in parallel** into one context bundle.
4. **Single streaming synthesis call** to Claude Sonnet.

The classifier does not shortcut to one-liners — a deep question routinely needs the structured tool to fetch a score *and* the global checkpoint rows for "what good looks like at this stage" mid-reasoning. Build on the **existing** sub-agent orchestrator; do not stand up a parallel system (see Section 6 verify item).

---

## 2. Wiki Page Design

### Three content classes per page (per-user layer)
Every per-user page is the read-time composition of three physically distinct content classes, with a fixed precedence:

1. **Compiled base** — regenerated deterministically from sources. Never edited by human or agent. Always safe to discard and rebuild. Carries **block-level provenance** (each block references the source records/documents that produced it).
2. **Insight layer** — append-only, agent-authored (write-back now; dreaming later). Quarantined trust. Survives rebuilds because it was never part of the base.
3. **Override layer** — founder edits/corrections. Highest trust. Survives rebuilds and can suppress a compiled-base claim the founder marks wrong.

**Precedence at read time:** founder override > compiled fact > agent insight.

This is what makes "editable *and* rebuildable" coherent — neither founder edits nor agent insights are destroyed by a deterministic rebuild of the base.

### Per-user fixed beta page set (~6–7)
1. **Business Context**
2. **Diagnostic Synthesis**
3. **Current Quarter / Sprint** (snapshot)
4. **Growth Constraints**
5. **Financial Context**
6. **Client / Market Position**
7. **Open Questions & Unresolved Tensions**

(The longer list in the original vision doc folds into these or arrives post-beta. A bounded, platform-defined taxonomy is the deliberate advantage of ArchitectOS's constrained question space.)

**Compiled-base-only pages** (regenerated from Tier 0, no accretion): Current Quarter/Sprint, Diagnostic Synthesis.
**Insight-accreting pages** (carry the insight layer): Growth Constraints, Open Questions, and the other interpretive pages.

### Snapshot pages are projections, not sources of truth
The Current Quarter/Sprint and Diagnostic Synthesis snapshots exist so the orchestrator can cheaply judge *relevance* — "is this founder's financial picture germane to the question?" — not to supply the authoritative number. When precision matters, the `structured_data` tool queries Tier 0 live. The CSO must never quote a figure straight off a snapshot page; that would recreate the silent-ground-truth failure mode. A snapshot may be slightly stale and that is acceptable, provided nothing treats it as the number.

### Global layer page design
- **Structured checkpoint table** (exists): rows keyed by capability × AE Ladder stage. Tool-accessed deterministically.
- **Authored IP pages:** tagged by **domain, ladder stage, revenue tier, topic** so the stage primer can pull the stage-relevant slice and retrieval can target depth. Versioned and maintained by the ArchitectOS team.

---

## 3. Maintenance Model  *(extensible — founder to expand with dreaming material)*

### Event-triggered synthesis (N8N, eager rebuild)
Compiled-base pages are rebuilt by N8N workflows when their source data changes:

| Event | Rebuilds |
|---|---|
| MRA / diagnostic run | Diagnostic Synthesis + Current-state snapshot |
| Sprint reset / new quarter | Current Quarter / Sprint |
| Document upload | Relevant page(s) + Tier 2 vector index |
| Clarity Compass change | Business Context |
| Financial data/document change | Financial Context |
| Client/market data change | Client / Market Position |

Rebuilds are **eager** (run on event). Latency is non-issue because these are background jobs. The insight and override layers are untouched by rebuilds.

### Dreaming (post-beta; scaffolding optional in beta)
**Primary role reframed: consolidation, not invention.** Dreaming's first and safest job is to *tend the insight layer*, not generate net-new claims:
- Deduplicate overlapping insights.
- Reconcile insight-layer content against the latest compiled base.
- Flag contradictions.
- Retire stale candidates.
- Surface gaps as **open questions**, not answers.

**Guard rails:** dreaming operates only on the insight layer and the Open Questions page. It **cannot** write the compiled base and **cannot** auto-promote any insight to trusted state. Runs as an N8N scheduled workflow.

This framing is why the scaffolding is worth laying quietly in beta: the insight layer *will* bloat as write-back runs, and something must keep it coherent. Cost/benefit of building the scaffolding now vs. later is a build-planning call (Section 6).

> **Pending input:** the founder will supply additional material on per-user wiki maintenance and the dreaming cycle. This section is to be extended with that material before build planning closes.

---

## 4. Domain Agent Write-Back

### Mechanism
A domain agent that surfaces a notable, business-specific insight **proposes** a write-back. The proposal lands as a **quarantined insight record** in the insight layer. A domain agent never silently commits to the wiki.

### Qualification gates (all three required)
1. The insight is **about the founder's business** — not a restatement of generic framework.
2. The insight is **novel** — not already covered by an existing page or insight.
3. The insight is **above a confidence bar** (threshold value — Section 6).

### Trust lifecycle
- **Quarantined → reasoning-only (D9).** A quarantined insight may shape the agent's line of inquiry — what it probes, what it pulls next — but may **never be asserted as a finding** by the CSO.
- **Promotion to trusted (D10):** beta = **founder confirmation** via a light review surface ("your CSO noticed X across your last three sprints — does that ring true?"). A yes promotes it. Post-beta = **corroboration**: if the next deterministic compiled-base rebuild independently supports the insight, auto-promote.

### Two-gate hallucination defense
Even a hallucinated insight (a) cannot be asserted as a claim (reasoning-only) and (b) cannot enter trusted state without founder sign-off. Both gates must be passed.

### Interaction with dreaming
Dreaming consolidates and dedups the insight layer and **surfaces promotion candidates** for founder review; it does not promote autonomously. The founder-confirmation surface is also the natural home for the future "refine the wiki from flags" capability.

---

## 5. Context Injection for Domain Agents

### Model: prime thin, retrieve deep (4c)
- **Always-on stage primer:** at session start, preload only the *stage-relevant slice* — the founder's AE Ladder stage plus the handful of stage/domain checkpoint rows (from the ~500-entry table) that define "good" for the relevant domain. Small, predictable, prevents stage-inappropriate advice.
- **Full IP on demand:** the complete global IP (authored pages + remaining checkpoint rows) is a retrieval tool the orchestrator calls only when reasoning needs depth. No whole-IP context bloat.

### Principles
- **Framework is the lens; founder data is the subject.** When the global framework ("best practice at Stage 3 is X") conflicts with the founder's observed data ("their data says Y"), the agent **names the tension** — it never silently overrides observed reality with the playbook. This routes naturally into the Open Questions & Unresolved Tensions page.
- **Assembly budget:** user-specific context is primary and gets priority budget; the global slice is the smaller grounding layer.
- **Global IP is indexed, not loose.** Tagging by domain/stage/tier/topic (and the existing structured checkpoint table's stage × capability keys) is what makes "prime the stage-relevant slice" possible. This indexing requirement is part of why the global layer is its own store.

---

## 6. Open Decisions

Items that still need founder input, a product judgment call, or verify-before-build confirmation:

**Verify-before-build (not design questions):**
- Confirm the **existing sub-agent orchestrator** can host the new wiki/global/structured tools, or what rework it needs.
- Confirm the **~500-entry checkpoint table** name/shape (likely `mra_checkpoints`) and its query interface so the `structured_data` and stage-primer paths can target it.
- Confirm the **existing wiki scaffolding** in the UI and how the three-class page model maps onto it.

**Needs founder / product input:**
- Exact table schemas / DDL for per-user pages (three content classes), insight records (state, trust level, provenance, source refs), override records, and the global IP page store — deferred to build planning; this spec defines intent and key fields.
- The **confidence-bar threshold** for write-back qualification (D11.iii).
- The **promotion review UX** specifics (the founder-confirmation surface).
- Cost/time vs. benefit of **laying dreaming scaffolding in beta** vs. fully post-beta.
- Whether per-user pages are **embedded for cross-page semantic search** beyond the insight layer, or remain deterministic page-key only.
- **Forthcoming maintenance/dreaming material** — Section 3 to be extended before build planning closes.
- **CSO persona / voice layer (adjacent component).** A small, versioned definition of the Virtual CSO's voice and stance (opinionated strategic advisor, grounds in the methodology, low-hedge) — distinct from the *global IP knowledge* layer. Modeled on OpenClaw's `SOUL.md` (voice ≠ knowledge). Out of scope for the wiki core; flagged so it isn't conflated with global IP. Decide where it lives (Virtual CSO endpoint config) during build planning.

**Explicitly deferred to roadmap (post-beta):**
- Founder-visible confidence/contradiction flags and the "refine the wiki from flags" feature (D3).
- Corroboration-based auto-promotion (D10, 2b).
- The full dreaming cycle as a named, launched feature (D2).

---

## 7. Reference Implementations (for the build agent)

These repos are **reference material, not dependencies.** The build/training agent is directed here for proven examples of the decisions above — it does the extraction and repurposing. We adopt the *model and conventions*, never the storage plumbing (our store is Supabase; hard constraint). This section logs *what to look at and why*.

### 7.1 `theafh/ai-modules` — `knowledge_management` plugin
Repo: https://github.com/theafh/ai-modules — plugin path `plugins/knowledge_management/`.

A filesystem-based personal toolkit (MIT) that independently implements much of the Tier 1 thesis. Its `wiki` skill states the thesis nearly verbatim: *"the wiki compiles knowledge once and keeps it current. Cross-references are already there. Contradictions have already been flagged."* Ships three skills + one agent:

- **`wiki`** (`skills/wiki/SKILL.md`) — persistent compounding markdown KB; the core reference.
- **`wiki_auto_shaper`** (`agents/`) — autonomous lint + semantic-audit + fix loop in an isolated context.
- **`spr`** (`skills/spr/SKILL.md`) — Sparse Priming Representations: dense priming statements for LLM-to-LLM transfer, with a reconstructability rating.
- **`executive_summary`** (`skills/executive_summary/SKILL.md`) — structured-prose summarization to 10–15% length with a self-rating.

**Seven adoptions (all confirmed for v1):**

| # | Adopt | Maps to | Notes |
|---|---|---|---|
| A1 | **Wiki Schema object** — a versioned declaration of the page set, tag taxonomy, frontmatter contract, confidence enum, and contradiction fields, read by both synthesis and validation. | New — supports D13/D14 | Their `SCHEMA.md` concept, ported to Supabase/config. Adopt the *concept*, not their generic page-type enum (we keep our fixed domain page set, §2). |
| A2 | **Provenance convention** — claim-level *inline* source links + a structured `sources` inventory, both validated. No footnotes, no bottom-of-page source lists (they split claim from evidence). | D17 (block-level provenance) | This is the concrete form of our block-level decision. |
| A3 | **Confidence + contradiction flags** — `confidence: high\|medium\|low` (high reserved for multi-source); `contradictions: [page-ref]` + `contested: true`; record both positions, flag, leave resolution to the human. | D3, §5 "name the tension", D10 | Plumbing-first, matching D3. Their don't-auto-resolve rule == our framework-is-the-lens principle. |
| A4 | **Per-user index + action-log** — an index catalog (one-line page summaries) and an append-only action log. | D14, §4 trust model | Index = cheap catalog the orchestrator scans before deep retrieval. Log = audit trail of every synthesis / write-back / promotion; feeds the future founder-facing flag-review surface. |
| A5 | **Consolidation cycle modeled on `wiki_auto_shaper`** — assess → fix → verify loop (dedup, audit for topic-mixing/type mismatch, split/relocate, re-lint until clean, log the pass, report per-file changes). | §3 dreaming | **Write-scope guardrails are ours, not theirs:** the cycle may write only the insight layer and Open Questions — never the compiled base, never auto-promote. Their model edits pages in place; we do not. |
| A6 | **SPR + `executive_summary` as synthesis primitives** — SPR for packing the global-IP slice + user-wiki snapshot into the synthesis call's token budget densely (with reconstructability as a quality gate); `executive_summary` as a generation primitive for compiled-base prose pages (snapshots, Diagnostic Synthesis), self-rating as a lightweight confidence signal. | §5 (SPR), §2 page generation (exec summary) | Post-beta-leaning techniques, logged now so they tie into the dreaming/context work. |
| A7 | **Validation / health-check set** — ported lint checks (broken provenance links, missing/malformed frontmatter, off-taxonomy tags, stale/drifted sources, contested pages, orphans) run after each compiled-base rebuild and by the consolidation cycle. | New — supports §3 maintenance | Checks translate to Supabase-side validation logic; the bash/python `lint.py` implementation does **not** transfer. |

**What does NOT transfer (do not port):**

- **Filesystem + scripts** (`discover_wiki.sh`, `init_wiki.sh`, `lint.py`, markdown-on-disk). Our store is Supabase. Port the *checks* (A7), not the scripts.
- **Discovery / walk-up / `.no_wiki`** — single-tenant, one-wiki-per-directory machinery. We resolve by `user_id` + `scope`. Irrelevant.
- **Generic page-type taxonomy** (entity/concept/comparison/summary/query/procedure). We keep our fixed domain page set (§2). Adopt the schema *concept* (A1), not these types.
- **Update-in-place.** Their wiki mutates pages directly. In our model that violates the compiled-base / insight / override separation (D5). Adopt their flagging; reject in-place mutation.

### 7.2 OpenClaw — memory subsystem & `memory-wiki` plugin
Docs: https://docs.openclaw.ai/concepts/memory · https://docs.openclaw.ai/plugins/memory-wiki — Repo: https://github.com/openclaw/openclaw

A production-grade agent runtime. We reference **only its memory subsystem.** It independently implements the model in this spec and resolves several previously-open questions with concrete mechanisms. Its key architectural move matches ours: it **separates the compiled knowledge store (`memory-wiki`) from the engine that maintains it (the active memory plugin — recall, promotion, dreaming).** That is our orchestrator+tools (engine) vs. wiki tables (compiled store).

**Eight adoptions (confirmed for v1):**

| # | Adopt | Maps to | Notes |
|---|---|---|---|
| B1 | **Claim as the unit of knowledge.** Pages hold structured claims (`id, text, status, confidence, evidence[]`); each evidence entry carries `sourceId, path, lines, weight, note`. Makes the wiki a *belief layer*, not a note dump — claims are individually tracked, scored, contested, resolved. | **Upgrades D17 / A2** | Per-claim confidence + contradiction tracking replaces per-page. This is the one *change* to the prior model (founder-approved), not an addition. |
| B2 | **Compiled digest.** A small machine-readable artifact (top pages, top claims, contradiction count, question count, confidence/freshness qualifiers) the orchestrator reads instead of scraping pages. | **§5 "prime thin"; pairs with A6 (SPR)** | The concrete cheap-context object for relevance judgment and context injection. Maintain one digest per user wiki. |
| B3 | **Promotion gates: score + recall frequency + query diversity.** An insight earns promotion when it's actually retrieved often and across varied questions — not once. | **Enriches D10** | Machine-side filter that surfaces candidates to founder confirmation (2a) and later drives auto-promotion (2b). |
| B4 | **Staging + reversibility.** Nothing writes the trusted/compiled layer directly; candidates stage in the insight layer; promotion is the only path to trusted; promotions are auditable and reversible. | **Enriches D9, D10, §4** | Reversibility logged via the action-log (A4). |
| B5 | **Write-back trigger = pre-compaction / session-end flush.** A silent pass at session end proposes write-backs so insights aren't lost when context is compacted. | **Answers the open "when" in Idea 3 / §4** | This is the concrete firing point for domain-agent write-back. |
| B6 | **Narrow structured mutations.** Wiki updates are constrained operations (add claim, set confidence, flag contradiction) — never freeform page rewrites. | **§2 coherence; models OpenClaw `wiki_apply`** | Solves the incremental-amendment coherence risk. |
| B7 | **Managed blocks vs. human blocks.** Regeneration owns managed (compiled) blocks; founder edits live in preserved human blocks. | **In-page realization of D5** | The concrete rendering of compiled-base vs. override within a single page. |
| B8 | **Health dashboards.** Generated `open-questions`, `contradictions`, `low-confidence`, `claim-health`, `stale-pages` surfaces. | **Realizes A7; feeds the Open Questions page (§2)** | Adopt the report set as our health/validation surfaces. |

Plus **action-boundary metadata** on insight records where relevant (safe-to-act timing, expiry, authority/owner, what to avoid) — OpenClaw's "action-sensitive memory," whose own untrusted-source example restates our reasoning-only model (D9) as a schema.

**What does NOT transfer:** vault modes (isolated/bridge/unsafe-local), Obsidian render, markdown-on-disk substrate, SQLite/LanceDB backends, the CLI — all OpenClaw deployment specifics. Take the schemas and the model; not the substrate (Supabase + pgvector, one integrated platform).

**Adjacent (not folded into the wiki core):** `SOUL.md` → a versioned **CSO persona/voice layer**, distinct from global IP *knowledge*. Logged in §6 Open Decisions.

> **Status:** Two reference sources logged (§7.1 repo, §7.2 OpenClaw docs). **Broad structural pass over the OpenClaw repo: complete (2026-06-29).** It validated — did not expand — these concepts. Confirmed at the module level: memory ships as discrete extensions where the *engine* (`extensions/memory-core` — recall, promotion, dreaming) is physically separate from the *compiled store* (`extensions/memory-wiki` — claims/evidence vault), exactly mirroring our orchestrator-engine vs. wiki-tables split. (Not adopted: OpenClaw's swappable-backend abstraction `active-memory` fronting core/lancedb/qmd/honcho — over-engineering against our locked single backend, Supabase + pgvector.) Deep extraction stays with the build/training agent.

---

*End of v1. Reference review closed (both sources logged, OpenClaw repo pass complete). Section 3 remains extensible pending the founder's maintenance/dreaming material.*
