# Roadmap: Agent Skills & Document Generation Engine — ArchitectOS Pro

## Overview

Delivers a founder-facing skills system (global admin-owned + private founder-owned, one shared `skill_packs` table) and a governed code execution sandbox (GKE Autopilot via `llm-sandbox`'s Kubernetes backend) that skills can invoke for document generation and real-time calculation. Starts with the schema and storage foundation, adds shared tool-memory persistence, then builds discovery/routing, creation UX, sandbox infrastructure, and delivery — culminating in end-to-end sandbox tool integration on the Virtual CSO. Domain Agents inherit this same infrastructure once their live wiring lands, as a follow-on integration outside this roadmap's phases.

## Process Rules

- **One phase at a time.** Each phase completes fully before the next begins.
- **Alignment checkpoint between phases.** Discuss phase specs and any cross-cutting concerns before an execution agent spins up.
- **Reuse before creating.** Before adding a new table, bucket, or capability definition, check whether existing infrastructure (skills, sandbox, KB Explorer, wiki layers) already covers the need. Per `CONTEXT.md`, this is a standing instruction, not phase-specific.
- **Execution agents are separate threads**, each pointed at its phase's plan files, per the GSD framework this build was scoped under.

---

## Phases

- [x] **Phase 1: Skills Schema & Storage Foundation** — Rename/extend `ip_skill_packs` → `skill_packs`; build `skill-files` bucket + `skill_files` table (Done 2026-07-01)
- [x] **Phase 2: Persistent Tool Memory** — Shared tool-call-result persistence across all tool-calling surfaces (Done 2026-07-01)
- [x] **Phase 3: Skill Discovery & Routing** — Extend `classify()` for private + global scoring; add explicit invocation (Done 2026-07-01)
- [x] **Phase 4: Skill Creation & Skills Library UI** — Manual form, AI-guided flow, ZIP import/export, Skills Library tab (Done 2026-07-01, incl. refinement pass — see phase folder `04-04-PLAN.md`)
- [x] **Phase 5: Sandbox Infrastructure** — GKE Autopilot cluster, `llm-sandbox` Kubernetes backend, custom image, session persistence (Done 2026-07-01)
- [x] **Phase 6: Artifacts & Delivery Experience** — Shared `artifacts` bucket/table; renderable vs. non-renderable delivery paths (Done 2026-07-02)
- [x] **Phase 7: Sandbox Tool Integration (Virtual CSO)** — `execute_code` + `read_skill_file` wired end-to-end (Done 2026-07-02)

---

## Phase Details

### Phase 1: Skills Schema & Storage Foundation
**Goal:** Establish the renamed, ownership-gated `skill_packs` table and the `skill-files` storage/metadata pair, so every later phase has a stable schema to build against.
**Depends on:** Nothing (first phase)
**Requirements:** SKILL-05, SKILL-06, FILE-01, FILE-03, FILE-04
**Success Criteria:**
  1. `ip_skill_packs` is renamed to `skill_packs` with existing rows preserved; a `user_id`/ownership column and `scope` derivation are in place
  2. A row can only carry `scope = 'global'` if its owning `user_id` is the designated admin account — enforced structurally (constraint, trigger, or RLS check), not left to application code alone
  3. `skill-files` Storage bucket exists with paths shaped `{owner_user_id}/{skill_id}/{category}/{filename}`
  4. `skill_files` metadata table exists (skill_id, filename, category, mime_type, size, storage_path)
  5. RLS on `skill-files`: private skill files are owner-only (read + write); global skill files are open-read, admin-only-write
  6. `ip_rules`, `ip_prompts`, `ip_knowledge_pages`, `ip_relationships` are verified untouched

---

### Phase 2: Persistent Tool Memory
**Goal:** Tool call results persist across conversation turns as shared infrastructure, so skill invocations, code executions, and other tool outputs can be referenced in follow-up messages without re-execution.
**Depends on:** Nothing structurally — sequenced early because it is foundational plumbing every later tool-calling phase benefits from.
**Requirements:** MEMORY-01
**Note:** Confirm the actual current shape of ArchitectOS's thread/message storage before assuming a JSONB-only, no-migration path carries over from the reference — verify first, do not assume.
**Success Criteria:**
  1. Tool call name, arguments, status, and result are persisted alongside the message they belong to
  2. Reloading a thread reconstructs assistant-message + tool-call + tool-result + assistant-response chains correctly
  3. A follow-up question referencing a prior tool result (e.g., "what was that number again") resolves without re-invoking the tool
  4. KB Explorer's existing client-side-only `agentSteps` behavior is evaluated for whether it should now also persist, given this shared capability exists
  5. **(Added 2026-07-01, confirmed by London)** The nested sub-agent "thinking/processing" section renders live, streamed above the returned message *during generation* — not only after the message finishes. Confirmed root cause: `agentSteps` are computed early (right after the KB Explorer call resolves) but today are only ever sent to the client in the final `done` SSE event, after the assistant's text has already fully streamed — so the nested section cannot currently appear before/alongside the response the way it's meant to. Both halves of this must work together: live streaming during generation, and full persistence of that same history across a thread reload (success criteria #1–#4 above).

---

### Phase 3: Skill Discovery & Routing
**Goal:** The Virtual CSO can find and use both global and private skills — automatically via relevance scoring, or directly when a founder names one.
**Depends on:** Phase 1 (skill_packs schema with scope/ownership must exist)
**Requirements:** SKILL-08, SKILL-09
**Note (added 2026-07-01, confirmed by London):** Research for this phase found a live production bug — `api/vcso/chat.ts` still queries the pre-Phase-1-rename table name (`ip_skill_packs`) in two places, inside an un-caught code path, meaning Virtual CSO chat has likely been failing on every message since the Phase 1 migration went live. London confirmed folding the fix into this phase (rather than a separate hotfix) since Phase 3 already touches both broken functions. This is the first, most urgent item in this phase's execution — fixed and verified in isolation before the rest of the phase's work.
**Success Criteria:**
  1. `classify()` scores global skills and the requesting founder's own private skills together in one ranked pass
  2. A private skill never appears in another founder's ranked results
  3. A message that names or tags a specific skill loads that skill directly, regardless of its ranking score
  4. Existing global-skill routing behavior (today's `classify()`/`scoreSkill()` logic) continues to work unchanged for founders with no private skills
  5. **(Added 2026-07-01)** The live table-name bug (`ip_skill_packs` → `skill_packs`) is fixed and independently verified working before the other success criteria are pursued

---

### Phase 4: Skill Creation & Skills Library UI
**Goal:** Founders can create skills three ways, and can browse everything available (global + their own) in a dedicated UI surface.
**Depends on:** Phase 1 (schema), Phase 3 (routing — needed for "try in chat" / explicit invocation of a newly created skill)
**Requirements:** SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-07
**Note:** `skill_packs.body` is natively authored/stored in SKILL.md format (confirmed decision) — build the editor/import/export UI around that format directly, not a bespoke schema with export layered on top.
**Note (added 2026-07-01, resolved with London at a mid-planning checkpoint):** the original assumption that Skills Library would sit "alongside Chat and Documents/Uploads" as top-level areas didn't match the live app (neither exists as a top-level area — both live nested under `/pro/intelligence`). Resolved as a hybrid: a **fourth intelligence peer workspace** ("Skills & Plugins," working name) housing the full library + both creation surfaces, **plus** a lightweight Chats/Skills toggle inside Virtual CSO's `ChatRail` for quick, read-only browsing. The AI-guided creation flow is a dedicated surface, not a Virtual CSO chat tool-loop retrofit (Virtual CSO chat has no agentic tool-calling today).
**Success Criteria:**
  1. A manual form creates a valid `skill_packs` row with founder ownership
  2. An AI-guided, in-thread conversational flow (mirroring the Cowork/Claude Code skill-creator pattern) produces a valid `skill_packs` row via a save-skill tool call
  3. A SKILL.md-format ZIP file imports successfully, including categorized building-block files
  4. A skill exports as a SKILL.md-format ZIP that re-imports losslessly
  5. A Skills Library UI surface lists global skills and the founder's own private skills, styled to the ArchitectOS design system (Obsidian/Brass/Parchment tokens, asymmetric layout — no default Tailwind grays, no Inter)
  6. **(Added 2026-07-01)** The Skills & Plugins workspace exists as a fourth intelligence peer at `/pro/intelligence/skills`, and `IntelligenceLanding.tsx`'s "three peers" copy is updated to reflect four
  7. **(Added 2026-07-01)** Virtual CSO's `ChatRail` has a working Chats/Skills toggle showing a condensed, correctly-scoped, browse-only skill list

**Refinement (added 2026-07-01, after completion report reviewed):** Two gaps identified against London's
actual intent, both traced to stale/incomplete plan inputs rather than execution errors — see
`phases/04-skill-creation-library-ui/04-04-PLAN.md`:
  8. The AI-guided flow's synthesis (04-02) no longer depends on an external N8N webhook — it calls
     Anthropic directly from the Python backend, per the revised `CLAUDE.md` Rule #1, so the guided
     conversation works without any external workflow being separately configured
  9. `ChatRail`'s skills view has a working search input and a "use skill" action that inserts `@slug`
     into the active compose textbox, in addition to (not instead of) the existing path to the full
     workspace

---

### Phase 5: Sandbox Infrastructure
**Goal:** A working, reachable code execution environment on GKE Autopilot, with the custom image and session persistence the document-generation and calculation use cases require.
**Depends on:** Nothing structurally — can run in parallel with Phases 1–4. Must complete before Phase 7.
**Requirements:** SANDBOX-01, SANDBOX-02, SANDBOX-04
**Success Criteria:**
  1. A single GKE Autopilot cluster is provisioned and reachable from the Railway Python backend
  2. `llm-sandbox`'s Kubernetes backend successfully creates, runs, and tears down a sandbox pod against that cluster
  3. The sandbox's container image includes pandas, python-docx, python-pptx, openpyxl, matplotlib, and numpy pre-installed
  4. A session's state (variables, imports) persists across at least two sequential calls within the same conversation thread
  5. Idle sessions are cleaned up after a defined TTL

---

### Phase 6: Artifacts & Delivery Experience
**Goal:** Generated files land somewhere durable and are surfaced to the founder in a way that matches the file's type — inline rendering for markdown/HTML, a download card for everything else.
**Depends on:** Phase 5 (sandbox must be able to produce files to deliver)
**Requirements:** ARTIFACT-01, ARTIFACT-02, ARTIFACT-03, ARTIFACT-04
**Success Criteria:**
  1. A shared `artifacts` Storage bucket and metadata table exist (storage path, created-at, source thread/session, description)
  2. Markdown/HTML sandbox output renders in the existing expandable right-hand panel — confirmed to be the same component used elsewhere, not a rebuilt one
  3. Non-renderable output (pptx, xlsx, csv, etc.) produces an inline chat card with a working signed download URL
  4. The `artifacts` table is confirmed schema-compatible with what the Domain Agents architecture will need when its live wiring lands (no Virtual-CSO-only assumptions baked into the schema)

---

### Phase 7: Sandbox Tool Integration (Virtual CSO)
**Goal:** Everything built in Phases 1–6 connects end to end on the Virtual CSO — a skill's instructions can trigger code execution, and the result reaches the founder through the right delivery path.
**Depends on:** Phases 1, 3, 4, 5, 6
**Requirements:** SANDBOX-03, FILE-02
**Success Criteria:**
  1. `execute_code` is registered as a tool available to the Virtual CSO
  2. `read_skill_file` returns attached skill file content to the LLM on demand
  3. A skill whose instructions call for code execution completes a full round trip: founder message → skill loaded → code executed in the sandbox → result delivered via the correct Phase 6 path (panel or chat card)
  4. A real-time calculation scenario (e.g., a founder asking for a number derived from an uploaded document) resolves within a latency budget appropriate to a synchronous chat turn, not a background job
  5. Tool call and result for this flow persist per Phase 2, and a follow-up question in the same thread can reference the result without re-execution

---

## Progress Tracker

| Phase | Status | Completed |
|---|---|---|
| 1. Skills Schema & Storage Foundation | **Done** | 2026-07-01 |
| 2. Persistent Tool Memory | **Done** | 2026-07-01 |
| 3. Skill Discovery & Routing | **Done** | 2026-07-01 |
| 4. Skill Creation & Skills Library UI | **Done** | 2026-07-01 |
| 5. Sandbox Infrastructure | **Done** | 2026-07-01 |
| 6. Artifacts & Delivery Experience | **Done** | 2026-07-02 |
| 7. Sandbox Tool Integration (Virtual CSO) | **Done** | 2026-07-02 |

---
*Roadmap created: 2026-07-01*
*7 phases, 20 v1 requirements traced (see REQUIREMENTS.md)*
*Domain Agents inheritance of this infrastructure is a forward-looking integration note, not a phase — see CONTEXT.md §10*
