import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import type { FolderTreeNode, KnowledgePage, RawDocument } from '../../../../lib/osEngineApi';
import { FileNode } from './FileNode';
import { InlineNameInput } from './InlineNameInput';
import type { KbContextMenuTarget } from './KbContextMenu';

interface FolderNodeProps {
  folder: FolderTreeNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isRenaming: boolean;
  renamingId: string | null;
  creatingIn: string | null | 'root';
  docs: RawDocument[];
  expandedIds: Set<string>;
  selectedFolderId: string | null;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onContextMenu: (event: React.MouseEvent, target: KbContextMenuTarget) => void;
  onRenameStart: (id: string) => void;
  onRenameConfirm: (id: string, name: string) => void;
  onRenameCancel: () => void;
  onCreateConfirm: (name: string, parentId: string | null) => void;
  onCreateCancel: () => void;
  onDeleteFolder: (id: string) => void;
  onOpenDoc: (doc: RawDocument) => void;
  onDeleteDoc: (docId: string) => Promise<void>;
  pages: KnowledgePage[];
}

export const FolderNode: React.FC<FolderNodeProps> = ({
  folder,
  depth,
  isExpanded,
  isSelected,
  isRenaming,
  renamingId,
  creatingIn,
  docs,
  expandedIds,
  selectedFolderId,
  onToggleExpand,
  onSelect,
  onContextMenu,
  onRenameStart,
  onRenameConfirm,
  onRenameCancel,
  onCreateConfirm,
  onCreateCancel,
  onDeleteFolder,
  onOpenDoc,
  onDeleteDoc,
  pages,
}) => {
  const [hovered, setHovered] = useState(false);
  const docsInFolder = useMemo(() => docs.filter((doc) => doc.folderId === folder.id || doc.folder_id === folder.id), [docs, folder.id]);
  const FolderIcon = isExpanded ? FolderOpen : Folder;

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm transition-colors ${
          isSelected ? 'bg-[var(--bg-canvas)] text-[var(--aos-brass)]' : 'text-[var(--fg-1)] hover:bg-[var(--bg-canvas)]'
        }`}
        style={{ paddingLeft: depth * 16 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          onToggleExpand(folder.id);
          onSelect(folder.id);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onContextMenu(event, { type: 'folder', folderId: folder.id, folderName: folder.name });
        }}
      >
        {isExpanded ? (
          <ChevronDown size={14} className="flex-shrink-0 text-[var(--fg-3)]" />
        ) : (
          <ChevronRight size={14} className="flex-shrink-0 text-[var(--fg-3)]" />
        )}
        <FolderIcon size={14} className="flex-shrink-0 text-[var(--fg-3)]" />
        {isRenaming ? (
          <InlineNameInput
            initialValue={folder.name}
            onConfirm={(name) => onRenameConfirm(folder.id, name)}
            onCancel={onRenameCancel}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate font-medium">{folder.name}</span>
        )}
        {!isRenaming && (
          <div className={`ml-auto flex items-center gap-0.5 ${hovered ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
            <button
              type="button"
              title="Rename"
              className="rounded-md p-1 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--fg-1)]"
              onClick={(event) => {
                event.stopPropagation();
                onRenameStart(folder.id);
              }}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              title="Delete"
              className="rounded-md p-1 text-[var(--fg-3)] transition-colors hover:bg-[var(--aos-risk-tint)] hover:text-[var(--aos-risk)]"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteFolder(folder.id);
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {isExpanded && (
        <>
          {creatingIn === folder.id && (
            <div className="py-1" style={{ paddingLeft: (depth + 1) * 16 }}>
              <InlineNameInput
                placeholder="Folder name"
                onConfirm={(name) => onCreateConfirm(name, folder.id)}
                onCancel={onCreateCancel}
              />
            </div>
          )}
          {folder.children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              isExpanded={expandedIds.has(child.id)}
              isSelected={selectedFolderId === child.id}
              isRenaming={renamingId === child.id}
              renamingId={renamingId}
              creatingIn={creatingIn}
              docs={docs}
              expandedIds={expandedIds}
              selectedFolderId={selectedFolderId}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onRenameStart={onRenameStart}
              onRenameConfirm={onRenameConfirm}
              onRenameCancel={onRenameCancel}
              onCreateConfirm={onCreateConfirm}
              onCreateCancel={onCreateCancel}
              onDeleteFolder={onDeleteFolder}
              onOpenDoc={onOpenDoc}
              onDeleteDoc={onDeleteDoc}
              pages={pages}
            />
          ))}
          {docsInFolder.map((doc) => (
            <FileNode key={doc.id} doc={doc} depth={depth + 1} pages={pages} onOpenDoc={onOpenDoc} onDeleteDoc={onDeleteDoc} />
          ))}
          {folder.children.length === 0 && docsInFolder.length === 0 && creatingIn !== folder.id && (
            <div className="px-2 py-1 text-xs text-[var(--fg-4)]" style={{ paddingLeft: (depth + 1) * 16 }}>
              Empty folder
            </div>
          )}
        </>
      )}
    </div>
  );
};
