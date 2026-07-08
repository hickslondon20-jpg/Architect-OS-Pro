import React, { useEffect, useMemo, useState } from 'react';
import { AgentCard, RecentTaskChip, SectionEyebrow } from '../../../components/pro-suite/domain-agents/DomainAgentPrimitives';
import { listDomainAgents, listDomainTasks } from '../../../lib/domainAgentsApi';
import type { DomainAgent, DomainTask } from './types';

const spanClasses = [
  'lg:col-span-5',
  'lg:col-span-7',
  'lg:col-span-4',
  'lg:col-span-5',
  'lg:col-span-3',
];

export const DomainAgentGallery: React.FC = () => {
  const [agents, setAgents] = useState<DomainAgent[]>([]);
  const [recentTasks, setRecentTasks] = useState<DomainTask[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([listDomainAgents(), listDomainTasks()])
      .then(([agentRows, taskRows]) => {
        if (!mounted) return;
        setAgents(agentRows);
        setRecentTasks(taskRows.slice(0, 4));
      })
      .catch((err) => mounted && setError(err instanceof Error ? err.message : 'Could not load Domain Agents.'));
    return () => {
      mounted = false;
    };
  }, []);

  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="aos-h1">Choose the discipline for the work.</h1>
          <p className="aos-body mt-3 max-w-3xl" style={{ color: 'var(--fg-2)' }}>
            Domain Agents are task-bound production surfaces. Pick the specialist, choose a workflow, and
            get a finished artifact without turning the area into a second Virtual CSO.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--aos-risk)] bg-[var(--aos-risk-tint)] px-4 py-3 text-sm text-[var(--aos-risk)]">
          {error}
        </div>
      )}

      {recentTasks.length > 0 && (
        <section
          className="rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]"
          aria-label="Recent Domain Agent tasks"
        >
          <SectionEyebrow>Recent tasks</SectionEyebrow>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recentTasks.map((task) => (
              <RecentTaskChip key={task.id} task={task} agent={agentsById.get(task.agentId)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionEyebrow>Five disciplines</SectionEyebrow>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {agents.map((agent, index) => (
            <AgentCard key={agent.id} agent={agent} spanClass={spanClasses[index]} />
          ))}
          {!error && agents.length === 0 && (
            <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-8 text-center text-sm text-[var(--fg-3)] lg:col-span-12">
              Loading agents...
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
