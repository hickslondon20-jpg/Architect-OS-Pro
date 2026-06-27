import React from 'react';
import { AgentCard, RecentTaskChip, SectionEyebrow } from '../../../components/pro-suite/domain-agents/DomainAgentPrimitives';
import { domainAgents, domainTasks } from './mockDomainAgents';

const spanClasses = [
  'lg:col-span-5',
  'lg:col-span-7',
  'lg:col-span-4',
  'lg:col-span-5',
  'lg:col-span-3',
];

export const DomainAgentGallery: React.FC = () => {
  const recentTasks = domainTasks.slice(0, 4);

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

      {recentTasks.length > 0 && (
        <section
          className="rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]"
          aria-label="Recent Domain Agent tasks"
        >
          <SectionEyebrow>Recent tasks</SectionEyebrow>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recentTasks.map((task) => (
              <RecentTaskChip key={task.id} task={task} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionEyebrow>Five disciplines</SectionEyebrow>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {domainAgents.map((agent, index) => (
            <AgentCard key={agent.id} agent={agent} spanClass={spanClasses[index]} />
          ))}
        </div>
      </section>
    </div>
  );
};
