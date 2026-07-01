import React, { useMemo, useState } from 'react';
import { Database, Plus } from 'lucide-react';
import type { FolderTreeNode, KnowledgePage, RawDocument } from '../../../../lib/osEngineApi';
import { FileNode } from './FileNode';
import { FolderNode } from './FolderNode';
import { InlineNameInput } from './InlineNameInput';
import { KbContextMenu, type KbContextMenuTarget } from './KbContextMenu';

interface FolderTreeProps {
  tree: FolderTreeNode[];
  docs: RawDocument[];
  pages: KnowledgePage[];
  selectedFolderId: string | null;
  expandedIds: Set<string>;
  onSelectFolder: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onOpenDoc: (doc: RawDocument) => void;
  onDeleteDoc: (docId: string) => Promise<void>;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  tree,
  docs,
  pages,
  selectedFolderId,
  expandedIds,
  onSelectFolder,
  onToggleExpand,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onOpenDoc,
  onDeleteDoc,
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null | 'root'>(null);
  const [contextMenu, setContextMenu] = useState<{
    target: KbContextMenuTarget;
    position: { x: number; y: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rootDocs = useMemo(() => docs.filter((doc) => !doc.folderId && !doc.folder_id), [docs]);

  const handleContextMenu = (event: React.MouseEvent, target: KbContextMenuTarget) => {
    setContextMenu({ target, position: { x: event.clientX, y: event.clientY } });
  };

  const handleCreateSubfolder = (parentId: string | null) => {
    setCreatingIn(parentId ?? 'root');
    if (parentId && !expandedIds.has(parentId)) {
      onToggleExpand(parentId);
    }
    setContextMenu(null);
  };

  const handleCreateConfirm = async (name: string, parentId: string | null) => {
    setError(null);
    try {
      await onCreateFolder(name, parentId);
      setCreatingIn(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create folder.');
    }
  };

  const handleRenameConfirm = async (id: string, name: string) => {
    setError(null);
    try {
      await onRenameFolder(id, name);
      setRenamingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename folder.');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    setContextMenu(null);
    if (!window.confirm('Delete this folder and its subfolders? Files in this folder move back to Knowledge Base.')) return;
    setError(null);
    try {
      await onDeleteFolder(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete folder.');
    }
  };

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-soft-1)]">
      <div
        className={`flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-2 text-sm transition-colors ${
          selectedFolderId === null ? 'bg-[var(--bg-canvas)] text-[var(--aos-brass)]' : 'text-[var(--fg-1)] hover:bg-[var(--bg-canvas)]'
        }`}
        onClick={() => onSelectFolder(null)}
        onContextMenu={(event) => {
          event.preventDefault();
          handleContextMenu(event, { type: 'root' });
        }}
      >
        <Database size={14} className="text-[var(--fg-3)]" />
        <span className="font-semibold">Knowledge Base</span>
        <span className="aos-mono ml-auto text-xs text-[var(--fg-3)]">{docs.length} files</span>
      </div>

      {selectedFolderId === null && rootDocs.map((doc) => (
        <FileNode key={doc.id} doc={doc} depth={1} pages={pages} onOpenDoc={onOpenDoc} onDeleteDoc={onDeleteDoc} />
      ))}

      {tree.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          depth={1}
          isExpanded={expandedIds.has(folder.id)}
          isSelected={selectedFolderId === folder.id}
          isRenaming={renamingId === folder.id}
          renamingId={renamingId}
          creatingIn={creatingIn}
          docs={docs}
          expandedIds={expandedIds}
          selectedFolderId={selectedFolderId}
          onToggleExpand={onToggleExpand}
          onSelect={onSelectFolder}
          onContextMenu={handleContextMenu}
          onRenameStart={(id) => {
            setRenamingId(id);
            setContextMenu(null);
          }}
          onRenameConfirm={handleRenameConfirm}
          onRenameCancel={() => setRenamingId(null)}
          onCreateConfirm={handleCreateConfirm}
          onCreateCancel={() => setCreatingIn(null)}
          onDeleteFolder={handleDeleteFolder}
          onOpenDoc={onOpenDoc}
          onDeleteDoc={onDeleteDoc}
          pages={pages}
        />
      ))}

      {creatingIn === 'root' && (
        <div className="py-1 pl-4">
          <InlineNameInput
            placeholder="Folder name"
            onConfirm={(name) => handleCreateConfirm(name, null)}
            onCancel={() => setCreatingIn(null)}
          />
        </div>
      )}

      {tree.length === 0 && rootDocs.length === 0 && creatingIn !== 'root' && (
        <div className="px-4 py-3 text-sm text-[var(--fg-3)]">No files uploaded yet.</div>
      )}

      {error && <div className="px-2 py-2 text-xs text-[var(--aos-risk)]">{error}</div>}

      <button
        type="button"
        onClick={() => setCreatingIn('root')}
        className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm font-medium text-[var(--fg-2)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
      >
        <Plus size={13} />
        New folder
      </button>

      <KbContextMenu
        target={contextMenu?.target ?? null}
        position={contextMenu?.position ?? { x: 0, y: 0 }}
        onCreateSubfolder={handleCreateSubfolder}
        onRename={(folderId) => {
          setRenamingId(folderId);
          setContextMenu(null);
        }}
        onDelete={handleDeleteFolder}
        onClose={() => setContextMenu(null)}
      />
    </div>
  );
};
