import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

export type KbContextMenuTarget =
  | { type: 'folder'; folderId: string; folderName: string }
  | { type: 'root' };

interface KbContextMenuProps {
  target: KbContextMenuTarget | null;
  position: { x: number; y: number };
  onCreateSubfolder: (parentId: string | null) => void;
  onRename: (folderId: string) => void;
  onDelete: (folderId: string) => void;
  onClose: () => void;
}

export const KbContextMenu: React.FC<KbContextMenuProps> = ({
  target,
  position,
  onCreateSubfolder,
  onRename,
  onDelete,
  onClose,
}) => {
  useEffect(() => {
    if (!target) return undefined;

    const close = () => onClose();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose, target]);

  if (!target) return null;

  const menu = (
    <div
      className="fixed z-[9999] min-w-40 rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] py-1 text-sm text-[var(--fg-1)] shadow-[var(--shadow-soft-2)]"
      style={{ top: position.y, left: position.x }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="block w-full px-3 py-2 text-left transition-colors hover:bg-[var(--bg-canvas)]"
        onClick={() => onCreateSubfolder(target.type === 'folder' ? target.folderId : null)}
      >
        {target.type === 'folder' ? 'New subfolder' : 'New folder'}
      </button>
      {target.type === 'folder' && (
        <>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left transition-colors hover:bg-[var(--bg-canvas)]"
            onClick={() => onRename(target.folderId)}
          >
            Rename
          </button>
          <div className="my-1 border-t border-[var(--aos-mist)]" />
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-[var(--aos-risk)] transition-colors hover:bg-[var(--aos-risk-tint)]"
            onClick={() => onDelete(target.folderId)}
          >
            Delete
          </button>
        </>
      )}
    </div>
  );

  return ReactDOM.createPortal(menu, document.body);
};
