# Requirements: Agent Skills & Document Generation Engine — ArchitectOS Pro

**Defined:** 2026-07-01 (Ep4 Discuss Phase)
**Core Value:** Founders and the platform admin can create reusable AI behaviors ("skills"), and those skills can generate real documents and run real calculations against founder/platform data through a governed code execution sandbox — instead of relying on in-conversation LLM arithmetic or one-off prompt engineering.

---

## Adaptation Notes (vs. Reference Ep4)

| Reference Element | ArchitectOS Decision |
|---|---|
| Fresh `skills` table, `user_id` nullable = global | Renames and extends the existing `ip_skill_packs` → **`skill_packs`**. Global status is derived from ownership by the platform admin account, not an independent flag. |
| Sharing: user toggles own skill global ↔ private | **REMOVED** — no user-to-global promotion path exists. Only the admin account's skills can occupy global scope. |
| Docker (`llm-sandbox[docker]`) against a local Docker daemon | **REPLACED** — Railway (current Python host) does not expose a Docker socket or allow privileged containers. Sandbox runs on a managed **GKE Autopilot** Kubernetes cluster, accessed via `llm-sandbox`'s Kubernetes backend. |
| Sandbox use case: document generation only | **EXPANDED** — sandbox is also used for real-time calculation against uploaded documents and platform data, replacing in-conversation LLM arithmetic. This raises the bar on latency and session persistence versus the reference's assumption. |
| SKILL.md open standard treated as an export/import feature | **ADOPTED AS THE NATIVE AUTHORING FORMAT (confirmed)** — `skill_packs` body is stored/authored directly in SKILL.md shape (YAML frontmatter + markdown body), not a bespoke schema with export bolted on later. |
| Skill building-block files: generic private storage | Adapted to ArchitectOS's existing bucket + RLS convention (`{user_id}/...` foldername ownership check, same pattern as `raw-documents` and `kb-files`). Explicitly distinct from KB documents, which remain founder business data — searchable and browsable — not skill resources. |
| Persistent tool memory: scoped to the skills/sandbox feature | Treated as **shared, cross-surface plumbing** — KB Explorer, skills, and sandbox tool calls all benefit, not a skills-only add-on. |
| Generated file delivery: generic download link | Split by renderability. Markdown/HTML output reuses the existing expandable right-hand panel. Other file types (pptx, xlsx, csv, etc.) get an inline chat card + download link, backed by a new `artifacts` bucket. |
| Artifacts table: new, scoped to this feature | Reuses/fulfills the artifacts table already anticipated by the separately-designed Domain Agents architecture (workflow → task → artifact model). One shared table, not a parallel one. |

---

## v1 Requirements

### Skills Model & Storage

