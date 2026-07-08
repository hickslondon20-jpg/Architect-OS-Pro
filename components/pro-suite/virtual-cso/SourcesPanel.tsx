import React from 'react';
import { BookOpen, ChevronRight, FileText, Globe, Layers } from 'lucide-react';
import {
  CITATION_SOURCE_KIND_LABELS,
  type CitationRef,
  type CitationSourceKind,
} from '../../../lib/virtualCsoApi';
import { citationLabel, citationMeta, citationOrdinal, isCitableRef } from './CitationReaderBody';

const KIND_ORDER: CitationSourceKind[] = ['document_chunk', 'wiki_page', 'platform_record', 'web'];

const KIND_ICONS: Record<CitationSourceKind, React.ElementType> = {
  document_chunk: FileText,
  wiki_page: BookOpen,
  platform_record: Layers,
  web: Globe,
  derived: Layers,
};

/**
 * Right panel provenance layer. Shows only citable refs; derived refs stay in the trace.
 */
export const SourcesPanel: React.FC<{
  sources: CitationRef[];
  hasActiveChat: boolean;
  onOpenCitation: (citation: CitationRef) => void;
}> = ({ sources, hasActiveChat, onOpenCitation }) => {
  const citableSources = sources.filter(isCitableRef);

  return (
    <aside
      className="flex w-[260px] flex-shrink-0 flex-col border-l border-[var(--aos-mist)] bg-[var(--bg-canvas)]"
      aria-label="Sources"
    >
      <div className="border-b border-[var(--aos-mist)] px-4 py-3.5">
        <p className="aos-eyebrow">Sources</p>
        <p className="mt-1 text-xs text-[var(--fg-3)]">What this answer is drawing on.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!hasActiveChat || citableSources.length === 0 ? (
          <p className="text-xs leading-relaxed text-[var(--fg-3)]">
            Sources populate here as the conversation pulls from your wiki, platform data, and documents.
          </p>
        ) : (
          <div className="space-y-5">
            {KIND_ORDER.map((kind) => {
              const items = citableSources.filter((source) => source.source_kind === kind);
              if (items.length === 0) return null;
              const Icon = KIND_ICONS[kind];
              return (
                <div key={kind}>
                  <p className="aos-eyebrow flex items-center gap-1.5 pb-2">
                    <Icon size={11} /> {CITATION_SOURCE_KIND_LABELS[kind]}
                  </p>
                  <div className="space-y-1.5">
                    {items.map((source, index) => {
                      const ordinal = citationOrdinal(source);
                      return (
                        <button
                          key={`${source.source_kind}-${source.source_id ?? index}-${ordinal ?? index}`}
                          onClick={() => onOpenCitation(source)}
                          className="group flex w-full items-center justify-between gap-2 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-2.5 py-2 text-left text-sm text-[var(--fg-2)] transition-colors hover:border-[var(--aos-brass)] hover:text-[var(--fg-1)]"
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              {ordinal !== null && (
                                <span className={`aos-mono inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[10px] ${citationVerdictClassName(source)}`}>
                                  {ordinal}
                                </span>
                              )}
                              <span className="truncate">{citationLabel(source)}</span>
                            </span>
                            <span className="mt-1 block truncate text-xs text-[var(--fg-4)]">{citationMeta(source)}</span>
                          </span>
                          <ChevronRight
                            size={13}
                            className="flex-shrink-0 text-[var(--fg-4)] transition-colors group-hover:text-[var(--aos-brass)]"
                          />
                        </button>
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
};

const citationVerdictClassName = (citation: CitationRef): string => {
  const verdict = citation.verdict?.verdict;
  if (verdict === 'supported') return 'border-[var(--aos-success)] bg-[var(--aos-success-tint)] text-[var(--aos-success)]';
  if (verdict === 'partial') return 'border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] text-[var(--aos-brass)]';
  if (verdict === 'unsupported') return 'border-[var(--aos-risk)] bg-[var(--aos-risk-tint)] text-[var(--aos-risk)]';
  if (verdict === 'unresolvable') return 'border-[var(--fg-4)] bg-[var(--bg-canvas)] text-[var(--fg-3)]';
  return 'border-[var(--aos-brass)] text-[var(--aos-brass)]';
};
