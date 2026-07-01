# Context: Agent Skills & Document Generation Engine — ArchitectOS Pro

**Written:** 2026-07-01, end of Ep4 Discuss phase
**Audience:** The Orchestration Agent and every Execution Agent that touches this build. This document has no dependency on the conversation that produced it — everything load-bearing is written down here.

---

## Why This Build Exists

ArchitectOS Pro's intelligence layer already lets founders talk to the Virtual CSO and get answers grounded in their platform data and documents (see `INTELLIGENCE-VISION.md` for the four-tier retrieval architecture). What it can't do yet is *act* on that data in a structured, repeatable way — produce an actual formatted report, run a real calculation instead of an LLM guessing at arithmetic in prose, or let a founder teach the AI a specific way of doing something once and reuse it.

Two founder-facing problems this solves:

1. **"I want the AI to do this the same way, every time."** A founder (or the platform) defines a skill once — how to structure a monthly business review, how to evaluate a pricing change — and it becomes a reusable capability instead of a one-off prompt re-typed every time.
2. **"I don't trust the AI's math, and I want an actual file, not just chat text."** Founders uploading P&Ls, client rosters, and financial documents need real computation (not LLM-estimated arithmetic) and real deliverables (a PowerPoint, an Excel workbook, a PDF) — not just a longer chat reply.

This is the second Ep4 build in the Pro Suite intelligence layer initiative (see `Pro-Suite-Progress.md`), following the completed Knowledge Base Explorer (Ep2, Phases 1–9).

---

## What This Build Is Not

- **Not a rewrite of the existing `ip_skill_packs` / IP layer.** The rules engine (`ip_rules`), base/classification prompts (`ip_prompts`), and curated knowledge pages (`ip_knowledge_pages`, `ip_relationships`) are untouched. Only `ip_skill_packs` changes — because its actual semantics changed, from "global-only admin IP" to "general skill system with global and private scopes."
- **Not general-purpose compute.** The code execution sandbox exists for two specific jobs: generating formatted documents from skill-defined structures, and running real (non-LLM) calculations against founder/platform data. It is not a developer sandbox, not a place to run arbitrary scripts unrelated to those two jobs.
- **Not a replacement for the N8N + Google Docs merge pipeline.** MRA Report and AE Ladder Report PDFs stay exactly as they are — templated merges through N8N. The sandbox is additive: it handles the class of output a static template can't produce, where the skill defines the structure and the system populates it dynamically from context.
- **Not a multi-user or team feature.** Beta is founder-only. There is no team-skill-sharing model, and there won't be one built as part of this work.
- **Not a self-hosted Kubernetes operation.** GKE Autopilot means Google manages the underlying nodes. Nobody at ArchitectOS is signing up to be a Kubernetes administrator; the trade being made is real container isolation in exchange for a managed control plane, not "we now run our own cluster ops."

---

## Every Scope Decision, With Rationale

### 1. Sandbox execution environment: GKE Autopilot, not Docker-in-Docker on Railway

**Adopt (adapted).** The reference architecture (`llm-sandbox` + local Docker) assumes a host where a Docker daemon is reachable. `llm-sandbox` is a client library — it doesn't provide isolation itself, it drives whichever container backend it's pointed at (Docker socket, Kubernetes API, or Podman socket). Railway, ArchitectOS's current Python host, does not expose a Docker socket to application code and does not allow privileged containers. Docker-in-Docker on Railway is not a hardening tradeoff to weigh — it is architecturally unavailable.

**Decision:** Sandbox execution runs on a single **GKE Autopilot** Kubernetes cluster, reached via `llm-sandbox`'s Kubernetes backend. The existing Railway Python backend keeps its current responsibilities (chat, ingestion, orchestration) and gains one new job: when a skill needs to execute code, it calls out to the GKE cluster, which creates a sandbox, runs the code, returns the result, and tears the sandbox down.

