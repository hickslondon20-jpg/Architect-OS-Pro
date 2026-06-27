import React, { useState } from 'react';
import { ChevronRight, File as FileIcon, FileText, Folder } from 'lucide-react';
import { Breadcrumb, type Crumb } from '../Breadcrumb';
import { StatusPill } from '../StatusPill';
import {
  WIKI_CATEGORIES,
  getStarterPages,
  getPagesForCategory,
  getCategoryPageCount,
  PAGE_TYPE_LABELS,
  type KnowledgePage,
  type RawDocument,
  type WikiCategoryId,
} from '../../../../lib/osEngineApi';

const PageRow: React.FC<{ page: KnowledgePage; onOpen: (p: KnowledgePage) => void }> = ({ page, onOpen }) => (
  <button
    onClick={() => onOpen(page)}
    className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--aos-brass)] hover:bg-[var(--aos-brass-tint)]"
  >
    <div className="flex items-center gap-3">
      <FileText size={16} className="text-[var(--fg-3)]" />
      <div>
        <div className="text-sm font-medium text-[var(--fg-1)]">{page.title}</div>
        <div className="text-xs text-[var(--fg-3)]">
          {PAGE_TYPE_LABELS[page.pageType]} - updated{' '}
          <span className="aos-mono">{page.lastUpdated}</span>
        </div>
      </div>
    </div>
    <ChevronRight size={16} className="text-[var(--fg-4)]" />
  </button>
);

const SourceFileRow: React.FC<{ doc: RawDocument; onOpen: (doc: RawDocument) => void }> = ({ doc, onOpen }) => (
  <button
    onClick={() => onOpen(doc)}
    className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--aos-brass)] hover:bg-[var(--aos-brass-tint)]"
  >
    <div className="flex min-w-0 items-center gap-3">
      <FileIcon size={16} className="flex-shrink-0 text-[var(--fg-3)]" />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-[var(--fg-1)]">{doc.fileName}</div>
        <div className="text-xs text-[var(--fg-3)]">
          {doc.fileType.toUpperCase()} - added <span className="aos-mono">{doc.uploadDate}</span>
          {doc.sizeLabel ? <> - {doc.sizeLabel}</> : null}
        </div>
      </div>
    </div>
    <div className="flex flex-shrink-0 items-center gap-2">
      <StatusPill status={doc.status} />
      <ChevronRight size={16} className="text-[var(--fg-4)]" />
    </div>
  </button>
);

export const WikiView: React.FC<{
  pages: KnowledgePage[];
  docs: RawDocument[];
  onOpenPage: (page: KnowledgePage) => void;
  onOpenDoc: (doc: RawDocument) => void;
}> = ({ pages, docs, onOpenPage, onOpenDoc }) => {
  const [activeCategory, setActiveCategory] = useState<WikiCategoryId | null>(null);

  const starterPages = getStarterPages(pages);

  const crumbs: Crumb[] = activeCategory
    ? [
        { label: 'Wiki', onClick: () => setActiveCategory(null) },
        { label: WIKI_CATEGORIES.find((c) => c.id === activeCategory)?.label ?? '' },
      ]
    : [{ label: 'Wiki' }];

  if (activeCategory) {
    const category = WIKI_CATEGORIES.find((c) => c.id === activeCategory);
    const categoryPages = getPagesForCategory(pages, activeCategory);
    return (
      <div className="px-8 py-8">
        <Breadcrumb crumbs={crumbs} />
        <h1 className="aos-h1 mb-1">{category?.label}</h1>
        <p className="mb-6 text-[var(--fg-2)]">{category?.description}</p>
        {categoryPages.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-4 py-6 text-sm text-[var(--fg-3)]">
            Nothing filed here yet. This folder fills as the system files relevant content.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {categoryPages.map((p) => (
              <PageRow key={p.id} page={p} onOpen={onOpenPage} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <Breadcrumb crumbs={crumbs} />
      <h1 className="aos-h1 mb-1">Wiki</h1>
      <p className="mb-6 text-[var(--fg-2)]">
        What the system understands about your agency - interpreted facts beside the source files that fed them.
      </p>

      <p className="aos-eyebrow mb-3">Categories</p>
      <div className="mb-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {WIKI_CATEGORIES.map((cat) => {
          const count = getCategoryPageCount(pages, cat.id);
          const empty = count === 0;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="flex items-center justify-between gap-3 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--aos-brass)] hover:bg-[var(--aos-brass-tint)]"
            >
              <div className="flex items-center gap-3">
                <Folder size={16} className={empty ? 'text-[var(--fg-4)]' : 'text-[var(--aos-brass)]'} />
                <div>
                  <div className={`text-sm font-medium ${empty ? 'text-[var(--fg-3)]' : 'text-[var(--fg-1)]'}`}>
                    {cat.label}
                  </div>
                  <div className="text-xs text-[var(--fg-3)]">{cat.description}</div>
                </div>
              </div>
              <span className={`aos-mono text-xs ${empty ? 'text-[var(--fg-4)]' : 'text-[var(--fg-2)]'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="aos-eyebrow mb-3">Synthesized pages</p>
      {starterPages.length === 0 ? (
        <p className="mb-8 rounded-md border border-dashed border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-4 py-6 text-sm text-[var(--fg-3)]">
          No starter pages yet. Use the Welcome setup to scaffold the five core pages.
        </p>
      ) : (
        <div className="mb-8 flex flex-col gap-2">
          {starterPages.map((p) => (
            <PageRow key={p.id} page={p} onOpen={onOpenPage} />
          ))}
        </div>
      )}

      <p className="aos-eyebrow mb-3">Source files</p>
      {docs.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-4 py-6 text-sm text-[var(--fg-3)]">
          No uploaded files yet. Add documents from Uploads and they will appear here.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {docs.map((doc) => (
            <SourceFileRow key={doc.id} doc={doc} onOpen={onOpenDoc} />
          ))}
        </div>
      )}
    </div>
  );
};