- [ ] **SKILL-05**: Admin-owned skills are visible to all founders as global skills
- [ ] **SKILL-06**: Only the platform admin account's skills can hold global scope — enforced structurally (ownership-gated), not by a self-service flag any founder could set
- [ ] **FILE-01**: Skills can have building-block files attached, categorized into `scripts/`, `references/`, `assets/` (mirrors the SKILL.md open standard's directory structure)
- [ ] **FILE-03**: Global skill files are readable by all founders, writable only by the admin account
- [ ] **FILE-04**: Private skill files are scoped to their owning founder only (read + write)

> No skill-promotion path: founders cannot convert a private skill to global. This was settled before this discussion began and is reaffirmed here, not reopened.

### Skill Discovery & Invocation

- [ ] **SKILL-08**: Virtual CSO discovers relevant skills via scored ranking across global skills + the requesting founder's own private skills, combined into one ranked pass
- [ ] **SKILL-09**: Founders can explicitly name or tag a specific skill in a message to force its use, bypassing the scored-ranking path entirely

> Two distinct routing paths, not one: implicit discovery (ranked scoring) for when a founder doesn't specify a skill, explicit invocation (named/tagged) for when they do. Explicit invocation always wins.

### Skill Creation

- [ ] **SKILL-01**: Founders can create private skills via a manual form
- [ ] **SKILL-02**: Founders can create private skills via an AI-guided, in-thread conversational flow (mirrors the Cowork/Claude Code skill-creator pattern)
- [ ] **SKILL-03**: Founders can import skills from a SKILL.md-format ZIP file
- [ ] **SKILL-04**: Founders (and the admin, for global skills) can export a skill as a SKILL.md-format ZIP file
- [ ] **SKILL-07**: A Skills Library UI surface lists global skills and the founder's own private skills, for browsing and discovery

### Code Execution Sandbox

- [ ] **SANDBOX-01**: Code execution runs on a managed GKE Autopilot Kubernetes cluster, accessed via `llm-sandbox`'s Kubernetes backend — not Docker, not Podman
- [ ] **SANDBOX-02**: Sandbox sessions persist state across multiple calls within the same conversation thread (required — not optional — given the real-time-calculation use case)
- [ ] **SANDBOX-03**: An `execute_code` tool is available to the Virtual CSO for document generation and real-time calculation against founder/platform data
- [ ] **SANDBOX-04**: The sandbox's container image pre-installs Python document-generation and data libraries (pandas, python-docx, python-pptx, openpyxl, matplotlib, and similar)
- [ ] **FILE-02**: A `read_skill_file` tool lets the LLM read attached skill file content on demand

### Artifacts & Delivery

- [ ] **ARTIFACT-01**: Generated files persist to a shared `artifacts` Storage bucket with a companion metadata table (created-at, source thread/session, purpose/description)
- [ ] **ARTIFACT-02**: Markdown/HTML-renderable sandbox output displays in the existing expandable right-hand panel (the same one used for other rendered markdown/HTML today)
- [ ] **ARTIFACT-03**: Non-renderable sandbox output (pptx, xlsx, csv, etc.) surfaces as an inline "your file is ready" chat card with a signed download link
- [ ] **ARTIFACT-04**: The artifacts table/bucket is shared infrastructure — usable by both Virtual CSO (built first) and Domain Agents (once their live wiring lands), not a parallel system

### Persistent Tool Memory

- [ ] **MEMORY-01**: Tool call results (skill loads, code executions, and other tool outputs) persist in thread history so follow-up questions can reference prior results without re-execution

---

## v2 Requirements (Deferred)

| Requirement | Description | Deferred reason |
|---|---|---|
| ADMIN-01 | Admin panel / platform-wide settings UI, tied to the admin account | Not needed to ship Ep4. The schema decision (global = admin ownership) is deliberately shaped so this panel slots in later without a migration. |
| SANDBOX-05 | A second (staging) GKE cluster for testing sandbox changes safely | No beta demand; one cluster covers current need. A second cluster is a second $0.10/hr management fee outside the single free-tier credit. |
| SANDBOX-06 | Container/session pooling for reduced sandbox cold-start latency | Revisit once real usage data shows cold-start latency is actually a problem for the real-time-calculation path — not assumed upfront. |
| SKILL-11 | Multi-language sandbox support (JavaScript, Java, C++, Go, R) | Beta use case (document generation, calculation) is Python-only. `llm-sandbox` supports more languages, but nothing in ArchitectOS's job-to-be-done needs them yet. |

---

## Out of Scope

| Feature | Reason |
|---|---|
| User-to-global skill promotion | Founders cannot self-promote a private skill to global; only the admin account's skills can be global. Settled before this discussion, not reopened. |
| Team/multi-user skill sharing | Beta is founder-only; no team member accounts exist. |
| Docker or Podman sandbox backends | Railway hosting cannot expose a Docker socket or run privileged containers. GKE Kubernetes backend only. |
| Replacing the N8N + Google Docs merge pipeline | The sandbox is additive — it handles dynamic, skill-defined document generation. Templated merges (MRA report, AE Ladder report) stay on the existing N8N pipeline. |
| Renaming or restructuring `ip_rules`, `ip_prompts`, `ip_knowledge_pages`, `ip_relationships` | Only `ip_skill_packs` changes. The rest of the IP layer's semantics (platform doctrine, base prompts, curated knowledge pages) are untouched by this build. |

---

## Requirement Traceability

| Requirement | Phase |
|---|---|
| SKILL-05, SKILL-06 | Phase 1 |
| FILE-01, FILE-03, FILE-04 | Phase 1 |
| MEMORY-01 | Phase 2 |
| SKILL-08, SKILL-09 | Phase 3 |
| SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-07 | Phase 4 |
| SANDBOX-01, SANDBOX-02, SANDBOX-04 | Phase 5 |
| ARTIFACT-01, ARTIFACT-02, ARTIFACT-03, ARTIFACT-04 | Phase 6 |
| SANDBOX-03, FILE-02 | Phase 7 |

---
*Requirements defined: 2026-07-01*
*Adapted from Episode 4 reference (`claude-code-agentic-rag-series`): Docker sandbox backend replaced with GKE Autopilot; skill sharing model simplified to admin-ownership-gated global scope; sandbox use case expanded to include real-time calculation.*
*Confirmed 2026-07-01: `skill_packs.body` is natively authored/stored in SKILL.md format (no longer a default pending confirmation); Persistent Tool Memory builds early as shared infrastructure (no longer a sequencing default). Both were open items at first draft — both are now locked decisions.*