**Why GKE specifically, and why Autopilot mode:** Self-managed ("vanilla") Kubernetes is a specialized operational skill that would mean ArchitectOS taking on cluster administration it has no reason to want. GKE Autopilot lets Google manage the underlying node fleet — the team declares "run this container image with these resource requests" and Autopilot handles capacity. This gets the long-term scalability property London explicitly wanted (grow usage without a proportional growth in operational complexity) without requiring the team to become Kubernetes operators.

**Why one cluster is sufficient, now and at scale:** A cluster is not one sandbox — it's the pool of capacity that can run many sandbox pods concurrently. Scaling from one founder to many means running more pods inside the same cluster, not provisioning additional clusters. A second cluster only becomes worth considering as a staging/testing environment, logged as SANDBOX-05 (deferred, v2).

**Cost model, without forecasting spend:** GKE charges two independent things. (a) A flat $0.10/hour "cluster management fee" for the cluster simply existing, charged regardless of whether it's doing any work. GKE's free tier grants $74.40/month in credit, applicable only to this fee — and $74.40 ÷ $0.10/hr = 744 hours, which is enough to cover one cluster running continuously for an entire month. As long as ArchitectOS runs exactly one cluster, this fee is permanently offset by the free tier; it does not require monitoring or "run out." (b) Actual compute — CPU/memory the sandbox pods consume while executing code, billed per-second under Autopilot's Pod-based billing model, only while a pod is in the Running or ContainerCreating state. This is the meter that scales with real usage, and it scales linearly (more executions = proportionally more cost), not in step-function jumps that would force a re-architecture.

### 2. Sandbox use case expanded beyond the reference PRD: real-time calculation, not just document generation

**Adapt.** The reference PRD scopes the sandbox purely as a document-generation tool. London's stated intent goes further: the sandbox should also run real-time calculations against uploaded documents and platform data, replacing cases where the Virtual CSO would otherwise estimate arithmetic in conversation. This is the same underlying capability (an `execute_code` tool) serving two different latency profiles:

- **Document generation** — a founder waits for a "your report is ready" card. Latency budget is generous (5–30 seconds is acceptable).
- **Real-time calculation** — a founder is waiting mid-conversation for an answer. Latency budget is tight; this is closer to a synchronous tool call than an async job.

**Decision: session persistence is required, not optional**, specifically because of the calculation use case — a founder may ask a follow-up question that references a prior calculation's state without re-uploading or re-stating it. The reference's IPython-kernel-per-thread pattern is the right shape; it needs to be adapted to run against the GKE-hosted sandbox rather than a local Docker session.

### 3. Skills model: one table, renamed, ownership-gated global scope

**Adapt.** The reference builds a fresh `skills` table with a nullable `user_id` (null = global) and lets any user toggle their own skill between private and global. ArchitectOS already has `ip_skill_packs` — admin-curated, globally visible, queried directly by `classify()` in `api/vcso/chat.ts` on every Virtual CSO message.

**Decision: rename `ip_skill_packs` to `skill_packs`.** The "IP" prefix stops being accurate once the table holds founder-created private skills alongside admin-created global ones — it's a general skill system now, not exclusively IP-layer content. This is a rename plus an extension (add `user_id`/ownership and `scope`), not a parallel table. Rationale given directly: `classify()` already queries this table on every message; a second table would mean merging two query results on every routing pass for a distinction (global vs. private) that's cheap to express as a single filtered query instead.

**Decision: global scope is derived from ownership, not a self-service flag.** A skill can only be `scope = 'global'` if its owning `user_id` is the platform's designated admin account. This is a deliberate simplification over the reference's per-user toggle: London's stated model has no user-to-global promotion path at all — founders' skills are always private — so "global" reduces to "owned by the admin account," which is simpler to enforce (an ownership check) than a general sharing permission system. The admin account does not need to be a separately built concept yet; it is simply whichever `user_id` is designated as the admin. This is deliberately future-compatible with a planned (but out-of-scope-for-this-build) admin panel: because global-ness already reduces to admin ownership, an admin panel arriving later is additive UI, not a schema migration.

