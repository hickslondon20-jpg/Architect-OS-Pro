# Requirements: Knowledge Base Explorer — ArchitectOS Pro

**Defined:** 2026-06-28 (Ep2 Discuss Phase)
**Core Value:** The agent can navigate founder-uploaded documents the same way Claude Code navigates source files

## Adaptation Notes (vs. Reference ep2)

| Reference Requirement | ArchitectOS Decision |
|---|---|
| FOLDER-05: Global + per-user folders | **REMOVED** — per-user only; no user-visible global folders |
| UI-02: Visual distinction global vs per-user | **REMOVED** — no global tier to distinguish |
| All other requirements | Retained, adapted for ArchitectOS context |

---

## v1 Requirements

### Folder Structure

- [ ] **FOLDER-01**: User can create folders with unlimited nesting depth
- [ ] **FOLDER-02**: User can rename existing folders
- [ ] **FOLDER-03**: User can delete folders (cascades to all contents)
- [ ] **FOLDER-04**: User can move a folder to a different parent folder

> No FOLDER-05: ArchitectOS uses per-user folders only. Global IP content has separate architecture and is out of scope for this build.

### Document Management

- [ ] **DOC-01**: User can upload files into a specific folder
- [ ] **DOC-02**: User can move files between folders
- [ ] **DOC-03**: System stores full extracted markdown alongside chunks for each document

> "Documents" includes both user-uploaded files (PDF, DOCX, XLSX, transcripts, SOPs) and platform-synthesized wiki/markdown documents. Structured founder data (MRA, AE Ladder, sprints) is NOT stored here — it lives in Supabase tables and is accessed via direct query.

### KB Exploration Tools

- [ ] **TOOL-01**: Agent can use `ls(path)` to list files and subfolders in a folder
- [ ] **TOOL-02**: Agent can use `tree(path, depth?, limit?)` to get hierarchical structure with depth limit and truncation
- [ ] **TOOL-03**: Agent can use `grep(pattern, path?)` to regex search extracted markdown content, returns matching document names
- [ ] **TOOL-04**: Agent can use `glob(pattern)` to match filenames by pattern (e.g., `*.pdf`, `reports/**/*`)
- [ ] **TOOL-05**: Agent can use `read(document_id)` to read full document content
- [ ] **TOOL-06**: Agent can use `read(document_id, start_line, end_line)` to read specific line range

> All tools must respect per-user RLS — agents only access the authenticated founder's folders and documents.

### Explorer Sub-Agent

- [ ] **AGENT-01**: Explorer sub-agent has access to all KB tools (ls, tree, grep, glob, read)
- [ ] **AGENT-02**: Explorer sub-agent can invoke the existing document analysis sub-agent for deep document analysis
- [ ] **AGENT-03**: Explorer sub-agent returns synthesized findings, not raw tool output

### Ingestion Interface

- [ ] **UI-01**: Ingestion interface displays folder tree with navigable hierarchy
- [ ] **UI-03**: User can create, rename, and delete folders via UI
- [ ] **UI-04**: File upload targets the currently selected folder

> No UI-02: No global vs per-user visual distinction needed.
> UI work in Phase 3 must preserve and extend the existing `UploadsView.tsx` — not replace it. Requires co-creation alignment checkpoint before execution.

---

## v2 Requirements (Deferred)

Not in current roadmap. Tracked to prevent scope creep.

| Requirement | Description | Deferred reason |
|---|---|---|
| AGENT-02 | Explorer sub-agent can invoke the document analysis sub-agent | `can_spawn_agents=False` in Phase 7 by design; blocked by `get_for_surface()` guard; requires separate capability dispatch pattern. Re-evaluate post-Phase 9. |
| FOLDER-06 | Drag-and-drop folder reordering | UX complexity; no beta demand |
| FOLDER-07 | Folder creation from templates/presets | Nice-to-have post-beta |
| DOC-04 | Bulk-move multiple files | Low beta priority |
| DOC-05 | Copy files to another folder | Low beta priority |
| TOOL-07 | `head(document_id, n)` — first n lines | Covered by `read` with range |
| TOOL-08 | `tail(document_id, n)` — last n lines | Covered by `read` with range |
| TOOL-09 | `ls` with content preview per file | Nice-to-have; cost vs value TBD |
| AGENT-04 | Explorer sub-agent caches exploration state across calls | Complexity; no beta demand |
| UI-05 | Search within folder tree | Post-beta |
| UI-06 | Keyboard navigation of folder tree | Post-beta |
| IMPORT-01 | Select local folder for automatic import | Post-beta |
| IMPORT-02 | Recursive local folder import maintaining structure | Post-beta |

---

## Out of Scope

| Feature | Reason |
|---|---|
| Global user-created folders | Per-user only; no team accounts in beta |
| Team-based folder sharing | Beta is founder-only; no team member accounts |
| Global IP / skill packs in KB tree | Separate architecture; own iteration phase |
| Structured data in folder tree (MRA, AE Ladder, sprints) | Lives in Supabase tables; agents query directly |
| Folder-level permissions beyond per-user | Per-user only; no granular permission model needed |
| Real-time collaboration on folders | Not relevant for single-founder beta |
| Searching raw uploaded files | Only extracted markdown is searchable (Docling pipeline required) |

---

## Requirement Traceability

| Requirement | Phase | Plans |
|---|---|---|
| FOLDER-01 | Phase 1 | 01-01-PLAN.md |
| FOLDER-02 | Phase 1 | 01-02-PLAN.md |
| FOLDER-03 | Phase 1 | 01-01-PLAN.md, 01-02-PLAN.md |
| FOLDER-04 | Phase 2 | 02-04-PLAN.md |
| DOC-01 | Phase 2 | 02-02-PLAN.md |
| DOC-02 | Phase 2 | 02-04-PLAN.md |
| DOC-03 | Phase 2 | 02-03-PLAN.md |
| TOOL-01 | Phase 4 | 04-01-PLAN.md, 04-02-PLAN.md |
| TOOL-02 | Phase 4 | 04-01-PLAN.md, 04-02-PLAN.md |
| TOOL-03 | Phase 5 | 05-01-PLAN.md, 05-02-PLAN.md |
| TOOL-04 | Phase 5 | 05-01-PLAN.md, 05-02-PLAN.md |
| TOOL-05 | Phase 6 | 06-01-PLAN.md, 06-02-PLAN.md |
| TOOL-06 | Phase 6 | 06-01-PLAN.md, 06-02-PLAN.md |
| AGENT-01 | Phase 7 | 07-01-PLAN.md |
| AGENT-02 | Phase 7 | 07-01-PLAN.md |
| AGENT-03 | Phase 7 | 07-01-PLAN.md, 07-02-PLAN.md |
| UI-01 | Phase 3 | 03-01-PLAN.md, 03-02-PLAN.md |
| UI-03 | Phase 3 | 03-02-PLAN.md |
| UI-04 | Phase 3 | 03-03-PLAN.md |

**Coverage:** 18 v1 requirements (vs. 21 in reference — 3 removed: FOLDER-05, UI-02, and one global doc requirement)

---
*Requirements defined: 2026-06-28*
*Adapted from ep2 reference: FOLDER-05 and UI-02 removed (per-user only model)*
