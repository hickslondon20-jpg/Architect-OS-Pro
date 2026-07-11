import React from 'react';
import { Download, FileText, PanelRightOpen } from 'lucide-react';
import type { ArtifactDelivery } from '../../../lib/virtualCsoApi';

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

export const ArtifactDeliveryCard: React.FC<{
  artifact: ArtifactDelivery;
  onOpen?: (artifactId: string) => void;
}> = ({ artifact, onOpen }) => (
  <div className="mb-3 w-full rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-canvas)] p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--aos-brass)]" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[var(--fg-1)]">{artifact.filename}</div>
          <div className="mt-0.5 text-xs text-[var(--fg-3)]">
            {artifact.renderable ? 'Renderable artifact' : 'Downloadable artifact'} · {formatBytes(artifact.size)}
          </div>
          {artifact.description && (
            <p className="mt-2 text-xs leading-relaxed text-[var(--fg-2)]">{artifact.description}</p>
          )}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        {artifact.renderable && onOpen && (
          <button
            type="button"
            onClick={() => onOpen(artifact.id)}
            className="rounded-md p-2 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--aos-brass)]"
            title="Open artifact"
            aria-label="Open artifact"
          >
            <PanelRightOpen size={15} />
          </button>
        )}
        {artifact.signed_url && (
          <a
            href={artifact.signed_url}
            className="rounded-md p-2 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--aos-brass)]"
            title="Download artifact"
            aria-label="Download artifact"
          >
            <Download size={15} />
          </a>
        )}
      </div>
    </div>
  </div>
);
