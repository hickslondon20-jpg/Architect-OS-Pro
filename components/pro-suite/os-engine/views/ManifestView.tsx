import React from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../ui';
import { StatusPill } from '../StatusPill';
import { getPageById, type KnowledgePage, type RawDocument } from '../../../../lib/osEngineApi';

export const ManifestView: React.FC<{
  docs: RawDocument[];
  pages: KnowledgePage[];
}> = ({ docs, pages }) => (
  <div className="px-8 py-8">
    <h1 className="aos-h1 mb-1">Manifest</h1>
    <p className="mb-6 text-[var(--fg-2)]">Everything you've added and where it stands in ingestion.</p>

    {docs.length === 0 ? (
      <div className="rounded-md border border-dashed border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-4 py-6 text-sm text-[var(--fg-3)]">
        No uploaded files yet.
      </div>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Added</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ingested into</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium text-[var(--fg-1)]">{doc.fileName}</TableCell>
              <TableCell className="uppercase text-xs text-[var(--fg-2)]">{doc.fileType}</TableCell>
              <TableCell className="aos-mono text-xs text-[var(--fg-2)]">{doc.sizeLabel ?? '-'}</TableCell>
              <TableCell className="aos-mono text-xs text-[var(--fg-2)]">{doc.uploadDate}</TableCell>
              <TableCell>
                <StatusPill status={doc.status} />
              </TableCell>
              <TableCell className="text-xs text-[var(--fg-2)]">
                {doc.connectedPages.length === 0
                  ? '-'
                  : doc.connectedPages.map((p) => getPageById(pages, p)?.title ?? p).join(', ')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </div>
);
