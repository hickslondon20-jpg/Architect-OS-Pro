import React from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import type { ThreadWorkspaceFile } from '../../../lib/virtualCsoApi';

export const WorkspacePanel: React.FC<{
  files: ThreadWorkspaceFile[];
  onOpenFile: (file: ThreadWorkspaceFile) => void;
}> = ({ files, onOpenFile }) => {
  if (files.length === 0) return null;

  return (
    <aside className="w-72 flex-shrink-0 overflow-y-auto border-l border-[var(--aos-mist)] bg-[var(--bg-canvas)]">
      <div className="border-b border-[var(--aos-mist)] px-4 py-3">
        <p className="aos-eyebrow flex items-center gap-1.5">
          <FolderOpen size={12} /> Workspace
        </p>
      </div>
      <div className="space-y-2 p-3">
        {files.map((file) => (
          <button
            key={file.id}
            type="button"
            onClick={() => onOpenFile(file)}
            className="flex w-full items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-3 text-left transition-colors hover:border-[var(--aos-brass)]"
          >
            <FileText size={15} className="mt-0.5 flex-shrink-0 text-[var(--aos-brass)]" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-[var(--fg-1)]">{file.filePath}</span>
              <span className="aos-mono mt-1 block text-[11px] text-[var(--fg-3)]">
                {file.source} {file.size == null ? '' : `- ${file.size} bytes`}
              </span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
};
