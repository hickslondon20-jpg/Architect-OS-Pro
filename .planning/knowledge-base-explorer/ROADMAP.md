# Roadmap: Knowledge Base Explorer â€” ArchitectOS Pro

## Overview

Delivers a Claude Code-inspired exploration layer on top of ArchitectOS's existing Python/FastAPI + Supabase intelligence infrastructure. Starts with a per-user folder schema, connects documents to that schema, extends the existing ingestion UI, then builds out the full KB navigation and search tool suite (ls, tree, grep, glob, read), culminating in an Explorer sub-agent that orchestrates them all for the Virtual CSO, Domain Agents, and OS Engine.

## Process Rules

- **One phase at a time.** Each phase completes fully before the next begins.
- **Alignment checkpoint between phases.** Discuss phase specs, UI elements, and any cross-cutting concerns before execution agent spins up.
- **Phase 3 is a co-creation pass.** Existing `UploadsView.tsx` must be preserved and extended â€” not replaced.
- **Execution agents are separate threads.** Each phase runs in a dedicated execution agent pointed at the phase plan files.

---

## Phases

- [x] **Phase 1: Folder Schema & Core APIs** - Database foundation + FastAPI CRUD
- [x] **Phase 2: Document-Folder Integration** â€” Connect docs to folders; store full markdown
- [x] **Phase 3: Ingestion UI** â€” Extend existing UploadsView with folder tree + folder-targeted uploads
- [x] **Phase 4: Navigation Tools** â€” ls and tree tools for agent folder browsing
- [x] **Phase 5: Search Tools** â€” grep and glob tools for content and filename search
- [x] **Phase 6: Read Tool** â€” Full document and line-range reading capability
- [x] **Phase 7: Explorer Sub-Agent** â€” Orchestration agent with all KB tools

---

## Phase Details

### Phase 1: Folder Schema & Core APIs
**Goal:** Database foundation and CRUD API for per-user nested folders
**Depends on:** Nothing (first phase)
**Requirements:** FOLDER-01, FOLDER-02, FOLDER-03
**Success Criteria:**
  1. `kb_folders` table exists with adjacency list structure (parent_id)
  2. User can create a folder at any nesting depth via API
  3. User can rename an existing folder via API
  4. User can delete a folder â€” cascades to all child folders and documents
  5. RLS policies enforce per-user isolation (users see only their own folders)
  6. All endpoints authenticated via Supabase JWT
**Plans:** 2

- [x] 01-01-PLAN.md - Database schema: `kb_folders` table, indexes, cascade rules, RLS policies, migration file
- [x] 01-02-PLAN.md - FastAPI CRUD endpoints: create, rename, delete, list folders

---

### Phase 2: Document-Folder Integration
**Goal:** Documents live in folders; full extracted markdown stored for grep/read; folders moveable
**Depends on:** Phase 1
**Requirements:** FOLDER-04, DOC-01, DOC-02, DOC-03

> **Alignment checkpoint complete (2026-06-28).** Wiki system is out of scope — Phase 2 is tightly scoped to raw uploaded documents only. `folder_id` is per-user only; `full_markdown` stored from Docling extracted text; `ON DELETE SET NULL` cascade on folder delete.

**Success Criteria:**
  1. Upload endpoint accepts `folder_id` parameter
  2. User can move a document from one folder to another via API
  3. User can move a folder (with all contents) to a different parent via API (cycle prevention enforced)
  4. Full extracted markdown stored alongside chunks for each document
**Plans:** 4

- [x] 02-01-PLAN.md â€” DB schema: `folder_id` + `full_markdown` columns, cycle prevention trigger
- [x] 02-02-PLAN.md â€” Upload endpoint: add `folder_id` targeting
- [x] 02-03-PLAN.md â€” Ingestion service: store full markdown during Docling processing
- [x] 02-04-PLAN.md â€” Move endpoints: move document, move folder

---

### Phase 3: Ingestion UI
**Goal:** Founders can visually manage folder hierarchy and upload files to specific folders
**Depends on:** Phase 2
**Requirements:** UI-01, UI-03, UI-04

