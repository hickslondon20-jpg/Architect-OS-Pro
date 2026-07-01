# KB Explorer — Phase 3 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the execution agent for Phase 3 of the ArchitectOS Knowledge Base Explorer build. Your job is to implement exactly what the plan files specify — no more, no less. If you encounter something that requires a decision outside the plans, stop and flag it rather than improvising.

## Read These Files First — In This Order

1. `.planning/PROJECT.md` — what we're building and why
2. `.planning/phases/03-ingestion-ui/CONTEXT.md` — ALL UI decisions; read this with full attention
3. `.planning/phases/03-ingestion-ui/03-01-PLAN.md` — types, API client, hook
4. `.planning/phases/03-ingestion-ui/03-02-PLAN.md` — FolderTree components
5. `.planning/phases/03-ingestion-ui/03-03-PLAN.md` — UploadsView integration
6. `components/pro-suite/os-engine/views/UploadsView.tsx` — the component you are extending
7. `lib/osEngineApi.ts` — the API client you are extending
8. `types.ts` — check RawDocument for folderId field
9. Run: `grep -r "UploadsView" src/ --include="*.tsx" -l` — find and read the parent component

Do not begin implementation until you have read all of the above.

## What Phase 3 Builds

Three things, in this order:

**Plan 03-01 (first):** TypeScript `KbFolder` type, `FolderTreeNode` type, `buildFolderTree` utility, API client functions (`listFolders`, `createFolder`, `renameFolder`, `deleteFolder`, `moveDocument`, `moveFolder`), and `useKbFolderTree` hook.

**Plan 03-02 (after 03-01):** Five components in `components/pro-suite/os-engine/kb/`:
- `InlineNameInput.tsx` — shared inline input for create/rename
- `KbContextMenu.tsx` — portaled right-click context menu
- `FolderNode.tsx` — folder row with expand/collapse, hover icons, recursive children
- `FileNode.tsx` — file row with inline metadata expand and delete confirmation
- `FolderTree.tsx` — outer container with root header, all nodes, "+ New folder" button

**Plan 03-03 (after 03-02):** Wire everything together:
- Extend `UploadsView.tsx` props (new folder props + updated `onUpload` signature)
- Replace the flat `<Table>` with `<FolderTree>`
- Add upload zone folder badge
- Update parent component to use `useKbFolderTree` and pass props down

## Critical Context — Read This Carefully

**Layout is NOT a left panel.** The folder tree goes BELOW the upload zone, inside the main content area. The existing `<h1>`, description, and drag-and-drop upload zone stay exactly where they are. The `<Table>` that currently shows docs is replaced by `<FolderTree>`.

**Root is virtual.** "Knowledge Base" is the root display label. It is not a DB row. `folder_id = NULL` on a document means it lives at root level. Do not create any implicit root folder in the DB.

**`UploadsView` is preserved and extended** — NOT replaced. The upload zone, drag-and-drop, Browse files, StatusPill, `onOpenDoc`, connected pages display all survive. You are removing the flat `<Table>` and the per-row state (`confirmingId`, `expandedId`) from `UploadsView` — those behaviors move into `FileNode`.

**Context menu MUST be portaled** via `ReactDOM.createPortal(menu, document.body)`. This is non-negotiable — the parent containers have overflow constraints that will clip a non-portaled menu.

**AOS design tokens only.** No Tailwind default grays (`gray-100`, `gray-900`, etc.). No `#000` or `#111`. No `background: linear-gradient(...)` on text. No box-shadow glow effects. Use `var(--aos-*)` and `var(--bg-*)` and `var(--fg-*)` tokens throughout. See `DESIGN-GUIDE-QUICK.md` in the repo root for the full token list.

**Lucide icons only** (already a project dependency). Pick the closest semantic match from what's already imported in `UploadsView.tsx` or standard Lucide icons. For folder: `Folder` / `FolderOpen`. For root: `Database` or `Layers`.

## What Phase 3 Does NOT Build

- No wiki folder tree (completely separate system)
- No drag-and-drop file moving between folders
- No move UI for documents or folders (API is wired, UI is Phase 4+)
- No mobile layout
- No changes to Manifest, Log, Index, or Wiki views
- No changes to ingestion pipeline or Python backend

## Execution Order

1. **03-01** — types, API client, hook (foundation for everything)
2. **03-02** — components (depends on types from 03-01)
3. **03-03** — integration (depends on all of the above)

Run all verification steps for each plan before starting the next.

## Key Files You Will Create

```
components/pro-suite/os-engine/kb/
  FolderTree.tsx
  FolderNode.tsx
  FileNode.tsx
  KbContextMenu.tsx
  InlineNameInput.tsx

hooks/useKbFolderTree.ts      (or lib/ depending on project convention)
lib/kbFolderUtils.ts          (buildFolderTree + shared helper functions)
```

## Key Files You Will Modify

```
lib/osEngineApi.ts                                       — add 6 API functions
types.ts                                                 — add KbFolder, FolderTreeNode; confirm RawDocument.folderId
components/pro-suite/os-engine/views/UploadsView.tsx     — extend props, replace table with FolderTree
[parent component — find with grep]                      — add hook, update onUpload, pass new props
```

## When You're Done

Update `.planning/STATE.md`:
- Mark all three Phase 3 plans complete in a Phase 3 checklist
- Log any execution decisions not explicitly in the plans
- Set "Current focus" to: "Phase 3 complete — awaiting Phase 3→4 alignment checkpoint"

Update `.planning/ROADMAP.md`:
- Mark all three Phase 3 plan files complete (`[x]`)
- Update Phase 3 progress row: `3/3` plans complete, status `Complete`, add today's date

Then stop. Phase 4 (Navigation Tools — ls and tree backend) does not require a heavy co-creation checkpoint, but the strategy thread will review Phase 3 results and confirm scope before Phase 4 begins.

## If You Hit a Blocker

Stop and describe:
- What you expected per the plan
- What you found instead
- What decision is needed to proceed

Do not improvise past a blocker. Do not redesign the layout. Do not swap out components. Flag and wait.
