import React, { useRef, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { Button } from '../../../ui';
import { FolderTree } from '../kb/FolderTree';
import type { FolderTreeNode, KnowledgePage, RawDocument } from '../../../../lib/osEngineApi';

const findFolderName = (tree: FolderTreeNode[], folderId: string | null): string | null => {
  if (!folderId) return null;
  for (const folder of tree) {
    if (folder.id === folderId) return folder.name;
    const child = findFolderName(folder.children, folderId);
    if (child) return child;
  }
  return null;
};

export const UploadsView: React.FC<{
  docs: RawDocument[];
  pages: KnowledgePage[];
  notice?: string | null;
  onOpenDoc: (doc: RawDocument) => void;
  onUpload: (file: File, folderId?: string | null) => Promise<void>;
  onDeleteDoc: (docId: string) => Promise<void>;
  folderTree: FolderTreeNode[];
  selectedFolderId: string | null;
  expandedIds: Set<string>;
  onSelectFolder: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  foldersLoading?: boolean;
}> = ({
  docs,
  pages,
  notice,
  onOpenDoc,
  onUpload,
  onDeleteDoc,
  folderTree,
  selectedFolderId,
  expandedIds,
  onSelectFolder,
  onToggleExpand,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  foldersLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedFolderName = findFolderName(folderTree, selectedFolderId);

  const uploadFile = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onUpload(file, selectedFolderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="px-8 py-8">
      <h1 className="aos-h1 mb-1">Uploads</h1>
      <p className="mb-6 text-[var(--fg-2)]">
        Raw files you have added. Originals stay private - only synthesized insight is shared into your wiki.
      </p>

      <div
        className="mb-8 flex flex-col items-center justify-center rounded-[var(--radius-sm)] border-2 border-dashed border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-6 py-10 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          uploadFile(event.dataTransfer.files[0]);
        }}
      >
        <UploadCloud size={32} className="mb-3 text-[var(--fg-3)]" />
        <p className="text-sm font-medium text-[var(--fg-1)]">Drop files here, or browse</p>
        <p className="mb-4 text-xs text-[var(--fg-3)]">PDF, Word, Excel, CSV, Markdown, HTML, TXT, images</p>
        {selectedFolderId && selectedFolderName && (
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--fg-2)]">
            Uploading to: <span className="font-medium text-[var(--fg-1)]">{selectedFolderName}</span>
            <button
              type="button"
              onClick={() => onSelectFolder(null)}
              className="rounded-sm p-0.5 text-[var(--fg-4)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-2)]"
              title="Upload to Knowledge Base"
            >
              <X size={12} />
            </button>
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.tsv,.txt,.md,.markdown,.html,.htm,.xhtml,.odt,.ods,.odp,.epub,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp,.xml,.xbrl,.json"
          className="hidden"
          onChange={(event) => uploadFile(event.target.files?.[0])}
        />
        <Button variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          {busy ? 'Working...' : 'Browse files'}
        </Button>
        {(error || notice) && (
          <p className={`mt-3 text-xs ${error ? 'text-[var(--aos-risk)]' : 'text-[var(--fg-3)]'}`}>
            {error ?? notice}
          </p>
        )}
      </div>

      {foldersLoading ? (
        <div className="py-4 text-sm text-[var(--fg-3)]">Loading folders...</div>
      ) : (
        <FolderTree
          tree={folderTree}
          docs={docs}
          pages={pages}
          selectedFolderId={selectedFolderId}
          expandedIds={expandedIds}
          onSelectFolder={onSelectFolder}
          onToggleExpand={onToggleExpand}
          onCreateFolder={onCreateFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onOpenDoc={onOpenDoc}
          onDeleteDoc={onDeleteDoc}
        />
      )}
    </div>
  );
};
