import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ArtifactCard, SectionEyebrow } from '../../../components/pro-suite/domain-agents/DomainAgentPrimitives';
import { domainAgents, domainArtifacts, domainWorkflows, getAgent, getWorkflow } from './mockDomainAgents';
import type { ArtifactType, DomainAgentId } from './types';

const artifactPreview = (title: string) => `# ${title}

## Executive read
This artifact is rendered from markdown into an HTML preview before download.

## Provenance
Every artifact traces back to the task, workflow, and agent that produced it.

## Second Brain
Promotion is deliberate in this wireframe. The founder chooses which completed outputs are worth adding to OS Engine.`;

export const DomainAgentArtifacts: React.FC = () => {
  const [agentFilter, setAgentFilter] = useState<DomainAgentId | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ArtifactType | 'all'>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [promotedIds, setPromotedIds] = useState(() => new Set(domainArtifacts.filter((artifact) => artifact.promoted).map((artifact) => artifact.id)));
  const [previewId, setPreviewId] = useState<string | null>(domainArtifacts[0]?.id ?? null);

  const filteredArtifacts = useMemo(() => {
    return domainArtifacts
      .map((artifact) => ({ ...artifact, promoted: promotedIds.has(artifact.id) }))
      .filter((artifact) => {
        const matchesAgent = agentFilter === 'all' || artifact.agentId === agentFilter;
        const matchesType = typeFilter === 'all' || artifact.type === typeFilter;
        const matchesWorkflow = workflowFilter === 'all' || artifact.workflowId === workflowFilter;
        return matchesAgent && matchesType && matchesWorkflow;
      });
  }, [agentFilter, promotedIds, typeFilter, workflowFilter]);

  const previewArtifact = filteredArtifacts.find((artifact) => artifact.id === previewId) ?? filteredArtifacts[0];

  const promoteArtifact = (artifactId: string) => {
    setPromotedIds((current) => new Set([...current, artifactId]));
  };

  const artifactTypes = Array.from(new Set(domainArtifacts.map((artifact) => artifact.type)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="aos-h1">Artifacts</h1>
          <p className="aos-body mt-3 max-w-3xl" style={{ color: 'var(--fg-2)' }}>
            The founder-gated library of produced files. Preview, download, trace provenance, and deliberately promote high-signal work to OS Engine.
          </p>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]">
        <SectionEyebrow>Filter and sort</SectionEyebrow>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value as DomainAgentId | 'all')} className="aos-select">
            <option value="all">Agent - All</option>
            {domainAgents.map((agent) => (
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
            {domainWorkflows.map((workflow) => (
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
                  onPreview={setPreviewId}
                  onPromote={promoteArtifact}
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
                  {getAgent(previewArtifact.agentId).shortName} / {getWorkflow(previewArtifact.workflowId).name}
                </div>
              </div>
              <div className="max-h-[520px] overflow-y-auto p-5">
                <div className="os-reader-markdown">
                  <ReactMarkdown>{artifactPreview(previewArtifact.title)}</ReactMarkdown>
                </div>
              </div>
            </>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-[var(--fg-3)]">Select an artifact to preview it.</div>
          )}
        </aside>
      </div>
    </div>
  );
};
