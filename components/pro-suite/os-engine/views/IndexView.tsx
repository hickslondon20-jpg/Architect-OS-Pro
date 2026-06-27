import React from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../ui';
import { PAGE_TYPE_LABELS, type KnowledgePage } from '../../../../lib/osEngineApi';

export const IndexView: React.FC<{
  pages: KnowledgePage[];
  onOpenPage: (page: KnowledgePage) => void;
}> = ({ pages, onOpenPage }) => (
  <div className="px-8 py-8">
    <h1 className="aos-h1 mb-1">Index</h1>
    <p className="mb-6 text-[var(--fg-2)]">A living map of every page in your wiki.</p>

    {pages.length === 0 ? (
      <div className="rounded-md border border-dashed border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-4 py-6 text-sm text-[var(--fg-3)]">
        No wiki pages yet.
      </div>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Page</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Sources</TableHead>
            <TableHead className="text-right">Words</TableHead>
            <TableHead>Last updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((page) => (
            <TableRow key={page.id}>
              <TableCell>
                <button
                  onClick={() => onOpenPage(page)}
                  className="font-medium text-[var(--fg-1)] transition-colors hover:text-[var(--aos-brass)]"
                >
                  {page.title}
                </button>
              </TableCell>
              <TableCell className="text-[var(--fg-2)]">{PAGE_TYPE_LABELS[page.pageType]}</TableCell>
              <TableCell className="aos-mono text-right text-[var(--fg-2)]">{page.sourceFileIds.length}</TableCell>
              <TableCell className="aos-mono text-right text-[var(--fg-2)]">{page.wordCount}</TableCell>
              <TableCell className="aos-mono text-xs text-[var(--fg-2)]">{page.lastUpdated}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </div>
);