**Explicit permission to diverge from the old shape:** `ip_skill_packs` was designed before ArchitectOS had a sub-agent / capability-registry pattern (`agent_capabilities.py`, `AgentCapabilityRegistry`, bounded delegation runs). London's own words: "we don't need to try to hold on to the previous structure if it no longer serves what we're ultimately trying to do." Execution agents should treat the existing columns (`slug`, `trigger_tags`, `required_platform_context`, `body`, `output_contract`, `writeback_rules`, `status`) as a starting point to evaluate, not a contract to preserve untouched.

**Not renamed, not restructured:** `ip_rules`, `ip_prompts`, `ip_knowledge_pages`, `ip_relationships`. Only the table whose meaning actually changed gets touched.

### 4. Skill discovery and invocation: two paths, not one

**Adopt (adapted).** The reference uses a single progressive-disclosure mechanism: lightweight catalog in the system prompt, `load_skill` tool call on match. ArchitectOS already has this pattern in `classify()` / `scoreSkill()` — keyword and trigger-tag scoring, top 2 skills selected, full bodies loaded via `loadSelectedSkillBodies()`.

**Decision:** two distinct routing paths coexist.
- **Implicit discovery** — `classify()` is extended to score across global skills *and* the requesting founder's own private skills in one combined ranked pass (today it only ever sees global rows, since `ip_skill_packs` has no owned rows to exclude or include).
- **Explicit invocation** — a founder naming or tagging a specific skill directly in a message short-circuits straight to loading that skill, regardless of its score. A founder who already knows what they want should not be at the mercy of keyword matching.

### 5. Skill creation: three paths, all shipping for beta

**Adopt.** AI-guided (conversational, in-thread, explicitly modeled on the Cowork/Claude Code skill-creator experience), manual form, and ZIP import all ship together — not staged across releases. London's reasoning: once `skill_packs` CRUD exists, supporting all three paths is not substantially more work than supporting two.

**Decision (confirmed 2026-07-01):** because the AI-guided path is explicitly meant to mirror the Claude Code / Cowork skill-creator experience, the native storage/authoring shape for a skill's instructions is the actual SKILL.md open standard format (YAML frontmatter + markdown body) — not a bespoke ArchitectOS schema with SKILL.md export bolted on afterward. This delivers the reference's Feature 4 (open standard import/export) as a byproduct of the storage decision, rather than as separately scoped work. This was raised as a proposal during discussion and confirmed directly by London in a follow-up — it is a locked decision, not a default awaiting review.

**Decision: a Skills Library UI surface** (third top-level area, alongside Chat and the existing Documents/Uploads surface) lists global skills and the founder's own private skills for browsing — mirrors the reference's Skills tab, matches London's explicit comparison to the Claude Code / Cowork skills library. Exact layout and placement within the ArchitectOS design system (Obsidian Navy sidebar, Parchment canvas, asymmetric layouts — see `CLAUDE.md`) is a design-pass decision, not fixed here.

### 6. Building-block files: distinct from KB documents, same storage conventions

**Adopt (adapted).** The reference stores skill files in private storage at `{user_id}/{skill_id}/{filename}`, categorized by MIME type into `scripts/`, `references/`, `assets/`, accessed via a `read_skill_file` tool — not RAG-indexed.

ArchitectOS already draws a hard line the reference doesn't need to: **KB documents are the founder's business data** — searchable, browsable, the substrate the KB Explorer and wiki layers operate on. **Skill building-block files are a skill's own resources** — a report template, a brand guide, a SOW format — loaded only when that specific skill runs, never surfaced in document search. London confirmed this distinction directly and wants it structurally, not just conceptually, separate.

**Decision:** a new `skill-files` Storage bucket, paths shaped `{owner_user_id}/{skill_id}/{category}/{filename}` (category = scripts/references/assets, matching the SKILL.md standard directories already adopted for skill authoring), plus a `skill_files` metadata table (skill_id, filename, category, mime_type, size, storage_path) mirroring how `ose_raw_document_registry` already separates metadata from blob storage for KB documents. This follows ArchitectOS's existing bucket convention exactly: every current bucket (`raw-documents`, `kb-files`) uses an RLS policy keyed on the first path segment matching `auth.uid()`. The one genuinely new piece: **global skill files need open-read, admin-only-write RLS** — every founder's Virtual CSO must be able to read the admin's global skill files, which is a different shape than the strict single-owner policy every existing bucket uses today. This is called out explicitly so it isn't executed as a copy-paste of the boilerplate private-bucket pattern.

