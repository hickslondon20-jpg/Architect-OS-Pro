import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronRight, FileText, Globe, Layers, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ArtifactCard, SectionEyebrow } from '../../../components/pro-suite/domain-agents/DomainAgentPrimitives';
import { Reader } from '../../../components/pro-suite/shared/Reader';
import {
  CitationReaderBody,
  citationLabel,
  citationMeta,
  citationOrdinal,
  isCitableRef,
} from '../../../components/pro-suite/virtual-cso/CitationReaderBody';
import { getArtifact, type ArtifactDelivery } from '../../../lib/artifactsApi';
import { listDomainAgents, listDomainArtifacts } from '../../../lib/domainAgentsApi';
import { promoteTaskArtifact } from '../../../lib/tasksApi';
import { CITATION_SOURCE_KIND_LABELS, type CitationRef, type CitationSourceKind } from '../../../lib/virtualCsoApi';
import type { ArtifactType, DomainAgent, DomainAgentId, DomainArtifact } from './types';

const CITABLE_KINDS: CitationSourceKind[] = ['document_chunk', 'wiki_page', 'platform_record', 'web'];
const INLINE_SOURCE_RE = /\[\[Source:\s*raw_document:([^#|\]]+)(?:#chunk:([^|\]]+))?\|([^\]]+)\]\]/g;

export const DomainAgentArtifacts: React.FC = () => {
  const [agentFilter, setAgentFilter] = useState<DomainAgentId | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ArtifactType | 'all'>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [agents, setAgents] = useState<DomainAgent[]>([]);
  const [artifacts, setArtifacts] = useState<DomainArtifact[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewDelivery, setPreviewDelivery] = useState<ArtifactDelivery | null>(null);
  const [readerCitation, setReaderCitation] = useState<CitationRef | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([listDomainAgents(), listDomainArtifacts({ agent: agentFilter, type: typeFilter, workflow: workflowFilter })])
      .then(([agentRows, artifactRows]) => {
        if (!mounted) return;
        setAgents(agentRows);
        setArtifacts(artifactRows);
        setPreviewId((current) => current ?? artifactRows[0]?.id ?? null);
        setError(null);
      })
      .catch((err) => mounted && setError(err instanceof Error ? err.message : 'Could not load artifacts.'));
    return () => {
      mounted = false;
    };
  }, [agentFilter, typeFilter, workflowFilter]);

  const filteredArtifacts = useMemo(() => {
    return artifacts
      .filter((artifact) => {
        const matchesAgent = agentFilter === 'all' || artifact.agentId === agentFilter;
        const matchesType = typeFilter === 'all' || artifact.type === typeFilter;
        const matchesWorkflow = workflowFilter === 'all' || artifact.workflowId === workflowFilter;
        return matchesAgent && matchesType && matchesWorkflow;
      });
  }, [agentFilter, artifacts, typeFilter, workflowFilter]);

  const previewArtifact = filteredArtifacts.find((artifact) => artifact.id === previewId) ?? filteredArtifacts[0];
  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const workflowsById = useMemo(
    () => new Map(agents.flatMap((agent) => agent.workflows).map((workflow) => [workflow.id, workflow])),
    [agents],
  );

  useEffect(() => {
    let mounted = true;
    setPreviewContent('');
    setPreviewDelivery(null);
    setReaderCitation(null);
    if (!previewArtifact) return undefined;
    getArtifact(previewArtifact.id)
      .then((delivery) => {
        if (!mounted) return;
        setPreviewDelivery(delivery);
        setPreviewContent(delivery.content || delivery.signed_url || previewArtifact.summary);
      })
      .catch(() => mounted && setPreviewContent(previewArtifact.summary));
    return () => {
      mounted = false;
    };
  }, [previewArtifact]);

  const promoteArtifact = async (artifactId: string) => {
    const artifact = artifacts.find((item) => item.id === artifactId);
    if (!artifact || promotingId) return;
    setPromotingId(artifactId);
    setError(null);
    try {
      await promoteTaskArtifact(artifact.taskId, artifact.id);
      setArtifacts((current) => current.map((item) => item.id === artifactId ? { ...item, promoted: true } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add artifact to Second Brain.');
    } finally {
      setPromotingId(null);
    }
  };
  const downloadArtifact = async (artifactId: string) => {
    try {
      const delivery = await getArtifact(artifactId);
      if (delivery.signed_url) {
        window.open(delivery.signed_url, '_blank', 'noopener,noreferrer');
        return;
      }
      const content = delivery.content ?? '';
      const blob = new Blob([content], { type: delivery.mime_type || 'text/plain' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = delivery.filename || 'artifact';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download artifact.');
    }
  };

  const artifactTypes = Array.from(new Set(artifacts.map((artifact) => artifact.type)));
  const workflows = agents.flatMap((agent) => agent.workflows);
  const previewCitations = previewDelivery?.provenance?.source_refs ?? [];
  const citationMap = useMemo(() => {
    const map = new Map<number, CitationRef>();
    for (const citation of previewCitations) {
      if (!isCitableRef(citation)) continue;
      const ordinal = citationOrdinal(citation);
      if (ordinal !== null) map.set(ordinal, citation);
    }
    return map;
  }, [previewCitations]);

  return (
    <div className="flex min-h-0">
      <div className="min-w-0 flex-1 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="aos-h1">Artifacts</h1>
          <p className="aos-body mt-3 max-w-3xl" style={{ color: 'var(--fg-2)' }}>
            The founder-gated library of produced files. Preview, download, trace provenance, and deliberately promote high-signal work to OS Engine.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--aos-risk)] bg-[var(--aos-risk-tint)] px-4 py-3 text-sm text-[var(--aos-risk)]">
          {error}
        </div>
      )}

      <div className="rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]">
        <SectionEyebrow>Filter and sort</SectionEyebrow>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value as DomainAgentId | 'all')} className="aos-select">
            <option value="all">Agent - All</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.shortName}</option>
            ))}
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as ArtifactType | 'all')} className="aos-select">
            <option value="all">Type - All</option>
            {artifactTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)} className="aos-select">
            <option value="all">Workflow - All</option>
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
            ))}
          </select>
          <select className="aos-select" defaultValue="newest">
            <option value="newest">Date - Newest</option>
            <option value="oldest">Date - Oldest</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <SectionEyebrow>Produced artifacts</SectionEyebrow>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {filteredArtifacts.map((artifact, index) => (
              <div
                key={artifact.id}
                className={index % 4 === 0 ? 'lg:col-span-5' : index % 4 === 1 ? 'lg:col-span-7' : index % 4 === 2 ? 'lg:col-span-4' : 'lg:col-span-8'}
              >
                <ArtifactCard
                  artifact={artifact}
                  agent={artifact.agentId ? agentsById.get(artifact.agentId) : undefined}
                  workflow={artifact.workflowId ? workflowsById.get(artifact.workflowId) : undefined}
                  onPreview={setPreviewId}
                  onPromote={promoteArtifact}
                  onDownload={downloadArtifact}
                  promotionDisabled={promotingId === artifact.id}
                />
              </div>
            ))}
          </div>
        </section>

        <aside className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)]">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--aos-mist)] px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-[var(--fg-1)]">Preview</div>
              <div className="text-xs text-[var(--fg-3)]">HTML render before download</div>
            </div>
            <button className="rounded-md p-1.5 text-[var(--fg-3)] hover:bg-[var(--bg-canvas)]" onClick={() => setPreviewId(null)} title="Clear preview">
              <X className="h-4 w-4" />
            </button>
          </div>

          {previewArtifact ? (
            <>
              <div className="border-b border-[var(--aos-mist)] px-4 py-3">
                <div className="text-sm font-medium text-[var(--fg-1)]">{previewArtifact.title}</div>
              <div className="mt-1 text-xs text-[var(--fg-3)]">
                  {(previewArtifact.agentId ? agentsById.get(previewArtifact.agentId)?.shortName : 'Agent') ?? 'Agent'} / {(previewArtifact.workflowId ? workflowsById.get(previewArtifact.workflowId)?.name : 'Workflow') ?? 'Workflow'}
                </div>
              </div>
              <div className="max-h-[520px] overflow-y-auto p-5">
                <div className="os-reader-markdown">
                  {previewContent.trim().startsWith('<') ? (
                    <div dangerouslySetInnerHTML={{ __html: previewContent }} />
                  ) : (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => (
                          <p>{renderCitationChildren(children, citationMap, setReaderCitation)}</p>
                        ),
                        li: ({ children }) => (
                          <li>{renderCitationChildren(children, citationMap, setReaderCitation)}</li>
                        ),
                      }}
                    >
                      {previewContent || previewArtifact.summary}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
              <ArtifactCitationsRail citations={previewCitations} onOpenCitation={setReaderCitation} />
            </>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-[var(--fg-3)]">Select an artifact to preview it.</div>
          )}
        </aside>
      </div>
      </div>
      <Reader
        open={Boolean(readerCitation)}
        title={readerCitation ? citationLabel(readerCitation) : undefined}
        meta={readerCitation ? citationMeta(readerCitation) : undefined}
        body={readerCitation ? <CitationReaderBody citation={readerCitation} /> : undefined}
        onClose={() => setReaderCitation(null)}
      />
    </div>
  );
};

