import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import ReactMarkdown from 'react-markdown';
import {
  getDocumentSignedUrl,
  resolveCitation,
  type CitationRef,
  type CitationResolveResult,
  type CitationResolveView,
} from '../../../lib/virtualCsoApi';
import {
  isBBoxLocator,
  transformBBoxToCanvasRect,
  type CitationBBox,
  type HighlightRect,
} from './citationPdfGeometry';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export const citationLabel = (ref: CitationRef): string =>
  ref.source_label || ref.verbatim?.slice(0, 80) || ref.source_id || 'Source';

export const citationOrdinal = (ref: CitationRef): number | null =>
  typeof ref.ordinal === 'number' && Number.isFinite(ref.ordinal) ? ref.ordinal : null;

export const isCitableRef = (ref: CitationRef): boolean =>
  ref.source_kind === 'document_chunk' ||
  ref.source_kind === 'wiki_page' ||
  ref.source_kind === 'platform_record' ||
  ref.source_kind === 'web';

export const stripCitationMarkers = (value: string): string =>
  value
    .replace(/\s*\[(?:\d+)\]/g, '')
    .replace(/\s*\[\[Source:[^\]]+\]\]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

export const CitationReaderBody: React.FC<{ citation: CitationRef }> = ({ citation }) => {
  const [result, setResult] = useState<CitationResolveResult | null>(null);
  const [loading, setLoading] = useState(true);
  const highlightRef = useRef<HTMLDivElement | HTMLTableRowElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setResult(null);
    resolveCitation(citation)
      .then((next) => {
        if (active) setResult(next);
      })
      .catch((err) => {
        if (!active) return;
        setResult({
          status: 'error',
          view: {
            type: 'error',
            source_kind: citation.source_kind,
            source_id: citation.source_id,
            code: 'unresolvable',
            message: err instanceof Error ? err.message : 'Source unavailable.',
          },
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [citation]);

  useEffect(() => {
    if (!loading) {
      window.setTimeout(() => highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
    }
  }, [loading, result]);

  if (loading) return <p className="text-sm text-[var(--fg-3)]">Loading source...</p>;
  return <CitationView citation={citation} view={result?.view} highlightRef={highlightRef} />;
};

const CitationView: React.FC<{
  citation: CitationRef;
  view?: CitationResolveView;
  highlightRef: React.MutableRefObject<HTMLDivElement | HTMLTableRowElement | null>;
}> = ({ citation, view, highlightRef }) => {
  if (!view || view.type === 'error' || view.type === 'web_dark' || view.type === 'not_citable') {
    return (
      <div className="rounded-md border border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-3 py-3 text-sm text-[var(--fg-3)]">
        {view?.message || 'Source unavailable.'}
      </div>
    );
  }

  if (view.type === 'platform_record') {
    const focusedField = view.field || recordFieldFromRef(citation);
    return (
      <div className="space-y-3 text-sm">
        <table className="w-full border-collapse text-left text-xs">
          <tbody>
            {(view.fields ?? []).map((field) => {
              const focused = focusedField ? field.key === focusedField : true;
              return (
                <tr
                  key={field.key}
                  ref={focused ? (highlightRef as React.MutableRefObject<HTMLTableRowElement | null>) : undefined}
                  className={focused ? 'bg-[var(--aos-brass-tint)]' : undefined}
                >
                  <th className="w-2/5 border-b border-[var(--aos-mist)] py-2 pr-3 font-medium text-[var(--fg-2)]">
                    {field.label}
                  </th>
                  <td className="border-b border-[var(--aos-mist)] py-2 text-[var(--fg-2)]">
                    {formatValue(field.value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {view.deep_link && (
          <a className="inline-flex items-center gap-1 text-xs text-[var(--aos-brass)]" href={view.deep_link}>
            Open record <ExternalLink size={12} />
          </a>
        )}
      </div>
    );
  }

  if (view.type === 'wiki') {
    return (
      <div className="space-y-4 text-sm">
        <EvidenceHighlight ref={highlightRef}>
          <ReactMarkdown>{view.prose || view.summary || 'Source unavailable.'}</ReactMarkdown>
        </EvidenceHighlight>
        {(view.evidence ?? []).length > 0 && (
          <div>
            <p className="aos-eyebrow mb-2">Evidence</p>
            <div className="space-y-2">
              {(view.evidence ?? []).map((item, index) => (
                <pre
                  key={index}
                  className="overflow-x-auto rounded-md bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--fg-3)]"
                >
                  {JSON.stringify(item, null, 2)}
                </pre>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <ChunkEvidence citation={citation} view={view} highlightRef={highlightRef} />
      {view.document && (
        <pre className="overflow-x-auto rounded-md bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--fg-3)]">
          {JSON.stringify(view.document, null, 2)}
        </pre>
      )}
    </div>
  );
};

const ChunkEvidence: React.FC<{
  citation: CitationRef;
  view: Extract<CitationResolveView, { type: 'chunk' }>;
  highlightRef: React.MutableRefObject<HTMLDivElement | HTMLTableRowElement | null>;
}> = ({ citation, view, highlightRef }) => {
  const documentId = typeof view.document?.id === 'string' ? view.document.id : null;
  const canRenderPdf = Boolean(documentId && isPdfDocument(view.document) && isBBoxLocator(view.locator));
  if (canRenderPdf && documentId && isBBoxLocator(view.locator)) {
    return (
      <PdfBBoxHighlight
        documentId={documentId}
        bbox={view.locator.bbox}
        pageNumber={Number(view.locator.bbox.page_no ?? view.locator.page_number ?? 1)}
        fallbackText={view.verbatim || citation.verbatim || 'Source unavailable.'}
        highlightRef={highlightRef as React.MutableRefObject<HTMLDivElement | null>}
      />
    );
  }
  return <EvidenceHighlight ref={highlightRef}>{view.verbatim || citation.verbatim || 'Source unavailable.'}</EvidenceHighlight>;
};

const PdfBBoxHighlight: React.FC<{
  documentId: string;
  bbox: CitationBBox;
  pageNumber: number;
  fallbackText: string;
  highlightRef: React.MutableRefObject<HTMLDivElement | null>;
}> = ({ documentId, bbox, pageNumber, fallbackText, highlightRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1.25);
  const [rect, setRect] = useState<HighlightRect | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let renderTask: { cancel?: () => void; promise?: Promise<unknown> } | null = null;

    const render = async () => {
      setLoading(true);
      setFailed(false);
      setRect(null);
      try {
        const signedUrl = await getDocumentSignedUrl(documentId);
        const pdf = await pdfjsLib.getDocument({ url: signedUrl }).promise;
        const page = await pdf.getPage(Math.max(1, Math.round(pageNumber || 1)));
        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) throw new Error('Canvas unavailable.');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (!active) return;
        const nextRect = transformBBoxToCanvasRect(bbox, canvas.width, canvas.height);
        setRect(nextRect);
        setLoading(false);
        window.setTimeout(() => centerHighlight(scrollerRef.current, nextRect), 0);
      } catch {
        if (!active) return;
        setFailed(true);
        setLoading(false);
      }
    };

    render();
    return () => {
      active = false;
      renderTask?.cancel?.();
    };
  }, [bbox, documentId, pageNumber, zoom]);

  if (failed) {
    return <EvidenceHighlight ref={highlightRef}>{fallbackText}</EvidenceHighlight>;
  }

  return (
    <div ref={highlightRef} className="rounded-md border border-[var(--aos-mist)] bg-[var(--bg-canvas)]">
      <div className="flex items-center justify-between border-b border-[var(--aos-mist)] px-3 py-2">
        <span className="aos-eyebrow">Page {Math.max(1, Math.round(pageNumber || 1))}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1.5 text-[var(--fg-3)] hover:bg-[var(--aos-brass-tint)] hover:text-[var(--fg-1)]"
            onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.25).toFixed(2))))}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut size={15} />
          </button>
          <span className="aos-mono w-12 text-center text-xs text-[var(--fg-3)]">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="rounded-md p-1.5 text-[var(--fg-3)] hover:bg-[var(--aos-brass-tint)] hover:text-[var(--fg-1)]"
            onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </div>
      <div ref={scrollerRef} className="max-h-[58vh] overflow-auto p-3">
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="block bg-white" />
          {rect && (
            <div
              className="pointer-events-none absolute border-2 border-[var(--aos-brass)] bg-[rgba(184,146,42,0.18)]"
              style={{
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              }}
            />
          )}
          {loading && <div className="absolute inset-0 grid place-items-center bg-[rgba(252,251,248,0.72)] text-xs text-[var(--fg-3)]">Loading source...</div>}
        </div>
      </div>
    </div>
  );
};

const EvidenceHighlight = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(({ children }, ref) => (
  <div ref={ref} className="rounded-md border border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] px-3 py-3">
    {children}
  </div>
));

const isPdfDocument = (document: Record<string, unknown> | null | undefined): boolean => {
  const fileType = typeof document?.file_type === 'string' ? document.file_type.toLowerCase() : '';
  const title = typeof document?.title === 'string' ? document.title.toLowerCase() : '';
  return fileType.includes('pdf') || title.endsWith('.pdf');
};

const centerHighlight = (scroller: HTMLDivElement | null, rect: HighlightRect) => {
  if (!scroller) return;
  scroller.scrollLeft = Math.max(0, rect.left + rect.width / 2 - scroller.clientWidth / 2);
  scroller.scrollTop = Math.max(0, rect.top + rect.height / 2 - scroller.clientHeight / 2);
};

const recordFieldFromRef = (ref: CitationRef): string | null => {
  const path = ref.locator?.record_path || (typeof ref.source_metadata.record_path === 'string' ? ref.source_metadata.record_path : null);
  if (!path) return null;
  const parts = path.split('/').filter(Boolean);
  return parts.length >= 3 ? parts[2] : null;
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

export const citationMeta = (ref: CitationRef): string => {
  const locator = ref.locator;
  const parts = [ref.source_kind.replace('_', ' ')];
  if (locator?.lines) parts.push(`lines ${locator.lines.start}-${locator.lines.end}`);
  if (locator?.section_label) parts.push(locator.section_label);
  if (locator?.record_path) parts.push(locator.record_path);
  return parts.join(' - ');
};

export const useOrdinalMap = (citations: CitationRef[] | undefined) =>
  useMemo(() => {
    const map = new Map<number, CitationRef>();
    for (const citation of citations ?? []) {
      if (!isCitableRef(citation)) continue;
      const ordinal = citationOrdinal(citation);
      if (ordinal !== null) map.set(ordinal, citation);
    }
    return map;
  }, [citations]);