### 7. Persistent tool memory: shared plumbing, not a skills-only feature

**Adopt (adapted). Decision confirmed 2026-07-01: build this now, early, as shared infrastructure — not deferred.** The reference persists tool call results in a JSONB column alongside messages, with no schema migration needed since the column already exists in their stack. ArchitectOS's equivalent thread/message storage needs to be checked for the actual current shape before assuming "no migration needed" carries over — that verification is Phase 2's first step, not an assumption to build on unchecked.

This matters more now than it did when the KB Explorer shipped: Phase 9 of the KB Explorer build deliberately kept `agentSteps` client-side only, not persisted, because KB Explorer results are read-only lookups a founder can re-trigger cheaply. Skill invocations and code executions are not always cheap or idempotent to re-run — a founder referencing "that calculation from earlier" should not force a re-execution. Treat this as shared infrastructure any tool-calling surface benefits from (KB Explorer, skills, sandbox alike), not a bolt-on scoped to this feature alone.

### 8. Document delivery: split by renderability, both paths reuse existing patterns

**Adopt (adapted).** London's explicit vision: markdown/HTML-renderable sandbox output reuses the *existing* expandable right-hand panel component (the one already built for rendered markdown/HTML files, occupying the same UI slot as the scratchpad/working-folder/context-file outline). Non-renderable output (PowerPoint, Excel, CSV, and similar) surfaces as an inline "your file is ready" chat card with a download link.

**Decision:** no new panel component gets built for the markdown/HTML path — the execution agent's first job in that phase is to locate and confirm the existing component, per the standing principle of verifying before rewriting. The non-renderable path is backed by a new `artifacts` Storage bucket and signed download URLs.

### 9. Artifacts table: shared with Domain Agents, not a parallel system

**Adopt, and reconciled with prior design work.** A separate design conversation about the Domain Agents architecture (workflow → task → artifact model) already anticipated an artifacts library as a standing UX surface, with "every artifact logged in an artifacts table with URL + Supabase storage location, client-facing, browsable, gated to the user's own files." That table was never actually built — checking the current schema confirms no `artifacts` table exists; the only trace is a text mention of "domain-agent artifacts" inside a Document Wiki migration comment, not real structure.

**Decision:** the `artifacts` table and bucket built in this work *are* that anticipated table — one shared schema and one browsing surface, used by both Virtual CSO (sandbox output) and Domain Agents (workflow output) once Domain Agents' live wiring lands. This is not two systems that happen to look similar; it's the same infrastructure serving two surfaces, matching London's closing instruction to default to reusable shared infrastructure across Virtual CSO, OS Engine, and Domain Agents rather than building near-duplicate systems per surface.

### 10. Sequencing: Virtual CSO first, Domain Agents inherit later

**Decision.** Virtual CSO is live today; Domain Agents are still running on mock data (per `Pro-Suite-Progress.md`). Skills, the sandbox, and the artifacts table land on Virtual CSO first, end to end. Domain Agents adopt the same `skill_packs`, sandbox, and `artifacts` infrastructure once their own live wiring catches up — that adoption is explicitly **not** a phase in this build's roadmap; it's a forward-looking integration note for whenever the Domain Agents live-wiring work happens.

---

## The Governing Principle for Everything in This Build

London's closing instruction, stated directly, applies to every phase and every execution agent touching this work:

> "Many of these features and functionality elements are intended to be repurposed across different areas. Virtual CSO, OS Engine, and Domain Agents are all different but leveraging similar backend infrastructure. We don't need to overcomplicate things that don't need to be complicated for intentional design purposes... if something genuinely needs its own table based on its structure and its use case, then that's fine. Otherwise, we can default to trying to reuse what we can and simplify what we can going forward."

