import React from 'react';
import { BookOpen, Layers, Library, FolderInput, ChevronRight } from 'lucide-react';
import {
  SOURCE_KIND_LABELS,
  type SourceKind,
  type SourceRef,
} from '../../../lib/virtualCsoApi';

const KIND_ORDER: SourceKind[] = ['wiki', 'platform', 'ip', 'context'];

const KIND_ICONS: Record<SourceKind, React.ElementType> = {
  wiki: BookOpen,
  platform: Layers,
  ip: Library,
  context: FolderInput,
};

/**
 * Right panel — the provenance layer. Sections per source kind.
 * Clickable items (wiki / ip with a pageId) open the shared Reader.
 * Default (no active chat) shows a short hint.
 */
export const SourcesPanel: React.FC<{
  sources: SourceRef[];
  hasActiveChat: boolean;
  onOpenSource: (pageId: string) => void;
}> = ({ sources, hasActiveChat, onOpenSource }) => (
  <aside
    className="flex w-[260px] flex-shrink-0 flex-col border-l border-[var(--aos-mist)] bg-[var(--bg-canvas)]"
    aria-label="Sources"
  >
    <div className="border-b border-[var(--aos-mist)] px-4 py-3.5">
      <p className="aos-eyebrow">Sources</p>
      <p className="mt-1 text-xs text-[var(--fg-3)]">What this conversation is drawing on.</p>
    </div>

    <div className="flex-1 overflow-y-auto px-4 py-4">
      {!hasActiveChat || sources.length === 0 ? (
        <p className="text-xs leading-relaxed text-[var(--fg-3)]">
          Sources populate here as the conversation pulls from your wiki, platform data, and the
          Architect OS IP.
        </p>
      ) : (
        <div className="space-y-5">
          {KIND_ORDER.map((kind) => {
            const items = sources.filter((s) => s.kind === kind);
            if (items.length === 0) return null;
            const Icon = KIND_ICONS[kind];
            return (
              <div key={kind}>
                <p className="aos-eyebrow flex items-center gap-1.5 pb-2">
                  <Icon size={11} /> {SOURCE_KIND_LABELS[kind]}
                </p>
                <div className="space-y-1.5">
                  {items.map((s, i) => {
                    const clickable = Boolean(s.pageId);
                    if (clickable) {
                      return (
                        <button
                          key={`${kind}-${i}`}
                          onClick={() => onOpenSource(s.pageId!)}
                          className="group flex w-full items-center justify-between gap-2 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-2.5 py-2 text-left text-sm text-[var(--fg-2)] transition-colors hover:border-[var(--aos-brass)] hover:text-[var(--fg-1)]"
                        >
                          <span className="truncate">{s.label}</span>
                          <ChevronRight
                            size={13}
                            className="flex-shrink-0 text-[var(--fg-4)] transition-colors group-hover:text-[var(--aos-brass)]"
                          />
                        </button>
                      );
                    }
                    return (
                      <span
                        key={`${kind}-${i}`}
                        className="inline-flex max-w-full items-center rounded-full bg-[var(--bg-sunken)] px-2.5 py-1 text-xs text-[var(--fg-2)]"
                      >
                        <span className="truncate">{s.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </aside>
);
