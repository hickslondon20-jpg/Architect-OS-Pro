import React from 'react';
import { ArrowRight, Check, Download, FileText, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DomainAgent, DomainArtifact, DomainTask, DomainTaskStatus, DomainWorkflow } from '../../../pages/ProSuite/domain-agents/types';

export const statusLabels: Record<DomainTaskStatus, string> = {
  ready: 'Ready',
  running: 'Running',
  review: 'Review',
  blocked: 'Blocked',
  done: 'Done',
};

export const statusOrder: DomainTaskStatus[] = ['ready', 'running', 'review', 'blocked', 'done'];

const statusStyles: Record<DomainTaskStatus, { className: string; dot: string }> = {
  ready: { className: 'aos-chip--notstarted', dot: 'var(--aos-steel-blue)' },
  running: { className: 'aos-chip--brass', dot: 'var(--aos-brass)' },
  review: { className: 'aos-chip--insight', dot: 'var(--aos-insight)' },
  blocked: { className: 'aos-chip--watch', dot: 'var(--aos-warning)' },
  done: { className: 'aos-chip--complete', dot: 'var(--aos-success)' },
};

export const StatusChip: React.FC<{ status: DomainTaskStatus; waitingOn?: string }> = ({ status, waitingOn }) => {
  const styles = statusStyles[status];
  return (
    <span className={`aos-chip ${styles.className}`}>
      <span className="aos-chip__dot" style={{ background: styles.dot }} />
      {status === 'blocked' ? 'Waiting on you' : statusLabels[status]}
      {waitingOn ? <span className="hidden xl:inline"> - {waitingOn}</span> : null}
    </span>
  );
};