const ArtifactCitationsRail: React.FC<{
  citations: CitationRef[];
  onOpenCitation: (citation: CitationRef) => void;
}> = ({ citations, onOpenCitation }) => {
  const citableCitations = citations.filter(isCitableRef);
  if (citableCitations.length === 0) return null;

  return (
    <div className="border-t border-[var(--aos-mist)] px-4 py-4">
      <SectionEyebrow>Citations</SectionEyebrow>
      <div className="mt-3 space-y-4">
        {CITABLE_KINDS.map((kind) => {
          const items = citableCitations.filter((citation) => citation.source_kind === kind);
          if (items.length === 0) return null;
          const Icon = citationIcon(kind);
          return (
            <div key={kind}>
              <p className="aos-eyebrow mb-2 flex items-center gap-1.5">
                <Icon size={11} /> {CITATION_SOURCE_KIND_LABELS[kind]}
              </p>
              <div className="space-y-1.5">
                {items.map((citation, index) => {
                  const ordinal = citationOrdinal(citation);
                  return (
                    <button
                      key={`${citation.source_kind}-${citation.source_id ?? index}-${ordinal ?? index}`}
                      onClick={() => onOpenCitation(citation)}
                      className="group flex w-full items-center justify-between gap-2 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-2.5 py-2 text-left text-sm text-[var(--fg-2)] transition-colors hover:border-[var(--aos-brass)] hover:text-[var(--fg-1)]"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          {ordinal !== null && (
                            <span className="aos-mono inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--aos-brass)] px-1 text-[10px] text-[var(--aos-brass)]">
                              {ordinal}
                            </span>
                          )}
                          <span className="truncate">{citationLabel(citation)}</span>
                        </span>
                        <span className="mt-1 block truncate text-xs text-[var(--fg-4)]">{citationMeta(citation)}</span>
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
    </div>
  );
};

const renderCitationChildren = (
  children: React.ReactNode,
  citationsByOrdinal: Map<number, CitationRef>,
  onOpenCitation: (citation: CitationRef) => void,
): React.ReactNode =>
  React.Children.map(children, (child) => {
    if (typeof child !== 'string') return child;
    return renderCitationText(child, citationsByOrdinal, onOpenCitation);
  });

const renderCitationText = (
  text: string,
  citationsByOrdinal: Map<number, CitationRef>,
  onOpenCitation: (citation: CitationRef) => void,
): React.ReactNode => {
  const pieces: React.ReactNode[] = [];
  const markerPattern = /\[(\d+)\]|\[\[Source:\s*raw_document:([^#|\]]+)(?:#chunk:([^|\]]+))?\|([^\]]+)\]\]/g;
  let cursor = 0;
  for (const match of text.matchAll(markerPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) pieces.push(text.slice(cursor, index));
    const ordinal = match[1] ? Number(match[1]) : null;
    const citation = ordinal !== null ? citationsByOrdinal.get(ordinal) : inlineSourceCitation(match[0]);
    if (citation) {
      pieces.push(
        <button
          key={`${match[0]}-${index}`}
          type="button"
          onClick={() => onOpenCitation(citation)}
          className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--aos-brass)] px-1.5 align-baseline text-[11px] text-[var(--aos-brass)]"
          title={citationLabel(citation)}
          aria-label={`Open source: ${citationLabel(citation)}`}
        >
          {ordinal ?? 'S'}
        </button>,
      );
    }
    cursor = index + match[0].length;
  }
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return pieces.length > 0 ? pieces : text;
};

const inlineSourceCitation = (marker: string): CitationRef | null => {
  const match = INLINE_SOURCE_RE.exec(marker);
  INLINE_SOURCE_RE.lastIndex = 0;
  if (!match) return null;
  const [, documentId, chunkId, label] = match;
  const sectionLabel = label.includes(' section ') ? label.split(' section ').pop() || null : null;
  return {
    source_kind: 'document_chunk',
    source_id: chunkId || documentId,
    source_label: label.trim(),
    locator: { kind: 'section', section_label: sectionLabel },
    source_metadata: { document_id: documentId, raw_source_kind: 'raw_document' },
  };
};

const citationIcon = (kind: CitationSourceKind): React.ElementType => {
  if (kind === 'document_chunk') return FileText;
  if (kind === 'wiki_page') return BookOpen;
  if (kind === 'web') return Globe;
  return Layers;
};
