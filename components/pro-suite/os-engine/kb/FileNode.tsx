import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, File as FileIcon, FileSpreadsheet, FileText, FileType, Trash2 } from 'lucide-react';
import { Button, Input } from '../../../ui';
import { StatusPill } from '../StatusPill';
import { getPageById, type KnowledgePage, type RawDocument } from '../../../../lib/osEngineApi';

interface FileNodeProps {
  doc: RawDocument;
  depth: number;
  pages: KnowledgePage[];
  onOpenDoc: (doc: RawDocument) => void;
  onDeleteDoc: (docId: string) => Promise<void>;
}

const fileIconFor = (type: string) => {
  switch (type) {
    case 'csv':
    case 'xlsx':
      return FileSpreadsheet;
    case 'pdf':
      return FileType;
    case 'docx':
      return FileText;
    default:
      return FileIcon;
  }
};

const metadataArray = (doc: RawDocument, key: string) => {
  const value = doc.extractedMetadata?.[key];
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
};

const metadataText = (doc: RawDocument, key: string) => {
  const value = doc.extractedMetadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const hasMetadataSignal = (doc: RawDocument) =>
  doc.metadataExtractionStatus ||
  doc.metadataSummary ||
  doc.metadataDocumentType ||
  doc.metadataBusinessDomain ||
  doc.metadataTimePeriod ||
  (doc.metadataTopics?.length ?? 0) > 0 ||
  metadataArray(doc, 'metrics').length > 0 ||
  metadataArray(doc, 'entities').length > 0;

const formatFamilyLabel = (doc: RawDocument) => {
  const family = String(doc.sourceFormatMetadata?.format_family ?? doc.parserFormat ?? doc.fileType ?? '').toLowerCase();
  const labels: Record<string, string> = {
    workbook: 'workbook',
    table: 'table export',
    document: 'document',
    presentation: 'presentation',
    markdown: 'Markdown',
    html: 'HTML',
    text: 'text file',
    image: 'image',
  };
  return labels[family] ?? (family || 'file');
};

const formatSourceStat = (doc: RawDocument, key: string, label: string) => {
  const value = doc.sourceFormatMetadata?.[key];
  return typeof value === 'number' && value > 0 ? `${value} ${label}${value === 1 ? '' : 's'}` : null;
};

export const FileNode: React.FC<FileNodeProps> = ({ doc, depth, pages, onOpenDoc, onDeleteDoc }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = fileIconFor(doc.fileType);
  const title = metadataText(doc, 'document_title');
  const metrics = metadataArray(doc, 'metrics');
  const entities = metadataArray(doc, 'entities');
  const parserStats = [
    formatSourceStat(doc, 'sheet_count', 'sheet'),
    formatSourceStat(doc, 'table_count', 'table'),
    formatSourceStat(doc, 'page_count', 'page'),
    formatSourceStat(doc, 'row_count', 'row'),
  ].filter(Boolean);

  const deleteDoc = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDeleteDoc(doc.id);
      setIsConfirming(false);
      setConfirmText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm transition-colors hover:bg-[var(--bg-canvas)]">
        <Icon size={14} className="flex-shrink-0 text-[var(--fg-3)]" />
        <button
          type="button"
          onClick={() => onOpenDoc(doc)}
          className="min-w-0 flex-1 truncate text-left font-medium text-[var(--fg-1)] transition-colors hover:text-[var(--aos-brass)]"
        >
          {doc.fileName}
        </button>
        <span className="aos-mono flex-shrink-0 text-xs text-[var(--fg-2)]">{doc.uploadDate}</span>
        <StatusPill status={doc.status} />
        <div className="min-w-24 flex-shrink-0">
          {doc.connectedPages.length === 0 ? (
            <span className="text-xs text-[var(--fg-4)]">-</span>
          ) : (
            <div className="flex flex-wrap justify-end gap-1.5">
              {doc.connectedPages.map((pid) => (
                <span key={pid} className="text-xs text-[var(--aos-brass)]">
                  {getPageById(pages, pid)?.title ?? pid}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            title="Details"
            className="rounded-md p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <button
            type="button"
            onClick={() => onOpenDoc(doc)}
            title="View"
            className="rounded-md p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
          >
            <Eye size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsConfirming(true);
              setConfirmText('');
              setError(null);
            }}
            title="Delete"
            className="rounded-md p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--aos-risk-tint)] hover:text-[var(--aos-risk)]"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div
          className="mt-1 rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-4 py-3"
          style={{ marginLeft: 16 }}
        >
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="mb-1 text-sm font-semibold text-[var(--fg-1)]">{title ?? doc.fileName}</p>
              <p className="text-sm leading-6 text-[var(--fg-2)]">
                {doc.metadataSummary ??
                  (hasMetadataSignal(doc)
                    ? 'No summary was extracted for this file yet.'
                    : 'Metadata will appear here after this file is processed.')}
              </p>
              {(doc.metadataTopics?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {doc.metadataTopics?.map((topic) => (
                    <span key={topic} className="rounded-sm bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--fg-2)]">
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-2 text-xs text-[var(--fg-2)] sm:grid-cols-2 md:grid-cols-1">
              <div>
                <span className="text-[var(--fg-4)]">Type</span>
                <p className="font-medium text-[var(--fg-1)]">{doc.metadataDocumentType ?? '-'}</p>
              </div>
              <div>
                <span className="text-[var(--fg-4)]">Area</span>
                <p className="font-medium text-[var(--fg-1)]">{doc.metadataBusinessDomain ?? '-'}</p>
              </div>
              <div>
                <span className="text-[var(--fg-4)]">Period</span>
                <p className="font-medium text-[var(--fg-1)]">{doc.metadataTimePeriod ?? '-'}</p>
              </div>
              <div>
                <span className="text-[var(--fg-4)]">Confidence</span>
                <p className="font-medium text-[var(--fg-1)]">
                  {doc.metadataConfidence == null ? '-' : `${Math.round(doc.metadataConfidence * 100)}%`}
                </p>
              </div>
              {metrics.length > 0 && (
                <div className="sm:col-span-2 md:col-span-1">
                  <span className="text-[var(--fg-4)]">Metrics</span>
                  <p className="font-medium text-[var(--fg-1)]">{metrics.join(', ')}</p>
                </div>
              )}
              {entities.length > 0 && (
                <div className="sm:col-span-2 md:col-span-1">
                  <span className="text-[var(--fg-4)]">Entities</span>
                  <p className="font-medium text-[var(--fg-1)]">{entities.join(', ')}</p>
                </div>
              )}
              {doc.metadataExtractionStatus && (
                <div className="sm:col-span-2 md:col-span-1">
                  <span className="text-[var(--fg-4)]">Extraction</span>
                  <p className="font-medium capitalize text-[var(--fg-1)]">{doc.metadataExtractionStatus}</p>
                </div>
              )}
              {(doc.parserStatus || doc.parserFormat || parserStats.length > 0) && (
                <div className="sm:col-span-2 md:col-span-1">
                  <span className="text-[var(--fg-4)]">Parsed as</span>
                  <p className="font-medium text-[var(--fg-1)]">
                    {formatFamilyLabel(doc)}
                    {doc.parserStatus ? ` (${doc.parserStatus})` : ''}
                  </p>
                  {parserStats.length > 0 && <p className="mt-1 text-[var(--fg-3)]">{parserStats.join(', ')}</p>}
                </div>
              )}
              {(doc.parserWarnings?.length ?? 0) > 0 && (
                <div className="sm:col-span-2 md:col-span-1">
                  <span className="text-[var(--fg-4)]">Warnings</span>
                  <p className="font-medium text-[var(--fg-1)]">{doc.parserWarnings?.join('; ')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isConfirming && (
        <div className="mt-1 rounded-[var(--radius-sm)] border border-[var(--aos-risk)] bg-[var(--aos-risk-tint)] px-4 py-3">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--fg-1)]">
              Delete <strong>{doc.fileName}</strong>? The original file is removed. Any insight already synthesized from it is{' '}
              <strong>retained</strong> in your wiki.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-[var(--fg-2)]">
                Type <code className="aos-mono">DELETE</code> to confirm:
              </span>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" className="w-32" />
              <Button variant="danger" disabled={confirmText !== 'DELETE' || busy} onClick={deleteDoc}>
                Delete file
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsConfirming(false);
                  setConfirmText('');
                  setError(null);
                }}
              >
                Cancel
              </Button>
              {error && <span className="text-xs text-[var(--aos-risk)]">{error}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