Concretely, this means: before an execution agent creates a new table, bucket, or capability definition, it should check whether an existing one (across the skills system, the sandbox, KB Explorer, or the wiki layers) already covers the need. Genuinely distinct structure or use case justifies a new table. A surface-level difference (e.g., "this is for Domain Agents instead of Virtual CSO") does not.

---

## Architectural Decisions Execution Agents Must Not Override

1. **No Docker or Podman sandbox backend.** GKE Kubernetes backend via `llm-sandbox`, full stop. This is not a preference — Docker-in-Docker is unavailable on the current hosting stack.
2. **Global skill scope is ownership-derived, never a self-service flag.** Do not add a `founder-facing "make global" toggle.
3. **No user-to-global skill promotion**, and no team/multi-user skill sharing of any kind.
4. **`ip_rules`, `ip_prompts`, `ip_knowledge_pages`, `ip_relationships` are out of scope for this build.** Only `ip_skill_packs` → `skill_packs` changes.
5. **The sandbox does not replace the N8N + Google Docs merge pipeline.** Both exist, serving different jobs.
6. **KB documents and skill building-block files remain structurally separate systems** — different buckets, different access patterns (searchable/RAG vs. tool-access-only), never merged.
7. **One GKE cluster.** A second cluster is an explicitly deferred, separately justified decision (staging), not a default to reach for.

---

## Deferred Item Registry

See REQUIREMENTS.md v2 table for the authoritative list (ADMIN-01, SANDBOX-05, SANDBOX-06, SKILL-11). In prose:

- **Admin panel / global settings UI** — real need, explicitly flagged by London as coming later, deliberately not blocking this build because the ownership-based global-scope design already accommodates it.
- **Staging GKE cluster** — no beta demand yet.
- **Sandbox container/session pooling for latency** — revisit only if real usage data after launch shows cold-start latency is actually a problem for the real-time-calculation path. Do not pre-optimize for a load profile nobody has observed yet.
- **Multi-language sandbox support** — Python covers every job-to-be-done identified for beta.

---

## Stack Constraints Recap (unchanged by this build)

- Frontend: React 19 / Vite 6 / TypeScript — no rewrite.
- AI synthesis: Claude Sonnet only, routed through N8N (batch/scheduled) or the Vercel streaming chat function — never direct client-side Anthropic calls, never Supabase Edge Functions for AI.
- Backend for ingestion/agents: Python/FastAPI on Railway — this build adds a GKE Autopilot cluster as a new, separate compute target the Railway backend calls out to; Railway itself is not replaced.
- Supabase remains the system of record for schema, Storage, and RLS enforcement.

---

## Amendments (dated, appended — original decisions above are not rewritten)

### 2026-07-01 — Admin designation mechanism + global-skill creation path (from Phase 1 checkpoint)

No mechanism for "the platform admin account" existed anywhere in the schema when this document was
originally written (§3 assumed it would resolve to "whichever `user_id` is designated as the admin"
without specifying how). Phase 1's live-verification pass confirmed the gap; the following was
proposed and **confirmed directly by London (2026-07-01):**

- Add `profiles.is_admin BOOLEAN DEFAULT false` (reuses the existing `profiles` table). Global scope
  on `skill_packs` is valid for **any** account with `is_admin = true` — this is a general flag, not a
  single hardcoded admin `user_id`. Multiple admin-flagged accounts are supported by design.
- The primary path for creating global skill content will be **bulk CSV upload directly against the
  `skill_packs` table**, or direct Supabase access (e.g. via the Supabase MCP from a Cowork session)
  — **not** a "make global" button anywhere in the product UI. This is why the global-scope rule is
  enforced at the database layer (trigger + RLS), not only in application code — it has to hold no
  matter which path writes the row.
- **Implication for Phase 4 (Skills Library UI, not yet built):** the manual creation form and the
  AI-guided creation flow should not expose any global/private toggle to founders. Scope is never a
  user-facing input — it's an outcome of who's authenticated when a row is written, gated by
  `is_admin`. Phase 4's execution agent should read this amendment before scoping the creation UI.

See `.planning/skills-sandbox/phases/01-schema-storage-foundation/CONTEXT.md` §2 for the full
build-level detail and rationale.