> **Co-creation checkpoint complete (2026-06-28).** Layout: folder tree replaces flat doc table BELOW the upload zone in main content area — NOT a left panel. View model: inline-expand filesystem tree. Root is virtual (“Knowledge Base”); `folder_id = NULL` = root. Upload targeting via `folderId` on `onUpload`. CRUD: hover icons + portaled right-click context menu. UploadsView is extended, not replaced.

**Success Criteria:**
  1. Ingestion interface displays a navigable folder tree (per-user only)
  2. User can create, rename, and delete folders from the UI
  3. File upload targets the currently selected folder
  4. Existing uploads list and functionality is preserved
**Plans:** 3

- [x] 03-01-PLAN.md — Foundation: API client functions, Folder TypeScript types, folder state management
- [x] 03-02-PLAN.md — Folder tree components: FolderTree, FolderNode, context menu, inline edit/rename
- [x] 03-03-PLAN.md — Integration: extend UploadsView with folder tree panel + folder-targeted upload

---

### Phase 4: Navigation Tools
**Goal:** Agent can browse the folder structure like a filesystem
**Depends on:** Phase 1 (folder schema)
**Requirements:** TOOL-01, TOOL-02
**Success Criteria:**
  1. Agent can call `ls(path)` and receive list of files and subfolders in that path
  2. Agent can call `tree(path, depth, limit)` and receive hierarchical structure with depth truncation
  3. Tool outputs respect per-user RLS â€” agent only sees authenticated founder's content
**Plans:** 2

- [x] 04-01-PLAN.md â€” Backend: `folder_navigation.py` service with `execute_ls` and `execute_tree` functions
- [x] 04-02-PLAN.md â€” Tool definitions + executor integration for agent access

---

### Phase 5: Search Tools
**Goal:** Agent can search documents by content pattern and filename pattern
**Depends on:** Phase 2 (full markdown stored), Phase 4 (folder schema)
**Requirements:** TOOL-03, TOOL-04
**Success Criteria:**
  1. Agent can call `grep(pattern, path?)` and receive matching document names
  2. Agent can call `glob(pattern)` and receive documents matching filename pattern
  3. grep searches extracted markdown content (not raw files)
  4. glob supports patterns like `*.pdf` and `reports/**/*`
**Plans:** 2

- [x] 05-01-PLAN.md — Backend: `execute_grep` and `execute_glob` functions in `folder_navigation.py`
- [x] 05-02-PLAN.md — Tool definitions + executor integration

---

### Phase 6: Read Tool
**Goal:** Agent can read document content in full or by line range
**Depends on:** Phase 2 (full markdown stored)
**Requirements:** TOOL-05, TOOL-06
**Success Criteria:**
  1. Agent can call `read(document_id)` and receive full document markdown
  2. Agent can call `read(document_id, start_line, end_line)` and receive specific lines
  3. Line numbers based on newline splits in extracted markdown
**Plans:** 2

- [x] 06-01-PLAN.md â€” Backend: `execute_read` function in `folder_navigation.py`
- [x] 06-02-PLAN.md â€” Tool definition + executor integration

---

### Phase 7: Explorer Sub-Agent
**Goal:** A sub-agent that orchestrates KB exploration for complex research tasks
**Depends on:** Phase 4, Phase 5, Phase 6 (all KB tools)
**Requirements:** AGENT-01, AGENT-02, AGENT-03
**Success Criteria:**
  1. Explorer sub-agent has access to ls, tree, grep, glob, and read tools
  2. Explorer sub-agent can invoke the existing document analysis sub-agent
  3. Explorer sub-agent returns synthesized findings â€” not raw tool output
  4. Virtual CSO, Domain Agents, and OS Engine can delegate KB exploration to the sub-agent
**Plans:** 3

- [x] 07-01-PLAN.md â€” Explorer agent service: internal tool loop, streaming events
- [x] 07-02-PLAN.md â€” Tool definition + executor integration for main agent delegation
- [x] 07-03-PLAN.md â€” Chat router: event handling for explorer sub-agent streaming events

---

---

