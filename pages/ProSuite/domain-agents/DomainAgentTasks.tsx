import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { SectionEyebrow, TaskCard } from '../../../components/pro-suite/domain-agents/DomainAgentPrimitives';
import { domainAgents, domainTasks, statusLabels, statusOrder } from './mockDomainAgents';
import type { DomainAgentId, DomainTaskStatus } from './types';

const columnDot: Record<DomainTaskStatus, string> = {
  ready: 'var(--aos-steel-blue)',
  running: 'var(--aos-brass)',
  review: 'var(--aos-insight)',
  blocked: 'var(--aos-warning)',
  done: 'var(--aos-obsidian)',
};

export const DomainAgentTasks: React.FC = () => {
  const [agentFilter, setAgentFilter] = useState<DomainAgentId | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DomainTaskStatus | 'all'>('all');
  const [query, setQuery] = useState('');

  const filteredTasks = useMemo(() => {
    return domainTasks.filter((task) => {
      const matchesAgent = agentFilter === 'all' || task.agentId === agentFilter;
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesQuery = task.title.toLowerCase().includes(query.toLowerCase());
      return matchesAgent && matchesStatus && matchesQuery;
    });
  }, [agentFilter, query, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="aos-h1">Tasks</h1>
          <p className="aos-body mt-3 max-w-3xl" style={{ color: 'var(--fg-2)' }}>
            Every workflow run across all agents. The board and workspace are two views of the same task object.
          </p>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]">
        <SectionEyebrow>Filters</SectionEyebrow>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-3)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by task title..."
              className="aos-input pl-10"
            />
          </label>
          <select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value as DomainAgentId | 'all')} className="aos-select">
            <option value="all">Agent - All</option>
            {domainAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.shortName}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DomainTaskStatus | 'all')} className="aos-select">
            <option value="all">Status - All</option>
            {statusOrder.map((status) => (
              <option key={status} value={status}>{statusLabels[status]}</option>
            ))}
          </select>
        </div>
      </div>

      <section>
        <SectionEyebrow>State machine</SectionEyebrow>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
          {statusOrder.map((status) => {
            const tasks = filteredTasks.filter((task) => task.status === status);
            return (
              <div
                key={status}
                className="min-h-[320px] rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-soft-1)]"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--fg-1)]">
                    <span className="h-2 w-2 rounded-full" style={{ background: columnDot[status] }} />
                    {statusLabels[status]}
                  </div>
                  <span className="aos-mono text-xs text-[var(--fg-3)]">{tasks.length}</span>
                </div>
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  {tasks.length === 0 && (
                    <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-3 py-6 text-center text-xs text-[var(--fg-3)]">
                      No matching tasks.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
