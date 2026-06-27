import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import {
  AgentMark,
  SectionEyebrow,
  StatusChip,
} from '../../../components/pro-suite/domain-agents/DomainAgentPrimitives';
import { domainAgents, domainArtifacts, domainTasks, getAgent } from './mockDomainAgents';
import type { DomainAgentId, RequestCaptureEntry } from './types';

const isDomainAgentId = (value: string | undefined): value is DomainAgentId =>
  !!value && domainAgents.some((agent) => agent.id === value);

export const DomainAgentProfile: React.FC = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [ask, setAsk] = useState('');
  const [requestLog, setRequestLog] = useState<RequestCaptureEntry[]>([]);

  if (!isDomainAgentId(agentId)) {
    return <Navigate to="/pro/intelligence/domain-agents" replace />;
  }

  const agent = getAgent(agentId);
  const recentTasks = domainTasks.filter((task) => task.agentId === agent.id).slice(0, 3);
  const recentArtifacts = domainArtifacts.filter((artifact) => artifact.agentId === agent.id).slice(0, 2);

  const launchWorkflow = (workflowId: string) => {
    const existingTask = domainTasks.find((task) => task.workflowId === workflowId);
    navigate(`/pro/intelligence/domain-agents/tasks/${existingTask?.id ?? 'task-fin-pricing'}`);
  };

  const submitAsk = () => {
    const request = ask.trim();
    if (!request) return;
    const lower = request.toLowerCase();
    const mappedWorkflow = agent.workflows.find((workflow) => lower.includes(workflow.name.toLowerCase().split(' ')[0]));

    // Open decision: out-of-scope guardrails are placeholder only in this wireframe.
    setRequestLog((current) => [
      {
        id: `request-${Date.now()}`,
        agentId: agent.id,
        request,
        mappedWorkflowId: mappedWorkflow?.id,
        capturedAt: 'Just now',
      },
      ...current,
    ]);
    setAsk('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <AgentMark agent={agent} size="lg" />
          <div>
            <div className="aos-eyebrow mb-2" style={{ color: 'var(--aos-brass)' }}>
              Agent profile
            </div>
            <h1 className="aos-h1">{agent.name}</h1>
            <p className="aos-body mt-3 max-w-3xl" style={{ color: 'var(--fg-2)' }}>
              {agent.fullDescription}
            </p>
          </div>
        </div>
        <Link to="/pro/intelligence/domain-agents" className="aos-btn aos-btn--outline">
          <ArrowLeft className="h-4 w-4" />
          All agents
        </Link>
      </div>

      <section>
        <SectionEyebrow>What it does</SectionEyebrow>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          {agent.capabilities.map((capability, index) => (
            <div
              key={capability.label}
              className={`rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)] ${
                index === 0 ? 'lg:col-span-5' : index === 1 ? 'lg:col-span-7' : 'lg:col-span-12'
              }`}
            >
              <div className="mb-2 text-sm font-semibold text-[var(--fg-1)]">{capability.label}</div>
              <p className="text-sm leading-relaxed text-[var(--fg-3)]">{capability.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionEyebrow>Thought starters</SectionEyebrow>
        <div className="flex flex-wrap gap-3">
          {agent.thoughtStarters.map((starter) => (
            <button
              key={starter.text}
              onClick={() => launchWorkflow(starter.workflowId)}
              className="max-w-[280px] rounded-[var(--radius-sm)] border border-dashed border-[var(--aos-steel-blue)] bg-[var(--bg-sunken)] px-4 py-3 text-left text-sm leading-relaxed text-[var(--aos-slate-blue)] transition-colors hover:border-[var(--aos-brass)] hover:bg-[var(--bg-surface)]"
            >
              "{starter.text}"
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionEyebrow>Workflows</SectionEyebrow>
        <div className="space-y-3">
          {agent.workflows.map((workflow) => (
            <button
              key={workflow.id}
              onClick={() => launchWorkflow(workflow.id)}
              className="group flex w-full flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 text-left shadow-[var(--shadow-soft-1)] transition-colors hover:border-[var(--aos-brass)] sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                <span className="block text-sm font-semibold text-[var(--fg-1)]">{workflow.name}</span>
                <span className="mt-1 block text-sm leading-relaxed text-[var(--fg-3)]">{workflow.description}</span>
              </span>
              <span className="aos-btn aos-btn--brass shrink-0">
                Launch
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionEyebrow>Free-form ask</SectionEyebrow>
        <div className="rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              value={ask}
              onChange={(event) => setAsk(event.target.value)}
              placeholder={`Ask the ${agent.shortName} Agent to analyze or produce something...`}
              className="aos-input flex-1"
            />
            <button className="aos-btn aos-btn--primary" onClick={submitAsk}>
              <Send className="h-4 w-4" />
              Capture request
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--fg-3)]">
            Placeholder only: requests are captured locally for roadmap signal. Net-new guardrails are intentionally not decided in this pass.
          </p>
          {requestLog.length > 0 && (
            <div className="mt-4 space-y-2">
              {requestLog.map((entry) => (
                <div key={entry.id} className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-sunken)] px-3 py-2 text-xs text-[var(--fg-2)]">
                  <span className="font-medium">{entry.request}</span>
                  <span className="ml-2 text-[var(--fg-3)]">
                    {entry.mappedWorkflowId ? 'Mapped to existing workflow' : 'Logged as net-new request'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft-1)]">
          <SectionEyebrow>Recent tasks</SectionEyebrow>
          <div className="space-y-3">
            {recentTasks.map((task) => (
              <Link
                key={task.id}
                to={`/pro/intelligence/domain-agents/tasks/${task.id}`}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--aos-mist)] px-4 py-3 transition-colors hover:border-[var(--aos-brass)]"
              >
                <span>
                  <span className="block text-sm font-medium text-[var(--fg-1)]">{task.title}</span>
                  <span className="aos-mono text-xs text-[var(--fg-3)]">{task.runLabel} / {task.updatedAt}</span>
                </span>
                <StatusChip status={task.status} />
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft-1)]">
          <SectionEyebrow>Recent artifacts</SectionEyebrow>
          <div className="space-y-3">
            {recentArtifacts.map((artifact) => (
              <Link
                key={artifact.id}
                to={`/pro/intelligence/domain-agents/tasks/${artifact.taskId}`}
                className="block rounded-[var(--radius-sm)] border border-[var(--aos-mist)] px-4 py-3 transition-colors hover:border-[var(--aos-brass)]"
              >
                <span className="block text-sm font-medium text-[var(--fg-1)]">{artifact.title}</span>
                <span className="text-xs capitalize text-[var(--fg-3)]">{artifact.type} / {artifact.createdAt}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