### Phase 8: Intelligence Layer Connection
**Goal:** Wire the compiled wiki layers (Layer 1 + Layer 2) into the KB Explorer sub-agent
and the Virtual CSO. Phase 8A adds wiki tools to the KB Explorer tool loop. Phase 8B mirrors
compiled Layer 1 pages into ose_knowledge_pages so both wiki layers surface in the Virtual CSO.
**Depends on:** Phases 1–7 (KB Explorer complete); Layer 1 wiki system (sub-phase 07 done); Layer 2 Document Wiki (sub-phase 07 done)
**Architectural reference:** `.planning/INTELLIGENCE-VISION.md` (Tier 1 and Tier 3 sections); `CONTEXT.md` in this phase directory
**What was built:**
- 8A: `wiki_search`, `wiki_get_page`, `wiki_list` tools added to `kb_explorer_service.py`
- 8B: `_project_to_ose()` in `wiki_compilation.py` mirrors Layer 1 compiled pages into `ose_knowledge_pages`
- CORE_PAGE_KEYS in `chat.ts` expanded to include all 7 Layer 1 page keys
- `doc_wiki_schema.json` updated with `wiki_layer1` vocabulary
**Deferred:** DL-L1-EMBED (embedding for projected Layer 1 pages); 8C semantic selection upgrade (Phase 9 dependency)
**Status:** Done — 2026-07-01 — smoke tests passed; 4/4 checks green

---

### Phase 9: Retrieval Router + Chat Experience
**Goal:** Three things together: (9A) a keyword-heuristic intent classifier in the Virtual CSO
streaming endpoint that decides when to invoke the KB Explorer and injects its result into the
synthesis prompt; (9B) a chat UI redesign that removes assistant message bubbles (full-width
conversation text, Claude.ai-style); and (9C) a nested sub-agent reasoning display that shows
KB Explorer tool steps inline in the assistant message as a collapsible "thinking" panel.
**Depends on:** Phase 8 (wiki layer + KB Explorer wired before routing to them is meaningful)
**Architectural reference:** `INTELLIGENCE-VISION.md` — Retrieval Router section; phase artifacts in `.planning/knowledge-base-explorer/phases/09-retrieval-router/`
**Key deliverables:**
- 9A — Intent heuristic in `api/vcso/chat.ts`: keyword patterns detect document/KB questions; if triggered, call Python backend `/api/agent-runs` with `kb_explorer_agent` capability; inject KB result into synthesis prompt; 10-second timeout safety net
- 9A — `Message` type gains optional `agentSteps` field (client-side only for beta; not persisted to Supabase)
- 9B — `MessageBubble.tsx` refactored: user messages stay in right-aligned slate bubble; assistant messages become full-width un-bubbled conversation text (no border, no shadow, no background container)
- 9C — `AgentStepsPanel` component: collapsible "KB Explorer used N tools" header + expandable step list showing tool name, input summary, one-line output; appears above assistant text when agentSteps are present
- Routing notice updated: replaces the current bottom-bar notice with inline display
**Deferred from Phase 9:** DL-L1-EMBED (embedding for Layer 1 projected pages); 8C semantic selection upgrade; AGENT-02 sub-agent delegation (v2 deferral, tracked in REQUIREMENTS.md)
**Deviations from spec:** Backend trace uses `tool_name`, `input_summary`, `output_summary` field names (not `tool`/`input`/`output`); `callKbExplorer()` adapted with multi-field fallback coverage.
**Status:** Done — 2026-07-01 — 14/14 smoke tests green

---

## Progress Tracker

| Phase | Plans Complete | Status | Completed |
|---|---|---|---|
| 1. Folder Schema & Core APIs | 2/2 | Complete | 2026-06-28 |
| 2. Document-Folder Integration | 4/4 | Complete | 2026-06-28 |
| 3. Ingestion UI | 3/3 | Complete | 2026-06-28 |
| 4. Navigation Tools | 2/2 | Complete | 2026-06-28 |
| 5. Search Tools | 2/2 | Complete | 2026-06-28 |
| 6. Read Tool | 2/2 | Complete | 2026-06-28 |
| 7. Explorer Sub-Agent | 3/3 | Complete | 2026-06-28 |
| 8. Intelligence Layer Connection | 0 plan files (directly implemented) | Done | 2026-07-01 |
| 9. Retrieval Router + Chat Experience | 0 plan files (directly implemented) | Done | 2026-07-01 |

---
*Roadmap created: 2026-06-28*
*18/18 v1 requirements mapped across 7 phases, 18 total plans*
*Phase 8–9 architecture documented in `.planning/INTELLIGENCE-VISION.md`*
