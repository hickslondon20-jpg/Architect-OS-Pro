# Phase 3 Alignment Context — Ingestion UI

> Decisions locked in co-creation checkpoint, 2026-06-28.
> Phase 3 execution agent must read this before touching any file.

---

## What Phase 3 Builds

A filesystem-tree view of the founder's uploaded documents, living inside the existing `UploadsView.tsx` below the upload zone. No left-panel split. No separate table. The folder tree replaces the flat doc table and renders folders and files interleaved in a single inline-expand structure.

---

## Layout Decision

**Single-column, below the upload zone.** The upload zone (drag-and-drop + Browse files button) stays exactly where it is. The space below it — currently showing "No files uploaded yet" — becomes the folder+file tree.

```
UPLOADS
[description]

[Upload zone — unchanged]

[FolderTree — replaces the flat table entirely]
  📁 Knowledge Base (virtual root)
  ├─ 📁 Client Docs        ✏️ 🗑️ (hover icons)
  │   ├─ 📁 Q1 Decks
  │   └─ 📄 proposal.pdf   [status] [actions]
  │       └─ [expand: metadata panel]
  ├─ 📁 Internal
  └─ 📄 brief.docx         [status] [actions]
      └─ [expand: metadata panel]
```

**NOT a two-panel left/right split.** The tree is full-width inside the main content area.

---

## View Model

- **Inline expand**: Clicking a folder node expands it in place to reveal subfolders and files. No separate table that "filters" — the tree IS the view.
- **Default state**: Folder structure shown. Root-level folders collapsed until clicked.
- **"All Files" / root**: A "Knowledge Base" root node at the top. Clicking it (or when nothing else is selected) shows all docs flattened in a scannable list — folder groupings still shown as section headers. This is the fallback/reset state.
- **File rows**: Each file row in the tree retains the existing expand-for-metadata behavior (the same content as the existing expanded `TableRow`). The metadata panel appears as an indented block directly below the file row.
- **Delete confirmation**: Appears inline below the file row (same "Type DELETE to confirm" pattern), replaces the file row temporarily.

---

## Root Folder / "Unfiled" Decision

- **Root is virtual** — not a database row. `folder_id = NULL` on a document means "root level."
- **No "Unfiled" bucket** — docs uploaded without a folder selected land at root level and display there naturally.
- **Upload without folder** → `folderId: undefined` → frontend passes no folder_id → doc appears at root.
- **Display label**: "Knowledge Base" is the root node label (matches existing `kb_` naming convention).

---

## Folder CRUD UX

- **Hover-reveal icons**: Each folder row shows pencil (rename) and trash (delete) icons on hover.
- **Right-click context menu**: Also available. Options: Create subfolder, Rename, Delete.
- **Both are required** — not either/or.
- **Context menu must be portaled** (rendered into `document.body` via `ReactDOM.createPortal`) to avoid z-index and overflow clipping issues with the table/card containers.
- **Inline rename**: Clicking the pencil icon or "Rename" in context menu replaces the folder name with an `<input>` in place. `Enter` confirms, `Escape` cancels.

---

## New Folder Creation

- **"+ New folder" button**: Lives at the bottom of the tree panel (or below the last root-level item). Creates a new folder at root level. On click: inserts a new inline input at root level to type the name. `Enter` confirms, `Escape` cancels.
- **New subfolder from context menu**: Right-click on a folder → "New subfolder" → inline input appears as first child of that folder (expanded if not already). `Enter` confirms.
- **No drag-and-drop** in Phase 3. Move via the API endpoints (built in Phase 2) is not exposed in the UI yet — that can come later.

---

## Upload Targeting

- When a folder is selected (expanded and active), the upload zone shows a badge: "Uploading to: [Folder Name]".
- Uploading while a folder is selected → `onUpload(file, selectedFolderId)` — passes the folder ID.
- Uploading at root (no folder selected, or "Knowledge Base" selected) → `onUpload(file, null)`.
- The `onUpload` prop signature in `UploadsView` must be updated: `(file: File, folderId?: string | null) => Promise<void>`.

---

## Component Scope

### New files to create:
```
components/pro-suite/os-engine/kb/
  FolderTree.tsx         — outer container, renders root + All Files header
  FolderNode.tsx         — single folder row with expand/collapse, hover icons
  FileNode.tsx           — single file row + inline metadata expand + delete confirm
  KbContextMenu.tsx      — portaled right-click context menu
  InlineNameInput.tsx    — shared inline name input (create + rename)
```

### New hook:
```
hooks/useKbFolderTree.ts  — or lib/useKbFolderTree.ts depending on project convention
```

### Files to modify:
- `lib/osEngineApi.ts` — add KB folder API client functions
- `components/pro-suite/os-engine/views/UploadsView.tsx` — replace flat table with FolderTree; update onUpload signature
- Parent component that renders `<UploadsView>` — pass folder state + handlers; execution agent must locate this

---

## What Phase 3 Does NOT Build

- No wiki folder tree (separate system)
- No drag-and-drop reordering or moving (Phase 3 exposes no move UI)
- No mobile layout
- No Manifest or Log changes (separate concern)
- No changes to ingestion pipeline or backend

---

## Preservation Requirements

The following existing behaviors must survive Phase 3 unchanged:
- Drag-and-drop upload (the drop zone)
- Browse files button
- Status pills
- Metadata expand panel (type, area, period, confidence, metrics, entities, parser info)
- Delete confirmation flow (type "DELETE" to confirm)
- Connected pages display
- `onOpenDoc` handler (View button / filename click)
- All existing props on `UploadsView` except `onUpload` (which gets an extended signature)
