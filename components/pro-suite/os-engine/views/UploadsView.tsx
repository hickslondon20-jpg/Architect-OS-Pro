import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  UploadCloud,
  Eye,
  Trash2,
  FileText,
  FileSpreadsheet,
  FileType,
  File as FileIcon,
} from 'lucide-react';
import { Button, Input, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../ui';
import { StatusPill } from '../StatusPill';
import { getPageById, type KnowledgePage, type RawDocument } from '../../../../lib/osEngineApi';

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

export const UploadsView: React.FC<{
  docs: RawDocument[];
  pages: KnowledgePage[];
  notice?: string | null;
  onOpenDoc: (doc: RawDocument) => void;
  onUpload: (file: File) => Promise<void>;
  onDeleteDoc: (docId: string) => Promise<void>;
}> = ({ docs, pages, notice, onOpenDoc, onUpload, onDeleteDoc }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDelete = (id: string) => {
    setConfirmingId(id);
    setConfirmText('');
    setError(null);
  };

  const cancelDelete = () => {
    setConfirmingId(null);
    setConfirmText('');
  };

  const uploadFile = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteDoc = async (docId: string) => {
    setBusy(true);
    setError(null);
    try {
      await onDeleteDoc(docId);
      cancelDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-8 py-8">
      <h1 className="aos-h1 mb-1">Uploads</h1>
      <p className="mb-6 text-[var(--fg-2)]">
        Raw files you have added. Originals stay private - only synthesized insight is shared into your wiki.
      </p>

      <div
        className="mb-8 flex flex-col items-center justify-center rounded-[var(--radius-sm)] border-2 border-dashed border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-6 py-10 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          uploadFile(event.dataTransfer.files[0]);
        }}
      >
        <UploadCloud size={32} className="mb-3 text-[var(--fg-3)]" />
        <p className="text-sm font-medium text-[var(--fg-1)]">Drop files here, or browse</p>
        <p className="mb-4 text-xs text-[var(--fg-3)]">PDF, Word, CSV, Excel, TXT, PNG, JPG</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.csv,.xlsx,.txt,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(event) => uploadFile(event.target.files?.[0])}
        />
        <Button variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          {busy ? 'Working...' : 'Browse files'}
        </Button>
        {(error || notice) && (
          <p className={`mt-3 text-xs ${error ? 'text-[var(--aos-risk)]' : 'text-[var(--fg-3)]'}`}>
            {error ?? notice}
          </p>
        )}
      </div>

      {docs.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-4 py-6 text-sm text-[var(--fg-3)]">
          No files uploaded yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Added</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Connected pages</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => {
              const Icon = fileIconFor(doc.fileType);
              const isConfirming = confirmingId === doc.id;
              const isExpanded = expandedId === doc.id;
              const title = metadataText(doc, 'document_title');
              const metrics = metadataArray(doc, 'metrics');
              const entities = metadataArray(doc, 'entities');
              return (
                <React.Fragment key={doc.id}>
                  <TableRow>
                    <TableCell>
                      <button
                        onClick={() => onOpenDoc(doc)}
                        className="flex items-center gap-2.5 text-left transition-colors hover:text-[var(--aos-brass)]"
                      >
                        <Icon size={16} className="flex-shrink-0 text-[var(--fg-3)]" />
                        <span className="font-medium text-[var(--fg-1)]">{doc.fileName}</span>
                      </button>
                    </TableCell>
                    <TableCell className="aos-mono text-xs text-[var(--fg-2)]">{doc.uploadDate}</TableCell>
                    <TableCell>
                      <StatusPill status={doc.status} />
                    </TableCell>
                    <TableCell>
                      {doc.connectedPages.length === 0 ? (
                        <span className="text-xs text-[var(--fg-4)]">-</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {doc.connectedPages.map((pid) => (
                            <span key={pid} className="text-xs text-[var(--aos-brass)]">
                              {getPageById(pages, pid)?.title ?? pid}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                          title="Details"
                          className="rounded-md p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <button
                          onClick={() => onOpenDoc(doc)}
                          title="View"
                          className="rounded-md p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => startDelete(doc.id)}
                          title="Delete"
                          className="rounded-md p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--aos-risk-tint)] hover:text-[var(--aos-risk)]"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-[var(--bg-canvas)]">
                        <div className="grid gap-4 py-2 md:grid-cols-[1.4fr_1fr]">
                          <div>
                            <p className="mb-1 text-sm font-semibold text-[var(--fg-1)]">
                              {title ?? doc.fileName}
                            </p>
                            <p className="text-sm leading-6 text-[var(--fg-2)]">
                              {doc.metadataSummary ??
                                (hasMetadataSignal(doc)
                                  ? 'No summary was extracted for this file yet.'
                                  : 'Metadata will appear here after this file is processed.')}
                            </p>
                            {(doc.metadataTopics?.length ?? 0) > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {doc.metadataTopics?.map((topic) => (
                                  <span
                                    key={topic}
                                    className="rounded-sm bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--fg-2)]"
                                  >
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
                                <p className="font-medium capitalize text-[var(--fg-1)]">
                                  {doc.metadataExtractionStatus}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {isConfirming && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-[var(--aos-risk-tint)]">
                        <div className="flex flex-col gap-3 py-1">
                          <p className="text-sm text-[var(--fg-1)]">
                            Delete <strong>{doc.fileName}</strong>? The original file is removed. Any insight
                            already synthesized from it is <strong>retained</strong> in your wiki.
                          </p>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs text-[var(--fg-2)]">
                              Type <code className="aos-mono">DELETE</code> to confirm:
                            </span>
                            <Input
                              value={confirmText}
                              onChange={(e) => setConfirmText(e.target.value)}
                              placeholder="DELETE"
                              className="w-32"
                            />
                            <Button
                              variant="danger"
                              disabled={confirmText !== 'DELETE' || busy}
                              onClick={() => deleteDoc(doc.id)}
                            >
                              Delete file
                            </Button>
                            <Button variant="ghost" onClick={cancelDelete}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
