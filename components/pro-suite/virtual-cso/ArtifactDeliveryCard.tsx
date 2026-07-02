import React from 'react';
import { Download, FileText, Maximize2 } from 'lucide-react';
import type { ArtifactDelivery } from '../../../lib/artifactsApi';

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
};

export const ArtifactDeliveryCard: React.FC<{
  artifact: ArtifactDelivery;
  onOpenArtifact?: (artifactId: string) => void;
}> = ({ artifact, onOpenArtifact }) => {
  const canOpen = artifact.renderable && !!onOpenArtifact;
  return (
    <div className="mb-3 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-sunken)] px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText size={14} className="shrink-0 text-[var(--aos-brass)]" />
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-[var(--fg-2)]">{artifact.filename}</div>
            <div className="aos-mono mt-0.5 text-[11px] text-[var(--fg-4)]">
              {formatBytes(artifact.size)} · {artifact.renderable ? 'Renderable' : 'Download'}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canOpen && (
            <button
              type="button"
              onClick={() => onOpenArtifact?.(artifact.id)}
              className="rounded-md p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
              title="Open artifact"
              aria-label="Open artifact"
            >
              <Maximize2 size={14} />
            </button>
          )}
          {artifact.signed_url && (
            <a
              href={artifact.signed_url}
              className="rounded-md p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
              title="Download artifact"
              aria-label="Download artifact"
            >
              <Download size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