export const AgentMark: React.FC<{ agent: DomainAgent; size?: 'sm' | 'md' | 'lg' }> = ({ agent, size = 'md' }) => {
  const sizeClass = size === 'lg' ? 'h-12 w-12 text-base' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[var(--radius-xs)] font-semibold text-[var(--fg-on-dark)] ${sizeClass}`}
      style={{ background: agent.color }}
    >
      {agent.initial}
    </span>
  );
};

export const SectionEyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-3 flex items-center gap-2">
    <span className="h-px w-5 bg-[var(--aos-brass)]" />
    <span className="aos-eyebrow" style={{ color: 'var(--aos-brass)' }}>
      {children}
    </span>
  </div>
);

export const AgentCard: React.FC<{ agent: DomainAgent; spanClass: string }> = ({ agent, spanClass }) => (
  <Link
    to={`/pro/intelligence/domain-agents/agents/${agent.id}`}
    className={`group flex min-h-[170px] flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft-1)] transition-all hover:-translate-y-0.5 hover:border-[var(--aos-brass)] ${spanClass}`}
  >
    <div className="flex items-center gap-3">
      <AgentMark agent={agent} />
      <div>
        <h2 className="aos-h3">{agent.shortName}</h2>
        <p className="aos-caption">{agent.discipline}</p>
      </div>
    </div>
    <p className="aos-small flex-1">{agent.strength}</p>
    <div className="flex items-center justify-between gap-3">
      <span className="aos-mono text-xs text-[var(--fg-3)]">{agent.activity}</span>
      <ArrowRight className="h-4 w-4 text-[var(--aos-brass)] opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  </Link>
);

const fallbackAgent = (agentId?: string): DomainAgent => ({
  id: (agentId || 'financial') as DomainAgent['id'],
  name: 'Domain Agent',
  shortName: agentId ? `${agentId[0].toUpperCase()}${agentId.slice(1)}` : 'Agent',
  initial: (agentId || 'A').slice(0, 1).toUpperCase(),
  color: 'var(--aos-obsidian)',
  discipline: '',
  strength: '',
  activity: '',
  fullDescription: '',
  capabilities: [],
  thoughtStarters: [],
  workflows: [],
});

const fallbackWorkflow = (workflowId?: string | null): DomainWorkflow => ({
  id: workflowId || '',
  agentId: 'financial',
  name: 'Workflow',
  description: '',
  defaultTaskTitle: 'Domain Agent Task',
});

export const RecentTaskChip: React.FC<{ task: DomainTask; agent?: DomainAgent }> = ({ task, agent: providedAgent }) => {
  const agent = providedAgent ?? fallbackAgent(task.agentId);
  return (
    <Link
      to={`/pro/intelligence/domain-agents/tasks/${task.id}`}
      className="flex min-w-[230px] flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--aos-brass)]"
    >
      <span className="truncate text-sm font-medium text-[var(--fg-1)]">{task.title}</span>
      <span className="flex items-center gap-2 text-xs text-[var(--fg-3)]">
        <AgentMark agent={agent} size="sm" />
        {agent.shortName}
        <span className="text-[var(--fg-4)]">/</span>
        {statusLabels[task.status]}
        <span className="text-[var(--fg-4)]">/</span>
        <span className="aos-mono">{task.updatedAt}</span>
      </span>
    </Link>
  );
};

export const TaskCard: React.FC<{ task: DomainTask; agent?: DomainAgent; workflow?: DomainWorkflow }> = ({ task, agent: providedAgent, workflow: providedWorkflow }) => {
  const agent = providedAgent ?? fallbackAgent(task.agentId);
  const workflow = providedWorkflow ?? fallbackWorkflow(task.workflowId);
  return (
    <Link
      to={`/pro/intelligence/domain-agents/tasks/${task.id}`}
      className="block rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-soft-1)] transition-colors hover:border-[var(--aos-brass)]"
    >
      <div className="mb-3 flex items-start gap-2">
        <AgentMark agent={agent} size="sm" />
        <div className="min-w-0">
          <div className="text-sm font-medium leading-snug text-[var(--fg-1)]">{task.title}</div>
          <div className="mt-1 text-xs leading-relaxed text-[var(--fg-3)]">{workflow.name}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--fg-3)]">{agent.shortName}</span>
        {task.status === 'blocked' ? (
          <span className="rounded-md bg-[var(--aos-warning-tint)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#8E6C16]">
            Waiting on you
          </span>
        ) : (
          <span className="aos-mono text-xs text-[var(--fg-3)]">{task.updatedAt}</span>
        )}
      </div>
    </Link>
  );
};

export const ArtifactCard: React.FC<{
  artifact: DomainArtifact;
  agent?: DomainAgent;
  workflow?: DomainWorkflow;
  onPromote: (artifactId: string) => void;
  onPreview: (artifactId: string) => void;
  onDownload?: (artifactId: string) => void;
  promotionDisabled?: boolean;
}> = ({ artifact, agent: providedAgent, workflow: providedWorkflow, onPromote, onPreview, onDownload, promotionDisabled = false }) => {
  const agent = providedAgent ?? fallbackAgent(artifact.agentId);
  const workflow = providedWorkflow ?? fallbackWorkflow(artifact.workflowId);

  return (
    <article className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)]">
      <button
        onClick={() => onPreview(artifact.id)}
        className="block h-32 w-full border-b border-[var(--aos-mist)] bg-[var(--bg-sunken)] p-4 text-left"
      >
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--aos-brass)]" />
          <span className="aos-eyebrow">{artifact.type}</span>
        </div>
        {artifact.sections.slice(0, 3).map((section, index) => (
          <div
            key={section}
            className="mb-2 h-2 rounded-full bg-[rgba(25,48,82,0.12)]"
            style={{ width: `${92 - index * 15}%` }}
          />
        ))}
      </button>
      <div className="p-4">
        <div className="mb-1 text-sm font-medium text-[var(--fg-1)]">{artifact.title}</div>
        <div className="mb-3 flex items-center justify-between gap-2 text-xs text-[var(--fg-3)]">
          <span>{agent.shortName} / {workflow.name}</span>
          <span className="aos-mono">{artifact.createdAt}</span>
        </div>
        <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-[var(--fg-3)]">{artifact.summary}</p>
        <div className="flex flex-wrap gap-2">
          <button className="aos-btn aos-btn--sm aos-btn--outline" onClick={() => onPreview(artifact.id)}>
            Preview
          </button>
          <button className="aos-btn aos-btn--sm aos-btn--outline" onClick={() => onDownload?.(artifact.id)} disabled={!onDownload}>
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          <button
            className={`aos-btn aos-btn--sm ${artifact.promoted ? 'aos-btn--ghost' : 'aos-btn--brass'}`}
            onClick={() => onPromote(artifact.id)}
            disabled={artifact.promoted || promotionDisabled}
          >
            {artifact.promoted ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {artifact.promoted ? 'In Second Brain' : 'Second Brain'}
          </button>
          <button className="rounded-md p-2 text-[var(--fg-3)] transition-colors hover:bg-[var(--aos-risk-tint)] hover:text-[var(--aos-risk)]" title="Delete artifact">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <Link
          to={`/pro/intelligence/domain-agents/tasks/${artifact.taskId}`}
          className="mt-3 inline-flex text-xs font-medium text-[var(--aos-slate-blue)] hover:text-[var(--aos-obsidian)]"
        >
          Provenance: task to workflow to agent
        </Link>
      </div>
    </article>
  );
};
